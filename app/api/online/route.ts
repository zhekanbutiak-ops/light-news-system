import { NextRequest, NextResponse } from "next/server";

const ONLINE_PREFIX = "ln_online:";
const TTL_SEC = 120; // вважаємо "онлайн" якщо був пульс за останні 2 хв

async function getKV() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  try {
    const { kv } = await import("@vercel/kv");
    return kv;
  } catch {
    return null;
  }
}

/** Пульс: клієнт каже "я тут". POST { id: string } */
export async function POST(req: NextRequest) {
  const kv = await getKV();
  try {
    const body = await req.json();
    const id = typeof body?.id === "string" ? body.id.slice(0, 64) : null;
    if (!id) return NextResponse.json({ ok: false }, { status: 400 });
    if (kv) {
      await kv.set(`${ONLINE_PREFIX}${id}`, Date.now(), { ex: TTL_SEC });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}

/** Скільки зараз онлайн. GET => { online: number | null } */
export async function GET() {
  const kv = await getKV();
  if (!kv) return NextResponse.json({ online: null });
  try {
    let count = 0;
    for await (const _ of kv.scanIterator({ match: `${ONLINE_PREFIX}*`, count: 100 })) {
      count++;
    }
    return NextResponse.json({ online: count });
  } catch {
    return NextResponse.json({ online: null });
  }
}
