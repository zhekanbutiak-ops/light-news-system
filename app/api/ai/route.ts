import { NextResponse } from 'next/server';
import { getKV } from '@/lib/kv';
import { getClientIp, checkRateLimit } from '@/lib/rate-limit';

const MAX_PROMPT_LEN = 2000;
const AI_LIMIT = 30; // макс. запитів на IP за годину

export async function POST(request: Request) {
  try {
    if (request.headers.get('content-type')?.toLowerCase().replace(/\s/g, '').replace(/;.*/, '') !== 'application/json') {
      return NextResponse.json({ text: 'Content-Type має бути application/json' }, { status: 400 });
    }

    const body = await request.json();
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim().slice(0, MAX_PROMPT_LEN) : '';
    if (!prompt) {
      return NextResponse.json({ text: 'Потрібно передати prompt' }, { status: 400 });
    }

    const kv = await getKV();
    const { allowed } = await checkRateLimit(kv, 'ai', getClientIp(request), AI_LIMIT);
    if (!allowed) {
      return NextResponse.json({ text: 'Забагато запитів. Спробуйте пізніше.' }, { status: 429 });
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
    if (!GROQ_API_KEY) {
      return NextResponse.json(
        { text: "LIGHT AI: не налаштовано ключ Groq (GROQ_API_KEY)." },
        { status: 500 }
      );
    }

    const context = body?.context;
    const warDay = context?.warDay ?? "—";
    const usd = context?.markets?.usd ?? "—";

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          {
            role: "system",
            content: `Ти — інтелектуальна система LIGHT AI. 
Твоє завдання: відповідати коротко, професійно та з легкою іронією. 
Ти знаєш, що сьогодні ${warDay} день війни. 
Курс долара: ${usd}₴. 
Ти аналізуєш новини в реальному часі.`
          },
          {
            role: "user",
            content: prompt.slice(0, MAX_PROMPT_LEN)
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    const data = await response.json();
    const aiText = data.choices?.[0]?.message?.content?.trim() || "Система тимчасово перевантажена. Спробуйте пізніше.";

    return NextResponse.json({ text: aiText });
  } catch (error) {
    console.error("AI Error:", error);
    return NextResponse.json({ text: "Помилка зв'язку з ядром LIGHT AI." }, { status: 500 });
  }
}
