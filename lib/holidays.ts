/**
 * Державні свята та визначні дати України (фіксовані дати).
 * Рухомі свята (Великдень, Трійця) не включені — їх можна додати окремо за роком.
 */

export type HolidayItem = { title: string; official?: boolean };

// Ключ: "MM-DD", значення: масив свят на цей день (іноді кілька)
const HOLIDAYS: Record<string, HolidayItem[]> = {
  "01-01": [{ title: "Новий рік", official: true }],
  "01-07": [{ title: "Різдво Христове (за юліанським календарем)" }],
  "01-22": [{ title: "День Соборності України", official: true }],
  "02-14": [{ title: "День вшанування учасників бойових дій на території інших держав" }],
  "02-23": [{ title: "День захисника Вітчизни (міжнародна традиція)" }],
  "03-08": [{ title: "Міжнародний жіночий день", official: true }],
  "03-09": [{ title: "День народження Тараса Шевченка (1814)" }],
  "05-01": [{ title: "День праці", official: true }],
  "05-08": [{ title: "День пам'яті та перемоги над нацизмом у Другій світовій війні", official: true }],
  "05-09": [{ title: "День Європи в Україні" }],
  "06-28": [{ title: "День Конституції України", official: true }],
  "07-15": [{ title: "День Української Державності", official: true }],
  "07-28": [{ title: "День хрещення Київської Русі — України" }],
  "08-23": [{ title: "День Державного Прапора України" }],
  "08-24": [{ title: "День Незалежності України", official: true }],
  "10-01": [{ title: "День захисників і захисниць України", official: true }],
  "10-14": [{ title: "День захисника України (Покрова)" }],
  "11-21": [{ title: "День Гідності та Свободи", official: true }],
  "12-06": [{ title: "День Збройних Сил України" }],
  "12-25": [{ title: "Різдво Христове", official: true }],
};

/**
 * Повертає свята та визначні дати для заданої дати (за часом Києва).
 * date — JavaScript Date; для консистентності з cron використовуй дату в Europe/Kyiv.
 */
export function getHolidaysForDate(date: Date): HolidayItem[] {
  const kyiv = new Date(date.toLocaleString("en-US", { timeZone: "Europe/Kyiv" }));
  const month = String(kyiv.getMonth() + 1).padStart(2, "0");
  const day = String(kyiv.getDate()).padStart(2, "0");
  const key = `${month}-${day}`;
  return HOLIDAYS[key] ?? [];
}

/** Текст для посту в TG: один рядок з усіма святами на сьогодні. */
export function formatHolidaysForPost(items: HolidayItem[]): string {
  if (items.length === 0) return "";
  const lines = items.map((i) => (i.official ? `🇺🇦 ${i.title}` : `• ${i.title}`));
  return "Сьогодні — " + lines.join(". ");
}
