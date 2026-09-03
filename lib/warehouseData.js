"use client";
import { syncTable, bolaQatorlar } from "./sync";
import { DEMO_MODE, insert } from "./db";
// Ombor operatsiyalari: transfer, inventarizatsiya, qayta baholash, hisobdan chiqarish.
//
// Barcha operatsiyalar bir xil hayot siklidan o'tadi: qoralama → qo'llangan.
// Qo'llangandan keyin tahrirlab bo'lmaydi — qoldiq va narx allaqachon
// o'zgargan bo'ladi, orqaga qaytarish alohida operatsiya talab qiladi.
import { allProducts, updateProduct } from "./productsData";
import { demoStores } from "./demoData";

export const OP_TYPES = {
  transfer: {
    label: "Transfer",
    hint: "Tovarni bir do'kondan boshqasiga ko'chirish",
    needsFrom: true, needsTo: true,
  },
  inventory: {
    label: "Inventarizatsiya",
    hint: "Omborni sanab chiqib, tizimdagi qoldiqni haqiqiy holatga keltirish",
    needsFrom: true, needsTo: false,
  },
  revaluation: {
    label: "Qayta baholash",
    hint: "Tovar narxlarini ommaviy o'zgartirish",
    needsFrom: false, needsTo: false,
  },
  writeoff: {
    label: "Hisobdan chiqarish",
    hint: "Buzilgan, yo'qolgan yoki muddati o'tgan tovarni chiqarish",
    needsFrom: true, needsTo: false,
  },
};

export const WRITEOFF_REASONS = [
  "Buzilgan", "Yo'qolgan", "Nosoz chiqdi", "Namoyish namunasi", "Boshqa",
];

// —— Seed ————————————————————————————————————————
// Haqiqiy Billz katalogidagi tovarlar bilan. Sanalar qat'iy —
// hydration mos kelishi uchun Date.now() ishlatilmaydi.
let operations = [
  {
    id: "wo1", no: "TR-301", type: "transfer", status: "applied",
    at: "2026-07-14T11:20:00", appliedAt: "2026-07-14T11:25:00",
    fromStoreId: "s3", toStoreId: "s1", author: "Sobitxon K.",
    note: "Optimga to'ldirish",
    items: [
      { productId: "p21", qty: 20 },  // Xap 8port gigabit
      { productId: "p12", qty: 10 },  // 2 kuzli wifi okam
    ],
  },
  {
    id: "wo2", no: "IN-302", type: "inventory", status: "applied",
    at: "2026-07-10T18:00:00", appliedAt: "2026-07-10T19:30:00",
    fromStoreId: "s1", toStoreId: null, author: "Abduvohid Kassa",
    note: "Oylik sanoq",
    // countedQty — sanoqda topilgani. Farq qo'llanganda qoldiq shunga tenglashadi.
    items: [
      { productId: "p18", countedQty: 123 },  // Karobka ger. (tizimda 125)
      { productId: "p24", countedQty: 88 },   // Jiton oddiy (tizimda 90)
    ],
  },
  {
    id: "wo3", no: "PB-303", type: "revaluation", status: "draft",
    at: "2026-07-18T10:00:00", appliedAt: null,
    fromStoreId: null, toStoreId: null, author: "Sobitxon K.",
    note: "Kurs o'zgarishi bo'yicha",
    items: [
      { productId: "p6", newSalePrice: 145 },   // TECH 7ST (hozir 135)
      { productId: "p19", newSalePrice: 430 },  // IDS-TCM203-A (hozir 410)
    ],
  },
  {
    id: "wo4", no: "HC-304", type: "writeoff", status: "draft",
    at: "2026-07-19T09:15:00", appliedAt: null,
    fromStoreId: "s1", toStoreId: null, author: "Abduvohid Kassa",
    note: "",
    items: [
      { productId: "p16", qty: 2, reason: "Nosoz chiqdi" }, // AHD Balonchi
    ],
  },
];

let idSeq = 0;
const SEQ = { transfer: 400, inventory: 400, revaluation: 400, writeoff: 400 };
const PREFIX = { transfer: "TR", inventory: "IN", revaluation: "PB", writeoff: "HC" };

// —— Baza ————————————————————————————————————
// Operatsiya va qatorlari ikki jadval. Qatorlar operatsiya bilan
// birga o'qiladi, tasdiqlanganda qoldiq apply_stock orqali o'zgaradi
// (productsData ichida).
// Qatorlar operatsiya bilan birga tahrirlanadi. Har tahrirda ularni
// to'liq qayta yozamiz — operatsiyada bir necha qator bo'ladi, xolos,
// shuning uchun "o'chir va qayta yoz" eng sodda va xatosiz yo'l.
// Avval yangi qatorlar, keyin eskilari o'chadi; xato toastga (`bolaQatorlar`)
function saveItems(op) {
  return bolaQatorlar("warehouse_items", "operation_id", op.id, op.items.map((i) => ({
    operation_id: op.id,
    product_id: i.productId,
    qty: i.qty,
    counted_qty: i.counted ?? null,
    unit_cost: i.unitCost ?? 0,
  })), "ombor qatorlari");
}

const whSync = syncTable("warehouse_operations", {
  table: "warehouse_operations",
  select: "*, warehouse_items(id, product_id, qty, counted_qty, unit_cost)",
  order: { column: "created_at", ascending: false },
  get: () => operations,
  set: (v) => { operations = v; },
  fromRow: (r) => ({
    id: r.id,
    no: r.no,
    type: r.type,
    fromStoreId: r.from_store_id,
    toStoreId: r.to_store_id,
    status: r.status,
    note: r.reason ?? "",
    author: r.created_by,
    at: r.created_at,
    appliedAt: r.applied_at,
    items: (r.warehouse_items ?? []).map((i) => ({
      id: i.id, productId: i.product_id,
      qty: Number(i.qty),
      counted: i.counted_qty == null ? null : Number(i.counted_qty),
      unitCost: Number(i.unit_cost),
    })),
  }),
  toRow: (o) => ({
    no: o.no,
    type: o.type,
    from_store_id: o.fromStoreId || null,
    to_store_id: o.toStoreId || null,
    status: o.status,
    reason: o.note || null,
    applied_at: o.appliedAt || null,
  }),
});

export const listOperations = () =>
  [...operations].sort((a, b) => new Date(b.at) - new Date(a.at));

export const getOperation = (id) => operations.find((o) => o.id === id) || null;

export function addOperation({ type, fromStoreId = null, toStoreId = null, author = "Sobitxon K.", note = "" }) {
  const op = {
    id: "wo" + Date.now() + "-" + idSeq++,
    no: PREFIX[type] + "-" + SEQ[type]++,
    type, status: "draft",
    at: new Date().toISOString(), appliedAt: null,
    fromStoreId, toStoreId, author, note,
    items: [],
  };
  operations = [op, ...operations];
  whSync.created(op);
  return op;
}

export function updateOperation(id, patch) {
  operations = operations.map((o) => (o.id === id ? { ...o, ...patch } : o));
  const op = getOperation(id);
  whSync.changed(op);
  if (patch.items) saveItems(op);
  return op;
}

export function removeOperation(id) {
  operations = operations.filter((o) => o.id !== id);
  whSync.deleted(id);
}

// —— Hisob ————————————————————————————————————————
// Har tur uchun qator ma'lumoti: hozirgi holat, o'zgarish va natija
export function computeOperation(op) {
  const catalog = allProducts();

  const rows = op.items.map((it) => {
    const product = catalog.find((p) => p.id === it.productId);
    const from = op.fromStoreId;
    const current = product && from ? (product.stock[from] ?? 0) : 0;

    if (op.type === "inventory") {
      const counted = Number(it.countedQty) || 0;
      const diff = counted - current;
      return {
        ...it, product, current, counted, diff,
        // Kamomad tannarxda zarar, ortiqcha esa daromad
        value: +(diff * (product?.costPrice ?? 0)).toFixed(2),
      };
    }

    if (op.type === "revaluation") {
      const oldPrice = product?.salePrice ?? 0;
      const newPrice = Number(it.newSalePrice) || 0;
      const totalQty = product
        ? demoStores.reduce((a, s) => a + (product.stock[s.id] ?? 0), 0)
        : 0;
      return {
        ...it, product, oldPrice, newPrice,
        deltaPct: oldPrice > 0 ? +(((newPrice - oldPrice) / oldPrice) * 100).toFixed(1) : 0,
        totalQty,
        value: +((newPrice - oldPrice) * totalQty).toFixed(2),
      };
    }

    // transfer va writeoff
    const qty = Number(it.qty) || 0;
    return {
      ...it, product, current, qty,
      enough: current >= qty,
      value: +(qty * (product?.costPrice ?? 0)).toFixed(2),
    };
  });

  const totalValue = +rows.reduce((a, r) => a + (r.value || 0), 0).toFixed(2);
  const totalQty = rows.reduce((a, r) => a + Math.abs(r.qty ?? r.diff ?? 0), 0);
  // Transfer/writeoff da qoldiq yetmasa qo'llab bo'lmaydi
  const blocked = rows.some((r) => r.enough === false);

  return { rows, totalValue, totalQty, blocked };
}

// Operatsiyani qo'llash — qoldiq va narxlar shu yerda o'zgaradi
export function applyOperation(id) {
  const op = getOperation(id);
  if (!op || op.status === "applied") return null;

  const { rows, blocked } = computeOperation(op);
  if (blocked) return null; // qoldiq yetmaydi
  // Transferda manba va manzil bir xil bo'lsa qo'llash ma'nosiz —
  // qoldiq avval kamayib keyin o'sha joyga qaytadi
  if (op.type === "transfer" && (!op.toStoreId || op.toStoreId === op.fromStoreId)) return null;

  for (const r of rows) {
    if (!r.product) continue;
    const stock = { ...r.product.stock };

    if (op.type === "transfer") {
      stock[op.fromStoreId] = Math.max(0, (stock[op.fromStoreId] ?? 0) - r.qty);
      stock[op.toStoreId] = (stock[op.toStoreId] ?? 0) + r.qty;
      updateProduct(r.product.id, { stock });
    }

    if (op.type === "writeoff") {
      stock[op.fromStoreId] = Math.max(0, (stock[op.fromStoreId] ?? 0) - r.qty);
      updateProduct(r.product.id, { stock });
    }

    if (op.type === "inventory") {
      // Sanoq natijasi tizimdagi qoldiqni to'liq almashtiradi
      stock[op.fromStoreId] = r.counted;
      updateProduct(r.product.id, { stock });
    }

    if (op.type === "revaluation") {
      updateProduct(r.product.id, { salePrice: r.newPrice });
    }
  }

  return updateOperation(id, { status: "applied", appliedAt: new Date().toISOString() });
}

// Jamlanma — sahifadagi ko'rsatkich kartalari uchun
export function warehouseSummary() {
  const drafts = operations.filter((o) => o.status === "draft");
  const applied = operations.filter((o) => o.status === "applied");

  let shrinkage = 0; // inventarizatsiyadagi kamomad
  let writtenOff = 0;
  for (const o of applied) {
    const c = computeOperation(o);
    if (o.type === "inventory") {
      shrinkage += c.rows.filter((r) => r.diff < 0).reduce((a, r) => a + Math.abs(r.value), 0);
    }
    if (o.type === "writeoff") writtenOff += c.totalValue;
  }

  return {
    draftCount: drafts.length,
    appliedCount: applied.length,
    shrinkage: +shrinkage.toFixed(2),
    writtenOff: +writtenOff.toFixed(2),
  };
}
