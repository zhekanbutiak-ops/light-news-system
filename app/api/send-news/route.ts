import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/send-news
 * Відправляє пропозицію новини тільки адміну в особисті (не в канал).
 * Потрібні: TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID (числовий chat_id особистого чату з ботом).
 */
export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!token || !adminChatId) {
    return NextResponse.json(
      { error: 'Надсилання тільки адміну: вкажіть TELEGRAM_ADMIN_CHAT_ID (не використовується канал)' },
      { status: 503 }
    );
  }

  let body: { title?: string; text?: string; link?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const link = typeof body.link === 'string' ? body.link.trim() : '';

  if (!title && !text) {
    return NextResponse.json({ error: 'Потрібно заповнити заголовок або текст' }, { status: 400 });
  }

  const lines: string[] = ['📩 Новина з сайту Light News', ''];
  if (title) lines.push(`📌 ${title}`);
  if (text) lines.push(text);
  if (link) lines.push('', `🔗 ${link}`);
  const message = lines.join('\n');

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: adminChatId,
      text: message,
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Telegram sendMessage failed:', res.status, err);
    return NextResponse.json(
      { error: 'Не вдалося надіслати повідомлення в Telegram' },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
