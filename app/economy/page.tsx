import type { Metadata } from "next";
import Home from "../page";

export const metadata: Metadata = {
  title: "Економіка — курси, тарифи, бюджет",
  description:
    "Економічні новини України: курс валют, НБУ, тарифи, енергетика, бізнес, бюджет, інфляція. Оновлення щодня.",
  alternates: { canonical: "/economy" },
  openGraph: { title: "Економіка — Light News", url: "/economy" },
};

export default function EconomyPage() {
  return <Home />;
}

