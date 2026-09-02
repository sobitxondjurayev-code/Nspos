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
import { profitAndLoss, cashFlow, salesPnl } from "./pnlData";
import { balanceSheet, payrollLiability } from "./balanceData";
import { kpis } from "./managementData";
import { getLedgerStart } from "./companyData";
import { listSales } from "./salesData";
import { listDebts, paidOf, overallDebtStats, jamiQarz } from "./debtsData";
import { arAging } from "./analytics";
import { billzServiceIncome, jonliServisKirim } from "./serviceIncome";
import { kunlikKirim, billzKassaDays } from "./kassaIncome";

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
    // Tasdiq kutayotgan pul ikki joyda ham hali KASSADA turadi (rahbar
    // rad etsa qaytadi): `kassaBalances` uni hamyondan ayirmaydi,
    // kunlik jadval ham `wait` ni qoldiqdan chegirmaydi. Shuning uchun
    // `pending` ustiga qo'shilmaydi — qo'shilsa o'sha pul ikki marta
    // sanalib, soxta farq chiqardi (2026-08-15).
    const card = +(bal[k]?.total ?? 0).toFixed(2);
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

// —— Billz: chek summasi = qatorlari yig'indisi ————————————
// 2026-08-19 gacha `sale_items` jadvali BO'SH edi: Billz Excel eksporti
// chek ichidagi tovarlarni bermasdi, shuning uchun 7 779 chekka qaramay
// tovar kesimidagi foyda hisoblanmasdi. Endi qatorlar API'dan keladi —
// va kelgan zahoti tekshiriladi: qatorlar yig'indisi chek summasiga
// teng bo'lmasa, tovar bo'yicha foyda ham, ABC tahlil ham yolg'on
// bo'lib chiqadi (ishonarli, lekin yolg'on).
function saleItemsVsTotal() {
  const out = [];
  const withItems = listSales().filter((s) => s.items?.length);
  let bad = 0, worst = null;

  for (const s of withItems) {
    const sum = s.items.reduce((a, i) => a + (+i.total || 0), 0);
    // Chegirma chek darajasida yoziladi, qatorlarda emas
    const expect = (+s.subtotal || +s.total || 0);
    if (same(sum, expect)) continue;
    bad++;
    const gap = Math.abs(sum - expect);
    if (!worst || gap > worst.gap) worst = { no: s.no, sum, expect, gap };
  }

  if (bad) {
    out.push({
      id: "billz-items", level: "error",
      title: `${bad} ta chekda qatorlar yig'indisi chek summasiga teng emas`,
      detail: `Eng katta farq: ${worst.no} — qatorlar ${money(worst.sum)}, chek ${money(worst.expect)}. `
        + "Tovar kesimidagi foyda va ABC tahlil shu qatorlardan hisoblanadi.",
      action: "Sotuvlarni ochish", href: "/sales",
    });
  }
  return out;
}

// —— Billz: to'lov taqsimoti = chek summasi ————————————————
// 2026-08-24 moliyaviy auditida qo'shildi.
//
// MUAMMO. `billzMap.splitPayments()` chekni to'rt hamyonga bo'ladi:
// naqd, karta, Payme, balansdan, nasiya. Tur nomi Billz'da ERKIN
// yoziladi (kompaniya o'zi qo'yadi), ya'ni ertaga "Перечисление"
// degan yangi tur ochilsa kod uni tanimaydi. Ilgari bunday summa
// `unknown` ro'yxatiga tushib, bazaga UMUMAN yozilmasdi: chek
// summasi joyida turgani holda hamyonlar yig'indisi undan kam
// bo'lardi. Hech qanday xato chiqmasdi.
//
// TEKSHIRUV. Hamyonlar + `unknown_paid` chek summasiga teng bo'lishi
// kerak. Teng bo'lmasa — pul biror yo'l bilan hisobdan chiqib ketgan.
//
// NEGA FAQAT "sale" TURI. O'lchandi (2026-08-24, 9 153 Billz cheki):
//   sale      8 011 ta — farqli 0 ta   (eng katta farq 0.01, yaxlitlash)
//   return      938 ta — farqli 769 ta
//   exchange    204 ta — farqli 58 ta
// Qaytarish va almashuvda Billz to'lov qatorini umuman BERMAYDI
// (`order_payments` bo'sh yoki qisman): pul kassadan chiqqani
// yozilmaydi, ya'ni qaysi hamyondan qaytarilgani noma'lum. Bu
// Billz tomonidagi cheklov — biz tuzata olmaymiz va uni ogohlantirish
// qilib qo'yish 769 ta abadiy qizil qator degani. Abadiy qizil
// darvoza esa bir haftada e'tibordan qoladi (DAFTAR 13.2).
//
// Sotuv cheklarida esa bugun farq NOL — ya'ni tekshiruv soxta
// trevoga bermaydi va birinchi qizarganida haqiqiy nosozlik bo'ladi.
function paymentSplitVsTotal() {
  const out = [];
  let bad = 0, tasir = 0, worst = null;

  for (const s of listSales()) {
    if (!s.billzId || s.type !== "sale") continue;
    const pay = (+s.cash || 0) + (+s.card || 0) + (+s.payme || 0)
      + (+s.fromBalance || 0) + (+s.debt || 0) + (+s.unknownPaid || 0);
    const total = +s.total || 0;
    if (!pay && !total) continue;
    // Ishora emas, MIQDOR solishtiriladi: yo'nalish xatosi alohida
    // tekshiruvda (`sale-sign`), bu yerda savol bitta — pul yetadimi.
    const gap = Math.abs(Math.abs(pay) - Math.abs(total));
    if (gap <= 0.02) continue;
    bad++;
    tasir += gap;
    if (!worst || gap > worst.gap) worst = { no: s.no, pay, total, gap };
  }

  if (bad) {
    out.push({
      id: "tolov-taqsimot", level: "error",
      title: `${bad} ta chekda to'lovlar yig'indisi chek summasiga teng emas — ${money(tasir)}`,
      detail: `Eng kattasi: ${worst.no} — chek ${money(worst.total)}, to'lovlar ${money(worst.pay)}. `
        + "Billz'da tanilmagan to'lov turi chiqqan bo'lishi mumkin: "
        + "`lib/billzMap.js` → `PAYMENT_KINDS` ga qo'shilsin. "
        + "Ungacha bu pul kassa solishtiruvida ko'rinmaydi.",
      action: "Sozlamalarni ochish", href: "/settings",
    });
  }
  return out;
}

// —— Servis kirimi: jonli cheklar = Billz hisoboti ————————————
// 2026-08-24 da qo'shildi, servis kirimi Excel'dan JONLI cheklarga
// ko'chirilganda.
//
// Ikki manba bor va ikkalasi ham kerak:
//   • JONLI — chek qatorlaridan, kunma-kun aniq, o'zi yangilanadi.
//     Kassa balansi va pul oqimi endi SHUNI oladi (`servisKirim`).
//   • EXCEL — "Эффективность товаров" yuklamasi. API'dan oldingi
//     tarix faqat shu yerda, "Servis foydasi" hisoboti ham shundan.
//
// Ikkalasi bir davrni qamrasa, raqam ham yaqin bo'lishi kerak. Farq
// katta bo'lsa — yo yuklama eskirgan, yo `service_names` ro'yxati
// tovar nomlariga to'g'ri kelmayapti (masalan Billz'da "ustanovka"
// deb yozila boshlagan). Ikkala holat ham JIM o'tadi: ekranda raqam
// baribir turadi, faqat noto'g'ri.
//
// CHEGARA 10% — aniq tenglik BO'LMAYDI: Excel hisobotida kunlik
// taqsimot yo'q va u so'ralgan davrga kunlar nisbatida bo'linadi
// (`covered`), ya'ni chetlari har doim taxminiy.
function serviceSourceCheck() {
  const out = [];
  const excel = billzServiceIncome(null, null);
  // Yuklama yo'q yoki davri noma'lum bo'lsa solishtirib bo'lmaydi
  if (!excel.ready || !excel.period) return out;

  const jonli = jonliServisKirim(excel.period.from, excel.period.to);
  // Davrda umuman chek yo'q (API'dan oldingi tarix) — bu xato emas
  if (!jonli.cheklar) return out;

  const farq = Math.abs(jonli.revenue - excel.revenue);
  const asos = Math.max(Math.abs(excel.revenue), 1);
  if (farq / asos > 0.10) {
    out.push({
      id: "servis-manba", level: "warn",
      title: `Servis kirimi ikki manbada farq qilyapti — ${money(farq)}`,
      detail: `${excel.period.from}…${excel.period.to} uchun cheklardan ${money(jonli.revenue)}, `
        + `Billz hisobotidan ${money(excel.revenue)}. `
        + "Yuklama eskirgan bo'lishi mumkin, yoki Billz'da xizmat boshqa nom bilan "
        + "sotila boshlagan — Sozlamalardagi \"Servis nomlari\" ro'yxatini tekshiring. "
        + "(Aniq tenglik kutilmaydi: hisobotda kunlik taqsimot yo'q va u davrga "
        + "nisbatan bo'linadi.)",
      action: "Sozlamalarni ochish", href: "/settings",
    });
  }
  return out;
}

// —— KPI kunlik tushumi = Billz kunlik kirimi ————————————
// 2026-08-26 dan KPI jadvalidagi Naqd/Payme/Servis Billz'dan avtomat
// keladi. Uchtasining YIG'INDISI Billz o'sha kuni yozgan pulga
// (naqd + Payme, chek va qarz to'lovi) teng bo'lishi SHART.
//
// Bu takrorlanuvchi tekshiruv EMAS — u aniq bitta narsani ushlaydi:
// montaj puli naqddan BIR MARTA ayriladi. Ikki marta ayrilsa yoki
// umuman ayrilmasa, yig'indi aynan montaj summasicha farq qiladi.
// Menejer ilgari xuddi shu ayirishni qo'lda qilardi (731 → 700 naqd +
// 31 servis) va u yerda ham xato bo'lgan (07-avgust: 10 $).
//
// Chegara 0.01 $ — ikkala tomon ham bir xil `toFixed(2)` bilan
// yaxlitlanadi, ya'ni haqiqiy farq shundan katta bo'ladi.
function kpiIncomeVsBillz() {
  const out = [];
  const a = getLedgerStart(), b = bugun();
  for (const [store, kunlar] of Object.entries(kunlikKirim(a, b))) {
    const billzDays = billzKassaDays(store, a, b);
    for (const [date, w] of Object.entries(kunlar)) {
      const bd = billzDays[date];
      if (!bd) continue;                       // solishtiradigan kun yo'q
      const kpi = +(w.cash + w.payme + w.service).toFixed(2);
      const billz = +(bd.cash + bd.payme).toFixed(2);
      const farq = +(kpi - billz).toFixed(2);
      if (Math.abs(farq) <= 0.01) continue;
      out.push({
        id: `kpi-tushum-${store}-${date}`, level: "error",
        title: `${KASSAS[store]?.label ?? store} · ${date}: KPI tushumi Billz kirimidan ${money(Math.abs(farq))} farq qiladi`,
        detail: `Naqd ${money(w.cash)} + Payme ${money(w.payme)} + Servis ${money(w.service)} = ${money(kpi)}, `
          + `Billz esa ${money(billz)} yozgan. Odatda sabab bitta: montaj puli naqddan ikki marta `
          + "ayrilgan yoki umuman ayrilmagan (`kassaIncome.kunlikKirim`).",
        action: "Kassani ochish", href: "/finance/kassa",
      });
    }
  }
  return out;
}

// —— Almashtirish cheki: chek summasi ishorasi qatorlarga mos ————
// 2026-08-22 da tovar kesimidagi foyda qo'shilganda topildi.
//
// `sale_items` yig'indisi P&L tushumiga teng chiqmadi. Sabab: Billz
// ALMASHTIRISH chekida (`exchange`) `total` maydoniga farqning
// ABSOLYUT qiymatini yozadi — yo'nalish yo'qoladi.
//
// Misol (chek 000801160276, 18.08.2026):
//   qatorlar:  +20.82 (olingan tovar) va −25.00 (qaytarilgan tovar)
//   ya'ni do'kon mijozga 4.18 $ QAYTARGAN, net = −4.18
//   subtotal:  −4.18   ← to'g'ri
//   total:     +4.18   ← ishora teskari
//
// Natijada `total` ni yig'adigan har qanday tushum raqami oshib
// ketadi: har bunday chekda xato ikki barobar (4.18 emas, 8.36).
// Yil boshidan beri 78 ta chek, jami 3 127.25 $ ortiqcha tushum.
//
// Bu `subtotal` bilan solishtirish orqali tutiladi — u qatorlar
// yig'indisiga AYNAN teng (1 425.46 = 1 425.46, tekshirildi).
function exchangeSignCheck() {
  const out = [];
  let bad = 0, tasir = 0, worst = null;

  for (const s of listSales()) {
    const total = +s.total || 0;
    const sub = s.subtotal == null ? null : +s.subtotal;
    if (sub == null || !Number.isFinite(sub)) continue;
    // Faqat ISHORA farqi qidiriladi. Chegirma tufayli summalar
    // farq qilishi normal — u bu tekshiruvning ishi emas.
    if (total === 0 || sub === 0) continue;
    if (Math.sign(total) === Math.sign(sub)) continue;
    bad++;
    const gap = Math.abs(total - sub);
    tasir += total - sub;
    if (!worst || gap > worst.gap) worst = { no: s.no, at: s.at, total, sub, gap };
  }

  if (bad) {
    out.push({
      id: "sale-sign", level: "error",
      title: `${bad} ta chekda summa ishorasi qatorlarga teskari — tushum ${money(tasir)} ga oshib ketgan`,
      detail: `Eng kattasi: ${worst.no} — chek ${money(worst.total)}, aslida ${money(worst.sub)}. `
        + "Almashtirishda do'kon mijozga pul QAYTARGAN, lekin u tushum sifatida yozilgan. "
        + "P&L tushumi va yalpi foyda shuncha ortiq ko'rinadi.",
      action: "Sotuvlarni ochish", href: "/sales",
    });
  }
  return out;
}

// —— AR aging = umumiy ochiq qarz ————————————————————————
// Qarz undirish hisoboti (`analytics.arAging`) ochiq qarzni yosh
// guruhlariga bo'ladi. Guruhlar yig'indisi umumiy ochiq qarzga
// (`debtsData.overallDebtStats`) TENG bo'lishi shart — aks holda
// bir sahifada 50 930 $, boshqasida 54 921 $ turadi.
//
// Bu aynan shunday bo'lgan edi (2026-08-22): `arAging` qoldiqni
// o'zi qayta hisoblab, qaytarish to'lovlarini (`kind === "return"`)
// ayirmay qolgan edi — farq 3 990.91 $. Tovar qaytarilsa pul
// kelmaydi, lekin QARZ KAMAYADI.
function arVsDebts() {
  const out = [];
  const a = arAging();
  const o = overallDebtStats();
  const guruh = +a.buckets.reduce((x, b) => x + b.open, 0).toFixed(2);

  if (!same(a.open, o.openAmount)) {
    out.push({
      id: "ar-total", level: "error",
      title: `Qarz hisobotidagi ochiq qarz umumiy raqamga teng emas`,
      detail: `AR aging ${money(a.open)}, umumiy hisob ${money(o.openAmount)}, farq ${money(a.open - o.openAmount)}.`,
      action: "Qarzlarni ochish", href: "/finance/debts",
    });
  }
  // Har guruh alohida yaxlitlangan (2 xona), jami esa xom yig'indidan —
  // farq eng ko'pi guruh soni × 0.005 (qarz 4 xona bilan yuriladi).
  if (Math.abs(guruh - a.open) > 0.005 * a.buckets.length + 0.001) {
    out.push({
      id: "ar-buckets", level: "error",
      title: `Yosh guruhlari yig'indisi jami qarzga teng emas`,
      detail: `Guruhlar ${money(guruh)}, jami ${money(a.open)}. Bir qarz guruhga tushmay qolgan.`,
      action: "Qarzlarni ochish", href: "/finance/debts",
    });
  }
  return out;
}

// —— Balans AR = Jami qarzdorlik = umumiy ochiq qarz ————————————
// Uchala raqam bitta ta'rifdan (`debtsData.ochiqQoldiq`) chiqadi va
// TENG bo'lishi shart. 2026-09-02 auditi: Balans `closedAt` ni
// tekshirmasdan `> 0.001` bilan, Qarzdorlar `> 0` bilan, AR aging
// `> 0.009` bilan sanardi — uch sahifa, uch raqam, tekshiruv yo'q.
function balansVsQarz() {
  const out = [];
  const b = balanceSheet(new Date()).receivables.total;
  const j = jamiQarz().jami;
  const o = overallDebtStats().openAmount;
  if (!same(b, j)) {
    out.push({
      id: "balans-ar", level: "error",
      title: `Balansdagi mijoz qarzi "Jami qarzdorlik" ga teng emas`,
      detail: `Balans ${money(b)}, jami qarzdorlik ${money(j)}, farq ${money(b - j)}.`,
      action: "Balansni ochish", href: "/finance/balance",
    });
  }
  if (!same(o, j)) {
    out.push({
      id: "qarz-jami", level: "error",
      title: `Umumiy ochiq qarz "Jami qarzdorlik" ga teng emas`,
      detail: `Umumiy hisob ${money(o)}, jami qarzdorlik ${money(j)}, farq ${money(o - j)}.`,
      action: "Qarzlarni ochish", href: "/finance/debts",
    });
  }
  return out;
}

// —— Qarz: to'langan summa = to'lov yozuvlari yig'indisi ————————
// Billz har qarz uchun `paid_amount` beradi (qancha to'langani), va
// alohida to'lov yozuvlarini ham (`debt_payments`: qachon, qancha,
// qanday usulda). Ikkalasi bir xil raqamni bildiradi — demak teng
// bo'lishi SHART.
//
// Nega bu tekshiruv yozildi (2026-08-21): `debt_payments` da RLS
// yoqilgan, lekin faqat INSERT siyosati bor edi — SELECT yo'q. Ya'ni
// bazada 16 000 ta to'lov yozuvi turgan holda brauzer ularning
// BITTASINI ham ololmasdi. Natijada har qarz "to'liq ochiq" bo'lib
// ko'rinardi va balansdagi "Mijozlardan olinadigan qarz" haqiqiydan
// katta chiqardi. Hech qanday xato chiqmasdi — shunchaki raqam
// noto'g'ri edi.
//
// DIQQAT — bu tekshiruv IKKI JOYDA IKKI XIL narsani tutadi:
//   • terminalda (`npm run tekshir`) qatorlar SQL orqali o'qiladi,
//     ya'ni RLS chetlab o'tiladi — o'sha yerda bu tekshiruv faqat
//     hisob farqini ko'radi, o'qish huquqi muammosini KO'RMAYDI;
//   • ilova ichida ("Tekshirib ko'ring" kartochkasi) esa RLS ishlaydi —
//     huquq yopiq bo'lsa aynan shu yerda qichqiradi.
// Shuning uchun "terminalda toza" degani "brauzerda ham toza" degani
// EMAS. Huquqqa tegishli har qanday shubha brauzerda tekshiriladi.
//
// Faqat Billz'dan kelgan qarzlar tekshiriladi: eski Excel qarzlarida
// qaytish sanalari modellashtirilgan, ularda `paid_amount` yo'q.
function debtPaidVsPayments() {
  const out = [];
  const billz = listDebts().filter((d) => d.source === "billz");
  if (!billz.length) return out;

  let bad = 0, gapSum = 0, worst = null;
  let bo_sh = 0;                      // to'lovi bor deyilgan, lekin yozuvi yo'q
  for (const d of billz) {
    const yozuv = paidOf(d);
    const billzda = +(d.paidAmount || 0);
    // Chegara TO'LOV SONIGA bog'liq. Billz to'lovni matn bo'lib beradi
    // ("Наличные: 2.500000") va har qatori alohida yaxlitlanadi —
    // ikki to'lovli qarzda yig'indi tabiiy ravishda bir tiyin siljiydi.
    // O'lchandi (2026-08-21): 1 000 qarzdan 9 tasida shunday, hammasi
    // aynan 0.01 va hammasi ikki to'lovli. Bu xato emas.
    const chegara = 0.011 * Math.max(1, d.payments?.length || 1);
    if (Math.abs(yozuv - billzda) < chegara) continue;
    bad++;
    const gap = Math.abs(yozuv - billzda);
    gapSum += gap;
    if (billzda > 0.01 && yozuv < 0.01) bo_sh++;
    if (!worst || gap > worst.gap) worst = { no: d.no, yozuv, billzda, gap };
  }

  if (!bad) return out;

  // Hammasi bo'sh bo'lsa sabab deyarli aniq — o'qish huquqi
  const hammasi = bo_sh === bad && bad > 5;
  out.push({
    id: "debt-paid",
    level: "error",
    title: `${bad} ta qarzda to'langan summa to'lov yozuvlariga teng emas`
      + ` — jami farq ${money(gapSum)}`,
    detail: hammasi
      ? "Hech bir qarzda to'lov yozuvi ko'rinmayapti, Billz esa to'langan "
        + "deb turibdi. Deyarli aniq sabab: `debt_payments` jadvalida "
        + "o'qish (SELECT) siyosati yo'q — `scripts/sql/debt-payments-read.sql`. "
        + "Ungacha ochiq qarz haqiqiydan KATTA ko'rinadi."
      : `Eng katta farq: ${worst.no} — yozuvlar bo'yicha ${money(worst.yozuv)}, `
        + `Billz bo'yicha ${money(worst.billzda)}. Ochiq qarz va balans shu `
        + "raqamdan hisoblanadi.",
    action: "Qarzlarni ochish", href: "/finance/debts",
  });
  return out;
}

// —— Chekdagi nasiya = shu davrda ochilgan qarzlar ————————————
// Billz nasiyani ikki yo'l bilan beradi: chekning `debt` to'lovi
// (`sales.debt`) va alohida qarz yozuvi (`/v1/debt` → `debts.amount`).
// Ikkisi bir narsa — hisob boshidan beri yig'indisi TENG bo'lishi
// shart (02.09 da o'lchandi: 89 307.36 = 49 580.20 + 39 727.16).
// Farq chiqsa: qarz sinxroni mijozsiz qarzni tashlagan (`noCustomer`)
// yoki chek to'lovi tanilmagan. Ungacha bu ikki raqam hech qayerda
// solishtirilmasdi.
function debtVsSales() {
  const boshi = new Date(getLedgerStart() + "T00:00:00").getTime();
  let chek = 0, qarz = 0, n = 0;
  for (const s of listSales()) {
    if (new Date(s.at).getTime() < boshi) continue;
    chek += +s.debt || 0;
  }
  for (const d of listDebts()) {
    if (new Date(d.createdAt).getTime() < boshi) continue;
    qarz += +d.amount || 0; n++;
  }
  chek = +chek.toFixed(2); qarz = +qarz.toFixed(2);
  // Chekdagi nasiya 2 xona (chek summasi kabi), qarz esa Billz'dagidek
  // 4 xona — har qarzda 0.005 gacha yaxlitlash farqi yig'iladi
  // (03.09: 89 307.36 ↔ 89 307.49, 13 tiyin). Chegara qarz soniga bog'liq.
  if (Math.abs(chek - qarz) <= 0.005 * n + 0.01) return [];
  return [{
    id: "qarz-chek", level: "error",
    title: `Chekdagi nasiya shu davrda ochilgan qarzlarga teng emas`,
    detail: `Cheklar (${getLedgerStart()} dan) ${money(chek)}, qarz yozuvlari ${money(qarz)}, farq ${money(chek - qarz)}. `
      + "Qarz sinxroni mijozsiz qarzni tashlagan yoki chek to'lovi tanilmagan bo'lishi mumkin.",
    action: "Sozlamalarni ochish", href: "/settings",
  }];
}

// —— P&L tushumi = o'sha davrdagi cheklar yig'indisi ————————
// Eng oddiy savol: "hisobotdagi tushum shu davrda yozilgan cheklarga
// tengmi?" Tengsiz bo'lsa — hisobot davrning bir qismini KO'RMAYAPTI.
//
// Nega yozildi (2026-08-21): P&L tushumni kunlik yakun (Сводный
// Excel) yuklangan bo'lsa o'shandan olardi va bazadagi Billz
// cheklarining HAMMASINI o'tkazib yuborardi. Yuklama 01–05 avgustni
// qamragan edi — natijada avgust tushumi 17 556 $ bo'lib ko'rinardi,
// bazada esa 76 940 $ turardi. **59 384 $, oyning 77 %i** hisobotdan
// tushib qolgan va hech qanday xato chiqmagan.
//
// Bu tekshiruv manba almashganda ham ishlaydi: P&L qaysi yo'ldan
// hisoblashidan qat'i nazar, natija cheklar yig'indisiga yaqin
// bo'lishi kerak.
function pnlVsSales() {
  const a = boshi(), b = bugun();
  const s = salesPnl(a, b);
  // Cheklar yig'indisi. Qaytarish manfiy — o'zi ayiriladi, ya'ni bu
  // ham SOF tushum, P&L dagi bilan bir ma'noda.
  const cheklar = +listSales()
    .filter((x) => { const d = new Date(x.at); return d >= a && d <= b; })
    .reduce((t, x) => t + (+x.total || 0), 0).toFixed(2);

  if (!cheklar && !s.revenue) return [];
  const farq = +(s.revenue - cheklar).toFixed(2);
  // 1 % — yaxlitlash va chek darajasidagi chegirma uchun bo'shliq
  const pct = cheklar ? Math.abs(farq / cheklar) * 100 : 100;
  if (pct < 1) return [];

  return [{
    id: "pnl-sales", level: "error",
    title: `P&L tushumi ${money(s.revenue)}, o'sha davrdagi cheklar ${money(cheklar)}`,
    detail: `Farq ${money(farq)} (${pct.toFixed(1)} %). Hisobot manbai: `
      + `"${s.manba}". Agar manba "baza" bo'lmasa — P&L davrning bir `
      + "qismini ko'rmayapti (yuklama eskirgan yoki qisqa davrni qamragan).",
    action: "Foyda va zararni ochish", href: "/finance/pnl",
  }];
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
  { id: "billz-items", name: "Billz: chek summasi = qatorlari yig'indisi", run: saleItemsVsTotal },
  { id: "tolov-taqsimot", name: "Billz: to'lovlar yig'indisi = chek summasi", run: paymentSplitVsTotal },
  { id: "servis-manba", name: "Servis kirimi: cheklar = Billz hisoboti", run: serviceSourceCheck },
  { id: "kpi-tushum", name: "KPI kunlik tushumi = Billz kunlik kirimi", run: kpiIncomeVsBillz },
  { id: "sale-sign", name: "Chek summasi ishorasi qatorlarga mos", run: exchangeSignCheck },
  { id: "ar-aging", name: "Qarz yosh guruhlari = umumiy ochiq qarz", run: arVsDebts },
  { id: "balans-ar", name: "Balans mijoz qarzi = Jami qarzdorlik", run: balansVsQarz },
  { id: "qarz-chek", name: "Chekdagi nasiya = ochilgan qarzlar", run: debtVsSales },
  { id: "debt-paid", name: "Qarz: to'langan summa = to'lov yozuvlari", run: debtPaidVsPayments },
  { id: "pnl-sales", name: "P&L tushumi = o'sha davrdagi cheklar", run: pnlVsSales },
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
