"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { t } from "@/lib/i18n";
import { AlertTriangle, X } from "lucide-react";
import { bootstrap, subscribeAll, onDbError, DEMO_MODE } from "@/lib/db";
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
import "@/lib/datasets";
import "@/lib/invitesData";
import "@/lib/companyData";
import "@/lib/kpiData";
import "@/lib/npsData";
import "@/lib/kassaData";
import "@/lib/payoutsData";
import "@/lib/ratesData";
import { loadLocal } from "@/lib/datasets";

const DataCtx = createContext({ ready: DEMO_MODE, demo: DEMO_MODE, version: 0 });
export const useData = () => useContext(DataCtx);

// Ma'lumot bazadan bir marta yuklanadi va modullarning xotirasiga
// tushadi — shundan keyin barcha sahifalar ilgarigidek sinxron ishlaydi.
// Realtime hodisasi kelganda `version` o'zgaradi va daraxt qayta
// chiziladi (LangProvider va AuthProvider'dagi bilan bir xil naqsh).
export default function DataProvider({ children }) {
  const [ready, setReady] = useState(DEMO_MODE);
  const [version, setVersion] = useState(0);
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
    // Yuklangan hisobotlarni brauzer xotirasidan tiklaymiz — bu SQL
    // jadvaliga bog'liq emas, shuning uchun har doim ishlaydi
    loadLocal().then(() => alive && setVersion((v) => v + 1));
    // onBackground: og'ir jadvallar (savdo/tovar/mijoz) orqada
    // yuklanib bo'lgach bir marta interfeysni yangilaydi.
    bootstrap(() => alive && setVersion((v) => v + 1)).then((res) => {
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
    return () => { alive = false; stop(); off(); };
  }, [authReady, authed, user.id]);

  return (
    <DataCtx.Provider value={{ ready, demo: DEMO_MODE, version, stats }}>
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
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">{t("Bazaga yozilmadi")}</p>
            <p className="text-sm text-muted font-semibold break-words">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>
      )}

      <div key={version} className="contents">{children}</div>
    </DataCtx.Provider>
  );
}
