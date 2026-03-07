import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

function getSql() {
  if (!connectionString) return null;
  return neon(connectionString);
}

export type NewsRow = {
  id: number;
  title: string;
  content_snippet: string | null;
  link: string;
  pub_date: Date;
  source_name: string;
  is_sent_to_tg: boolean;
  created_at: Date;
};

const TABLE = "news";

/** Створює таблицю news, якщо її ще немає. */
export async function initNewsTable(): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;
  const ddl = `
    CREATE TABLE IF NOT EXISTS news (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      content_snippet TEXT,
      link TEXT NOT NULL,
      pub_date TIMESTAMPTZ NOT NULL,
      source_name TEXT NOT NULL,
      is_sent_to_tg BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(link)
    )
  `;
  await sql.query(ddl, []);
  return true;
}

/** Додає новину в БД (ignore якщо link вже є). Повертає true якщо записано. */
export async function saveNews(params: {
  title: string;
  contentSnippet: string | null;
  link: string;
  pubDate: Date;
  sourceName: string;
}): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;
  try {
    await initNewsTable();
    await sql`
      INSERT INTO news (title, content_snippet, link, pub_date, source_name, is_sent_to_tg)
      VALUES (${params.title}, ${params.contentSnippet ?? null}, ${params.link}, ${params.pubDate.toISOString()}, ${params.sourceName}, false)
      ON CONFLICT (link) DO NOTHING
    `;
    return true;
  } catch (e) {
    console.error("[db] saveNews:", e);
    return false;
  }
}

/** Новини за останні N годин, ще не відправлені в TG (або всі за період). */
export async function getNewsForDigest(hoursAgo: number = 10, onlyUnsent: boolean = true): Promise<NewsRow[]> {
  const sql = getSql();
  if (!sql) return [];
  try {
    await initNewsTable();
    const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
    const rows = onlyUnsent
      ? await sql`
          SELECT id, title, content_snippet, link, pub_date, source_name, is_sent_to_tg, created_at
          FROM news
          WHERE created_at >= ${since} AND is_sent_to_tg = false
          ORDER BY pub_date DESC
          LIMIT 50
        `
      : await sql`
          SELECT id, title, content_snippet, link, pub_date, source_name, is_sent_to_tg, created_at
          FROM news
          WHERE created_at >= ${since}
          ORDER BY pub_date DESC
          LIMIT 50
        `;
    return rows as NewsRow[];
  } catch (e) {
    console.error("[db] getNewsForDigest:", e);
    return [];
  }
}

/** Новини за останні N днів (для тижневої аналітики). */
export async function getNewsForPeriod(daysAgo: number, limit: number = 150): Promise<NewsRow[]> {
  const sql = getSql();
  if (!sql) return [];
  try {
    await initNewsTable();
    const since = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
    const rows = await sql`
      SELECT id, title, content_snippet, link, pub_date, source_name, is_sent_to_tg, created_at
      FROM news
      WHERE created_at >= ${since}
      ORDER BY pub_date DESC
      LIMIT ${limit}
    `;
    return rows as NewsRow[];
  } catch (e) {
    console.error("[db] getNewsForPeriod:", e);
    return [];
  }
}

/** Позначити новини як відправлені в TG (за id або за link). */
export async function markNewsSentToTg(ids: number[]): Promise<void> {
  const sql = getSql();
  if (!sql || ids.length === 0) return;
  try {
    await sql`
      UPDATE news
      SET is_sent_to_tg = true
      WHERE id = ANY(${ids})
    `;
  } catch (e) {
    console.error("[db] markNewsSentToTg:", e);
  }
}
