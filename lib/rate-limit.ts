import { getKV } from "@/lib/kv";

const RATE_LIMIT_PREFIX = "ln_rl:";
const WINDOW_SEC = 3600; // 1 година

/** Витягує IP клієнта з запиту (Vercel: x-forwarded-for, x-real-ip) */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

type KV = Awaited<ReturnType<typeof getKV>>;

/**
 * Перевіряє rate limit по IP. Якщо ліміт перевищено — повертає false.
 * limit — макс. запитів за вікно (windowSec).
 */
export async function checkRateLimit(
  kv: KV,
  prefix: string,
  ip: string,
  limit: number,
  windowSec: number = WINDOW_SEC
): Promise<{ allowed: boolean }> {
  if (!kv || limit <= 0) return { allowed: true };
  const key = `${RATE_LIMIT_PREFIX}${prefix}:${ip.replace(/[^a-fA-F0-9.:]/g, "_")}`;
  const raw = await kv.get(key);
  const count = typeof raw === "number" ? raw : raw ? parseInt(String(raw), 10) || 0 : 0;
  if (count >= limit) return { allowed: false };
  await kv.set(key, count + 1, { ex: windowSec });
  return { allowed: true };
}
