"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { signIn, signOut, useSession } from "next-auth/react";

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
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const { data: session } = useSession();

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
  const [stats, setStats] = useState({ online: 124, today: 4850, total: 128430 });
  const [tensionLevel, setTensionLevel] = useState(4);
  const [tensionLabel, setTensionLabel] = useState("Стабільно");

  const [donateAmount, setDonateAmount] = useState("100");

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
          title: item.title,
          link: item.link,
          content: (item.contentSnippet || item.content || "").slice(0, 450) + ((item.contentSnippet || item.content || "").length > 450 ? "..." : ""),
          fullText: item.contentSnippet || item.content || item.description || item.contentEncoded || "",
          image: item.enclosure?.url || `https://picsum.photos/seed/${encodeURIComponent(item.title)}/800/500`
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
    const handleScroll = () => {
      const y = window.scrollY;
      setHeaderCollapsed(y > 100);
      setShowBackToTop(y > 400);
    };
    window.addEventListener("scroll", handleScroll);
    (async () => {
      try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=50.45&longitude=30.52&current=temperature_2m&timezone=Europe/Kyiv');
        const data = await res.json();
        const t = data?.current?.temperature_2m;
        if (typeof t === 'number') setWeather(prev => ({ ...prev, temp: Math.round(t) }));
      } catch (_) { /* погода опційно */ }
    })();
    const statsInterval = setInterval(() => {
        setStats(prev => ({ ...prev, online: prev.online + (Math.random() > 0.5 ? 1 : -1) }));
    }, 5000);
    // Авто-оновлення новин кожні 5 хвилин
    const newsInterval = setInterval(() => fetchNews(activeCategory), 5 * 60 * 1000);

    const startDate = new Date("2022-02-24");
    setWarDay(Math.ceil(Math.abs(new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const savedAds = localStorage.getItem('light_ads');
    if (savedAds) setAds(JSON.parse(savedAds));

    return () => {
        clearInterval(clock);
        clearInterval(statsInterval);
        clearInterval(newsInterval);
        window.removeEventListener("scroll", handleScroll);
    };
  }, [activeCategory, fetchNews, fetchMarkets, warDay]);

  return (
    <div className={`${darkMode ? 'bg-[#0b0b0b] text-zinc-100' : 'bg-[#fcfcfc] text-zinc-900'} min-h-screen min-w-0 transition-colors duration-500 font-sans relative overflow-x-hidden`}>
      
      {showAboutModal && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 backdrop-blur-3xl bg-black/60">
          <div className={`${darkMode ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white text-black'} max-w-2xl w-full p-8 md:p-12 rounded-[3rem] border shadow-2xl relative overflow-hidden`}>
             <div className="absolute top-0 left-0 w-full h-2 bg-red-600"></div>
             <h2 className="text-4xl font-[1000] italic uppercase tracking-tighter mb-8">LIGHT <span className="text-red-600">MISSION</span></h2>
             <div className="space-y-6 text-sm md:text-base italic leading-relaxed opacity-90">
                <p><strong className="text-red-600 uppercase">LIGHT FAST</strong> — це перша в Україні повністю автономна інформаційна екосистема.</p>
                <p>Наш алгоритм працює за принципом <span className="text-red-600 font-bold">Absolute Autonomy</span>.</p>
             </div>
             <button onClick={() => setShowAboutModal(false)} className="w-full mt-10 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest">Зрозуміло</button>
          </div>
        </div>
      )}

      {/* HEADER SYSTEM: верхня смуга ховається при скролі, вірші + пункти залишаються */}
      <div className="sticky top-0 z-[1000] w-full pt-[env(safe-area-inset-top)]">
        <div className={`overflow-hidden transition-all duration-300 ease-out ${headerCollapsed ? 'max-h-0 opacity-0 py-0 border-b-0' : 'max-h-28 opacity-100'} ${darkMode ? 'bg-zinc-900/95 border-zinc-800' : 'bg-zinc-800'} text-zinc-300 border-b font-black text-[9px] tracking-[0.15em] backdrop-blur-md`}>
          <div className="py-2.5">
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 flex justify-between items-center flex-wrap gap-x-4 sm:gap-x-6 gap-y-1">
                <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                    {dateLine && <span className="uppercase">{dateLine}</span>}
                    <span>${markets.usd.toFixed(2)}</span>
                    <span>€{markets.eur.toFixed(2)}</span>
                    <span className="flex items-center gap-1.5">
                        <span className="opacity-80" aria-hidden>☁</span>
                        <span>{weather.temp != null ? `${weather.temp > 0 ? '+' : ''}${weather.temp}°` : '—°'}</span>
                        <span className="uppercase">{weather.city}</span>
                    </span>
                    <span className="text-red-500 animate-pulse">● LIVE</span>
                    <span className="text-[9px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full hidden sm:inline">Напруга: {tensionLevel}/10</span>
                </div>
                <div className="flex gap-2 sm:gap-3 md:gap-4 items-center">
                    <div className="flex items-center gap-1 sm:gap-2 text-zinc-500 [&_a]:p-1.5 sm:[&_a]:p-0.5 [&_a]:rounded [&_a:hover]:text-zinc-300 [&_svg]:w-4 [&_svg]:h-4 [&_a]:min-w-[44px] [&_a]:min-h-[44px] sm:[&_a]:min-w-0 sm:[&_a]:min-h-0 [&_a]:flex [&_a]:items-center [&_a]:justify-center">
                        <a href="#" title="Facebook" className="inline-flex"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>
                        <a href="#" title="YouTube" className="inline-flex"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg></a>
                        <a href="https://t.me/lightnews13" target="_blank" rel="noopener noreferrer" title="Наш канал в Telegram" className="inline-flex"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg></a>
                        <a href="#" title="Instagram" className="inline-flex"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.07 4.85c-.055 1.17-.249 1.805-.415 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.07-1.171-.055-1.806-.249-2.234-.415-.562-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.055-1.17.255-1.806.42-2.234.21-.562.479-.96.9-1.381.419-.419.824-.679 1.38-.9.42-.165 1.057-.359 2.235-.42 1.266-.045 1.646-.06 4.859-.06l.045.03zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg></a>
                        <a href="#" title="X (Twitter)" className="inline-flex"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
                    </div>
                    <span className="font-mono text-[10px] opacity-80">{time}</span>
                    <button onClick={() => setDarkMode(!darkMode)} className="border border-zinc-600 px-2 py-0.5 rounded text-[8px] hover:bg-zinc-600 transition-all uppercase">Theme</button>
                </div>
            </div>
          </div>
        </div>

        <div className={`${darkMode ? 'bg-zinc-900/90 border-zinc-800 text-zinc-500' : 'bg-zinc-100/95 border-zinc-200 text-zinc-600'} py-2 border-b overflow-hidden backdrop-blur-md`}>
            <div className="marquee-container flex whitespace-nowrap">
                <div className="animate-marquee flex">
                    {poems.concat(poems).map((poem, index) => <span key={index} className="mx-10 text-[9px] font-bold uppercase italic">{poem}</span>)}
                </div>
            </div>
        </div>

        <div className={`${darkMode ? 'bg-[#0b0b0b]/90 border-zinc-800' : 'bg-[#fcfcfc]/95 border-zinc-200 shadow-md'} py-3 sm:py-4 border-b backdrop-blur-md`}>
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-6">
                <div className="flex items-center justify-center sm:justify-start shrink-0">
                    <a href="/" className="flex items-center gap-2 group min-h-[44px]">
                        <span className={`text-xl sm:text-2xl font-black tracking-tighter uppercase italic transition-colors ${darkMode ? 'text-white group-hover:text-blue-400' : 'text-zinc-900 group-hover:text-blue-500'}`}>
                            Light<span className="text-blue-600">News</span>
                        </span>
                    </a>
                </div>
                <nav className="flex justify-center flex-wrap gap-2 md:gap-4">
                    {CATEGORIES.map(({ value, label, icon }) => (
                        <button
                            key={value}
                            onClick={() => setActiveCategory(value)}
                            className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 min-h-[44px] px-3 sm:px-4 py-2.5 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-widest transition-all touch-manipulation ${activeCategory === value ? 'bg-red-600 text-white shadow-lg shadow-red-900/30' : (darkMode ? 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 border border-zinc-700/50' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 border border-zinc-200')}`}
                        >
                            <span className="opacity-90">{icon}</span>
                            <span>{label}</span>
                        </button>
                    ))}
                    <button onClick={() => setShowAboutModal(true)} className="inline-flex items-center justify-center gap-2 min-h-[44px] px-3 sm:px-4 py-2.5 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-widest border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-all touch-manipulation">Про нас</button>
                </nav>
                <div className="flex items-center justify-center sm:justify-end gap-2 sm:gap-4 shrink-0">
                    {session ? (
                      <div className="flex items-center gap-4">
                        <span className={`text-sm font-medium truncate max-w-[120px] md:max-w-[180px] ${darkMode ? 'text-zinc-300' : 'text-zinc-700'}`} title={session.user?.name ?? undefined}>{session.user?.name}</span>
                        <button
                          type="button"
                          onClick={() => signOut()}
                          className="px-4 py-2 bg-red-500 text-white text-sm font-bold rounded-full hover:bg-red-600 transition"
                        >
                          Вийти
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => signIn()}
                          className="px-4 py-2 bg-white text-black text-sm font-bold rounded-full hover:bg-gray-200 transition"
                        >
                          Увійти
                        </button>
                        <button
                          type="button"
                          onClick={() => signIn()}
                          className={`px-4 py-2 text-sm font-bold rounded-full border-2 transition ${darkMode ? 'border-zinc-500 text-zinc-300 hover:border-white hover:text-white' : 'border-zinc-400 text-zinc-700 hover:border-zinc-600 hover:text-zinc-900'}`}
                        >
                          Реєстрація
                        </button>
                      </div>
                    )}
                </div>
            </div>
        </div>
      </div>

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8 sm:py-12 w-full min-w-0">
        <div className="grid lg:grid-cols-12 gap-8 sm:gap-16">
          <div className="lg:col-span-8 space-y-10 sm:space-y-16 min-w-0">
            {isLoadingNews ? (
              Array.from({ length: 6 }).map((_, i) => (
                <article key={`skeleton-${i}`} className="flex flex-col md:flex-row gap-6 sm:gap-8 items-start min-w-0">
                  <div className="w-full md:w-[320px] aspect-[16/10] bg-zinc-800/80 rounded-xl sm:rounded-[2rem] shrink-0 animate-pulse" />
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
                <article key={item.id} className="group flex flex-col md:flex-row gap-6 sm:gap-8 items-start min-w-0">
                  <div className="w-full md:w-[320px] aspect-[16/10] bg-zinc-800 rounded-xl sm:rounded-[2rem] overflow-hidden shrink-0 shadow-xl">
                    <img src={item.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt="" />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-red-600 font-black text-[9px] uppercase mb-2">{item.time} / {activeCategory}</span>
                    <h2 className="text-lg sm:text-2xl font-[1000] leading-tight tracking-tighter mb-3 sm:mb-4 uppercase italic"><a href={item.link} target="_blank" rel="noopener noreferrer" className="hover:underline">{item.title}</a></h2>
                    <p className="text-xs sm:text-sm opacity-50 italic line-clamp-2 leading-relaxed">{item.content}</p>
                  </div>
                </article>
              ))
            )}
          </div>

          <aside className="lg:col-span-4 min-w-0">
            <div className={`p-4 sm:p-6 md:p-8 lg:sticky lg:top-24 rounded-2xl sm:rounded-[3rem] border ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100 shadow-2xl'}`}>
                <div className="space-y-8">
                    <div className="space-y-4">
                        <p className="text-[10px] font-black uppercase opacity-30 italic border-b pb-2">Market Overview</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col"><span className="text-[8px] font-bold opacity-50 uppercase">BTC</span><span className="text-sm font-black">${markets.btc.toLocaleString()}</span></div>
                            <div className="flex flex-col"><span className="text-[8px] font-bold opacity-50 uppercase">USD/UAH</span><span className="text-sm font-black text-green-500">{markets.usd.toFixed(2)}₴</span></div>
                            <div className="flex flex-col"><span className="text-[8px] font-bold opacity-50 uppercase">Gold (1g)</span><span className="text-sm font-black">{markets.gold}₴</span></div>
                            <div className="flex flex-col"><span className="text-[8px] font-bold opacity-50 uppercase">Silver (1g)</span><span className="text-sm font-black">{markets.silver}₴</span></div>
                        </div>
                    </div>

                    {/* Віджет Мапи Тривог */}
                    <div className="mt-4 rounded-xl overflow-hidden border border-zinc-800 bg-[#09090b] p-3 shadow-lg">
                      <div className="flex items-center justify-between mb-3 px-1">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                          </span>
                          <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            Карта тривог
                          </h3>
                        </div>
                        <div className="text-[9px] text-zinc-600 font-mono">LIVE</div>
                      </div>

                      <div className="relative w-full aspect-square rounded-lg overflow-hidden border border-zinc-900">
                        <iframe 
                          src="https://alerts.in.ua/res/pwa.html" 
                          className="absolute inset-0 w-full h-full border-0 opacity-95 hover:opacity-100 transition-opacity duration-500 scale-[1.05]"
                          style={{ colorScheme: 'dark' }}
                          title="Alerts Map"
                        />
                      </div>

                      <div className="mt-2 px-1">
                        <a
                          href="https://alerts.in.ua/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[8px] text-zinc-700 hover:text-zinc-500 transition-colors block text-center uppercase tracking-tighter"
                        >
                          Джерело: alerts.in.ua
                        </a>
                      </div>
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
                                <input type="number" value={donateAmount} onChange={(e) => setDonateAmount(e.target.value)} className={`w-full bg-transparent border-b-2 border-red-600 text-center py-2 text-2xl font-black outline-none transition-all ${darkMode ? 'text-white' : 'text-black'}`} />
                                <span className="absolute right-0 bottom-2 text-[10px] font-bold opacity-30">₴</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mb-4">
                                {["50", "100", "500"].map(sum => (
                                    <button key={sum} onClick={() => setDonateAmount(sum)} className={`py-2 text-[9px] font-black rounded-xl border-2 transition-all ${donateAmount === sum ? 'bg-red-600 border-red-600 text-white' : (darkMode ? 'border-zinc-600 opacity-60 hover:opacity-100' : 'border-zinc-300 hover:border-zinc-500')}`}>{sum} ₴</button>
                                ))}
                            </div>
                            <a href={`https://send.monobank.ua/3WbAugCy3w?a=${donateAmount}`} target="_blank" rel="noopener noreferrer" className="block w-full py-4 min-h-[44px] flex items-center justify-center bg-red-600 text-white hover:bg-red-500 rounded-2xl text-[10px] font-black text-center uppercase tracking-widest transition-all shadow-lg active:scale-[0.98] touch-manipulation">Підтримати {donateAmount} ₴</a>
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
        className={`fixed z-[900] flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all duration-300 touch-manipulation right-4 sm:right-6 bottom-[max(1.5rem,env(safe-area-inset-bottom))] ${
          showBackToTop
            ? 'opacity-100 pointer-events-auto translate-y-0'
            : 'opacity-0 pointer-events-none translate-y-4'
        } ${darkMode ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-zinc-800 text-white hover:bg-zinc-700'}`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      </button>

      <footer className={`py-10 sm:py-16 border-t ${darkMode ? 'border-zinc-800' : 'border-zinc-200'} relative`}>
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 flex flex-col md:flex-row justify-between items-center gap-6 sm:gap-8">
              <div className="text-center md:text-left">
                  <h2 className="text-2xl font-[1000] italic mb-2 uppercase tracking-tighter">LIGHT<span className="text-red-600">NEWS</span></h2>
                  <p className="text-[8px] font-black uppercase tracking-[0.4em] opacity-40">Kyiv • 2026 • Global Terminal</p>
              </div>

              <div className="flex flex-col items-center md:items-end gap-2 text-right">
                  <div className="flex gap-4 mb-2">
                      <div className="text-center"><p className="text-[8px] font-bold opacity-40 uppercase">Online</p><p className="text-xs font-black text-green-500">{stats.online}</p></div>
                      <div className="text-center"><p className="text-[8px] font-bold opacity-40 uppercase">Today</p><p className="text-xs font-black">{stats.today}</p></div>
                      <div className="text-center"><p className="text-[8px] font-bold opacity-40 uppercase">Total</p><p className="text-xs font-black opacity-60">{stats.total}</p></div>
                  </div>
                  <p className="text-[7px] font-black uppercase tracking-[0.2em] opacity-30 italic">© 2026 Light News. Всі права захищені.</p>
              </div>
          </div>
      </footer>

      <style jsx global>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .animate-marquee { display: flex; animation: marquee 400s linear infinite; width: max-content; }
        .marquee-container { overflow: hidden; width: 100%; display: flex; }
      `}</style>
    </div>
  );
}