"use client";
// Qarzdorlik jurnali.
// Muhim: qarz "balans" sifatida emas, HODISALAR sifatida saqlanadi —
// har bir qarz qachon berilgani va har bir to'lov qachon tushgani yoziladi.
// Faqat shunda "o'rtacha necha kunda qaytaryapti" ni hisoblab bo'ladi.
import { listCustomers, PAY_PROFILES } from "./customersData";
import { syncTable, childWriter } from "./sync";
import { sinxronBosqich } from "./billzLogData";
import { ymd } from "./dates";
import { sozlama } from "./companyData";

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
// Boshlang'ich qarzlar BO'SH. Ilgari ular muzlatilgan Excel'dan
// yasalardi va qaytish sanalari MODELLASHTIRILGAN edi — ya'ni
// o'ylab topilgan raqam. Endi baza to'la: 11 499 qarz va 16 000
// haqiqiy to'lov, har birida qachon va qanday usulda to'langani bor.
let debts = [];

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
    // Billz statusi: unpaid | overdue | fully_paid. `closedAt` dan farqi
    // bor — muddati o'tgan, lekin ochiq qarz ham bo'ladi.
    status: r.status ?? null,
    paidAmount: Number(r.paid_amount ?? 0),
    source: r.source ?? "db",
    billzId: r.billz_id ?? null,
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
// QARZ FAQAT BAZADAN. Excel yuklamasi yo'li 2026-09-03 da olib
// tashlandi (DAFTAR 17): Billz'da bor raqam NSPOS'da ikkinchi
// manbaga ega bo'lmaydi.
//
// `source = 'excel'` qatorlar SANALMAYDI — iyuldagi surat, hammasi
// "ochiq" deb turibdi (659 qator, 103 380 $). O'CHIRILMAYDI
// (foydalanuvchi qarori, 2026-08-19). Qolgan HAMMASI sanaladi:
// Billz'dan kelgani ham, ilovada qo'lda ochilgani ham.
//
// Ilgari faqat `'billz'` sanalardi. Sinxron esa yorliqni yozmasdi
// (baza default `'nspos'`), ya'ni 20.08 dan keyin kelgan 150 qarz
// (20 180 $) ro'yxatdan tashqarida qoldi — Billz 47 634 $, ekran
// 30 639 $. Endi yorliqni sinxron o'zi yozadi (`billzMap.debtRow`),
// bu yerda esa faqat Excel chetlanadi.
export const listDebts = () => debts.filter((d) => d.source !== "excel");

// Qarzlar Billz'dan kelayaptimi. Kelayotgan bo'lsa, to'lovni NSPOS'da
// qabul qilib bo'lmaydi: pul Billz kassasida olinadi va hisobni ham
// Billz yuritadi. Bu yerda yozilsa, ikki tizim ajralib ketardi.
export const debtsFromBillz = () => debts.some((d) => d.source === "billz");
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

// 4 xona: Billz summani kasr tiyin bilan yuritadi (ustun numeric(14,4)).
// Yig'indi OXIRIDA 2 xonaga yaxlitlanadi — har qarzni alohida
// yaxlitlash 387 qarzda 7 tiyin farq berardi.
export const paidOf = (d) => +d.payments.reduce((a, p) => a + p.amount, 0).toFixed(4);

// QOLDIQ. Billz qarzida Billz'ning o'zi bergan `paid_amount` dan
// (qaytarish — "Системная оплата" — ham ichida). To'lov satrlari
// (`debt_payments`) tafsilot va kassa kirimi uchun qoladi; ikkisi
// farq qilsa `moslik` → `debt-paid` qizaradi, lekin ekrandagi raqam
// Billz'niki (o'lchandi 02.09: 30 639.06 ↔ 30 639.08). Ilovada qo'lda
// ochilgan qarzda `paid_amount` yuritilmaydi — to'lov yozuvlaridan.
const tolangan = (d) => (d.source === "billz" ? d.paidAmount : paidOf(d));
export const remainingOf = (d) => +(d.amount - tolangan(d)).toFixed(4);

// OCHIQ QARZNING YAGONA TA'RIFI: yopilmagan va qoldig'i bir tiyindan
// katta. Balans, Qarzdorlar, AR aging, API — hammasi shu funksiya.
// Ilgari uch joyda uch xil shart turardi (`> 0.001` closedAt'siz,
// `> 0`, `> 0.009`) va ular bir-biriga tekshirilmasdi.
export const ochiqQoldiq = (d) => {
  if (d.closedAt) return 0;
  const q = remainingOf(d);
  return q > 0.009 ? q : 0;
};

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
      const rem = ochiqQoldiq(d);
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
// Mijoz bo'yicha guruhlash. Mijozi bog'lanmagan qarzlar `null` kalitida —
// ular jadvaldan tushib qolsa, jami qarz balans bilan mos kelmaydi.
function guruhla() {
  const byCustomer = new Map();
  for (const d of listDebts()) {
    const k = d.customerId ?? null;
    const list = byCustomer.get(k);
    if (list) list.push(d);
    else byCustomer.set(k, [d]);
  }
  return byCustomer;
}
const YETIM = { id: "unknown", name: "Ro'yxatdan o'tmagan mijozlar", phone: "", profile: "orta" };

export function debtorRows(now = new Date()) {
  const byCustomer = guruhla();
  const rows = listCustomers()
    .filter((c) => byCustomer.has(c.id))
    .map((c) => ({ customer: c, ...statsFrom(byCustomer.get(c.id), now) }));

  // Mijozlar bazasida topilmagan nomlar bitta qatorga yig'iladi
  const orphans = byCustomer.get(null);
  if (orphans?.length) rows.push({ customer: YETIM, ...statsFrom(orphans, now) });
  return rows;
}

// ══════════════════════════════════════════════════════════════
// DAVR BO'YICHA QARZDORLIK — oqim ustunlari + hozirgi snapshot
// ══════════════════════════════════════════════════════════════
// Rahbar (2026-09-03): "Qarzdorlik — davr tanlansa HAMMA ustun o'sha
// davr bo'yicha". Lekin "Jami qarzdorlik" Billz "Jami qarz" — HOZIRGI
// holat (DAFTAR 17), u davrga bog'liq emas va qayta hisoblanmaydi.
// Shuning uchun ikki xil ustun bir jadvalda ALOHIDA nomlanadi:
//   oqim (davr):   berilgan, to'langan, yopilgan — createdAt / paid_at /
//                  closedAt davr ichida
//   snapshot:      hozirgi qarzi (`ochiqQoldiq`), eng eski — hozir
// Qator: davrda harakati bor YOKI hozir ochiq qarzi bor mijoz.
//
// To'lov filtri BITTA: `paymentsInRange` — `debtCollections` (pul oqimi,
// balans) ham shundan o'qiydi. Ikki ta'rif bo'lmasin.
function* paymentsInRange(d, a, b) {
  for (const p of d.payments) {
    if (p.kind === "return") continue;   // tovar qaytdi, pul kelmadi
    const t = new Date(p.at).getTime();
    if (t >= a && t <= b) yield p;
  }
}
const oraliq = (from, to) => [new Date(from).getTime(), new Date(to).getTime()];

function davrStats(list, a, b, now) {
  let berilgan = 0, berilganSoni = 0, tolangan = 0, tolanganSoni = 0, yopilganSoni = 0;
  let hozirgiQarzXom = 0, ochiqSoni = 0;
  for (const d of list) {
    const t = new Date(d.createdAt).getTime();
    if (t >= a && t <= b) { berilgan += d.amount; berilganSoni++; }
    for (const p of paymentsInRange(d, a, b)) { tolangan += p.amount; tolanganSoni++; }
    if (d.closedAt) {
      const c = new Date(d.closedAt).getTime();
      if (c >= a && c <= b) yopilganSoni++;
    }
    const q = ochiqQoldiq(d);
    if (q > 0) { hozirgiQarzXom += q; ochiqSoni++; }
  }
  return {
    berilgan: +berilgan.toFixed(2), berilganSoni,
    tolangan: +tolangan.toFixed(2), tolanganSoni,
    yopilganSoni,
    // Xom yig'indi jami uchun (har qatorni alohida yaxlitlash jamini
    // buzadi — DAFTAR 17.4), yaxlitlangani ekran uchun
    hozirgiQarzXom,
    hozirgiQarz: +hozirgiQarzXom.toFixed(2), ochiqSoni,
    oldestOpenDays: statsFrom(list, now).oldestOpenDays,
    faol: berilganSoni > 0 || tolanganSoni > 0 || yopilganSoni > 0 || hozirgiQarzXom > 0,
  };
}

export function debtorRowsDavr(from, to, now = new Date()) {
  const [a, b] = oraliq(from, to);
  const byCustomer = guruhla();
  const rows = [];
  for (const c of listCustomers()) {
    const list = byCustomer.get(c.id);
    if (!list) continue;
    const st = davrStats(list, a, b, now);
    if (st.faol) rows.push({ customer: c, ...st });
  }
  const orphans = byCustomer.get(null);
  if (orphans?.length) {
    const st = davrStats(orphans, a, b, now);
    if (st.faol) rows.push({ customer: YETIM, ...st });
  }
  return rows;
}

// Jadvalning "Hozirgi qarzi" jamisi — xom yig'indidan, oxirida bir marta
// yaxlitlanadi. `moslik` → `qarz-jadval`: bu = `jamiQarz().jami`.
export const jadvalHozirgiQarz = (rows) => +rows.reduce((a, r) => a + (r.hozirgiQarzXom ?? 0), 0).toFixed(2);

// Umumiy ko'rsatkich: butun bazadagi pul qancha kunda qaytgan
export const overallDebtStats = (now) => statsFrom(listDebts(), now);

// —— JAMI QARZDORLIK — Billz "Jami qarz" bilan bir xil ta'rif ————————
// Billz: to'liq to'lanmagan qarzlar qoldig'i, holati bo'yicha
//   overdue      — muddati o'tgan (qisman to'langan bo'lsa ham)
//   unpaid       — muddati kelmagan, to'lov yo'q
//   partial_paid — muddati kelmagan, qisman to'langan
// Bu yerda ham shunday bo'linadi — Billz ekrani bilan yonma-yon
// qo'yib bo'lsin (02.09: Billz 47 634.42 = 1 092.02 + 46 539.40 + 3.00).
// Ekran, Balans, API va bot AYNAN shu funksiyani chaqiradi.
// ══════════════════════════════════════════════════════════════
// QARZ YOSHI VA MUDDATI — Billz yorlig'i emas, rahbar qoidasi
// ══════════════════════════════════════════════════════════════
// 2026-09-04 auditi (DAFTAR 20 B): Billz `repayment_date` deyarli har
// doim berilgan kundan 1 KUN keyin (1 621/1 643 qarz). Shuning uchun
// Billz "overdue" yorlig'i ma'nosiz — 393 "muddati o'tgan", 17
// "kelmagan". Ko'zguda yorliq saqlanadi (`d.status`, `billzYorligi`),
// lekin hisobotga u emas, rahbar belgilagan MUDDAT kiradi:
//   yosh    = bugun − berilgan sana (`createdAt`)
//   muddat  = Sozlamalar → Biznes qoidalari → `debts.termDays`
//             ({ standart: 30, [do'kon id]: kun }) — optom va chakana alohida
//   o'tgan  = yosh > muddat
// Yosh guruhlari (`arBuckets`, `ar.buckets` 30/60/90) ham shu yerda —
// ilgari `analytics.arAging` da alohida turardi va Qarzdorlik sahifasi
// bilan ikki xil "yosh" bor edi.
export const qarzYoshiKun = (d, now = new Date()) =>
  Math.max(0, Math.floor((now.getTime() - new Date(d.createdAt).getTime()) / DAY));

export const qarzMuddatiKun = (storeId) => {
  const m = sozlama("debts.termDays", { standart: 30 });
  const v = (storeId && m?.[storeId]) ?? m?.standart ?? 30;
  return Math.max(1, Math.round(Number(v) || 30));
};

// Muddati o'tganmi — yosh muddatdan katta. `now` Date yoki "YYYY-MM-DD".
export const muddatiOtganmi = (d, now = new Date()) => {
  const t = now instanceof Date ? now : new Date(String(now) + "T23:59:59");
  return qarzYoshiKun(d, t) > qarzMuddatiKun(d.storeId);
};
// Muddatdan necha kun o'tgan (0 — o'tmagan)
export const muddatdanOtganKun = (d, now = new Date()) =>
  Math.max(0, qarzYoshiKun(d, now instanceof Date ? now : new Date(String(now) + "T23:59:59")) - qarzMuddatiKun(d.storeId));

// Billz'ning o'z yorlig'i — faqat ko'rsatish uchun ("Billz: overdue")
export const billzYorligi = (d) => d.status ?? null;

// Yosh guruhlari — Sozlamalar (`ar.buckets`, standart 30/60/90).
// Oxirgi guruh — "shubhali qarz" (90+): qaytish ehtimoli past.
export function arBuckets() {
  const [a, b, c] = sozlama("ar.buckets", [30, 60, 90]);
  return [
    { id: "d30", label: `0–${a} kun`, min: 0, max: a },
    { id: "d60", label: `${a + 1}–${b} kun`, min: a + 1, max: b },
    { id: "d90", label: `${b + 1}–${c} kun`, min: b + 1, max: c },
    { id: "d90p", label: `${c} kundan ortiq`, min: c + 1, max: Infinity },
  ];
}
export const yoshGuruhi = (yosh, buckets = arBuckets()) =>
  buckets.find((x) => yosh >= x.min && yosh <= x.max) ?? buckets.at(-1);

export function jamiQarz(now = new Date()) {
  const buckets = arBuckets();
  const out = {
    jami: 0, soni: 0,
    // Rahbar muddati bo'yicha (DAFTAR 20 B) — Billz yorlig'i emas
    muddatiOtgan: { summa: 0, soni: 0 },
    muddatiKelmagan: { summa: 0, soni: 0 },
    // Ustma-ust EMAS, alohida belgi: ochiq qarzning qanchasiga to'lov
    // tushgan (yuqoridagi ikkisining ichida)
    qismanTolangan: { summa: 0, soni: 0 },
    // Yosh guruhlari — Qarzdorlik, AR aging, API, bot bitta ro'yxat
    yosh: buckets.map((b) => ({ ...b, summa: 0, soni: 0 })),
    // Shubhali — oxirgi guruh (90+): balansda alohida qator, zaxira nomzodi
    shubhali: { summa: 0, soni: 0, kun: buckets.at(-1).min },
    // Billz'ning o'z bo'linishi — ko'zgu, faqat ko'rsatish uchun
    billzOverdue: { summa: 0, soni: 0 },
    // Konsentratsiya va aylanish
    mijozlar: 0, top10: { summa: 0, ulush: 0 },
    dso: null,
    muddatKun: qarzMuddatiKun(null),
    // Oxirgi qarz sinxroni qachon tugagan — farq bo'lsa sababi vaqt
    // ekani ko'rinib tursin
    billzVaqti: sinxronBosqich("debts")?.finishedAt ?? null,
  };
  const mijoz = new Map();
  const oy30 = now.getTime() - 30 * DAY;
  let berilgan30 = 0;
  for (const d of listDebts()) {
    const t = new Date(d.createdAt).getTime();
    if (t >= oy30 && t <= now.getTime()) berilgan30 += d.amount;
    const q = ochiqQoldiq(d);
    if (!q) continue;
    out.jami += q; out.soni++;
    const b = muddatiOtganmi(d, now) ? out.muddatiOtgan : out.muddatiKelmagan;
    b.summa += q; b.soni++;
    if (tolangan(d) > 0) { out.qismanTolangan.summa += q; out.qismanTolangan.soni++; }
    if (d.status === "overdue") { out.billzOverdue.summa += q; out.billzOverdue.soni++; }
    const g = out.yosh[buckets.indexOf(yoshGuruhi(qarzYoshiKun(d, now), buckets))];
    g.summa += q; g.soni++;
    const k = d.customerId ?? "nomalum";
    mijoz.set(k, (mijoz.get(k) ?? 0) + q);
  }
  const yig = (o) => { o.summa = +o.summa.toFixed(2); return o; };
  const oxirgi = out.yosh.at(-1);
  out.shubhali.summa = oxirgi.summa; out.shubhali.soni = oxirgi.soni;
  out.jami = +out.jami.toFixed(2);
  for (const k of ["muddatiOtgan", "muddatiKelmagan", "qismanTolangan", "shubhali", "billzOverdue"]) yig(out[k]);
  for (const g of out.yosh) yig(g);
  out.mijozlar = mijoz.size;
  const top = [...mijoz.values()].sort((a, b) => b - a).slice(0, 10).reduce((a, v) => a + v, 0);
  out.top10 = { summa: +top.toFixed(2), ulush: out.jami > 0 ? +((top / out.jami) * 100).toFixed(1) : 0 };
  // DSO — ochiq qarz oxirgi 30 kunlik nasiya savdosining necha kuniga
  // teng ("pul o'rtacha necha kunda qaytadi"ning qo'pol o'lchovi)
  out.dso = berilgan30 > 0 ? Math.round(out.jami / (berilgan30 / 30)) : null;
  return out;
}

// Davrda berilgan qarzlardan SHU KUNIYOQ yopilgani — Billz'da "nasiya"
// tugmasi "keyinroq to'laydi" uchun ham bosiladi (avgust 2026: 545 dan
// 72 tasi, 12 272 $). Bu haqiqiy kredit emas; nasiya ulushi hisobida
// alohida ko'rsatiladi (DAFTAR 20 C).
export function shuKuniYopilgan(from, to) {
  const [a, b] = oraliq(from, to);
  let soni = 0, summa = 0, berilgan = 0, berilganSoni = 0;
  for (const d of listDebts()) {
    const t = new Date(d.createdAt).getTime();
    if (t < a || t > b) continue;
    berilgan += d.amount; berilganSoni++;
    if (d.closedAt && ymd(d.closedAt) === ymd(d.createdAt)) { soni++; summa += d.amount; }
  }
  return {
    soni, summa: +summa.toFixed(2),
    berilgan: +berilgan.toFixed(2), berilganSoni,
    haqiqiy: +(berilgan - summa).toFixed(2),
  };
}

// Yorliq xatosi: Billz id'si bor-u `source` boshqa. Bu MASHINA
// nosozligi (sinxron yorliqni yozmagan) — `audit.js` → `qarz-manba`.
export const yorliqXato = () => debts.filter((d) => d.billzId && d.source !== "billz").length;

// Davr ichida qaytgan qarz puli — pul oqimi va balans uchun.
// Qarzga sotilganda tushum yoziladi, lekin pul kelmaydi; pul aynan
// shu yerda kiradi. To'lov usuli Billz'da yo'q — naqd deb olinadi.
export function debtCollections(from, to) {
  const [a, b] = oraliq(from, to);
  let total = 0, count = 0;
  for (const d of listDebts()) {
    for (const p of paymentsInRange(d, a, b)) { total += p.amount; count++; }
  }
  return { total: +total.toFixed(2), count };
}

// —— Kategoriyalar ————————————————————————————————————
// "15 kungacha to'layotganlar", "20 kungacha", "30 kungacha", "30+"
// Oxirgi kategoriya — hali birorta to'lov qilmagan mijozlar.
// Ular o'rtachaga kirmaydi, lekin ro'yxatdan tushib qolmasligi shart:
// aynan shular eng xavflisi.
// Guruh kunlari — Sozlamalar → Biznes qoidalari (`debts.buckets`,
// standart 15/20/30); rahbar o'zgartirsa ustunlar ham, `bucketOf` ham
// shundan (2026-09-03).
export const debtCuts = () => sozlama("debts.buckets", [15, 20, 30]);
export function debtBuckets() {
  const [a, b, c] = debtCuts();
  return [
    { key: "b15", label: `${a} kungacha`, max: a },
    { key: "b20", label: `${a + 1}–${b} kun`, max: b },
    { key: "b30", label: `${b + 1}–${c} kun`, max: c },
    { key: "b30p", label: `${c} kundan ortiq`, max: Infinity },
    { key: "none", label: "To'lov tarixi yo'q", max: null },
  ];
}
export const DEBT_BUCKETS = debtBuckets();   // eski importlar uchun (standart)

export function bucketOf(days) {
  if (days == null) return "none";
  return debtBuckets().find((b) => b.max != null && days <= b.max)?.key ?? "b30p";
}
