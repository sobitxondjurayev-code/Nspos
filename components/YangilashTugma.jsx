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
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { t } from "@/lib/i18n";
import { sessiyaOl } from "@/lib/sessiya";
import { DEMO_MODE } from "@/lib/db";
import { useAuth } from "@/components/AuthProvider";
import { LOCK_KEY, LOCK_MS } from "@/components/BillzAutoSync";

export default function YangilashTugma() {
  const { demo } = useAuth();
  const [band, setBand] = useState(false);

  // Demo rejimda tortadigan joy yo'q — tugma ham turmasin
  if (DEMO_MODE || demo) return null;

  async function yangila() {
    if (band) return;
    const qulf = Number(localStorage.getItem(LOCK_KEY) || 0);
    if (Date.now() - qulf < LOCK_MS) return;   // boshqa oyna tortyapti

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
      setBand(false);
      localStorage.removeItem(LOCK_KEY);
    }
  }

  return (
    <button onClick={yangila} disabled={band} aria-label={t("Yangilash")} title={t("Yangilash")}
      className="w-11 h-11 shrink-0 rounded-xl bg-track text-muted hover:text-brand flex items-center justify-center transition-colors disabled:opacity-60">
      <RefreshCw size={19} className={band ? "animate-spin" : ""} />
    </button>
  );
}
