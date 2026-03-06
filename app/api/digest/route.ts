import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { getKV } from '@/lib/kv';
import { getClientIp, checkRateLimit } from '@/lib/rate-limit';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MAX_HEADLINES = 15;
const MAX_HEADLINE_LEN = 500;
const DIGEST_LIMIT = 30; // макс. запитів на IP за годину

export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('content-type')?.toLowerCase().replace(/\s/g, '').replace(/;.*/, '') !== 'application/json') {
      return NextResponse.json({ digest: null, error: 'Content-Type має бути application/json' }, { status: 400 });
    }

    const kv = await getKV();
    const { allowed } = await checkRateLimit(kv, 'digest', getClientIp(req), DIGEST_LIMIT);
    if (!allowed) {
      return NextResponse.json({ digest: 'Головне: актуальні події за сьогоднішніми заголовками.' });
    }

    const body = await req.json();
    const rawHeadlines: unknown[] = Array.isArray(body?.headlines) ? body.headlines.slice(0, MAX_HEADLINES) : [];
    const headlines: string[] = rawHeadlines
      .filter((h): h is string => typeof h === 'string')
      .map(h => h.trim().slice(0, MAX_HEADLINE_LEN));
    if (headlines.length === 0) {
      return NextResponse.json({ digest: null, error: 'No headlines' }, { status: 400 });
    }

    const list = headlines.map((h, i) => `${i + 1}. ${h}`).join('\n');
    const fallback = 'Головне: актуальні події за сьогоднішніми заголовками.';

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ digest: fallback });
    }

    try {
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

      const digest = completion.choices[0]?.message?.content?.trim() || fallback;
      return NextResponse.json({ digest });
    } catch (e) {
      console.error('[digest] Groq error:', e instanceof Error ? e.message : e);
      return NextResponse.json({ digest: fallback });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error';
    console.error('[digest]', message);
    return NextResponse.json({ digest: 'Головне: актуальні події за сьогоднішніми заголовками.' });
  }
}
