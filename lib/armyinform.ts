import Parser from "rss-parser";
import { getKV } from "@/lib/kv";

export type ExternalPostItem = {
  title: string;
  link: string;
  pubDate?: string;
};

const FEED_URL = "https://armyinform.com.ua/feed/";
const CACHE_KEY = "ln_posts:armyinform:v1";
const CACHE_TTL_SEC = 1800; // 30 хв
const FEED_TIMEOUT_MS = 8000;

const parser = new Parser();

function normalizeLink(link: string) {
  try {
    const u = new URL(link);
    u.searchParams.forEach((_, key) => {
      if (/^utm_|fbclid|ref|source$/i.test(key)) u.searchParams.delete(key);
    });
    return u.toString();
  } catch {
    return link;
  }
}

async function parseFeedWithTimeout(url: string) {
  const urlWithCacheBust = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
  return await Promise.race([
    parser.parseURL(urlWithCacheBust),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), FEED_TIMEOUT_MS)),
  ]);
}

export async function getArmyInformItems(limit = 30): Promise<ExternalPostItem[]> {
  const kv = await getKV();
  if (kv) {
    try {
      const cached = await kv.get(CACHE_KEY);
      const arr =
        Array.isArray(cached)
          ? cached
          : typeof cached === "string"
            ? (JSON.parse(cached) as unknown[])
            : null;
      if (Array.isArray(arr) && arr.length > 0) return arr.slice(0, limit) as ExternalPostItem[];
    } catch {
      // ignore
    }
  }

  try {
    const feed = await parseFeedWithTimeout(FEED_URL);
    const items = (feed?.items ?? [])
      .map((it: any) => ({
        title: String(it?.title ?? "").trim(),
        link: normalizeLink(String(it?.link ?? "").trim()),
        pubDate: it?.pubDate ? String(it.pubDate) : undefined,
      }))
      .filter((x) => x.title && x.link)
      .slice(0, limit);

    if (kv && items.length > 0) {
      try {
        await kv.set(CACHE_KEY, JSON.stringify(items), { ex: CACHE_TTL_SEC });
      } catch {
        // ignore
      }
    }

    return items;
  } catch {
    return [];
  }
}

