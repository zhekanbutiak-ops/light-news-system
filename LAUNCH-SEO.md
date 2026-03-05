# Запуск сайту: індексація в Google

## Що вже зроблено в проєкті

- **Мета-теги** (`app/layout.tsx`): title, description, keywords, Open Graph, Twitter Card, canonical, `robots: index, follow`.
- **robots.txt** (`app/robots.ts`): дозволено індексувати весь сайт, заборонено `/api/`, посилання на sitemap.
- **sitemap.xml** (`app/sitemap.ts`): головна сторінка з `changeFrequency: hourly`, `priority: 1`.
- **lang="uk"** у `<html>` для української мови.

## Що зробити перед запуском

### 1. Домен і змінна оточення

У Vercel задай змінну **`NEXT_PUBLIC_SITE_URL`** = повна адреса сайту, наприклад:
- `https://light-fast.com.ua`  
або  
- `https://твій-проєкт.vercel.app`

Вона використовується в sitemap, robots і canonical. Якщо не задана, використовується `VERCEL_URL` або fallback `https://light-fast.com.ua`.

### 2. Google Search Console

1. Зайди на [Google Search Console](https://search.google.com/search-console).
2. Додай ресурс (властивість): **URL prefix** → вкажи свій домен (наприклад `https://light-fast.com.ua`).
3. Підтвердження: варіант **HTML-тег** — у `app/layout.tsx` у `metadata` можна додати:
   ```ts
   verification: { google: "КОД_З_GSC" }
   ```
   або завантажи файл у корінь (через Next.js static file у `public/`).
4. Після підтвердження: **Sitemaps** → додай URL: `https://твій-домен/sitemap.xml`.

### 3. Перевірка після деплою

- Відкрий у браузері:
  - `https://твій-домен/robots.txt`
  - `https://твій-домен/sitemap.xml`
- Переконайся, що в коді сторінки є теги `<title>`, `<meta name="description">` та Open Graph (переглянути код сторінки або через [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)).

### 4. Опційно: прискорити індексацію

У Search Console після додавання sitemap можна один раз надіслати URL головної сторінки через **Перевірити URL** → **Запитати індексування**.

---

Підсумок: після деплою з правильною `NEXT_PUBLIC_SITE_URL` Google зможе знаходити сайт через robots.txt і sitemap; підтвердження в GSC і відправка sitemap прискорять появу в пошуку.

---

## Счётчик «Online» у футері

Щоб у футері показувалась **реальна кількість відвідувачів на сайті** (онлайн):

1. У Vercel додай **Redis** (наприклад через Marketplace → Upstash Redis або Vercel KV, якщо ще доступний).
2. У змінних оточення з’являться **`KV_REST_API_URL`** та **`KV_REST_API_TOKEN`** (або аналог від обраного Redis).
3. Після деплою кожен відвідувач раз на 50 с відправляє «пульс» у `/api/online`; число онлайн оновлюється кожні 25 с.

Якщо Redis не налаштовано, у блоці Online буде показано «—». Today і Total залишаються статичними.
