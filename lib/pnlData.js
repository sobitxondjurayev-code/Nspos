"use client";
// P&L (foyda va zarar) va Cash Flow (pul oqimi).
//
// MUHIM: bu ma'lumot Billz'dan kelmaydi. Billz'da "Прибыли и убытки"
// hisoboti bor, lekin NScamera'da u butunlay bo'sh — kompaniya xarajat,
// ish haqi va pul oqimini u yerda yuritmaydi. Shuning uchun P&L
// NSPOS'ning o'z modullaridan yig'iladi:
//   tushum      → sotuvlar (qaytarishlar ayirilgan) + xizmatlar
//   tannarx     → sotilgan tovarning costPrice'i + xizmat materiallari
//   xarajatlar  → kassa operatsiyalari + ish haqi + ombor yo'qotishlari
//
// Billz'dagi kabi naqd/naqdsiz ajratiladi.
import { salesInRange } from "./salesData";
import { listProducts } from "./productsData";
import { servicesSummary, ordersInRange, computeOrder } from "./servicesData";
import { listOperations, OP_CATEGORIES } from "./financeData";
import { expensesByCategory, totalExpenses, expenseStructure, expensesInRange } from "./expensesData";
import { payrollSummary, payrollCost } from "./payrollData";
import { debtCollections } from "./debtsData";
import { billzServiceIncome } from "./serviceIncome";
import { listOperations as listWarehouseOps, computeOperation } from "./warehouseData";
import { EXPORT_PNL, EXPORT_CASHFLOW_DAILY, EXPORT_DAILY } from "./billzExport";
import { uploadedPnl } from "./pnlUpload";
import { getLedgerStart } from "./companyData";
import { ymd } from "./dates";
import { dailyTotals } from "./dailyUpload";
import { billzKassaFlow } from "./kassaIncome";
import { moneyFlow, walletSources, WALLET_IDS } from "./kassaData";

const inRange = (at, from, to) => {
  const t = new Date(at).getTime();
  return t >= new Date(from).getTime() && t <= new Date(to).getTime();
};

// —— Tushum va tannarx ————————————————————————————
// Tannarx ikki manbadan keladi:
//   1. Billz'dan yuklangan cheklar (imported) — ularda tovar tarkibi yo'q,
//      shuning uchun tannarx kunlik yakundagi haqiqiy yalpi foydadan
//      chiqariladi: tannarx = sof tushum − yalpi foyda.
//   2. NSPOS'da yozilgan yangi cheklar — katalogdagi costPrice bo'yicha.
// Ikkalasi qo'shilsa takrorlanish bo'lmaydi: Billz kunlik yakuni faqat
// eski cheklarni qamraydi.
function billzCogs(from, to) {
  const a = new Date(from).toISOString().slice(0, 10);
  const b = new Date(to).toISOString().slice(0, 10);
  return +EXPORT_DAILY
    .filter((r) => r.date >= a && r.date <= b)
    .reduce((s, r) => s + (r.netRevenue - r.grossProfit), 0)
    .toFixed(2);
}

export function salesPnl(from, to) {
  const catalog = listProducts();
  const rows = salesInRange(from, to);

  // Billz tomoni. Kunlik yakun yuklangan bo'lsa — o'shandan (jonli
  // raqam). Yuklanmagan bo'lsa eski, muzlatilgan nusxadan.
  //
  // Diqqat, takrorlanish xavfi: yuklama bor paytda eski EXPORT_TRANSACTIONS
  // cheklari HAM qo'shilsa, bitta savdo ikki marta sanalardi. Shuning
  // uchun yuklama bo'lsa Billz'dan kelgan eski cheklar o'tkazib
  // yuboriladi — ular o'rniga kunlik yakun turadi.
  const live = dailyTotals(from, to);
  const useUpload = live.ready;

  let revenue = useUpload ? live.netRevenue : 0;
  let cogs = useUpload ? live.cogs : billzCogs(from, to);
  let returns = 0, discounts = 0;

  for (const s of rows) {
    if (useUpload && s.imported) continue;    // kunlik yakunda allaqachon bor

    revenue += s.total;                       // qaytarish manfiy, o'zi ayiriladi
    discounts += s.discountAmt ?? 0;
    if (s.type === "return") returns += Math.abs(s.total);

    if (s.imported) continue;                 // tannarxi yuqorida hisoblandi
    for (const i of s.items) {
      const p = catalog.find((x) => x.id === i.productId);
      const unitCost = p?.costPrice ?? 0;
      // Qaytarishda tovar omborga qaytadi — tannarx ham qaytariladi
      cogs += (s.type === "return" ? -1 : 1) * unitCost * i.qty;
    }
  }

  return {
    revenue: +revenue.toFixed(2),
    cogs: +cogs.toFixed(2),
    returns: +returns.toFixed(2),
    discounts: +discounts.toFixed(2),
    grossProfit: +(revenue - cogs).toFixed(2),
    count: rows.filter((s) => s.type !== "return").length,
  };
}

// —— Xarajatlar ————————————————————————————————
// P&L XARAJAT emas, shuning uchun chegirilmaydigan kassa chiqimlari:
//   supply             — tovar xaridi: bu ombor aktivi, sotilgandagina COGS bo'ladi
//   supplier_payment   — yetkazib beruvchiga to'lov: kreditor qarzni yopadi
//   salary             — ish haqi payroll modulida alohida hisoblanadi
// Bularni qo'shsak bir xil pul ikki marta chegirilardi.
const NON_PNL_OPS = ["supply", "supplier_payment", "salary"];

export function expensesPnl(from, to) {
  // Kassa operatsiyalaridagi chiqimlar, kategoriya kesimida
  const ops = listOperations().filter(
    (o) => o.type === "chiqim" && !NON_PNL_OPS.includes(o.category) && inRange(o.at, from, to)
  );
  const byCategory = {};
  for (const o of ops) {
    const label = OP_CATEGORIES[o.category]?.label ?? o.category;
    byCategory[label] = +((byCategory[label] ?? 0) + o.amount).toFixed(2);
  }
  const operationsTotal = +ops.reduce((a, o) => a + o.amount, 0).toFixed(2);

  // Xarajatlar moduli (ijara, kommunal, transport, soliq…).
  // OYLIK bu yerdan CHIQARILADI: ish haqi pastda payroll modulidan
  // hisoblangani bo'yicha olinadi (P&L hisoblash usulida yuritiladi).
  // Aks holda bir xil oylik ikki marta chegirilardi — xarajat yozuvi
  // sifatida ham, payroll sifatida ham. Usta olgan puli ham shu
  // qatorda: u ham "salary" turidagi xarajat (expensesData).
  const opex = expensesByCategory(from, to).filter((c) => c.key !== "salary");
  for (const c of opex) byCategory[c.label] = +((byCategory[c.label] ?? 0) + c.amount).toFixed(2);
  const opexTotal = +expensesInRange(from, to)
    .filter((e) => e.category !== "salary")
    .reduce((a, e) => a + e.amount, 0).toFixed(2);

  // Ish haqi — hisoblangani (to'langani emas): P&L hisoblash usulida yuritiladi
  const payroll = payrollSummary(from, to);

  // Ombor yo'qotishlari: hisobdan chiqarish + inventarizatsiya kamomadi
  let writeoff = 0, shrinkage = 0;
  for (const w of listWarehouseOps()) {
    if (w.status !== "applied" || !inRange(w.appliedAt ?? w.at, from, to)) continue;
    const c = computeOperation(w);
    if (w.type === "writeoff") writeoff += c.totalValue;
    if (w.type === "inventory") {
      shrinkage += c.rows.filter((r) => r.diff < 0).reduce((a, r) => a + Math.abs(r.value), 0);
    }
  }

  // KPI moduli hisoblagan oylik (so'mdan dollarga o'girilgan).
  // Kurs qo'yilmagan bo'lsa 0 — hisobotda "kurs kiriting" deb turadi,
  // taxminiy raqam qo'shilmaydi.
  const kpiPay = payroll.kpiUsd ?? 0;
  // KPI bor bo'lsa ish haqi manbai o'sha — eski hisob takrorlanmaydi.
  // Formula `payrollData.payrollCost` da: rahbariyat paneli va balans
  // ham aynan shu funksiyani chaqiradi, aks holda har sahifa o'z
  // ish haqi raqamini chiqarardi (2026-08-14).
  const cost = payrollCost(from, to);
  if (cost > 0) byCategory["Ish haqi"] = +((byCategory["Ish haqi"] ?? 0) + cost).toFixed(2);

  return {
    byCategory,
    operationsTotal,
    opex: opexTotal,
    opexStructure: expenseStructure(from, to),
    // Ish haqidagi usta ulushi xizmat foydasida allaqachon chegirilgan,
    // ikki marta sanamaslik uchun bu yerda faqat qat'iy + sotuv foizi + bonus
    payroll: cost,
    payrollSom: payroll.kpiSom,          // so'mdagi asl summa
    payrollRate: payroll.kpiRate,        // qaysi kurs bilan o'girildi
    payrollFromKpi: kpiPay > 0,
    installerShare: payroll.serviceShare,
    writeoff: +writeoff.toFixed(2),
    shrinkage: +shrinkage.toFixed(2),
    total: +(operationsTotal + opexTotal + cost + writeoff + shrinkage).toFixed(2),
  };
}

// —— To'liq P&L ————————————————————————————————
export function profitAndLoss(from, to) {
  const sales = salesPnl(from, to);
  const services = servicesSummary(from, to);
  const expenses = expensesPnl(from, to);

  // Xizmat tushumi: xizmat ishi + materiallar.
  // computeOrder'da profit = total − materialsCost − installerShare,
  // demak materialsCost = total − profit − installerShare.
  const serviceRevenue = services.total;
  const serviceMaterialsCost = +(serviceRevenue - services.profit - services.installerShare).toFixed(2);

  const totalRevenue = +(sales.revenue + serviceRevenue).toFixed(2);
  const totalCogs = +(sales.cogs + serviceMaterialsCost).toFixed(2);
  const grossProfit = +(totalRevenue - totalCogs).toFixed(2);
  const netProfit = +(grossProfit - expenses.total - expenses.installerShare).toFixed(2);

  return {
    revenue: {
      goods: sales.revenue,
      services: serviceRevenue,
      total: totalRevenue,
      returns: sales.returns,
      discounts: sales.discounts,
      salesCount: sales.count,
      serviceCount: services.count,
    },
    cogs: {
      goods: sales.cogs,
      serviceMaterials: serviceMaterialsCost,
      total: totalCogs,
    },
    grossProfit,
    grossMargin: totalRevenue > 0 ? +((grossProfit / totalRevenue) * 100).toFixed(1) : 0,
    expenses,
    netProfit,
    netMargin: totalRevenue > 0 ? +((netProfit / totalRevenue) * 100).toFixed(1) : 0,
  };
}

// —— Billz P&L (haqiqiy, taqqoslash uchun) ————————————
// Manba: "Отчет прибыли и убытки" eksporti, 22.07.2026.
// Billz tuzilmasi: Выручка − Скидки − Возвраты = Чистая выручка,
// keyin − Себестоимость = Маржинальная прибыль = Чистая прибыль.
// Diqqat: Billz OPERATSION XARAJATLARNI hisobga olmaydi (ish haqi,
// ijara, kommunal) — shuning uchun uning "чистая прибыль" si aslida
// yalpi foyda. NSPOS'da ular ham chegirilgani uchun raqam farq qiladi.
// Yuklama bor bo'lsa o'shandan, bo'lmasa 22-iyuldagi eski nusxadan.
// Shunda yangi eksport yuklangan zahoti P&L o'zi yangilanadi, yuklamasiz
// esa interfeys bo'sh qolib ketmaydi.
//
// Hisob FAQAT hisob boshlanish sanasidan (companies.ledger_start,
// hozircha 1-avgust) boshlab yuritiladi — undan oldingi oylar
// kelishuvga ko'ra sanalmaydi. Eksport kengroq davrni qamrasa ham,
// eski oylar bu yerda kesib tashlanadi va jamilar qolgan oylardan
// qayta yig'iladi: Billz'ning "Всего" ustuni butun davrniki, uni
// olsak kesish ma'nosiz bo'lib qolardi.
const MONTH_KEYS = ["revenue", "discounts", "returns", "netRevenue", "totalIncome",
  "cogs", "grossProfit", "writeoffCost", "totalExpense", "netProfit"];

// "01.2026" → "2026-01"
const monthSortKey = (m) => {
  const [mm, yyyy] = String(m).split(".");
  return `${yyyy}-${mm}`;
};

function sinceLedgerStart(row) {
  const from = String(getLedgerStart()).slice(0, 7);   // "2026-08"
  const months = Object.entries(row.byMonth ?? {})
    .filter(([m]) => monthSortKey(m) >= from);
  const out = { ...row, byMonth: Object.fromEntries(months) };
  for (const k of MONTH_KEYS) {
    out[k] = +months.reduce((a, [, v]) => a + (v[k] ?? 0), 0).toFixed(4);
  }
  out.grossMarginPct = out.netRevenue > 0
    ? +((out.grossProfit / out.netRevenue) * 100).toFixed(2) : 0;
  return out;
}

const pnlSource = () => {
  const up = uploadedPnl();
  return (up.ready ? up.rows : EXPORT_PNL).map(sinceLedgerStart);
};

export const billzPnlIsUploaded = () => uploadedPnl().ready;

// —— Ikki manbani solishtirish ————————————————————————
// Billz ikkita hisobot beradi va ular BIR DAVR uchun ham har xil raqam
// ko'rsatishi mumkin (2026-08-05 da 1–5 avgust uchun yalpi foyda 13.5%
// farq qilgan). Sababi Billz ichida — hisobotlar boshqacha yig'iladi.
//
// Ilova o'z hisobini kunlik yakundan quradi, chunki faqat u ixtiyoriy
// sana oralig'ini qo'llaydi. Lekin farqni yashirmaymiz: ikkalasi ham
// yuklangan bo'lsa va ular sezilarli farq qilsa, ekranda aytiladi.
export function pnlSourceGap(from, to) {
  const up = uploadedPnl();
  if (!up.ready) return null;

  // "Прибыли и убытки" faqat OYLIK — shuning uchun tanlangan oraliq
  // qanday bo'lishidan qat'i nazar, solishtirish oraliq tegib
  // o'tadigan TO'LIQ oylar bo'yicha boradi. Aks holda "oy boshidan
  // bugungacha" tanlanganda yarim oy to'liq oy bilan solishtirilib,
  // soxta farq chiqardi.
  const a = new Date(from), b = new Date(to);
  const first = new Date(a.getFullYear(), a.getMonth(), 1);
  const last = new Date(b.getFullYear(), b.getMonth() + 1, 0);

  const ledger = String(getLedgerStart()).slice(0, 7);
  const keys = [];
  for (const c = new Date(first); c <= last; c.setMonth(c.getMonth() + 1)) {
    const ym = `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}`;
    if (ym < ledger) continue;               // hisobga kirmaydigan oylar
    keys.push(`${String(c.getMonth() + 1).padStart(2, "0")}.${c.getFullYear()}`);
  }
  if (!keys.length) return null;

  const ymd = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const daily = dailyTotals(ymd(first), ymd(last));
  if (!daily.ready) return null;

  const sum = (k) => +up.rows.reduce((s, r) =>
    s + keys.reduce((m, key) => m + (r.byMonth[key]?.[k] ?? 0), 0), 0).toFixed(2);

  const pnlNet = sum("netRevenue"), pnlCogs = sum("cogs");
  const pnlGross = +(pnlNet - pnlCogs).toFixed(2);
  const ourGross = +(daily.netRevenue - daily.cogs).toFixed(2);
  const gap = +(ourGross - pnlGross).toFixed(2);
  const pct = pnlGross > 0 ? Math.abs(gap / pnlGross) * 100 : 0;

  // 1% dan kichik farq — yaxlitlash, e'tibor bermaymiz
  if (pct < 1) return null;
  return {
    ourRevenue: daily.netRevenue, ourGross,
    pnlRevenue: pnlNet, pnlGross,
    gap, pct: +pct.toFixed(1),
  };
}

export const billzPnl = () => pnlSource().filter((p) => p.revenue > 0);

export function billzPnlTotals() {
  const rows = pnlSource();
  const sum = (k) => +rows.reduce((a, r) => a + (r[k] ?? 0), 0).toFixed(2);
  const revenue = sum("revenue");
  const netRevenue = sum("netRevenue");
  const cogs = sum("cogs");
  const grossProfit = sum("grossProfit");
  return {
    revenue, netRevenue, cogs, grossProfit,
    discounts: sum("discounts"), returns: sum("returns"),
    grossMarginPct: netRevenue > 0 ? +((grossProfit / netRevenue) * 100).toFixed(2) : 0,
    // Raqamlar qaysi kunga tegishli: yuklama bo'lsa yuklangan kun,
    // bo'lmasa eski nusxa muzlatilgan kun
    date: String(uploadedPnl().at ?? "2026-07-22").slice(0, 10),
  };
}

// —— Billz ДДС (haqiqiy pul oqimi) ————————————————
// Manba: "ДДС" eksporti. Kassa va to'lov turi bo'yicha ajratilgan.
export function billzCashflow(from, to) {
  // ДДС yuklangan bo'lsa — o'shandan. Hamyonlar bo'yicha yig'indi
  // kassaIncome'da allaqachon hisoblanadi (kassa sahifasi ham shundan
  // oziqlanadi), shuning uchun uni qayta yozmaymiz — do'konlar bo'yicha
  // qo'shib chiqamiz.
  const up = billzKassaFlow(from, to);
  if (up.ready) {
    const w = (name) => +Object.values(up.byStore)
      .reduce((a, s) => a + (s[name].in - s[name].out), 0).toFixed(2);
    const cash = w("cash"), payme = w("payme"), service = w("service");
    return {
      cash, payme, service, card: 0,
      total: +(cash + payme + service).toFixed(2),
      count: up.rows, days: up.days,
    };
  }

  const rows = EXPORT_CASHFLOW_DAILY.filter(
    (r) => !from || (r.date >= ymd(from) && r.date <= ymd(to))
  );
  const sum = (f) => +rows.filter(f).reduce((a, r) => a + r.in - r.out, 0).toFixed(2);
  const count = rows.reduce((a, r) => a + r.count, 0);
  return {
    cash: sum((r) => r.method === "cash"),
    payme: sum((r) => r.method === "payme"),
    card: sum((r) => r.method === "card"),
    total: sum(() => true),
    count,
    days: new Set(rows.map((r) => r.date)).size,
  };
}

// —— Cash Flow (pul oqimi) ————————————————————————
// MANBA — KASSA JURNALI, boshqa hech narsa emas.
//
// 2026-08-14 gacha bu funksiya eski sotuv modulidan hisoblardi
// (`sales` jadvalidagi chek bo'yicha naqd/karta/Payme ulushi). Natijada
// bir davr uchun "Pul kirimi 11 826.19" deb turardi, Pul rejasi
// sahifasi esa o'sha davr uchun 59 237.65 ko'rsatardi — 47 000 $ farq.
// Sabab: Billz cheklari NSPOS'ga to'lov turi bilan tushmaydi, pul esa
// menejerning kunlik jadvalidan kassaga yoziladi.
//
// Endi ikkala sahifa bitta manbadan o'qiydi: `kassaData.moneyFlow`
// (jami) va `kassaData.walletSources` (hamyon kesimi). Shuning uchun
// "Pul oqimi" va "Pul rejasi" raqamlari doim teng.
export function cashFlow(from, to) {
  const flow = moneyFlow(from, to);

  // Hamyon kesimi — kartochkalardagi raqam bilan bitta manbadan.
  // Kassadan kassaga ko'chish sanalmaydi (walletSources uni tashlaydi),
  // aks holda bir pul ikki marta kirim bo'lib ko'rinardi.
  const w = {};
  for (const id of WALLET_IDS) {
    const list = walletSources(id, from, to);
    w[id] = {
      in: +list.filter((x) => !x.out).reduce((s, x) => s + x.amount, 0).toFixed(2),
      out: +list.filter((x) => x.out).reduce((s, x) => s + x.amount, 0).toFixed(2),
    };
  }

  const totalIn = +(w.cash.in + w.payme.in + w.service.in).toFixed(2);
  const totalOut = +(w.cash.out + w.payme.out + w.service.out).toFixed(2);

  return {
    in: {
      // Nomlar eski qolgan (sahifa shularni chizadi): "sotuv" = kassaga
      // tushgan pul, ya'ni menejerning kunlik jadvali + qo'lda kirim.
      salesCash: w.cash.in,
      salesPayme: w.payme.in,
      salesCard: 0,                 // karta ishlatilmaydi
      salesBalance: 0,
      // Qaytgan qarz puli alohida ko'rsatilmaydi: u menejer yozgan
      // kunlik naqd/Payme ichida allaqachon bor. Alohida qator qilib
      // qo'shsak, bir pul ikki marta sanalardi.
      debtCollected: 0,
      opsCash: 0, opsNonCash: 0,
      service: w.service.in,
      total: totalIn,
    },
    serviceSource: { period: null, ready: true, covered: 1 },
    out: { cash: w.cash.out, nonCash: w.payme.out, service: w.service.out, total: totalOut },
    net: +(totalIn - totalOut).toFixed(2),
    // Qarzga ketgan tushum — pul emas, izoh uchun
    onCredit: +salesInRange(from, to).reduce((a, s) => a + (s.debt ?? 0), 0).toFixed(2),
    fromBalance: 0,
    // Har hamyonning davr ichidagi sof harakati. Hisob boshidan bugungacha
    // olinsa, bu aynan kassalardagi qoldiqqa teng chiqadi.
    byMethod: {
      cash: +(w.cash.in - w.cash.out).toFixed(2),
      nonCash: +(w.payme.in - w.payme.out).toFixed(2),
      service: +(w.service.in - w.service.out).toFixed(2),
    },
    // Pul rejasi sahifasidagi kartochkalar bilan bir xil bo'lishi uchun
    ledger: { in: flow.in, out: flow.out, net: flow.net },
  };
}
