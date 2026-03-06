import { NextRequest, NextResponse } from 'next/server';
import { getKV } from '@/lib/kv';
import { getClientIp, checkRateLimit } from '@/lib/rate-limit';

const SEND_NEWS_LIMIT = 10; // макс. звернень на IP за годину

/**
 * POST /api/send-news
 * Відправляє пропозицію новини тільки адміну в особисті (не в канал).
 * Потрібні: TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID (числовий chat_id особистого чату з ботом).
 */
export async function POST(req: NextRequest) {
  if (req.headers.get('content-type')?.toLowerCase().replace(/\s/g, '').replace(/;.*/, '') !== 'application/json') {
    return NextResponse.json({ error: 'Content-Type має бути application/json' }, { status: 400 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!token || !adminChatId) {
    return NextResponse.json(
      { error: 'Надсилання тільки адміну: вкажіть TELEGRAM_ADMIN_CHAT_ID (не використовується канал)' },
      { status: 503 }
    );
  }

  const kv = await getKV();
  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(kv, 'sendnews', ip, SEND_NEWS_LIMIT);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Забагато звернень. Спробуйте пізніше (ліміт на годину).' },
      { status: 429 }
    );
  }

  let body: { title?: string; text?: string; link?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rawTitle = typeof body.title === 'string' ? body.title.trim() : '';
  const rawText = typeof body.text === 'string' ? body.text.trim() : '';
  const rawLink = typeof body.link === 'string' ? body.link.trim() : '';

  if (!rawTitle && !rawText) {
    return NextResponse.json({ error: 'Потрібно заповнити заголовок або текст' }, { status: 400 });
  }

  const MAX_TITLE = 300;
  const MAX_TEXT = 3000;
  const MAX_LINK = 500;
  if (rawTitle.length > MAX_TITLE || rawText.length > MAX_TEXT || rawLink.length > MAX_LINK) {
    return NextResponse.json(
      { error: `Перевищено ліміт: заголовок до ${MAX_TITLE}, текст до ${MAX_TEXT}, посилання до ${MAX_LINK} символів` },
      { status: 400 }
    );
  }

  const title = rawTitle.slice(0, MAX_TITLE);
  const text = rawText.slice(0, MAX_TEXT);
  const link = rawLink.slice(0, MAX_LINK);

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
