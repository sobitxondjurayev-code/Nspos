"use client";
// ══════════════════════════════════════════════════════════════
// KOMPANIYA SOZLAMALARI — DOLLAR KURSI
// ══════════════════════════════════════════════════════════════
// Tizimda ikki valyuta yonma-yon yuradi:
//   • savdo, tovar, moliya — dollarda (Billz shunday beradi)
//   • ish haqi va KPI bonuslari — so'mda (haqiqatda shunday to'lanadi)
//
// Foyda hisobotida ikkalasi bir joyga tushishi kerak, shuning uchun kurs
// saqlanadi. Kurs kundan kunga o'zgargani uchun uni QO'LDA yuritish
// zerikarli — Markaziy bank (cbu.uz) kursi kuniga bir marta o'zi olinadi.
// Rahbar xohlasa qo'lda yozib qo'yadi (masalan dollarni bozor kursida
// olsa) — o'shanda avtomat yangilash o'chadi.
import { registerModule, update, rpc, DEMO_MODE } from "./db";

const CBU_URL = "https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/";

// ledgerStart — moliya hisobi qaysi kundan boshlanadi. Undan oldingi
// pul harakati umuman sanalmaydi: eski oylardagi tushum allaqachon
// sarflangan, uni kassa qoldig'iga qo'shish balansni yolg'on qiladi.
const monthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

let company = { id: null, name: "", currency: "USD", usdRate: null, usdRateAuto: true, usdRateAt: null,
  serviceNames: "montaj", ledgerStart: monthStart() };

const LS_KEY = "nspos.company.v1";
function persist() {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(LS_KEY, JSON.stringify(company)); } catch {}
}
(function hydrate() {
  if (typeof window === "undefined") return;
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY) || "null");
    if (s && typeof s === "object") company = { ...company, ...s };
  } catch {}
})();

const fromRow = (r) => ({
  id: r.id, name: r.name, currency: r.currency,
  usdRate: r.usd_rate, usdRateAuto: r.usd_rate_auto !== false, usdRateAt: r.usd_rate_at,
  serviceNames: r.service_names ?? "montaj",
  ledgerStart: r.ledger_start ? String(r.ledger_start).slice(0, 10) : monthStart(),
});

registerModule("companies", {
  table: "companies", select: "id,name,currency,usd_rate,usd_rate_auto,usd_rate_at,service_names", realtime: true,
  fromRow,
  restore: (rows) => {
    if (!rows[0]) return;
    company = { ...company, ...rows[0] };
    persist();
    refreshUsdRate();            // kun almashgan bo'lsa yangilaydi
  },
  apply: ({ new: row }) => { if (row) { company = { ...company, ...fromRow(row) }; persist(); } },
});

export const getCompany = () => company;

// 1 dollar necha so'm. Qo'yilmagan bo'lsa null.
export const getUsdRate = () => (Number(company.usdRate) > 0 ? Number(company.usdRate) : null);
export const isRateAuto = () => company.usdRateAuto !== false;
export const getRateDate = () => company.usdRateAt;

function save(patch) {
  company = { ...company, ...patch };
  persist();
  if (!DEMO_MODE && company.id) {
    update("companies", company.id, {
      usd_rate: company.usdRate,
      usd_rate_auto: company.usdRateAuto,
      usd_rate_at: company.usdRateAt,
      service_names: company.serviceNames,
      ledger_start: company.ledgerStart,
    }, "Kompaniya sozlamasi", true);
  }
}

// Qo'lda yozish — avtomat yangilash o'chadi.
//
// DIQQAT: bu funksiya faqat XOTIRAni yangilaydi. Bazaga yozish
// ratesData.saveRate() orqali `set_usd_rate` funksiyasi bilan boradi:
// `companies` jadvalini faqat rahbar o'zgartira oladi, kursni esa
// menejer ham yozishi kerak (kun davomida o'zgaradi). Ilgari bu yerdan
// to'g'ridan-to'g'ri yozilardi va menejerda "Bazaga yozilmadi" chiqardi.
export function setUsdRate(rate, { toDb = false } = {}) {
  const n = Number(rate) || 0;
  const patch = { usdRate: n > 0 ? n : null, usdRateAuto: false, usdRateAt: new Date().toISOString() };
  if (toDb) save(patch); else { company = { ...company, ...patch }; persist(); }
  return company.usdRate;
}

export function setRateAuto(on) {
  save({ usdRateAuto: !!on });
  if (on) refreshUsdRate(true);
  return company.usdRateAuto;
}

// Markaziy bank kursi. Kuniga bir marta — bugun allaqachon olingan
// bo'lsa qayta so'ralmaydi.
let fetching = false;
export async function refreshUsdRate(force = false) {
  if (typeof window === "undefined" || fetching) return null;
  if (!company.usdRateAuto && !force) return null;
  const today = new Date().toISOString().slice(0, 10);
  if (!force && company.usdRateAt?.slice(0, 10) === today && company.usdRate) return company.usdRate;

  fetching = true;
  try {
    const res = await fetch(CBU_URL, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const rate = Number(data?.[0]?.Rate);
    if (!(rate > 0)) return null;
    // Xotira + baza. Bazaga `set_usd_rate` orqali: `companies` ni faqat
    // rahbar yoza oladi, bu funksiya esa menejerda ham ishlaydi va
    // kursni tarixga ham yozib qo'yadi.
    company = { ...company, usdRate: rate, usdRateAt: new Date().toISOString() };
    persist();
    if (!DEMO_MODE) rpc("set_usd_rate", { p_rate: rate, p_source: "cbu" }, "Dollar kursi", true);
    return rate;
  } catch {
    return null;      // internet yo'q bo'lsa eski kurs ishlatiladi
  } finally {
    fetching = false;
  }
}

// —— Servis (o'rnatish xizmati) ————————————————————————
// Billz'da xizmat alohida bo'lim emas — u oddiy tovar kabi sotiladi
// ("montaj"). Shuning uchun qaysi nomlar xizmat hisoblanishini shu
// yerda belgilaymiz: hisobotda tovar savdosidan ajratib ko'rsatiladi.
// —— Hisob boshlanish sanasi ————————————————————————
export const getLedgerStart = () => company.ledgerStart || monthStart();

export function setLedgerStart(date) {
  save({ ledgerStart: String(date).slice(0, 10) });
  return company.ledgerStart;
}

export const getServiceNames = () =>
  String(company.serviceNames || "")
    .split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);

export function setServiceNames(text) {
  save({ serviceNames: String(text || "") });
  return company.serviceNames;
}

// Tovar nomi xizmatmi
export const isServiceName = (name) => {
  const n = String(name || "").toLowerCase();
  return getServiceNames().some((k) => n.includes(k));
};

export const somToUsd = (som) => {
  const r = getUsdRate();
  return r ? (Number(som) || 0) / r : null;
};

// ══════════════════════════════════════════════════════════════
// SO'MDA KIRITILGAN SUMMANI YOZUVGA TAYYORLASH
// ══════════════════════════════════════════════════════════════
// MUHIM QOIDA: pul so'mda kiritilsa, kiritilgan raqamning O'ZI ham
// saqlanishi shart. Ichkarida hamma narsa dollarda yuriladi, lekin
// so'mni faqat dollardan qaytarib hisoblasak, kurs bo'linmasi tufayli
// raqam o'zgarib qoladi: 10 000 so'm → 0.84 $ → 9 985 so'm. Rahbar buni
// darrov sezadi va hisobga ishonchi yo'qoladi.
//
// Shuning uchun so'mda summa oladigan HAR BIR oyna shu funksiyani
// ishlatsin — o'zi bo'lib hisoblamasin:
//
//   const money = fromSom(raw);          // { amount, amountSom, rateUsed }
//   if (!money) return;                  // kurs yo'q — saqlanmaydi
//   addExpense({ ...money, ... });
//
// Kurs olinmagan bo'lsa null qaytadi: yolg'on raqam yozgandan ko'ra
// saqlamagan yaxshi.
export function fromSom(som) {
  const rate = getUsdRate();
  const value = Number(som) || 0;
  if (!rate || value <= 0) return null;
  return {
    amount: +(value / rate).toFixed(2),   // hisob valyutasi
    amountSom: value,                     // aynan kiritilgani
    rateUsed: rate,                       // o'sha kundagi kurs
  };
}
export const usdToSom = (usd) => {
  const r = getUsdRate();
  return r ? (Number(usd) || 0) * r : null;
};
