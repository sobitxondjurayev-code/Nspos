// Billz eksport fayllarini lib/billzExport.js ga aylantiradi.
//
// Katta fayllar (tranzaksiyalar, tovar sotuvlari) ixcham massiv formatida
// yoziladi: kalitlar minglab marta takrorlanmasin. Juda katta hisobotlar
// (mijoz xaridlari — 29 000 qator) tovar kesimida yig'iladi.
//
// Ishga tushirish:  node scripts/convert-billz.cjs
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const dir = "/Users/mirjalolurinboev/Downloads";
const all = fs.readdirSync(dir).filter((f) => f.endsWith(".xlsx") && !f.startsWith("~$"));

// Yillik faylni afzal ko'ramiz, bo'lmasa bir kunlikni
function pick(namePart) {
  const year = all.find((f) => f.includes(namePart) && f.includes("2026-01-01"));
  return year ?? all.find((f) => f.includes(namePart));
}
function rows(namePart) {
  const f = pick(namePart);
  if (!f) { console.warn("  ! topilmadi:", namePart); return []; }
  const wb = XLSX.readFile(path.join(dir, f));
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
}

const STORE = {
  "NScamera Optim": "s1", "NScamera Namangan": "s2", "Склад": "s3",
  "NSkamera": "s1", "Cashbox nskamera namangan": "s2", "Касса NSkamera": "s1",
  "Касса Склад": "s3",
};
const n = (v) => {
  const x = typeof v === "number" ? v : parseFloat(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(x) ? +x.toFixed(4) : 0;
};
const q = (s) => JSON.stringify(String(s ?? "").trim());
const day = (v) => String(v).slice(0, 10);

// ═══ 1. Qoldiqlar → katalog ═══════════════════════════════
const stockRows = rows("остаткам");
const catalog = new Map();
for (const r of stockRows.slice(1)) {
  const [store, name, sku, barcode, , category, brand, supplier, , sale, cost, qty] = r;
  if (!name) continue;
  const key = String(barcode || name);
  if (!catalog.has(key)) {
    catalog.set(key, {
      name: String(name).trim(), sku: String(sku || "").trim(), barcode: String(barcode || ""),
      category: String(category || "").trim() || "Boshqa", brand: String(brand || "").trim(),
      supplier: String(supplier || "").trim(),
      salePrice: n(sale), costPrice: n(cost), stock: { s1: 0, s2: 0, s3: 0 },
    });
  }
  const p = catalog.get(key);
  const sid = STORE[String(store).trim()];
  if (sid) p.stock[sid] += Number(qty) || 0;
  if (n(cost) > 0) p.costPrice = n(cost);
}
const products = [...catalog.values()];

// ═══ 2. Mijozlar ══════════════════════════════════════════
const custRows = rows("клиентам");
const CH = custRows[0] ?? [];
const ci = (name) => CH.findIndex((h) => String(h).trim() === name);
const customers = custRows.slice(1)
  .filter((r) => r[ci("ФИО клиента")])
  .map((r) => ({
    name: String(r[ci("ФИО клиента")]).trim(),
    phone: String(r[ci("Телефон")] || "").trim(),
    registeredAt: day(r[ci("Дата регистрации")]),
    storeId: STORE[String(r[ci("Магазин регистрации")]).trim()] ?? "s1",
    purchases: n(r[ci("Общая сумма покупок (всего)")]),
    salesCount: Number(r[ci("Продажи (всего)")]) || 0,
    itemsBought: Number(r[ci("Кол-во купленных товаров (всего)")]) || 0,
    returning: r[ci("Возвращающийся клиент")] === "yes",
  }))
  .sort((a, b) => b.purchases - a.purchases);

// ═══ 3. Tranzaksiyalar (asosiy tarix) ═════════════════════
const txRows = rows("транзакциям");
const TH = txRows[0] ?? [];
const ti = (name) => TH.findIndex((h) => String(h).trim() === name);
const TYPE = { "Продажа": "sale", "Возврат": "return", "Обмен": "exchange" };
const transactions = txRows.slice(1)
  .filter((r) => r[0])
  .map((r) => ({
    at: String(r[ti("Дата")]).replace(" ", "T"),
    no: String(r[ti("ID транзакции")]),
    storeId: STORE[String(r[ti("Магазин")]).trim()] ?? "s1",
    customer: String(r[ti("ФИО клиента")] || "").trim(),
    cashier: String(r[ti("ФИО кассира")] || "").trim(),
    type: TYPE[String(r[ti("Тип транзакции")]).trim()] ?? "sale",
    debt: n(r[ti("В долг")]),
    payme: n(r[ti("Payme")]),
    cash: n(r[ti("Наличные")]),
    cashback: n(r[ti("Оплата кэшбэком")]),
    items: Number(r[ti("Кол-во проданных товаров и услуг")]) || 0,
    returned: Number(r[ti("Кол-во возвращенных товаров")]) || 0,
    total: n(r[ti("Сумма транзакции")]),
    discount: n(r[ti("Скидка")]),
  }));

// ═══ 4. Kunlik yakun (dashboard grafigi) ══════════════════
const daily = rows("Сводный").slice(1)
  .filter((r) => r[0] && r[1])
  .map((r) => ({
    date: day(r[0]),
    storeId: STORE[String(r[1]).trim()] ?? "s1",
    revenue: n(r[2]), netRevenue: n(r[3]), grossProfit: n(r[6]),
  }));

// ═══ 5. P&L oylar kesimida ════════════════════════════════
const pnlRows = rows("прибыли и убытки");
const PNL_MAP = {
  "Выручка": "revenue", "Скидки": "discounts", "Возвраты": "returns",
  "Чистая выручка": "netRevenue", "ИТОГО ДОХОДОВ": "totalIncome",
  "СЕБЕСТОИМОСТЬ ТОВАРОВ": "cogs", "МАРЖИНАЛЬНАЯ ПРИБЫЛЬ": "grossProfit",
  "РЕНТАБЕЛЬНОСТЬ МАРЖИНАЛЬНОЙ ПРИБЫЛИ": "grossMarginPct",
  "Списание по себестоимости": "writeoffCost",
  "ИТОГО РАСХОДОВ": "totalExpense", "ЧИСТАЯ ПРИБЫЛЬ": "netProfit",
};
const months = (pnlRows[0] ?? []).slice(3).filter(Boolean).map(String);
const pnl = [];
let curPnl = null;
for (const r of pnlRows.slice(1)) {
  const [store, type, total, ...rest] = r;
  if (store) { curPnl = { store, storeId: STORE[String(store).trim()] ?? null, byMonth: {} }; pnl.push(curPnl); }
  if (!curPnl || !type) continue;
  const key = PNL_MAP[String(type).trim()];
  if (!key) continue;
  // Foizni Billz'dan olmaymiz: uning "Всего" ustuni oylik foizlarning
  // YIG'INDISI (7 oy × ~30% = 229%) — ma'nosiz. O'zimiz hisoblaymiz.
  if (key === "grossMarginPct") continue;
  curPnl[key] = n(total);
  months.forEach((m, i) => {
    if (!curPnl.byMonth[m]) curPnl.byMonth[m] = {};
    curPnl.byMonth[m][key] = n(rest[i]);
  });
}

// Marja rentabelligini qayta hisoblaymiz
const marginPct = (r) => (r.netRevenue > 0 ? +((r.grossProfit / r.netRevenue) * 100).toFixed(2) : 0);
for (const p of pnl) {
  p.grossMarginPct = marginPct(p);
  for (const m of Object.values(p.byMonth)) m.grossMarginPct = marginPct(m);
}

// ═══ 6. Tovar samaradorligi ═══════════════════════════════
// Ustun tartibi: 8 boshlang'ich qoldiq, 11 import, 27 sotuv,
// 31 hisobdan chiqarish, 40 oxirgi qoldiq, 43-47 tezlik
const effRows = rows("Эффективность");
const efficiency = new Map();
for (const r of effRows.slice(2)) {
  const name = r[1];
  if (!name) continue;
  const key = String(r[3] || name);
  if (!efficiency.has(key)) {
    efficiency.set(key, {
      name: String(name).trim(), sku: String(r[2] || "").trim(), barcode: String(r[3] || ""),
      category: String(r[4] || "").trim(), brand: String(r[5] || "").trim(),
      openQty: 0, importQty: 0, soldQty: 0, soldCost: 0, soldRevenue: 0,
      writeoffQty: 0, closeQty: 0, salesSpeed: 0, turnoverDays: 0,
    });
  }
  const e = efficiency.get(key);
  e.openQty += Number(r[8]) || 0;
  e.importQty += Number(r[11]) || 0;
  e.soldQty += Number(r[27]) || 0;
  e.soldCost += n(r[28]);
  e.soldRevenue += n(r[29]);
  e.writeoffQty += Number(r[31]) || 0;
  e.closeQty += Number(r[40]) || 0;
  // Tezlik va aylanish — eng yuqori qiymatni olamiz (do'kon kesimida takrorlanadi)
  e.salesSpeed = Math.max(e.salesSpeed, n(r[46]));
  e.turnoverDays = Math.max(e.turnoverDays, n(r[47]));
}
const productEfficiency = [...efficiency.values()]
  .filter((e) => e.soldQty > 0 || e.closeQty > 0)
  .map((e) => ({ ...e, soldCost: +e.soldCost.toFixed(2), soldRevenue: +e.soldRevenue.toFixed(2) }));

// ═══ 7. Import partiyalari ════════════════════════════════
const impRows = rows("импортам");
const IH = impRows[0] ?? [];
const ii = (name) => IH.findIndex((h) => String(h).trim() === name);
const imports = impRows.slice(1).filter((r) => r[0]).map((r) => ({
  at: String(r[ii("Дата импорта")]).replace(" ", "T"),
  importId: String(r[ii("ID импорта")]),
  orderId: String(r[ii("ID заказа")] || ""),
  storeId: STORE[String(r[ii("Магазин")]).trim()] ?? "s1",
  name: String(r[ii("Наименование")]).trim(),
  barcode: String(r[ii("Штрихкод")] || ""),
  category: String(r[ii("Категория")] || "").trim(),
  supplier: String(r[ii("Поставщик")] || "").trim(),
  qty: Number(r[ii("Кол-во импортированных")]) || 0,
  costTotal: n(r[ii("Сумма импорта по цене поставки")]),
  saleTotal: n(r[ii("Сумма импорта по цене продажи")]),
  soldQty: Number(r[ii("Продажи кол-во")]) || 0,
  soldCost: n(r[ii("Сумма продаж по цене поставки")]),
  soldRevenue: n(r[ii("Сумма продаж по цене продажи")]),
}));

// ═══ 8. Hisobdan chiqarish (sabab bilan) ══════════════════
const woRows = rows("списаниям");
const WH = woRows[0] ?? [];
const wi = (name) => WH.findIndex((h) => String(h).trim() === name);
const writeoffs = woRows.slice(1).filter((r) => r[0]).map((r) => ({
  id: String(r[wi("ID списания")]),
  reason: String(r[wi("Причина списания")] || "").trim(),
  storeId: STORE[String(r[wi("Название магазина")]).trim()] ?? "s1",
  user: String(r[wi("Имя пользователя")] || "").trim(),
  at: String(r[wi("Время создания")]).replace(" ", "T"),
  name: String(r[wi("Названия продукта")] || "").trim(),
  barcode: String(r[wi("Баркод")] || ""),
  category: String(r[wi("Категории")] || "").trim(),
  qty: Number(r[wi("Кол-во списанных товаров")]) || 0,
  costTotal: n(r[wi("Сумма по цене поставки")]),
  saleTotal: n(r[wi("Суммма по цене продажи")]),
}));

// ═══ 9. Sotuvchilar (kunlik) ══════════════════════════════
const sellers = rows("по продавцам").slice(1)
  .filter((r) => r[2] && (n(r[3]) > 0 || n(r[4]) > 0))
  .map((r) => ({
    date: day(r[0]), storeId: STORE[String(r[1]).trim()] ?? null,
    name: String(r[2]).trim(), revenue: n(r[3]), discount: n(r[4]),
  }));

// ═══ 10. Tovar sotuvlari → tovar kesimida yig'iladi ═══════
// 17 640 qatorni to'liq saqlash og'ir; tovar bo'yicha yig'amiz.
const salesRows = rows("по продажам").slice(1);
const salesAgg = new Map();
for (const r of salesRows) {
  const barcode = String(r[4] || r[2] || "");
  if (!barcode) continue;
  if (!salesAgg.has(barcode)) {
    salesAgg.set(barcode, {
      name: String(r[2]).trim(), sku: String(r[3] || "").trim(), barcode,
      category: String(r[5] || "").trim(), sold: 0, returned: 0, revenue: 0, days: new Set(),
    });
  }
  const a = salesAgg.get(barcode);
  a.sold += Number(r[6]) || 0;
  a.returned += Number(r[7]) || 0;
  a.revenue += n(r[9]);
  a.days.add(day(r[1]));
}
const productSales = [...salesAgg.values()]
  .map((a) => ({ ...a, revenue: +a.revenue.toFixed(2), activeDays: a.days.size, days: undefined }))
  .sort((a, b) => b.revenue - a.revenue);

// ═══ 11. Mijoz xaridlari → tovar bo'yicha foyda ═══════════
// 29 047 qator. Bizga kerak bo'lgani: har tovarning HAQIQIY yalpi foydasi.
const cpRows = rows("покупкам клиентов").slice(1);
const marginAgg = new Map();
for (const r of cpRows) {
  const barcode = String(r[7] || "");
  if (!barcode) continue;
  if (!marginAgg.has(barcode)) {
    marginAgg.set(barcode, { barcode, name: String(r[5]).trim(), revenue: 0, profit: 0, lines: 0 });
  }
  const m = marginAgg.get(barcode);
  m.revenue += n(r[10]);
  m.profit += n(r[11]);
  m.lines++;
}
const productMargin = [...marginAgg.values()]
  .map((m) => ({
    ...m, revenue: +m.revenue.toFixed(2), profit: +m.profit.toFixed(2),
    marginPct: m.revenue > 0 ? +((m.profit / m.revenue) * 100).toFixed(1) : 0,
  }))
  .sort((a, b) => b.profit - a.profit);

// ═══ 12. ДДС → kun + usul kesimida ════════════════════════
const ddsRows = rows("ДДС").slice(1);
const ddsAgg = new Map();
for (const r of ddsRows) {
  if (!r[0]) continue;
  const d = day(r[0]);
  const method = r[2] === "Наличные" ? "cash" : r[2] === "Payme" ? "payme" : "card";
  const key = d + "|" + method;
  if (!ddsAgg.has(key)) ddsAgg.set(key, { date: d, method, in: 0, out: 0, count: 0 });
  const a = ddsAgg.get(key);
  a.in += n(r[8]);
  a.out += n(r[6]);
  a.count++;
}
const cashflowDaily = [...ddsAgg.values()]
  .map((a) => ({ ...a, in: +a.in.toFixed(2), out: +a.out.toFixed(2) }))
  .sort((a, b) => (a.date < b.date ? 1 : -1));

// ═══ Yozish ═══════════════════════════════════════════════
const obj = (o) => "{" + Object.entries(o)
  .filter(([, v]) => v !== undefined)
  .map(([k, v]) => `${k}:${
    typeof v === "string" ? q(v)
    : v && typeof v === "object" ? "{" + Object.entries(v).map(([a, b]) =>
        `${JSON.stringify(a)}:${b && typeof b === "object"
          ? "{" + Object.entries(b).map(([c, d]) => `${c}:${d}`).join(",") + "}" : b}`).join(",") + "}"
    : v}`)
  .join(",") + "}";

const list = (arr, f = obj) => arr.map((x) => "  " + f(x) + ",").join("\n");

const out = `"use client";
// ══════════════════════════════════════════════════════════════
// BILLZ EKSPORT — HAQIQIY MA'LUMOT, 01.01.2026 – 22.07.2026
// Manba: Billz "Скачать" tugmasi orqali olingan Excel hisobotlar.
// AVTOMATIK YARATILGAN — qo'lda tahrirlamang.
// Qayta yaratish:  node scripts/convert-billz.cjs
// ══════════════════════════════════════════════════════════════

// —— Katalog (${products.length} tovar) ——
export const EXPORT_PRODUCTS = [
${list(products)}
];

// —— Mijozlar (${customers.length} ta) ——
// Ixcham: [nom, telefon, sana, do'kon, xarid, chek, dona, qaytgan]
const C = [
${customers.map((c) => "  [" + [q(c.name), q(c.phone), q(c.registeredAt), q(c.storeId),
  c.purchases, c.salesCount, c.itemsBought, c.returning ? 1 : 0].join(",") + "],").join("\n")}
];
export const EXPORT_CUSTOMERS = C.map((r) => ({
  name: r[0], phone: r[1], registeredAt: r[2], storeId: r[3],
  purchases: r[4], salesCount: r[5], itemsBought: r[6], returning: !!r[7],
}));

// —— Tranzaksiyalar (${transactions.length} ta) ——
// Ixcham: [vaqt, raqam, do'kon, mijoz, kassir, tur, qarz, payme, naqd,
//          cashback, dona, qaytgan, jami, chegirma]
const T = [
${transactions.map((t) => "  [" + [q(t.at), q(t.no), q(t.storeId), q(t.customer), q(t.cashier),
  q(t.type), t.debt, t.payme, t.cash, t.cashback, t.items, t.returned, t.total, t.discount].join(",") + "],").join("\n")}
];
export const EXPORT_TRANSACTIONS = T.map((r) => ({
  at: r[0], no: r[1], storeId: r[2], customer: r[3], cashier: r[4], type: r[5],
  debt: r[6], payme: r[7], cash: r[8], cashback: r[9],
  items: r[10], returned: r[11], total: r[12], discount: r[13],
}));

// —— Kunlik yakun (${daily.length} qator) — dashboard grafigi uchun ——
const D = [
${daily.map((d) => "  [" + [q(d.date), q(d.storeId), d.revenue, d.netRevenue, d.grossProfit].join(",") + "],").join("\n")}
];
export const EXPORT_DAILY = D.map((r) => ({
  date: r[0], storeId: r[1], revenue: r[2], netRevenue: r[3], grossProfit: r[4],
}));

// —— P&L oylar kesimida ——
export const EXPORT_PNL = [
${list(pnl)}
];
export const EXPORT_PNL_MONTHS = ${JSON.stringify(months)};

// —— Tovar samaradorligi (${productEfficiency.length} ta) ——
export const EXPORT_EFFICIENCY = [
${list(productEfficiency)}
];

// —— Import partiyalari (${imports.length} qator) ——
export const EXPORT_IMPORTS = [
${list(imports)}
];

// —— Hisobdan chiqarish (${writeoffs.length} ta, sabab bilan) ——
export const EXPORT_WRITEOFFS = [
${list(writeoffs)}
];

// —— Sotuvchilar kunlik (${sellers.length} qator) ——
export const EXPORT_SELLERS = [
${list(sellers)}
];

// —— Tovar sotuvlari, yil bo'yicha yig'ilgan (${productSales.length} ta) ——
export const EXPORT_PRODUCT_SALES = [
${list(productSales)}
];

// —— Tovar bo'yicha HAQIQIY yalpi foyda (${productMargin.length} ta) ——
export const EXPORT_PRODUCT_MARGIN = [
${list(productMargin)}
];

// —— Pul oqimi, kun + usul kesimida (${cashflowDaily.length} qator) ——
export const EXPORT_CASHFLOW_DAILY = [
${list(cashflowDaily)}
];
`;

fs.writeFileSync(path.join(__dirname, "../lib/billzExport.js"), out);

const kb = (x) => Math.round(x / 1024) + " KB";
console.log("Katalog:          ", products.length);
console.log("Mijozlar:         ", customers.length);
console.log("Tranzaksiyalar:   ", transactions.length);
console.log("Kunlik yakun:     ", daily.length);
console.log("P&L bloklar:      ", pnl.length, "| oylar:", months.join(", "));
console.log("Samaradorlik:     ", productEfficiency.length);
console.log("Import qatorlari: ", imports.length);
console.log("Hisobdan chiqar.: ", writeoffs.length);
console.log("Sotuvchi kunlar:  ", sellers.length);
console.log("Tovar sotuvlari:  ", productSales.length);
console.log("Tovar marjasi:    ", productMargin.length);
console.log("Pul oqimi kunlik: ", cashflowDaily.length);
console.log("Fayl:             ", kb(out.length));
