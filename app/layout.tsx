import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"], // Додали кирилицю
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"], // Додали кирилицю
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://light-fast.com.ua";

// Потужна схема для Google: сайт, організація, головна сторінка, список новин
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "Light News",
      description: "Актуальні новини України: головні події, фронт, економіка, світ. Курси валют НБУ, карта тривог, дайджест. Офіційні джерела.",
      inLanguage: "uk-UA",
      publisher: { "@id": `${siteUrl}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${siteUrl}/?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "Light News",
      url: siteUrl,
      logo: { "@type": "ImageObject", url: `${siteUrl}/images/logo.png`, width: 512, height: 512 },
      sameAs: [
        "https://t.me/lightnews13",
        "https://www.facebook.com/lightnews13",
      ],
    },
    {
      "@type": "WebPage",
      "@id": `${siteUrl}/#webpage`,
      url: siteUrl,
      name: "Light News | Новини України — головне, фронт, економіка, світ",
      description: "Актуальні новини України зараз: головні події, війна та фронт, економіка, світ. Курс долара сьогодні (НБУ), карта тривог, дайджест.",
      isPartOf: { "@id": `${siteUrl}/#website` },
      about: { "@id": `${siteUrl}/#organization` },
      inLanguage: "uk-UA",
      primaryImageOfPage: { "@type": "ImageObject", url: `${siteUrl}/images/logo.png` },
      datePublished: "2024-01-01T00:00:00+03:00",
      dateModified: new Date().toISOString().slice(0, 10) + "T12:00:00+03:00",
      mainEntity: { "@id": `${siteUrl}/#itemlist` },
    },
    {
      "@type": "ItemList",
      "@id": `${siteUrl}/#itemlist`,
      name: "Головні новини України",
      description: "Актуальні новини: головне, фронт, економіка, світ. Оновлюється щодня.",
      url: siteUrl,
      numberOfItems: 15,
      itemListOrder: "https://schema.org/ItemListOrderDescending",
    },
  ],
};

// SEO для Google та соцмереж — високий рівень
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Light News | Новини України — головне, фронт, економіка, світ",
    template: "%s | Light News",
  },
  description:
    "Актуальні новини України: головні події, фронт, економіка, світ. Курси валют НБУ, карта тривог, дайджест. Офіційні джерела.",
  keywords: [
    "новини України",
    "головні новини сьогодні",
    "новини фронт",
    "війна новини",
    "економіка України",
    "курс долара сьогодні",
    "курс НБУ",
    "карта тривог",
    "новини України зараз",
    "головні події України",
    "Light News",
  ],
  authors: [{ name: "Light News", url: siteUrl }],
  creator: "Light News",
  publisher: "Light News",
  category: "news",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    title: "Light News | Новини України — головне, фронт, економіка, світ",
    description: "Актуальні новини України: головні події, фронт, економіка, світ. Курси НБУ, карта тривог, дайджест.",
    url: siteUrl,
    siteName: "Light News",
    locale: "uk_UA",
    type: "website",
    images: [
      { url: "/images/logo.png", width: 1200, height: 630, alt: "Light News — новини України" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Light News | Новини України",
    description: "Актуальні новини України: головне, фронт, економіка, світ. Курси НБУ, карта тривог.",
  },
  alternates: { canonical: siteUrl },
  // Додай код після верифікації в Search Console: verification: { google: "твій_код" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}');
              `}
            </Script>
          </>
        )}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}