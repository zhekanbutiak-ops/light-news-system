import { NextRequest, NextResponse } from "next/server";
import { getKV } from "@/lib/kv";

const DAY_PREFIX = "ln_day:";
const KEY_YESTERDAY = "ln_yesterday";
const KEY_TOTAL = "ln_total";

/** Повертає вчорашню дату в Києві (YYYY-MM-DD). */
function getYesterdayKyiv(): string {
  const d = new Date(Date.now() - 86400 * 1000);
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/Kyiv" });
}

/**
 * Cron о 00:05 Київ: підраховує унікальних відвідувачів за вчора, зберігає в ln_yesterday, додає до ln_total.
 * Розклад: 5 21 * * * (21:05 UTC = 00:05 Europe/Kyiv).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const kv = await getKV();
  if (!kv) {
    return NextResponse.json({ ok: false, error: "no_kv" }, { status: 503 });
  }

  try {
    const yesterday = getYesterdayKyiv();
    const prefix = `${DAY_PREFIX}${yesterday}:`;
    let count = 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- count-only iteration
    for await (const _ of kv.scanIterator({ match: `${prefix}*`, count: 500 })) {
      count++;
    }

    const totalRaw = await kv.get(KEY_TOTAL);
    let prevTotal = 0;
    if (typeof totalRaw === "number" && Number.isInteger(totalRaw)) prevTotal = totalRaw;
    else if (typeof totalRaw === "string") prevTotal = parseInt(totalRaw, 10) || 0;
    else if (Array.isArray(totalRaw) && totalRaw[0] != null) prevTotal = Number(totalRaw[0]) || 0;
    const newTotal = Math.max(0, prevTotal + count);

    // ln_yesterday — на 2 дні; ln_total — на 10 років (накопичувач за весь час, щоб не скидався при default TTL на платформі)
    const TEN_YEARS_SEC = 86400 * 365 * 10;
    await kv.set(KEY_YESTERDAY, String(count), { ex: 86400 * 2 });
    await kv.set(KEY_TOTAL, String(newTotal), { ex: TEN_YEARS_SEC });

    return NextResponse.json({
      ok: true,
      yesterday,
      yesterdayCount: count,
      total: newTotal,
    });
  } catch (e) {
    console.error("[online-midnight]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
