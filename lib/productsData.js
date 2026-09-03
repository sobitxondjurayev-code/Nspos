"use client";
// Tovarlar uchun ma'lumot qatlami.
// Demo rejimda xotirada saqlaydi; Supabase ulanganda shu funksiyalar
// supabase so'rovlariga almashtiriladi (interfeys o'zgarmaydi).
import { demoStores } from "./demoData";
import { syncTable } from "./sync";
import { insert, rpc, registerModule } from "./db";

// ── KATEGORIYALAR ──────────────────────────────────────────────
// Bazadan keladi (bugun 35 ta, 653 tovardan 580 tasi biriktirilgan). Ilgari ular `lib/billzExport.js` dagi
// muzlatilgan Excel'dan sun'iy id bilan yasalardi ("c1", "c2"),
// bazada esa UUID — ular HECH QACHON mos kelmasdi va Tovarlar
// sahifasidagi kategoriya yorlig'i doim "—" bo'lib turardi.
//
// Modul aynan shu yerda qayd qilinadi (`categoriesData.js` da emas):
// u faylni faqat `analytics.js` import qiladi, ya'ni sahifa uni
// chaqirmasa kategoriyalar umuman yuklanmasdi. `productsData` esa
// Tovarlar bilan birga doim yuklanadi.
//
// Massiv O'RNI ALMASHTIRILMAYDI (`push`/`length = 0`) — uni sahifalar
// to'g'ridan-to'g'ri import qilgan, yangi massiv bersak ular eskisiga
// qarab qolaveradi. `demoStores` bilan bir xil naqsh.
export const demoCategories = [];

registerModule("categories", {
  table: "categories",
  select: "id,name",
  order: { column: "name", ascending: true },
  restore(rows) {
    demoCategories.length = 0;
    for (const r of rows) demoCategories.push({ id: r.id, name: r.name });
  },
});

// Importda uchragan yangi kategoriya avtomatik qo'shiladi
export function addCategory(name) {
  const item = { id: "c" + Date.now() + demoCategories.length, name: String(name).trim() };
  demoCategories.push(item);
  return item;
}

let seq = 100;
export function genBarcode() {
  // EAN-13 uslubidagi raqam (demo)
  const base = "478" + String(Date.now()).slice(-9);
  return base + String(seq++ % 10);
}

// Katalog haqiqiy Billz qoldiq hisobotidan yuklangan (lib/billzData.js).
// Kategoriya nomi bo'yicha id'ga bog'lanadi; brend va bugungi sotuv soni
// ("topSold") ham saqlanadi — hisobotlarda asqotadi.
// Katalog Billz eksportidan (407 tovar, do'konlar bo'yicha yig'ilgan qoldiq)
let products = [];

// ══════════════════════════════════════════════════════════════
// ARXIV — o'chirish o'rniga (2026-09-03)
// ══════════════════════════════════════════════════════════════
// Rahbar "eski tovarni o'chirish" dedi; qaror — ARXIV. Jismoniy
// o'chirish yo'q: Billz'dan kelgan yozuv o'chirilmaydi, sotilgan tovar
// FK bilan bog'langan, sinxron qaytarib keladi. Ikki bayroq:
//   isActive   — Billz'niki (to'liq katalogda yo'q → false)
//   archivedAt — NSPOS'niki (rahbar/menejer qo'lda arxivlaydi)
//
//   listProducts()  — FAOL tovarlar: ro'yxat, sotuv, ombor hisobotlari
//   allProducts()   — hammasi: id bo'yicha qidiruv (chek qatori, xizmat
//                     materiali, ombor operatsiyasi) — arxivlangan tovar
//                     tarixda "Katalogda yo'q" bo'lib qolmasin
//   listArchived()  — arxiv tabi
export const faolMi = (p) => !p.archivedAt && p.isActive !== false;
export const listProducts = () => products.filter(faolMi);
export const allProducts = () => [...products];
export const listArchived = () => products.filter((p) => !faolMi(p));
export const getProduct = (id) => products.find((p) => p.id === id) ?? null;

// ══════════════════════════════════════════════════════════════
// BAZA
// ══════════════════════════════════════════════════════════════
// Tovar va qoldiq bazada IKKI jadval: `products` va `stock`
// (do'kon × tovar). Xotirada esa qoldiq tovar ichida turadi —
// sahifalar shunga moslashgan. O'girish shu yerda bo'ladi.
const stockRows = (p) =>
  Object.entries(p.stock ?? {})
    .filter(([, q]) => q)
    .map(([storeId, qty]) => ({ product_id: p.id, store_id: storeId, qty }));

const productSync = syncTable("products", {
  table: "products",
  select: "*, stock(store_id, qty)",
  get: () => products,
  set: (v) => { products = v; },
  fromRow: (r) => ({
    id: r.id,
    name: r.name,
    sku: r.sku ?? "",
    barcode: r.barcode ?? "",
    categoryId: r.category_id,
    brand: r.brand ?? "",
    supplier: r.supplier ?? "",
    costPrice: Number(r.cost_price),
    salePrice: Number(r.sale_price),
    isService: r.is_service,
    isActive: r.is_active !== false,
    archivedAt: r.archived_at ?? null,
    archivedBy: r.archived_by ?? null,
    billzId: r.billz_id ?? null,
    stock: Object.fromEntries((r.stock ?? []).map((s) => [s.store_id, Number(s.qty)])),
  }),
  toRow: (p) => ({
    name: p.name,
    sku: p.sku || null,
    barcode: p.barcode || null,
    category_id: p.categoryId ?? null,
    brand: p.brand || null,
    supplier: p.supplier || null,
    cost_price: p.costPrice ?? 0,
    sale_price: p.salePrice ?? 0,
    is_service: !!p.isService,
    archived_at: p.archivedAt ?? null,
    archived_by: p.archivedBy ?? null,
  }),
});

// Arxivlash/qaytarish — `update`, o'chirish EMAS. Sinxron `archived_at`
// ga tegmaydi, ya'ni Billz'da hali bor tovar ham arxivda qolaveradi
// (rahbar shuni xohlaydi: ro'yxatda ko'rinmasin).
export function archiveProduct(id, userId = null) {
  return updateProduct(id, { archivedAt: new Date().toISOString(), archivedBy: userId ?? null });
}
export function restoreProduct(id) {
  return updateProduct(id, { archivedAt: null, archivedBy: null });
}

// Diqqat: id faqat Date.now() dan yasalmaydi — import paytida bir millisekundda
// o'nlab tovar qo'shiladi va id'lar takrorlanib, yangilash barchasini buzardi.
let idSeq = 0;
export function addProduct(p) {
  const item = { ...p, id: "p" + Date.now() + "-" + idSeq++ };
  products = [item, ...products];
  productSync.created(item).then(() => {
    // Boshlang'ich qoldiq tovar yozilgandan keyin qo'shiladi:
    // stock jadvali product_id ga tayanadi
    const saved = products.find((x) => x.name === item.name && x.sku === item.sku);
    for (const row of stockRows(saved ?? item)) insert("stock", row, "qoldiq");
  });
  return item;
}
export function updateProduct(id, patch) {
  products = products.map((p) => (p.id === id ? { ...p, ...patch } : p));
  return productSync.changed(products.find((p) => p.id === id));
}
// `removeProduct` OLIB TASHLANDI (2026-09-03): `products` da delete
// siyosati yo'q va bo'lmaydi ham — `archiveProduct` ishlatiladi.
export const totalQty = (p) => demoStores.reduce((a, s) => a + (p.stock[s.id] || 0), 0);

export const findByBarcode = (code) => products.find((p) => p.barcode === code && faolMi(p)) || null;

// Qoldiqni o'zgartirish — bazada apply_stock() SQL funksiyasi orqali.
//
// NEGA FUNKSIYA: ikki kassir bir vaqtda oxirgi donani sotsa, ikkalasi
// ham "qoldiq bor" deb ko'radi va minus chiqadi. apply_stock qatorni
// FOR UPDATE bilan band qiladi — ikkinchisi kutadi va xato oladi.
// Oddiy update bilan buni qilib bo'lmaydi.
function shiftStock(productId, storeId, delta, allowNegative) {
  products = products.map((p) =>
    p.id === productId
      ? { ...p, stock: { ...p.stock, [storeId]: (p.stock[storeId] || 0) + delta } }
      : p
  );
  rpc("apply_stock", {
    p_product: productId, p_store: storeId,
    p_delta: delta, p_allow_negative: !!allowNegative,
  }, "qoldiqni o'zgartirish");
}

// Sotuvda chaqiriladi: tanlangan do'kon qoldig'ini kamaytiradi
export function decrementStock(productId, storeId, qty) {
  const p = products.find((x) => x.id === productId);
  const have = p?.stock[storeId] || 0;
  // Xizmat (montaj) uchun qoldiq yuritilmaydi
  const allowNegative = !!p?.isService;
  shiftStock(productId, storeId, -Math.min(qty, allowNegative ? qty : Math.max(0, have)), allowNegative);
}

// Qaytarishda chaqiriladi: tovar omborga qaytadi
export function incrementStock(productId, storeId, qty) {
  shiftStock(productId, storeId, qty, true);
}
