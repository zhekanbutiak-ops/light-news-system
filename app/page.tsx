"use client";
import React, { useState, useEffect, useCallback } from 'react';

interface Ad {
  id: number;
  text: string;
  type: 'RECLAMA' | 'NOTICE';
  expiresAt: number;
}

export default function Home() {
  const [time, setTime] = useState("");
  const [darkMode, setDarkMode] = useState(true);
  const [news, setNews] = useState<any[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Головне");
  const [isScrolled, setIsScrolled] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isAiMode, setIsAiMode] = useState(true); 
  const [aiResponse, setAiResponse] = useState("");
  const [showAiModal, setShowAiModal] = useState(false); // Стан для вікна AI

  const [markets, setMarkets] = useState({ 
    btc: 0, eth: 0, sol: 0, 
    usd: 0, gold: 0, silver: 0 
  });
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
      const xau = nbuData?.find((item: any) => item.cc === 'XAU')?.rate || 0;
      const xag = nbuData?.find((item: any) => item.cc === 'XAG')?.rate || 0;

      setMarkets({
        btc: cryptoData?.bitcoin?.usd || 0,
        eth: cryptoData?.ethereum?.usd || 0,
        sol: cryptoData?.solana?.usd || 0,
        usd: usd,
        gold: Math.round(xau / 31.1),
        silver: Math.round(xag / 31.1),
      });
    } catch (e) { console.warn("Markets offline"); }
  }, []);

  const fetchNews = useCallback(async (category: string) => {
    setIsLoadingNews(true);
    try {
      const response = await fetch(`/api/news?category=${encodeURIComponent(category)}`);
      const data = await response.json();
      if (data.items) {
        // Збільшуємо ліміт до 30 та додаємо унікальні ключі
        setNews(data.items.slice(0, 30).map((item: any, index: number) => ({
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
  }, []);

  useEffect(() => {
    fetchNews(activeCategory);
    fetchMarkets();
    const clock = setInterval(() => setTime(new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })), 1000);
    const statsInterval = setInterval(() => {
        setStats(prev => ({ ...prev, online: prev.online + (Math.random() > 0.5 ? 1 : -1) }));
    }, 5000);
    // Авто-оновлення новин кожні 5 хвилин
    const newsInterval = setInterval(() => fetchNews(activeCategory), 5 * 60 * 1000);

    const startDate = new Date("2022-02-24");
    setWarDay(Math.ceil(Math.abs(new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const handleScroll = () => setIsScrolled(window.scrollY > 120);
    const savedAds = localStorage.getItem('light_ads');
    if (savedAds) setAds(JSON.parse(savedAds));

    window.addEventListener("scroll", handleScroll);
    return () => {
        clearInterval(clock);
        clearInterval(statsInterval);
        clearInterval(newsInterval);
        window.removeEventListener("scroll", handleScroll);
    };
  }, [activeCategory, fetchNews, fetchMarkets, warDay]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    if (!isAiMode) {
      window.open(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, '_blank');
      return;
    }

    setAiResponse("Аналізую дані системи...");
    setShowAiModal(true);

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: searchQuery,
          context: { markets, newsCount: news.length, warDay } 
        }),
      });
      const data = await response.json();
      setAiResponse(data.text);
    } catch (e) {
      setAiResponse("Помилка підключення до LIGHT AI.");
    }
  };

  return (
    <div className={`${darkMode ? 'bg-[#0b0b0b] text-zinc-100' : 'bg-[#fcfcfc] text-zinc-900'} min-h-screen transition-colors duration-500 font-sans relative overflow-x-hidden`}>
      
      {/* AI RESPONSE MODAL */}
      {showAiModal && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 backdrop-blur-xl bg-black/40">
          <div className={`${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'} max-w-lg w-full p-8 rounded-[2.5rem] border shadow-2xl relative animate-in fade-in zoom-in duration-300`}>
            <div className="flex justify-between items-center mb-6">
              <span className="text-[10px] font-black uppercase tracking-widest text-red-600 animate-pulse">● LIGHT AI ANALYSIS</span>
              <button onClick={() => setShowAiModal(false)} className="text-[10px] font-bold opacity-40 hover:opacity-100 uppercase">Закрити</button>
            </div>
            <p className="text-lg font-bold italic leading-relaxed tracking-tight mb-8">"{aiResponse}"</p>
            <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-red-600 animate-[loading_2s_ease-in-out_infinite]"></div>
            </div>
          </div>
        </div>
      )}

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

      {/* HEADER SYSTEM */}
      <div className="sticky top-0 z-[1000] w-full">
        <div className={`${darkMode ? 'bg-zinc-900/95 border-zinc-800' : 'bg-black'} text-white py-2 border-b uppercase font-black text-[9px] tracking-[0.2em] backdrop-blur-md`}>
            <div className="max-w-[1440px] mx-auto px-6 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <span className="text-red-600 animate-pulse">● LIVE</span>
                    <span className="hidden md:inline">BTC: ${markets.btc.toLocaleString()}</span>
                    <span className="text-green-400">USD: {markets.usd.toFixed(2)}₴</span>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full shadow-[0_0_14px_rgba(250,204,21,0.6)]">
                      Рівень напруги: {tensionLevel}/10 ({tensionLabel})
                    </span>
                </div>
                <div className="flex gap-6 items-center">
                    <span className="opacity-60 font-mono">{time}</span>
                    <button onClick={() => setDarkMode(!darkMode)} className="border border-zinc-700 px-2 py-0.5 rounded text-[8px] hover:bg-red-600 transition-all uppercase">Theme</button>
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

        <div className={`${darkMode ? 'bg-[#0b0b0b]/90 border-zinc-800' : 'bg-[#fcfcfc]/95 border-zinc-200 shadow-md'} py-4 border-b backdrop-blur-md`}>
            <nav className="flex justify-center flex-wrap gap-2 md:gap-4 px-6">
                {["Головне", "🛡️ Фронт", "🇺🇦 Україна", "🌍 Світ", "💰 Економіка", "⚠️ Breaking"].map((cat) => (
                    <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${activeCategory === cat ? 'bg-red-600 text-white shadow-lg' : (darkMode ? 'bg-zinc-900' : 'bg-zinc-200')}`}>{cat}</button>
                ))}
                <button onClick={() => setShowAboutModal(true)} className="px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-all">Про нас</button>
            </nav>
        </div>
      </div>

      <header className={`pt-16 pb-10 text-center transition-all duration-700 ${isScrolled ? 'opacity-0 scale-95 pointer-events-none h-0 py-0 overflow-hidden' : 'opacity-100'}`}>
        <h1 onClick={() => setIsAiMode(!isAiMode)} className="text-[12vw] font-[1000] tracking-tighter leading-[0.85] mb-8 italic uppercase cursor-pointer select-none hover:tracking-normal transition-all duration-500">
          LIGHT<span className="text-red-600">{isAiMode ? 'AI' : 'FAST'}</span>
        </h1>
        
        <div className="max-w-xl mx-auto px-4">
          <form onSubmit={handleSearch} className="relative mb-6">
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={isAiMode ? "Запитай LIGHT AI..." : "Швидкий пошук у Google..."} className={`w-full py-5 px-8 rounded-full text-[11px] font-black uppercase tracking-widest outline-none border transition-all ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white shadow-2xl border-zinc-100 focus:border-red-600'}`} />
            {isAiMode && <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[8px] font-bold text-red-600 bg-red-600/10 px-2 py-1 rounded-full uppercase tracking-tighter animate-pulse">AI Active</span>}
          </form>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-12 gap-16">
          <div className="lg:col-span-8 space-y-16">
            {isLoadingNews ? (
              Array.from({ length: 6 }).map((_, i) => (
                <article key={`skeleton-${i}`} className="flex flex-col md:flex-row gap-8 items-start">
                  <div className="md:w-[320px] aspect-[16/10] bg-zinc-800/80 rounded-[2rem] shrink-0 animate-pulse" />
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
                <article key={item.id} className="group flex flex-col md:flex-row gap-8 items-start">
                  <div className="md:w-[320px] aspect-[16/10] bg-zinc-800 rounded-[2rem] overflow-hidden shrink-0 shadow-xl">
                    <img src={item.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt="news" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-red-600 font-black text-[9px] uppercase mb-2">{item.time} / {activeCategory}</span>
                    <h2 className="text-2xl font-[1000] leading-tight tracking-tighter mb-4 uppercase italic"><a href={item.link} target="_blank" rel="noopener noreferrer">{item.title}</a></h2>
                    <p className="text-sm opacity-50 italic line-clamp-2 leading-relaxed">{item.content}</p>
                  </div>
                </article>
              ))
            )}
          </div>

          <aside className="lg:col-span-4">
            <div className={`p-8 sticky top-52 rounded-[3.5rem] border ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100 shadow-2xl'}`}>
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
                        <div className={`p-5 rounded-[2.5rem] border ${darkMode ? 'bg-black/40 border-zinc-800' : 'bg-zinc-100 border-zinc-200'}`}>
                            <p className="text-[7px] font-black uppercase opacity-50 mb-3 text-center tracking-[0.2em]">Support Ukraine (UAH)</p>
                            <div className="relative mb-3">
                                <input type="number" value={donateAmount} onChange={(e) => setDonateAmount(e.target.value)} className={`w-full bg-transparent border-b border-red-600 text-center py-2 text-2xl font-black outline-none transition-all ${darkMode ? 'text-white' : 'text-black'}`} />
                                <span className="absolute right-0 bottom-2 text-[10px] font-bold opacity-20">₴</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mb-4">
                                {["50", "100", "500"].map(sum => (
                                    <button key={sum} onClick={() => setDonateAmount(sum)} className={`py-1.5 text-[9px] font-black rounded-xl border transition-all ${donateAmount === sum ? 'bg-red-600 border-red-600 text-white' : 'border-zinc-700 opacity-40 hover:opacity-100'}`}>{sum}</button>
                                ))}
                            </div>
                            <a href={`https://send.monobank.ua/3WbAugCy3w?a=${donateAmount}`} target="_blank" rel="noopener noreferrer" className="block w-full py-4 bg-red-600 text-white hover:bg-white hover:text-black rounded-2xl text-[10px] font-black text-center uppercase tracking-widest transition-all shadow-[0_10px_20px_rgba(220,38,38,0.2)] active:scale-95">Надіслати {donateAmount} ₴</a>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {ads.map((ad) => (
                          <div key={ad.id} className="p-4 rounded-2xl bg-zinc-500/5 border border-zinc-500/10 italic text-[11px]">{ad.text}</div>
                        ))}
                    </div>
                    <a href="https://t.me/lightnews13" target="_blank" rel="noopener noreferrer" className="block w-full bg-black text-white p-5 rounded-2xl text-center text-[10px] font-black uppercase italic hover:bg-red-600 transition-all shadow-xl">Telegram Channel</a>
                </div>
            </div>
          </aside>
        </div>
      </main>

      <footer className={`py-16 border-t ${darkMode ? 'border-zinc-800' : 'border-zinc-200'} relative`}>
          <div className="max-w-[1440px] mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
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
                  <p className="text-[7px] font-black uppercase tracking-[0.2em] opacity-30 italic">© 2026 LIGHT FAST SYSTEM. ALL RIGHTS RESERVED. NO BORDERS. NO LIMITS.</p>
              </div>
          </div>
      </footer>

      <style jsx global>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .animate-marquee { display: flex; animation: marquee 120s linear infinite; width: max-content; }
        .marquee-container { overflow: hidden; width: 100%; display: flex; }
      `}</style>
    </div>
  );
}