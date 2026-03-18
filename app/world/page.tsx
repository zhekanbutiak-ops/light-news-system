import type { Metadata } from "next";
import Home from "../page";

export const metadata: Metadata = {
  title: "Світ — міжнародні новини",
  description:
    "Міжнародні новини: США, ЄС, НАТО, дипломатія, санкції, важливі події у світі. Коротко та по суті.",
  alternates: { canonical: "/world" },
  openGraph: { title: "Світ — Light News", url: "/world" },
};

export default function WorldPage() {
  return <Home />;
}

