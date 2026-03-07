import { NextRequest, NextResponse } from "next/server";
import { getHolidaysForDate, formatHolidaysForPost } from "@/lib/holidays";
import { postToFacebookPage } from "@/lib/facebook";

/**
 * Щоденний пост про свято/визначну дату о 08:00 (Київ).
 * Cron: 0 5 * * * (05:00 UTC = 08:00 Europe/Kyiv).
 * Якщо сьогодні немає свят — нічого не публікуємо.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const items = getHolidaysForDate(now);
  if (items.length === 0) {
    return NextResponse.json({ success: true, skipped: true, reason: "no_holiday_today" });
  }

  const message = formatHolidaysForPost(items);
  if (!message) return NextResponse.json({ success: true, skipped: true });

  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    return NextResponse.json({ error: "TELEGRAM_* missing" }, { status: 503 });
  }

  try {
    const tgRes = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: message,
        }),
      }
    );

    const tgData = (await tgRes.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    if (!tgRes.ok) {
      return NextResponse.json(
        { error: "Telegram send failed", details: tgData.description },
        { status: 502 }
      );
    }

    const fbPost = await postToFacebookPage(message);

    return NextResponse.json({
      success: true,
      telegram: true,
      facebook: fbPost ? { id: fbPost.id } : undefined,
      holiday: items.map((h) => h.title),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
