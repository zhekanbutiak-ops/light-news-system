/**
 * Публікація на Facebook Page через Graph API (page feed).
 * Потрібні змінні: FACEBOOK_PAGE_ID, FACEBOOK_PAGE_ACCESS_TOKEN.
 * Якщо не задані — функція нічого не робить і повертає null.
 */

const FB_API_VERSION = "v21.0";

export type FacebookPostResult = { id: string } | null;

/**
 * Публікує пост на сторінку Facebook: текст + посилання (Facebook покаже прев'ю).
 * Повертає { id } поста при успіху, null якщо не налаштовано або помилка (логується).
 */
export async function postToFacebookPage(message: string, link?: string): Promise<FacebookPostResult> {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!pageId || !token) return null;

  const url = `https://graph.facebook.com/${FB_API_VERSION}/${pageId}/feed`;
  const body = new URLSearchParams({
    message,
    access_token: token,
    ...(link ? { link } : {}),
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
    if (!res.ok) {
      console.error("[facebook] post failed:", data?.error?.message ?? res.status);
      return null;
    }
    return data.id ? { id: data.id } : null;
  } catch (e) {
    console.error("[facebook] request error:", e instanceof Error ? e.message : e);
    return null;
  }
}
