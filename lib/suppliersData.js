"use client";
import { syncTable, childWriter } from "./sync";
// Kreditor qarzdorlik: yetkazib beruvchilarga BIZNING qarzimiz.
// Debitor tomoni (mijozlar qarzi) lib/debtsData.js da — bu modul uning
// ko'zgu aksi. Har hisob-faktura hodisa sifatida saqlanadi: qachon paydo
// bo'lgani, to'lov muddati va har to'lov qachon bo'lgani.

const DAY = 86400000;

// —— Yetkazib beruvchilar ————————————————————————————
// Nomlar haqiqiy Billz katalogidagi brendlar va partiyalardagi
// yetkazib beruvchilarga mos (HIKvision, NS, EZVIZ, RUJE...).
let suppliers = [
  { id: "sup1", name: "NS Import", contact: "Guangzhou, Xitoy", phone: "+86 20 8888 11 22" },
  { id: "sup2", name: "HIKvision Distributor", contact: "Toshkent", phone: "+998 71 200 11 22" },
  { id: "sup3", name: "EZVIZ Tashkent", contact: "Toshkent", phone: "+998 71 233 44 55" },
  { id: "sup4", name: "RUJE Distributor", contact: "Toshkent", phone: "+998 90 900 80 70" },
  { id: "sup5", name: "Canon Middle East", contact: "Dubai, BAA", phone: "+971 4 347 99 99" },
  { id: "sup6", name: "Sony Gulf FZE", contact: "Dubai, BAA", phone: "+971 4 881 33 33" },
];

// —— Hisob-fakturalar ————————————————————————————————
// Seed qo'lda yozilgan (deterministik): to'langan, ochiq, muddati o'tgan
// va muddati yaqinlashgan holatlarning barchasi qamrab olingan.
// INV-2110 IMP-101 partiyasiga bog'langan (13 840 + 1 750 xarajat = 15 590).
let invoices = [
  { id: "inv1", no: "INV-2101", supplierId: "sup1", shipmentId: null, amount: 4200,
    invoiceDate: "2026-02-10", dueDate: "2026-03-12",
    payments: [{ amount: 4200, at: "2026-03-05" }], note: "" },
  { id: "inv2", no: "INV-2102", supplierId: "sup1", shipmentId: null, amount: 6800,
    invoiceDate: "2026-04-02", dueDate: "2026-05-02",
    payments: [{ amount: 3000, at: "2026-04-20" }, { amount: 3800, at: "2026-04-30" }], note: "" },
  { id: "inv3", no: "INV-2103", supplierId: "sup1", shipmentId: null, amount: 5400,
    invoiceDate: "2026-06-15", dueDate: "2026-07-15",
    payments: [{ amount: 2000, at: "2026-07-01" }], note: "" },
  { id: "inv4", no: "INV-2104", supplierId: "sup1", shipmentId: null, amount: 3100,
    invoiceDate: "2026-07-08", dueDate: "2026-08-07", payments: [], note: "" },
  { id: "inv5", no: "INV-2105", supplierId: "sup2", shipmentId: null, amount: 2450,
    invoiceDate: "2026-03-01", dueDate: "2026-03-31",
    payments: [{ amount: 2450, at: "2026-03-28" }], note: "" },
  { id: "inv6", no: "INV-2106", supplierId: "sup2", shipmentId: null, amount: 1980,
    invoiceDate: "2026-05-20", dueDate: "2026-06-19", payments: [], note: "" },
  { id: "inv7", no: "INV-2107", supplierId: "sup3", shipmentId: null, amount: 760,
    invoiceDate: "2026-06-01", dueDate: "2026-07-01",
    payments: [{ amount: 760, at: "2026-06-28" }], note: "" },
  { id: "inv8", no: "INV-2108", supplierId: "sup3", shipmentId: null, amount: 890,
    invoiceDate: "2026-07-05", dueDate: "2026-07-25", payments: [], note: "" },
  { id: "inv9", no: "INV-2109", supplierId: "sup4", shipmentId: null, amount: 420,
    invoiceDate: "2026-06-20", dueDate: "2026-07-20", payments: [], note: "" },
  { id: "inv10", no: "INV-2110", supplierId: "sup5", shipmentId: "sp1", amount: 15590,
    invoiceDate: "2026-05-14", dueDate: "2026-06-13",
    payments: [{ amount: 7000, at: "2026-05-30" }, { amount: 5000, at: "2026-06-10" }],
    note: "IMP-101 partiyasi" },
];

let idSeq = 0;
let invSeq = 2200;

// —— Yetkazib beruvchilar CRUD ————————————————————————
// —— Baza ————————————————————————————————————
const supplierSync = syncTable("suppliers", {
  table: "suppliers",
  get: () => suppliers,
  set: (v) => { suppliers = v; },
  fromRow: (r) => ({ id: r.id, name: r.name, phone: r.phone ?? "", note: r.note ?? "" }),
  toRow: (x) => ({ name: x.name, phone: x.phone || null, note: x.note || null }),
});

// Hisob-faktura va unga tushgan to'lovlar
const invoicePayment = childWriter("supplier_payments", "yetkazib beruvchiga to'lov");

const invoiceSync = syncTable("supplier_invoices", {
  table: "supplier_invoices",
  select: "*, supplier_payments(id, amount, paid_at, method)",
  order: { column: "invoice_date", ascending: false },
  get: () => invoices,
  set: (v) => { invoices = v; },
  fromRow: (r) => ({
    id: r.id,
    no: "HF-" + String(r.id).slice(0, 6),
    supplierId: r.supplier_id,
    shipmentId: r.shipment_id,
    amount: Number(r.amount),
    invoiceDate: r.invoice_date,
    dueDate: r.due_date,
    note: r.note ?? "",
    payments: (r.supplier_payments ?? [])
      .map((p) => ({ id: p.id, amount: Number(p.amount), at: p.paid_at, method: p.method }))
      .sort((a, b) => new Date(a.at) - new Date(b.at)),
  }),
  toRow: (i) => ({
    supplier_id: i.supplierId,
    shipment_id: i.shipmentId || null,
    amount: i.amount,
    invoice_date: i.invoiceDate,
    due_date: i.dueDate || null,
    note: i.note || null,
  }),
});

export const listSuppliers = () => [...suppliers];
export const getSupplier = (id) => suppliers.find((s) => s.id === id) || null;

export function addSupplier(data) {
  const item = { id: "sup" + Date.now() + "-" + idSeq++, contact: "", phone: "", ...data };
  suppliers = [...suppliers, item];
  supplierSync.created(item);
  return item;
}

export function updateSupplier(id, patch) {
  suppliers = suppliers.map((s) => (s.id === id ? { ...s, ...patch } : s));
  supplierSync.changed(suppliers.find((s) => s.id === id));
}

export function removeSupplier(id) {
  suppliers = suppliers.filter((s) => s.id !== id);
  supplierSync.deleted(id);
}

// Nom bo'yicha topish yoki yaratish — partiya qo'llanganda ishlatiladi
const normName = (s) => String(s).toLowerCase().replace(/\s+/g, " ").trim();
export function findOrCreateSupplier(name) {
  const n = normName(name);
  if (!n) return null;
  const found = suppliers.find((s) => normName(s.name) === n);
  return found ?? addSupplier({ name: String(name).trim() });
}

// —— Fakturalar ————————————————————————————————————
export const listInvoices = () => [...invoices];
export const getInvoice = (id) => invoices.find((i) => i.id === id) || null;
export const invoicesOf = (supplierId) => invoices.filter((i) => i.supplierId === supplierId);

export const paidOf = (inv) => +inv.payments.reduce((a, p) => a + p.amount, 0).toFixed(2);
export const remainingOf = (inv) => +(inv.amount - paidOf(inv)).toFixed(2);

// Muddatga nisbatan holat: musbat — kechikkan kunlar, manfiy — hali vaqt bor
export function daysOverdue(inv, now = new Date()) {
  const due = new Date(inv.dueDate);
  due.setHours(23, 59, 59, 999);
  return Math.floor((now.getTime() - due.getTime()) / DAY) + 1;
}

export function addInvoice({ supplierId, amount, invoiceDate, dueDate, shipmentId = null, note = "" }) {
  const invDate = invoiceDate ?? new Date().toISOString().slice(0, 10);
  // Muddat ko'rsatilmasa standart 30 kun
  const due = dueDate ?? new Date(new Date(invDate).getTime() + 30 * DAY).toISOString().slice(0, 10);
  const item = {
    id: "inv" + Date.now() + "-" + idSeq++,
    no: "INV-" + invSeq++,
    supplierId, shipmentId,
    amount: +(+amount).toFixed(2),
    invoiceDate: invDate, dueDate: due,
    payments: [], note,
  };
  invoices = [item, ...invoices];
  invoiceSync.created(item);
  return item;
}

export function payInvoice(id, amount) {
  const at = new Date().toISOString().slice(0, 10);
  const amt = +(+amount).toFixed(2);
  invoices = invoices.map((inv) =>
    inv.id === id ? { ...inv, payments: [...inv.payments, { amount: amt, at }] } : inv
  );
  invoicePayment.created({ invoice_id: id, amount: amt, paid_at: at, method: "cash" });
  return getInvoice(id);
}

// Partiya qo'llanganda avtomatik faktura: yetkazib beruvchi nomi bo'yicha
// topiladi yoki yaratiladi, muddat — 30 kun.
export function invoiceFromShipment(shipment, grandTotal) {
  if (!shipment?.supplier?.trim() || !(grandTotal > 0)) return null;
  // Shu partiyaga faktura allaqachon ochilgan bo'lsa takrorlamaymiz
  if (invoices.some((i) => i.shipmentId === shipment.id)) return null;
  const sup = findOrCreateSupplier(shipment.supplier);
  if (!sup) return null;
  return addInvoice({
    supplierId: sup.id,
    amount: grandTotal,
    shipmentId: shipment.id,
    note: shipment.no,
  });
}

// —— Jamlanmalar ————————————————————————————————————
export function openInvoices(now = new Date()) {
  return invoices
    .filter((i) => remainingOf(i) > 0.001)
    .map((i) => ({ ...i, remaining: remainingOf(i), overdue: daysOverdue(i, now) }))
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
}

export function payablesSummary(now = new Date()) {
  const open = openInvoices(now);
  const overdue = open.filter((i) => i.overdue > 0);
  // 0..7 kun ichida to'lanishi kerak bo'lganlar — jadvaldagi sariq
  // belgi chegarasi (> -8) bilan bir xil bo'lishi shart
  const dueSoon = open.filter((i) => i.overdue <= 0 && i.overdue > -8);
  const sum = (list) => +list.reduce((a, i) => a + i.remaining, 0).toFixed(2);
  return {
    totalOpen: sum(open), openCount: open.length,
    overdueAmount: sum(overdue), overdueCount: overdue.length,
    dueSoonAmount: sum(dueSoon), dueSoonCount: dueSoon.length,
  };
}

// Yetkazib beruvchi kesimida qator — jadval uchun
export function supplierRows(now = new Date()) {
  return suppliers
    .map((s) => {
      const mine = invoicesOf(s.id);
      const open = mine.filter((i) => remainingOf(i) > 0.001);
      const overdue = open.filter((i) => daysOverdue(i, now) > 0);
      return {
        supplier: s,
        invoiceCount: mine.length,
        totalInvoiced: +mine.reduce((a, i) => a + i.amount, 0).toFixed(2),
        openAmount: +open.reduce((a, i) => a + remainingOf(i), 0).toFixed(2),
        openCount: open.length,
        overdueAmount: +overdue.reduce((a, i) => a + remainingOf(i), 0).toFixed(2),
        maxOverdueDays: overdue.length ? Math.max(...overdue.map((i) => daysOverdue(i, now))) : 0,
      };
    })
    .filter((r) => r.invoiceCount > 0)
    .sort((a, b) => b.openAmount - a.openAmount);
}
