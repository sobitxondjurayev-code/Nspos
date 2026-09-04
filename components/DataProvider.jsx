"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { t } from "@/lib/i18n";
import { AlertTriangle, X } from "lucide-react";
import { bootstrap, subscribeAll, onDbError, onBackgroundReady, onXotira, DEMO_MODE } from "@/lib/db";
import { useAuth } from "@/components/AuthProvider";

// Barcha modullar o'zini db.js ga qayd qilishi uchun shu yerda
// import qilinadi — aks holda registerModule hech qachon chaqirilmaydi.
// Tartib muhim: do'konlar birinchi, chunki qolganlari store_id ga
// tayanadi (demo "s1" → bazadagi UUID almashtirishi shu yerda bo'ladi).
import "@/lib/storesData";
import "@/lib/productsData";
import "@/lib/customersData";
import "@/lib/salesData";
import "@/lib/debtsData";
import "@/lib/financeData";
import "@/lib/expensesData";
import "@/lib/shiftsData";
import "@/lib/staffData";
import "@/lib/payrollData";
import "@/lib/suppliersData";
import "@/lib/warehouseData";
import "@/lib/servicesData";
import "@/lib/shipmentsData";
import "@/lib/invitesData";
import "@/lib/companyData";
import "@/lib/kpiData";
import "@/lib/npsData";
// Ustalar reytingi — `kpi_day`/`nps_records` RLS usta uchun faqat
// O'Z qatorini beradi, shuning uchun reyting alohida ko'rinishdan
// o'qiydi (scripts/sql/usta-reyting.sql)
import "@/lib/installerBoard";
import "@/lib/kassaData";
import "@/lib/payoutsData";
import "@/lib/ratesData";
import "@/lib/billzLogData";
import "@/lib/transfersData";
import "@/lib/permsData";

const DataCtx = createContext({ ready: DEMO_MODE, demo: DEMO_MODE, version: 0 });
export const useData = () => useContext(DataCtx);

// Jonli yangilanish uchun: sahifa shu qiymatni memo bog'lamiga qo'shsa,
// boshqa xodim yozgan o'zgarish ham darrov ko'rinadi. Sahifa QAYTA
// CHIZILADI, lekin o'chirib-yoqilmaydi — ochiq oyna va holat saqlanadi.
export const useLive = () => useContext(DataCtx).version;

// Og'ir jadvallar yuklab bo'lindimi. Savdo/mijoz/qarz raqamini
// ko'rsatadigan sahifa shuni tekshirsin: `false` bo'lsa 0 emas,
// "yuklanmoqda" ko'rsatilsin.
export const useToliq = () => useContext(DataCtx).toliq;

// Ma'lumot bazadan bir marta yuklanadi va modullarning xotirasiga
// tushadi — shundan keyin barcha sahifalar ilgarigidek sinxron ishlaydi.
// Realtime hodisasi kelganda `version` o'zgaradi va daraxt qayta
// chiziladi (LangProvider va AuthProvider'dagi bilan bir xil naqsh).
export default function DataProvider({ children }) {
  const [ready, setReady] = useState(DEMO_MODE);
  const [version, setVersion] = useState(0);
  // Og'ir jadvallar (savdo 9 032, mijoz 9 097, qarz 11 530) fonda
  // ~25 soniya yuklanadi. Shu davrda sahifalar 0 ko'rsatadi —
  // ya'ni ISHONARLI YOLG'ON: rahbar "savdo yo'q" deb o'ylaydi.
  // `toliq` shu holatni bildiradi va sahifa 0 o'rniga "yuklanmoqda"
  // deb turadi (CLAUDE.md: xato bo'sh ekran emas, ishonarli yolg'on).
  const [toliq, setToliq] = useState(DEMO_MODE);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  // Sessiya aniqlanmaguncha so'ramaymiz: RLS kirmagan foydalanuvchiga
  // bo'sh natija qaytaradi va ilova "ma'lumot yo'q" deb ko'rsatardi
  const { ready: authReady, authed, user } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (!authReady) return;
    // Sessiya bo'lmasa (login sahifasi) ma'lumot so'ramaymiz
    if (!authed) { setReady(true); return; }
    let alive = true;
    // Og'ir jadvallar (savdo/tovar/mijoz) orqada yuklanib bo'lgach
    // interfeys bir marta yangilanadi.
    //
    // `alive` TEKSHIRILMAYDI: effekt qayta ishga tushsa (sahifa
    // almashgan, sessiya yangilangan) eski `alive` false bo'lib
    // qolardi va 10 soniyadan keyin kelgan xabar hech kimga
    // yetmasdi — bosh sahifa abadiy "0.00 USD" turardi. Obuna
    // effekt bilan birga bekor qilinadi (`ochirBg`), shuning
    // uchun qo'shimcha bayroq kerak emas.
    const ochirBg = onBackgroundReady(() => { setToliq(true); setVersion((v) => v + 1); });
    bootstrap().then((res) => {
      if (!alive) return;
      setReady(true);
      setVersion((v) => v + 1);
      // Jonli rejimda bitta ham qator kelmasa — bu jimgina o'tib
      // ketmasligi kerak: ekran "hammasi nol" bo'lib ko'rinadi va
      // sababini topib bo'lmaydi. Shuning uchun ochiq aytamiz.
      if (!res.demo && res.loaded === 0) {
        setError("Bazadan bitta ham qator kelmadi. Ehtimol sessiya yo'q yoki huquq yetmayapti.");
      } else if (res.report) {
        setStats(res.report.filter((r) => r.rows > 0));
      }
    });
    const stop = subscribeAll(() => setVersion((v) => v + 1));
    const off = onDbError(setError);
    // Baza yozuvni rad etib xotira orqaga qaytganda ham qayta chiziladi —
    // aks holda ekranda "saqlangan" turib, F5 da yo'qolardi
    const offXotira = onXotira(() => setVersion((v) => v + 1));
    return () => { alive = false; ochirBg(); stop(); off(); offXotira(); };
  }, [authReady, authed, user.id]);

  return (
    <DataCtx.Provider value={{ ready, demo: DEMO_MODE, version, stats, toliq }}>
      {!ready && pathname !== "/login" && (
        <div className="fixed inset-0 z-[100] bg-surface flex items-center justify-center">
          <div className="text-center">
            <span className="w-12 h-12 rounded-2xl bg-brand text-white flex items-center justify-center font-extrabold text-2xl mx-auto mb-4 animate-pulse">
              N
            </span>
            <p className="font-bold text-muted">{t("Ma'lumot yuklanmoqda…")}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-6 right-6 z-[110] card p-4 max-w-sm flex items-start gap-3 border-danger/40">
          <span className="w-9 h-9 rounded-xl bg-danger-soft text-danger flex items-center justify-center shrink-0">
            <AlertTriangle size={18} />
          </span>
          {/* Sessiya tugagani boshqa xatolardan farq qiladi: baza
              joyida, xodim shunchaki qaytadan kirishi kerak. Sarlavha
              ham, tugma ham shunga qarab beriladi — "Bazaga yozilmadi"
              deb turgan xabardan nima qilish kerakligi bilinmasdi. */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">
              {error.startsWith("Sessiya") ? t("Sessiya tugagan") : t("Bazaga yozilmadi")}
            </p>
            <p className="text-sm text-muted font-semibold break-words">{error}</p>
            {error.startsWith("Sessiya") && (
              <button
                onClick={() => { window.location.href = "/login"; }}
                className="mt-2 px-3 py-1.5 rounded-lg bg-brand text-white text-sm font-bold"
              >
                {t("Qaytadan kirish")}
              </button>
            )}
          </div>
          <button onClick={() => setError(null)} className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>
      )}

      {/* DIQQAT: bu yerda `key={version}` turgan edi — har realtime
          o'zgarishda kalit almashib, BUTUN sahifa qaytadan chizilardi.
          Natijada ochilgan xodim, filtr, oyna va yozayotgan matn
          yo'qolib, foydalanuvchi oldingi ekranga tashlanardi.
          Endi kalit faqat ikki holatda almashadi: birinchi yuklash
          tugaganda va foydalanuvchi almashganda. Jonli yangilanish esa
          `useLive()` orqali — u sahifani qayta chizadi, lekin
          o'chirib-yoqmaydi. */}
      <div key={`${ready ? "ready" : "load"}:${user?.id ?? "-"}`} className="contents">
        {children}
      </div>
    </DataCtx.Provider>
  );
}
