"use client";
// ══════════════════════════════════════════════════════════════
// SERVIS KASSASINING KIRIMI
// ══════════════════════════════════════════════════════════════
// Servis kassasiga pul Billz'dan keladi. Billz'da xizmat alohida bo'lim
// emas — u oddiy tovar kabi sotiladi ("montaj"), shuning uchun kirim
// tovar nomlari bo'yicha ajratiladi. Qaysi nomlar xizmat ekani
// Sozlamalarda belgilanadi (companyData.getServiceNames).
//
// Manba — "Эффективность товаров" yuklamasi (tahlil: "Servis foydasi").
// Diqqat: bu hisobotda KUNLIK taqsimot yo'q, davri ustun nomida yozilgan
// bo'ladi: "Продажи товаров 2026-06-20 - 2026-08-04 · ...". Shuning uchun
// so'ralgan davrga KUNLAR NISBATIDA bo'lib beriladi va hisobotda
// yuklama qaysi davrni qamragani yozib qo'yiladi — raqam qayerdan
// kelgani ko'rinib tursin.
//
// Qatorlarni ajratish mantig'i ServiceReport.jsx dagi bilan bir xil:
// ikkalasi ham `isServiceName` ga tayanadi.
import { listDatasets, numberOf, textOf } from "./datasets";
import { isServiceName } from "./companyData";

const REPORT_ID = "efficiency";
const DAY = 86400000;

const day = (v) => {
  const d = v instanceof Date ? v : new Date(v);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
};

// Ustun nomlaridagi davr: "… 2026-06-20 - 2026-08-04 …"
function periodOf(header = []) {
  for (const h of header) {
    const m = String(h).match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
    if (m) return { from: m[1], to: m[2] };
  }
  return null;
}

// —— Servis kirimi ————————————————————————————————
// Qaytadi: { revenue, ready, period, covered }
//   ready   — yuklama bor va qatorlari o'qilgan
//   period  — yuklama qamragan davr (interfeysda ko'rsatiladi)
//   covered — shu davrning so'ralgan oraliqqa tushgan ulushi (0…1)
export function billzServiceIncome(from, to) {
  const ds = listDatasets().find((d) => d.reportId === REPORT_ID);
  const period = ds ? periodOf(ds.header) : null;
  const empty = { revenue: 0, ready: false, period, covered: 0 };

  // Qatorlar ro'yxat bilan birga kelmaydi — kerak bo'lganda tortiladi
  if (!ds || !ds.rows?.length) return empty;

  const header = ds.header ?? [];
  const nameCol = header.find((h) => h === "Наименование")
    ?? header.find((h) => h.toLowerCase().includes("наименование"));
  const qtyCol = header.find((h) => h.startsWith("Продажи товаров") && h.endsWith("Кол-во"));
  const revCol = header.find((h) => h.startsWith("Продажи товаров") && h.includes("скидк"));
  const revListCol = header.find((h) => h.startsWith("Продажи товаров")
    && h.includes("Сумма продажи") && !h.includes("скидк"));
  if (!nameCol || !qtyCol) return empty;

  let total = 0;
  for (const r of ds.rows) {
    if (numberOf(r, qtyCol) <= 0) continue;
    if (!isServiceName(textOf(r, nameCol))) continue;
    total += numberOf(r, revCol) || numberOf(r, revListCol);
  }

  // Davr bo'yicha ulush. Yuklama davri noma'lum bo'lsa to'liq olinadi.
  let covered = 1;
  if (period && from && to) {
    const pFrom = day(period.from), pTo = day(period.to);
    const rFrom = day(from), rTo = day(to);
    const overlap = Math.min(pTo, rTo) - Math.max(pFrom, rFrom) + DAY;
    const span = pTo - pFrom + DAY;
    covered = span > 0 ? Math.max(0, Math.min(1, overlap / span)) : 0;
  }

  return { revenue: +(total * covered).toFixed(2), ready: true, period, covered };
}
