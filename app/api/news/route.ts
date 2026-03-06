import { NextResponse } from 'next/server';
import Parser from 'rss-parser';
import * as cheerio from 'cheerio';

// content:encoded для АрміяInform та інших WordPress-фідів (зображення в HTML)
const parser = new Parser({
  customFields: {
    item: [['content:encoded', 'contentEncoded']],
  },
});

/** Витягує URL зображення: enclosure → media:* → перше <img> з HTML (для АрміяInform тощо); повний розмір з <a href> якщо є */
function getImageUrl(item: { enclosure?: { url?: string }; content?: string; contentEncoded?: string; description?: string; [k: string]: unknown }, link?: string): string | null {
  const enc = item.enclosure?.url;
  if (enc && enc.startsWith('http')) return enc.startsWith('http://') ? enc.replace('http://', 'https://') : enc;
  // media:content / media:thumbnail (деякі фіди, напр. WordPress з плагінами)
  const mediaContent = item['media:content'] ?? item.mediaContent;
  const mediaThumb = item['media:thumbnail'] ?? item.mediaThumbnail;
  const mediaUrl = typeof mediaContent === 'object' && mediaContent !== null && 'url' in mediaContent
    ? (mediaContent as { url?: string }).url
    : typeof mediaContent === 'string'
      ? mediaContent
      : null;
  if (mediaUrl && mediaUrl.startsWith('http')) return mediaUrl.startsWith('http://') ? mediaUrl.replace('http://', 'https://') : mediaUrl;
  const thumbUrl = typeof mediaThumb === 'object' && mediaThumb !== null && 'url' in mediaThumb
    ? (mediaThumb as { url?: string }).url
    : typeof mediaThumb === 'string'
      ? mediaThumb
      : null;
  if (thumbUrl && thumbUrl.startsWith('http')) return thumbUrl.startsWith('http://') ? thumbUrl.replace('http://', 'https://') : thumbUrl;
  // HTML контент (АрміяInform: content:encoded з <img> та <a href="...jpg">)
  const rawEncoded = item['content:encoded'] ?? item.contentEncoded;
  const html = [rawEncoded, item.content, item.description].find(Boolean) as string | undefined;
  if (!html || typeof html !== 'string') return null;
  try {
    const $ = cheerio.load(html);
    const firstImg = $('img').first();
    if (!firstImg.length) return null;
    // Якщо img всередині <a href="...jpg/.png"> — беремо повний розмір з посилання (АрміяInform)
    const parentA = firstImg.closest('a');
    const aHref = parentA.length ? parentA.attr('href') : null;
    if (aHref && /\.(jpe?g|png|webp)(\?|$)/i.test(aHref))
      return aHref.startsWith('http') ? (aHref.startsWith('http://') ? aHref.replace('http://', 'https://') : aHref) : (link ? new URL(aHref, new URL(link).origin).href : null);
    const src = firstImg.attr('src');
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
    const itemsWithImage = uniqueItems.slice(0, 30).map((item) => ({
      ...item,
      imageUrl: getImageUrl(item as unknown as Parameters<typeof getImageUrl>[0], item.link) || null,
    }));

    return NextResponse.json({ items: itemsWithImage });
  } catch (error) {
    return NextResponse.json({ error: "Помилка агрегації новин" }, { status: 500 });
  }
}
