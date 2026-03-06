import { NextRequest, NextResponse } from 'next/server';
import Parser from 'rss-parser';

const parser = new Parser();

const KV_KEY_PREFIX = "ln_threat_last:";

import { getKV } from "@/lib/kv";

/** Прибирає з тексту назву каналу, підписи та посилання на канал — лишаємо тільки текст новини. */
function stripChannelSignature(raw: string): string {
  if (!raw?.trim()) return "";
  let t = raw
    .replace(/\n?\s*ПІДПИСАТИСЯ\s*\|\s*[^\n]+/gi, "")
    .replace(/\n?\s*Підписатися\s*\|\s*[^\n]+/gi, "")
    .replace(/\n?\s*SUBSCRIBE\s*\|\s*[^\n]+/gi, "")
    .replace(/\n?\s*Підписатись\s*\|\s*[^\n]+/gi, "")
    .replace(/\n?\s*ПЕРЕЙТИ К СООБЩЕНИЮ\s*/gi, "")
    .replace(/\n?\s*[Пп]ерейти к сообщению\s*/gi, "")
    .replace(/\s*ППО UA РАДАР\s*📡\s*/gi, " ")
    .replace(/\s*ППО UA\s*\|\s*РАДАР\s*📡\s*/gi, " ")
    .replace(/\s*ППО\s+РАДАР\s*📡?\s*/gi, " ")
    .replace(/\s*Telegram\s*/gi, " ");
  return t.replace(/\s+/g, " ").trim();
}

/** Нормалізує рядок для порівняння (пробіли, обрізати). */
function norm(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// Джерела про пуски, шахіди, тривоги — RSS з TG-каналів.
// Отримай RSS: ch2rss.fflow.net або tg-channel-to-rss.vercel.app (вкажи @channel).
// Публікується в наш канал тільки коли в цьому каналі з'являється новий пост (перевірка кожні 2 хв).
const THREAT_SOURCES = [
  { name: "⚠️ ППО UA РАДАР", url: "https://ch2rss.fflow.net/PpoUaRadar1" },
];

// Без KV: вузьке вікно, щоб не публікувати той самий пост кілька разів.
const NEW_POST_WINDOW_MS = 90 * 1000;
// Не публікувати пости старіші за N годин — щоб не виносити в заголовок/опис інфу з попереднього дня
const MAX_AGE_HOURS = 2;

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
  const now = Date.now();
  const maxAgeMs = MAX_AGE_HOURS * 60 * 60 * 1000;

  for (const source of THREAT_SOURCES) {
    try {
      const feed = await parser.parseURL(source.url);
      const items = Array.isArray(feed.items) ? feed.items : [];
      if (items.length === 0) {
        results.push({ source: source.name, reason: "no items" });
        continue;
      }

      // Завжди беремо пост з найновішим pubDate (не покладаємось на порядок в RSS)
      const sorted = [...items].sort((a, b) => {
        const ta = a.pubDate ? new Date(a.pubDate).getTime() : 0;
        const tb = b.pubDate ? new Date(b.pubDate).getTime() : 0;
        return tb - ta;
      });
      const latest = sorted[0];
      if (!latest?.link) {
        results.push({ source: source.name, reason: "no link" });
        continue;
      }

      const pubTime = latest.pubDate ? new Date(latest.pubDate).getTime() : 0;
      if (now - pubTime > maxAgeMs) {
        results.push({ source: source.name, reason: "latest post too old (skip previous day)" });
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
        if (now - pubTime > NEW_POST_WINDOW_MS) {
          results.push({ source: source.name, reason: "not new (without KV use 90s window)" });
          continue;
        }
      }

      // Тільки цей один пост: заголовок і опис лише з цього item (не змішуємо з попередніми днями)
      const title = stripChannelSignature(latest.title ?? "");
      const rawContent = latest.contentSnippet || latest.content || "";
      const cleaned = stripChannelSignature(rawContent);
      const trimmed = cleaned.slice(0, 400).trim();
      // Якщо опис той самий що й заголовок (або майже той самий) — не дублюємо текст у пості
      const titleN = norm(title);
      const bodyN = norm(trimmed);
      const sameOrAlmost = !bodyN || bodyN === titleN || (bodyN.startsWith(titleN) && bodyN.length - titleN.length < 25);
      const body = sameOrAlmost ? "" : (trimmed ? `\n\n${trimmed}${cleaned.length > 400 ? "…" : ""}` : "");
      const message = title ? `<b>${title}</b>${body}` : (trimmed || "—");

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
