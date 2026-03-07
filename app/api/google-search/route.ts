import { NextRequest, NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getClientIp, checkRateLimit } from "@/lib/rate-limit";

const SEARCH_LIMIT = 30; // макс. пошукових запитів на IP за годину

export async function GET(req: NextRequest) {
  const kv = await getKV();
  const { allowed } = await checkRateLimit(kv, "search", getClientIp(req), SEARCH_LIMIT);
  if (!allowed) {
    return NextResponse.json({ error: "Забагато запитів. Спробуйте пізніше.", results: [] }, { status: 429 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    const apiKey = process.env.GEMINI_API_KEY;
    const cx = process.env.GOOGLE_SEARCH_CX;

    // Якщо ключів немає — виводимо зрозумілу помилку в консоль
    if (!apiKey || !cx) {
      console.error("Missing Search Keys in .env.local");
      return NextResponse.json({ error: "Налаштування пошуку відсутні" }, { status: 500 });
    }

    if (!query) {
      return NextResponse.json({ results: [] });
    }

    const safeQuery = String(query).trim().slice(0, 200);
    if (!safeQuery) {
      return NextResponse.json({ results: [] });
    }

    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(safeQuery)}`;
    
    const response = await fetch(url);
    const data = await response.json();

    // Якщо Google повернув помилку (наприклад, ліміти)
    if (data.error) {
      console.error("Google API Error:", data.error.message);
      return NextResponse.json({ error: data.error.message }, { status: 500 });
    }

    // Безпечне витягування результатів
    const results = data.items?.map((item: any) => ({
      title: item.title || "Без назви",
      link: item.link || "#",
      snippet: item.snippet || "",
    })) || [];

    return NextResponse.json({ results });

  } catch (error: any) {
    console.error("Search Route Crash:", error);
    return NextResponse.json({ error: "Внутрішня помилка сервера" }, { status: 500 });
  }
}