import type { Metadata } from "next";
import Home from "../page";

export const metadata: Metadata = {
  title: "Фронт — новини війни та зведення",
  description:
    "Оперативні новини фронту: зведення, обстріли, дрони, ППО, ситуація на напрямках. Актуально та коротко.",
  alternates: { canonical: "/front" },
  openGraph: { title: "Фронт — Light News", url: "/front" },
};

export default function FrontPage() {
  return <Home />;
}

