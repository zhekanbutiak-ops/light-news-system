import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { getNewsForPeriod } from "@/lib/db";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const DAYS_AGO = 7;
const FALLBACK =
  "📊 Тижнева аналітика LIGHT NEWS.\n\nЗа минулий тиждень подій багато — слідкуйте за каналом щодня. Головні підсумки наступного понеділка.";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (authHeader !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    return NextResponse.json({ error: "TELEGRAM_* missing" }, { status: 503 });
  }

  try {
    const rows = await getNewsForPeriod(DAYS_AGO);
    const list = rows
      .slice(0, 80)
      .map((r) => `• ${r.title}`)
      .join("\n");

    let text = FALLBACK;
    if (rows.length > 0 && process.env.GROQ_API_KEY) {
      try {
        const completion = await groq.chat.completions.create({
          messages: [
            {
              role: "system",
              content: `Ти досвідчений аналітик. На основі списку новин за тиждень зроби **тижневу аналітику подій** українською.

Формат відповіді (обов'язково дотримуйся):
1. Заголовок: «📊 Тижнева аналітика: [коротка тема тижня]» (наприклад: «Тижнева аналітика: фронт, економіка, рішення союзників»).
2. 3–4 блоки по темах: Війна/Фронт, Україна/Політика, Економіка, Світ/Союзники — у кожному 2–3 ключові думки з оцінкою (чому важливо, тренди).
3. Короткий абзац «Висновки тижня»: що було найважливішим, на що звернути увагу на наступному тижні.

Стиль: лаконічно, по суті, без води. Без нумерації 1. 2. 3. — тільки підзаголовки та пункти. Не більше 800 символів для повідомлення в Telegram.`,
            },
            {
              role: "user",
              content: `Новини за останні ${DAYS_AGO} днів (з них зроби тижневу аналітику):\n\n${list}`,
            },
          ],
          model: "llama-3.3-70b-versatile",
          max_tokens: 900,
        });
        const raw = completion.choices[0]?.message?.content?.trim();
        if (raw) text = raw;
      } catch (e) {
        console.error("[weekly-analytics] Groq error:", e instanceof Error ? e.message : e);
        text = `📊 Тижнева аналітика LIGHT NEWS\n\nЗа тиждень зібрано ${rows.length} новин. Головні теми:\n\n${rows.slice(0, 8).map((r) => `• ${r.title}`).join("\n")}`;
      }
    } else if (rows.length > 0) {
      text = `📊 Тижнева аналітика LIGHT NEWS\n\nЗа тиждень: ${rows.length} новин.\n\n${rows.slice(0, 10).map((r) => `• ${r.title}`).join("\n")}`;
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

    return NextResponse.json({
      success: true,
      newsCount: rows.length,
      sent: true,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
