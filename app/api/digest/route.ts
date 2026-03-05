import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const headlines: string[] = Array.isArray(body?.headlines) ? body.headlines.slice(0, 15) : [];
    if (headlines.length === 0) {
      return NextResponse.json({ digest: null, error: 'No headlines' }, { status: 400 });
    }

    const list = headlines.map((h, i) => `${i + 1}. ${h}`).join('\n');
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content:
            'Ти редактор новин. Напиши одне стисле речення українською, яке об\'єднує суть цих подій. Почни обов\'язково зі слова "Головне:" без лапок. Без зайвих слів, тільки суть.',
        },
        {
          role: 'user',
          content: `Заголовки новин:\n${list}\n\nНапиши одне речення (початок "Головне:").`,
        },
      ],
      model: 'llama-3.3-70b-versatile',
      max_tokens: 150,
    });

    const digest = completion.choices[0]?.message?.content?.trim() || null;
    return NextResponse.json({ digest });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error';
    return NextResponse.json({ digest: null, error: message }, { status: 500 });
  }
}
