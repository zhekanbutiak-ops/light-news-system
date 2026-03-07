import { NextRequest, NextResponse } from 'next/server';
import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import { getKV } from '@/lib/kv';
import { getClientIp, checkRateLimit } from '@/lib/rate-limit';

const NEWS_RATE_LIMIT = 120; // макс. запитів на IP за годину (захист від DDoS/зловживань)

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
  // HTML контент (АрміяInform: content:encoded з <img>, часто data-src для lazy-load)
  const rawEncoded = item['content:encoded'] ?? item.contentEncoded;
  const html = [rawEncoded, item.content, item.description].find(Boolean) as string | undefined;
  if (!html || typeof html !== 'string') return null;
  try {
    const $ = cheerio.load(html);
    const firstImg = $('img').first();
    if (firstImg.length) {
      // Джерело: data-src (lazy), srcset (перший URL), потім src
      let src =
        firstImg.attr('data-src') ||
        (() => {
          const srcset = firstImg.attr('srcset');
          if (!srcset) return null;
          const first = srcset.split(',')[0]?.trim().split(/\s+/)[0];
          return first || null;
        })() ||
        firstImg.attr('src');
      if (src) {
        // Якщо img всередині <a href="...jpg/.png"> — беремо повний розмір з посилання (АрміяInform)
        const parentA = firstImg.closest('a');
        const aHref = parentA.length ? parentA.attr('href') : null;
        if (aHref && /\.(jpe?g|png|webp)(\?|$)/i.test(aHref)) {
          const fullA = aHref.startsWith('http') ? (aHref.startsWith('http://') ? aHref.replace('http://', 'https://') : aHref) : (link ? new URL(aHref, new URL(link).origin).href : null);
          if (fullA) return fullA;
        }
        if (src.startsWith('http')) return src.startsWith('http://') ? src.replace('http://', 'https://') : src;
        if (link) {
          try {
            const base = new URL(link);
            return new URL(src, base.origin).href;
          } catch {
            // fall through to regex search
          }
        }
      }
    }
    // АрміяInform: якщо з img нічого не вийшло — шукаємо в HTML будь-яке посилання на wp-content/uploads/ (напр. .../2026/03/81.jpg)
    const fullUrlMatch = html.match(/https?:\/\/[^"'\s]*armyinform\.com\.ua\/wp-content\/uploads\/[^"'\s]+\.(jpe?g|png|webp)(\?[^"'\s]*)?/i);
    if (fullUrlMatch) return fullUrlMatch[0].startsWith('http://') ? fullUrlMatch[0].replace('http://', 'https://') : fullUrlMatch[0];
    const attrMatch = html.match(/(?:src|href|data-src)=["']([^"']*\/wp-content\/uploads\/[^"']+\.(?:jpe?g|png|webp)(?:\?[^"']*)?)["']/i);
    if (attrMatch?.[1]) {
      let url = attrMatch[1];
      if (!url.startsWith('http')) url = link ? new URL(url, new URL(link).origin).href : `https://armyinform.com.ua${url.startsWith('/') ? url : '/' + url}`;
      return url.startsWith('http://') ? url.replace('http://', 'https://') : url;
    }
    return null;
  } catch {
    return null;
  }
}

/** Тематичні fallback-зображення: env або public/images/; якщо файлів немає — робочий placeholder, щоб не було сірого блоку */
function getFallbackImageUrl(itemLink?: string): string {
  const defaultNews = process.env.NEXT_PUBLIC_FALLBACK_NEWS_IMAGE || 'https://placehold.co/800x450/1a1a2e/c4b5a0?text=Light+News';
  const defaultFront = process.env.NEXT_PUBLIC_FALLBACK_FRONT_IMAGE || 'https://placehold.co/800x450/2d1b0e/c4b5a0?text=Фронт';
  if (!itemLink) return defaultNews;
  try {
    const host = new URL(itemLink).hostname.toLowerCase();
    if (host.includes('armyinform')) return defaultFront;
    if (host.includes('unian') || host.includes('tsn') || host.includes('pravda') || host.includes('rbc')) return defaultNews;
  } catch {
    // ignore
  }
  return defaultNews;
}

// Джерела з зображеннями в RSS (enclosure або <img> в контенті): TSN, UNIAN, РБК, Правда, LB.ua, АрміяInform
// УНІАН: старі www.unian.ua/rss/* повертають 404, використовуємо rss.unian.net (українська стрічка)
const RSS_CONFIG: Record<string, string[]> = {
  "Головне": [
    "https://tsn.ua/rss/full.rss",
    "https://rss.unian.net/site/news_ukr.rss",
    "https://www.rbc.ua/static/rss/all.ukr.rss.xml"
  ],
  "🛡️ Фронт": [
    "https://tsn.ua/rss/ato.rss",
    "https://rss.unian.net/site/news_ukr.rss",
    "https://armyinform.com.ua/feed/"
  ],
  "🇺🇦 Україна": [
    "https://rss.unian.net/site/news_ukr.rss",
    "https://tsn.ua/rss/ukrayina.rss",
    "https://lb.ua/rss/ukr/feed.xml"
  ],
  "🌍 Світ": [
    "https://rss.unian.net/site/news_ukr.rss",
    "https://tsn.ua/rss/svit.rss",
    "https://rss.dw.com/rss-ukr-all"
  ],
  "💰 Економіка": [
    "https://rss.unian.net/site/news_ukr.rss",
    "https://tsn.ua/rss/groshi.rss",
    "https://epravda.com.ua/rss/news/"
  ],
  "⚠️ Breaking": [
    "https://www.rbc.ua/static/rss/all.ukr.rss.xml",
    "https://www.pravda.com.ua/rss/view_mainnews/",
    "https://censor.net/ua/feed"
  ]
};

const ALLOWED_CATEGORIES = new Set(Object.keys(RSS_CONFIG));

function isEconomyRelated(text: string): boolean {
  const t = text.toLowerCase();
  const allow = [
    "економ", "бюджет", "подат", "інфляц", "курс", "валют", "грив", "долар", "євро",
    "нбу", "банк", "депозит", "кредит", "облігац", "бірж", "ринок",
    "нафт", "газ", "енерг", "тариф", "комунал",
    "зарплат", "пенс", "виплат", "субсид",
    "бізнес", "компан", "інвест", "експорт", "імпорт", "мит", "акциз",
    "нерухом", "аграр", "зерн",
  ];
  const block = [
    "зсу", "вмс", "ссо", "фронт", "війна", "обстріл", "ракета", "дрон", "ппо",
    "спорт", "футбол", "теніс", "олімпі", "матч", "гол", "тренер", "чемпіон",
  ];
  if (block.some((k) => t.includes(k))) return false;
  return allow.some((k) => t.includes(k));
}

export async function GET(request: NextRequest) {
  const kv = await getKV();
  const ip = getClientIp(request);
  const { allowed } = await checkRateLimit(kv, 'news', ip, NEWS_RATE_LIMIT);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Забагато запитів. Спробуйте пізніше.', items: [] },
      { status: 429, headers: { 'Retry-After': '3600' } }
    );
  }

  const { searchParams } = new URL(request.url);
  const rawCategory = searchParams.get('category') || "Головне";
  const category = ALLOWED_CATEGORIES.has(rawCategory) ? rawCategory : "Головне";

  try {
    const urls = RSS_CONFIG[category];

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

    // Для "Економіка" — підчищаємо нерелевантні (спорт/війна тощо), але не робимо розділ порожнім
    const filteredItems = category === "💰 Економіка"
      ? (() => {
          const withText = uniqueItems.map((it) => ({
            it,
            text: `${it.title ?? ""}\n${it.contentSnippet ?? ""}\n${it.content ?? ""}`.slice(0, 2000),
          }));
          const onlyEconomy = withText.filter(({ text }) => isEconomyRelated(text)).map(({ it }) => it);
          return onlyEconomy.length >= 6 ? onlyEconomy : uniqueItems;
        })()
      : uniqueItems;

    // Додаємо URL зображення: enclosure / content:encoded (в т.ч. data-src для АрміяInform) або тематичний fallback
    const itemsWithImage = filteredItems.slice(0, 30).map((item) => {
      const imageUrl = getImageUrl(item as unknown as Parameters<typeof getImageUrl>[0], item.link) || getFallbackImageUrl(item.link);
      return { ...item, imageUrl };
    });

    return NextResponse.json({ items: itemsWithImage });
  } catch (error) {
    return NextResponse.json({ error: "Помилка агрегації новин" }, { status: 500 });
  }
}
