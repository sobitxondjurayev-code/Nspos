"use client";
import { syncTable, bolaQatorlar } from "./sync";
import { DEMO_MODE, rpc, xotiraYangilandi } from "./db";
import { can } from "./auth";
// O'rnatish xizmatlari.
//
// Buyurtma ikki qismdan iborat: XIZMAT (ishchi kuchi) va MATERIAL (tovar).
// Usta ulushi faqat xizmat summasidan hisoblanadi — material sotuvidan
// usta foiz olmaydi, aks holda qimmat kamera o'rnatgan usta ishига
// nomutanosib haq olardi.
import { listProducts, allProducts } from "./productsData";
import { listCustomers } from "./customersData";
import { listInstallers, getStaff } from "./staffData";
import { demoStores } from "./demoData";
import { asosiyDokonId } from "./storesData";

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

export const STATUSES = {
  yangi: { label: "Yangi", tone: "brand" },
  jarayonda: { label: "Jarayonda", tone: "warn" },
  bajarildi: { label: "Bajarildi", tone: "ok" },
  bekor: { label: "Bekor qilingan", tone: "muted" },
};

// —— Xizmat turlari ————————————————————————————————
let serviceTypes = [
  { id: "sv1", name: "Kamera o'rnatish", price: 15, unit: "dona" },
  { id: "sv2", name: "Videoregistrator sozlash", price: 25, unit: "dona" },
  { id: "sv3", name: "Kabel tortish", price: 1.2, unit: "metr" },
  { id: "sv4", name: "Domofon o'rnatish", price: 40, unit: "dona" },
  { id: "sv5", name: "Signalizatsiya o'rnatish", price: 55, unit: "komplekt" },
  { id: "sv6", name: "Telefonga masofadan ulash", price: 10, unit: "dona" },
  { id: "sv7", name: "Profilaktika xizmati", price: 20, unit: "chiqish" },
  { id: "sv8", name: "Diagnostika uchun chiqish", price: 12, unit: "chiqish" },
];

export const listServiceTypes = () => [...serviceTypes];
export const getServiceType = (id) => serviceTypes.find((s) => s.id === id) || null;

export function addServiceType(data) {
  const item = { id: "sv" + Date.now(), unit: "dona", ...data };
  serviceTypes = [...serviceTypes, item];
  return item;
}
export function updateServiceType(id, patch) {
  serviceTypes = serviceTypes.map((s) => (s.id === id ? { ...s, ...patch } : s));
}
export function removeServiceType(id) {
  serviceTypes = serviceTypes.filter((s) => s.id !== id);
}

// —— Buyurtmalar ————————————————————————————————
const ADDRESSES = [
  "Chilonzor 12-kvartal, 34-uy", "Yunusobod 5-mavze, 12-uy",
  "Mirzo Ulug'bek, Buyuk Ipak Yo'li 128", "Sergeli 7-kvartal, 3-uy",
  "Namangan, Navoiy ko'chasi 45", "Namangan, Do'stlik 12",
  "Yakkasaroy, Shota Rustaveli 88", "Olmazor, Talabalar shaharchasi 4",
];

function buildSeedOrders() {
  const rnd = mulberry32(5072026);
  const clients = listCustomers();
  const installers = listInstallers();
  const catalog = listProducts();
  const out = [];
  let n = 1;

  // Yanvardan bugungacha ~2 kunda bitta buyurtma
  for (let back = 190; back >= 0; back -= 1 + Math.floor(rnd() * 4)) {
    const at = new Date(ANCHOR.getTime() - back * DAY);
    at.setHours(9 + Math.floor(rnd() * 9), Math.floor(rnd() * 60));

    const installer = installers[Math.floor(rnd() * installers.length)];
    const client = clients[Math.floor(rnd() * clients.length)];

    // 1–3 xil xizmat
    const svCount = 1 + Math.floor(rnd() * 3);
    const services = [];
    for (let i = 0; i < svCount; i++) {
      const st = serviceTypes[Math.floor(rnd() * serviceTypes.length)];
      if (services.some((s) => s.typeId === st.id)) continue;
      const qty = st.unit === "metr"
        ? 20 + Math.floor(rnd() * 120)
        : 1 + Math.floor(rnd() * 6);
      services.push({ typeId: st.id, qty, price: st.price });
    }
    if (!services.length) continue;

    // Ba'zi buyurtmalarda material ham sotiladi
    const materials = [];
    if (rnd() < 0.6) {
      const mCount = 1 + Math.floor(rnd() * 2);
      for (let i = 0; i < mCount; i++) {
        const p = catalog[Math.floor(rnd() * catalog.length)];
        if (!p || materials.some((m) => m.productId === p.id)) continue;
        materials.push({ productId: p.id, qty: 1 + Math.floor(rnd() * 3), price: p.salePrice });
      }
    }

    // Eski buyurtmalar bajarilgan, yaqinlari jarayonda yoki yangi
    const status = back > 10
      ? (rnd() < 0.06 ? "bekor" : "bajarildi")
      : back > 3 ? (rnd() < 0.5 ? "bajarildi" : "jarayonda") : "yangi";

    out.push({
      id: "so" + n,
      no: "XZ-" + (700 + n++),
      at: at.toISOString(),
      customerId: client?.id ?? null,
      address: ADDRESSES[Math.floor(rnd() * ADDRESSES.length)],
      storeId: installer.storeId ?? asosiyDokonId(),
      installerId: installer.id,
      installerPct: installer.sharePct ?? 30,
      services, materials,
      status,
      note: "",
    });
  }
  return out.sort((a, b) => new Date(b.at) - new Date(a.at));
}

let orders = buildSeedOrders();
let seq = 900;

// —— Baza ————————————————————————————————————
const orderSync = syncTable("service_orders", {
  table: "service_orders",
  select: "*, service_items(id, kind, product_id, name, qty, price, cost)",
  order: { column: "created_at", ascending: false },
  get: () => orders,
  set: (v) => { orders = v; },
  fromRow: (r) => ({
    id: r.id,
    no: r.no,
    customerId: r.customer_id,
    storeId: r.store_id,
    installerId: r.installer_id,
    status: r.status,
    address: r.address ?? "",
    note: r.note ?? "",
    createdAt: r.created_at,
    scheduledAt: r.scheduled_at,
    finishedAt: r.finished_at,
    services: (r.service_items ?? []).filter((i) => i.kind === "work")
      .map((i) => ({ id: i.id, name: i.name, qty: Number(i.qty), price: Number(i.price) })),
    materials: (r.service_items ?? []).filter((i) => i.kind === "material")
      .map((i) => ({ id: i.id, productId: i.product_id, name: i.name,
                     qty: Number(i.qty), price: Number(i.price), cost: Number(i.cost) })),
  }),
  toRow: (o) => ({
    no: o.no,
    customer_id: o.customerId || null,
    store_id: o.storeId || null,
    installer_id: o.installerId || null,
    status: o.status,
    address: o.address || null,
    note: o.note || null,
    scheduled_at: o.scheduledAt || null,
    finished_at: o.finishedAt || null,
  }),
});

// Ish va materiallar bitta jadvalda (kind bilan ajratiladi), buyurtma
// tahrirlanganda to'liq qayta yoziladi — bir buyurtmada bir necha qator.
// Avval yangi qatorlar, keyin eskilari o'chadi; xato toastga (`bolaQatorlar`)
function saveOrderItems(o) {
  const rows = [
    ...(o.services ?? []).map((x) => ({
      order_id: o.id, kind: "work", name: x.name,
      qty: x.qty ?? 1, price: x.price ?? 0, cost: 0,
    })),
    ...(o.materials ?? []).map((x) => ({
      order_id: o.id, kind: "material", product_id: x.productId ?? null, name: x.name,
      qty: x.qty ?? 1, price: x.price ?? 0, cost: x.cost ?? 0,
    })),
  ];
  return bolaQatorlar("service_items", "order_id", o.id, rows, "xizmat qatorlari");
}

export const listOrders = () =>
  [...orders].sort((a, b) => new Date(b.at) - new Date(a.at));
export const getOrder = (id) => orders.find((o) => o.id === id) || null;

export function addOrder(data) {
  const item = {
    id: "so" + Date.now(),
    no: "XZ-" + seq++,
    at: new Date().toISOString(),
    status: "yangi",
    services: [], materials: [],
    note: "",
    ...data,
  };
  orders = [item, ...orders];
  // Baza HAQIQIY id qaytargach qatorlar o'sha id bilan yoziladi. Ilgari
  // `getOrder(item.id)` vaqtinchalik id bilan qidirilardi (u allaqachon
  // almashgan) va qatorlar "so1725…" degan uuid bo'lmagan id bilan
  // ketib, jimgina rad bo'lardi — yangi buyurtmaning ishlari saqlanmasdi.
  orderSync.created(item).then((r) => {
    if (r && !r.ok) return;
    const o = getOrder(r?.data?.id ?? item.id);
    if (o) saveOrderItems(o);
  });
  return item;
}

export function updateOrder(id, patch) {
  orders = orders.map((o) => (o.id === id ? { ...o, ...patch } : o));
  const o = getOrder(id);
  orderSync.changed(o);
  if (patch.services || patch.materials) saveOrderItems(o);
  return o;
}

export function removeOrder(id) {
  orders = orders.filter((o) => o.id !== id);
  orderSync.deleted(id);
}

// ── Faqat HOLAT — usta ham o'zgartira oladi (2026-09-03) ──
// RLS `service_write` faqat rahbar/menejer. Usta o'z buyurtmasini
// "bajarildi" qila olishi kerak, lekin qatorni to'liq ochib bo'lmaydi
// (narx, ulush ham ochilardi — RLS ustun cheklamaydi). Shuning uchun
// bazada `service_status_set()` (security definer): faqat status va
// finished_at, faqat o'z buyurtmasi. Rahbar/menejer oddiy yo'ldan.
export function setOrderStatus(id, status) {
  const oldingi = getOrder(id);
  if (!oldingi) return null;
  const finishedAt = status === "bajarildi" ? (oldingi.finishedAt ?? new Date().toISOString()) : oldingi.finishedAt;
  orders = orders.map((o) => (o.id === id ? { ...o, status, finishedAt } : o));
  const o = getOrder(id);
  if (can("service.edit")) return orderSync.changed(o);
  return rpc("service_status_set", { p_id: id, p_status: status }, "Buyurtma holati").then((r) => {
    if (r && !r.ok) { orders = orders.map((x) => (x.id === id ? oldingi : x)); xotiraYangilandi(); }
    return r;
  });
}

// —— Hisob ————————————————————————————————————————
export function computeOrder(order) {
  const catalog = allProducts();     // arxivlangan material ham buyurtmada qoladi

  const servicesTotal = +order.services.reduce(
    (a, s) => a + (Number(s.price) || 0) * (Number(s.qty) || 0), 0).toFixed(2);

  const materialsTotal = +order.materials.reduce(
    (a, m) => a + (Number(m.price) || 0) * (Number(m.qty) || 0), 0).toFixed(2);

  // Material tannarxi — foydani to'g'ri hisoblash uchun
  const materialsCost = +order.materials.reduce((a, m) => {
    const p = catalog.find((x) => x.id === m.productId);
    return a + (p?.costPrice ?? 0) * (Number(m.qty) || 0);
  }, 0).toFixed(2);

  // Usta ulushi faqat xizmat summasidan
  const installerShare = +(servicesTotal * (Number(order.installerPct) || 0) / 100).toFixed(2);

  const total = +(servicesTotal + materialsTotal).toFixed(2);
  const profit = +(total - materialsCost - installerShare).toFixed(2);

  return { servicesTotal, materialsTotal, materialsCost, installerShare, total, profit };
}

// Davr bo'yicha — hisobotlar va P&L uchun
export function ordersInRange(from, to) {
  const a = new Date(from).getTime(), b = new Date(to).getTime();
  return orders.filter((o) => {
    const t = new Date(o.at).getTime();
    return t >= a && t <= b;
  });
}

// Bajarilgan buyurtmalar bo'yicha jamlanma
export function servicesSummary(from, to) {
  const done = ordersInRange(from, to).filter((o) => o.status === "bajarildi");
  let servicesTotal = 0, materialsTotal = 0, installerShare = 0, profit = 0;
  for (const o of done) {
    const c = computeOrder(o);
    servicesTotal += c.servicesTotal;
    materialsTotal += c.materialsTotal;
    installerShare += c.installerShare;
    profit += c.profit;
  }
  return {
    count: done.length,
    servicesTotal: +servicesTotal.toFixed(2),
    materialsTotal: +materialsTotal.toFixed(2),
    installerShare: +installerShare.toFixed(2),
    profit: +profit.toFixed(2),
    total: +(servicesTotal + materialsTotal).toFixed(2),
  };
}

// Usta kesimida KPI
export function installerStats(from, to) {
  const done = ordersInRange(from, to).filter((o) => o.status === "bajarildi");
  const map = new Map();
  for (const o of done) {
    const c = computeOrder(o);
    const cur = map.get(o.installerId) ?? { orders: 0, servicesTotal: 0, share: 0 };
    cur.orders++;
    cur.servicesTotal += c.servicesTotal;
    cur.share += c.installerShare;
    map.set(o.installerId, cur);
  }
  return [...map.entries()]
    .map(([id, v]) => ({
      installer: getStaff(id),
      orders: v.orders,
      servicesTotal: +v.servicesTotal.toFixed(2),
      share: +v.share.toFixed(2),
      avgCheck: +(v.servicesTotal / v.orders).toFixed(2),
    }))
    .filter((r) => r.installer)
    .sort((a, b) => b.servicesTotal - a.servicesTotal);
}
