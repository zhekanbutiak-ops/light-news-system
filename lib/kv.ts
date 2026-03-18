/**
 * Єдиний доступ до KV: підтримка REDIS_URL (redis://) або KV_REST_API_* (Upstash Redis REST).
 * Якщо задано REDIS_URL — використовується пакет redis (TCP); інакше @upstash/redis (REST).
 */

export type KV = {
  get(key: string): Promise<string | number | string[] | null>;
  set(key: string, value: string | number | string[], options?: { ex?: number }): Promise<void>;
  scanIterator(options: { match: string; count?: number }): AsyncIterable<string>;
};

declare global {
  // eslint-disable-next-line no-var
  var __redisClient: Awaited<ReturnType<typeof createRedisClient>> | undefined;
  // eslint-disable-next-line no-var
  var __upstashClient: ReturnType<typeof createUpstashClient> | undefined;
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

function createUpstashClient() {
  if (!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Redis } = require("@upstash/redis") as typeof import("@upstash/redis");
    return new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  } catch {
    return null;
  }
}

function getRedisClient(): Promise<ReturnType<typeof createRedisClient> extends Promise<infer T> ? T : never> {
  if (globalThis.__redisClient) return Promise.resolve(globalThis.__redisClient);
  return createRedisClient().then((c) => {
    if (c) globalThis.__redisClient = c;
    return c;
  });
}

function getUpstashClient(): ReturnType<typeof createUpstashClient> {
  if (globalThis.__upstashClient) return globalThis.__upstashClient;
  const c = createUpstashClient();
  if (c) globalThis.__upstashClient = c;
  return c;
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
    async *scanIterator(options: { match: string; count?: number }): AsyncIterable<string> {
      const opts = { MATCH: options.match, COUNT: options.count ?? 100 } as const;
      for await (const batch of client!.scanIterator(opts)) {
        const keys = Array.isArray(batch) ? batch : [batch];
        for (const key of keys) yield key;
      }
    },
  };
}

/**
 * Повертає KV-клієнт: або Upstash Redis REST (KV_REST_API_*), або адаптер для REDIS_URL.
 */
export async function getKV(): Promise<KV | null> {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const upstash = getUpstashClient();
    if (upstash) {
      return {
        async get(key: string) {
          const v = await upstash.get(key);
          if (v === null || typeof v === "undefined") return null;
          return v as string | number | string[];
        },
        async set(key: string, value: string | number | string[], options?: { ex?: number }) {
          const v = typeof value === "string" ? value : JSON.stringify(value);
          if (options?.ex) await upstash.set(key, v, { ex: options.ex });
          else await upstash.set(key, v);
        },
        async *scanIterator(options: { match: string; count?: number }): AsyncIterable<string> {
          let cursor = 0;
          do {
            const res = await upstash.scan(cursor, {
              match: options.match,
              count: options.count ?? 100,
            });
            cursor = typeof res[0] === "string" ? Number(res[0]) : (res[0] as number);
            const keys = (res[1] ?? []) as string[];
            for (const k of keys) yield k;
          } while (cursor !== 0);
        },
      };
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
