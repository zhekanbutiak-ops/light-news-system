import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Розіграш Light News — 1600 грн",
  description:
    "Великий весняний розіграш від Light News: 1 місце — 1000 грн, 2 місце — 500 грн, 3 місце — 100 грн. Дата розіграшу: 01.05.2026.",
  alternates: { canonical: "/giveaway" },
  openGraph: {
    title: "Розіграш Light News — 1600 грн",
    description:
      "Умови участі в розіграші Light News: підписка на Telegram, репост допису. Результати 01.05.2026.",
    url: "/giveaway",
    type: "article",
  },
  keywords: [
    "розіграш",
    "розіграш Light News",
    "розіграш грошей",
    "акція Light News",
    "Telegram розіграш",
    "розіграш 01.05.2026",
    "giveaway Ukraine",
  ],
};

export default function GiveawayPage() {
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Великий весняний розіграш від Light News: 1600 грн",
    description:
      "Умови участі в розіграші Light News: підписка на Telegram, репост допису. Три призи: 1000, 500 і 100 грн.",
    inLanguage: "uk-UA",
    datePublished: "2026-03-18",
    dateModified: "2026-03-19",
    mainEntityOfPage: { "@type": "WebPage", "@id": "/giveaway" },
    publisher: { "@type": "Organization", name: "Light News" },
  };
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Яка дата розіграшу Light News?",
        acceptedAnswer: { "@type": "Answer", text: "Результати розіграшу будуть оголошені 01.05.2026 у Telegram-каналі Light News." },
      },
      {
        "@type": "Question",
        name: "Які призи у розіграші?",
        acceptedAnswer: { "@type": "Answer", text: "1 місце — 1000 грн, 2 місце — 500 грн, 3 місце — 100 грн." },
      },
      {
        "@type": "Question",
        name: "Що потрібно для участі?",
        acceptedAnswer: { "@type": "Answer", text: "Підписатися на Telegram-канал Light News і зробити репост закріпленого допису про розіграш." },
      },
    ],
  };

  return (
    <main className="min-h-[100dvh] bg-black text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10 sm:py-14">
        <div className="flex items-center justify-between gap-3 mb-6">
          <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-400">Light News</p>
          <Link href="/" className="text-[11px] uppercase font-black tracking-widest text-zinc-300 hover:text-white">
            На головну
          </Link>
        </div>

        <div className="rounded-3xl border border-fuchsia-500/25 bg-fuchsia-950/15 p-6 sm:p-8">
          <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-300">Розіграш Light News</p>
          <h1 className="mt-2 text-2xl sm:text-4xl font-black italic uppercase tracking-tight">
            Великий весняний розіграш: даруємо 1600 грн
          </h1>
          <p className="mt-3 text-sm text-zinc-200">
            Ми оголошуємо розіграш грошових призів для читачів Light News. Результати — <b>01.05.2026</b>.
          </p>
        </div>

        <div className="mt-6 grid gap-4">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-300">Призи</h2>
            <ul className="mt-3 space-y-1 text-zinc-100">
              <li>1 місце — 1000 грн</li>
              <li>2 місце — 500 грн</li>
              <li>3 місце — 100 грн</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-300">Як взяти участь</h2>
            <ol className="mt-3 space-y-1 text-zinc-100 list-decimal list-inside">
              <li>Бути підписаним на Telegram-канал Light News.</li>
              <li>Зробити репост допису про розіграш (закріп у каналі).</li>
            </ol>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-300">Коли результати</h2>
            <p className="mt-3 text-zinc-100">
              Визначення переможців відбудеться <b>01.05.2026</b> за допомогою сервісу випадкового вибору чисел.
              Публікація результатів — у Telegram-каналі.
            </p>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-300">FAQ</h2>
            <div className="mt-3 space-y-3 text-zinc-100">
              <div>
                <p className="font-bold">Яка дата розіграшу?</p>
                <p className="text-sm text-zinc-300">01.05.2026, результати в Telegram Light News.</p>
              </div>
              <div>
                <p className="font-bold">Що потрібно зробити для участі?</p>
                <p className="text-sm text-zinc-300">Підписатися на канал і зробити репост закріпленого допису.</p>
              </div>
              <div>
                <p className="font-bold">Скільки переможців?</p>
                <p className="text-sm text-zinc-300">Троє переможців: 1000 грн, 500 грн і 100 грн.</p>
              </div>
            </div>
          </section>
        </div>

        <a
          href="https://t.me/lightnews13"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex items-center justify-center min-h-[44px] px-5 rounded-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-[11px] font-black uppercase tracking-widest"
        >
          Перейти в Telegram →
        </a>
      </div>
    </main>
  );
}

