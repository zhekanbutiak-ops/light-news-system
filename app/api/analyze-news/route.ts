import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getKV } from '@/lib/kv';
import { getClientIp, checkRateLimit } from '@/lib/rate-limit';

const GEMINI_MODEL = 'gemini-1.5-flash';
const CACHE_PREFIX = 'ln_analyze:';
const CACHE_TTL_SEC = 86400; // 24 год
const RATE_LIMIT = 30; // запитів на IP за годину

function cacheKey(link: string): string {
  try {
    const u = new URL(link.trim());
    u.searchParams.forEach((_, key) => {
      if (/^utm_|fbclid|ref|source$/i.test(key)) u.searchParams.delete(key);
    });
    const path = u.pathname.replace(/\/+$/, '') || '/';
    return `${u.protocol}//${u.hostname.toLowerCase()}${path}`;
  } catch {
    return link || '';
  }
}

function parseGeminiResponse(text: string): { objectivityScore: number; clickbaitWarning: string; summary: string } | null {
  const numMatch = text.match(/ОБ'ЄКТИВНІСТЬ[:\s]*(\d{1,3})/i) || text.match(/об'єктивність[:\s]*(\d{1,3})/i) || text.match(/(\d{1,3})\s*%/);
  const objectivityScore = numMatch ? Math.min(100, Math.max(0, parseInt(numMatch[1], 10))) : 50;
  const clickMatch = text.match(/КЛІКБЕЙТ[:\s]*(так|ні|yes|no|низький|середній|високий)/i) || text.match(/клікбейт[:\s]*(так|ні)/i);
  const clickbaitWarning = clickMatch ? (clickMatch[1].toLowerCase().includes('так') || clickMatch[1].toLowerCase().includes('yes') || clickMatch[1].toLowerCase().includes('високий') ? 'Можливий клікбейт' : '') : '';
  const summaryMatch = text.match(/КОРОТКО[:\s]*(.+?)(?=\n|$)/is) || text.match(/коротко[:\s]*(.+?)(?=\n|$)/is);
  const summary = summaryMatch ? summaryMatch[1].trim().slice(0, 300) : text.slice(0, 200).trim();
  return { objectivityScore, clickbaitWarning, summary: summary || 'Аналіз недоступний.' };
}

const SYSTEM_PROMPT = `Ти — аналітик медіа. Проаналізуй заголовок і короткий текст новини українською.
Знайди ознаки: емоційний тиск, перебільшення, клікбейт, прихована реклама.
Відповідь СТРОГО у такому форматі (українською):
ОБ'ЄКТИВНІСТЬ: [число від 0 до 100]
КЛІКБЕЙТ: так або ні
КОРОТКО: один речення — чому цій новині можна або не можна повністю довіряти. Без зайвих слів.`;

export async function POST(request: NextRequest) {
  const kv = await getKV();
  const ip = getClientIp(request);
  const { allowed } = await checkRateLimit(kv, 'analyze', ip, RATE_LIMIT);
  if (!allowed) {
    return NextResponse.json({ error: 'Забагато запитів. Спробуйте пізніше.' }, { status: 429 });
  }

  let body: { title?: string; content?: string; link?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Невалідний JSON' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 500) : '';
  const content = typeof body.content === 'string' ? body.content.trim().slice(0, 1500) : '';
  const link = typeof body.link === 'string' ? body.link.trim() : '';

  if (!title) {
    return NextResponse.json({ error: 'Потрібен заголовок' }, { status: 400 });
  }

  const key = cacheKey(link || title);
  const cacheKeyFull = `${CACHE_PREFIX}${key.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 200)}`;

  if (kv) {
    try {
      const cached = await kv.get(cacheKeyFull);
      if (cached && typeof cached === 'string') {
        const parsed = JSON.parse(cached) as { objectivityScore: number; clickbaitWarning: string; summary: string };
        return NextResponse.json(parsed);
      }
    } catch {
      // ignore
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Сервіс аналізу не налаштований' }, { status: 503 });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const prompt = `Заголовок: ${title}\n\nТекст (фрагмент): ${content || '(немає)'}\n\n${SYSTEM_PROMPT}`;
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const analysis = parseGeminiResponse(text || '');
    if (!analysis) {
      return NextResponse.json({ error: 'Не вдалося розпарсити відповідь', objectivityScore: 50, clickbaitWarning: '', summary: 'Спробуйте пізніше.' }, { status: 200 });
    }

    if (kv) {
      try {
        await kv.set(cacheKeyFull, JSON.stringify(analysis), { ex: CACHE_TTL_SEC });
      } catch {
        // ignore
      }
    }

    return NextResponse.json(analysis);
  } catch (e) {
    console.error('[analyze-news] Gemini error:', e);
    return NextResponse.json({ error: 'Помилка аналізу', objectivityScore: 50, clickbaitWarning: '', summary: 'Сервіс тимчасово недоступний.' }, { status: 500 });
  }
}
