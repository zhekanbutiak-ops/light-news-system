import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import Parser from 'rss-parser';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const parser = new Parser();

const KV_KEY_LAST_LINK = "ln_autopublish_last";

async function getKV() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  try {
    const { kv } = await import("@vercel/kv");
    return kv;
  } catch {
    return null;
  }
}

// Звичайні новинні джерела
const SOURCES = [
  { name: "🌍 СВІТ", url: "https://tsn.ua/rss/svit.rss" },
  { name: "💰 ЕКОНОМІКА", url: "https://tsn.ua/rss/groshi.rss" },
  { name: "🛡️ ВІЙНА", url: "https://tsn.ua/rss/ato.rss" },
  { name: "🇺🇦 УКРАЇНА", url: "https://tsn.ua/rss/ukrayina.rss" }
];

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const kv = await getKV();
    // Перемішуємо джерела, щоб не публікувати ту саму новину з різних розділів
    const shuffled = [...SOURCES].sort(() => Math.random() - 0.5);
    let source = shuffled[0];
    let feed = await parser.parseURL(source.url);
    let latestNews = feed.items[0];

    if (!latestNews) return NextResponse.json({ error: "No news" });

    if (kv) {
      const lastLink = (await kv.get(KV_KEY_LAST_LINK)) as string | null;
      let tries = 0;
      while (latestNews?.link && latestNews.link === lastLink && tries < SOURCES.length) {
        tries++;
        source = shuffled[tries % shuffled.length];
        feed = await parser.parseURL(source.url);
        latestNews = feed.items[0];
      }
      if (latestNews?.link && latestNews.link === lastLink) {
        return NextResponse.json({ skipped: true, reason: "all latest already posted" });
      }
    }
    if (!latestNews) return NextResponse.json({ error: "No news" });

    const originalTitle = latestNews.title ?? "";
    const originalText = latestNews.contentSnippet || latestNews.content || "";

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

    const aiDescription = completion.choices[0]?.message?.content || "Опис недоступний";
    const message = `<b>${source.name}</b>\n\n<b>${originalTitle}</b>\n\n${aiDescription}\n\n👉 <a href="${latestNews.link}">Читати повністю</a>`;

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

    if (kv && latestNews.link) await kv.set(KV_KEY_LAST_LINK, latestNews.link);
    return NextResponse.json({ success: true, category: source.name, posted: originalTitle });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
