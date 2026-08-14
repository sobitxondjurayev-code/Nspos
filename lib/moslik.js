"use client";
// ══════════════════════════════════════════════════════════════
// SAHIFALARARO MOSLIK — "bitta raqam, bitta qiymat"
// ══════════════════════════════════════════════════════════════
// `lib/audit.js` MA'LUMOTdagi xatoni topadi (minusdagi hamyon,
// ikkilangan to'lov, kurssiz xarajat). Bu fayl esa boshqa savolga
// javob beradi: **bir xil ma'nodagi raqam ikki sahifada teng chiqyaptimi?**
//
// Nega alohida kerak: ma'lumot butunlay to'g'ri bo'lishi mumkin, lekin
// kod ikki joyda ikki xil hisoblasa, rahbar bir ekranda 26 786.89,
// boshqasida 25 286.89 ko'radi va ikkalasiga ham ishonmay qoladi.
// Bunday xato o'zini ko'rsatmaydi — ikkala raqam ham ishonarli.
//
// TEKSHIRUV ILOVANING O'Z FUNKSIYALARINI CHAQIRADI. Formulani bu yerda
// qayta yozish TAQIQLANADI: aynan shuning uchun 2026-08-14 da
// `npm run tekshir` "hammasi joyida" deb turgan paytda ekranda boshqa
// raqam turgan edi (skript doimiy xarajatni bilmasdi).
//
// Ikki joyda ishlaydi:
//   • `npm run tekshir` — saytga chiqarishdan oldin, terminalda
//   • ilova ichida — "Tekshirib ko'ring" kartochkasi (rahbarga)
import {
  KASSAS, WALLETS, WALLET_IDS, kassaIds,
  kassaBalances, moneyFlow, summaryRow, dailyRows, flowSources,
  kassaDailyRows, kassaSources, walletSources,
} from "./kassaData";
import { totalExpenses, expensesByCategory, expensesByStore } from "./expensesData";
import { payrollCost } from "./payrollData";
import { profitAndLoss, cashFlow } from "./pnlData";
import { balanceSheet, payrollLiability } from "./balanceData";
import { kpis } from "./managementData";
import { getLedgerStart } from "./companyData";

const money = (n) => `${(+n).toFixed(2)} USD`;
// Yaxlitlash farqi: uchta hamyon va yuzlab yozuv qo'shilganda tiyinning
// mingdan biri to'planadi. 1 tiyin — xato emas.
const same = (a, b) => Math.abs((+a || 0) - (+b || 0)) < 0.011;

const bugun = () => new Date();
const boshi = () => new Date(getLedgerStart() + "T00:00:00");

// Ustun kalitlari — Pul rejasi jadvalidagi bilan bir xil
// (app/(app)/finance/plan/page.jsx dagi COLUMNS).
const IN_COLS = ["b2b", "b2c", "service"];
const OUT_COLS = ["b2bExp", "storeExp", "svcExp", "companyExp", "salary", "ns"];

// —— 1. Pul rejasi: kartochkalar = jadval ————————————
// Tepada "Kirgan pul / Chiqqan pul" (moneyFlow), pastda kunlik jadval
// (summaryRow). Bir davr, bir xil pul — teng bo'lishi shart.
function planCardsVsTable() {
  const a = boshi(), b = bugun();
  const flow = moneyFlow(a, b);
  const total = summaryRow(a, b);
  const out = [];

  const tableIn = +IN_COLS.reduce((s, k) => s + (total[k] ?? 0), 0).toFixed(2);
  if (!same(flow.in, tableIn)) {
    out.push({
      id: "plan-in", level: "error",
      title: `Pul rejasi: "Kirgan pul" ${money(flow.in)}, jadvalda ${money(tableIn)}`,
      detail: `Farq ${money(flow.in - tableIn)}. Kassaga tushgan pul jadvalning biror ustunida ko'rinishi kerak.`,
      action: "Pul rejasini ochish", href: "/finance/plan",
    });
  }

  const tableOut = +OUT_COLS.reduce((s, k) => s + (total[k] ?? 0), 0).toFixed(2);
  if (!same(flow.out, tableOut)) {
    out.push({
      id: "plan-out", level: "error",
      title: `Pul rejasi: "Chiqqan pul" ${money(flow.out)}, jadvalda ${money(tableOut)}`,
      detail: `Farq ${money(flow.out - tableOut)}. Kassadan chiqqan pul albatta biror ustunda ko'rinishi kerak — aks holda "qayerga ketdi?" degan savolga jadval javob bermaydi.`,
      action: "Pul rejasini ochish", href: "/finance/plan",
    });
  }
  return out;
}

// —— 2. Qatorlar = "Jami" qatori ————————————————————
// 2026-08-07: qatorlar oylik raqamni, "Jami" davr raqamini ko'rsatgan
// edi — qatorlarda 320 000, Jami 0.
function rowsVsTotal() {
  const a = boshi(), b = bugun();
  const rows = dailyRows(a, b);
  const total = summaryRow(a, b);
  const out = [];
  for (const k of [...IN_COLS, ...OUT_COLS, "cash", "payme"]) {
    const sum = +rows.reduce((s, r) => s + (r[k] ?? 0), 0).toFixed(2);
    if (same(sum, total[k])) continue;
    out.push({
      id: `rows-${k}`, level: "error",
      title: `Pul rejasi · "${k}": qatorlar ${money(sum)}, "Jami" ${money(total[k])}`,
      detail: "Qator ham, Jami ham BITTA manbadan hisoblanishi kerak.",
      action: "Pul rejasini ochish", href: "/finance/plan",
    });
  }
  return out;
}

// —— 3. Bosiladigan raqam = ochilgan ro'yxat ————————
// Qoida: yig'ma raqam bosilganda u qaysi yozuvlardan yig'ilgani
// ochiladi. Ro'yxat yig'indisi katakdagi raqamga teng bo'lmasa —
// ikkisidan biri yolg'on.
function flowCellVsSources() {
  const a = boshi(), b = bugun();
  const total = summaryRow(a, b);
  const out = [];
  for (const k of [...IN_COLS, ...OUT_COLS]) {
    const list = flowSources(a, b, k);
    const sum = +list.reduce((s, x) => s + x.amount, 0).toFixed(2);
    if (same(sum, total[k])) continue;
    out.push({
      id: `flowsrc-${k}`, level: "error",
      title: `Pul rejasi · "${k}": katakda ${money(total[k])}, ro'yxatda ${money(sum)}`,
      detail: `${list.length} ta yozuv ochiladi. Raqam bosilganda chiqadigan ro'yxat aynan o'sha summani berishi kerak.`,
      action: "Pul rejasini ochish", href: "/finance/plan",
    });
  }
  return out;
}

// —— 4. Kassa: kartochka = kunlik jadval ————————————
// DAFTAR qoidasi: kunlik jadvaldagi "Kassada qoldi" jamisi kassaning
// hozirgi qoldig'iga teng chiqadi.
function kassaCardVsDays() {
  const b = bugun();
  const bal = kassaBalances(b);
  const out = [];
  for (const k of kassaIds()) {
    const { carry, rows } = kassaDailyRows(k, boshi(), b);
    const left = +(rows.reduce((s, r) => s + r.left, 0) + carry).toFixed(2);
    // Tasdiq kutayotgan pul jadvalda hali kassada turadi (rahbar rad
    // etsa qaytadi), kartochkada esa alohida "yo'lda" bo'lib ko'rinadi.
    const card = +((bal[k]?.total ?? 0) + (bal[k]?.pending ?? 0)).toFixed(2);
    if (same(left, card)) continue;
    out.push({
      id: `kassa-days-${k}`, level: "error", kassa: k,
      title: `${KASSAS[k]?.label ?? k}: kartochkada ${money(card)}, kunlik jadvalda ${money(left)}`,
      detail: `Farq ${money(card - left)}. Ikkalasi bitta pulni ko'rsatadi.`,
      action: "Kunma-kun ko'rish", href: `/finance/kassa/${k}`,
    });
  }
  return out;
}

// —— 5. Kassa jadvali: hamyon ustunlari = umumiy ustun ——
function kassaWalletCols() {
  const b = bugun();
  const out = [];
  for (const k of kassaIds()) {
    const { rows } = kassaDailyRows(k, boshi(), b);
    const sum = (key) => +rows.reduce((s, r) => s + (r[key] ?? 0), 0).toFixed(2);
    for (const [all, parts, label] of [
      ["in", ["inCash", "inPayme", "inService"], "Kirim"],
      ["out", ["outCash", "outPayme", "outService"], "Chiqim"],
    ]) {
      const whole = sum(all);
      const bits = +parts.reduce((s, p) => s + sum(p), 0).toFixed(2);
      if (same(whole, bits)) continue;
      out.push({
        id: `kassa-cols-${k}-${all}`, level: "error", kassa: k,
        title: `${KASSAS[k]?.label ?? k}: "${label}" ${money(whole)}, hamyonlar bo'yicha ${money(bits)}`,
        detail: "Naqd + Payme + Servis ustunlari umumiy ustunga teng bo'lishi kerak.",
        action: "Kunma-kun ko'rish", href: `/finance/kassa/${k}`,
      });
    }
  }
  return out;
}

// —— 6. Kassa: katak = ochilgan ro'yxat ————————————
function kassaCellVsSources() {
  const b = bugun();
  const out = [];
  for (const k of kassaIds()) {
    const { rows } = kassaDailyRows(k, boshi(), b);
    for (const [col, label] of [["in", "Kirim"], ["out", "Chiqim"], ["given", "Topshirilgan"]]) {
      const cell = +rows.reduce((s, r) => s + (r[col] ?? 0), 0).toFixed(2);
      const list = kassaSources(k, boshi(), b, col);
      const sum = +list.reduce((s, x) => s + x.amount, 0).toFixed(2);
      if (same(cell, sum)) continue;
      out.push({
        id: `kassa-src-${k}-${col}`, level: "error", kassa: k,
        title: `${KASSAS[k]?.label ?? k} · "${label}": jadvalda ${money(cell)}, ro'yxatda ${money(sum)}`,
        detail: "Jadvaldagi raqam va u bosilganda ochiladigan ro'yxat bitta manbadan chiqishi kerak.",
        action: "Kunma-kun ko'rish", href: `/finance/kassa/${k}`,
      });
    }
  }
  return out;
}

// —— 7. Hamyon kartochkasi = ochilgan ro'yxat ————————
// "Hozir kassalarda" kartochkasidagi har hamyon bosiladi (2026-08-13).
function walletCardVsSources() {
  const b = bugun();
  const bal = kassaBalances(b);
  const out = [];
  for (const w of WALLET_IDS) {
    const card = +kassaIds().reduce((s, k) => s + (bal[k]?.[w] ?? 0), 0).toFixed(2);
    const list = walletSources(w, boshi(), b);
    const sum = +list.reduce((s, x) => s + (x.out ? -x.amount : x.amount), 0).toFixed(2);
    if (same(card, sum)) continue;
    out.push({
      id: `wallet-src-${w}`, level: "error",
      title: `"${WALLETS[w]}" kartochkada ${money(card)}, ochilgan ro'yxatda ${money(sum)}`,
      detail: `Farq ${money(card - sum)}. Hamyon raqami bosilganda unga tushgan va undan chiqqan hamma yozuv ochiladi — yig'indisi teng bo'lishi shart.`,
      action: "Kassalarni ochish", href: "/finance/kassa",
    });
  }
  return out;
}

// —— 8. Balans hisoboti = kassalar ————————————————
function balanceVsKassa() {
  const b = bugun();
  const bal = kassaBalances(b);
  const sheet = balanceSheet(b);
  const kassa = +kassaIds().reduce((s, k) => s + (bal[k]?.total ?? 0), 0).toFixed(2);
  const inSheet = +["cash", "bank", "service"]
    .reduce((s, key) => s + (sheet.assets.find((a) => a.key === key)?.amount ?? 0), 0).toFixed(2);
  if (same(kassa, inSheet)) return [];
  return [{
    id: "balance-cash", level: "error",
    title: `Balansda pul ${money(inSheet)}, Kassalar sahifasida ${money(kassa)}`,
    detail: "Ikkalasi ham kassa jurnalidan o'qiydi — farq bo'lmasligi kerak.",
    action: "Balansni ochish", href: "/finance/balance",
  }];
}

// —— 9. Xarajatlar: kesimlar = jami ————————————————
function expenseSlices() {
  const a = boshi(), b = bugun();
  const total = totalExpenses(a, b);
  const out = [];
  // Kategoriya kesimida ustun nomi `amount`, do'kon kesimida esa
  // `total` (u yerda umumiy xarajat tushumga qarab taqsimlanadi:
  // direct + allocated).
  for (const [name, rows, href] of [
    ["kategoriyalar", expensesByCategory(a, b), "/finance/expenses"],
    ["do'konlar", expensesByStore(a, b), "/finance/expenses"],
  ]) {
    const sum = +rows.reduce((s, c) => s + (c.total ?? c.amount ?? 0), 0).toFixed(2);
    if (same(sum, total)) continue;
    out.push({
      id: `exp-${name}`, level: "error",
      title: `Xarajatlar: jami ${money(total)}, ${name} bo'yicha ${money(sum)}`,
      detail: "Har xarajat biror kesimga tushishi kerak, aks holda u kesimda ko'rinmaydi.",
      action: "Xarajatlarni ochish", href,
    });
  }
  return out;
}

// —— 10. Ish haqi: hamma sahifada bitta raqam ————————
// Ish haqi to'rt joyda ko'rinadi: Moliya bosh sahifasidagi kartochka
// (P&L dan), Ish haqi bo'limi, rahbariyat paneli va balansdagi
// "to'lanmagan ish haqi" hisobi. Manba bitta — payrollData.payrollCost.
function payrollEverywhere() {
  const a = boshi(), b = bugun();
  const asli = payrollCost(a, b);
  const out = [];
  for (const [joy, qiymat, href] of [
    ["Moliya bosh sahifasi", profitAndLoss(a, b).expenses?.payroll ?? 0, "/finance"],
    ["rahbariyat paneli", kpis(a, b).wages, "/management"],
    ["balans (hisoblangan)", payrollLiability(b).accrued, "/finance/balance"],
  ]) {
    if (same(asli, qiymat)) continue;
    out.push({
      id: `payroll-${href}`, level: "error",
      title: `Ish haqi: ${joy}da ${money(qiymat)}, aslida ${money(asli)}`,
      detail: "Hamma sahifa `payrollData.payrollCost` dan o'qishi kerak.",
      action: "Ish haqini ochish", href,
    });
  }
  return out;
}

// —— 11. Sof foyda: P&L = rahbariyat paneli ————————
// 2026-08-14: P&L 628.33, rahbariyat paneli 1 000.24 ko'rsatgan edi —
// paneli xarajatga oylikni ham qo'shib, ustiga alohida ish haqi
// chegirardi.
function netProfitEverywhere() {
  const a = boshi(), b = bugun();
  const p = profitAndLoss(a, b);
  const k = kpis(a, b);
  const out = [];
  if (!same(p.netProfit, k.netProfit)) {
    out.push({
      id: "netprofit", level: "error",
      title: `Sof foyda: P&L da ${money(p.netProfit)}, rahbariyat panelida ${money(k.netProfit)}`,
      detail: `Farq ${money(p.netProfit - k.netProfit)}. Bitta oy, bitta kompaniya — bitta raqam bo'lishi kerak.`,
      action: "Foyda hisobotini ochish", href: "/finance/pnl",
    });
  }
  // Kartochkalar bir qatorda turadi — o'zaro ham qo'shilishi kerak.
  // Aks holda rahbar ekranga qarab "314 059 − 14 488 nega 309 728?"
  // deb so'raydi va javob bo'lmaydi.
  const qoldiq = +(k.grossProfit - k.opex - k.wages).toFixed(2);
  if (!same(qoldiq, k.netProfit)) {
    out.push({
      id: "dash-row", level: "error",
      title: `Rahbariyat paneli: ${money(k.grossProfit)} − ${money(k.opex + k.wages)} = ${money(qoldiq)}, kartochkada esa ${money(k.netProfit)}`,
      detail: "Bir qatordagi kartochkalar o'zaro qo'shilishi kerak.",
      action: "Panelni ochish", href: "/management",
    });
  }
  return out;
}

// —— 12. Pul oqimi = Pul rejasi ————————————————————
// P&L bo'limidagi "Pul oqimi" tabi va Pul rejasi sahifasi bitta
// savolga javob beradi: davr ichida qancha pul kirdi va chiqdi.
// 2026-08-14 gacha birinchisi eski sotuv modulidan hisoblardi va
// 11 826.19 deb turardi, ikkinchisi esa 59 237.65.
function cashFlowVsPlan() {
  const a = boshi(), b = bugun();
  const c = cashFlow(a, b);
  const f = moneyFlow(a, b);
  const out = [];
  for (const [nom, oqim, reja] of [
    ["kirim", c.in.total, f.in],
    ["chiqim", c.out.total, f.out],
  ]) {
    if (same(oqim, reja)) continue;
    out.push({
      id: `cashflow-${nom}`, level: "error",
      title: `Pul oqimi: ${nom} ${money(oqim)}, Pul rejasida esa ${money(reja)}`,
      detail: `Farq ${money(oqim - reja)}. Ikkalasi ham kassa jurnalidan o'qishi kerak.`,
      action: "Pul oqimini ochish", href: "/finance/pnl",
    });
  }
  // Hamyon kesimi ham jamiga qo'shilsin — ekranda ular ustma-ust turadi
  const bits = +(c.in.salesCash + c.in.salesPayme + c.in.service).toFixed(2);
  if (!same(bits, c.in.total)) {
    out.push({
      id: "cashflow-parts", level: "error",
      title: `Pul oqimi: naqd + Payme + servis ${money(bits)}, "Jami kirim" ${money(c.in.total)}`,
      detail: "Ustundagi qatorlar jamiga qo'shilishi kerak.",
      action: "Pul oqimini ochish", href: "/finance/pnl",
    });
  }
  return out;
}

// ══════════════════════════════════════════════════════════════
// RO'YXAT
// ══════════════════════════════════════════════════════════════
// Yangi "bu raqam ana u raqamga teng bo'lishi kerak" qoidasi
// aytilganda — shu ro'yxatga bitta qator qo'shiladi. U o'sha zahoti
// ham terminalda, ham ilova ichida ishlaydi.
export const CHECKS = [
  { id: "plan", name: "Pul rejasi: kartochkalar = jadval", run: planCardsVsTable },
  { id: "rows", name: "Pul rejasi: qatorlar = \"Jami\" qatori", run: rowsVsTotal },
  { id: "flowsrc", name: "Pul rejasi: har katak = ochilgan ro'yxat", run: flowCellVsSources },
  { id: "kassaday", name: "Kassa: kartochka = kunlik jadval", run: kassaCardVsDays },
  { id: "kassacol", name: "Kassa: hamyon ustunlari = umumiy ustun", run: kassaWalletCols },
  { id: "kassasrc", name: "Kassa: har katak = ochilgan ro'yxat", run: kassaCellVsSources },
  { id: "walletsrc", name: "Hamyon kartochkasi = ochilgan ro'yxat", run: walletCardVsSources },
  { id: "sheet", name: "Balans hisoboti = kassalar", run: balanceVsKassa },
  { id: "expslice", name: "Xarajatlar: kesimlar = jami", run: expenseSlices },
  { id: "payroll", name: "Ish haqi: hamma sahifada bitta raqam", run: payrollEverywhere },
  { id: "netprofit", name: "Sof foyda: P&L = rahbariyat paneli", run: netProfitEverywhere },
  { id: "cashflow", name: "Pul oqimi = Pul rejasi", run: cashFlowVsPlan },
];

// Hammasini yurgizadi: [{ id, name, problems: [...] }]
// Bitta tekshiruv yiqilsa qolganlari to'xtamaydi — aks holda bitta
// buzuq joy butun nazoratni o'chirib qo'yardi.
export function runChecks() {
  return CHECKS.map((c) => {
    try {
      return { id: c.id, name: c.name, problems: c.run() ?? [] };
    } catch (e) {
      return { id: c.id, name: c.name, problems: [{
        id: `err-${c.id}`, level: "error",
        title: `"${c.name}" tekshiruvi ishlamadi: ${e.message}`,
        detail: "Bu kod xatosi — raqamlar tekshirilmay qoldi.",
        action: "Moliyani ochish", href: "/finance",
      }] };
    }
  });
}

// Ilova ichida ko'rsatish uchun tekis ro'yxat. Faqat rahbarga:
// nomuvofiqlik butun kompaniya hisobiga tegishli va uni menejer
// tuzata olmaydi.
export const mismatchWarnings = (user) =>
  user?.role === "owner" ? runChecks().flatMap((c) => c.problems) : [];
