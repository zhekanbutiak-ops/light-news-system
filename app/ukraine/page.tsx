import type { Metadata } from "next";
import Home from "../page";

export const metadata: Metadata = {
  title: "Україна — новини країни",
  description:
    "Головні новини України: рішення влади, події в регіонах, суспільство, інфраструктура, важливі повідомлення.",
  alternates: { canonical: "/ukraine" },
  openGraph: { title: "Україна — Light News", url: "/ukraine" },
};

export default function UkrainePage() {
  return <Home />;
}

