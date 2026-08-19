"use client";
// ══════════════════════════════════════════════════════════════
// XODIM KPI VA OYLIK HISOBI — KO'P MENEJER TURI
// ══════════════════════════════════════════════════════════════
// Manba: uchta Excel fayl. Formulalar aynan o'sha fayllardan olingan
// (VLOOKUP, IF zanjirlari), taxmin qilinmagan.
//
//   • B2B menejer            — "B2B menejer KPI v2"
//   • B2C do'kon menejer     — "B2C do'kon menejer"
//   • B2C retention menejer  — "B2C retention menejer kunlik"
//
// Har turning o'z kunlik ustunlari, o'z bonus tarkibi va o'z
// standart qoidalari bor. Umumiy g'oya bir xil:
//
//   Kiritiladi : kech qoldimi, dam oldimi, kunlik raqamlar, kamomad
//   O'zi chiqadi: yig'indilar, plan %, barcha bonuslar, oylik maosh
//
// Excel'da "Vaqt o'tdi" kalendar kun emas — TO'LDIRILGAN KUNLAR ulushi.
// Shu mantiq saqlangan: dam kunlar to'ldirilmasa vaqt ham o'tmaydi.

// —— Yordamchilar ————————————————————————————————
// Bo'sh katak va "0 kiritilgan" bir xil emas: Excel COUNT() bo'sh
// katakni sanamaydi.
const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v) || 0);
const val = (v) => num(v) ?? 0;

// Sana "YYYY-MM-DD" ko'rinishida. Date ham, satr ham kelishi mumkin —
// Date'ni String() qilsa "Sat Aug 01 2026..." chiqadi va sana
// solishtiruvi butunlay buziladi (jadval bo'sh ko'rinadi).
const ymd = (d) => {
  if (d instanceof Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return String(d ?? "").slice(0, 10);
};

// —— Umumiy qoida bo'laklari ————————————————————————
const SALES_TIERS_B2B = [
  { from: 0, bonus: 0 },
  { from: 50_000, bonus: 1_000_000 },
  { from: 60_000, bonus: 1_500_000 },
  { from: 70_000, bonus: 2_000_000 },
];
// B2C fayllaridagi bosqichlar (Sozlamalar J9:L12 / M9:O12)
const SALES_TIERS_B2C = [
  { from: 0, bonus: 0 },
  { from: 25_000, bonus: 1_000_000 },
  { from: 30_000, bonus: 2_000_000 },
  { from: 35_000, bonus: 3_000_000 },
];
// Ustaga pul beriladigan kunlar: oylik 1-sanada, keyin har 5 kunda.
// Menejer shu kunlardan boshqasiga yoza olmaydi — aks holda "qachon
// qancha berilgani" tartibsiz bo'lib, oy oxirida hisob chalkashadi.
export const PAY_DAYS = [1, 5, 10, 15, 20, 25];

// —— Cheklov vaqtincha ochilgan oylar ————————————————
// Rahbar so'radi (2026-08-15): shu oyga cheklov bekor qilinsin —
// menejer ustaning olgan pulini ISTALGAN kunga yoza olsin. Bu bitta
// oyga berilgan ruxsat, qoidaning o'zi bekor qilinmadi: keyingi oyda
// jadval o'zi 1/5/10/15/20/25 ga qaytadi. Yana kerak bo'lsa shu
// ro'yxatga "YYYY-MM" qo'shiladi.
export const PAY_ANY_DAY_MONTHS = ["2026-08"];
export const isPayAnyDayMonth = (month) => PAY_ANY_DAY_MONTHS.includes(String(month ?? "").slice(0, 7));

export const isPayDay = (dayOfMonth, month = null) =>
  isPayAnyDayMonth(month) || PAY_DAYS.includes(Number(dayOfMonth));

const REVISION = { bonus: 1_000_000, halfUpTo: 100 };
const LATE = { bonus: 1_000_000, fullUpTo: 3, partialUpTo: 5, partialRate: 0.5 };
const DAYOFF = { bonus: 1_000_000, fullUpTo: 3, partialAt: 4, partialRate: 0.5 };

// —— Menejer turlari ————————————————————————————————
// Har turning: bonus tarkibi (parts), reja maydonlari (planFields),
// kunlik jadval ustunlari (columns) va standart qoidalari.
//
// Ustun turlari (kind):
//   check           — Ha/Yo'q belgisi (kech qoldi / dam oldi)
//   money | int     — qo'lda kiritiladigan raqam
//   calc:<nima>     — o'zi hisoblanadi (income/diff/cum/planpct/nps)
//   revisionCol     — faqat reviziya kunlarida ochiladi
export const KPI_TYPES = {
  b2b: {
    label: "B2B menejer",
    short: "B2B",
    parts: ["sales", "collection", "akb", "revision", "late", "dayOff"],
    planFields: [
      { key: "salesPlan", label: "Savdo rejasi ($)" },
      { key: "akbPlan", label: "AKB rejasi (mijoz)" },
      { key: "akbFact", label: "AKB fakt (mijoz)", hint: "Oy oxirida qo'lda kiritiladi" },
      { key: "clientCallsPlan", label: "Mijozlarga aloqa rejasi (ta)" },
      { key: "newGroupsPlan", label: "Yangi B2B guruh rejasi (ta)" },
      { key: "wholesalePlan", label: "Optomga yangilik rejasi (ta)" },
    ],
    columns: [
      { key: "late", label: "Kech", kind: "check" },
      { key: "dayOff", label: "Dam", kind: "check" },
      // Naqd oldinda: rahbar kunni naqd puldan boshlab o'qiydi
      { key: "cash", label: "Naqd ($)", kind: "money" },
      { key: "payme", label: "Payme ($)", kind: "money" },
      { key: "income", label: "Jami tushum", kind: "calc", calc: "income" },
      { key: "sales", label: "Savdo ($)", kind: "money" },
      { key: "diff", label: "Nasiya", kind: "calc", calc: "diff" },
      { key: "cum", label: "Jami savdo", kind: "calc", calc: "cum" },
      { key: "planpct", label: "Plan %", kind: "calc", calc: "planpct" },
      { key: "wholesalePosts", label: "Optomga yangilik (ta)", kind: "int" },
      { key: "clientCalls", label: "Eski mijozlarga aloqa", kind: "int" },
      { key: "newGroups", label: "Yangi B2B guruh", kind: "int" },
      { key: "revision", label: "Kamomad ($)", kind: "money", revisionCol: true },
    ],
    defaultPlan: {
      salesPlan: 100_000, akbPlan: 40, akbFact: 0,
      collectionPct: null, clientCallsPlan: 0, newGroupsPlan: 0, wholesalePlan: 0,
    },
    defaultRules: {
      fixed: 2_000_000,
      salesTiers: SALES_TIERS_B2B,
      collection: { bonus: 1_000_000, full: 0.95, partial: 0.90, partialRate: 0.5 },
      akb: { bonus: 1_000_000, min: 0.8, max: 1.2 },
      revision: { ...REVISION },
      late: { ...LATE },
      dayOff: { ...DAYOFF },
      revisionEveryDays: 5,
    },
  },

  b2c_store: {
    label: "B2C do'kon menejer",
    short: "B2C do'kon",
    // B2B bilan bir xil hisoblanadi — faqat B2B'ga xos ustunlar yo'q:
    // "Optomga yangilik", "Eski mijozlarga aloqa" va "Yangi B2B guruh".
    // Payme/Naqd/Jami tushum/Nasiya esa B2B'dagidek qoladi (inkassatsiya
    // bonusi shulardan hisoblanadi).
    parts: ["sales", "collection", "revision", "late", "dayOff"],
    planFields: [{ key: "salesPlan", label: "Savdo rejasi ($)" }],
    columns: [
      { key: "late", label: "Kech", kind: "check" },
      { key: "dayOff", label: "Dam", kind: "check" },
      // Naqd oldinda: rahbar kunni naqd puldan boshlab o'qiydi
      { key: "cash", label: "Naqd ($)", kind: "money" },
      { key: "payme", label: "Payme ($)", kind: "money" },
      // Servis — o'rnatish xizmatidan tushgan pul. Menejer uni naqddan
      // ajratib yozadi (731 → 700 naqd + 31 servis), puli servis
      // kassasiga tushadi. "Jami tushum"ga esa KIRADI: Billz'da montaj
      // tovar kabi sotilgani uchun u "Savdo" ichida ham bor.
      { key: "service", label: "Servis ($)", kind: "money" },
      { key: "income", label: "Jami tushum", kind: "calc", calc: "income" },
      { key: "sales", label: "Savdo ($)", kind: "money" },
      { key: "diff", label: "Nasiya", kind: "calc", calc: "diff" },
      { key: "cum", label: "Jami savdo", kind: "calc", calc: "cum" },
      { key: "planpct", label: "Plan %", kind: "calc", calc: "planpct" },
      { key: "revision", label: "Reviziya ($)", kind: "money", revisionCol: true },
    ],
    defaultPlan: { salesPlan: 30_000, collectionPct: null },
    defaultRules: {
      fixed: 2_000_000,
      salesTiers: SALES_TIERS_B2C,
      collection: { bonus: 1_000_000, full: 0.95, partial: 0.90, partialRate: 0.5 },
      revision: { ...REVISION },
      late: { ...LATE },
      dayOff: { ...DAYOFF },
      revisionEveryDays: 5,
    },
  },

  b2c_retention: {
    label: "B2C retention menejer",
    short: "Retention",
    // Do'kon menejer bilan BIR XIL jadval — faqat ustiga NPS ustunlari
    // qo'shiladi (O'rnatilgan / NPS olingan — NPS baholaridan avtomat).
    parts: ["sales", "collection", "nps", "revision", "late", "dayOff"],
    planFields: [{ key: "salesPlan", label: "Savdo rejasi ($)" }],
    columns: [
      { key: "late", label: "Kech", kind: "check" },
      { key: "dayOff", label: "Dam", kind: "check" },
      // Naqd oldinda: rahbar kunni naqd puldan boshlab o'qiydi
      { key: "cash", label: "Naqd ($)", kind: "money" },
      { key: "payme", label: "Payme ($)", kind: "money" },
      { key: "income", label: "Jami tushum", kind: "calc", calc: "income" },
      { key: "sales", label: "Savdo ($)", kind: "money" },
      { key: "diff", label: "Nasiya", kind: "calc", calc: "diff" },
      { key: "cum", label: "Jami savdo", kind: "calc", calc: "cum" },
      { key: "planpct", label: "Plan %", kind: "calc", calc: "planpct" },
      // Bu ikki ustun QO'LDA emas — NPS baholaridan avtomat to'ladi
      // (o'rnatilgan sana / to'ldirilgan sana bo'yicha kunma-kun).
      { key: "installed", label: "O'rnatilgan (ta)", kind: "calc", calc: "npsInstalled" },
      { key: "npsCollected", label: "NPS olingan (ta)", kind: "calc", calc: "npsTaken" },
      { key: "nps", label: "NPS %", kind: "calc", calc: "nps" },
      { key: "revision", label: "Reviziya ($)", kind: "money", revisionCol: true },
    ],
    defaultPlan: { salesPlan: 30_000, collectionPct: null },
    defaultRules: {
      fixed: 2_000_000,
      salesTiers: SALES_TIERS_B2C,
      collection: { bonus: 1_000_000, full: 0.95, partial: 0.90, partialRate: 0.5 },
      // NPS: o'rnatilganlarga nisbatan NPS olingan ulushi
      nps: { bonus: 1_000_000, full: 0.95, partial: 0.90, partialRate: 0.5 },
      revision: { ...REVISION },
      late: { ...LATE },
      dayOff: { ...DAYOFF },
      revisionEveryDays: 5,
    },
  },

  // O'rnatuvchi usta — kamera o'rnatadi. Oyligi: har kamera uchun
  // belgilangan narx (usta bo'yicha ALOHIDA) × soni + davomat bonuslari
  // (kech qolish / dam olish menejerlarnikidek). Savdo/plan yo'q.
  installer: {
    label: "O'rnatuvchi usta",
    short: "Usta",
    // Ustada reviziya YO'Q. Davomat: kech, dam va ikkovi to'liq bonusi.
    parts: ["cameras", "late", "dayOff", "combo"],
    planFields: [
      { key: "rate", label: "Kamera narxi (so'm/dona)", hint: "Shu ustaga alohida" },
      { key: "camerasPlan", label: "Oylik kamera rejasi (dona)", hint: "Ixtiyoriy — reyting uchun" },
    ],
    columns: [
      { key: "late", label: "Kech", kind: "check" },
      { key: "dayOff", label: "Dam", kind: "check" },
      { key: "cameras", label: "O'rnatilgan kamera (dona)", kind: "int" },
      { key: "camMoney", label: "Kunlik summa (so'm)", kind: "calc", calc: "camMoney" },
      { key: "cumCam", label: "Jami kamera", kind: "calc", calc: "cumCam" },
      // Pul belgilangan kunlarda beriladi: oyning 1, 5, 10, 15, 20, 25-kuni.
      // Menejer faqat o'sha kunlarga yoza oladi; rahbar istalgan kunga
      // yozadi (favqulodda holat bo'lib turadi).
      { key: "olgan", label: "Olgan pul (so'm)", kind: "money", payDayCol: true },
    ],
    // nps — retention menejer belgilaydigan "NPS olingan (ta)" soni.
    // NPS % = nps / o'rnatilgan kamera (reytingda ko'rinadi).
    defaultPlan: { rate: 0, camerasPlan: 0, nps: 0 },
    defaultRules: {
      fixed: 0,
      // Kech qolmasa 500k (0 kun kech = to'liq), dam bonusi 500k,
      // IKKOVI to'liq bo'lsa yana 500k. Chegaralarni rahbar o'zgartiradi.
      late: { bonus: 500_000, fullUpTo: 0, partialUpTo: 2, partialRate: 0.5 },
      dayOff: { ...DAYOFF, bonus: 500_000 },
      combo: { bonus: 500_000 },
    },
  },
};

// Menejer turlari (usta alohida oqim — reyting ko'rinishida)
export const MANAGER_TYPES = ["b2b", "b2c_store", "b2c_retention"];
export const DEFAULT_TYPE = "b2b";
export const typeOf = (t) => KPI_TYPES[t] || KPI_TYPES[DEFAULT_TYPE];
// Eski importlar buzilmasin
export const DEFAULT_RULES = KPI_TYPES.b2b.defaultRules;
export const DEFAULT_PLAN = KPI_TYPES.b2b.defaultPlan;

// —— Xotira + saqlash ————————————————————————————————
// Ikki qatlam:
//   1) localStorage — tez, offline, shu qurilmada darrov ishlaydi
//   2) Supabase (kpi_day/kpi_plan/kpi_assign) — qurilmalar orasida
//      bo'lishish va realtime. Xodim telefonida raqam kiritsa, rahbar
//      kompyuterida ko'radi.
// Id'lar DETERMINISTIK (staffId+sana) — shuning uchun ikki qurilma
// bir kunni yozsa ham bitta yozuvga tushadi, ikkilanmaydi.
import { registerModule, upsert, remove as dbRemove, DEMO_MODE } from "./db";
// Retention menejerning "O'rnatilgan/NPS olingan" oylik yig'indisi
// NPS baholaridan hisoblanadi (kunlik jadval ham shundan to'ladi).
import { npsMonthTotals } from "./npsData";

let assignments = {};   // staffId -> kpiType
let plans = [];
let days = [];

const dayId = (staffId, date) => `d:${staffId}:${date}`;
const planId = (staffId, month) => `p:${staffId}:${month}`;

const LS_KEY = "nspos.kpi.v1";
function persist() {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(LS_KEY, JSON.stringify({ assignments, plans, days })); } catch {}
}
(function hydrate() {
  if (typeof window === "undefined") return;
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY) || "null");
    if (!s) return;
    assignments = s.assignments || {};
    plans = s.plans || [];
    days = s.days || [];
  } catch {}
})();

// —— Bazaga ulanish ————————————————————————————————
// JSONB `data` ustunida butun yozuv saqlanadi — har tur uchun alohida
// ustun kerak emas. staff_id/date/month esa qidiruv va RLS uchun.
const dayData = ({ id, staffId, date, ...rest }) => rest;
const planData = ({ id, staffId, month, ...rest }) => rest;
const seenDayId = new Set();   // bazada bor deb bilinadigan id'lar

// Kunlik yozuvni ko'p bosishda har harfda emas, tinchlangach yozamiz —
// yozayotganda qayta chizilib fokus yo'qolmasin.
const pushTimers = {};
function pushDay(d) {
  if (DEMO_MODE || !d) return;
  seenDayId.add(d.id);
  upsert("kpi_day", { id: d.id, staff_id: d.staffId, date: d.date, data: dayData(d) }, undefined, "KPI kun", true);
}
function schedulePushDay(d) {
  if (DEMO_MODE) return;
  clearTimeout(pushTimers[d.id]);
  pushTimers[d.id] = setTimeout(() => pushDay(getDay(d.staffId, d.date) || d), 700);
}
function pushPlan(p) {
  if (DEMO_MODE || !p) return;
  upsert("kpi_plan", { id: p.id, staff_id: p.staffId, month: p.month, data: planData(p) }, undefined, "KPI reja", true);
}
function pushAssign(staffId, kpiType) {
  if (DEMO_MODE) return;
  upsert("kpi_assign", { staff_id: staffId, kpi_type: kpiType }, undefined, "KPI tur", true);
}

// Bazadan kelmagan (faqat shu qurilmada bor) yozuvlarni yuqoriga surish
function syncUp() {
  if (DEMO_MODE) return;
  for (const d of days) if (!seenDayId.has(d.id)) pushDay(d);
  for (const p of plans) pushPlan(p);
  for (const [sid, ty] of Object.entries(assignments)) pushAssign(sid, ty);
}

// bootstrap shu modullarni o'qiydi va realtime'ga ulaydi
registerModule("kpi_assign", {
  table: "kpi_assign", select: "*", realtime: true,
  fromRow: (r) => r,
  restore: (rows) => {
    const next = { ...assignments };
    for (const r of rows) next[r.staff_id] = r.kpi_type;   // baza ustun
    assignments = next; persist();
  },
  apply: ({ eventType, new: row, old }) => {
    if (eventType === "DELETE") { const a = { ...assignments }; delete a[old.staff_id]; assignments = a; }
    else assignments = { ...assignments, [row.staff_id]: row.kpi_type };
    persist();
  },
});

registerModule("kpi_plan", {
  table: "kpi_plan", select: "*", realtime: true,
  fromRow: (r) => ({ ...r.data, id: r.id, staffId: r.staff_id, month: r.month }),
  restore: (rows) => {
    const byId = new Map(plans.map((p) => [p.id, p]));
    for (const r of rows) byId.set(r.id, r);   // baza ustun
    plans = [...byId.values()]; persist();
  },
  apply: ({ eventType, new: row, old }) => {
    if (eventType === "DELETE") plans = plans.filter((p) => p.id !== old.id);
    else { const it = { ...row.data, id: row.id, staffId: row.staff_id, month: row.month };
      plans = [...plans.filter((p) => p.id !== it.id), it]; }
    persist();
  },
});

registerModule("kpi_day", {
  table: "kpi_day", select: "*", realtime: true,
  fromRow: (r) => ({ ...r.data, id: r.id, staffId: r.staff_id, date: r.date }),
  restore: (rows) => {
    const byId = new Map(days.map((d) => [d.id, d]));
    for (const r of rows) { byId.set(r.id, r); seenDayId.add(r.id); }   // baza ustun
    days = [...byId.values()]; persist();
    // Faqat shu qurilmadagi (bazaga yetmagan) yozuvlarni yuqoriga sur
    syncUp();
  },
  apply: ({ eventType, new: row, old }) => {
    if (eventType === "DELETE") days = days.filter((d) => d.id !== old.id);
    else { const it = { ...row.data, id: row.id, staffId: row.staff_id, date: row.date };
      days = [...days.filter((d) => d.id !== it.id), it]; seenDayId.add(row.id); }
    persist();
  },
});

export const monthKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export const todayKey = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

// Reviziya shu kunda yoziladimi: har N-kun va uning ertasi.
export function isRevisionDay(dayOfMonth, every = 5) {
  if (!every || every < 1) return true;
  return dayOfMonth % every === 0 || (dayOfMonth > 1 && (dayOfMonth - 1) % every === 0);
}

// —— Tur biriktirish ————————————————————————————————
export const getType = (staffId) => assignments[staffId] || DEFAULT_TYPE;
export function setType(staffId, kpiType) {
  assignments = { ...assignments, [staffId]: kpiType };
  persist();
  pushAssign(staffId, kpiType);
}
// Biror xodimga tur aniq belgilangganmi (default emas)
export const hasType = (staffId) => !!assignments[staffId];

// Ustaning kamera narxini belgilash (yangi usta qo'shilganda ham).
// Avval turini "installer" qilamiz, keyin shu oyning rejasiga narxni yozamiz.
export function setInstallerRate(staffId, rate, month = monthKey(new Date())) {
  if (getType(staffId) !== "installer") setType(staffId, "installer");
  savePlan(staffId, month, { rate: Number(rate) || 0 });
}

// Ustaning NPS'i (NPS olingan soni) — retention menejer belgilaydi
export function setInstallerNps(staffId, nps, month = monthKey(new Date())) {
  if (getType(staffId) !== "installer") setType(staffId, "installer");
  savePlan(staffId, month, { nps: Number(nps) || 0 });
}

// —— Reja va qoidalar ————————————————————————————
export function getPlan(staffId, month, typeOverride) {
  const type = typeOverride || getType(staffId);
  const conf = typeOf(type);
  // Qoidalar HAR DOIM to'liq bo'lsin: saqlangan qism standart ustiga
  // qo'yiladi. Aks holda faqat bitta bo'lim (mas. late) saqlangan bo'lsa
  // qolganlari (dayOff...) yo'qolib, hisob ishlamay qolardi.
  const mergeRules = (r) => ({ ...conf.defaultRules, ...(r || {}) });
  const found = plans.find((p) => p.staffId === staffId && p.month === month);
  if (found) return { ...found, type, rules: mergeRules(found.rules) };
  // Oldingi oydan meros — har oy qaytadan sozlash shart bo'lmasin.
  // Fakt raqamlar (akbFact) meros bo'lmaydi: ular oyga xos.
  const prev = plans
    .filter((p) => p.staffId === staffId && p.month < month)
    .sort((a, b) => (a.month < b.month ? 1 : -1))[0];
  return {
    id: null, staffId, month, type,
    ...conf.defaultPlan,
    ...(prev ? { ...prev, id: null, month, type, akbFact: 0, collectionPct: null } : {}),
    rules: mergeRules(prev?.rules),
  };
}

export function savePlan(staffId, month, patch) {
  const cur = getPlan(staffId, month);
  const next = { ...cur, ...patch, staffId, month, id: cur.id ?? planId(staffId, month) };
  plans = [...plans.filter((p) => !(p.staffId === staffId && p.month === month)), next];
  persist();
  pushPlan(next);
  return next;
}

export function saveRules(staffId, month, patch) {
  const cur = getPlan(staffId, month);
  return savePlan(staffId, month, { rules: { ...cur.rules, ...patch } });
}

// —— Kunlik yozuvlar ————————————————————————————
export const listDays = (staffId, month) =>
  days.filter((d) => d.staffId === staffId && d.date.startsWith(month))
      .sort((a, b) => (a.date < b.date ? -1 : 1));

export const getDay = (staffId, date) =>
  days.find((d) => d.staffId === staffId && d.date === date) ?? null;

// Barcha xodimlarning kunlari — kassa moduli kirimni shundan oladi
// (kassaData.js). Sana chegarasi ixtiyoriy.
export const listAllDays = (from, to) =>
  days.filter((d) => (!from || d.date >= from) && (!to || d.date <= to));

// —— Usta: ixtiyoriy kun oralig'i bo'yicha ————————————
// Reyting oy bo'yicha hisoblanadi (bonus qoidalari oylik), lekin
// rahbar "shu haftada kim nechta o'rnatdi" degan savolni ham beradi.
// Shu yerda faqat KUNLIK faktlar yig'iladi — kamera, kech, dam va
// olgan pul. Bonus va qoldiq bu yerda hisoblanmaydi: ular oyning
// to'liq ma'lumotisiz noto'g'ri chiqadi.
export function installerRange(staffId, from, to) {
  // Sana Date ham, "2026-08-01" ham bo'lishi mumkin. Date'ni String()
  // qilsa "Sat Aug 01 2026..." chiqadi va solishtiruv butunlay buziladi
  // — hamma kun chetlab o'tiladi, jadvalda 0 ko'rinadi. Shuning uchun
  // ikkalasi ham bir xil "YYYY-MM-DD" ko'rinishga keltiriladi.
  const a = ymd(from), b = ymd(to);
  let cameras = 0, olgan = 0, lateDays = 0, offDays = 0, camMoney = 0;
  for (const d of days) {
    if (d.staffId !== staffId || d.date < a || d.date > b) continue;
    const c = num(d.cameras) ?? 0;
    cameras += c;
    olgan += num(d.olgan) ?? 0;
    if (d.late) lateDays += 1;
    if (d.dayOff) offDays += 1;
    // Narx oy bo'yicha belgilanadi — har kun o'z oyining narxi bilan
    const rate = Number(getPlan(staffId, d.date.slice(0, 7), "installer").rate) || 0;
    camMoney += c * rate;
  }
  return { cameras, olgan, lateDays, offDays, camMoney };
}

export function saveDay(staffId, date, patch) {
  const cur = getDay(staffId, date);
  const next = {
    id: cur?.id ?? dayId(staffId, date),
    staffId, date,
    late: false, dayOff: false,
    payme: null, cash: null, service: null, sales: null,
    clientCalls: null, newGroups: null, revision: null, wholesalePosts: null,
    installed: null, npsCollected: null, cameras: null, olgan: null,
    ...cur, ...patch,
  };
  days = [...days.filter((d) => !(d.staffId === staffId && d.date === date)), next];
  persist();
  schedulePushDay(next);
  return next;
}

// Bir kunning hisoblangan ustunlari (tushum va nasiya)
//
// SERVIS HAM JAMI TUSHUMGA KIRADI. Sababi: Billz'da montaj oddiy tovar
// kabi sotiladi, ya'ni u "Savdo" ustunining ichida turadi. Servisni
// tushumdan chiqarib tashlasak, nasiya (savdo − tushum) aynan servis
// summasiga oshib ketardi — go'yo mijoz qarzga olgandek.
export function computeDay(row) {
  const payme = num(row?.payme), cash = num(row?.cash), sales = num(row?.sales);
  const service = num(row?.service);
  const income = payme === null && cash === null && service === null
    ? null : (payme ?? 0) + (cash ?? 0) + (service ?? 0);
  const diff = sales === null || income === null ? null : sales - income;
  return { income, diff };
}

// —— Bonuslar — har biri Excel formulasining aynan o'zi ————————
function salesBonus(sales, rules) {
  const tiers = [...rules.salesTiers].sort((a, b) => a.from - b.from);
  let tier = tiers[0];
  for (const t of tiers) if (sales >= t.from) tier = t;
  const next = tiers.find((t) => t.from > sales);
  return {
    value: tier?.bonus ?? 0,
    max: Math.max(...tiers.map((t) => t.bonus)),
    note: next
      ? `${(next.from - sales).toLocaleString("ru-RU")} $ qolsa — ${next.bonus.toLocaleString("ru-RU")} so'm`
      : "Eng yuqori bosqich",
  };
}

// IF(pct>=full; bonus; IF(pct>=partial; bonus×rate; 0))
function collectionBonus(pct, rules) {
  const c = rules.collection;
  if (pct === null) return { value: 0, max: c.bonus, note: "Ma'lumot yo'q" };
  const rate = pct >= c.full ? 1 : pct >= c.partial ? c.partialRate : 0;
  return {
    value: Math.round(c.bonus * rate), max: c.bonus,
    note: `Qaytdi ${Math.round(pct * 100)}% · to'liq bonus ${Math.round(c.full * 100)}% dan`,
  };
}

// NPS — o'rnatilganlarga nisbatan NPS olingan ulushi.
// IF(nps>=95%; bonus; IF(nps>=90%; bonus×0.5; 0))
function npsBonus(pct, rules) {
  const c = rules.nps;
  if (pct === null) return { value: 0, max: c.bonus, note: "O'rnatish yo'q" };
  const rate = pct >= c.full ? 1 : pct >= c.partial ? c.partialRate : 0;
  return {
    value: Math.round(c.bonus * rate), max: c.bonus,
    note: `NPS ${Math.round(pct * 100)}% · to'liq bonus ${Math.round(c.full * 100)}% dan`,
  };
}

// IF(pct<min; 0; MIN(pct; max) × bonus)
function akbBonus(fact, plan, rules) {
  const a = rules.akb;
  if (!plan) return { value: 0, max: a.bonus, note: "Reja qo'yilmagan" };
  const done = fact / plan;
  const rate = done < a.min ? 0 : Math.min(done, a.max);
  return {
    value: Math.round(a.bonus * rate),
    max: Math.round(a.bonus * a.max),
    note: `${fact} / ${plan} mijoz · ${Math.round(done * 100)}%`,
  };
}

// IF(kamomad=0; bonus; IF(kamomad<=half; bonus×0.5; 0))
function revisionBonus(shortage, rules) {
  const r = rules.revision;
  const rate = shortage <= 0 ? 1 : shortage <= r.halfUpTo ? 0.5 : 0;
  return {
    value: Math.round(r.bonus * rate), max: r.bonus,
    note: shortage <= 0 ? "Kamomad yo'q"
      : `Kamomad ${shortage} $ · ${r.halfUpTo} $ gacha yarim bonus`,
  };
}

// IF(kun<=full; bonus; IF(kun<=partial; bonus×rate; 0))
function lateBonus(count, rules) {
  const c = rules.late;
  const rate = count <= c.fullUpTo ? 1 : count <= c.partialUpTo ? c.partialRate : 0;
  return { value: Math.round(c.bonus * rate), max: c.bonus, note: `${count} kun kech qolgan` };
}

// IF(kun<=full; bonus; IF(kun=partialAt; bonus×rate; 0))
// Diqqat: ikkinchi shart AYNAN tenglik — Excel'da shunday
function dayOffBonus(count, rules) {
  const c = rules.dayOff;
  const rate = count <= c.fullUpTo ? 1 : count === c.partialAt ? c.partialRate : 0;
  return { value: Math.round(c.bonus * rate), max: c.bonus, note: `${count} kun dam olgan` };
}

// Usta: o'rnatilgan kamera × shu ustaning narxi. Reja qo'yilsa —
// progress reja bo'yicha, aks holda hozirgi summaning o'zi.
function camerasBonus(count, plan) {
  const rate = Number(plan.rate) || 0;
  const value = count * rate;
  const target = Number(plan.camerasPlan) || 0;
  const max = target > 0 ? target * rate : (value || rate || 1);
  return {
    value: Math.round(value), max: Math.round(max),
    note: `${count} dona × ${rate.toLocaleString("ru-RU")} so'm`,
  };
}

// —— Oylik yakun ————————————————————————————————
// Oldingi oylardan ko'chib kelgan qoldiq (usta uchun).
// Usta avans olib, o'sha oyda ishlab topmasa — qarz keyingi oyga o'tadi.
// Har oyning o'z qoldig'i ham joyida qoladi, shuning uchun qaysi oydan
// kelgani ko'rinadi.
function carryOver(staffId, month, typeOverride) {
  const months = [...new Set(days
    .filter((d) => d.staffId === staffId && d.date.slice(0, 7) < month)
    .map((d) => d.date.slice(0, 7)))].sort();
  let sum = 0;
  const items = [];
  for (const m of months) {
    const r = computeMonth(staffId, m, typeOverride, false);
    const bal = r.total - r.olgan;          // shu oyda ishlab topgan − olgan
    if (Math.round(bal) === 0) continue;
    sum += bal;
    items.push({ month: m, balance: bal });
  }
  return { sum, items };
}

export function computeMonth(staffId, month, typeOverride, withCarry = true) {
  const plan = getPlan(staffId, month, typeOverride);
  const type = plan.type;
  const conf = typeOf(type);
  // To'liq qoida: qisman saqlangan bo'lsa ham standart bilan to'ldiriladi
  const rules = { ...conf.defaultRules, ...(plan.rules || {}) };
  const rows = listDays(staffId, month);

  const [y, mo] = month.split("-").map(Number);
  const daysInMonth = new Date(y, mo, 0).getDate();

  const sumOf = (k) => rows.reduce((a, r) => a + val(r[k]), 0);
  const sales = sumOf("sales");
  const payme = sumOf("payme");
  const cash = sumOf("cash");
  const service = sumOf("service");
  // Servis ham tushum: Billz'da montaj tovar kabi sotiladi va "Savdo"
  // ichida keladi. Shuning uchun inkassatsiya (tushum ÷ savdo) ham shu
  // uchtasidan hisoblanadi — aks holda menejer aybsiz ayblanardi.
  const income = payme + cash + service;
  const shortage = sumOf("revision");
  // Retention: o'rnatilgan/NPS olingan qo'lda emas, NPS baholaridan
  let installed = sumOf("installed");
  let npsCollected = sumOf("npsCollected");
  if (type === "b2c_retention") {
    const tot = npsMonthTotals(month);
    installed = tot.installed;
    npsCollected = tot.taken;
  }
  const cameras = sumOf("cameras");
  const olgan = sumOf("olgan");   // usta shu oyda olgan (avans) puli
  const lateDays = rows.filter((r) => r.late).length;
  const offDays = rows.filter((r) => r.dayOff).length;

  const salesFilled = rows.filter((r) => num(r.sales) !== null).length;
  const camDays = rows.filter((r) => num(r.cameras) !== null).length;
  const timePct = salesFilled / daysInMonth;
  const planPct = plan.salesPlan > 0 ? sales / plan.salesPlan : 0;
  // Usta reytingi uchun kamera reja %
  const camPlanPct = plan.camerasPlan > 0 ? cameras / plan.camerasPlan : 0;

  const collectionPct = plan.collectionPct != null ? plan.collectionPct
    : sales > 0 ? income / sales : null;
  const npsPct = installed > 0 ? npsCollected / installed : null;

  // Faqat shu turga tegishli bonuslar hisoblanadi
  const builders = {
    sales: () => salesBonus(sales, rules),
    collection: () => collectionBonus(collectionPct, rules),
    akb: () => akbBonus(val(plan.akbFact), val(plan.akbPlan), rules),
    nps: () => npsBonus(npsPct, rules),
    cameras: () => camerasBonus(cameras, plan),
    revision: () => revisionBonus(shortage, rules),
    late: () => lateBonus(lateDays, rules),
    dayOff: () => dayOffBonus(offDays, rules),
    combo: () => ({ value: 0, max: (rules.combo?.bonus) || 0, note: "" }),
  };
  const parts = {};
  for (const k of conf.parts) parts[k] = builders[k]();

  // —— "Toza tarix" bonuslari faqat OY OXIRIDA qo'shiladi ————————
  // Kech qolmaslik, dam olmaslik va kamomadsizlik uchun bonus — bular
  // "hali yomon narsa bo'lmadi" degan asosda beriladi. Agar ularni oy
  // boshidanoq qo'shsak, 1-avgustda xodim 1 500 000 ishlab topgan bo'lib
  // ko'rinadi va oy davomida bu summa faqat KAMAYADI — noto'g'ri va
  // tushkunlikka soladi. Shuning uchun oy tugamaguncha ular kutish
  // holatida turadi (ko'rinadi, lekin jamiga qo'shilmaydi).
  const lastDay = `${month}-${String(daysInMonth).padStart(2, "0")}`;
  const monthDone = todayKey() >= lastDay;
  // Faqat usta uchun mazmunli — menejerda avans yuritilmaydi
  const carry = withCarry && type === "installer"
    ? carryOver(staffId, month, typeOverride) : { sum: 0, items: [] };

  // Combo (usta): kech va dam bonuslari IKKOVI to'liq bo'lsa qo'shimcha
  if (parts.combo && parts.late && parts.dayOff) {
    const b = (rules.combo?.bonus) || 0;
    const bothFull = parts.late.max > 0 && parts.dayOff.max > 0
      && parts.late.value >= parts.late.max && parts.dayOff.value >= parts.dayOff.max;
    parts.combo = {
      value: bothFull ? b : 0, max: b,
      note: bothFull ? "Kech + dam ikkovi to'liq" : "Ikkovi to'liq bo'lsa beriladi",
    };
  }

  // Belgilash combo hisoblangandan KEYIN — aks holda ustidan yoziladi
  const PENDING_PARTS = ["late", "dayOff", "combo", "revision"];
  if (!monthDone) {
    for (const k of PENDING_PARTS) {
      if (parts[k]) parts[k] = { ...parts[k], pending: true };
    }
  }

  // Kutilayotgan bonuslar jamiga KIRMAYDI — oy yopilgach qo'shiladi
  const bonusTotal = Object.values(parts).reduce((a, p) => a + (p.pending ? 0 : p.value), 0);
  const bonusMax = Object.values(parts).reduce((a, p) => a + p.max, 0);
  const bonusPending = Object.values(parts).reduce((a, p) => a + (p.pending ? p.value : 0), 0);

  const status = salesFilled === 0 ? "none"
    : planPct >= timePct ? "ahead"
    : planPct >= timePct * 0.8 ? "close" : "behind";

  return {
    month, staffId, type, conf, plan, rules,
    sales, payme, cash, service, income, shortage, installed, npsCollected, cameras,
    lateDays, offDays,
    clientCalls: sumOf("clientCalls"),
    newGroups: sumOf("newGroups"),
    wholesalePosts: sumOf("wholesalePosts"),
    collectionPct, npsPct,
    salesFilled, camDays, daysInMonth, timePct, planPct, camPlanPct, status,
    forecast: timePct > 0 ? Math.round(sales / timePct) : 0,
    avgDay: salesFilled > 0 ? sales / salesFilled : 0,
    avgCam: camDays > 0 ? cameras / camDays : 0,
    camMoney: Math.round(cameras * (Number(plan.rate) || 0)),
    // Usta NPS'i — retention menejer belgilaydi. % = NPS olingan / kamera
    camNps: Number(plan.nps) || 0,
    camNpsPct: cameras > 0 ? (Number(plan.nps) || 0) / cameras : null,
    olgan,   // olingan avans
    parts,
    fixed: rules.fixed,
    bonusTotal, bonusMax, bonusPending,
    monthDone,                         // oy yopilganmi
    total: rules.fixed + bonusTotal,
    // Oy oxirigacha hammasi shu holicha qolsa — shuncha bo'ladi
    totalIfKept: rules.fixed + bonusTotal + bonusPending,
    totalMax: rules.fixed + bonusMax,
    // Shu oyning o'z qoldig'i (o'tgan oylarsiz)
    monthBalance: rules.fixed + bonusTotal - olgan,
    // O'tgan oylardan ko'chib kelgan qarz/haq
    carryIn: carry.sum,
    carryFrom: carry.items,            // [{ month, balance }]
    // Umumiy qoldiq = o'tgan oylardan + shu oyniki
    qoldiq: carry.sum + rules.fixed + bonusTotal - olgan,
  };
}
