/**
 * Державні свята та визначні дати України (фіксовані дати).
 * url — посилання на опис/публікацію (Вікіпедія, офіційне джерело тощо); при кліку відкривається в новій вкладці.
 * Рухомі свята (Великдень, Трійця) не включені — їх можна додати окремо за роком.
 */

const W = "https://uk.wikipedia.org/wiki";

export type HolidayItem = { title: string; official?: boolean; url?: string };

// Ключ: "MM-DD", значення: масив свят на цей день (іноді кілька)
const HOLIDAYS: Record<string, HolidayItem[]> = {
  "01-01": [{ title: "Новий рік", official: true, url: `${W}/Новий_рік` }],
  "01-07": [
    { title: "Різдво Христове (за юліанським календарем)", url: `${W}/Різдво_Христове` },
    { title: "Святвечір (Сочильник)", url: `${W}/Святвечір` },
  ],
  "01-22": [{ title: "День Соборності України", official: true, url: `${W}/День_Соборності_України` }],
  "02-14": [{ title: "День вшанування учасників бойових дій на території інших держав", url: `${W}/День_вшанування_учасників_бойових_дій` }],
  "02-23": [{ title: "День захисника Вітчизни (міжнародна традиція)", url: `${W}/День_захисника_Вітчизни` }],
  "03-08": [{ title: "Міжнародний жіночий день", official: true, url: `${W}/Міжнародний_жіночий_день` }],
  "03-09": [{ title: "День народження Тараса Шевченка (1814)", url: `${W}/Тарас_Шевченко` }],
  "05-01": [{ title: "День праці", official: true, url: `${W}/День_праці` }],
  "05-08": [{ title: "День пам'яті та перемоги над нацизмом у Другій світовій війні", official: true, url: `${W}/День_перемоги_над_нацизмом` }],
  "05-09": [{ title: "День Європи в Україні", url: `${W}/День_Європи` }],
  "06-28": [{ title: "День Конституції України", official: true, url: `${W}/День_Конституції_України` }],
  "07-15": [{ title: "День Української Державності", official: true, url: `${W}/День_Української_Державності` }],
  "07-28": [{ title: "День хрещення Київської Русі — України", url: `${W}/Хрещення_Русі` }],
  "08-23": [{ title: "День Державного Прапора України", url: `${W}/День_Державного_Прапора_України` }],
  "08-24": [{ title: "День Незалежності України", official: true, url: `${W}/День_Незалежності_України` }],
  "10-01": [{ title: "День захисників і захисниць України", official: true, url: `${W}/День_захисників_України` }],
  "10-14": [{ title: "День захисника України (Покрова)", url: `${W}/Покрова_Пресвятої_Богородиці` }],
  "11-21": [{ title: "День Гідності та Свободи", official: true, url: `${W}/День_Гідності_та_Свободи` }],
  "12-06": [{ title: "День Збройних Сил України", url: `${W}/Збройні_сили_України` }],
  "12-25": [{ title: "Різдво Христове", official: true, url: `${W}/Різдво_Христове` }],
};

function getKyivDate(date: Date): { month: number; day: number } {
  const kyiv = new Date(date.toLocaleString("en-US", { timeZone: "Europe/Kyiv" }));
  return { month: kyiv.getMonth() + 1, day: kyiv.getDate() };
}

/**
 * Повертає свята та визначні дати для заданої дати (за часом Києва).
 */
export function getHolidaysForDate(date: Date): HolidayItem[] {
  const { month, day } = getKyivDate(date);
  const key = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return HOLIDAYS[key] ?? [];
}

/** Свята на буквально завтра (наступний календарний день за часом Києва). */
export function getHolidaysForTomorrow(date: Date): HolidayItem[] {
  const kyiv = new Date(date.toLocaleString("en-US", { timeZone: "Europe/Kyiv" }));
  kyiv.setDate(kyiv.getDate() + 1);
  return getHolidaysForDate(kyiv);
}

const MONTH_NAMES = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];

/** Найближче свято після заданої дати (дата + список). Якщо нічого — null. */
export function getNextUpcomingHoliday(date: Date): { dateLabel: string; items: HolidayItem[] } | null {
  const keys = Object.keys(HOLIDAYS).sort();
  if (keys.length === 0) return null;
  const { month, day } = getKyivDate(date);
  const todayKey = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  let found = keys.find((k) => k > todayKey);
  if (!found) found = keys[0];
  const [m, d] = found.split("-").map(Number);
  const dateLabel = `${d} ${MONTH_NAMES[m - 1]}`;
  return { dateLabel, items: HOLIDAYS[found] ?? [] };
}

/** Текст для посту в TG: один рядок з усіма святами на сьогодні. */
export function formatHolidaysForPost(items: HolidayItem[]): string {
  if (items.length === 0) return "";
  const lines = items.map((i) => (i.official ? `🇺🇦 ${i.title}` : `• ${i.title}`));
  return "Сьогодні — " + lines.join(". ");
}
