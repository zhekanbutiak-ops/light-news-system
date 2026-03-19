import Link from "next/link";
import type { Metadata } from "next";
import { getArmyInformItems } from "@/lib/armyinform";

export const metadata: Metadata = {
  title: "Пости з ArmyInform (авто)",
  description: "Автоматична стрічка: заголовок + посилання на першоджерело ArmyInform.",
  alternates: { canonical: "/posts/armyinform" },
};

export default async function ArmyInformPostsPage() {
  const items = await getArmyInformItems(40);

  return (
    <main className="min-h-[100dvh] bg-black text-white">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-14">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-400">Light News</p>
            <h1 className="text-3xl sm:text-4xl font-black italic uppercase tracking-tight">ArmyInform</h1>
            <p className="mt-2 text-sm text-zinc-300 max-w-2xl">
              Автоматична добірка: <b>лише заголовок + посилання</b> на першоджерело. Текст не копіюємо.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/posts"
              className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-full border border-zinc-700 text-zinc-200 hover:bg-zinc-900"
            >
              До постів
            </Link>
            <a
              href="https://armyinform.com.ua/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-full border border-zinc-700 text-zinc-200 hover:bg-zinc-900"
            >
              ArmyInform →
            </a>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-300">
            Тимчасово немає записів зі стрічки. Спробуйте оновити сторінку пізніше.
          </div>
        ) : (
          <div className="grid gap-3">
            {items.map((it) => (
              <a
                key={`${it.link}`}
                href={it.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-3xl border border-zinc-800 bg-zinc-950 p-5 hover:border-zinc-700 hover:bg-zinc-900/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                      Джерело: ArmyInform{it.pubDate ? ` · ${new Date(it.pubDate).toLocaleDateString("uk-UA")}` : ""}
                    </div>
                    <div className="mt-2 text-base sm:text-lg font-black italic uppercase tracking-tight text-white group-hover:text-blue-300 line-clamp-2">
                      {it.title}
                    </div>
                  </div>
                  <div className="shrink-0 text-[11px] font-black uppercase tracking-widest text-blue-400">
                    Перейти →
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

