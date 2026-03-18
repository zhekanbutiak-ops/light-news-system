import type { MetadataRoute } from "next";
import { getAllPostsMeta } from "@/lib/posts";

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://light-news.com.ua");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const posts = await getAllPostsMeta();
  const postItems: MetadataRoute.Sitemap = posts.slice(0, 50).map((p) => ({
    url: `${baseUrl}/posts/${p.slug}`,
    lastModified: p.date ? new Date(`${p.date}T12:00:00Z`) : now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));
  return [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1,
    },
    { url: `${baseUrl}/front`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${baseUrl}/ukraine`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${baseUrl}/world`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${baseUrl}/economy`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${baseUrl}/breaking`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${baseUrl}/posts`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    ...postItems,
  ];
}
