import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import Parser from 'rss-parser';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const parser = new Parser();

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // 1. Отримуємо новини (наприклад, з RSS ТСН або іншого ресурсу)
    const feed = await parser.parseURL('https://tsn.ua/rss/full.rss');
    const latestNews = feed.items[0]; // Беремо найсвіжішу

    if (!latestNews) return NextResponse.json({ error: "No news found" });

    // 2. AI Аналіз
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "Ти — LIGHT AI. Робиш блискавичний, гострий аналіз новин українською. Коротко, з емодзі." },
        { role: "user", content: `Проаналізуй: ${latestNews.title}. Суть: ${latestNews.contentSnippet}` }
      ],
      model: "llama-3.3-70b-versatile",
    });

    const aiAnalysis = completion.choices[0]?.message?.content;

    // 3. Відправка в Telegram
    const message = `⚡️ <b>${latestNews.title}</b>\n\n${aiAnalysis}\n\n<a href="${latestNews.link}">Читати детальніше</a>`;

    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    return NextResponse.json({ success: true, posted: latestNews.title });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
