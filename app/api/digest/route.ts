import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { getKV } from '@/lib/kv';
import { getClientIp, checkRateLimit } from '@/lib/rate-limit';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MAX_HEADLINES = 15;
const MAX_HEADLINE_LEN = 500;
const DIGEST_LIMIT = 30; // макс. запитів на IP за годину

const STOPWORDS = new Set([
  // uk
  'і', 'й', 'та', 'але', 'або', 'не', 'ні', 'це', 'ці', 'цей', 'ця', 'про', 'для', 'від', 'до', 'у', 'в', 'на', 'за', 'із', 'зі', 'що',
  'як', 'коли', 'де', 'хто', 'які', 'яка', 'який', 'яке', 'через', 'після', 'перед', 'між', 'під', 'над', 'без', 'вже', 'ще', 'знову',
  'сьогодні', 'вчора', 'завтра', 'тепер', 'тут', 'там',
  // ru
  'и', 'но', 'или', 'не', 'ни', 'это', 'эти', 'этот', 'эта', 'про', 'для', 'от', 'до', 'в', 'на', 'за', 'из', 'что', 'как', 'когда',
  'где', 'кто', 'через', 'после', 'перед', 'между', 'под', 'над', 'без', 'уже', 'еще', 'снова', 'сегодня', 'вчера', 'завтра',
  // en
  'the', 'a', 'an', 'and', 'or', 'but', 'not', 'no', 'to', 'of', 'in', 'on', 'for', 'from', 'with', 'as', 'by', 'at', 'is', 'are',
]);

const CANON: Record<string, string> = {
  'україна': 'Україна',
  'україни': 'України',
  'київ': 'Київ',
  'зсу': 'ЗСУ',
  'рф': 'РФ',
  'росія': 'Росія',
  'сша': 'США',
  'єс': 'ЄС',
  'нато': 'НАТО',
  'ооп': 'ООН',
};

function heuristicDigestFromHeadlines(headlines: string[]) {
  const fallback = 'Головне: актуальні події за сьогоднішніми заголовками.';
  if (!headlines?.length) return fallback;

  const counts = new Map<string, number>();
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  for (const h of headlines) {
    for (const raw of norm(h).split(' ')) {
      const w = raw.replace(/^-+|-+$/g, '');
      if (!w || w.length < 3) continue;
      if (STOPWORDS.has(w)) continue;
      if (/^\d+$/.test(w)) continue;
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }

  const top = [...counts.entries()]
    .sort((a, b) => (b[1] - a[1]) || (b[0].length - a[0].length) || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([w]) => CANON[w] ?? (w === w.toUpperCase() ? w : (w[0]?.toUpperCase() + w.slice(1))));

  if (top.length === 0) return fallback;
  return `Головне: у фокусі ${top.join(', ')} — за заголовками дня.`;
}

export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('content-type')?.toLowerCase().replace(/\s/g, '').replace(/;.*/, '') !== 'application/json') {
      return NextResponse.json({ digest: null, error: 'Content-Type має бути application/json' }, { status: 400 });
    }

    const body = await req.json();
    const rawHeadlines: unknown[] = Array.isArray(body?.headlines) ? body.headlines.slice(0, MAX_HEADLINES) : [];
    const headlines: string[] = rawHeadlines
      .filter((h): h is string => typeof h === 'string')
      .map(h => h.trim().slice(0, MAX_HEADLINE_LEN));

    const fallback = heuristicDigestFromHeadlines(headlines);
    if (headlines.length === 0) {
      return NextResponse.json({ digest: fallback, source: 'heuristic' });
    }

    const list = headlines.map((h, i) => `${i + 1}. ${h}`).join('\n');

    const kv = await getKV();
    const { allowed } = await checkRateLimit(kv, 'digest', getClientIp(req), DIGEST_LIMIT);
    if (!allowed) {
      return NextResponse.json({ digest: fallback, source: 'rate_limited' });
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ digest: fallback, source: 'no_groq_key' });
    }

    try {
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `Ти політичний аналітик. Пиши тільки конкретний висновок за фактами з заголовків — без загальних фраз.

ЗАБОРОНЕНО: "актуальні події", "за заголовками дня", "ключові події", "на сьогодні", "у фокусі уваги", "важливі новини" та подібні порожні формулювання.
ПОТРІБНО: конкретні назви (країни, організації, місця), цифри, причинно-наслідковий зв'язок, коротка оцінка що це означає.

Формат українською (2–4 речення):
1. Початок: "Головне:" — одне речення з конкретикою: про що саме йдеться (хто, де, що).
2. Далі — висновок: наслідки, тренд або контекст. Стиль як у коментаря експерта: тільки факт і думка, без води.`,
          },
          {
            role: 'user',
            content: `Заголовки:\n${list}\n\nВисновок (початок "Головне:", далі 1–3 речення). Тільки конкретика з цих заголовків, без загальних фраз.`,
          },
        ],
        model: 'llama-3.3-70b-versatile',
        max_tokens: 280,
      });

      const raw = completion.choices[0]?.message?.content?.trim();
      const digest = raw || fallback;
      return NextResponse.json({ digest, source: 'groq' });
    } catch (e) {
      console.error('[digest] Groq error:', e instanceof Error ? e.message : e);
      return NextResponse.json({ digest: fallback, source: 'groq_error' });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error';
    console.error('[digest]', message);
    return NextResponse.json({ digest: 'Головне: актуальні події за сьогоднішніми заголовками.' });
  }
}
