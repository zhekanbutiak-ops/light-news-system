import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"], // Додали кирилицю
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"], // Додали кирилицю
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://light-fast.com.ua";

// SEO для Google та соцмереж
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Light News | Новини України — головне, фронт, економіка, світ",
    template: "%s | Light News",
  },
  description:
    "Актуальні новини України: головні події, фронт, економіка, світ. Курси валют, карта тривог, дайджест за хвилину. Офіційні джерела НБУ та Уряду.",
  keywords: [
    "новини України",
    "головні новини",
    "новини фронт",
    "економіка України",
    "курс долара",
    "курс НБУ",
    "карта тривог",
    "Light News",
  ],
  authors: [{ name: "Light News", url: siteUrl }],
  creator: "Light News",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    title: "Light News | Новини України",
    description: "Актуальні новини України: головне, фронт, економіка, світ. Курси валют, офіційні джерела.",
    url: siteUrl,
    siteName: "Light News",
    locale: "uk_UA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Light News | Новини України",
    description: "Актуальні новини України: головне, фронт, економіка, світ.",
  },
  alternates: { canonical: siteUrl },
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}