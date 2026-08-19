"use client";
// Kassa operatsiyalari jurnali.
// Hozircha qarz to'lovlari shu yerga yoziladi; 7-bosqichda xarajat
// kategoriyalari va smena yopilishi shu tuzilmaga qo'shiladi.

import { syncTable } from "./sync";

export const OP_CATEGORIES = {
  debt: { label: "Qarz to'lovi", type: "kirim" },
  sale: { label: "Sotuvdan tushum", type: "kirim" },
  other_in: { label: "Boshqa kirim", type: "kirim" },
  supply: { label: "Tovar xaridi", type: "chiqim" },
  supplier_payment: { label: "Yetkazib beruvchiga to'lov", type: "chiqim" },
  salary: { label: "Ish haqi", type: "chiqim" },
  rent: { label: "Ijara", type: "chiqim" },
  other_out: { label: "Boshqa chiqim", type: "chiqim" },
};

let operations = [];
let seq = 1;

// —— Baza ————————————————————————————————————
const opSync = syncTable("cash_operations", {
  table: "cash_operations",
  order: { column: "created_at", ascending: false },
  get: () => operations,
  set: (v) => { operations = v; },
  sort: (a, b) => new Date(b.at) - new Date(a.at),
  fromRow: (r) => ({
    id: r.id,
    no: "OP-" + String(r.id).slice(0, 6),
    category: r.category,
    type: r.direction === "in" ? "kirim" : "chiqim",
    amount: Number(r.amount),
    method: r.method,
    at: r.created_at,
    note: r.note ?? "",
    customerId: null,
    storeId: r.store_id,
  }),
  toRow: (o) => ({
    store_id: o.storeId || null,
    direction: o.type === "kirim" ? "in" : "out",
    category: o.category,
    amount: o.amount,
    method: o.method,
    note: o.note || null,
  }),
});

export const listOperations = () => [...operations].sort((a, b) => new Date(b.at) - new Date(a.at));

export function addOperation({ category, amount, method = "cash", note = "", customerId = null, storeId = null }) {
  const meta = OP_CATEGORIES[category] ?? OP_CATEGORIES.other_in;
  const op = {
    id: "op" + seq,
    no: "OP-" + (100 + seq++),
    category,
    type: meta.type,
    amount: +amount.toFixed(2),
    method,
    at: new Date().toISOString(),
    note, customerId, storeId,
  };
  operations = [op, ...operations];
  opSync.created(op);
  return op;
}

// Davr bo'yicha jamlanma: naqd/karta, kirim/chiqim
export function cashSummary(from, to) {
  const a = new Date(from).getTime(), b = new Date(to).getTime();
  const inRange = operations.filter((o) => {
    const t = new Date(o.at).getTime();
    return t >= a && t <= b;
  });

  const sum = (f) => +inRange.filter(f).reduce((s, o) => s + o.amount, 0).toFixed(2);
  return {
    kirimCash: sum((o) => o.type === "kirim" && o.method === "cash"),
    kirimCard: sum((o) => o.type === "kirim" && o.method === "card"),
    kirimPayme: sum((o) => o.type === "kirim" && o.method === "payme"),
    chiqim: sum((o) => o.type === "chiqim"),
    count: inRange.length,
  };
}
