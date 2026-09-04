// ══════════════════════════════════════════════════════════════
// BILLZ'DA XARID / SPISANIE / INVENTARIZATSIYA / KASSA SMENASI BORMI
// ══════════════════════════════════════════════════════════════
//   node --import ./scripts/lib/register.mjs scripts/billz-probe-xarid.mjs
//
// DAFTAR 20 (E, F): tovar xaridi (postavka), spisanie, inventarizatsiya,
// qayta narxlash va kassa smenasi NSPOS'ga kelmaydi — balansda ta'minotchi
// qarzi 0, ombor harakati yopilmaydi. Ochiq hujjatda bu metodlar yo'q,
// nomzodlar birma-bir uriladi (faqat GET, `retries: 0`, 2 so'rov/soniya
// navbat `billzApi` ichida). Chiqarish: holat, javob kalitlari, birinchi
// yozuv kalitlari — QIYMATLAR EMAS (mijoz/pul ma'lumoti terminalga tushmasin).
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
  if (m && m[2]) process.env[m[1]] ??= m[2];
}
const { billzGet } = await import("../lib/billzApi.js");

const NOMZODLAR = [
  // xarid / postavka
  "/v1/supply", "/v2/supply", "/v1/supplies", "/v2/supplies", "/v1/product-supply", "/v2/product-supply",
  "/v1/purchase", "/v2/purchase", "/v1/purchase-order", "/v2/purchase-order", "/v1/supplier-order", "/v2/supplier-order",
  "/v1/order?type=supply", "/v2/products/orders", "/v1/products/orders", "/v1/receipt", "/v2/receipt", "/v1/income", "/v2/income",
  // spisanie
  "/v1/write-off", "/v2/write-off", "/v1/writeoff", "/v2/writeoff", "/v1/products/write-off",
  // inventarizatsiya
  "/v1/inventory", "/v2/inventory", "/v1/inventarization", "/v2/inventarization", "/v1/products/inventory",
  // qayta narxlash
  "/v1/revaluation", "/v2/revaluation", "/v1/products/revaluation", "/v2/price-change",
  // kassa smenasi
  "/v1/cash-shift", "/v2/cash-shift", "/v1/cash-shifts", "/v2/cash-shifts", "/v1/order/cash-shifts", "/v1/shift", "/v2/shift", "/v1/cashbox", "/v2/cashbox",
  // ombor harakati
  "/v1/stock-history", "/v2/stock-history", "/v1/product-history", "/v2/products/history", "/v1/warehouse", "/v2/warehouse",
];

const kalitlar = (o) => (o && typeof o === "object" ? Object.keys(o).slice(0, 25).join(",") : typeof o);
const royxat = (b) => {
  if (Array.isArray(b)) return b;
  for (const k of Object.keys(b ?? {})) if (Array.isArray(b[k])) return b[k];
  return null;
};

for (const yol of NOMZODLAR) {
  const [p, q] = yol.split("?");
  const params = { limit: 1, page: 1 };
  if (q) for (const kv of q.split("&")) { const [k, v] = kv.split("="); params[k] = v; }
  try {
    const b = await billzGet(p, params, { retries: 0 });
    const list = royxat(b);
    console.log(`OCHIQ    ${yol.padEnd(30)} count=${b?.count ?? "?"} kalitlar=[${kalitlar(b)}]`);
    if (list?.[0]) console.log(`         birinchi yozuv kalitlari: [${kalitlar(list[0])}]`);
  } catch (e) {
    const s = e.status ?? (e.forbidden ? 403 : "?");
    console.log(`${String(s).padEnd(8)} ${yol.padEnd(30)} ${String(e.message).slice(0, 80)}`);
  }
}
