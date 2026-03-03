import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function POST(request: Request) {
  try {
    const { title, content, link, category } = await request.json();

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (!GROQ_API_KEY || !TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      return NextResponse.json(
        { error: "Додайте GROQ_API_KEY, TELEGRAM_BOT_TOKEN та TELEGRAM_CHAT_ID у .env.local" },
        { status: 500 }
      );
    }

    const safeLink = link && /^https?:\/\//i.test(link) ? link : "https://t.me/lightnews13";

    // --- 1. СКРЕПІНГ: завантажуємо сторінку за посиланням і витягуємо текст статті ---
    let fullArticleText = "";
    try {
      const pageRes = await fetch(safeLink, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; LIGHT-News-Bot/1.0)" },
        signal: AbortSignal.timeout(10000)
      });
      const html = await pageRes.text();
      const $ = cheerio.load(html);
      $('p').each((_i, el) => {
        fullArticleText += $(el).text().trim() + " ";
      });
      fullArticleText = fullArticleText.trim().slice(0, 4000);
    } catch (e) {
      console.error("Scraping failed, using RSS content", e);
    }

    const textForAnalysis = fullArticleText || String(content ?? "").trim() || title;

    // --- 2. ЗАПИТ ДО GROQ: аналіз повного тексту статті ---
    let finalAnalysis = "";
    try {
      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama3-8b-8192",
          messages: [
            {
              role: "system",
              content: `Ти — OSINT-аналітик LIGHT AI.
Твоя робота — не копіювати новину, а пояснити її наслідки.

СТРУКТУРА ПОСТА:
1. ❗ ТЕЗА: Суть події одним реченням (що реально сталося).
2. 💡 АНАЛІЗ: Поясни, ЧОМУ це важливо. Які приховані загрози чи вигоди тут є? (2-3 речення).
3. 📈 ПРОГНОЗ: Що очікувати в найближчі 48 годин на основі цієї новини?

УМОВА: Ніколи не починай фразою "Як повідомляється...". Пиши жорстко, по факту, як для закритого звіту.`
            },
            {
              role: "user",
              content: `Заголовок: ${title}\n\nОсь стаття для аналізу:\n${textForAnalysis}`
            }
          ],
          temperature: 0.4,
          max_tokens: 500
        })
      });
      const groqData = await groqRes.json();
      finalAnalysis = groqData.choices?.[0]?.message?.content?.trim() || "Аналітичний центр LIGHT готує розширений звіт по цій події. Очікуйте оновлень.";
    } catch (e) {
      console.error("AI Error", e);
      finalAnalysis = textForAnalysis.slice(0, 300);
    }

    // --- 3. Хештеги та форматування повідомлення ---
    const tagMap: Record<string, string> = {
      "Головне": "#Головне #Актуально",
      "🛡️ Фронт": "#Фронт #ЗСУ #Війна",
      "🇺🇦 Україна": "#Україна #Події",
      "🌍 Світ": "#Світ #Global",
      "💰 Економіка": "#Економіка #Фінанси",
      "⚠️ Breaking": "#Терміново #Breaking"
    };
    const hashtags = tagMap[category] || "#Новини";

    const escape = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeTitle = escape(title);
    const safeAnalysis = escape(finalAnalysis);

    const message = `
<b>${safeTitle}</b>

<blockquote>${safeAnalysis}</blockquote>

${hashtags}
🕒 ${new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })} • <a href="${safeLink}">Джерело</a>

📡 @lightnews13 | LIGHT FAST
`.trim();

    const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      }),
    });

    const tgData = await tgRes.json();
    if (tgData.ok) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "TG Error: " + (tgData.description || "unknown") }, { status: 400 });
  } catch (error) {
    console.error("PUBLISH_ERROR:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
