import type { Metadata } from "next";
import Home from "../page";

export const metadata: Metadata = {
  title: "Breaking — термінові новини",
  description:
    "Breaking news: найважливіші та термінові події в Україні та світі. Швидкі оновлення, короткі підсумки.",
  alternates: { canonical: "/breaking" },
  openGraph: { title: "Breaking — Light News", url: "/breaking" },
};

export default function BreakingPage() {
  return <Home />;
}

