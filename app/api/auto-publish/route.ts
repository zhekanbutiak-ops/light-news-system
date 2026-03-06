import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import Parser from 'rss-parser';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const parser = new Parser();

const KV_KEY_POSTED_LINKS = "ln_autopublish_posted_links";
const MAX_POSTED_LINKS = 500; // скільки останніх посилань зберігати — повторів не буде ніколи

import { getKV } from "@/lib/kv";

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

// Різні джерела для автопублікації в TG (без дубляжу з одного сайту)
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

  try {
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
      return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID missing" }, { status: 503 });
    }

    const kv = await getKV();
    // Перемішуємо джерела, щоб не публікувати ту саму новину з різних розділів
    const shuffled = [...SOURCES].sort(() => Math.random() - 0.5);
    const FEED_TAKE = 12; // скільки елементів брати з кожного джерела для вибору

    const feeds = await Promise.all(
      shuffled.map(async (s) => {
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

    let picked = candidates[0];
    let repost = false;
    if (kv) {
      const fresh = [];
      for (const c of candidates) {
        const link = (c.it as { link?: string | null }).link ?? undefined;
        if (!link) continue;
        const posted = await wasAlreadyPosted(kv, link);
        if (!posted) fresh.push(c);
      }
      if (fresh.length > 0) {
        picked = fresh[0];
      } else {
        // Якщо всі кандидати вже були — все одно публікуємо найсвіжіше, щоб не було "пропусків"
        repost = true;
        picked = candidates[0];
      }
    }

    const latestNews = picked.it as { title?: string | null; link?: string | null; contentSnippet?: string | null; content?: string | null };
    const source = picked.source;
    if (!latestNews) return NextResponse.json({ error: "No news" }, { status: 502 });

    const originalTitle = latestNews.title ?? "";
    const originalText = latestNews.contentSnippet || latestNews.content || "";

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
    return NextResponse.json({ success: true, repost, category: source.name, posted: originalTitle });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
