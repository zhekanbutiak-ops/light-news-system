import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

export type PostMeta = {
  slug: string;
  title: string;
  date: string; // ISO-like: YYYY-MM-DD
  summary: string;
  cover?: string;
  tags?: string[];
};

const POSTS_DIR = path.join(process.cwd(), "content", "posts");

async function fileExists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function normalizeSlugFromFilename(filename: string) {
  return filename.replace(/\.(md|mdx)$/i, "");
}

export async function getAllPostsMeta(): Promise<PostMeta[]> {
  if (!(await fileExists(POSTS_DIR))) return [];
  const files = await fs.readdir(POSTS_DIR);
  const mdFiles = files.filter((f) => /\.(md|mdx)$/i.test(f));

  const metas = await Promise.all(
    mdFiles.map(async (filename) => {
      const full = path.join(POSTS_DIR, filename);
      const raw = await fs.readFile(full, "utf8");
      const { data } = matter(raw);
      const slug = normalizeSlugFromFilename(filename);
      const title = String(data.title || slug);
      const date = String(data.date || "");
      const summary = String(data.summary || "");
      const cover = data.cover ? String(data.cover) : undefined;
      const tags = Array.isArray(data.tags) ? data.tags.map(String) : undefined;
      return { slug, title, date, summary, cover, tags } satisfies PostMeta;
    })
  );

  return metas
    .filter((m) => m.title && m.date && m.summary)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export async function getPostBySlug(slug: string): Promise<(PostMeta & { html: string }) | null> {
  const mdPath = path.join(POSTS_DIR, `${slug}.md`);
  const mdxPath = path.join(POSTS_DIR, `${slug}.mdx`);
  const file = (await fileExists(mdPath)) ? mdPath : (await fileExists(mdxPath)) ? mdxPath : null;
  if (!file) return null;

  const raw = await fs.readFile(file, "utf8");
  const { data, content } = matter(raw);
  const meta: PostMeta = {
    slug,
    title: String(data.title || slug),
    date: String(data.date || ""),
    summary: String(data.summary || ""),
    cover: data.cover ? String(data.cover) : undefined,
    tags: Array.isArray(data.tags) ? data.tags.map(String) : undefined,
  };

  const processed = await remark()
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeStringify)
    .process(content);

  return { ...meta, html: String(processed) };
}

