"use client";
// ══════════════════════════════════════════════════════════════
// "YANGILASH" — YON PANELDAGI QO'LDA TORTISH TUGMASI
// ══════════════════════════════════════════════════════════════
// Nega kerak: Billz ma'lumoti cron bilan har 30 daqiqada keladi.
// Menejer chek kesgandan keyin tizimga qaraydi va u yerda eski raqam
// turadi — ma'lumot kelmagani emas, HALI kelmagani. Buni tushuntirib
// bo'lmaydi, chunki ekranda hech qanday belgi yo'q: raqam "bor".
//
// Shuning uchun tugma tema tugmasi yonida, har sahifada ko'rinadi va
// HAR XODIMGA ochiq (server tomoni ham shunday — `api/billz/sync`
// dagi `chaqiruvchi()`). Xavfli parametrlar u yerda rahbarda qoldi.
//
// Uch qavat himoya — Billz sekundiga 2 so'rov beradi va shubhali IP'ni
// bloklaydi:
//   1. Bu oynada: `band` — tugma bosilib turganda ikkinchi bosish yo'q
//   2. Oynalar orasida: `localStorage` qulfi (`BillzAutoSync` bilan
//      AYNAN bir xil kalit — o'sha fayldan import qilinadi)
//   3. Serverda: oxirgi yangilanish 3 daqiqadan yangi bo'lsa Billz
//      umuman urilmaydi (`YAQINDA_MS`). Yakuniy qaror shu yerda —
//      brauzerdagi qulfni foydalanuvchi tozalab yuborishi mumkin.
import { useEffect, useState } from "react";
import { RefreshCw, LoaderCircle } from "lucide-react";
import { t } from "@/lib/i18n";
import { sessiyaOl } from "@/lib/sessiya";
import { DEMO_MODE } from "@/lib/db";
import { useAuth } from "@/components/AuthProvider";
import { LOCK_KEY, LOCK_MS } from "@/components/BillzAutoSync";

export default function YangilashTugma() {
  const { demo } = useAuth();
  const [band, setBand] = useState(false);
  const [boshlangan, setBoshlangan] = useState(null);
  const [otgan, setOtgan] = useState(0);
  const [xato, setXato] = useState(null);

  // So'rov javobi Billz barcha sahifalarini tortib bo'lgandagina keladi.
  // Shu vaqt ichida soniya hisoblagichi haqiqiy o'tgan vaqtni ko'rsatadi:
  // foydalanuvchi tugma ishlayotganini, brauzer qotib qolmaganini ko'radi.
  useEffect(() => {
    if (!band || !boshlangan) return undefined;
    const timer = setInterval(() => setOtgan(Math.floor((Date.now() - boshlangan) / 1000)), 250);
    return () => clearInterval(timer);
  }, [band, boshlangan]);

  // Demo rejimda tortadigan joy yo'q — tugma ham turmasin
  if (DEMO_MODE || demo) return null;

  async function yangila() {
    if (band) return;
    const qulf = Number(localStorage.getItem(LOCK_KEY) || 0);
    if (Date.now() - qulf < LOCK_MS) return;   // boshqa oyna tortyapti

    setXato(null);
    setOtgan(0);
    setBoshlangan(Date.now());
    setBand(true);
    localStorage.setItem(LOCK_KEY, String(Date.now()));
    try {
      const token = sessiyaOl()?.token;
      if (!token) throw new Error("Sessiya topilmadi — qaytadan kiring");
      const r = await fetch("/api/billz/sync", {
        headers: { authorization: `Bearer ${token}` },
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${r.status}`);

      // ── NEGA SAHIFA QAYTA YUKLANADI ──
      // Ma'lumot modul XOTIRASIDA yashaydi: `lib/db.js` → `bootstrap()`
      // ilova ochilganda hamma jadvalni bir marta o'qiydi va ikkinchi
      // chaqiriqda darrov qaytadi (`bootstrapped`). Ya'ni "bazadan
      // qayta o'qi" degan yo'l umuman yo'q. Jonli yangilanish
      // (`subscribeAll`) faqat O'ZGARGAN qatorni yetkazadi va yangi
      // tortilgan minglab chek uchun ishonch qilib bo'lmaydi.
      //
      // Shuning uchun eng halol yo'l — sahifani qayta yuklash. Bu
      // "hamma narsa aniq yangilandi" degan yagona kafolat.
      // `skipped` bo'lsa ham yuklanadi: server "yaqinda tortilgan"
      // degan bo'lsa, demak ma'lumot bazada yangi — ekranda esa
      // hali eski bo'lishi mumkin.
      //
      // Qulf yuklashdan OLDIN ochiladi: `reload` dan keyin bu kod
      // ishlamaydi va qulf 5 daqiqa qolib ketardi — tugma jimgina
      // bosilmaydigan bo'lib turardi.
      localStorage.removeItem(LOCK_KEY);
      location.reload();
    } catch (e) {
      // Xato bo'lsa sahifa YUKLANMAYDI: eski raqam ustiga "yangilandi"
      // degan taassurot qoldirmaslik kerak. Tugma aylanishdan to'xtaydi,
      // foydalanuvchi qayta bosa oladi.
      console.error("Billz yangilash:", e);
      setXato(e.message || "Yangilash amalga oshmadi");
      setBand(false);
      setBoshlangan(null);
      localStorage.removeItem(LOCK_KEY);
    }
  }

  const vaqt = `${String(Math.floor(otgan / 60)).padStart(2, "0")}:${String(otgan % 60).padStart(2, "0")}`;

  return (
    <div className="px-4 pb-4">
      <button onClick={yangila} disabled={band} aria-live="polite"
        className={`w-full rounded-xl font-bold transition-all ${
          band
            ? "bg-brand text-white shadow-pop cursor-wait"
            : "bg-brand text-white hover:bg-brand-dark active:scale-[.98]"
        }`}>
        <span className="flex items-center justify-center gap-2.5 px-4 py-3">
          {band ? <LoaderCircle size={19} className="animate-spin" /> : <RefreshCw size={19} />}
          <span>{t(band ? "Yangilanmoqda" : "Yangilash")}</span>
          {band && <span className="rounded-md bg-white/20 px-2 py-0.5 text-sm tabular-nums">{vaqt}</span>}
        </span>
        {band && <span className="block h-1 overflow-hidden rounded-b-xl bg-white/20">
          <span className="block h-full w-2/5 bg-white/80 animate-[pulse_1.2s_ease-in-out_infinite]" />
        </span>}
      </button>
      {xato && <p className="mt-2 text-xs font-semibold text-danger">{xato}</p>}
    </div>
  );
}
