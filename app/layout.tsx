import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"], // Додали кирилицю
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"], // Додали кирилицю
});

// ТВОЇ SEO МЕТАТЕГИ
export const metadata: Metadata = {
  title: "LIGHT FAST | Швидкі новини України та LIGHT AI",
  description: "Перша автономна інформаційна екосистема України. Швидкі новини, курси валют, крипто-моніторинг та інтелектуальний пошук LIGHT AI.",
  keywords: [
    "швидкі новини України", 
    "Light AI", 
    "новини криптo", 
    "курс долара онлайн", 
    "авто новини", 
    "технології", 
    "LIGHT FAST"
  ],
  authors: [{ name: "LIGHT SYSTEM" }],
  openGraph: {
    title: "LIGHT FAST | Global Terminal",
    description: "Будь на крок попереду з автономною системою LIGHT.",
    url: "https://light-fast.com.ua", // Потім заміниш на свій домен
    siteName: "LIGHT NEWS",
    locale: "uk_UA",
    type: "website",
  },
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
        {children}
      </body>
    </html>
  );
}