"use client";
// Qarzdorlik jurnali.
// Muhim: qarz "balans" sifatida emas, HODISALAR sifatida saqlanadi —
// har bir qarz qachon berilgani va har bir to'lov qachon tushgani yoziladi.
// Faqat shunda "o'rtacha necha kunda qaytaryapti" ni hisoblab bo'ladi.
import { listCustomers, PAY_PROFILES } from "./customersData";
import { EXPORT_TRANSACTIONS } from "./billzExport";
import { syncTable, childWriter } from "./sync";
import { uploadedDebts } from "./debtsUpload";

const DAY = 86400000;
// Seed generatsiyasi uchun qat'iy tayanch sana (server va klientda bir xil bo'lishi shart)
const ANCHOR = new Date(2026, 6, 22);

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Normalga yaqin taqsimot (ikkita tasodifiy sonning o'rtachasi)
const around = (rnd, mean, spread) =>
  Math.max(1, Math.round(mean + (rnd() + rnd() - 1) * spread));

// Haqiqiy qarz hodisalari Billz tranzaksiyalaridan quriladi:
//   sana, summa, mijoz — hammasi eksportdan (7 779 chek ichida "В долг"
//   ustuni to'ldirilganlari). Billz QAYTARISH tarixini bermaydi —
//   kassa operatsiyalari hisoboti bo'sh. Shuning uchun to'lov sanalari
//   mijozning xarid hajmiga mos xulq profili bo'yicha modellashtiriladi.
//   Natijada: berilgan qarz — HAQIQIY, qaytish tezligi — model.
function buildSeedDebts() {
  const rnd = mulberry32(19072026);
  const byName = new Map();
  for (const c of listCustomers()) if (!byName.has(c.name)) byName.set(c.name, c);

  // —— 1-bosqich: qarz hodisalari (haqiqiy) ————————————
  const out = [];
  let n = 1;
  for (const t of EXPORT_TRANSACTIONS) {
    if (!(t.debt > 0) || t.type !== "sale") continue;
    // Mijozlar ro'yxatida yo'q nom (nomsiz chek) — qarz baribir yoziladi,
    // aks holda balansdagi debitor qarzdorlik 64 000 USD ga kam chiqadi.
    const c = byName.get(t.customer) ?? null;
    const createdAt = new Date(t.at);
    out.push({
      id: "d" + n,
      no: "QZ-" + (1000 + n++),
      customerId: c?.id ?? null,
      customerName: t.customer || "Noma'lum mijoz",
      profile: c?.profile ?? "orta",
      saleId: null,
      saleNo: t.no,
      storeId: t.storeId,
      amount: t.debt,
      returned: 0,
      createdAt: createdAt.toISOString(),
      dueDate: new Date(createdAt.getTime() + 30 * DAY).toISOString().slice(0, 10),
      payments: [], closedAt: null,
      source: "billz",
    });
  }

  // —— 2-bosqich: qarzga olingan tovarning qaytarilishi ————
  // Billz qaytarishda "В долг" ustunini kamaytirmaydi: chek summasi
  // manfiy, lekin qarz ustuni nol. Shu sababli xom yig'indi haqiqiy
  // qarzdan 77 973 USD ga ortiq. Qaytarishning naqd bilan
  // qoplanmagan qismi qarz ASOSIY SUMMASIDAN yechiladi — bu to'lov
  // emas, tovar qaytdi, demak qarz shuncha kamayadi.
  const byCustomer = new Map();
  for (const d of out) {
    const key = d.customerId ?? "unknown";
    if (!byCustomer.has(key)) byCustomer.set(key, []);
    byCustomer.get(key).push(d);
  }
  for (const list of byCustomer.values()) {
    list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }

  const returns = EXPORT_TRANSACTIONS
    .filter((t) => t.type === "return")
    .sort((a, b) => new Date(a.at) - new Date(b.at));

  for (const r of returns) {
    let credit = +(Math.abs(r.total) - Math.abs(r.cash)).toFixed(2);
    if (credit <= 0.01) continue;
    const c = byName.get(r.customer);
    const list = byCustomer.get(c?.id ?? "unknown") ?? [];
    const at = new Date(r.at);

    for (const d of list) {
      if (credit <= 0.01) break;
      if (new Date(d.createdAt) > at) break;      // hali berilmagan qarz
      const left = +(d.amount - d.returned).toFixed(2);
      if (left <= 0.01) continue;
      const cut = Math.min(left, credit);
      d.returned = +(d.returned + cut).toFixed(2);
      credit = +(credit - cut).toFixed(2);
    }
  }

  // —— 3-bosqich: to'lovlarni modellashtirish ————————————
  // Billz to'lov tarixini bermaydi (kassa operatsiyalari hisoboti bo'sh),
  // shuning uchun qaytish tezligi mijozning xulq profili bo'yicha
  // modellashtiriladi. Berilgan qarz va sanasi — haqiqiy, faqat
  // qachon qaytgani model.
  const result = [];
  for (const d of out) {
    const amount = +(d.amount - d.returned).toFixed(2);
    if (amount <= 0.01) continue;               // butunlay qaytarib berilgan

    const prof = PAY_PROFILES[d.profile] ?? PAY_PROFILES.orta;
    const created = new Date(d.createdAt).getTime();
    const takeDays = around(rnd, prof.meanDays, prof.spread);
    const parts = rnd() < 0.35 ? 2 + Math.floor(rnd() * 2) : 1;

    const payments = [];
    let paid = 0, lastAt = created;
    for (let p = 0; p < parts; p++) {
      const last = p === parts - 1;
      const amt = last ? +(amount - paid).toFixed(2) : +(amount / parts).toFixed(2);
      const at = new Date(created + (takeDays * ((p + 1) / parts)) * DAY + rnd() * 2 * DAY);
      // Hisobot sanasidan keyingi to'lov hali sodir bo'lmagan
      if (at > ANCHOR) break;
      payments.push({ amount: amt, at: at.toISOString() });
      paid += amt;
      lastAt = at.getTime();
    }

    const closed = +paid.toFixed(2) >= amount - 0.01;
    const { profile, returned, ...rest } = d;
    result.push({
      ...rest,
      amount,
      returnedAmount: returned,
      payments,
      closedAt: closed ? new Date(lastAt).toISOString() : null,
    });
  }
  return result;
}

let debts = buildSeedDebts();

// —— Baza ————————————————————————————————————
// Qarz va uning to'lovlari ikki jadval: `debts` va `debt_payments`.
// Bitta so'rovda birga o'qiladi (nested select), lekin alohida yoziladi.
const paymentWriter = childWriter("debt_payments", "qarz to'lovi");

const debtSync = syncTable("debts", {
  table: "debts",
  select: "*, debt_payments(id, amount, paid_at, method, kind)",
  order: { column: "issued_at", ascending: false },
  get: () => debts,
  set: (v) => { debts = v; },
  fromRow: (r) => ({
    id: r.id,
    no: "QZ-" + String(r.id).slice(0, 6),
    customerId: r.customer_id,
    saleId: r.sale_id,
    storeId: r.store_id,
    amount: Number(r.amount),
    createdAt: r.issued_at,
    dueDate: r.due_date,
    closedAt: r.closed_at,
    payments: (r.debt_payments ?? [])
      .map((p) => ({ id: p.id, amount: Number(p.amount), at: p.paid_at, method: p.method, kind: p.kind }))
      .sort((a, b) => new Date(a.at) - new Date(b.at)),
    source: "db",
  }),
  toRow: (d) => ({
    customer_id: d.customerId,
    sale_id: d.saleId || null,
    store_id: d.storeId || null,
    amount: d.amount,
    issued_at: d.createdAt,
    due_date: d.dueDate || null,
    closed_at: d.closedAt || null,
  }),
});

// —— Umumiy interfeys ————————————————————————————————————
// Billz "Отчет по долгам" yuklangan bo'lsa — o'sha. U to'liq haqiqiy:
// berilgani ham, qaytgani ham, muddati ham Billz'niki. Bazadagi eski
// qarzlarda qaytish sanalari modellashtirilgan edi, shuning uchun
// yuklama ustun turadi. Hisob 1-avgustdan yuritilgani uchun undan
// oldingi qarzlar baribir hisobga kirmaydi.
export const listDebts = () => {
  const up = uploadedDebts();
  return up.ready ? [...up.rows] : [...debts];
};

// Qarzlar Billz yuklamasidan kelayaptimi. Kelayotgan bo'lsa, to'lovni
// NSPOS'da qabul qilib bo'lmaydi: pul Billz kassasida olinadi va
// hisobni ham Billz yuritadi. Bu yerda yozilsa, ikki tizim ajralib
// ketardi — NSPOS "to'landi" deb turardi, Billz esa "qarz" deb.
// Shuning uchun to'lov oynasi bunday paytda yopiladi.
export const debtsFromBillz = () => uploadedDebts().ready;
export const debtsOf = (customerId) => listDebts().filter((d) => d.customerId === customerId);

// POS'da "Qarzga" sotilganda chaqiriladi
export function addDebt({ customerId, saleId, amount }) {
  const debt = {
    id: "d" + Date.now(),
    no: "QZ-" + (3000 + debts.length),
    customerId, saleId,
    amount: +amount.toFixed(2),
    createdAt: new Date().toISOString(),
    payments: [],
    closedAt: null,
  };
  debts = [debt, ...debts];
  debtSync.created(debt);
  return debt;
}

export function payDebt(debtId, amount) {
  const at = new Date().toISOString();
  const amt = +amount.toFixed(2);
  debts = debts.map((d) => {
    if (d.id !== debtId) return d;
    const payments = [...d.payments, { amount: amt, at }];
    const paid = payments.reduce((a, p) => a + p.amount, 0);
    const closed = paid + 0.001 >= d.amount;
    return { ...d, payments, closedAt: closed ? at : null };
  });
  // To'lov alohida yozuv; qarz yopilgan bo'lsa ota yozuv ham yangilanadi
  paymentWriter.created({ debt_id: debtId, amount: amt, paid_at: at, method: "cash", kind: "payment" });
  const d = debts.find((x) => x.id === debtId);
  if (d?.closedAt) debtSync.changed(d);
}

export const paidOf = (d) => +d.payments.reduce((a, p) => a + p.amount, 0).toFixed(2);
export const remainingOf = (d) => +(d.amount - paidOf(d)).toFixed(2);

// —— Analitika ————————————————————————————————————————
// Ikki xil o'rtacha hisoblanadi:
//  weighted — har to'lov o'z summasi bilan tortiladi ("pul qancha kunda qaytdi")
//  simple   — faqat to'liq yopilgan qarzlar, summasidan qat'i nazar teng
// Ochiq qarzlar ikkalasiga ham KIRMAYDI, ular alohida ustunda ko'rsatiladi.
function statsFrom(list, now = new Date()) {
  let wSum = 0, wAmt = 0;
  let closedDays = 0, closedCount = 0;
  let openAmount = 0, openCount = 0, oldestOpenDays = 0;
  let totalTaken = 0;

  for (const d of list) {
    totalTaken += d.amount;
    const created = new Date(d.createdAt).getTime();

    for (const p of d.payments) {
      // Tovar qaytarilishi to'lov emas — muddat statistikasini buzadi
      if (p.kind === "return") continue;
      const days = Math.max(0, (new Date(p.at).getTime() - created) / DAY);
      wSum += p.amount * days;
      wAmt += p.amount;
    }

    if (d.closedAt) {
      closedDays += (new Date(d.closedAt).getTime() - created) / DAY;
      closedCount++;
    } else {
      const rem = remainingOf(d);
      if (rem > 0) {
        openAmount += rem;
        openCount++;
        oldestOpenDays = Math.max(oldestOpenDays, (now.getTime() - created) / DAY);
      }
    }
  }

  return {
    weightedAvgDays: wAmt > 0 ? +(wSum / wAmt).toFixed(1) : null,
    simpleAvgDays: closedCount > 0 ? +(closedDays / closedCount).toFixed(1) : null,
    closedCount,
    openAmount: +openAmount.toFixed(2),
    openCount,
    oldestOpenDays: openCount > 0 ? Math.round(oldestOpenDays) : 0,
    totalTaken: +totalTaken.toFixed(2),
    debtCount: list.length,
  };
}

export const customerDebtStats = (customerId, now) => statsFrom(debtsOf(customerId), now);

// Barcha qarzdorlar bo'yicha qator — hisobot jadvali uchun.
// 6 800 mijoz × 4 000 qarz bo'lgani uchun avval bir marta guruhlanadi:
// har mijoz uchun alohida filtr ishlatilsa sahifa sekinlashadi.
export function debtorRows(now = new Date()) {
  const byCustomer = new Map();
  for (const d of listDebts()) {
    const list = byCustomer.get(d.customerId);
    if (list) list.push(d);
    else byCustomer.set(d.customerId, [d]);
  }
  const rows = listCustomers()
    .filter((c) => byCustomer.has(c.id))
    .map((c) => ({ customer: c, ...statsFrom(byCustomer.get(c.id), now) }));

  // Mijozlar bazasida topilmagan nomlar bitta qatorga yig'iladi —
  // ular jadvaldan tushib qolsa, jami qarz balans bilan mos kelmaydi
  const orphans = byCustomer.get(null);
  if (orphans?.length) {
    rows.push({
      customer: { id: "unknown", name: "Ro'yxatdan o'tmagan mijozlar", phone: "", profile: "orta" },
      ...statsFrom(orphans, now),
    });
  }
  return rows;
}

// Umumiy ko'rsatkich: butun bazadagi pul qancha kunda qaytgan
export const overallDebtStats = (now) => statsFrom(listDebts(), now);

// Davr ichida qaytgan qarz puli — pul oqimi va balans uchun.
// Qarzga sotilganda tushum yoziladi, lekin pul kelmaydi; pul aynan
// shu yerda kiradi. To'lov usuli Billz'da yo'q — naqd deb olinadi.
export function debtCollections(from, to) {
  const a = new Date(from).getTime(), b = new Date(to).getTime();
  let total = 0, count = 0;
  for (const d of listDebts()) {
    for (const p of d.payments) {
      if (p.kind === "return") continue;   // tovar qaytdi, pul kelmadi
      const t = new Date(p.at).getTime();
      if (t < a || t > b) continue;
      total += p.amount;
      count++;
    }
  }
  return { total: +total.toFixed(2), count };
}

// —— Kategoriyalar ————————————————————————————————————
// "15 kungacha to'layotganlar", "20 kungacha", "30 kungacha", "30+"
// Oxirgi kategoriya — hali birorta to'lov qilmagan mijozlar.
// Ular o'rtachaga kirmaydi, lekin ro'yxatdan tushib qolmasligi shart:
// aynan shular eng xavflisi.
export const DEBT_BUCKETS = [
  { key: "b15", label: "15 kungacha", max: 15 },
  { key: "b20", label: "16–20 kun", max: 20 },
  { key: "b30", label: "21–30 kun", max: 30 },
  { key: "b30p", label: "30 kundan ortiq", max: Infinity },
  { key: "none", label: "To'lov tarixi yo'q", max: null },
];

export function bucketOf(days) {
  if (days == null) return "none";
  return DEBT_BUCKETS.find((b) => b.max != null && days <= b.max)?.key ?? "b30p";
}
