import { NextRequest, NextResponse } from 'next/server';
import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import { getKV } from '@/lib/kv';
import { getClientIp, checkRateLimit } from '@/lib/rate-limit';
import { getNewsForPeriod } from '@/lib/db';

const NEWS_RATE_LIMIT = 300; // макс. запитів на IP за годину (новини + оновлення вкладок)
const FEED_TIMEOUT_MS = 12_000; // таймаут одного RSS-запиту (щоб один блокований сайт не тримав усіх)
const NEWS_CACHE_KEY = "ln_news_cache:";
const NEWS_CACHE_TTL_SEC = 3600; // 1 год кешу останнього успішного результату (якщо всі фіди впали — показуємо кеш)
export type NewsLabel = "Важливе" | "Інформативне" | "Корисне";

/** Класифікація за заголовком і текстом: сенс посту (мітки в кеші категорії, без окремих ключів на статтю). */
function classifyNewsLabel(title: string, snippet: string): NewsLabel {
  const t = `${title ?? ""} ${snippet ?? ""}`.toLowerCase();
  const important = [
    "обстріл", "зсу", "знищено", "фронт", "війна", "ракета", "дрон", "окупант", "перемог", "втрат", "бойов", "атака",
    "вторгнення", "санкці", "ядерн", "критичн", "надзвичайн", "евакуаці", "жертв", "загинул", "постраждал", "збито", "знищення",
  ];
  const informative = [
    "курс", "нбу", "гривн", "долар", "євро", "економік", "інфляці", "бюджет", "закон", "указ", "рішення", "уряд",
    "президент", "зустріч", "переговор", "договір", "даних", "статистик", "звіт", "оприлюднен", "індекс", "ринок",
  ];
  if (important.some((k) => t.includes(k))) return "Важливе";
  if (informative.some((k) => t.includes(k))) return "Інформативне";
  return "Корисне";
}

// content:encoded для АрміяInform та інших WordPress-фідів (зображення в HTML)
const parser = new Parser({
  customFields: {
    item: [['content:encoded', 'contentEncoded']],
  },
});

/** Спільний тип для новини з RSS або БД (оголошено рано для parseFeedWithTimeout). */
type NewsItemLike = { title?: string; link?: string; pubDate?: string; contentSnippet?: string; content?: string; [k: string]: unknown };

/** Завантажити RSS з таймаутом (якщо сайт блокує IP або не відповідає — не чекаємо вічно). */
async function parseFeedWithTimeout(url: string): Promise<{ items: NewsItemLike[] }> {
  const urlWithCacheBust = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
  try {
    const result = await Promise.race([
      parser.parseURL(urlWithCacheBust),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), FEED_TIMEOUT_MS)
      ),
    ]);
    return { items: (result?.items ?? []) as unknown as NewsItemLike[] };
  } catch (e) {
    console.error(`[news] feed failed ${url}:`, e instanceof Error ? e.message : e);
    return { items: [] };
  }
}

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

// Джерела: кілька URL на категорію (якщо один блокує IP або змінив адресу — беруться інші). + універсальний fallback нижче.
const RSS_CONFIG: Record<string, string[]> = {
  "Головне": [
    "https://tsn.ua/rss/full.rss",
    "https://rss.unian.net/site/news_ukr.rss",
    "https://www.rbc.ua/static/rss/all.ukr.rss.xml",
    "https://www.suspilne.media/rss/all.rss",
    "https://www.ukrinform.ua/rss/news",
    "https://www.pravda.com.ua/rss/view_mainnews/"
  ],
  "🛡️ Фронт": [
    "https://tsn.ua/rss/ato.rss",
    "https://rss.unian.net/site/news_ukr.rss",
    "https://armyinform.com.ua/feed/",
    "https://www.suspilne.media/rss/all.rss",
    "https://www.ukrinform.ua/rss/news",
    "https://censor.net/ua/feed"
  ],
  "🇺🇦 Україна": [
    "https://rss.unian.net/site/news_ukr.rss",
    "https://tsn.ua/rss/ukrayina.rss",
    "https://lb.ua/rss/ukr/feed.xml",
    "https://www.suspilne.media/rss/all.rss",
    "https://www.ukrinform.ua/rss/news"
  ],
  "🌍 Світ": [
    "https://rss.unian.net/site/news_ukr.rss",
    "https://tsn.ua/rss/svit.rss",
    "https://rss.dw.com/rss-ukr-all",
    "https://www.suspilne.media/rss/all.rss",
    "https://www.ukrinform.ua/rss/news"
  ],
  "💰 Економіка": [
    "https://rss.unian.net/site/news_ukr.rss",
    "https://tsn.ua/rss/groshi.rss",
    "https://epravda.com.ua/rss/news/",
    "https://www.rbc.ua/static/rss/all.ukr.rss.xml",
    "https://www.suspilne.media/rss/all.rss"
  ],
  "⚠️ Breaking": [
    "https://www.rbc.ua/static/rss/all.ukr.rss.xml",
    "https://www.pravda.com.ua/rss/view_mainnews/",
    "https://censor.net/ua/feed",
    "https://www.suspilne.media/rss/all.rss",
    "https://rss.unian.net/site/news_ukr.rss"
  ]
};

// Універсальний fallback: коли всі фіди категорії не відповідають або блокують — пробуємо ці (рідко блокують).
const RSS_FALLBACK_ANY = [
  "https://rss.dw.com/rss-ukr-all",
  "https://www.suspilne.media/rss/all.rss",
  "https://www.ukrinform.ua/rss/news",
  "https://www.pravda.com.ua/rss/view_mainnews/",
  "https://tsn.ua/rss/full.rss",
  "https://rss.unian.net/site/news_ukr.rss"
];

const ALLOWED_CATEGORIES = new Set(Object.keys(RSS_CONFIG));

/** Нормалізація посилання для дедуплікації: без utm_*, fbclid, trailing slash — щоб одна стаття не дублювалась. */
function normalizeLinkForDedup(link: string | undefined): string {
  if (!link || typeof link !== "string") return "";
  try {
    const u = new URL(link.trim());
    u.searchParams.forEach((_, key) => {
      if (/^utm_|fbclid|ref|source$/i.test(key)) u.searchParams.delete(key);
    });
    let path = u.pathname.replace(/\/+$/, "") || "/";
    return `${u.protocol}//${u.hostname.toLowerCase()}${path}${u.search}`;
  } catch {
    return link;
  }
}

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

function isFrontRelated(text: string): boolean {
  const t = text.toLowerCase();
  const allow = [
    "фронт", "зсу", "гш", "генштаб", "сирськ", "ссo", "ссо", "ппо", "ппр",
    "ракета", "дрон", "шахед", "калібр", "іскандер", "авіабомб", "каб", "артил",
    "обстріл", "вибух", "повітрян", "тривог", "пуск", "збито",
    "окуп", "окупант", "рф", "росі", "ворог", "наступ", "контрнаступ",
    "полон", "обмін", "евакуац", "поранен", "загинул", "втрат",
    "донецьк", "луганськ", "харків", "херсон", "запоріж", "сум", "черніг", "микола",
  ];
  const block = [
    "пральн", "машин", "кухн", "рецепт", "дієт", "гороскоп", "астрол",
    "зірк", "актор", "співач", "шоу", "скандал", "роман", "весіл", "вагіт",
    "мод", "краса", "манікюр", "психолог", "тест", "лайфхак", "порада",
  ];
  if (block.some((k) => t.includes(k))) return false;
  return allow.some((k) => t.includes(k));
}

function isUkraineRelated(text: string): boolean {
  const t = text.toLowerCase();
  const allow = [
    "україн", "київ", "львів", "одес", "дніпр", "харків", "херсон", "запоріж", "микола", "черніг", "сум", "полтав", "вінниц", "житомир", "черкас", "івано-франк", "терноп", "хмельниц", "луцьк", "рівн", "ужгород", "чернівц",
    "вр", "верховн", "кабмін", "уряд", "міністр", "мвс", "сбу", "дбр", "набу", "нп", "поліц", "прокурат", "суд",
    "ова", "кмва", "мер", "громад", "школ", "лікарн", "транспорт", "метро", "комунал", "тариф", "відключен",
    "нбу", "пенс", "виплат", "субсид",
  ];
  const block = [
    "пральн", "машин", "кухн", "рецепт", "дієт", "гороскоп", "астрол",
    "зірк", "актор", "співач", "шоу", "скандал", "роман", "весіл", "вагіт",
    "мод", "краса", "манікюр", "психолог", "тест", "лайфхак",
    "сша", "китай", "інді", "ізраїл", "іран", "туреч", "німеч", "франц", "британ", "італ", "іспан", "польщ", "угорщ", "румун", "словач", "чех", "нато", "оон", "єс", "євросоюз",
  ];
  if (block.some((k) => t.includes(k))) return false;
  return allow.some((k) => t.includes(k));
}

function isWorldRelated(text: string): boolean {
  const t = text.toLowerCase();
  const allow = [
    "світ", "міжнарод", "дипломат", "переговор", "візит", "саміт", "форум",
    "сша", "байден", "трамп", "держдеп", "конгрес",
    "єс", "євросоюз", "європ", "єврокоміс", "європарламент",
    "нато", "оон", "обсе", "g7", "g20",
    "санкц", "ембарго", "мито", "екстрад", "трибунал",
    "німеч", "франц", "британ", "італ", "іспан", "польщ", "угорщ", "румун", "словач", "чех", "балті",
    "китай", "інді", "япон", "південн коре", "північн коре",
    "ізраїл", "палест", "газ", "іран", "сауд", "туреч", "сирі",
  ];
  const block = [
    "пральн", "машин", "кухн", "рецепт", "дієт", "гороскоп", "астрол",
    "зірк", "актор", "співач", "шоу", "скандал", "роман", "весіл", "вагіт",
    "мод", "краса", "манікюр", "психолог", "тест", "лайфхак",
    "київ", "львів", "одес", "дніпр", "харків", "херсон", "запоріж", "микола", "черніг", "сум",
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
    // Кеш-first: віддаємо повну відповідь (з мітками) одним get — під 10k+ відвідувачів без додаткових витрат
    if (kv) {
      try {
        const cached = await kv.get(`${NEWS_CACHE_KEY}${category}`);
        const arr = Array.isArray(cached) ? cached : typeof cached === "string" ? (JSON.parse(cached) as unknown[]) : null;
        if (Array.isArray(arr) && arr.length > 0) {
          return NextResponse.json(
            { items: arr },
            { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60" } }
          );
        }
      } catch {
        // ignore
      }
    }

    const urls = RSS_CONFIG[category];

    // Запити з таймаутом (щоб один блокований сайт не тримав усіх)
    const feeds = await Promise.all(urls.map((url) => parseFeedWithTimeout(url)));
    let rssItems: NewsItemLike[] = feeds.flatMap((f) => f.items);

    // Якщо жоден фід категорії не дав результатів — пробуємо універсальний fallback (інші домени, рідше блокують)
    if (rssItems.length === 0 && RSS_FALLBACK_ANY.length > 0) {
      const fallbackFeeds = await Promise.all(RSS_FALLBACK_ANY.map((url) => parseFeedWithTimeout(url)));
      rssItems = fallbackFeeds.flatMap((f) => f.items);
    }

    // Збираємо всі новини в один масив (RSS + БД)
    const dbNews = await getNewsForPeriod(1, 50);
    const dbItems: NewsItemLike[] = dbNews.map((r) => ({
      title: r.title,
      link: r.link,
      pubDate: r.pub_date instanceof Date ? r.pub_date.toISOString() : String(r.pub_date),
      contentSnippet: r.content_snippet ?? undefined,
      content: r.content_snippet ?? undefined,
    }));
    const allItems: NewsItemLike[] = [...dbItems, ...rssItems];

    // Сортуємо за датою (найсвіжіші зверху)
    allItems.sort((a, b) => {
      const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return dateB - dateA;
    });

    // Видаляємо дублікати за нормалізованим посиланням (RSS + БД, різні utm — одна новина). Якщо link/title порожні — не зливаємо в один запис (уникальний ключ по індексу).
    const uniqueItems = Array.from(
      new Map(
        allItems.map((item, i) => {
          const key = normalizeLinkForDedup(item.link) || (item.title && item.title.trim()) || `_i${i}`;
          return [key, item];
        })
      ).values()
    );

    // Для окремих категорій — підчищаємо нерелевантні, але не робимо розділ порожнім
    const filteredItems =
      category === "💰 Економіка"
        ? (() => {
            const withText = uniqueItems.map((it) => ({
              it,
              text: `${it.title ?? ""}\n${it.contentSnippet ?? ""}\n${it.content ?? ""}`.slice(0, 2000),
            }));
            const onlyEconomy = withText.filter(({ text }) => isEconomyRelated(text)).map(({ it }) => it);
            return onlyEconomy.length >= 6 ? onlyEconomy : uniqueItems;
          })()
        : category === "🛡️ Фронт"
          ? (() => {
              const withText = uniqueItems.map((it) => ({
                it,
                text: `${it.title ?? ""}\n${it.contentSnippet ?? ""}\n${it.content ?? ""}`.slice(0, 2000),
              }));
              const onlyFront = withText.filter(({ text }) => isFrontRelated(text)).map(({ it }) => it);
              return onlyFront.length >= 6 ? onlyFront : uniqueItems;
            })()
          : category === "🇺🇦 Україна"
            ? (() => {
                const withText = uniqueItems.map((it) => ({
                  it,
                  text: `${it.title ?? ""}\n${it.contentSnippet ?? ""}\n${it.content ?? ""}`.slice(0, 2000),
                }));
                const onlyUA = withText.filter(({ text }) => isUkraineRelated(text)).map(({ it }) => it);
                return onlyUA.length >= 6 ? onlyUA : uniqueItems;
              })()
            : category === "🌍 Світ"
              ? (() => {
                  const withText = uniqueItems.map((it) => ({
                    it,
                    text: `${it.title ?? ""}\n${it.contentSnippet ?? ""}\n${it.content ?? ""}`.slice(0, 2000),
                  }));
                  const onlyWorld = withText.filter(({ text }) => isWorldRelated(text)).map(({ it }) => it);
                  return onlyWorld.length >= 6 ? onlyWorld : uniqueItems;
                })()
          : uniqueItems;

    // Додаємо URL зображення: enclosure / content:encoded (в т.ч. data-src для АрміяInform) або тематичний fallback
    let itemsWithImage = filteredItems.slice(0, 30).map((item) => {
      const imageUrl = getImageUrl(item as unknown as Parameters<typeof getImageUrl>[0], item.link) || getFallbackImageUrl(item.link);
      return { ...item, imageUrl };
    });

    // Якщо всі фіди + fallback не дали нічого — пробуємо старий кеш (fallback без міток)
    if (itemsWithImage.length === 0 && kv) {
      try {
        const cached = await kv.get(`${NEWS_CACHE_KEY}${category}`);
        const arr = Array.isArray(cached) ? cached : typeof cached === "string" ? JSON.parse(cached) as unknown[] : null;
        if (Array.isArray(arr) && arr.length > 0) {
          itemsWithImage = arr.slice(0, 30) as typeof itemsWithImage;
        }
      } catch {
        // ignore
      }
    }

    // Якщо ні фіди, ні кеш не дали нічого — один placeholder
    if (itemsWithImage.length === 0) {
      const fallbackImage = process.env.NEXT_PUBLIC_FALLBACK_NEWS_IMAGE || "https://placehold.co/800x450/1a1a2e/c4b5a0?text=Light+News";
      itemsWithImage = [
        {
          title: "Новини тимчасово недоступні",
          link: "https://t.me/lightnews13",
          pubDate: new Date().toISOString(),
          contentSnippet: "Джерела не відповідають або мережа перевантажена. Свіжі новини завжди в нашому Telegram — натисніть, щоб відкрити канал. Можете також оновити сторінку через кілька хвилин.",
          imageUrl: fallbackImage,
        },
      ];
    }

    // Мітки в пам'яті (без KV на кожну новину) — кеш зберігає вже повну відповідь
    const itemsWithLabel = itemsWithImage.map((item) => ({
      ...item,
      label: (item as { label?: NewsLabel }).label ?? classifyNewsLabel(item.title ?? "", item.contentSnippet ?? item.content ?? ""),
    }));

    if (kv && itemsWithLabel.length > 0) {
      try {
        await kv.set(`${NEWS_CACHE_KEY}${category}`, JSON.stringify(itemsWithLabel), { ex: NEWS_CACHE_TTL_SEC });
      } catch {
        // ignore
      }
    }

    return NextResponse.json(
      { items: itemsWithLabel },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60" } }
    );
  } catch (error) {
    console.error("[news] aggregation error:", error);
    return NextResponse.json({ error: "Помилка агрегації новин", items: [] }, { status: 500 });
  }
}
