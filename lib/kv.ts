/**
 * Єдиний доступ до KV: підтримка REDIS_URL (redis://) або KV_REST_API_* (Vercel KV / Upstash).
 * Якщо задано REDIS_URL — використовується пакет redis (TCP); інакше @vercel/kv (REST).
 */

export type KV = {
  get(key: string): Promise<string | number | string[] | null>;
  set(key: string, value: string | number | string[], options?: { ex?: number }): Promise<void>;
  scanIterator(options: { match: string; count?: number }): AsyncIterable<string>;
};

declare global {
  // eslint-disable-next-line no-var
  var __redisClient: Awaited<ReturnType<typeof createRedisClient>> | undefined;
}

async function createRedisClient() {
  const { createClient } = await import("redis");
  const url = process.env.REDIS_URL;
  if (!url) return null;
  const client = createClient({ url });
  client.on("error", () => {});
  await client.connect();
  return client;
}

function getRedisClient(): Promise<ReturnType<typeof createRedisClient> extends Promise<infer T> ? T : never> {
  if (globalThis.__redisClient) return Promise.resolve(globalThis.__redisClient);
  return createRedisClient().then((c) => {
    if (c) globalThis.__redisClient = c;
    return c;
  });
}

function redisAdapter(client: Awaited<ReturnType<typeof createRedisClient>>): KV {
  return {
    async get(key: string) {
      const raw = await client!.get(key);
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as string | number | string[];
      } catch {
        return raw;
      }
    },
    async set(key: string, value: string | number | string[], options?: { ex?: number }) {
      const str = typeof value === "string" ? value : JSON.stringify(value);
      if (options?.ex) await client!.setEx(key, options.ex, str);
      else await client!.set(key, str);
    },
    async *scanIterator(options: { match: string; count?: number }) {
      const opts = { MATCH: options.match, COUNT: options.count ?? 100 } as const;
      for await (const key of client!.scanIterator(opts)) {
        yield key;
      }
    },
  };
}

/**
 * Повертає KV-клієнт: або @vercel/kv (якщо є KV_REST_API_*), або адаптер для REDIS_URL.
 */
export async function getKV(): Promise<KV | null> {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const { kv } = await import("@vercel/kv");
      return kv as unknown as KV;
    } catch {
      // fallback to REDIS_URL below
    }
  }

  if (process.env.REDIS_URL) {
    try {
      const client = await getRedisClient();
      if (client) return redisAdapter(client);
    } catch {
      // ignore
    }
  }

  return null;
}
