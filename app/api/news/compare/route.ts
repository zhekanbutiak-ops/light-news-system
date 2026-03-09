import { NextRequest, NextResponse } from 'next/server';
import Parser from 'rss-parser';
import { getClientIp, checkRateLimit } from '@/lib/rate-limit';
import { getKV } from '@/lib/kv';

const FEED_TIMEOUT_MS = 10_000;
const RATE_LIMIT = 120; // окремий bucket від /api/news

const parser = new Parser();

/** Фіди для порівняння (головна тема): URL → коротка назва для користувача */
const COMPARE_FEEDS: { url: string; name: string }[] = [
  { url: 'https://tsn.ua/rss/full.rss', name: 'TSN' },
  { url: 'https://rss.unian.net/site/news_ukr.rss', name: 'УНІАН' },
  { url: 'https://www.rbc.ua/static/rss/all.ukr.rss.xml', name: 'РБК-Україна' },
  { url: 'https://www.suspilne.media/rss/all.rss', name: 'Суспільне' },
  { url: 'https://www.ukrinform.ua/rss/news', name: 'Укрінформ' },
];

type Item = { title?: string; link?: string };

async function fetchFeed(url: string): Promise<Item[]> {
  try {
    const result = await Promise.race([
      parser.parseURL(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), FEED_TIMEOUT_MS)),
    ]);
    return (result?.items ?? []).filter((i) => i.title?.trim() && i.link?.trim()) as Item[];
  } catch {
    return [];
  }
}

/** Слова-стоп (короткі/загальні), щоб не порівнювати по них */
const STOP = new Set(
  'і в у на з за для до по зо зі о об від про при без над під через під час та й або чи не як що то це вже є було буде'.split(/\s+/)
);

function significantWords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\d\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP.has(w));
}

/** Скільки слів з ref збігаються в title (норм на довжину ref) */
function overlapScore(refWords: string[], title: string): number {
  const words = significantWords(title);
  if (refWords.length === 0) return 0;
  const match = refWords.filter((w) => words.some((t) => t.includes(w) || w.includes(t))).length;
  return match / refWords.length;
}

export async function GET(request: NextRequest) {
  const kv = await getKV();
  const ip = getClientIp(request);
  const { allowed } = await checkRateLimit(kv, 'news_compare', ip, RATE_LIMIT);
  if (!allowed) {
    return NextResponse.json({ error: 'Забагато запитів', topic: null, items: [] }, { status: 429 });
  }

  try {
    const feedsWithItems = await Promise.all(
      COMPARE_FEEDS.map(async ({ url, name }) => ({
        name,
        items: await fetchFeed(url),
      }))
    );

    const first = feedsWithItems[0];
    const anchor = first?.items?.[0];
    if (!anchor?.title?.trim() || !anchor?.link?.trim()) {
      return NextResponse.json({ topic: null, items: [] });
    }

    const refWords = significantWords(anchor.title);
    const result: { source: string; title: string; link: string }[] = [
      { source: first.name, title: anchor.title.trim(), link: anchor.link!.trim() },
    ];

    for (let i = 1; i < feedsWithItems.length; i++) {
      const { name, items } = feedsWithItems[i];
      if (!items?.length) continue;
      let best = items[0];
      let bestScore = overlapScore(refWords, best.title ?? '');
      for (let j = 1; j < Math.min(items.length, 10); j++) {
        const score = overlapScore(refWords, items[j].title ?? '');
        if (score > bestScore) {
          bestScore = score;
          best = items[j];
        }
      }
      if (best?.title?.trim() && best?.link?.trim()) {
        result.push({ source: name, title: best.title.trim(), link: best.link!.trim() });
      }
    }

    return NextResponse.json({
      topic: anchor.title.trim(),
      items: result,
    });
  } catch (e) {
    console.error('[news/compare]', e);
    return NextResponse.json({ topic: null, items: [] }, { status: 500 });
  }
}
