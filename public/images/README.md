# Fallback-зображення для новин

Якщо з RSS не вдається витягнути картинку (наприклад, для АрміяInform), за замовчуванням показується тематичний placeholder. Щоб підставити свої картинки:

1. Покладіть сюди файли: **fallback-news.jpg** (новини загалом), **fallback-front.jpg** (фронт / АрміяInform). Рекомендовано 800×450 px.
2. У Vercel або `.env.local` задайте:
   - `NEXT_PUBLIC_FALLBACK_NEWS_IMAGE=/images/fallback-news.jpg`
   - `NEXT_PUBLIC_FALLBACK_FRONT_IMAGE=/images/fallback-front.jpg`

Якщо змінних немає, використовуються робочі placeholder-и (щоб не було порожнього сірого блоку).
