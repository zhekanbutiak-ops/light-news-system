import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { getNewsForDigest, markNewsSentToTg } from "@/lib/db";
import { postToFacebookPage } from "@/lib/facebook";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const HOURS_AGO = 10;
const FALLBACK = "Доброго ранку, Україно. Головні події за ніч — у нашому каналі протягом дня. Слідкуйте за оновленнями.";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    return NextResponse.json({ error: "TELEGRAM_* missing" }, { status: 503 });
  }

  try {
    const rows = await getNewsForDigest(HOURS_AGO, true);
    const ids = rows.map((r) => r.id);

    const list = rows
      .slice(0, 20)
      .map((r, i) => `${i + 1}. ${r.title}`)
      .join("\n");

    let text = FALLBACK;
    if (rows.length > 0 && process.env.GROQ_API_KEY) {
      try {
        const completion = await groq.chat.completions.create({
          messages: [
            {
              role: "system",
              content: `Ти досвідчений журналіст-аналітик рівня аналітичного офісу: не просто переказуєш новини, а даєш коротку оцінку та аналіз.

Формат відповіді — обов'язково українською:
1. Початок: «Доброго ранку, Україно. Ось головні новини, які ви могли пропустити за цю ніч.»
2. Далі 4–5 пунктів: кожен — головна думка з новини + дуже стисла аналітична оцінка (чому це важливо, що це означає, контекст). Не суха переказування — саме оцінка на рівні професійного аналітика.
3. В кінці — один короткий абзац «Аналіз за ніч»: підсумок того, як події вписуються в загальну картину, що варто слідкувати сьогодні.

Стиль: лаконічно, по суті, без води. Можна використовувати тире або емодзі для пунктів. Без нумерації 1. 2. 3. — тільки зміст.`,
            },
            {
              role: "user",
              content: `Заголовки новин за останні години (з них зроби аналітичний ранковий дайджест з оцінкою та коротким аналізом):\n\n${list}`,
            },
          ],
          model: "llama-3.3-70b-versatile",
          max_tokens: 600,
        });
        const raw = completion.choices[0]?.message?.content?.trim();
        if (raw) text = raw;
      } catch (e) {
        console.error("[morning-digest] Groq error:", e instanceof Error ? e.message : e);
      }
    } else if (rows.length > 0) {
      text = `Доброго ранку, Україно. Ось головні новини, які ви могли пропустити за цю ніч.\n\n${rows.slice(0, 5).map((r) => `• ${r.title}`).join("\n")}`;
    }

    const tgRes = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text,
      }),
    });

    const tgData = (await tgRes.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    if (!tgRes.ok) {
      return NextResponse.json({ error: "Telegram send failed", details: tgData.description }, { status: 502 });
    }

    if (ids.length > 0) await markNewsSentToTg(ids);

    // Ранковий дайджест так само в Facebook (best-effort)
    const fbPost = await postToFacebookPage(text);

    return NextResponse.json({
      success: true,
      newsCount: rows.length,
      facebook: fbPost ? { id: fbPost.id } : undefined,
      sent: true,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
