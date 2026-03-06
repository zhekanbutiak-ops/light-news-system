import { NextResponse } from 'next/server';
import Parser from 'rss-parser';

const parser = new Parser();

// Змінна в пам'яті сервера для збереження останньої новини (щоб не дублювати)
let lastPostedTitle = "";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  const { searchParams } = new URL(request.url);
  if (searchParams.get('key') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const feed = await parser.parseURL('https://www.suspilne.media/rss/all.rss');
    const latestNews = feed.items[0];
    if (!latestNews?.title) {
      return NextResponse.json({ error: 'No news item' }, { status: 502 });
    }

    if (latestNews.title === lastPostedTitle) {
      return NextResponse.json({ status: "Already posted", title: latestNews.title });
    }

    lastPostedTitle = latestNews.title;

    const baseUrl = new URL(request.url).origin;
    const publishRes = await fetch(`${baseUrl}/api/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secret}`,
      },
      body: JSON.stringify({
        title: latestNews.title,
        content: latestNews.contentSnippet || latestNews.content || "",
        link: latestNews.link,
        category: "Головне"
      }),
    });

    if (!publishRes.ok) {
      const err = await publishRes.json().catch(() => ({}));
      return NextResponse.json({ error: "Publish failed", details: err }, { status: 502 });
    }

    return NextResponse.json({ status: "Success", posted: latestNews.title });
  } catch (error) {
    console.error("CRON_ERROR:", error);
    return NextResponse.json({ error: "Automation failed" }, { status: 500 });
  }
}
