import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import Parser from 'rss-parser';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const parser = new Parser();

// Список різних джерел для різноманітності
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
    // 1. Обираємо випадкове джерело
    const source = SOURCES[Math.floor(Math.random() * SOURCES.length)];
    const feed = await parser.parseURL(source.url);
    const latestNews = feed.items[0];

    if (!latestNews) return NextResponse.json({ error: "No news" });

    // 2. AI Аналіз з урахуванням категорії
    const completion = await groq.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: `Ти аналітик LIGHT AI. Твоя спеціалізація: ${source.name}. Роби гострий, експертний коментар українською. Максимум 2-3 речення.` 
        },
        { role: "user", content: `Новина: ${latestNews.title}. Текст: ${latestNews.contentSnippet}` }
      ],
      model: "llama-3.3-70b-versatile",
    });

    const aiAnalysis = completion.choices[0]?.message?.content;

    // 3. Формуємо пост
    const message = `<b>${source.name}</b>\n\n⚡️ <b>${latestNews.title}</b>\n\n${aiAnalysis}\n\n<a href="${latestNews.link}">Читати повністю</a>`;

    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    return NextResponse.json({ success: true, category: source.name });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
