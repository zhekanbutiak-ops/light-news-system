import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isBadAiDescription(text: string): boolean {
  const t = (text || "").toLowerCase().trim();
  if (!t) return true;
  const badPatterns = [
    "я не бачу тексту",
    "будь ласка, надішліть текст",
    "надішліть текст",
    "опис недоступний",
    "не можу проаналізувати",
    "не бачу тексту для аналізу",
    "щоб я міг",
    "надайте текст",
  ];
  return badPatterns.some((p) => t.includes(p));
}

export async function POST(req: NextRequest) {
  try {
    // 0. Тільки cron (або внутрішні виклики з CRON_SECRET) можуть публікувати
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, content, link } = await req.json();

    // 1. Перевірка наявності ключів
    if (!process.env.GROQ_API_KEY || !process.env.TELEGRAM_BOT_TOKEN) {
      return NextResponse.json({ error: "API Keys are missing on server" }, { status: 500 });
    }

    // 2. Перевірка вхідних даних
    if (!title || !content) {
      return NextResponse.json({ error: "Заголовок або текст відсутні" }, { status: 400 });
    }

    // 3. Запит до ШІ тільки для опису (заголовок не чіпаємо)
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "Ти професійний журналіст. Проаналізуй текст і напиши стислий опис (до 3 речень) у професійному стилі. Не повторюй заголовок новини."
        },
        {
          role: "user",
          content: `Проаналізуй цей текст і напиши стислий опис (до 3 речень) у професійному стилі, не повторюючи заголовок:\n\n${content}`
        }
      ],
      model: "llama-3.3-70b-versatile",
    });

    const aiDescription = completion.choices[0]?.message?.content || "Опис недоступний";

    // 4. Повідомлення: оригінальний заголовок + AI-опис + посилання (екрануємо HTML)
    const safeTitle = escapeHtml(String(title));
    const cleanedAi = String(aiDescription).trim();
    const safeDesc = escapeHtml(cleanedAi);
    const safeLink = link ? escapeHtml(String(link)) : '';
    const includeDesc = !isBadAiDescription(cleanedAi);
    const message = includeDesc
      ? `<b>${safeTitle}</b>\n\n${safeDesc}\n\n👉 <a href="${safeLink}">Читати повністю</a>`
      : `<b>${safeTitle}</b>\n\n👉 <a href="${safeLink}">Читати повністю</a>`;

    // 5. Відправка в Telegram
    const tgRes = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    const tgData = await tgRes.json();

    if (!tgRes.ok) {
      console.error("TG Error:", tgData);
      return NextResponse.json({ error: tgData.description || "TG Error" }, { status: tgRes.status });
    }

    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    console.error("Publish error:", error);
    const message = error instanceof Error ? error.message : "Internal Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
