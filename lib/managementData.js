"use client";
// ══════════════════════════════════════════════════════════════
// RAHBARIYAT DASHBOARDI
// ══════════════════════════════════════════════════════════════
// Bu modul yangi ma'lumot yaratmaydi — boshqa modullardan eng muhim
// raqamlarni yig'ib, bitta ekranda javob beradi:
//   1. Qancha ishladik va qancha qoldi?
//   2. Qaysi do'kon haqiqatda foyda keltiryapti?
//   3. Nimaga birinchi qarash kerak?
//
// Yalpi foyda do'kon kesimida BILLZ eksportidan olinadi (EXPORT_DAILY) —
// bu haqiqiy tannarx bo'yicha hisoblangan raqam. NSPOS o'zi hisoblagan
// tannarx faqat yangi cheklarga tegishli.
import { EXPORT_DAILY } from "./billzExport";
import { uploadedDaily } from "./dailyUpload";
import { demoStores } from "./demoData";
import { salesInRange, storeTotalsInRange } from "./salesData";
import { totalExpenses, expensesByStore, monthlyFixedRunRate } from "./expensesData";
import { payrollCost, storePerformance } from "./payrollData";
import { profitAndLoss } from "./pnlData";
import { servicesSummary } from "./servicesData";
import { overallDebtStats } from "./debtsData";
import { payablesSummary } from "./suppliersData";
import { balanceSheet } from "./balanceData";
import { stockCoverage } from "./analytics";
import { kassaIds, KASSAS, negativeDays } from "./kassaData";

const MONTHS_SHORT = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"];
const iso = (d) => new Date(d).toISOString().slice(0, 10);

// —— Billz kunlik yakunidan davr bo'yicha yig'ish ————————
// "Сводный отчет" yuklangan bo'lsa o'shandan (jonli), aks holda
// 22-iyulda muzlatilgan nusxadan. Ikkalasining ham qator ko'rinishi
// bir xil: { date, storeId, revenue, netRevenue, grossProfit }.
function billzInRange(from, to) {
  const a = iso(from), b = iso(to);
  const up = uploadedDaily();
  const src = up.ready ? up.rows : EXPORT_DAILY;
  return src.filter((r) => r.date >= a && r.date <= b);
}

// —— Asosiy ko'rsatkichlar ————————————————————————
export function kpis(from, to) {
  const sales = salesInRange(from, to).filter((s) => s.type === "sale");
  const services = servicesSummary(from, to);

  // HAMMA RAQAM FOYDA HISOBOTIDAN (P&L). Ilgari bu yerda o'z hisobi
  // bor edi: tushum va yalpi foyda Billz kunlik yakunidan, xarajat esa
  // `totalExpenses` (oylik ham ichida) minus alohida ish haqi. Natijada
  // 2026-08-14 da rahbariyat panelida sof foyda 1 000.24, P&L
  // sahifasida esa 628.33 turgan edi.
  //
  // Kartochkalar bir qatorda turgani uchun ular O'ZARO ham to'g'ri
  // kelishi shart: yalpi foyda − (xarajat + ish haqi) = sof foyda.
  // Shuning uchun yalpi foyda ham shu yerdan olinadi — aks holda
  // ekranda uchta raqam qo'shilmay qolardi.
  const pnl = profitAndLoss(from, to);
  const revenue = pnl.revenue.total;
  const grossProfit = pnl.grossProfit;
  const opex = +(pnl.expenses.opex + pnl.expenses.operationsTotal
    + pnl.expenses.writeoff + pnl.expenses.shrinkage
    + pnl.expenses.installerShare).toFixed(2);   // oyliksiz xarajat
  const wages = pnl.expenses.payroll;            // payrollData.payrollCost
  const netProfit = pnl.netProfit;

  return {
    revenue, grossProfit,
    grossMargin: revenue > 0 ? +((grossProfit / revenue) * 100).toFixed(1) : 0,
    serviceRevenue: services.total,
    serviceProfit: services.profit,
    opex, wages,
    netProfit,
    netMargin: revenue > 0 ? +((netProfit / revenue) * 100).toFixed(1) : 0,
    checkCount: sales.length,
    avgCheck: sales.length > 0 ? +(revenue / sales.length).toFixed(2) : 0,
    // Qarzga ketgan ulush — aylanma uchun eng muhim raqam
    onCredit: +sales.reduce((a, s) => a + (s.debt ?? 0), 0).toFixed(2),
  };
}

// —— Do'kon kesimida haqiqiy foyda ————————————————
// Do'konning "foydasi" = yalpi foyda − o'z xarajati − unga taqsimlangan
// umumkorxona xarajati − shu do'kondagi ish haqi.
export function storeScoreboard(from, to) {
  const rows = billzInRange(from, to);
  const exp = expensesByStore(from, to);
  const perf = storePerformance(from, to);

  return demoStores.map((s) => {
    const mine = rows.filter((r) => r.storeId === s.id);
    const revenue = +mine.reduce((a, r) => a + r.netRevenue, 0).toFixed(2);
    const grossProfit = +mine.reduce((a, r) => a + r.grossProfit, 0).toFixed(2);
    const expense = exp.find((e) => e.storeId === s.id)?.total ?? 0;
    const netProfit = +(grossProfit - expense).toFixed(2);

    return {
      storeId: s.id, name: s.name,
      revenue, grossProfit,
      grossMargin: revenue > 0 ? +((grossProfit / revenue) * 100).toFixed(1) : 0,
      expense, netProfit,
      netMargin: revenue > 0 ? +((netProfit / revenue) * 100).toFixed(1) : 0,
      // Reja davr uzunligiga qarab proporsional olinadi (payrollData'dagi kabi)
      plan: perf[s.id]?.plan ?? 0,
      planPct: perf[s.id]?.pct ?? null,
    };
  }).filter((r) => r.revenue !== 0 || r.expense !== 0);
}

// —— Oylik trend: tushum · yalpi foyda · xarajat ————————
export function trend(from, to) {
  const rows = billzInRange(from, to);
  const map = new Map();
  const cursor = new Date(new Date(from).getFullYear(), new Date(from).getMonth(), 1);
  const end = new Date(to);
  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    map.set(key, { key, date: MONTHS_SHORT[cursor.getMonth()], revenue: 0, grossProfit: 0, expense: 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  for (const r of rows) {
    const row = map.get(r.date.slice(0, 7));
    if (!row) continue;
    row.revenue = +(row.revenue + r.netRevenue).toFixed(2);
    row.grossProfit = +(row.grossProfit + r.grossProfit).toFixed(2);
  }

  // Xarajatni har oy uchun alohida so'raymiz — takrorlanuvchi to'lovlar
  // ham to'g'ri oyga tushishi uchun. Bu yerdagi `netProfit` grafikda
  // chizilmaydi (ustunlar — yalpi foyda va xarajat, chiziq — tushum);
  // u shu ikki ustunning ayirmasi bo'lib qoladi, ya'ni grafikning o'zi
  // bilan mos. Kartochkadagi SOF FOYDA esa boshqa joydan — P&L dan
  // (pastdagi `kpis`).
  for (const row of map.values()) {
    const [y, m] = row.key.split("-").map(Number);
    const a = new Date(y, m - 1, 1);
    const b = new Date(y, m, 0, 23, 59, 59);
    row.expense = totalExpenses(a, b);
    row.netProfit = +(row.grossProfit - row.expense).toFixed(2);
  }
  return [...map.values()];
}

// —— Zararsizlik nuqtasi ————————————————————————
// Oyiga qancha sotsak, doimiy xarajat qoplanadi.
export function breakEven(from, to) {
  const k = kpis(from, to);
  const fixed = monthlyFixedRunRate();
  // Ish haqi ham har oy to'lanadi — doimiy xarajat qatorida turadi.
  // Ilgari faqat `payroll.fixed` (profildagi qat'iy maosh) olinardi;
  // u bazada 0 bo'lgani uchun zararsizlik nuqtasi haqiqatdan ancha
  // past chiqardi. Endi P&L bilan bir xil manba (payrollCost).
  const monthlyFixed = +(fixed + payrollCost(from, to)).toFixed(2);
  const marginRate = k.revenue > 0 ? k.grossProfit / k.revenue : 0;
  return {
    monthlyFixed,
    marginPct: +(marginRate * 100).toFixed(1),
    required: marginRate > 0 ? +(monthlyFixed / marginRate).toFixed(2) : null,
  };
}

// —— Ogohlantirishlar ————————————————————————————
// Rahbar ekranni ochganda "nimaga qarash kerak" degan savolga javob.
export function alerts(from, to, now = new Date()) {
  const out = [];
  const push = (level, title, detail, href) => out.push({ level, title, detail, href });

  const opex = totalExpenses(from, to);
  if (opex === 0) {
    push("warn", "Xarajatlar kiritilmagan",
      "Ijara, kommunal va boshqa xarajatlarsiz sof foyda haqiqatdan yuqori ko'rinadi.",
      "/finance/expenses");
  }

  const pay = payablesSummary(now);
  if (pay.overdueAmount > 0) {
    push("danger", "Yetkazib beruvchiga muddati o'tgan qarz",
      `${pay.overdueCount} ta hisob-faktura · ${pay.overdueAmount.toLocaleString("ru-RU")} USD`,
      "/finance/payables");
  }

  const debt = overallDebtStats(now);
  if (debt.oldestOpenDays > 30) {
    push("danger", "Uzoq muddatli mijoz qarzi",
      `Eng eskisi ${debt.oldestOpenDays} kun · ochiq qarz ${debt.openAmount.toLocaleString("ru-RU")} USD`,
      "/finance/debts");
  } else if (debt.openAmount > 0) {
    push("info", "Ochiq mijoz qarzlari",
      `${debt.openCount} ta qarz · o'rtacha ${debt.weightedAvgDays ?? "—"} kunda qaytyapti`,
      "/finance/debts");
  }

  const b = balanceSheet(now);
  if (b.currentRatio !== null && b.currentRatio < 1) {
    push("danger", "Likvidlik past",
      `Joriy koeffitsient ${b.currentRatio} — qisqa muddatli qarzni qoplashga aktiv yetmayapti.`,
      "/finance/balance");
  }

  const cov = stockCoverage({ windowDays: 30, now });
  const critical = cov.filter((c) => c.daysLeft !== null && c.daysLeft <= 7).length;
  if (critical > 0) {
    push("warn", "Tovar tugash arafasida",
      `${critical} ta pozitsiya 7 kundan kam qoldi.`,
      "/reports");
  }

  // Kassada minusda qolgan kun. Kun yopilganda faqat musbat qoldiq
  // topshiriladi, minus esa kassada qotib qoladi — ya'ni o'sha kuni yo
  // kirim to'liq yozilmagan, yo kassadagidan ortiq xarajat qilingan.
  // Menejer buni o'z kartochkasida ko'radi, rahbar esa shu yerdan.
  for (const k of kassaIds()) {
    if (KASSAS[k]?.main) continue;
    const minus = negativeDays(k);
    if (!minus.length) continue;
    const sum = +minus.reduce((s, d) => s + Math.abs(d.amount), 0).toFixed(2);
    push("danger", `${KASSAS[k]?.label ?? k} minusda`,
      `${minus.length} ta kunda ${sum.toLocaleString("ru-RU")} USD — kirim to'liq yozilmagan yoki ortiqcha xarajat qilingan (${minus.map((d) => d.date).join(", ")})`,
      `/finance/kassa/${k}`);
  }

  const board = storeScoreboard(from, to);
  for (const s of board) {
    if (s.netProfit < 0) {
      push("danger", `${s.name} zarar ko'ryapti`,
        `Yalpi foyda ${s.grossProfit.toLocaleString("ru-RU")}, xarajat ${s.expense.toLocaleString("ru-RU")} USD`,
        "/finance/pnl");
    }
  }

  const order = { danger: 0, warn: 1, info: 2 };
  return out.sort((a, b2) => order[a.level] - order[b2.level]);
}
