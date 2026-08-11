"use client";
// Kassa smenalari.
// Smena = kassir kassani ochgandan yopgungacha bo'lgan davr.
// Yopishda kassadagi haqiqiy naqd sanaladi va kutilgan summa bilan solishtiriladi —
// farq shu yerda chiqadi.
import { demoStores } from "./demoData";
import { syncTable } from "./sync";
import { BILLZ_STAFF } from "./billzData";
import { salesInRange } from "./salesData";
import { listOperations } from "./financeData";

const DAY = 86400000;
const ANCHOR = new Date(2026, 6, 22);

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ombor (Sklad) kassa emas — unda smena bo'lmaydi
export const shiftStores = demoStores.filter((s) => s.id !== "s3");

// Do'kondagi kassir — haqiqiy xodimlar ro'yxatidan
const cashiers = Object.fromEntries(
  BILLZ_STAFF.filter((s) => s.role === "cashier").map((s) => [s.storeId, s.name])
);

// —— Seed: oxirgi kunlar uchun yopilgan smenalar ————————————
function buildSeedShifts() {
  const rnd = mulberry32(31072026);
  const out = [];
  let n = 1;

  // Kechagi kundan boshlab 6 kun orqaga
  for (let back = 6; back >= 1; back--) {
    const day = new Date(ANCHOR.getTime() - back * DAY);
    for (const store of shiftStores) {
      const openedAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0);
      const closedAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 21, 0);
      const openingCash = 200 + Math.round(rnd() * 300);

      // Kutilgan naqd shu davrdagi haqiqiy sotuvlardan hisoblanadi
      const sales = salesInRange(openedAt, closedAt).filter((s) => s.storeId === store.id);
      const salesCash = +sales.reduce((a, s) => a + s.cash, 0).toFixed(2);
      const expected = +(openingCash + salesCash).toFixed(2);

      // Kunlarning bir qismida kichik farq bo'ladi (sanoqda xato, mayda chaqa)
      const hasDiff = rnd() < 0.45;
      const diff = hasDiff ? +((rnd() - 0.55) * 12).toFixed(2) : 0;

      out.push({
        id: "sh" + n,
        no: "SM-" + (500 + n++),
        storeId: store.id,
        cashier: cashiers[store.id],
        openedAt: openedAt.toISOString(),
        closedAt: closedAt.toISOString(),
        openingCash,
        countedCash: +(expected + diff).toFixed(2),
        note: "",
      });
    }
  }
  return out.sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt));
}

let shifts = buildSeedShifts();
let seq = 900;

// —— Baza ————————————————————————————————————
// schema.sql da bitta do'konda faqat bitta ochiq smena bo'lishini
// unikal indeks kafolatlaydi (one_open_shift_per_store) — ikki kassir
// bir vaqtda smena ochsa ikkinchisi xato oladi.
const shiftSync = syncTable("shifts", {
  table: "shifts",
  order: { column: "opened_at", ascending: false },
  get: () => shifts,
  set: (v) => { shifts = v; },
  sort: (a, b) => new Date(b.openedAt) - new Date(a.openedAt),
  fromRow: (r) => ({
    id: r.id,
    no: "SM-" + String(r.id).slice(0, 6),
    storeId: r.store_id,
    cashier: r.cashier_id,
    openedAt: r.opened_at,
    closedAt: r.closed_at,
    openingCash: Number(r.opening_cash),
    countedCash: r.counted_cash == null ? null : Number(r.counted_cash),
    note: r.note ?? "",
  }),
  toRow: (s) => ({
    store_id: s.storeId,
    opened_at: s.openedAt,
    closed_at: s.closedAt,
    opening_cash: s.openingCash,
    counted_cash: s.countedCash,
    note: s.note || null,
  }),
});

// —— Umumiy interfeys ————————————————————————————————
export const listShifts = () =>
  [...shifts].sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt));

export const activeShift = (storeId) =>
  shifts.find((s) => s.storeId === storeId && !s.closedAt) || null;

export function openShift({ storeId, cashier, openingCash }) {
  if (activeShift(storeId)) return null; // bir do'konda bitta ochiq smena
  const shift = {
    id: "sh" + Date.now(),
    no: "SM-" + seq++,
    storeId, cashier,
    openedAt: new Date().toISOString(),
    closedAt: null,
    openingCash: +openingCash.toFixed(2),
    countedCash: null,
    note: "",
  };
  shifts = [shift, ...shifts];
  shiftSync.created(shift);
  return shift;
}

export function closeShift(id, countedCash, note = "") {
  shifts = shifts.map((s) =>
    s.id === id
      ? { ...s, closedAt: new Date().toISOString(), countedCash: +countedCash.toFixed(2), note }
      : s
  );
  const closed = shifts.find((s) => s.id === id);
  shiftSync.changed(closed);
  return closed;
}

// —— Hisob-kitob ————————————————————————————————————
// Smena davomidagi sotuvlar va kassa operatsiyalari yig'iladi.
// Kutilgan naqd = ochilish naqdi + naqd sotuvlar + naqd kirim − naqd chiqim.
// Karta sotuvlari kassadagi naqdga ta'sir qilmaydi, shuning uchun
// farq hisobiga kirmaydi — lekin ma'lumot uchun alohida ko'rsatiladi.
export function shiftSummary(shift, now = new Date()) {
  const from = new Date(shift.openedAt);
  const to = shift.closedAt ? new Date(shift.closedAt) : now;

  const sales = salesInRange(from, to).filter((s) => s.storeId === shift.storeId);
  const salesCash = +sales.reduce((a, s) => a + s.cash, 0).toFixed(2);
  const salesCard = +sales.reduce((a, s) => a + s.card, 0).toFixed(2);
  const salesPayme = +sales.reduce((a, s) => a + (s.payme || 0), 0).toFixed(2);
  const salesDebt = +sales.reduce((a, s) => a + (s.debt || 0), 0).toFixed(2);

  // Do'koni ko'rsatilmagan operatsiyalar umumkassa hisoblanadi
  const ops = listOperations().filter((o) => {
    const t = new Date(o.at);
    return t >= from && t <= to && (!o.storeId || o.storeId === shift.storeId);
  });
  const opsCashIn = +ops.filter((o) => o.type === "kirim" && o.method === "cash")
    .reduce((a, o) => a + o.amount, 0).toFixed(2);
  const opsCardIn = +ops.filter((o) => o.type === "kirim" && o.method === "card")
    .reduce((a, o) => a + o.amount, 0).toFixed(2);
  const opsCashOut = +ops.filter((o) => o.type === "chiqim" && o.method === "cash")
    .reduce((a, o) => a + o.amount, 0).toFixed(2);

  const expectedCash = +(shift.openingCash + salesCash + opsCashIn - opsCashOut).toFixed(2);
  const diff = shift.countedCash == null ? null : +(shift.countedCash - expectedCash).toFixed(2);

  return {
    salesCount: sales.length,
    salesCash, salesCard, salesPayme, salesDebt,
    opsCashIn, opsCardIn, opsCashOut,
    expectedCash, diff,
    revenue: +(salesCash + salesCard + salesPayme + salesDebt).toFixed(2),
  };
}
