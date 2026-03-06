import { NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getClientIp, checkRateLimit } from "@/lib/rate-limit";

const MAX_PROMPT_LEN = 2000;
const CHAT_LIMIT = 30; // макс. запитів на IP за годину

export async function POST(req: Request) {
  try {
    if (req.headers.get("content-type")?.toLowerCase().replace(/\s/g, "").replace(/;.*/, "") !== "application/json") {
      return NextResponse.json({ text: "Content-Type має бути application/json" }, { status: 400 });
    }

    const body = await req.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim().slice(0, MAX_PROMPT_LEN) : "";
    if (!prompt) {
      return NextResponse.json({ text: "Потрібно передати prompt" }, { status: 400 });
    }

    const kv = await getKV();
    const { allowed } = await checkRateLimit(kv, "chat", getClientIp(req), CHAT_LIMIT);
    if (!allowed) {
      return NextResponse.json({ text: "Забагато запитів. Спробуйте пізніше." }, { status: 429 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // 1. ПЕРЕВІРКА НАЯВНОСТІ КЛЮЧА
    if (!apiKey || apiKey.length < 10) {
      console.error("Ключ GEMINI_API_KEY не знайдено в .env.local");
      return NextResponse.json(
        { text: "Помилка: API Ключ не знайдено. Перевірте файл .env.local та перезапустіть сервер." },
        { status: 500 }
      );
    }

    // 2. ОТРИМУЄМО СПИСОК ДОСТУПНИХ МОДЕЛЬ (щоб не вгадувати назву)
    const listResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const listData = await listResponse.json();

    if (listData.error) {
      return NextResponse.json(
        { text: `Помилка Google API (Ключ): ${listData.error.message}` },
        { status: 500 }
      );
    }

    // Шукаємо першу ліпшу модель, яка підтримує генерацію контенту
    const availableModel = listData.models?.find((m: any) => 
      m.supportedGenerationMethods.includes("generateContent") && 
      (m.name.includes("gemini-1.5-flash") || m.name.includes("gemini-pro"))
    );

    if (!availableModel) {
      return NextResponse.json(
        { text: "У вашому акаунті не знайдено доступних моделей Gemini." },
        { status: 500 }
      );
    }

    // 3. ЗАПИТ ДО МОДЕЛІ З ПОСЛАБЛЕНИМИ ФІЛЬТРАМИ
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${availableModel.name}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt.slice(0, MAX_PROMPT_LEN) }] }],
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          ],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 1000,
          }
        }),
      }
    );

    const data = await response.json();

    // 4. ОБРОБКА ВІДПОВІДІ
    if (data.error) {
      return NextResponse.json(
        { text: `Помилка моделі: ${data.error.message}` },
        { status: 500 }
      );
    }

    // Якщо запит заблоковано фільтром самого Google (на рівні промпта)
    if (data.promptFeedback?.blockReason) {
      return NextResponse.json({ 
        text: `Запит відхилено системою безпеки Google: ${data.promptFeedback.blockReason}` 
      });
    }

    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiText) {
      const reason = data.candidates?.[0]?.finishReason;
      return NextResponse.json({ 
        text: `ШІ не зміг відповісти. Причина зупинки: ${reason || "Невідомо (SAFETY)"}` 
      });
    }

    // УСПІХ
    return NextResponse.json({ text: aiText });

  } catch (error: any) {
    console.error("SERVER ERROR:", error);
    return NextResponse.json(
      { text: "Критична помилка сервера. Перевірте термінал VS Code." },
      { status: 500 }
    );
  }
}