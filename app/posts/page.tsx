import Link from "next/link";
import type { Metadata } from "next";
import { getAllPostsMeta } from "@/lib/posts";

export const metadata: Metadata = {
  title: "Пости",
  description: "Оригінальні матеріали Light News: підрозділ дня, нацспротив, пояснення та добірки.",
  alternates: { canonical: "/posts" },
};

export default async function PostsIndexPage() {
  const posts = await getAllPostsMeta();

  return (
    <main className="min-h-[100dvh] bg-black text-white">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-14">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-400">Light News</p>
            <h1 className="text-3xl sm:text-4xl font-black italic uppercase tracking-tight">Пости</h1>
            <p className="mt-2 text-sm text-zinc-300 max-w-2xl">
              Це наш власний контент: “підрозділ дня”, “нацспротив”, короткі пояснення і корисні добірки.
            </p>
          </div>
          <Link
            href="/"
            className="shrink-0 inline-flex items-center justify-center min-h-[44px] px-4 rounded-full border border-zinc-700 text-zinc-200 hover:bg-zinc-900"
          >
            На головну
          </Link>
        </div>

        {posts.length === 0 ? (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-300">
            Поки що немає постів. Додайте файл у <code className="text-zinc-100">content/posts</code> і задеплойте.
          </div>
        ) : (
          <div className="grid gap-4">
            {posts.map((p) => (
              <Link
                key={p.slug}
                href={`/posts/${p.slug}`}
                className="group rounded-3xl border border-zinc-800 bg-zinc-950 p-6 hover:border-zinc-700 hover:bg-zinc-900/40 transition-colors"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400">{p.date}</span>
                  {p.tags?.slice(0, 4).map((t) => (
                    <span
                      key={t}
                      className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border border-zinc-700 text-zinc-300"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <h2 className="mt-3 text-xl sm:text-2xl font-black italic uppercase tracking-tight text-white group-hover:text-blue-300">
                  {p.title}
                </h2>
                <p className="mt-2 text-sm text-zinc-300">{p.summary}</p>
                <div className="mt-4 text-[11px] font-black uppercase tracking-widest text-blue-400">
                  Читати →
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

