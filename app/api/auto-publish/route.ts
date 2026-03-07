import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import Parser from 'rss-parser';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const parser = new Parser();

const KV_KEY_POSTED_LINKS = "ln_autopublish_posted_links";
const KV_KEY_LAST_SOURCE_INDEX = "ln_autopublish_last_source_index";
const MAX_POSTED_LINKS = 500; // скільки останніх посилань зберігати — одна й та сама стаття (за посиланням) у TG не повторюється

import { getKV } from "@/lib/kv";
import { saveNews } from "@/lib/db";
import { postToFacebookPage } from "@/lib/facebook";

async function wasAlreadyPosted(kv: Awaited<ReturnType<typeof getKV>>, link: string): Promise<boolean> {
  if (!kv || !link) return false;
  const raw = (await kv.get(KV_KEY_POSTED_LINKS)) as string[] | null;
  const list = Array.isArray(raw) ? raw : [];
  return list.includes(link);
}

async function markAsPosted(kv: Awaited<ReturnType<typeof getKV>>, link: string): Promise<void> {
  if (!kv || !link) return;
  const raw = (await kv.get(KV_KEY_POSTED_LINKS)) as string[] | null;
  const list = Array.isArray(raw) ? raw : [];
  const next = [...list, link].slice(-MAX_POSTED_LINKS);
  await kv.set(KV_KEY_POSTED_LINKS, next);
}

// Різні джерела для автопублікації в TG; порядок = ротація (СВІТ → ЕКОНОМІКА → ВІЙНА → УКРАЇНА → …)
const SOURCES = [
  { name: "🌍 СВІТ", url: "https://www.eurointegration.com.ua/rss/" },
  { name: "💰 ЕКОНОМІКА", url: "https://epravda.com.ua/rss/news/" },
  { name: "🛡️ ВІЙНА", url: "https://novynarnia.com/feed/rss/" },
  { name: "🇺🇦 УКРАЇНА", url: "https://www.suspilne.media/rss/all.rss" }
];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 07:00–21:00 Київ — публікуємо в Telegram; 21:00–07:00 — зберігаємо в БД для ранкового дайджесту (включно з 20:00 та 20:30)
  const nowKyiv = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Kyiv" }));
  const hour = nowKyiv.getHours();
  const isNight = hour < 7 || hour >= 21;

  try {
    if (!isNight && (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID)) {
      return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID missing" }, { status: 503 });
    }

    const kv = await getKV();
    // Ротація джерел: чергуємо СВІТ → ЕКОНОМІКА → ВІЙНА → УКРАЇНА, щоб була різноманітність
    const lastSourceIndexRaw = kv ? (await kv.get(KV_KEY_LAST_SOURCE_INDEX)) : null;
    let lastSourceIndex = -1;
    if (typeof lastSourceIndexRaw === "number" && Number.isInteger(lastSourceIndexRaw)) lastSourceIndex = lastSourceIndexRaw;
    else if (typeof lastSourceIndexRaw === "string") {
      const n = parseInt(lastSourceIndexRaw, 10);
      if (!Number.isNaN(n) && n >= 0) lastSourceIndex = n;
    }
    if (lastSourceIndex >= SOURCES.length) lastSourceIndex = -1;
    const nextSourceIndex = (lastSourceIndex + 1) % SOURCES.length;

    const FEED_TAKE = 30;

    const feeds = await Promise.all(
      SOURCES.map(async (s) => {
        try {
          const f = await parser.parseURL(s.url);
          return { source: s, items: Array.isArray(f.items) ? f.items : [], ok: true as const };
        } catch (e) {
          const msg = e instanceof Error ? e.message : "feed error";
          console.error("[auto-publish] feed error:", s.url, msg);
          return { source: s, items: [] as any[], ok: false as const };
        }
      })
    );

    const candidates = feeds.flatMap(({ source, items }) =>
      items.slice(0, FEED_TAKE).map((it) => ({ source, it }))
    );
    if (candidates.length === 0) return NextResponse.json({ error: "No news" }, { status: 502 });

    // Спершу шукаємо неопубліковану новину з джерела "на черзі" (ротація), потім з інших
    const preferredOrder = Array.from({ length: SOURCES.length }, (_, i) => (nextSourceIndex + i) % SOURCES.length);
    const sourceNameByIndex = (idx: number) => SOURCES[idx].name;

    let picked = candidates[0];
    let repost = false;
    if (kv) {
      const fresh: typeof candidates = [];
      for (const c of candidates) {
        const link = (c.it as { link?: string | null }).link ?? undefined;
        if (!link) continue;
        const posted = await wasAlreadyPosted(kv, link);
        if (!posted) fresh.push(c);
      }
      if (fresh.length > 0) {
        // Обираємо першу "свіжу" новину з джерела на черзі, інакше з наступного в ротації
        let chosen: typeof picked | null = null;
        for (const idx of preferredOrder) {
          const name = sourceNameByIndex(idx);
          chosen = fresh.find((c) => c.source.name === name) ?? null;
          if (chosen) break;
        }
        picked = chosen ?? fresh[0];
      } else {
        repost = true;
        // При повторі теж дотримуємось ротації: перший кандидат з джерела на черзі
        let chosen: typeof picked | null = null;
        for (const idx of preferredOrder) {
          const name = sourceNameByIndex(idx);
          chosen = candidates.find((c) => c.source.name === name) ?? null;
          if (chosen) break;
        }
        picked = chosen ?? candidates[0];
      }
    }

    const latestNews = picked.it as { title?: string | null; link?: string | null; contentSnippet?: string | null; content?: string | null; pubDate?: string | null };
    const source = picked.source;
    if (!latestNews) return NextResponse.json({ error: "No news" }, { status: 502 });

    const originalTitle = latestNews.title ?? "";
    const originalText = latestNews.contentSnippet || latestNews.content || "";

    // Нічний режим: зберігаємо в БД, не постимо в TG
    if (isNight) {
      const pubDate = latestNews.pubDate ? new Date(latestNews.pubDate) : new Date();
      const saved = await saveNews({
        title: originalTitle,
        contentSnippet: originalText ? String(originalText).slice(0, 2000) : null,
        link: String(latestNews.link || ""),
        pubDate,
        sourceName: source.name,
      });
      const sourceIdx = SOURCES.findIndex((s) => s.name === source.name);
      if (kv && sourceIdx >= 0) await kv.set(KV_KEY_LAST_SOURCE_INDEX, sourceIdx);
      return NextResponse.json({ saved: true, savedToDb: saved, reason: "night mode (21:00–07:00 Kyiv)", title: originalTitle });
    }

    // AI-опис робимо best-effort: якщо Groq впав — все одно публікуємо
    let aiDescription = "Опис недоступний";
    if (process.env.GROQ_API_KEY) {
      try {
        const completion = await groq.chat.completions.create({
          messages: [
            {
              role: "system",
              content: "Ти професійний журналіст. Проаналізуй текст і напиши стислий опис (до 3 речень) у професійному стилі. Не повторюй заголовок новини."
            },
            {
              role: "user",
              content: `Проаналізуй цей текст і напиши стислий опис (до 3 речень) у професійному стилі, не повторюючи заголовок:\n\n${originalText}`
            }
          ],
          model: "llama-3.3-70b-versatile",
        });
        aiDescription = completion.choices[0]?.message?.content || aiDescription;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Groq error";
        console.error("[auto-publish] Groq error:", msg);
        aiDescription = originalText ? String(originalText).slice(0, 260) : aiDescription;
      }
    } else {
      aiDescription = originalText ? String(originalText).slice(0, 260) : aiDescription;
    }

    const safeSource = escapeHtml(source.name);
    const safeTitle = escapeHtml(originalTitle);
    const safeDesc = escapeHtml(String(aiDescription).trim());
    const safeLink = escapeHtml(String(latestNews.link || ""));
    const message = `<b>${safeSource}</b>${repost ? " <i>(повтор)</i>" : ""}\n\n<b>${safeTitle}</b>\n\n${safeDesc}\n\n👉 <a href="${safeLink}">Читати повністю</a>`;

    const tgRes = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    const tgData = await tgRes.json().catch(() => ({}));
    if (!tgRes.ok) {
      console.error("[auto-publish] Telegram error:", tgData);
      return NextResponse.json(
        { error: "Telegram send failed", details: (tgData as { description?: string }).description },
        { status: 502 }
      );
    }

    if (kv && latestNews.link && !repost) await markAsPosted(kv, latestNews.link);
    const sourceIdx = SOURCES.findIndex((s) => s.name === source.name);
    if (kv && sourceIdx >= 0) await kv.set(KV_KEY_LAST_SOURCE_INDEX, sourceIdx);

    // Автопост у Facebook (той самий контент, що й в TG) — best-effort
    const fbMessage = [
      `${source.name}${repost ? " (повтор)" : ""}`,
      "",
      originalTitle,
      "",
      String(aiDescription).trim(),
      "",
      `Читати повністю: ${latestNews.link || ""}`,
    ].join("\n");
    const fbPost = await postToFacebookPage(fbMessage, String(latestNews.link || "").trim() || undefined);

    return NextResponse.json({
      success: true,
      repost,
      category: source.name,
      posted: originalTitle,
      facebook: fbPost ? { id: fbPost.id } : undefined,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
