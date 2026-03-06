import { NextResponse } from 'next/server';
import Parser from 'rss-parser';
import * as cheerio from 'cheerio';

const parser = new Parser();

/** Витягує URL зображення: спочатку enclosure, потім перше <img> з HTML контенту */
function getImageUrl(item: { enclosure?: { url?: string }; content?: string; contentEncoded?: string; description?: string }, link?: string): string | null {
  const enc = item.enclosure?.url;
  if (enc && enc.startsWith('http')) return enc.startsWith('http://') ? enc.replace('http://', 'https://') : enc;
  const html = [item.contentEncoded, item.content, item.description].find(Boolean) as string | undefined;
  if (!html || typeof html !== 'string') return null;
  try {
    const $ = cheerio.load(html);
    const src = $('img').first().attr('src');
    if (!src) return null;
    if (src.startsWith('http')) return src.startsWith('http://') ? src.replace('http://', 'https://') : src;
    if (link) {
      try {
        const base = new URL(link);
        return new URL(src, base.origin).href;
      } catch {
        return null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Джерела з зображеннями в RSS (enclosure або <img> в контенті): TSN, UNIAN, РБК, Правда, LB.ua, АрміяInform
const RSS_CONFIG: Record<string, string[]> = {
  "Головне": [
    "https://tsn.ua/rss/full.rss",
    "https://www.unian.ua/rss/common.rss",
    "https://www.rbc.ua/static/rss/all.ukr.rss.xml"
  ],
  "🛡️ Фронт": [
    "https://tsn.ua/rss/ato.rss",
    "https://www.unian.ua/rss/war.rss",
    "https://armyinform.com.ua/feed/"
  ],
  "🇺🇦 Україна": [
    "https://www.unian.ua/rss/politics.rss",
    "https://tsn.ua/rss/ukrayina.rss",
    "https://lb.ua/rss/ukr/feed.xml"
  ],
  "🌍 Світ": [
    "https://www.unian.ua/rss/world.rss",
    "https://tsn.ua/rss/svit.rss",
    "https://rss.dw.com/rss-ukr-all"
  ],
  "💰 Економіка": [
    "https://www.unian.ua/rss/economics.rss",
    "https://tsn.ua/rss/groshi.rss",
    "https://www.rbc.ua/static/rss/all.ukr.rss.xml"
  ],
  "⚠️ Breaking": [
    "https://www.rbc.ua/static/rss/all.ukr.rss.xml",
    "https://www.pravda.com.ua/rss/view_mainnews/",
    "https://censor.net/ua/feed"
  ]
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || "Головне";

  try {
    const urls = RSS_CONFIG[category] || RSS_CONFIG["Головне"];

    // Запускаємо запити до всіх сайтів одночасно для швидкості
    const feedPromises = urls.map(url =>
      parser.parseURL(`${url}?t=${Date.now()}`).catch(e => {
        console.error(`Error fetching ${url}:`, e);
        return { items: [] };
      })
    );

    const feeds = await Promise.all(feedPromises);

    // Збираємо всі новини в один масив
    let allItems = feeds.flatMap(feed => feed.items);

    // Сортуємо за датою (найсвіжіші зверху)
    allItems.sort((a, b) => {
      const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return dateB - dateA;
    });

    // Видаляємо дублікати за заголовком (якщо різні сайти запостили одне й те саме)
    const uniqueItems = Array.from(new Map(allItems.map(item => [item.title, item])).values());

    // Додаємо URL зображення з enclosure або з контенту (без випадкових picsum)
    const itemsWithImage = uniqueItems.slice(0, 30).map((item: { link?: string; [k: string]: unknown }) => ({
      ...item,
      imageUrl: getImageUrl(item as Parameters<typeof getImageUrl>[0], item.link) || null,
    }));

    return NextResponse.json({ items: itemsWithImage });
  } catch (error) {
    return NextResponse.json({ error: "Помилка агрегації новин" }, { status: 500 });
  }
}
