"use client";
// Hisobotlar uchun hisob-kitoblar: ombor qoplamasi va ABC-analiz.
import { demoStores } from "./demoData";
import { listProducts, totalQty } from "./productsData";
import { salesInRange } from "./salesData";
import { listCustomers } from "./customersData";
import { EXPORT_EFFICIENCY } from "./billzExport";

const DAY = 86400000;

// —— 1. Ombor qoplamasi: "necha kunga yetadi" ————————————————
// Kunlik sotuv tezligi Billz "Tovar samaradorligi" hisobotidan olinadi
// (salesSpeed = sotilgan dona / tovar mavjud bo'lgan kunlar). Bu oddiy
// "davr bo'yicha o'rtacha" dan aniqroq: tovar omborda bo'lmagan kunlar
// tezlikni sun'iy pasaytirmaydi.
//
// NSPOS'da yozilgan yangi cheklar (tarkibi bor) shu tezlikka qo'shiladi.
// storeId tanlansa tezlik shu do'konning qoldiq ulushiga qarab
// bo'linadi — Billz tezlikni do'kon kesimida bermaydi.
const effByBarcode = new Map(EXPORT_EFFICIENCY.map((e) => [e.barcode, e]));

export function stockCoverage({ windowDays = 30, storeId = "all", now = new Date() } = {}) {
  const from = new Date(now.getTime() - windowDays * DAY);
  const sales = salesInRange(from, now).filter(
    (s) => !s.imported && (storeId === "all" || s.storeId === storeId)
  );

  // NSPOS cheklaridagi sotuv (Billz cheklarida tovar tarkibi yo'q)
  const sold = new Map();
  for (const s of sales) {
    for (const i of s.items) {
      sold.set(i.productId, (sold.get(i.productId) || 0) + i.qty);
    }
  }

  return listProducts()
    .map((p) => {
      const total = totalQty(p);
      const stock = storeId === "all" ? total : (p.stock[storeId] ?? 0);
      const share = storeId === "all" || total <= 0 ? 1 : Math.max(0, stock) / total;

      const eff = effByBarcode.get(p.barcode);
      const billzSpeed = (eff?.salesSpeed ?? 0) * share;
      const recentQty = sold.get(p.id) || 0;
      const avgDaily = +(billzSpeed + recentQty / windowDays).toFixed(3);

      // Sotuv bo'lmagan tovar uchun "yetadigan kun" ni hisoblab bo'lmaydi
      const daysLeft = avgDaily > 0 ? Math.round(stock / avgDaily) : null;
      return {
        product: p, stock, avgDaily, daysLeft,
        soldQty: recentQty,
        soldTotal: eff?.soldQty ?? 0,        // yil boshidan sotilgan (Billz)
        stockValue: +(stock * p.costPrice).toFixed(2),
      };
    })
    .sort((a, b) => {
      // Eng kam qolganlar tepada; sotuvi yo'qlar oxirida
      if (a.daysLeft == null) return 1;
      if (b.daysLeft == null) return -1;
      return a.daysLeft - b.daysLeft;
    });
}

// Ogohlantirish darajalari
export const coverageLevel = (d) =>
  d == null ? "none" : d <= 7 ? "critical" : d <= 21 ? "low" : "ok";

// —— 2. ABC-analiz ————————————————————————————————————
// Kumulyativ tushum bo'yicha: A — 80% gacha, B — 95% gacha, C — qolgani.
function classify(rows, valueKey) {
  const total = rows.reduce((a, r) => a + r[valueKey], 0);
  let cum = 0;
  return rows.map((r) => {
    cum += r[valueKey];
    const cumPct = total > 0 ? (cum / total) * 100 : 0;
    return {
      ...r,
      share: total > 0 ? +((r[valueKey] / total) * 100).toFixed(2) : 0,
      cumPct: +cumPct.toFixed(2),
      abc: cumPct <= 80 ? "A" : cumPct <= 95 ? "B" : "C",
    };
  });
}

// Mijozlar kesimida ABC
export function customerABC(from, to) {
  const byCustomer = new Map();
  for (const s of salesInRange(from, to)) {
    if (!s.customerId) continue;
    const cur = byCustomer.get(s.customerId) || { revenue: 0, orders: 0 };
    cur.revenue += s.total;
    cur.orders += 1;
    byCustomer.set(s.customerId, cur);
  }

  const rows = listCustomers()
    .map((c) => {
      const agg = byCustomer.get(c.id);
      if (!agg) return null;
      return {
        customer: c,
        revenue: +agg.revenue.toFixed(2),
        orders: agg.orders,
        avgCheck: +(agg.revenue / agg.orders).toFixed(2),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.revenue - a.revenue);

  return classify(rows, "revenue");
}

// Tovarlar kesimida ABC (6-bosqich uchun ham asqotadi)
export function productABC(from, to) {
  const byProduct = new Map();
  for (const s of salesInRange(from, to)) {
    for (const i of s.items) {
      const cur = byProduct.get(i.productId) || { revenue: 0, qty: 0 };
      cur.revenue += i.total;
      cur.qty += i.qty;
      byProduct.set(i.productId, cur);
    }
  }

  const rows = listProducts()
    .map((p) => {
      const agg = byProduct.get(p.id);
      if (!agg) return null;
      return { product: p, revenue: +agg.revenue.toFixed(2), qty: agg.qty };
    })
    .filter(Boolean)
    .sort((a, b) => b.revenue - a.revenue);

  return classify(rows, "revenue");
}

export const ABC_COLORS = {
  A: { bg: "bg-emerald-50", text: "text-emerald-700" },
  B: { bg: "bg-amber-50", text: "text-amber-700" },
  C: { bg: "bg-slate-100", text: "text-muted" },
};

export const storeOptions = [{ id: "all", name: "Barcha do'konlar" }, ...demoStores];
