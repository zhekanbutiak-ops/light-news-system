import Link from "next/link";
import type { Metadata } from "next";
import { getAllPostsMeta, getPostBySlug } from "@/lib/posts";

export async function generateStaticParams() {
  const posts = await getAllPostsMeta();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(
  props: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await props.params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "Пост не знайдено", robots: { index: false, follow: false } };

  return {
    title: post.title,
    description: post.summary,
    alternates: { canonical: `/posts/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.summary,
      url: `/posts/${post.slug}`,
    },
  };
}

export default async function PostPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return (
      <main className="min-h-[100dvh] bg-black text-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
          <h1 className="text-2xl font-black italic uppercase">Пост не знайдено</h1>
          <p className="mt-2 text-zinc-300">Посилання може бути неправильним або пост ще не задеплоєний.</p>
          <Link href="/posts" className="mt-6 inline-block text-blue-400 underline">
            ← До всіх постів
          </Link>
        </div>
      </main>
    );
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    datePublished: post.date,
    dateModified: post.date,
    inLanguage: "uk-UA",
    mainEntityOfPage: { "@type": "WebPage", "@id": `/posts/${post.slug}` },
    publisher: { "@type": "Organization", name: "Light News" },
    description: post.summary,
  };

  return (
    <main className="min-h-[100dvh] bg-black text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-14">
        <div className="flex items-center justify-between gap-4">
          <Link href="/posts" className="text-[11px] font-black uppercase tracking-widest text-zinc-300 hover:text-white">
            ← Пости
          </Link>
          <Link href="/" className="text-[11px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-200">
            Головна
          </Link>
        </div>

        <div className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400">{post.date}</span>
            {post.tags?.map((t) => (
              <span key={t} className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border border-zinc-700 text-zinc-300">
                {t}
              </span>
            ))}
          </div>

          <h1 className="mt-3 text-2xl sm:text-3xl font-black italic uppercase tracking-tight">{post.title}</h1>
          <p className="mt-2 text-sm text-zinc-300">{post.summary}</p>
        </div>

        <article
          className="mt-8 prose prose-invert prose-zinc max-w-none prose-a:text-blue-300 prose-a:underline hover:prose-a:text-blue-200 prose-headings:font-black prose-headings:italic prose-headings:uppercase prose-p:text-zinc-200"
          dangerouslySetInnerHTML={{ __html: post.html }}
        />
      </div>
    </main>
  );
}

