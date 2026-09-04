"use client";
// ══════════════════════════════════════════════════════════════
// BALANS (buxgalteriya balansi)
// ══════════════════════════════════════════════════════════════
// P&L "davr ichida qancha ishladik" ni, Cash Flow "pul qayerdan kelib
// qayerga ketdi" ni ko'rsatadi. Balans esa BIR SANADAGI holatni beradi:
// nima bor (aktiv) va u kimning puliga olingan (passiv).
//
// Asosiy tenglama:  AKTIV = MAJBURIYAT + O'Z KAPITALI
//
// Bu yerdagi barcha raqamlar NSPOS modullaridan hisoblanadi — Billz'da
// balans hisoboti umuman yo'q.
import { allProducts, totalQty } from "./productsData";
import { listDebts, ochiqQoldiq } from "./debtsData";
import { payablesSummary } from "./suppliersData";
import { listCustomers } from "./customersData";
import { payrollCost, listPayrollPayments, berilganOylik } from "./payrollData";
import { profitAndLoss } from "./pnlData";
import { expensesInRange } from "./expensesData";
import { kassaBalances, KASSAS, kassaIds, listOps } from "./kassaData";
import { getLedgerStart, sozlama } from "./companyData";
import { ymd } from "./dates";
import { demoStores } from "./demoData";

// Hisob boshlangan sana — Sozlamalarda belgilanadi. Kassa qoldig'i ham,
// to'plangan ish haqi ham shundan yig'iladi. Eski oylardagi pul
// harakati umuman sanalmaydi.
export const ledgerStartDate = () => new Date(getLedgerStart() + "T00:00:00");

// —— Ombor qoldig'i tannarxda ————————————————————————
// Sotuv narxida emas, TANNARXDA: bu hali daromad emas, bog'lanib
// qolgan pul. Sotuv narxida ko'rsatish balansni sun'iy shishiradi.
export function inventoryValue() {
  // Arxivlangan tovar ham: qoldig'i bo'lsa pul unda yotibdi (2026-09-03)
  const products = allProducts();
  let cost = 0, retail = 0, units = 0;
  const byStore = Object.fromEntries(demoStores.map((s) => [s.id, 0]));

  // Tannarxi NOMA'LUM qoldiq — 0 deb baholanmaydi, alohida sanaladi
  // (DAFTAR 20 L/O): ekranda "N tovar, M dona tannarxsiz" deb turadi.
  const nomalum = { n: 0, units: 0, retail: 0 };
  for (const p of products) {
    if (p.isService) continue;          // montaj — tovar emas
    const q = totalQty(p);
    if (q <= 0) continue;               // manfiy qoldiq aktivga kirmaydi
    units += q;
    retail += q * (p.salePrice ?? 0);
    if (!(+p.costPrice > 0)) { nomalum.n++; nomalum.units += q; nomalum.retail += q * (p.salePrice ?? 0); continue; }
    cost += q * p.costPrice;
    for (const s of demoStores) {
      byStore[s.id] += Math.max(0, p.stock[s.id] || 0) * p.costPrice;
    }
  }
  return {
    cost: +cost.toFixed(2),
    retail: +retail.toFixed(2),
    potentialProfit: +(retail - cost).toFixed(2),
    units,
    nomalum: { n: nomalum.n, units: nomalum.units, retail: +nomalum.retail.toFixed(2) },
    byStore: Object.fromEntries(Object.entries(byStore).map(([k, v]) => [k, +v.toFixed(2)])),
  };
}

// —— Debitor qarzdorlik (bizga qarz) ————————————————
// Ochiq qarz ta'rifi BITTA joyda — `debtsData.ochiqQoldiq` (yopilmagan
// va qoldig'i bir tiyindan katta). Ilgari bu yerda `closedAt`
// tekshirilmasdi va `> 0.001` chegarasi turardi — Balans bilan
// Qarzdorlar sahifasi bir-biridan farq qilishi mumkin edi, buni hech
// qanday tekshiruv tutmasdi (endi `moslik` → `balans-ar`).
export function receivables() {
  const open = listDebts()
    .map((d) => ({ ...d, remaining: ochiqQoldiq(d) }))
    .filter((d) => d.remaining > 0);
  return {
    total: +open.reduce((a, d) => a + d.remaining, 0).toFixed(2),
    count: open.length,
    customers: new Set(open.map((d) => d.customerId)).size,
  };
}

// —— To'lanmagan ish haqi ————————————————————————
export function payrollLiability(asOf = new Date()) {
  // Hisoblangani — P&L bilan bitta manbadan (payrollData.payrollCost).
  // Ilgari `payrollSummary().total` olinardi: u profildagi qat'iy
  // maoshdan yig'iladi va bazada 0 bo'lgani uchun balansda
  // "to'lanmagan ish haqi 0" turardi, holbuki KPI bo'yicha 2 881.25
  // hisoblangan edi (2026-08-14).
  const accrued = payrollCost(ledgerStartDate(), asOf);
  const b = berilganOylik(ledgerStartDate(), asOf);
  return { accrued, paid: b.jami, berilgan: b, unpaid: +Math.max(0, accrued - b.jami).toFixed(2) };
}

export { berilganOylik };

// —— Mijoz oldindan to'lovlari (bizning majburiyatimiz) ————
export function customerBalances() {
  const rows = listCustomers().filter((c) => (c.balance ?? 0) > 0);
  return {
    total: +rows.reduce((a, c) => a + c.balance, 0).toFixed(2),
    count: rows.length,
  };
}

// —— O'Z KAPITALI — tiqin emas, hisob (DAFTAR 20 K) ————————————
// Ilgari `equity = aktiv − passiv` edi: tenglama har doim "to'g'ri"
// chiqardi va hech narsa aytmasdi. Endi kapital O'Z harakatidan quriladi:
//   boshlang'ich (Sozlamalar, `kapital.boshlangich`, hisob boshidagi holat)
//   + yig'ilgan foyda (P&L, hisob boshidan `asOf` gacha)
//   − NS (rahbar olgan pul — foydani taqsimlash, xarajat emas)
// Aktiv − Passiv − Kapital = IZOHLANMAGAN — u yashirilmaydi: yozilmagan
// xarid, ta'minotchi qarzi, boshlang'ich kapital kiritilmagani.
export function kapital(asOf = new Date()) {
  const boshlangich = +(Number(sozlama("kapital.boshlangich", 0)) || 0).toFixed(2);
  const yigilganFoyda = profitAndLoss(ledgerStartDate(), asOf).netProfit;
  const a = ymd(ledgerStartDate()), b = ymd(asOf);
  const ns = +listOps().filter((o) => o.kind === "out" && o.category === "personal" && o.date >= a && o.date <= b)
    .reduce((s, o) => s + o.amount, 0).toFixed(2);
  return { boshlangich, yigilganFoyda, ns, jami: +(boshlangich + yigilganFoyda - ns).toFixed(2) };
}

// —— To'liq balans ————————————————————————————————
export function balanceSheet(asOf = new Date()) {
  const inv = inventoryValue();
  const rec = receivables();
  const pay = payablesSummary(asOf);
  const wages = payrollLiability(asOf);
  const custBal = customerBalances();

  // Pul qayerda turgani — kassa moduli (kassaData.js). Ilgari bu raqam
  // Billz sotuvlaridan chiqarilardi; ikkalasi bitta pulni ko'rsatgani
  // uchun endi bitta manba qoldi: kassa jurnali. Billz esa tushum va
  // foyda uchun ishlatiladi (P&L) — u yerda o'z o'rnida to'g'ri.
  const kb = kassaBalances(asOf);
  const walletTotal = (w) =>
    +kassaIds().reduce((a, k) => a + (kb[k]?.[w] ?? 0), 0).toFixed(2);

  // Har hamyon ostida qaysi kassada qancha turgani ko'rsatiladi —
  // "naqd 500" degan raqam kimning qo'lida ekani bilinib tursin.
  const breakdown = (w) =>
    kassaIds().filter((k) => Math.abs(kb[k]?.[w] ?? 0) > 0.005)
      .map((k) => `${KASSAS[k]?.label ?? k}: ${(kb[k][w]).toFixed(2)}`)
      .join(" · ") || undefined;

  const cash = walletTotal("cash");
  const nonCash = walletTotal("payme");
  const service = walletTotal("service");

  const assets = [
    { key: "cash", label: "Kassadagi naqd pul", amount: cash, group: "current",
      hint: breakdown("cash") },
    { key: "bank", label: "Payme hisobi", amount: nonCash, group: "current",
      hint: breakdown("payme") },
    ...(Math.abs(service) > 0.005
      ? [{ key: "service", label: "Servis kassasi", amount: service, group: "current",
           hint: breakdown("service") }]
      : []),
    { key: "receivable", label: "Mijozlardan olinadigan qarz", amount: rec.total, group: "current",
      hint: `${rec.count} ta qarz · ${rec.customers} mijoz` },
    { key: "inventory", label: "Ombordagi tovar (tannarxda)", amount: inv.cost, group: "current",
      hint: `${inv.units} dona` },
  ];

  const liabilities = [
    { key: "payable", label: "Yetkazib beruvchilarga qarz", amount: pay.totalOpen,
      hint: `${pay.openCount} ta hisob-faktura` },
    { key: "wages", label: "To'lanmagan ish haqi", amount: wages.unpaid },
    { key: "prepaid", label: "Mijozlar oldindan to'lovi", amount: custBal.total,
      hint: `${custBal.count} mijoz balansi` },
  ];

  const totalAssets = +assets.reduce((a, x) => a + x.amount, 0).toFixed(2);
  const totalLiabilities = +liabilities.reduce((a, x) => a + x.amount, 0).toFixed(2);
  // O'z kapitali — o'z harakatidan (`kapital`), balanslovchi tiqin emas.
  // Tenglama farqi `izohlanmagan` bo'lib OCHIQ turadi.
  const kap = kapital(asOf);
  const equity = kap.jami;
  const izohlanmagan = +(totalAssets - totalLiabilities - equity).toFixed(2);

  const currentAssets = +assets.filter((a) => a.group === "current")
    .reduce((s, a) => s + a.amount, 0).toFixed(2);

  return {
    asOf,
    assets, liabilities,
    totalAssets, totalLiabilities, equity,
    // —— Ko'rsatkichlar ————————————————————————
    // Joriy likvidlik: qisqa muddatli qarzni qoplashga aktiv yetadimi.
    // 1 dan past bo'lsa — to'lov muammosi xavfi.
    currentRatio: totalLiabilities > 0 ? +(currentAssets / totalLiabilities).toFixed(2) : null,
    // Aylanma kapital: kundalik ishga qolgan erkin mablag'
    workingCapital: +(currentAssets - totalLiabilities).toFixed(2),
    // Aktivning qancha qismi o'z pulimiz
    equityRatio: totalAssets > 0 ? +((equity / totalAssets) * 100).toFixed(1) : 0,
    // Ombor aktivning qancha qismini band qilgan
    inventoryShare: totalAssets > 0 ? +((inv.cost / totalAssets) * 100).toFixed(1) : 0,
    inventory: inv,
    receivables: rec,
    payables: pay,
    wages,
    kapitalTafsilot: kap,
    izohlanmagan,
  };
}
