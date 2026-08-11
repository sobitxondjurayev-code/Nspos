"use client";
// ══════════════════════════════════════════════════════════════
// TO'LOV REJASI — kimga, qancha, qachon
// ══════════════════════════════════════════════════════════════
// Rahbarning daftaridagi ro'yxat: "shu odamga shuncha, shu kuni".
// Boshqa modullardan farqi — bu BO'LIB O'TGAN emas, BO'LADIGAN pul.
//
// Nega alohida modul:
//   Xarajatlar  — bo'lib o'tgan xarajat, foyda hisobiga tushadi
//   Kassa ops   — bo'lib o'tgan pul harakati, balansni kamaytiradi
//   To'lov rejasi — hali bo'lmagan. Balansga tegmaydi, faqat
//                   "qancha pulim band" degan raqamni beradi.
//
// PUL QAYERDA HISOBLANADI:
//   1. Reja kiritiladi — hech qayerda pul kamaymaydi, faqat
//      "rejadagi to'lovlar" yig'indisi o'sadi.
//   2. "To'landi" bosiladi — kassaData.addOp() bilan chiqim yoziladi.
//      Balans aynan shunda kamayadi, ya'ni pul bir marta sanaladi.
//   3. To'lov o'chirilsa, o'sha kassa yozuvi ham birga o'chadi —
//      aks holda balansda egasiz chiqim qolib ketardi.
import { syncTable } from "./sync";
import { getUser } from "./auth";
import { addOp, removeOp, COMPANY, KASSA_CATEGORIES } from "./kassaData";
import { getUsdRate } from "./companyData";

const iso = (d) => (typeof d === "string" ? d.slice(0, 10)
  : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);

const today = () => iso(new Date());

// —— Nima uchun to'lanadi ————————————————————————
// Kassa chiqim turlari bilan bir xil ro'yxat: reja to'langanda
// aynan shu tur bilan kassaga yoziladi, ikkinchi ro'yxat tuzilsa
// hisobotda ikki xil nom paydo bo'lardi.
export const PAYOUT_CATEGORIES = KASSA_CATEGORIES.out;

// —— Xotira va baza ————————————————————————————
// Yozuv: { id, title, amount, amountSom, rateUsed, dueDate, kassa,
//          wallet, category, note, status, paidAt, opId, createdBy }
let items = [];
let seq = 1;
const nextId = () => "p-" + (seq++) + "-" + Date.now().toString(36);

// Ro'yxat muddat bo'yicha: eng yaqini tepada. To'langanlari pastda —
// ular endi qaror talab qilmaydi.
const byDue = (a, b) => {
  if (a.status !== b.status) return a.status === "planned" ? -1 : 1;
  if (a.status === "paid") return a.paidAt < b.paidAt ? 1 : -1;
  return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
};

const sync = syncTable("payouts", {
  table: "payouts",
  order: { column: "due_date", ascending: true },
  get: () => items,
  set: (v) => { items = v; },
  sort: byDue,
  fromRow: (r) => ({
    id: r.id,
    title: r.title ?? "",
    amount: Number(r.amount),
    amountSom: r.amount_som == null ? null : Number(r.amount_som),
    rateUsed: r.rate_used == null ? null : Number(r.rate_used),
    dueDate: String(r.due_date).slice(0, 10),
    kassa: r.kassa ?? COMPANY,
    wallet: r.wallet ?? "cash",
    category: r.category ?? "other_out",
    note: r.note ?? "",
    status: r.status ?? "planned",
    paidAt: r.paid_at ?? null,
    opId: r.op_id ?? null,
    createdBy: r.created_by ?? null,
  }),
  toRow: (p) => ({
    title: p.title,
    amount: p.amount,
    amount_som: p.amountSom ?? null,
    rate_used: p.rateUsed ?? null,
    due_date: p.dueDate,
    kassa: p.kassa,
    wallet: p.wallet,
    category: p.category,
    note: p.note || null,
    status: p.status,
    paid_at: p.paidAt,
    // Vaqtinchalik id ("k-3-...") bazaga uuid bo'lib tusholmaydi
    op_id: p.opId && /^[0-9a-f-]{36}$/.test(p.opId) ? p.opId : null,
  }),
});

const put = (p) => { items = [p, ...items.filter((x) => x.id !== p.id)].sort(byDue); return p; };

// —— O'qish ————————————————————————————————————
export const listPayouts = () => [...items].sort(byDue);
export const openPayouts = () => listPayouts().filter((p) => p.status === "planned");
export const paidPayouts = () => listPayouts().filter((p) => p.status === "paid");
export const getPayout = (id) => items.find((p) => p.id === id) ?? null;

// Muddatgacha necha kun qolgani. Manfiy — kechikkan.
export const daysLeft = (dueDate, now = new Date()) =>
  Math.round((new Date(dueDate + "T00:00:00") - new Date(iso(now) + "T00:00:00")) / 86400000);

// —— Yozish ————————————————————————————————————
export function addPayout({
  title, amount, amountSom = null, rateUsed = null, dueDate,
  kassa = COMPANY, wallet = "cash", category = "other_out", note = "",
}) {
  const p = {
    id: nextId(),
    title: String(title).trim(),
    amount: +Number(amount).toFixed(2),
    amountSom, rateUsed,
    dueDate: iso(dueDate || new Date()),
    kassa, wallet, category, note,
    status: "planned", paidAt: null, opId: null,
    createdBy: getUser()?.id ?? null,
  };
  put(p);
  sync.created(p);
  return p;
}

export function updatePayout(id, patch) {
  const cur = items.find((p) => p.id === id);
  if (!cur) return null;
  const next = put({ ...cur, ...patch });
  sync.changed(next);
  return next;
}

export function removePayout(id) {
  const cur = items.find((p) => p.id === id);
  // To'langan reja o'chirilsa, u yaratgan kassa chiqimi ham ketadi —
  // aks holda balansda sababsiz kamaygan pul qolib ketardi.
  if (cur?.opId) removeOp(cur.opId);
  items = items.filter((p) => p.id !== id);
  sync.deleted(id);
}

// —— To'lash ————————————————————————————————————
// Reja bajarildi: pul kassadan chiqadi. Summa qisman to'lanishi ham
// mumkin — qolgani yangi reja bo'lib qoladi, chunki "yarim to'landi"
// degan holat ro'yxatda chalkashlik tug'diradi.
export function payPayout(id, { amount, amountSom = null, date, restDate = null, staffId = null } = {}) {
  const p = items.find((x) => x.id === id);
  if (!p || p.status !== "planned") return null;

  const paid = Math.min(+Number(amount ?? p.amount).toFixed(2), p.amount);
  if (!(paid > 0)) return null;
  const when = iso(date || new Date());

  const rest = +(p.amount - paid).toFixed(2);
  // Qisman to'lov: to'langan qismi tarixga tushadi, qolgani yangi
  // reja bo'lib turaveradi (muddatini rahbar o'zi belgilaydi).
  //
  // So'm: rahbar so'mda kiritgan bo'lsa AYNAN o'sha raqam yoziladi
  // (dollardan qaytarib hisoblansa 10 000 → 9 985 bo'lib ketardi).
  // Kiritilmagan bo'lsa — to'langan ulushga qarab bo'linadi.
  const somShare = amountSom != null ? +Number(amountSom).toFixed(2)
    : p.amountSom != null && p.amount > 0
      ? +(p.amountSom * (paid / p.amount)).toFixed(2) : null;

  const op = addOp({
    kassa: p.kassa,
    wallet: p.wallet,
    kind: "out",
    category: p.category,
    amount: paid,
    amountSom: somShare,
    rateUsed: somShare != null ? (p.rateUsed ?? getUsdRate()) : null,
    date: when,
    note: p.note ? `${p.title} · ${p.note}` : p.title,
    staffId,
  });

  const done = put({
    ...p, amount: paid, amountSom: somShare,
    status: "paid", paidAt: new Date(when + "T12:00:00").toISOString(), opId: op.id,
  });
  sync.changed(done);

  // Kassa yozuvi bazaga tushib haqiqiy id olgach, uni rejaga bog'lab
  // qo'yamiz. Busiz sahifa yangilangandan keyin "rejaga qaytarish"
  // o'sha chiqimni topolmay qolardi — pul kassadan chiqqanicha turib,
  // to'lov esa yana "to'lanmagan" bo'lib ikki marta sanalardi.
  op.saved?.then((realId) => {
    if (realId && realId !== op.id) updatePayout(done.id, { opId: realId });
  });

  if (rest > 0.009) {
    const restSom = p.amountSom != null ? +(p.amountSom - (somShare ?? 0)).toFixed(2)
      : somShare != null && p.rateUsed ? +(rest * p.rateUsed).toFixed(2) : null;
    addPayout({
      title: p.title,
      amount: rest,
      amountSom: restSom != null && restSom > 0 ? restSom : null,
      rateUsed: p.rateUsed,
      dueDate: restDate ? iso(restDate) : p.dueDate,
      kassa: p.kassa, wallet: p.wallet,
      category: p.category, note: p.note,
    });
  }
  return done;
}

// To'landi deb belgilangan reja qaytarilsa: kassa chiqimi ham qaytadi
export function unpayPayout(id) {
  const p = items.find((x) => x.id === id);
  if (!p || p.status !== "paid") return null;
  if (p.opId) removeOp(p.opId);
  const next = put({ ...p, status: "planned", paidAt: null, opId: null });
  sync.changed(next);
  return next;
}

// —— Yig'indilar ————————————————————————————————
// Rahbarga kerakli to'rt raqam: jami band pul, kechikkani, shu hafta
// to'lanadigani va shu oyda allaqachon to'langani.
export function payoutSummary(now = new Date()) {
  const t0 = iso(now);
  const monthFrom = t0.slice(0, 7);
  const open = openPayouts();

  const sum = (list) => +list.reduce((a, p) => a + p.amount, 0).toFixed(2);
  const overdue = open.filter((p) => p.dueDate < t0);
  const soon = open.filter((p) => p.dueDate >= t0 && daysLeft(p.dueDate, now) <= 7);
  const paidThisMonth = paidPayouts().filter((p) => String(p.paidAt).slice(0, 7) === monthFrom);

  return {
    planned: sum(open), count: open.length,
    overdue: sum(overdue), overdueCount: overdue.length,
    soon: sum(soon), soonCount: soon.length,
    paidMonth: sum(paidThisMonth), paidMonthCount: paidThisMonth.length,
    // Eng yaqin muddat — "keyingi to'lov qachon" degan savolga javob
    nextDue: open[0]?.dueDate ?? null,
  };
}

// Kassa kesimida band pul: "kompaniya balansida 5000 bor, lekin
// 4000 i allaqachon va'da qilingan" degan holatni ko'rsatish uchun.
export function plannedByKassa() {
  const out = {};
  for (const p of openPayouts()) {
    const k = (out[p.kassa] ??= { total: 0, cash: 0, payme: 0, service: 0 });
    k.total = +(k.total + p.amount).toFixed(2);
    k[p.wallet] = +(k[p.wallet] + p.amount).toFixed(2);
  }
  return out;
}

// —— So'm ————————————————————————————————————
// Xarajatlardagi bilan bir xil qoida: kiritilgan so'm saqlanadi,
// saqlanmagan bo'lsa o'sha kundagi (yoki bugungi) kurs bilan o'giriladi.
export const somOf = (p) => {
  if (p.amountSom != null) return p.amountSom;
  const r = p.rateUsed ?? getUsdRate();
  return r ? p.amount * r : 0;
};
