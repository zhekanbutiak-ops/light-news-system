import { NextRequest, NextResponse } from 'next/server';
import Parser from 'rss-parser';

const parser = new Parser();

const KV_KEY_PREFIX = "ln_threat_last:";

import { getKV } from "@/lib/kv";

/** Прибирає з тексту підпис каналу типу «ПІДПИСАТИСЯ | ППО UA РАДАР» (RSS тягне це з TG). */
function stripChannelSignature(raw: string): string {
  if (!raw?.trim()) return "";
  let t = raw
    // Рядки/фрази "ПІДПИСАТИСЯ | ..." та "ППО UA РАДАР 📡" (в title теж буває)
    .replace(/\n?\s*ПІДПИСАТИСЯ\s*\|\s*[^\n]+/gi, "")
    .replace(/\n?\s*Підписатися\s*\|\s*[^\n]+/gi, "")
    .replace(/\n?\s*SUBSCRIBE\s*\|\s*[^\n]+/gi, "")
    .replace(/\n?\s*Підписатись\s*\|\s*[^\n]+/gi, "")
    .replace(/\s*ППО UA РАДАР\s*📡\s*/gi, " ");
  return t.replace(/\s+/g, " ").trim();
}

// Джерела про пуски, шахіди, тривоги — RSS з TG-каналів.
// Отримай RSS: ch2rss.fflow.net або tg-channel-to-rss.vercel.app (вкажи @channel).
// Публікується в наш канал тільки коли в цьому каналі з'являється новий пост (перевірка кожні 2 хв).
const THREAT_SOURCES = [
  { name: "⚠️ ППО UA РАДАР", url: "https://ch2rss.fflow.net/PpoUaRadar1" },
];

// Без KV: дуже вузьке вікно (90 с), щоб не публікувати той самий пост кілька разів. Краще налаштувати KV.
const NEW_POST_WINDOW_MS = 90 * 1000;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (THREAT_SOURCES.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no threat sources" });
  }

  const results: { source: string; posted?: boolean; reason?: string }[] = [];

  const kv = await getKV();

  for (const source of THREAT_SOURCES) {
    try {
      const feed = await parser.parseURL(source.url);
      const latest = feed.items[0];
      if (!latest?.link) {
        results.push({ source: source.name, reason: "no items" });
        continue;
      }

      const key = `${KV_KEY_PREFIX}${encodeURIComponent(source.url)}`;
      if (kv) {
        const lastLink = (await kv.get(key)) as string | null;
        if (lastLink === latest.link) {
          results.push({ source: source.name, reason: "already posted" });
          continue;
        }
      } else {
        const pubDate = latest.pubDate ? new Date(latest.pubDate).getTime() : 0;
        const now = Date.now();
        if (now - pubDate > NEW_POST_WINDOW_MS) {
          results.push({ source: source.name, reason: "not new (without KV use 90s window; add KV_REST_* to avoid duplicates)" });
          continue;
        }
      }

      const title = stripChannelSignature(latest.title ?? "");
      const rawContent = latest.contentSnippet || latest.content || "";
      const cleaned = stripChannelSignature(rawContent);
      const trimmed = cleaned.slice(0, 400).trim();
      const body = trimmed ? `\n\n${trimmed}${cleaned.length > 400 ? "…" : ""}` : "";
      const message = `<b>${source.name}</b>\n\n<b>${title}</b>${body}\n\n👉 <a href="${latest.link}">Деталі</a>`;

      const tgRes = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: "HTML",
        }),
      });

      const tgData = (await tgRes.json().catch(() => ({}))) as { ok?: boolean; description?: string };
      if (!tgRes.ok) {
        results.push({ source: source.name, reason: tgData.description ?? "Telegram error" });
        continue;
      }

      if (kv) await kv.set(key, latest.link);
      results.push({ source: source.name, posted: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      results.push({ source: source.name, reason: msg });
    }
  }

  return NextResponse.json({ ok: true, results });
}
