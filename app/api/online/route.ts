import { NextRequest, NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getClientIp, checkRateLimit } from "@/lib/rate-limit";

const ONLINE_PREFIX = "ln_online:";
const DAY_PREFIX = "ln_day:";
const KEY_YESTERDAY = "ln_yesterday";
const KEY_TOTAL = "ln_total";
const TTL_SEC = 120; // вважаємо "онлайн" якщо був пульс за останні 2 хв
const DAY_TTL_SEC = 86400 * 2; // ключі за день зберігаємо 2 дні (для підрахунку вчора)
const ONLINE_POST_LIMIT = 60;

function getDateKyiv(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Kyiv" }); // YYYY-MM-DD
}

/** Пульс: клієнт каже "я тут". POST { id: string } */
export async function POST(req: NextRequest) {
  const kv = await getKV();
  const { allowed } = await checkRateLimit(kv, "online", getClientIp(req), ONLINE_POST_LIMIT);
  if (!allowed) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  try {
    const body = await req.json();
    const id = typeof body?.id === "string" ? body.id.slice(0, 64) : null;
    if (!id) return NextResponse.json({ ok: false }, { status: 400 });
    if (kv) {
      await kv.set(`${ONLINE_PREFIX}${id}`, Date.now(), { ex: TTL_SEC });
      const today = getDateKyiv();
      await kv.set(`${DAY_PREFIX}${today}:${id}`, "1", { ex: DAY_TTL_SEC });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}

async function countKeysByPrefix(kv: NonNullable<Awaited<ReturnType<typeof getKV>>>, prefix: string): Promise<number> {
  let n = 0;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- count-only iteration
  for await (const _ of kv.scanIterator({ match: `${prefix}*`, count: 200 })) {
    n++;
  }
  return n;
}

/** Скільки зараз онлайн, сьогодні, вчора, всього. GET => { online, today, yesterday, total } */
export async function GET() {
  const kv = await getKV();
  if (!kv) {
    return NextResponse.json({ online: null, today: null, yesterday: null, total: null });
  }
  try {
    const today = getDateKyiv();
    const [online, todayCount, yesterdayRaw, totalRaw] = await Promise.all([
      countKeysByPrefix(kv, ONLINE_PREFIX),
      countKeysByPrefix(kv, `${DAY_PREFIX}${today}:`),
      kv.get(KEY_YESTERDAY),
      kv.get(KEY_TOTAL),
    ]);
    const yesterday = typeof yesterdayRaw === "number" ? yesterdayRaw : typeof yesterdayRaw === "string" ? parseInt(yesterdayRaw, 10) || 0 : 0;
    const total = typeof totalRaw === "number" ? totalRaw : typeof totalRaw === "string" ? parseInt(totalRaw, 10) || 0 : 0;
    return NextResponse.json({
      online,
      today: todayCount,
      yesterday,
      total: total + todayCount,
    });
  } catch {
    return NextResponse.json({ online: null, today: null, yesterday: null, total: null });
  }
}
