// ══════════════════════════════════════════════════════════════
// BILLZ P&L YUKLAMASI
// ══════════════════════════════════════════════════════════════
// Manba: Billz → Hisobotlar → "Отчет прибыли и убытки".
//
// Ilgari bu raqamlar lib/billzExport.js ga yozib qo'yilgan edi — ya'ni
// 22-iyulda muzlatilgan nusxa. Yangi eksport yuklansa ham P&L qimirlamas
// edi. Endi yuklama bor bo'lsa o'shandan o'qiladi, bo'lmasa eski nusxaga
// qaytadi (interfeys bo'sh qolmasin).
//
// Faylning tuzilishi g'alati: har do'kon uchun bitta blok, blok ichida
// har qator — ko'rsatkich nomi, ustunlar esa oylar. Do'kon nomi faqat
// blokning birinchi qatorida turadi, qolganida bo'sh. Shu sababli
// "oxirgi ko'rilgan do'kon" eslab boriladi.
import { listDatasets } from "./datasets";

const REPORT_ID = "pnl";

// Billz ko'rsatkich nomlari → ichki nomlar (convert-billz.cjs bilan bir xil)
const ROW_MAP = {
  "Выручка": "revenue",
  "Скидки": "discounts",
  "Возвраты": "returns",
  "Чистая выручка": "netRevenue",
  "ИТОГО ДОХОДОВ": "totalIncome",
  "СЕБЕСТОИМОСТЬ ТОВАРОВ": "cogs",
  "МАРЖИНАЛЬНАЯ ПРИБЫЛЬ": "grossProfit",
  "Списание по себестоимости": "writeoffCost",
  "ИТОГО РАСХОДОВ": "totalExpense",
  "ЧИСТАЯ ПРИБЫЛЬ": "netProfit",
};

const STORE_ID = {
  "NScamera Optim": "s1",
  "NScamera Namangan": "s2",
  "Склад": "s3",
};

const num = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? +v.toFixed(4) : 0;
  const x = parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(x) ? +x.toFixed(4) : 0;
};

// Rentabellikni Billz'dan olmaymiz: uning "Всего" ustuni oylik
// foizlarning YIG'INDISI (7 oy × ~33% = 229%) — ma'nosiz raqam.
const marginPct = (r) =>
  r.netRevenue > 0 ? +((r.grossProfit / r.netRevenue) * 100).toFixed(2) : 0;

// Yuklangan P&L. Yo'q bo'lsa { ready: false }.
export function uploadedPnl() {
  const ds = listDatasets().find((d) => d.reportId === REPORT_ID);
  if (!ds || !ds.rows?.length) return { ready: false, rows: [], months: [], at: null };

  const header = ds.header ?? [];
  // Birinchi uchta ustun: do'kon, ko'rsatkich, "Всего". Qolgani — oylar.
  const monthCols = header.slice(3).filter((h) => String(h ?? "").trim());
  const months = monthCols.map(String);

  const out = [];
  let cur = null;
  for (const r of ds.rows) {
    // Qatorlar massiv ham, obyekt ham bo'lishi mumkin — ikkalasini qo'llaymiz
    const cell = (i) => (Array.isArray(r) ? r[i] : r[header[i]]);
    const store = String(cell(0) ?? "").trim();
    const type = String(cell(1) ?? "").trim();

    if (store) {
      cur = { store, storeId: STORE_ID[store] ?? null, byMonth: {} };
      out.push(cur);
    }
    if (!cur || !type) continue;

    const key = ROW_MAP[type];
    if (!key) continue;

    cur[key] = num(cell(2));
    months.forEach((m, i) => {
      (cur.byMonth[m] ??= {})[key] = num(cell(3 + i));
    });
  }

  for (const p of out) {
    p.grossMarginPct = marginPct(p);
    for (const m of Object.values(p.byMonth)) m.grossMarginPct = marginPct(m);
  }

  return { ready: out.length > 0, rows: out, months, at: ds.at ?? null };
}
