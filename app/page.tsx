"use client";
import React, { useState, useEffect, useCallback } from 'react';

interface Ad {
  id: number;
  text: string;
  type: 'RECLAMA' | 'NOTICE';
  expiresAt: number;
}

// Категорії з іконками (value — для API, label — текст, icon — SVG)
const CATEGORIES = [
  { value: "Головне", label: "Головне", icon: (<svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>) },
  { value: "🛡️ Фронт", label: "Фронт", icon: (<svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>) },
  { value: "🇺🇦 Україна", label: "Україна", icon: (<svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>) },
  { value: "🌍 Світ", label: "Світ", icon: (<svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>) },
  { value: "💰 Економіка", label: "Економіка", icon: (<svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>) },
  { value: "⚠️ Breaking", label: "Breaking", icon: (<svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>) },
];

export default function Home() {
  const [time, setTime] = useState("");
  const [darkMode, setDarkMode] = useState(true);
  const [news, setNews] = useState<any[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Головне");
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showSendNewsModal, setShowSendNewsModal] = useState(false);
  const [sendNewsTitle, setSendNewsTitle] = useState("");
  const [sendNewsText, setSendNewsText] = useState("");
  const [sendNewsLink, setSendNewsLink] = useState("");
  const [sendNewsLoading, setSendNewsLoading] = useState(false);
  const [sendNewsResult, setSendNewsResult] = useState<"ok" | "error" | null>(null);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const [markets, setMarkets] = useState({ 
    btc: 0, eth: 0, sol: 0, 
    usd: 0, eur: 0, gold: 0, silver: 0 
  });
  const [dateLine, setDateLine] = useState("");
  const [weather, setWeather] = useState<{ temp: number | null; city: string }>({ temp: null, city: "Київ" });
  const [warDay, setWarDay] = useState<number>(0);
  const [ads, setAds] = useState<Ad[]>([]);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [newAdText, setNewAdText] = useState("");
  const [stats, setStats] = useState({ online: null as number | null, today: 4850, total: 128430 });
  const visitorIdRef = React.useRef<string | null>(null);
  const [tensionLevel, setTensionLevel] = useState(4);
  const [tensionLabel, setTensionLabel] = useState("Стабільно");

  const [donateAmount, setDonateAmount] = useState("100");
  const [digest, setDigest] = useState<string | null>(null);
  const [digestLoading, setDigestLoading] = useState(false);

  const poems = [
    "Борітеся — поборете, Вам Бог помагає! За вас правда, за вас слава і воля святая! (Т. Шевченко)",
    "Я єсть народ, якого Правди сила ніким звойована ще не була. (П. Тичина)",
    "Contra spem spero! Без надії таки сподіваюсь... (Леся Українка)",
    "Лупайте сю скалу! Нехай ні жар, ні холод не спинить вас. (І. Франко)",
    "Народ мій є! Народ мій завжди буде! Ніхто не перекреслить мій народ! (В. Симоненко)",
    "Ми є. Були. І будем ми! Й Вітчизна наша з нами. (І. Багряний)",
    "Не бійся зазирати у каламутну воду, бійся не побачити в ній неба. (Л. Костенко)",
    "Любіть Україну, як сонце, любіть, як вітер, і трави, і води... (В. Сосюра)",
    "Кохайтеся, чорнобриві, та не з москалями. (Т. Шевченко)",
    "Своєї мови рідної і свого рідного звичаю не цурайся. (Г. Сковорода)",
    "Лиш боротись — значить жить! (І. Франко)",
    "Віддай людині крихітку себе. За це душа поповниться світлом. (Л. Костенко)",
    "Україна — це суперідея, яка об'єднує нас усіх. (В. Стус)",
    "Ті, що народжуються раз на століття, тримають небо на плечах. (В. Стус)",
    "Завжди бути собою — це перемога. (Л. Костенко)",
    "Хто не знає свого минулого, той не вартий майбутнього. (М. Рильський)",
    "Мова — це кров, що заздрісно тече в жилах нації. (О. Олесь)",
    "Боятися треба не смерті, а безцільного життя. (Г. Сковорода)",
    "Світ ловив мене, та не впіймав. (Г. Сковорода)",
    "Все йде, все минає... (Т. Шевченко)",
    "Шукай себе, а не те, що тобі кажуть шукати. (Г. Сковорода)",
    "Ми не маємо права на втому, поки ворог на нашій землі. (Сучасне)",
    "Воля — це не те, що тобі дали, а те, що в тебе неможливо відняти.",
    "Там, де є українці, там є воля. (І. Мазепа)",
    "Ми нація, яка навчилася посміхатися крізь вогонь.",
    "Не питай, що країна зробила для тебе, спитай, що ти зробив для неї.",
    "Кожен з нас — це фронт. Кожен з нас — це світло.",
    "Твоя хата не скраю, твоя хата — це фортеця.",
    "Свобода — це кисень для душі.",
    "Ми — не раби, ми — будівничі власної долі.",
    "Світло переможе темряву, як день перемагає ніч.",
    "Будь вартою свого імені. Будь вартою своєї землі.",
    "Сила не в зброї, сила в правді, яка за нами.",
    "Не чекай змін — будь зміною. (Г. Сковорода)",
    "Ми пишемо історію кров'ю та волею.",
    "Кожна новина — це крок до перемоги або урок для майбутнього.",
    "LIGHT — це система, яка бачить правду в темряві.",
    "Інформація — це зброя. Користуйся нею мудро.",
    "Правда не буває зручною, але вона завжди необхідна.",
    "Ми будуємо майбутнє на фундаменті незламності.",
    "Україна — це серце, яке б'ється в ритмі волі.",
    "Не зупиняйся, поки не дійдеш. Не здавайся, поки не переможеш.",
    "Ти — світло у цьому світі. Не дай нікому його загасити.",
    "Наша сила в єдності, наш шлях — до зірок.",
    "Ми вистояли тоді, вистоїмо і зараз.",
    "Пам'ятай, хто ти. Пам'ятай, за що ми боремося.",
    "Герої не вмирають, вони стають легендами.",
    "Слава Україні! — це не просто слова, це присяга.",
    "Україна починається з тебе. (В. Чорновіл)",
    "Свобода — це відповідальність перед майбутнім."
  ];

  const fetchMarkets = useCallback(async () => {
    try {
      const cryptoRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd');
      const cryptoData = await cryptoRes.json();
      const nbuRes = await fetch('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json');
      const nbuData = await nbuRes.json();
      const usd = nbuData?.find((item: any) => item.cc === 'USD')?.rate || 0;
      const eur = nbuData?.find((item: any) => item.cc === 'EUR')?.rate || 0;
      const xau = nbuData?.find((item: any) => item.cc === 'XAU')?.rate || 0;
      const xag = nbuData?.find((item: any) => item.cc === 'XAG')?.rate || 0;

      setMarkets({
        btc: cryptoData?.bitcoin?.usd || 0,
        eth: cryptoData?.ethereum?.usd || 0,
        sol: cryptoData?.solana?.usd || 0,
        usd,
        eur,
        gold: Math.round(xau / 31.1),
        silver: Math.round(xag / 31.1),
      });
    } catch (e) { console.warn("Markets offline"); }
  }, []);

  // Ключові слова для оцінки інформаційної напруги з заголовків новин
  const TENSION_KEYWORDS = [
    "тривога", "повітряна", "ракети", "атака", "обстріл", "обстріли", "ворог", "удари", "бойові",
    "фронт", "ракетний", "дрони", "безпілотник", "збито", "вторгнення", "наступ", "бой", "загибли"
  ];

  const computeTensionFromNews = useCallback((items: { title?: string; contentSnippet?: string }[]) => {
    if (!items?.length) return { level: 3, label: "Помірно" };
    const text = items.map(i => `${i.title || ""} ${i.contentSnippet || ""}`).join(" ").toLowerCase();
    let count = 0;
    for (const kw of TENSION_KEYWORDS) {
      const matches = text.split(kw).length - 1;
      if (matches > 0) count += Math.min(matches, 3);
    }
    const level = Math.min(10, Math.max(1, Math.round(1 + count * 0.8)));
    const labels: Record<number, string> = {
      1: "Спокійно", 2: "Спокійно", 3: "Помірно", 4: "Помірно",
      5: "Підвищено", 6: "Підвищено", 7: "Висока", 8: "Висока", 9: "Критично", 10: "Критично"
    };
    return { level, label: labels[level] || "Помірно" };
  }, []);

  const fetchNews = useCallback(async (category: string) => {
    setIsLoadingNews(true);
    try {
      const response = await fetch(`/api/news?category=${encodeURIComponent(category)}`);
      const data = await response.json();
      if (data.items) {
        const items = data.items.slice(0, 30);
        const { level, label } = computeTensionFromNews(items);
        setTensionLevel(level);
        setTensionLabel(label);
        setNews(items.map((item: any, index: number) => ({
          id: `${category}-${index}-${Date.now()}`,
          time: item.pubDate ? new Date(item.pubDate).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : "--:--",
          pubDateIso: item.pubDate ? new Date(item.pubDate).toISOString() : null,
          title: item.title,
          link: item.link,
          content: (item.contentSnippet || item.content || "").slice(0, 450) + ((item.contentSnippet || item.content || "").length > 450 ? "..." : ""),
          fullText: item.contentSnippet || item.content || item.description || item.contentEncoded || "",
          image: item.imageUrl ? (item.imageUrl.startsWith('http') ? (item.imageUrl.startsWith('http://') ? item.imageUrl.replace('http://', 'https://') : item.imageUrl) : item.imageUrl) : null
        })));
      }
    } catch (e) {
      console.error("Помилка завантаження", e);
    } finally {
      setIsLoadingNews(false);
    }
  }, [computeTensionFromNews]);

  useEffect(() => {
    fetchNews(activeCategory);
    fetchMarkets();
    const updateClock = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      const w = now.toLocaleDateString('uk-UA', { weekday: 'short' });
      setDateLine(`${w.slice(0, 2).toUpperCase()}, ${now.getDate()} ${now.toLocaleDateString('uk-UA', { month: 'long' })}`);
    };
    updateClock();
    const clock = setInterval(updateClock, 1000);
    // Гістерезис: згортати лише після 160px, розгортати лише нижче 50px — щоб панель не стрибала при одному прокруті
    const handleScroll = () => {
      const y = window.scrollY;
      setHeaderCollapsed((prev) => (y > 160 ? true : y < 50 ? false : prev));
      setShowBackToTop(y > 400);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    (async () => {
      try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=50.45&longitude=30.52&current=temperature_2m&timezone=Europe/Kyiv');
        const data = await res.json();
        const t = data?.current?.temperature_2m;
        if (typeof t === 'number') setWeather(prev => ({ ...prev, temp: Math.round(t) }));
      } catch (_) { /* погода опційно */ }
    })();
    // Авто-оновлення новин кожні 3 хв і при поверненні на вкладку
    const newsInterval = setInterval(() => fetchNews(activeCategory), 3 * 60 * 1000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchNews(activeCategory);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const startDate = new Date("2022-02-24");
    setWarDay(Math.ceil(Math.abs(new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const savedAds = localStorage.getItem('light_ads');
    if (savedAds) setAds(JSON.parse(savedAds));

    return () => {
        clearInterval(clock);
        clearInterval(newsInterval);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        window.removeEventListener("scroll", handleScroll);
    };
  }, [activeCategory, fetchNews, fetchMarkets, warDay]);

  // Унікальний id відвідувача (один раз при монті)
  useEffect(() => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) visitorIdRef.current = crypto.randomUUID();
  }, []);

  // Пульс "я на сайті" кожні 50 с (для підрахунку онлайн)
  useEffect(() => {
    const id = visitorIdRef.current;
    if (!id) return;
    const sendPulse = () => {
      fetch("/api/online", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => {});
    };
    sendPulse();
    const t = setInterval(sendPulse, 50 * 1000);
    return () => clearInterval(t);
  }, []);

  // Отримуємо кількість онлайн з API кожні 25 с
  useEffect(() => {
    const fetchOnline = () => {
      fetch("/api/online")
        .then((r) => r.json())
        .then((data) => {
          if (typeof data?.online === "number") setStats((prev) => ({ ...prev, online: data.online }));
        })
        .catch(() => {});
    };
    fetchOnline();
    const t = setInterval(fetchOnline, 25 * 1000);
    return () => clearInterval(t);
  }, []);

  const DIGEST_FALLBACK = 'Головне: актуальні події за сьогоднішніми заголовками.';

  // AI-дайджест: одне речення з поточних заголовків
  useEffect(() => {
    if (news.length < 3) {
      setDigest(null);
      return;
    }
    const headlines = news.slice(0, 10).map((n) => n.title).filter(Boolean);
    setDigestLoading(true);
    setDigest(null);
    fetch('/api/digest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headlines }),
    })
      .then((r) => r.json())
      .then((data) => {
        setDigest(typeof data?.digest === 'string' ? data.digest : DIGEST_FALLBACK);
      })
      .catch(() => {
        setDigest(DIGEST_FALLBACK);
      })
      .finally(() => setDigestLoading(false));
  }, [activeCategory, news.length, news.slice(0, 5).map((n) => n.title).join('|')]);

  return (
    <div className={`${darkMode ? 'bg-[#0b0b0b] text-zinc-100' : 'bg-[#fcfcfc] text-zinc-900'} min-h-[100dvh] min-h-screen min-w-0 transition-colors duration-500 font-sans relative pb-[env(safe-area-inset-bottom)]`}>
      
      {showAboutModal && (
        <div className="fixed inset-0 z-[5000] flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] backdrop-blur-3xl bg-black/60">
          <div className={`${darkMode ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white text-black'} max-w-2xl w-full max-h-[90dvh] max-h-[90vh] overflow-y-auto overflow-x-hidden overscroll-contain p-6 sm:p-8 md:p-12 rounded-t-[2rem] sm:rounded-[3rem] border shadow-2xl relative`}>
             <div className="absolute top-0 left-0 w-full h-2 bg-red-600 rounded-t-[2rem] sm:rounded-none"></div>
             <h2 className="text-3xl sm:text-4xl font-[1000] italic uppercase tracking-tighter mb-6 sm:mb-8">Про <span className="text-red-600">нас</span></h2>
             <div className="space-y-5 text-[15px] sm:text-sm md:text-base leading-relaxed opacity-90">
                <p><strong className="text-red-600">Light News</strong> — це агрегатор новин з перевірених джерел: головні події, фронт, Україна, світ, економіка та breaking-новини в одному місці.</p>
                <p>Ми публікуємо дайджести в Telegram-каналі та інтегруємо тривоги ППО РАДАР. Кожен може запропонувати новину через форму на сайті — звернення надходять безпосередньо редакції.</p>
                <p className="text-[13px] opacity-80">Проєкт існує завдяки підтримці читачів. Дякуємо, що залишаєтесь з нами.</p>
             </div>
             <button onClick={() => setShowAboutModal(false)} className="w-full mt-8 sm:mt-10 py-4 min-h-[52px] bg-red-600 text-white rounded-2xl font-black uppercase text-[12px] sm:text-[10px] tracking-widest touch-manipulation active:opacity-90">Зрозуміло</button>
          </div>
        </div>
      )}

      {showSendNewsModal && (
        <div className="fixed inset-0 z-[5000] flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] backdrop-blur-3xl bg-black/60" onClick={() => !sendNewsLoading && setShowSendNewsModal(false)}>
          <div className={`${darkMode ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white text-black'} max-w-2xl w-full max-h-[90dvh] max-h-[90vh] overflow-y-auto overflow-x-hidden overscroll-contain p-6 sm:p-8 md:p-12 rounded-t-[2rem] sm:rounded-[3rem] border shadow-2xl relative`} onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 left-0 w-full h-2 bg-blue-600 rounded-t-[2rem] sm:rounded-none"></div>
            <h2 className="text-2xl sm:text-3xl font-[1000] italic uppercase tracking-tighter mb-2">Надіслати <span className="text-blue-600">новину</span></h2>
            <p className="text-[11px] sm:text-[10px] opacity-70 mb-6">Звернення анонімне і надходить напряму адміну в особисті, у канал не публікується. Заповніть заголовок або текст (посилання — за бажанням).</p>
            {sendNewsResult === "ok" ? (
              <div className="py-6 text-center">
                <p className="text-green-600 font-bold text-sm mb-4">Повідомлення надіслано. Дякуємо!</p>
                <button type="button" onClick={() => { setShowSendNewsModal(false); setSendNewsResult(null); setSendNewsTitle(""); setSendNewsText(""); setSendNewsLink(""); }} className="w-full py-3 min-h-[48px] bg-zinc-600 hover:bg-zinc-500 text-white rounded-xl font-black uppercase text-[11px] tracking-wider">Закрити</button>
              </div>
            ) : (
              <form onSubmit={async (e) => {
                e.preventDefault();
                setSendNewsLoading(true);
                setSendNewsResult(null);
                try {
                  const res = await fetch("/api/send-news", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title: sendNewsTitle, text: sendNewsText, link: sendNewsLink || undefined }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (res.ok) setSendNewsResult("ok"); else setSendNewsResult("error");
                } catch {
                  setSendNewsResult("error");
                } finally {
                  setSendNewsLoading(false);
                }
              }} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider opacity-80 mb-1.5">Заголовок</label>
                  <input type="text" value={sendNewsTitle} onChange={e => setSendNewsTitle(e.target.value)} placeholder="Короткий заголовок новини" className={`w-full px-4 py-3 rounded-xl border text-sm min-h-[48px] outline-none transition-colors ${darkMode ? 'bg-zinc-800 border-zinc-700 placeholder:text-zinc-500' : 'bg-zinc-100 border-zinc-200 placeholder:text-zinc-400'}`} />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider opacity-80 mb-1.5">Текст (або посилання на джерело)</label>
                  <textarea value={sendNewsText} onChange={e => setSendNewsText(e.target.value)} placeholder="Опис або посилання" rows={3} className={`w-full px-4 py-3 rounded-xl border text-sm resize-y outline-none transition-colors ${darkMode ? 'bg-zinc-800 border-zinc-700 placeholder:text-zinc-500' : 'bg-zinc-100 border-zinc-200 placeholder:text-zinc-400'}`} />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider opacity-80 mb-1.5">Посилання (необов’язково)</label>
                  <input type="url" value={sendNewsLink} onChange={e => setSendNewsLink(e.target.value)} placeholder="https://..." className={`w-full px-4 py-3 rounded-xl border text-sm min-h-[44px] outline-none transition-colors ${darkMode ? 'bg-zinc-800 border-zinc-700 placeholder:text-zinc-500' : 'bg-zinc-100 border-zinc-200 placeholder:text-zinc-400'}`} />
                </div>
                {sendNewsResult === "error" && <p className="text-red-500 text-[11px]">Не вдалося надіслати. Спробуйте пізніше або напишіть у Telegram.</p>}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button type="submit" disabled={sendNewsLoading || (!sendNewsTitle.trim() && !sendNewsText.trim())} className="flex-1 py-4 min-h-[52px] bg-blue-600 text-white rounded-2xl font-black uppercase text-[12px] sm:text-[10px] tracking-widest touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-500 active:opacity-90">
                    {sendNewsLoading ? "Надсилання…" : "Надіслати"}
                  </button>
                  <button type="button" onClick={() => setShowSendNewsModal(false)} className="py-4 min-h-[52px] px-6 rounded-2xl font-black uppercase text-[11px] border-2 border-zinc-500 text-zinc-500 hover:bg-zinc-500/10 transition-all touch-manipulation">Скасувати</button>
                </div>
                {process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME && (
                  <p className="text-[11px] opacity-70 pt-2 border-t border-zinc-700">
                    Або напишіть напряму в Telegram:{" "}
                    <a href={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline font-medium">@{process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}</a>
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      )}

      {/* HEADER: sticky — не обгортати в overflow (Safari iOS інакше ламає) */}
      <div className="sticky top-0 z-[1000] w-full pt-[env(safe-area-inset-top)]">
        <div
          className={`overflow-hidden transition-[max-height,opacity,border-color] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${headerCollapsed ? 'max-h-0 opacity-0 border-b-0' : 'max-h-28 opacity-100'} ${darkMode ? 'bg-zinc-900/95 border-zinc-800' : 'bg-zinc-800'} text-zinc-300 border-b font-black tracking-[0.15em] backdrop-blur-md`}
          style={{ willChange: headerCollapsed ? 'max-height' : 'auto' }}
        >
          <div className="py-3 sm:py-2.5">
            <div className="max-w-[1440px] mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 flex justify-between items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 overflow-x-auto scrollbar-hide text-[10px] sm:text-[9px] [scrollbar-width:none] [-ms-overflow-style:none]">
                    {dateLine && <span className="uppercase shrink-0">{dateLine}</span>}
                    <span className="shrink-0">${markets.usd.toFixed(2)}</span>
                    <span className="shrink-0">€{markets.eur.toFixed(2)}</span>
                    <span className="shrink-0 hidden min-[400px]:inline">BTC ${markets.btc.toLocaleString()}</span>
                    <span className="shrink-0">Au {markets.gold}₴</span>
                    <span className="shrink-0 hidden sm:inline">Ag {markets.silver}₴</span>
                    <span className="flex items-center gap-1.5 shrink-0">
                        <span className="opacity-80" aria-hidden>☁</span>
                        <span>{weather.temp != null ? `${weather.temp > 0 ? '+' : ''}${weather.temp}°` : '—°'}</span>
                        <span className="uppercase">{weather.city}</span>
                    </span>
                    <span className="text-red-500 animate-pulse shrink-0">● LIVE</span>
                    <span className="text-[9px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full hidden sm:inline shrink-0">Напруга: {tensionLevel}/10</span>
                </div>
                <div className="flex gap-2 sm:gap-3 md:gap-4 items-center shrink-0">
                    <div className="flex items-center gap-1 sm:gap-2 text-zinc-500 [&_a]:p-1.5 sm:[&_a]:p-0.5 [&_a]:rounded [&_a:hover]:text-zinc-300 [&_svg]:w-4 [&_svg]:h-4 [&_a]:min-w-[44px] [&_a]:min-h-[44px] sm:[&_a]:min-w-0 sm:[&_a]:min-h-0 [&_a]:flex [&_a]:items-center [&_a]:justify-center">
                        <a href="#" title="Facebook" className="inline-flex"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>
                        {/* YouTube, Instagram, X — приховано, поки немає контенту */}
                        <a href="#" title="YouTube" className="!hidden" aria-hidden><svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg></a>
                        <a href="https://t.me/lightnews13" target="_blank" rel="noopener noreferrer" title="Наш канал в Telegram" className="inline-flex"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg></a>
                        <a href="#" title="Instagram" className="!hidden" aria-hidden><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.07 4.85c-.055 1.17-.249 1.805-.415 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.07-1.171-.055-1.806-.249-2.234-.415-.562-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.055-1.17.255-1.806.42-2.234.21-.562.479-.96.9-1.381.419-.419.824-.679 1.38-.9.42-.165 1.057-.359 2.235-.42 1.266-.045 1.646-.06 4.859-.06l.045.03zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg></a>
                        <a href="#" title="X (Twitter)" className="!hidden" aria-hidden><svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
                    </div>
                    <span className="font-mono text-[10px] opacity-80">{time}</span>
                    <button onClick={() => setDarkMode(!darkMode)} className="border border-zinc-600 px-3 py-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[10px] hover:bg-zinc-600 transition-all uppercase touch-manipulation">Theme</button>
                </div>
            </div>
          </div>
        </div>

        <div aria-hidden="true" className={`${darkMode ? 'bg-zinc-900/90 border-zinc-800 text-zinc-500' : 'bg-zinc-100/95 border-zinc-200 text-zinc-600'} py-3 sm:py-2 border-b overflow-hidden backdrop-blur-md pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] transition-[transform,opacity] duration-300 ease-out`} style={{ willChange: 'transform' }}>
            <div className="marquee-container flex whitespace-nowrap">
                <div className="animate-marquee flex">
                    {poems.concat(poems).map((poem, index) => <span key={index} className="mx-4 sm:mx-10 text-[9px] sm:text-[9px] font-bold uppercase italic">{poem}</span>)}
                </div>
            </div>
        </div>

        <div className={`${darkMode ? 'bg-[#0b0b0b]/90 border-zinc-800' : 'bg-[#fcfcfc]/95 border-zinc-200 shadow-md'} py-2 sm:py-2.5 border-b backdrop-blur-md transition-[transform,opacity] duration-300 ease-out`} style={{ willChange: 'transform' }}>
            <div className="max-w-[1440px] mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-4">
                {/* Мобільний: лого + дві кнопки в один ряд; десктоп — лише лого */}
                <div className="flex items-center justify-between sm:justify-start shrink-0 gap-2">
                    <a href="/" className="flex items-center gap-1.5 group min-h-[36px] sm:min-h-[38px] py-1" aria-label="Light News — на головну">
                        <span className={`text-base sm:text-xl font-black tracking-tighter uppercase italic transition-colors ${darkMode ? 'text-white group-hover:text-blue-400' : 'text-zinc-900 group-hover:text-blue-500'}`}>
                            Light<span className="text-blue-600">News</span>
                        </span>
                    </a>
                    <div className="flex sm:hidden items-center gap-1">
                        <button onClick={() => setShowSendNewsModal(true)} className="inline-flex items-center justify-center min-h-[32px] px-2.5 rounded-lg text-[9px] font-bold uppercase tracking-wide border border-blue-600 text-blue-600 touch-manipulation">Новину</button>
                        <button onClick={() => setShowAboutModal(true)} className="inline-flex items-center justify-center min-h-[32px] px-2.5 rounded-lg text-[9px] font-bold uppercase tracking-wide border border-red-600 text-red-600 touch-manipulation">Про нас</button>
                    </div>
                </div>
                {/* Розділи: на мобільному — один ряд з горизонтальним скролом (компактно); на sm+ — wrap */}
                <nav className="flex w-full min-w-0 py-0.5">
                    <div className="flex sm:flex-wrap items-center gap-1.5 sm:gap-1 md:gap-2 min-w-0 w-full overflow-x-auto sm:overflow-visible justify-start sm:justify-center scrollbar-hide [scrollbar-width:none] [-ms-overflow-style:none] pb-0.5">
                    {CATEGORIES.map(({ value, label, icon }) => (
                        <button
                            key={value}
                            onClick={() => setActiveCategory(value)}
                            className={`inline-flex items-center justify-center gap-1 min-h-[32px] sm:min-h-[34px] px-2.5 sm:px-3 py-1.5 sm:py-1 rounded-full text-[9px] sm:text-[8px] font-black uppercase tracking-wider transition-all touch-manipulation shrink-0 ${activeCategory === value ? 'bg-red-600 text-white shadow-md shadow-red-900/20' : (darkMode ? 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 border border-zinc-700/50' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 border border-zinc-200')}`}
                        >
                            <span className="opacity-90 shrink-0 [&_svg]:w-3 [&_svg]:h-3 sm:[&_svg]:w-3 sm:[&_svg]:h-3">{icon}</span>
                            <span className="whitespace-nowrap">{label}</span>
                        </button>
                    ))}
                    <button onClick={() => setShowSendNewsModal(true)} className="hidden sm:inline-flex items-center justify-center gap-1 min-h-[34px] px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-wider border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white transition-all touch-manipulation shrink-0 whitespace-nowrap">Надіслати новину</button>
                    <button onClick={() => setShowAboutModal(true)} className="hidden sm:inline-flex items-center justify-center gap-1 min-h-[34px] px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-wider border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-all touch-manipulation shrink-0 whitespace-nowrap">Про нас</button>
                    </div>
                </nav>
            </div>
        </div>
      </div>

      <main className="max-w-[1440px] mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 py-6 sm:py-12 pb-36 sm:pb-12 w-full min-w-0 overflow-x-hidden">
        <div className="grid lg:grid-cols-12 gap-8 sm:gap-16 min-w-0">
          <div className="lg:col-span-8 space-y-10 sm:space-y-16 min-w-0">
            <h1 className="sr-only">Головні новини України — Light News: фронт, економіка, світ</h1>
            {isLoadingNews ? (
              Array.from({ length: 6 }).map((_, i) => (
                <article key={`skeleton-${i}`} className="flex flex-col md:flex-row gap-4 sm:gap-8 items-start min-w-0">
                  <div className="w-full md:w-[320px] aspect-[16/10] bg-zinc-800/80 rounded-2xl sm:rounded-[2rem] shrink-0 animate-pulse" />
                  <div className="flex-1 space-y-3">
                    <div className="h-3 w-20 bg-zinc-700/60 rounded animate-pulse" />
                    <div className="h-7 w-full max-w-md bg-zinc-700/60 rounded animate-pulse" />
                    <div className="h-4 w-full bg-zinc-700/40 rounded animate-pulse" />
                    <div className="h-4 w-3/4 bg-zinc-700/40 rounded animate-pulse" />
                    <div className="h-9 w-32 bg-zinc-700/50 rounded-lg animate-pulse mt-4" />
                  </div>
                </article>
              ))
            ) : (
              news.map((item) => (
                <article key={item.id} className="group flex flex-col md:flex-row gap-4 sm:gap-8 items-start min-w-0">
                  <a href={item.link} target="_blank" rel="noopener noreferrer" className="w-full md:w-[320px] aspect-[16/10] bg-zinc-800 rounded-2xl sm:rounded-[2rem] overflow-hidden shrink-0 shadow-lg active:opacity-90 transition-opacity block">
                    {item.image ? (
                      <img src={item.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-700/80">
                        <svg className="w-12 h-12 sm:w-14 sm:h-14 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" /></svg>
                      </div>
                    )}
                  </a>
                  <div className="flex flex-col min-w-0 flex-1 w-full">
                    <span className="text-red-600 font-black text-[11px] sm:text-[10px] uppercase mb-2">
                      {item.pubDateIso ? <time dateTime={item.pubDateIso}>{item.time}</time> : item.time} / {activeCategory}
                    </span>
                    <h2 className="text-base sm:text-2xl font-[1000] leading-snug sm:leading-tight tracking-tight sm:tracking-tighter mb-3 sm:mb-4 uppercase italic">
                      <a href={item.link} target="_blank" rel="noopener noreferrer" className="hover:underline active:opacity-80 block py-1 -my-1">
                        {item.title}
                      </a>
                    </h2>
                    <p className="text-[15px] sm:text-sm opacity-70 sm:opacity-60 italic line-clamp-2 leading-relaxed">{item.content}</p>
                    <a
                      href="https://t.me/lightnews13"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`mt-4 inline-flex items-center justify-center gap-2 self-start min-h-[44px] px-5 py-3 rounded-full text-[12px] sm:text-[11px] font-semibold uppercase tracking-wide transition-all duration-200 border focus:outline-none focus:ring-2 focus:ring-[#2AABEE]/30 focus:ring-offset-2 touch-manipulation ${darkMode ? 'border-zinc-600/80 text-zinc-400 hover:border-[#2AABEE]/60 hover:text-[#2AABEE] hover:bg-[#2AABEE]/8 focus:ring-offset-zinc-900' : 'border-zinc-300 text-zinc-600 hover:border-[#2AABEE] hover:text-[#2AABEE] hover:bg-[#2AABEE]/5 focus:ring-offset-white'}`}
                      title="Підписатися на канал у Telegram"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                      </svg>
                      Підписатися на канал
                    </a>
                  </div>
                </article>
              ))
            )}
          </div>

          <aside className="lg:col-span-4 min-w-0">
            <div className={`p-5 sm:p-6 md:p-8 rounded-2xl sm:rounded-[3rem] border ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100 shadow-2xl'}`}>
                <div className="space-y-8">
                    {/* Ресурси — офіційні держ установ та сервіси */}
                    <div className="border-b border-zinc-800 pb-4">
                      <p className="text-[10px] sm:text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-3">Офіційні джерела</p>
                      <nav className="flex flex-col gap-0">
                        <a href="https://alerts.in.ua/lite" target="_blank" rel="noopener noreferrer" className={`text-[13px] sm:text-[11px] font-medium uppercase tracking-wide border-l-2 pl-3 py-3 sm:py-1.5 -ml-px min-h-[44px] sm:min-h-0 flex items-center transition-colors ${darkMode ? 'border-zinc-700 text-zinc-400 hover:border-red-600 hover:text-zinc-200' : 'border-zinc-300 text-zinc-600 hover:border-red-500 hover:text-zinc-900'}`}>
                          Карта тривог
                        </a>
                        <a href="https://www.bank.gov.ua/ua" target="_blank" rel="noopener noreferrer" className={`text-[13px] sm:text-[11px] font-medium uppercase tracking-wide border-l-2 pl-3 py-3 sm:py-1.5 -ml-px min-h-[44px] sm:min-h-0 flex items-center transition-colors ${darkMode ? 'border-zinc-700 text-zinc-400 hover:border-red-600 hover:text-zinc-200' : 'border-zinc-300 text-zinc-600 hover:border-red-500 hover:text-zinc-900'}`}>
                          НБУ
                        </a>
                        <a href="https://www.kmu.gov.ua" target="_blank" rel="noopener noreferrer" className={`text-[13px] sm:text-[11px] font-medium uppercase tracking-wide border-l-2 pl-3 py-3 sm:py-1.5 -ml-px min-h-[44px] sm:min-h-0 flex items-center transition-colors ${darkMode ? 'border-zinc-700 text-zinc-400 hover:border-red-600 hover:text-zinc-200' : 'border-zinc-300 text-zinc-600 hover:border-red-500 hover:text-zinc-900'}`}>
                          Уряд України
                        </a>
                        <a href="https://t.me/lightnews13" target="_blank" rel="noopener noreferrer" className={`text-[13px] sm:text-[11px] font-medium uppercase tracking-wide border-l-2 pl-3 py-3 sm:py-1.5 -ml-px min-h-[44px] sm:min-h-0 flex items-center transition-colors ${darkMode ? 'border-zinc-700 text-zinc-400 hover:border-red-600 hover:text-zinc-200' : 'border-zinc-300 text-zinc-600 hover:border-red-500 hover:text-zinc-900'}`}>
                          Telegram
                        </a>
                      </nav>
                    </div>

                    {/* Що в фокусі — AI-дайджест одним реченням */}
                    <div className="rounded-xl overflow-hidden border border-zinc-800 bg-[#0a0a0c] p-4 shadow-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-[11px] sm:text-[10px] font-black uppercase tracking-wider text-blue-500">
                          Що в фокусі
                        </h3>
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" aria-hidden />
                      </div>
                      {digestLoading && (
                        <p className="text-[11px] text-zinc-500 italic">Формуємо дайджест…</p>
                      )}
                      {!digestLoading && digest && (
                        <p className={`text-[14px] sm:text-[12px] leading-relaxed ${darkMode ? 'text-zinc-300' : 'text-zinc-700'}`}>
                          {digest}
                        </p>
                      )}
                      {!digestLoading && !digest && news.length >= 3 && (
                        <p className="text-[11px] text-zinc-500 italic">Не вдалося зформивати дайджест.</p>
                      )}
                      {!digestLoading && !digest && news.length < 3 && (
                        <p className="text-[11px] text-zinc-500 italic">Завантажте новини для дайджесту.</p>
                      )}
                      {digest && (
                        <p className="text-[10px] text-zinc-600 mt-2 italic">
                          На основі {Math.min(10, news.length)} джерел
                        </p>
                      )}
                    </div>

                    <div className="pt-6 border-t border-red-600/20 space-y-4">
                        <div className="text-center">
                            <p className="text-red-600 font-black text-[14px] italic animate-pulse uppercase">WAR DAY: {warDay}</p>
                        </div>
                        <div className={`p-5 sm:p-6 rounded-2xl sm:rounded-[2.5rem] border ${darkMode ? 'bg-zinc-900/60 border-zinc-700' : 'bg-zinc-50 border-zinc-200'}`}>
                            <div className="text-center mb-4">
                                <p className={`text-xl sm:text-2xl font-black tracking-tighter uppercase italic ${darkMode ? 'text-white' : 'text-zinc-900'}`}>
                                    Light<span className="text-blue-600">News</span>
                                </p>
                                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-600 mt-1">Підтримка проекту</p>
                                <p className="text-[11px] italic opacity-70 mt-3 leading-relaxed">Кожна гривня — це світло правди. Дякуємо, що робите новини разом з нами.</p>
                            </div>
                            <div className="relative mb-3">
                                <input type="number" value={donateAmount} onChange={(e) => setDonateAmount(e.target.value)} className={`w-full bg-transparent border-b-2 border-red-600 text-center py-3 sm:py-2 text-2xl sm:text-2xl font-black outline-none transition-all min-h-[48px] sm:min-h-0 ${darkMode ? 'text-white' : 'text-black'}`} />
                                <span className="absolute right-0 bottom-2 text-[10px] font-bold opacity-30">₴</span>
                            </div>
                            <div className="grid grid-cols-3 gap-3 mb-4">
                                {["50", "100", "500"].map(sum => (
                                    <button key={sum} onClick={() => setDonateAmount(sum)} className={`py-3 sm:py-2 min-h-[48px] sm:min-h-0 text-[12px] sm:text-[9px] font-black rounded-xl border-2 transition-all touch-manipulation ${donateAmount === sum ? 'bg-red-600 border-red-600 text-white' : (darkMode ? 'border-zinc-600 opacity-60 hover:opacity-100' : 'border-zinc-300 hover:border-zinc-500')}`}>{sum} ₴</button>
                                ))}
                            </div>
                            <a href={`https://send.monobank.ua/3WbAugCy3w?a=${donateAmount}`} target="_blank" rel="noopener noreferrer" className="block w-full py-4 min-h-[52px] sm:min-h-[44px] flex items-center justify-center bg-red-600 text-white hover:bg-red-500 rounded-2xl text-[12px] sm:text-[10px] font-black text-center uppercase tracking-widest transition-all shadow-lg active:scale-[0.98] touch-manipulation">Підтримати {donateAmount} ₴</a>
                        </div>
                    </div>

                </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Кнопка повернення вгору */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Повернутися вгору"
        className={`fixed z-[900] flex h-14 w-14 sm:h-12 sm:w-12 items-center justify-center rounded-full shadow-lg transition-all duration-300 touch-manipulation right-5 sm:right-6 bottom-[max(1.5rem,env(safe-area-inset-bottom))] ${
          showBackToTop
            ? 'opacity-100 pointer-events-auto translate-y-0'
            : 'opacity-0 pointer-events-none translate-y-4'
        } ${darkMode ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-zinc-800 text-white hover:bg-zinc-700'}`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      </button>

      <footer className={`py-12 sm:py-16 border-t ${darkMode ? 'border-zinc-800' : 'border-zinc-200'} relative pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]`}>
          <div className="max-w-[1440px] mx-auto px-0 sm:px-6 flex flex-col md:flex-row justify-between items-center gap-8 sm:gap-8">
              <div className="text-center md:text-left">
                  <h2 className="text-2xl sm:text-2xl font-[1000] italic mb-2 uppercase tracking-tighter">LIGHT<span className="text-red-600">NEWS</span></h2>
                  <p className="text-[10px] sm:text-[8px] font-black uppercase tracking-[0.4em] opacity-40">Kyiv • 2026 • Global Terminal</p>
              </div>

              <div className="flex flex-col items-center md:items-end gap-3 text-right">
                  <div className="flex gap-6 sm:gap-4 mb-0">
                      <div className="text-center"><p className="text-[10px] sm:text-[8px] font-bold opacity-40 uppercase">Online</p><p className="text-sm sm:text-xs font-black text-green-500">{stats.online !== null ? stats.online : "—"}</p></div>
                      <div className="text-center"><p className="text-[10px] sm:text-[8px] font-bold opacity-40 uppercase">Today</p><p className="text-sm sm:text-xs font-black">{stats.today}</p></div>
                      <div className="text-center"><p className="text-[10px] sm:text-[8px] font-bold opacity-40 uppercase">Total</p><p className="text-sm sm:text-xs font-black opacity-60">{stats.total}</p></div>
                  </div>
                  <p className="text-[9px] sm:text-[7px] font-black uppercase tracking-[0.2em] opacity-30 italic">© 2026 Light News. Всі права захищені.</p>
              </div>
          </div>
      </footer>

      <style jsx global>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .animate-marquee { display: flex; animation: marquee 400s linear infinite; width: max-content; }
        .marquee-container { overflow: hidden; width: 100%; display: flex; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}