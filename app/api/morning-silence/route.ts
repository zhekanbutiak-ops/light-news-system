import { NextRequest, NextResponse } from "next/server";
import { postToFacebookPage } from "@/lib/facebook";

/**
 * Щоденний пост о 08:59 (Київ) — хвилина мовчання.
 * Cron: 59 5 * * * (05:59 UTC = 08:59 Europe/Kyiv).
 */

const MESSAGE = `🕘 09:00 — Загальнонаціональна хвилина мовчання.

Зупиніться на мить. Згадайте кожного захисника та захисницю, які віддали життя за нашу свободу. Згадайте цивільних, чиє життя забрала війна.

Ми пам'ятаємо ціну кожного ранку. Слава нашим Героям! 🙏🇺🇦`;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

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
          text: MESSAGE,
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

    const fbPost = await postToFacebookPage(MESSAGE);

    return NextResponse.json({
      success: true,
      telegram: true,
      facebook: fbPost ? { id: fbPost.id } : undefined,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
