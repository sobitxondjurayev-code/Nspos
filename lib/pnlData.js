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
import { salesInRange, qatorTannarx } from "./salesData";
import { allProducts } from "./productsData";
import { servicesSummary, ordersInRange, computeOrder } from "./servicesData";
import { listOperations, OP_CATEGORIES } from "./financeData";
import { expensesByCategory, totalExpenses, expenseStructure, expensesInRange, kelishXarajati, tannarxgaMi } from "./expensesData";
import { payrollSummary, payrollCost, berilganOylik } from "./payrollData";
import { debtCollections, shuKuniYopilgan, qarzgaQaytarish } from "./debtsData";
// `serviceIncome` BU YERDA KERAK EMAS: P&L dagi `revenue.services`
// NSPOS'ning O'Z "Xizmatlar" modulidan keladi (`service_orders`), Billz
// montajidan emas. Montaj Billz'da oddiy tovar bo'lib sotiladi, ya'ni
// u allaqachon `revenue.goods` ichida — ikkinchi marta qo'shilsa
// tushum montaj summasiga oshib ketardi. Import ishlatilmasdan turgan
// edi va shu chalkashlikni ochiq qoldirardi.
import { listOperations as listWarehouseOps, computeOperation } from "./warehouseData";
// ══════════════════════════════════════════════════════════════
// DIQQAT: `lib/billzExport.js` BU YERDA ISHLATILMAYDI
// ══════════════════════════════════════════════════════════════
// U 2 MB lik fayl bo'lib, ichida 6 792 ta HAQIQIY telefon raqami va
// mijoz ismi bor. Import qilinsa u brauzer to'plamiga tushadi —
// ya'ni har xodim DevTools ochib butun mijozlar bazasini ko'ra
// oladi. Bazadagi 56 ta RLS siyosati bunga TA'SIR QILMAYDI, chunki
// ma'lumot bazadan emas, KODNING ICHIDAN keladi.
//
// Endi baza to'la (9 087 mijoz, 9 032 chek, 34 489 qator) va u
// yagona manba. Boshlang'ich qiymat BO'SH: ma'lumot kelguncha
// ekranda "yuklanmoqda" turadi — bu soxta raqamdan yaxshiroq.
//
// Fayl repoda qoladi (hech narsa o'chirilmaydi), lekin uni endi
// hech kim import qilmaydi va u to'plamga tushmaydi.
import { uploadedPnl } from "./pnlUpload";
import { getLedgerStart, sozlama } from "./companyData";
import { ymd } from "./dates";
import { dailyTotals } from "./dailyUpload";
import { billzKassaFlow } from "./kassaIncome";
import { moneyFlow, walletSources, WALLET_IDS, listOps, kassaBalances, kassaIds } from "./kassaData";

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
function billzCogs() {
  // Ilgari bu muzlatilgan `EXPORT_DAILY` dan hisoblanardi. Endi
  // chek qatorlari bazada va tannarx `salesPnl` da qator darajasida
  // olinadi — bu zaxira yo'l faqat baza BO'SH bo'lganda ishlaydi,
  // ya'ni hisoblaydigan narsa yo'q.
  return 0;
}

export function salesPnl(from, to) {
  const catalog = allProducts();     // arxivlangan tovar ham — chek qatori tannarxi uchun
  const rows = salesInRange(from, to);

  // ── Manba tanlash ──────────────────────────────────────────
  // Cheklar TARKIBI bilan kelayotgan bo'lsa — hisob shundan quriladi.
  // Bu eng to'liq manba: har chek, har qator, o'z tannarxi bilan.
  //
  // 2026-08-21 gacha teskari edi: kunlik yakun (Сводный Excel)
  // yuklangan bo'lsa u USTUN turardi va `s.imported` cheklarning
  // HAMMASI o'tkazib yuborilardi. Yuklama esa 01–05 avgustni
  // qamragan (15 qator, 05.08 da yuklangan) — natijada avgust
  // tushumi 17 556 $ bo'lib ko'rinardi, aslida 76 940 $.
  // **59 384 $, ya'ni oyning 77 %i hisobotga umuman kirmasdi** va
  // hech qanday xato chiqmasdi.
  //
  // Yuklama olib tashlanmaydi: baza bo'sh bo'lsa (demo rejim yoki
  // sinxronizatsiya hali yurmagan) u zaxira bo'lib qoladi.
  const itemsBor = rows.some((s) => s.items?.length);

  if (itemsBor) {
    const byId = new Map(catalog.map((p) => [p.id, p]));
    let revenue = 0, cogs = 0, returns = 0, discounts = 0, gross = 0;
    // Tannarxi NOMA'LUM qatorlar — tannarxga 0 emas, ALOHIDA sanaladi
    // (DAFTAR 20): P&L "Tannarxsiz sotuv: N qator, X $" deb ko'rsatadi.
    const tannarxsiz = { qatorlar: 0, summa: 0 };
    let servisQatorlar = 0;
    for (const s of rows) {
      revenue += s.total;                     // qaytarish manfiy — o'zi ayiriladi
      discounts += s.discountAmt ?? 0;
      if (s.type === "sale") gross += s.total;
      if (s.type === "return") returns += Math.abs(s.total);

      for (const i of s.items ?? []) {
        // BITTA QOIDA — `salesData.qatorTannarx`: xizmat 0, qator,
        // katalog, aks holda null. Rahbariyat paneli va tovar kesimi
        // ham aynan shuni chaqiradi.
        const { tannarx, manba } = qatorTannarx(i, byId.get(i.productId));
        if (manba === "xizmat") servisQatorlar++;
        if (tannarx == null) { tannarxsiz.qatorlar++; tannarxsiz.summa += +i.total || 0; continue; }
        // Ishora QATOR darajasida: sotuv musbat, qaytarish manfiy,
        // almashuvda ikkalasi ham bo'ladi (346 musbat / 261 manfiy).
        // Shuning uchun chek turiga qarab ko'paytirilmaydi — aks holda
        // qaytarish ikki marta manfiy bo'lib, tannarx qo'shilib ketardi.
        cogs += tannarx * i.qty;
      }
    }
    return {
      revenue: +revenue.toFixed(2),
      // Yalpi savdo (faqat `sale` cheklari) — P&L bosh qatori:
      // Yalpi savdo → (−) qaytarish → sof savdo (`revenue`).
      gross: +gross.toFixed(2),
      cogs: +cogs.toFixed(2),
      returns: +returns.toFixed(2),
      discounts: +discounts.toFixed(2),
      grossProfit: +(revenue - cogs).toFixed(2),
      count: rows.filter((s) => s.type !== "return").length,
      tannarxsiz: { qatorlar: tannarxsiz.qatorlar, summa: +tannarxsiz.summa.toFixed(2) },
      servisQatorlar,
      manba: "baza",
    };
  }

  // ── Zaxira yo'l: chek tarkibi yo'q ─────────────────────────
  // Kunlik yakun yuklangan bo'lsa — o'shandan. Bo'lmasa eski,
  // muzlatilgan nusxadan.
  const live = dailyTotals(from, to);
  const useUpload = live.ready;

  let revenue = useUpload ? live.netRevenue : 0;
  let cogs = useUpload ? live.cogs : billzCogs();
  let returns = 0, discounts = 0;

  for (const s of rows) {
    if (useUpload && s.imported) continue;    // kunlik yakunda allaqachon bor

    revenue += s.total;
    discounts += s.discountAmt ?? 0;
    if (s.type === "return") returns += Math.abs(s.total);

    if (s.imported) continue;                 // tannarxi yuqorida hisoblandi
    for (const i of s.items) {
      const p = catalog.find((x) => x.id === i.productId);
      const unitCost = p?.costPrice ?? 0;
      cogs += (s.type === "return" ? -1 : 1) * unitCost * i.qty;
    }
  }

  return {
    revenue: +revenue.toFixed(2),
    gross: +rows.filter((s) => s.type === "sale").reduce((a, s) => a + s.total, 0).toFixed(2),
    cogs: +cogs.toFixed(2),
    returns: +returns.toFixed(2),
    discounts: +discounts.toFixed(2),
    grossProfit: +(revenue - cogs).toFixed(2),
    count: rows.filter((s) => s.type !== "return").length,
    tannarxsiz: { qatorlar: 0, summa: 0 },
    servisQatorlar: 0,
    manba: useUpload ? "yuklama" : "eski nusxa",
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
  //
  // TOVAR KELISH XARAJATI (`cogs` turlari — yo'lkira, dostavka) BU
  // YERDAN CHIQARILADI: u OPEX emas, tannarx (menejerlar so'rovi,
  // 2026-09-05). Filtr AYNAN shu ikki joyda bo'lishi kerak —
  // `byCategory` xarajat qatorlarini chizadi, `opexTotal` esa
  // `total` ga kiradi. Bittasida unutilsa yo'lkira ikki marta
  // ayirilardi va sof foyda o'sha summaga kamayib ketardi.
  const opex = expensesByCategory(from, to).filter((c) => c.key !== "salary" && !tannarxgaMi(c.key));
  for (const c of opex) byCategory[c.label] = +((byCategory[c.label] ?? 0) + c.amount).toFixed(2);
  const opexTotal = +expensesInRange(from, to)
    .filter((e) => e.category !== "salary" && !tannarxgaMi(e.category))
    .reduce((a, e) => a + e.amount, 0).toFixed(2);
  // Tannarxga ketadigan qismi — YAGONA ta'rifdan (`expensesData`)
  const kelish = kelishXarajati(from, to);

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

  // Kompaniya balansidan "Boshqa chiqim" (`kassa_ops` out/other_out) —
  // 2026-09-04 gacha P&L ga UMUMAN kirmasdi (DAFTAR 20 L). Tovar xaridi
  // (`goods`/`import`) va NS (`personal`) bu yerga KIRMAYDI: biri ombor
  // aktivi, ikkinchisi foydani taqsimlash — ular pul oqimida.
  const a = ymd(from), b = ymd(to);
  const boshqaChiqim = +listOps()
    .filter((o) => o.kind === "out" && o.category === "other_out" && o.date >= a && o.date <= b)
    .reduce((s, o) => s + o.amount, 0).toFixed(2);
  if (boshqaChiqim > 0) byCategory["Boshqa chiqim (kassa)"] = +((byCategory["Boshqa chiqim (kassa)"] ?? 0) + boshqaChiqim).toFixed(2);

  return {
    byCategory,
    operationsTotal,
    opex: opexTotal,
    opexStructure: expenseStructure(from, to),
    // Ish haqidagi usta ulushi xizmat foydasida allaqachon chegirilgan,
    // ikki marta sanamaslik uchun bu yerda faqat qat'iy + sotuv foizi + bonus
    payroll: cost,
    payrollSom: payroll.kpiSom,          // so'mdagi asl summa
    payrollRate: payroll.kpiRate,        // qaysi kurs bilan o'girildi (oxirgi oy)
    payrollKurslar: payroll.kurslar,     // har oy o'z kursi (`ratesData.oyKursi`)
    payrollFromKpi: kpiPay > 0,
    installerShare: payroll.serviceShare,
    boshqaChiqim,
    writeoff: +writeoff.toFixed(2),
    shrinkage: +shrinkage.toFixed(2),
    // Tovar kelish xarajati — `total` ga QO'SHILMAYDI (u tannarxda
    // hisoblanadi). `installerShare` bilan bir xil naqsh: qiymat
    // qaytariladi, lekin jamiga kirmaydi. Formulaga `+ kelish` deb
    // qo'shilsa yo'lkira ikki marta ayiriladi — `moslik` dagi
    // `kelish-tannarx` tekshiruvi aynan shuni tutadi.
    kelish: kelish.total,
    kelishByCategory: kelish.byCategory,
    total: +(operationsTotal + opexTotal + cost + boshqaChiqim + writeoff + shrinkage).toFixed(2),
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
  // Tannarx = sotilgan tovar + xizmat materiali + TOVAR KELISH
  // XARAJATI (yo'lkira, dostavka — `expenses.kelish`). Oxirgisi
  // `expenses.total` dan allaqachon chiqarilgan, ya'ni u faqat shu
  // yerda bir marta ayiriladi va `soliqdanOldin` formulasi (pastda)
  // o'zgarmagani uchun SOF FOYDA o'zgarmaydi — pul OPEX qatoridan
  // tannarx qatoriga ko'chadi, xolos.
  const totalCogs = +(sales.cogs + serviceMaterialsCost + expenses.kelish).toFixed(2);
  const grossProfit = +(totalRevenue - totalCogs).toFixed(2);
  const soliqdanOldin = +(grossProfit - expenses.total - expenses.installerShare).toFixed(2);
  // Soliq zaxirasi — Sozlamalar → `soliq.foiz` (standart 0: qator
  // ko'rinmaydi). Foyda musbat bo'lgandagina; zarardan soliq yo'q.
  // Bu haqiqiy soliq emas, ZAXIRA — rahbar foizni o'zi belgilaydi
  // (DAFTAR 20 O).
  const soliqFoiz = Math.max(0, Number(sozlama("soliq.foiz", 0)) || 0);
  const soliq = +(soliqdanOldin > 0 ? soliqdanOldin * soliqFoiz / 100 : 0).toFixed(2);
  const netProfit = +(soliqdanOldin - soliq).toFixed(2);

  return {
    soliq: { foiz: soliqFoiz, summa: soliq },
    soliqdanOldin,
    revenue: {
      goods: sales.revenue,
      // Yalpi savdo (qaytarishgacha) — ekranda "Yalpi savdo → qaytarish
      // → sof savdo" bo'lib turadi; qaytarish foizi shundan.
      gross: sales.gross,
      returnsPct: sales.gross > 0 ? +((sales.returns / sales.gross) * 100).toFixed(1) : 0,
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
      // Tovar kelish xarajati — Xarajatlarda `cogs` deb belgilangan
      // turlar (Sozlamalar → Xarajat turlari). `ulush` — tovar
      // tannarxiga nisbatan foizi: "25 $ tovar aslida qancha turadi"
      // degan savolga javob.
      kelish: expenses.kelish,
      kelishByCategory: expenses.kelishByCategory,
      kelishUlush: sales.cogs > 0 ? +((expenses.kelish / sales.cogs) * 100).toFixed(2) : 0,
      total: totalCogs,
      // Tannarxi noma'lum qatorlar — tannarxga KIRMAGAN, ya'ni yalpi
      // foyda shu summa bo'yicha aniq emas. 0 deb yozilmaydi.
      tannarxsiz: sales.tannarxsiz,
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
  return (up.ready ? up.rows : []).map(sinceLedgerStart);
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

  // Billz ДДС muzlatilgan nusxasi olib tashlandi — bu manba
  // faqat Excel yuklamasidan keladi.
  const rows = [].filter(
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
      salesCard: 0,                 // karta bank hamyoni ichida (`salesPayme`), DAFTAR 20
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
    // Chiqimning "qayerga ketdi" bo'linishi — kompaniya balansidan
    // (DAFTAR 20 E/K): tovar uchun to'lov aktiv, NS — foydani taqsimlash.
    // Ikkalasi `out.total` ichida; alohida qator sifatida ko'rsatiladi.
    tovarUchun: kassaChiqim(from, to, ["goods", "import"]),
    ns: kassaChiqim(from, to, ["personal"]),
    boshqaChiqim: kassaChiqim(from, to, ["other_out"]),
  };
}

// `kassa_ops` chiqimi kategoriya bo'yicha, davr ichida
function kassaChiqim(from, to, kategoriyalar) {
  const a = ymd(from), b = ymd(to);
  return +listOps()
    .filter((o) => o.kind === "out" && kategoriyalar.includes(o.category) && o.date >= a && o.date <= b)
    .reduce((s, o) => s + o.amount, 0).toFixed(2);
}

// ══════════════════════════════════════════════════════════════
// FOYDA → PUL KO'PRIGI — "foyda bor, pul yo'q" degan savolga javob
// ══════════════════════════════════════════════════════════════
// DAFTAR 20 (R): Optim 88 % nasiya bilan sotadi, tovar uchun pul
// alohida chiqadi, rahbar NS oladi — sof foyda bilan kassa o'zgarishi
// hech qachon teng bo'lmaydi va buni ko'rsatib berish tizimning ishi.
//
//   sof foyda (P&L)
//   − nasiya o'sishi      = davrda berilgan qarz − tushgan to'lov − qarzga qaytarilgan tovar
//   + tannarx             = sotilgan tovar avval sotib olingan (pul chiqmadi)
//   − tovar uchun to'lov  = kassa_ops goods/import (aktiv, P&L'da yo'q)
//   − NS                  = rahbar olgan pul (foydani taqsimlash)
//   + hisoblangan oylik − berilgan oylik   (P&L hisoblab chegiradi, kassadan berilgani chiqadi)
//   + soliq zaxirasi      = pul chiqmagan
//   = KUTILGAN kassa o'zgarishi
//   haqiqiy = kassalar jami (davr oxiri) − (davr boshi)
//   izohlanmagan = haqiqiy − kutilgan  — YASHIRILMAYDI: bu yozilmagan
//   tovar xaridi, ta'minotchi qarzi yoki kiritilmagan xarajat (ombor
//   harakati Billz'dan kelguncha — DAFTAR 20 E — shu qator katta bo'ladi).
export function foydaPulKoprigi(from, to) {
  const p = profitAndLoss(from, to);
  const qarz = shuKuniYopilgan(from, to);        // .berilgan — davrda ochilgan qarzlar
  const tolangan = debtCollections(from, to).total;
  const qaytarilgan = qarzgaQaytarish(from, to).total;
  const nasiyaOsishi = +(qarz.berilgan - tolangan - qaytarilgan).toFixed(2);
  // Ko'prikdagi "tannarx" qatorining ma'nosi: bu tovar uchun pul
  // AVVAL chiqqan, shuning uchun sof foydaga qaytariladi; naqd tomoni
  // pastdagi "Tovar uchun to'lov" (kassa_ops goods/import).
  // Tovar kelish xarajati (yo'lkira) esa pulni SHU davrda, hamyondan
  // oladi — ya'ni u oddiy xarajat kabi o'zini o'zi yopadi. Qo'shilsa
  // `izohlanmagan` aynan yo'lkira summasiga sakrab ketardi.
  const tannarx = +(p.cogs.total - (p.cogs.kelish ?? 0)).toFixed(2);
  const tovarUchun = kassaChiqim(from, to, ["goods", "import"]);
  const ns = kassaChiqim(from, to, ["personal"]);
  const oylik = berilganOylik(from, to);
  const oylikFarqi = +(p.expenses.payroll - oylik.jami).toFixed(2);
  const soliq = p.soliq?.summa ?? 0;

  const kutilgan = +(p.netProfit - nasiyaOsishi + tannarx - tovarUchun - ns + oylikFarqi + soliq).toFixed(2);

  const jami = (bal) => +kassaIds().reduce((s, k) => s + (bal[k]?.total ?? 0), 0).toFixed(2);
  const boshi = new Date(new Date(from).getTime() - 1);
  const kassaBoshi = jami(kassaBalances(boshi));
  const kassaOxiri = jami(kassaBalances(new Date(to)));
  const haqiqiy = +(kassaOxiri - kassaBoshi).toFixed(2);

  const qatorlar = [
    { kalit: "sofFoyda", nom: "Sof foyda (P&L)", summa: p.netProfit },
    { kalit: "nasiya", nom: "Nasiya o'sishi (berilgan − to'langan − qaytarilgan)", summa: -nasiyaOsishi,
      izoh: `${qarz.berilgan.toFixed(2)} − ${tolangan.toFixed(2)} − ${qaytarilgan.toFixed(2)}` },
    { kalit: "tannarx", nom: "Sotilgan tovar tannarxi (pul avval chiqqan)", summa: tannarx },
    { kalit: "tovar", nom: "Tovar uchun to'lov (Pul rejasi)", summa: -tovarUchun },
    { kalit: "ns", nom: "NS — rahbar olgan pul", summa: -ns },
    { kalit: "oylik", nom: "Oylik: hisoblangan − berilgan", summa: oylikFarqi,
      izoh: `${p.expenses.payroll.toFixed(2)} − ${oylik.jami.toFixed(2)}` },
    ...(soliq > 0 ? [{ kalit: "soliq", nom: "Soliq zaxirasi (pul chiqmagan)", summa: soliq }] : []),
  ];

  return {
    qatorlar, kutilgan, haqiqiy,
    kassaBoshi, kassaOxiri,
    izohlanmagan: +(haqiqiy - kutilgan).toFixed(2),
    nasiyaOsishi, tannarx, tovarUchun, ns, oylikFarqi, soliq,
  };
}
