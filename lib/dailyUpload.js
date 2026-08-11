// ══════════════════════════════════════════════════════════════
// BILLZ KUNLIK YAKUNI ("Сводный отчет")
// ══════════════════════════════════════════════════════════════
// Manba: Billz → Hisobotlar → "Сводный отчет".
// Ustunlari: Дата | Магазин | Выручка | Чистая выручка | … | Валовая прибыль
//
// Nega aynan shu hisobot: P&L uchun ikkita narsa kerak — kunlik tushum
// va kunlik TANNARX. Tranzaksiya eksportida tannarx yo'q, "Прибыли и
// убытки" da esa bor-u faqat oylik. Kunlik yakunda ikkalasi ham bor:
//
//     tannarx = sof tushum − yalpi foyda
//
// Ilgari bu raqamlar lib/billzExport.js ichida muzlatilgan edi
// (EXPORT_DAILY, 22-iyul). Endi yuklama bo'lsa o'shandan o'qiladi.
import { listDatasets } from "./datasets";
import { storeOfKassaName } from "./kassaIncome";

const REPORT_ID = "summary";

// Ustun nomi tilga qarab o'zgarishi mumkin — bir nechtasini qabul qilamiz
const col = (header, ...names) =>
  header.find((h) => names.some((n) => String(h).toLowerCase().includes(String(n).toLowerCase()))) ?? null;

const num = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const x = parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(x) ? x : 0;
};

// "2026-02-01", Date, yoki "01.02.2026" — hammasi YYYY-MM-DD ga
const day = (v) => {
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  const s = String(v ?? "").trim();
  const dot = s.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (dot) return `${dot[3]}-${dot[2]}-${dot[1]}`;
  return s.slice(0, 10);
};

// Yuklangan kunlik yakun. Yo'q bo'lsa { ready: false }.
export function uploadedDaily() {
  const ds = listDatasets().find((d) => d.reportId === REPORT_ID);
  if (!ds || !ds.rows?.length) return { ready: false, rows: [] };

  const h = ds.header ?? [];
  const cDate = col(h, "Дата", "Sana", "Date");
  const cStore = col(h, "Магазин", "Do'kon", "Store");
  const cRevenue = col(h, "Выручка");           // "Чистая выручка" ham shunga tushmasin —
  const cNet = col(h, "Чистая выручка");        // shuning uchun aniqrog'i alohida qidiriladi
  const cGross = col(h, "Валовая прибыль", "Yalpi foyda");
  if (!cDate || !cStore || !cGross) return { ready: false, rows: [] };

  // "Выручка" qidiruvi "Чистая выручка" ni ham tutib olishi mumkin —
  // ular bir xil bo'lsa, yalang'och "Выручка" ni qo'lda tanlaymiz
  const cRev = cRevenue === cNet ? h.find((x) => String(x).trim() === "Выручка") ?? cRevenue : cRevenue;

  const rows = [];
  for (const r of ds.rows) {
    const date = day(r[cDate]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const storeId = storeOfKassaName(r[cStore]);
    const netRevenue = cNet ? num(r[cNet]) : num(r[cRev]);
    const grossProfit = num(r[cGross]);
    rows.push({
      date, storeId,
      revenue: num(r[cRev]),
      netRevenue,
      grossProfit,
      // Tannarx shu yerda bir marta hisoblanadi — chaqiruvchilar
      // takror-takror ayirmasin
      cogs: +(netRevenue - grossProfit).toFixed(2),
    });
  }
  return { ready: rows.length > 0, rows, at: ds.at ?? null };
}

// Oraliq bo'yicha yakun. Do'kon berilsa faqat o'sha do'kon.
export function dailyTotals(from, to, storeId = null) {
  const { ready, rows } = uploadedDaily();
  if (!ready) return { ready: false, revenue: 0, netRevenue: 0, grossProfit: 0, cogs: 0, days: 0 };

  const a = String(from).slice(0, 10), b = String(to).slice(0, 10);
  const hit = rows.filter((r) => r.date >= a && r.date <= b && (!storeId || r.storeId === storeId));
  const sum = (k) => +hit.reduce((s, r) => s + r[k], 0).toFixed(2);
  return {
    ready: true,
    revenue: sum("revenue"),
    netRevenue: sum("netRevenue"),
    grossProfit: sum("grossProfit"),
    cogs: sum("cogs"),
    days: new Set(hit.map((r) => r.date)).size,
  };
}
