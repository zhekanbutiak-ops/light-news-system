import { NextResponse } from 'next/server';
import Parser from 'rss-parser';

const parser = new Parser();

// Карта джерел: по 2-3 сайти на кожну категорію для максимального охоплення
const RSS_CONFIG: Record<string, string[]> = {
  "Головне": [
    "https://tsn.ua/rss/full.rss",
    "https://www.unian.ua/rss/common.rss",
    "https://rss.dw.com/rss-ukr-all"
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
    "https://p.dw.com/p/17Y9"
  ],
  "💰 Економіка": [
    "https://www.unian.ua/rss/economics.rss",
    "https://tsn.ua/rss/groshi.rss",
    "https://biz.nv.ua/ukr/rss/all.xml"
  ],
  "⚠️ Breaking": [
    "https://k.img.com.ua/rss/ua/all_news.rss",
    "https://informator.ua/uk/feed"
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

    return NextResponse.json({
      items: uniqueItems.slice(0, 30) // Повертаємо топ-30 унікальних свіжих новин
    });
  } catch (error) {
    return NextResponse.json({ error: "Помилка агрегації новин" }, { status: 500 });
  }
}
