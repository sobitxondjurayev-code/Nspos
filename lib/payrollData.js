"use client";
// Ish haqi: Fix + Flex.
//
// Qoida (sozlanadigan, har xodimga alohida):
//   FIX   — oylik qat'iy maosh. Tanlangan davr to'liq oy bo'lmasa
//           kunlar soniga proporsional hisoblanadi.
//   FLEX  — kassirlar uchun: shaxsiy sotuv tushumidan foiz.
//           Ustalar uchun: xizmat summasidan ulush (servicesData'da hisoblanadi).
//   BONUS — do'kon davr rejasini bajarsa beriladigan qat'iy summa.
//
// Nima uchun shunday: chekda kassir allaqachon yozilyapti, xizmatda usta
// biriktirilgan — ya'ni ikkala flex ham qo'shimcha ma'lumot kiritmasdan
// hisoblanadi. Reja bonusi esa jamoani umumiy natijaga bog'laydi.
import { listStaff, getStaff } from "./staffData";
import { salesInRange } from "./salesData";
import { installerStats } from "./servicesData";
import { demoStores } from "./demoData";
import { syncTable } from "./sync";
import { registerModule, DEMO_MODE, upsert } from "./db";
import { computeMonth, hasType } from "./kpiData";
import { getUsdRate } from "./companyData";
import { oyKursi } from "./ratesData";
import { listOps } from "./kassaData";
import { expensesInRange } from "./expensesData";
import { ymd } from "./dates";

// Reja bitta qator: bor bo'lsa yangilanadi, yo'q bo'lsa qo'shiladi
// Xato toastga (`db.upsert`) — ilgari faqat konsolga yozilardi va
// rahbar bo'lmagan xodim rejani "o'zgartirdi" deb o'ylardi (2026-09-03)
function upsertPlan(storeId, monthly) {
  if (DEMO_MODE) return;
  upsert("store_plans", { store_id: storeId, monthly, updated_at: new Date().toISOString() }, "store_id", "Do'kon rejasi");
}

const DAY = 86400000;

// Do'kon oylik rejasi (USD). Sozlamalarda o'zgartirilishi mumkin.
let storePlans = { s1: 60000, s2: 25000, s3: 0 };

// —— Baza: do'kon rejalari ————————————————————
// Reja bitta qator: store_id birlamchi kalit (schema.sql).
registerModule("store_plans", {
  table: "store_plans",
  restore(rows) {
    for (const r of rows) storePlans[r.store_id] = Number(r.monthly);
  },
});

export const getStorePlans = () => ({ ...storePlans });
export function setStorePlan(storeId, amount) {
  upsertPlan(storeId, amount);
  storePlans = { ...storePlans, [storeId]: Math.max(0, Number(amount) || 0) };
}

// Davr necha kunni qamraydi — fixni proporsional hisoblash uchun
function periodDays(from, to) {
  const a = new Date(from), b = new Date(to);
  // floor + 1: "to" kun oxiri bo'lgani uchun round ishlatilsa bir kun ortiq chiqadi
  return Math.max(1, Math.floor((b.getTime() - a.getTime()) / DAY) + 1);
}

// Davrdagi kun soni oyning necha ulushi ekanini beradi (30 kunlik oy asosida)
const monthFraction = (from, to) => Math.min(1, periodDays(from, to) / 30);

// —— Do'kon bo'yicha reja bajarilishi ————————————————
export function storePerformance(from, to) {
  const sales = salesInRange(from, to);
  const out = {};
  for (const s of demoStores) {
    // Qaytarishlar manfiy, shuning uchun oddiy qo'shish yetarli
    const revenue = +sales.filter((x) => x.storeId === s.id)
      .reduce((a, x) => a + x.total, 0).toFixed(2);
    const plan = +((storePlans[s.id] ?? 0) * monthFraction(from, to)).toFixed(2);
    out[s.id] = {
      revenue, plan,
      pct: plan > 0 ? +((revenue / plan) * 100).toFixed(1) : null,
      achieved: plan > 0 && revenue >= plan,
    };
  }
  return out;
}

// —— Xodim bo'yicha hisob ————————————————————————
export function payrollRows(from, to) {
  const perf = storePerformance(from, to);
  const sales = salesInRange(from, to);
  const installers = installerStats(from, to);
  const frac = monthFraction(from, to);

  return listStaff()
    // Rahbarlar oylik olmaydi — ular NS orqali oladi
    .filter((s) => s.active && s.role !== "owner")
    .map((s) => {
      // Ish haqi shartlari xodim obyektida YASSI turadi: salary (fiksa),
      // salesPct, planBonus — bazadagi ustunlar bilan bir xil nom.
      // Eski demo ma'lumotida ular `salary: { fixed, salesPct, planBonus }`
      // obyekti edi; bazadan esa `salary` oddiy raqam bo'lib kelardi va
      // `cfg.fixed` undefined chiqib, jonli rejimda FIKSA NOLGA aylanardi.
      const nested = s.salary && typeof s.salary === "object" ? s.salary : null;
      const cfg = {
        fixed: nested ? (nested.fixed ?? 0) : (Number(s.salary) || 0),
        salesPct: nested ? (nested.salesPct ?? 0) : (Number(s.salesPct) || 0),
        planBonus: nested ? (nested.planBonus ?? 0) : (Number(s.planBonus) || 0),
      };

      // Fix — davrga proporsional
      const fixed = +((cfg.fixed ?? 0) * frac).toFixed(2);

      // Flex 1: kassirning shaxsiy sotuvi (chekdagi "cashier" nomi bo'yicha)
      const personalSales = +sales.filter((x) => x.cashier === s.name)
        .reduce((a, x) => a + x.total, 0).toFixed(2);
      const salesBonus = +((personalSales * (cfg.salesPct ?? 0)) / 100).toFixed(2);

      // Flex 2: ustaning xizmat ulushi
      const inst = installers.find((i) => i.installer?.id === s.id);
      const serviceShare = inst?.share ?? 0;

      // Bonus: xodim biriktirilgan do'kon rejani bajardimi
      const storeHit = s.storeId ? perf[s.storeId]?.achieved : false;
      const planBonus = storeHit ? +(cfg.planBonus ?? 0) : 0;

      const total = +(fixed + salesBonus + serviceShare + planBonus).toFixed(2);

      return {
        staff: s,
        fixed, personalSales, salesBonus,
        serviceOrders: inst?.orders ?? 0, serviceRevenue: inst?.servicesTotal ?? 0, serviceShare,
        planBonus, storeHit,
        total,
      };
    })
    .filter((r) => r.total > 0 || r.personalSales > 0 || r.serviceShare > 0)
    .sort((a, b) => b.total - a.total);
}

// —— KPI moduli hisoblagan oylik ————————————————————
// Haqiqiy ish haqi shu yerda: KPI jadvali (fiksa + bonuslar, ustada
// kamera × narx). U SO'MDA yuritiladi, moliya esa dollarda — shuning
// uchun kompaniya sozlamasidagi kurs bo'yicha o'giriladi.
//
// Kurs qo'yilmagan bo'lsa usd = null qaytadi va foyda hisobotiga
// QO'SHILMAYDI: taxminiy kurs bilan noto'g'ri foyda ko'rsatgandan
// ko'ra, ochiq "kurs kiriting" degani to'g'riroq.
function monthsBetween(from, to) {
  const out = [];
  const d = new Date(from);
  d.setDate(1);
  const end = new Date(to);
  while (d <= end) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

export function kpiPayroll(from, to) {
  const months = monthsBetween(from, to);
  // Rahbarlar bu hisobga kirmaydi: ularning puli oylik emas, NS
  const staff = listStaff().filter((s) => s.active !== false && s.role !== "owner");
  const byStaff = [];
  let som = 0, usd = 0;
  // HAR OY O'Z KURSI bilan (DAFTAR 20 G) — yopilgan oy raqami bugungi
  // kurs bilan suzmaydi. Qoida: `ratesData.oyKursi`.
  const kurslar = Object.fromEntries(months.map((m) => [m, oyKursi(m)]));
  const kursYoq = months.some((m) => !(kurslar[m].rate > 0));

  for (const s of staff) {
    let personal = 0, personalUsd = 0;
    for (const m of months) {
      if (!hasType(s.id)) continue;          // KPI biriktirilmagan xodim
      const t = computeMonth(s.id, m).total;
      personal += t;
      if (kurslar[m].rate > 0) personalUsd += t / kurslar[m].rate;
    }
    if (personal > 0) {
      som += personal; usd += personalUsd;
      byStaff.push({ staff: s, som: personal, usd: +personalUsd.toFixed(2) });
    }
  }

  // `rate` — ko'rsatish uchun oxirgi oyning kursi; hisob har oy o'ziniki
  const rate = kurslar[months.at(-1)]?.rate ?? getUsdRate();
  return {
    months, som, rate, kurslar,
    usd: kursYoq ? null : +usd.toFixed(2),
    byStaff: byStaff.sort((a, b) => b.som - a.som),
  };
}

export function payrollSummary(from, to) {
  const rows = payrollRows(from, to);
  const sum = (k) => +rows.reduce((a, r) => a + r[k], 0).toFixed(2);
  const kpi = kpiPayroll(from, to);
  return {
    count: rows.length,
    fixed: sum("fixed"),
    salesBonus: sum("salesBonus"),
    serviceShare: sum("serviceShare"),
    planBonus: sum("planBonus"),
    total: sum("total"),
    // KPI moduli bo'yicha (so'mda va dollarda)
    kpiSom: kpi.som,
    kpiUsd: kpi.usd,
    kpiRate: kpi.rate,
    kpiStaff: kpi.byStaff,
  };
}

// —— ISH HAQI XARAJATI — BITTA MANBA ————————————————
// "Bu davrda ish haqi qancha bo'ldi?" degan savolga javob beradigan
// YAGONA funksiya. Foyda hisoboti (P&L), rahbariyat paneli, balans va
// Moliya bosh sahifasi — hammasi shu yerdan o'qiydi.
//
// Nega kerak bo'ldi (2026-08-14): uch joyda uch xil hisoblanardi —
// P&L `kpiUsd` ni (2 881.25), rahbariyat paneli `fixed+bonus` ni (0),
// balans esa yana boshqasini olardi. Natijada rahbar bir ekranda sof
// foyda 628.33, boshqasida 1 000.24 ko'rardi.
//
// Qoida: KPI jadvali bo'yicha hisoblangan oylik ustun turadi (haqiqiy
// ish haqi shu yerda yuritiladi). KPI biriktirilmagan bo'lsa — eski
// hisob: qat'iy maosh + sotuvdan foiz + reja bonusi. Ustaning xizmat
// ulushi (`serviceShare`) bu yerga KIRMAYDI: u xizmat foydasida
// allaqachon chegirilgan.
export function payrollCost(from, to) {
  const s = payrollSummary(from, to);
  // YIG'INDI, "yoki-yoki" emas (DAFTAR 20 H): KPI hisobi bor xodim — KPI
  // bo'yicha; qolganlar (qat'iy maosh + sotuv foizi + reja bonusi).
  // Ilgari `kpiUsd > 0 ? kpiUsd : profil` edi — bitta xodimda KPI bo'lsa
  // KPI'siz hamma hisobdan tushardi.
  const kpiIds = new Set((s.kpiStaff ?? []).map((x) => x.staff.id));
  const profil = +payrollRows(from, to)
    .filter((r) => !kpiIds.has(r.staff.id))
    .reduce((a, r) => a + r.fixed + r.salesBonus + r.planBonus, 0).toFixed(2);
  return +((s.kpiUsd ?? 0) + profil).toFixed(2);
}

// —— BERILGAN OYLIK — pul qaysi yo'l bilan chiqqan bo'lsa ham ——————
// DAFTAR 20 (H): oylik uch yo'l bilan beriladi va ilgari faqat ikkitasi
// sanalardi — "to'lanmagan ish haqi" oshib ko'rinardi:
//   xarajat   — Xarajatlar bo'limi, tur "Oylik" (menejer/kassir oyligi)
//   usta      — KPI jadvalidagi "Olgan pul" (virtual xarajat, `source: installer`)
//   kassa     — Pul rejasi / Ish haqi sahifasi orqali `kassa_ops` (category salary)
// `payroll_payments` jurnali SANALMAYDI: Ish haqi sahifasi to'lovni
// jurnalga ham, `kassa_ops` ga ham yozadi — ikkalasi bir pul.
export function berilganOylik(from, to) {
  const a = ymd(from), b = ymd(to);
  let usta = 0, xarajat = 0;
  for (const e of expensesInRange(from, to)) {
    if (e.category !== "salary") continue;
    if (e.source === "installer") usta += e.amount; else xarajat += e.amount;
  }
  const kassa = +listOps().filter((o) => o.kind === "out" && o.category === "salary" && o.date >= a && o.date <= b)
    .reduce((s, o) => s + o.amount, 0).toFixed(2);
  usta = +usta.toFixed(2); xarajat = +xarajat.toFixed(2);
  return { usta, xarajat, kassa, jami: +(usta + xarajat + kassa).toFixed(2) };
}

// —— To'langan ish haqi jurnali ————————————————————
let payments = [];
let paySeq = 0;

// —— Baza: to'langan ish haqi ————————————————
const payrollSync = syncTable("payroll_payments", {
  table: "payroll_payments",
  order: { column: "paid_at", ascending: false },
  get: () => payments,
  set: (v) => { payments = v; },
  sort: (a, b) => new Date(b.at) - new Date(a.at),
  fromRow: (r) => ({
    id: r.id,
    no: "IH-" + String(r.id).slice(0, 6),
    staffId: r.staff_id,
    staffName: getStaff(r.staff_id)?.name ?? "",
    amount: Number(r.amount),
    periodFrom: r.period_from,
    periodTo: r.period_to,
    method: r.method,
    note: r.note ?? "",
    at: r.paid_at,
  }),
  toRow: (x) => ({
    staff_id: x.staffId,
    amount: x.amount,
    period_from: x.periodFrom,
    period_to: x.periodTo,
    method: x.method,
    note: x.note || null,
    paid_at: x.at,
  }),
});

export const listPayrollPayments = () =>
  [...payments].sort((a, b) => new Date(b.at) - new Date(a.at));

export function payStaff({ staffId, amount, periodFrom, periodTo, method = "cash", note = "" }) {
  const p = {
    id: "pay" + Date.now() + "-" + paySeq++,
    no: "IH-" + (600 + payments.length),
    staffId,
    staffName: getStaff(staffId)?.name ?? "",
    amount: +(+amount).toFixed(2),
    periodFrom: new Date(periodFrom).toISOString().slice(0, 10),
    periodTo: new Date(periodTo).toISOString().slice(0, 10),
    method, note,
    at: new Date().toISOString(),
  };
  payments = [p, ...payments];
  payrollSync.created(p);
  return p;
}

// Shu davr uchun allaqachon to'langan summa
export function paidFor(staffId, from, to) {
  const a = new Date(from).toISOString().slice(0, 10);
  const b = new Date(to).toISOString().slice(0, 10);
  return +payments
    .filter((p) => p.staffId === staffId && p.periodFrom === a && p.periodTo === b)
    .reduce((s, p) => s + p.amount, 0).toFixed(2);
}
