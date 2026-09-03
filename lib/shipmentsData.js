"use client";
import { syncTable, bolaQatorlar } from "./sync";
import { DEMO_MODE } from "./db";
// Import partiyalari va tannarx (landed cost).
//
// Tovarning haqiqiy tannarxi faqat sotib olish narxidan iborat emas:
// bojxona, yetkazib berish, broker xizmati ham unga qo'shiladi.
// Bu xarajatlar partiyadagi tovarlarga QIYMATI bo'yicha proporsional
// taqsimlanadi — qimmat tovar ko'proq ulush oladi.
import { listProducts, updateProduct } from "./productsData";
import { demoStores } from "./demoData";

export const COST_TYPES = {
  freight: { label: "Yetkazib berish" },
  customs: { label: "Bojxona to'lovi" },
  broker: { label: "Broker xizmati" },
  cert: { label: "Sertifikatlash" },
  other: { label: "Boshqa xarajat" },
};

let shipments = [
  {
    id: "sp1", no: "IMP-101",
    date: "2026-05-14",
    supplier: "Canon Middle East",
    storeId: "s3",
    status: "applied",
    items: [
      { productId: "p1", qty: 6, unitPrice: 1780 },
      { productId: "p3", qty: 20, unitPrice: 158 },
    ],
    costs: [
      { type: "freight", amount: 420 },
      { type: "customs", amount: 1180 },
      { type: "broker", amount: 150 },
    ],
  },
  {
    id: "sp2", no: "IMP-102",
    date: "2026-07-02",
    supplier: "Sony Gulf FZE",
    storeId: "s3",
    status: "draft",
    items: [
      { productId: "p2", qty: 4, unitPrice: 1920 },
      { productId: "p6", qty: 100, unitPrice: 21.5 },
    ],
    costs: [
      { type: "freight", amount: 380 },
      { type: "customs", amount: 940 },
    ],
  },
];

let seq = 103;

// —— Baza ————————————————————————————————————
// Partiya uch jadval: shipments + shipment_items + shipment_costs.
// Tannarx taqsimoti (landed cost) xotirada hisoblanadi.
// Avval yangi qatorlar, keyin eskilari o'chadi; xato toastga (`bolaQatorlar`)
async function saveShipmentChildren(sp) {
  const a = await bolaQatorlar("shipment_items", "shipment_id", sp.id, (sp.items ?? []).map((i) => ({
    shipment_id: sp.id, product_id: i.productId, qty: i.qty, unit_price: i.unitPrice,
  })), "partiya tovarlari");
  const b = await bolaQatorlar("shipment_costs", "shipment_id", sp.id, (sp.costs ?? []).map((c) => ({
    shipment_id: sp.id, type: c.type, amount: c.amount, note: c.note ?? null,
  })), "partiya xarajatlari");
  return a && b;
}

const shipmentSync = syncTable("shipments", {
  table: "shipments",
  select: "*, shipment_items(id, product_id, qty, unit_price), shipment_costs(id, type, amount, note)",
  order: { column: "shipped_at", ascending: false },
  get: () => shipments,
  set: (v) => { shipments = v; },
  fromRow: (r) => ({
    id: r.id,
    no: r.no,
    supplier: r.supplier ?? "",
    storeId: r.store_id,
    date: r.shipped_at,
    status: r.status,
    items: (r.shipment_items ?? []).map((i) => ({
      productId: i.product_id, qty: Number(i.qty), unitPrice: Number(i.unit_price),
    })),
    costs: (r.shipment_costs ?? []).map((c) => ({
      type: c.type, amount: Number(c.amount), note: c.note ?? "",
    })),
  }),
  toRow: (sp) => ({
    no: sp.no,
    supplier: sp.supplier || null,
    store_id: sp.storeId || null,
    shipped_at: sp.date,
    status: sp.status,
  }),
});

export const listShipments = () =>
  [...shipments].sort((a, b) => new Date(b.date) - new Date(a.date));

export const getShipment = (id) => shipments.find((s) => s.id === id) || null;

export function addShipment(data) {
  const item = {
    id: "sp" + Date.now(),
    no: "IMP-" + seq++,
    status: "draft",
    items: [], costs: [],
    ...data,
  };
  shipments = [item, ...shipments];
  shipmentSync.created(item).then(() => saveShipmentChildren(getShipment(item.id) ?? item));
  return item;
}

export function updateShipment(id, patch) {
  shipments = shipments.map((s) => (s.id === id ? { ...s, ...patch } : s));
  const sp = getShipment(id);
  shipmentSync.changed(sp);
  if (patch.items || patch.costs) saveShipmentChildren(sp);
  return sp;
}

export function removeShipment(id) {
  shipments = shipments.filter((s) => s.id !== id);
  shipmentSync.deleted(id);
}

// —— Tannarx hisobi ————————————————————————————————
// Qiymat bo'yicha proporsional taqsimot:
//   ulush_i = jamiXarajat × (qiymat_i / jamiQiymat)
//   tannarx_i = sotibOlishNarxi_i + ulush_i / miqdor_i
export function computeLanded(shipment) {
  const catalog = listProducts();
  const totalCosts = +shipment.costs.reduce((a, c) => a + (Number(c.amount) || 0), 0).toFixed(2);

  const rows = shipment.items.map((it) => {
    const product = catalog.find((p) => p.id === it.productId);
    const qty = Number(it.qty) || 0;
    const unitPrice = Number(it.unitPrice) || 0;
    return { ...it, product, qty, unitPrice, value: +(qty * unitPrice).toFixed(2) };
  });

  const totalValue = +rows.reduce((a, r) => a + r.value, 0).toFixed(2);

  const withCost = rows.map((r) => {
    // Jami qiymat 0 bo'lsa taqsimlab bo'lmaydi — nolga bo'lishdan saqlanamiz
    const share = totalValue > 0 ? +(totalCosts * (r.value / totalValue)).toFixed(2) : 0;
    const landedUnit = r.qty > 0 ? +(r.unitPrice + share / r.qty).toFixed(2) : r.unitPrice;
    const markup = r.unitPrice > 0
      ? +(((landedUnit - r.unitPrice) / r.unitPrice) * 100).toFixed(1)
      : 0;
    return { ...r, costShare: share, landedUnit, markup, landedTotal: +(landedUnit * r.qty).toFixed(2) };
  });

  return {
    rows: withCost,
    totalValue,
    totalCosts,
    grandTotal: +(totalValue + totalCosts).toFixed(2),
    totalQty: withCost.reduce((a, r) => a + r.qty, 0),
  };
}

// Tannarxni katalogga yozish va qoldiqni omborga kiritish
export function applyShipment(id) {
  const shipment = getShipment(id);
  if (!shipment || shipment.status === "applied") return null;

  const { rows } = computeLanded(shipment);
  const storeId = shipment.storeId ?? demoStores[0].id;

  for (const r of rows) {
    if (!r.product) continue;
    updateProduct(r.product.id, {
      costPrice: r.landedUnit,
      stock: { ...r.product.stock, [storeId]: (r.product.stock[storeId] ?? 0) + r.qty },
    });
  }

  return updateShipment(id, { status: "applied", appliedAt: new Date().toISOString() });
}
