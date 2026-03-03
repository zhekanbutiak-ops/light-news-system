import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { title, content, link, category } = await req.json();

    // 1. Перевірка наявності ключів
    if (!process.env.GROQ_API_KEY || !process.env.TELEGRAM_BOT_TOKEN) {
      return NextResponse.json({ error: "API Keys are missing on server" }, { status: 500 });
    }

    // 2. Перевірка вхідних даних
    if (!title || !content) {
      return NextResponse.json({ error: "Заголовок або текст відсутні" }, { status: 400 });
    }

    // 3. Генерація ШІ-аналізу
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "Ти професійний журналіст. Зроби короткий, гострий аналіз новини для Telegram. Використовуй емодзі. Максимум 3-4 речення."
        },
        {
          role: "user",
          content: `Проаналізуй новину: ${title}. Текст: ${content}`
        }
      ],
      model: "llama-3.3-70b-versatile",
    });

    const aiAnalysis = completion.choices[0]?.message?.content || "Аналіз недоступний";

    // 4. Формування повідомлення для TG
    const message = `<b>${title}</b>\n\n${aiAnalysis}\n\n<a href="${link}">Читати повністю</a>`;

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
