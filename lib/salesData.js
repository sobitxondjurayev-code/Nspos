"use client";
// Sotuvlar (POS) uchun ma'lumot qatlami.
// Demo rejimda xotirada saqlaydi; Supabase ulanganda shu funksiyalar
// supabase so'rovlariga almashtiriladi (interfeys o'zgarmaydi).
import { demoStores } from "./demoData";
import { EXPORT_TRANSACTIONS } from "./billzExport";
import { listProducts, decrementStock, incrementStock } from "./productsData";
import { listCustomers, addCashback, spendBalance } from "./customersData";
import { addDebt } from "./debtsData";
import { syncTable } from "./sync";
import { rpc, DEMO_MODE } from "./db";

const pad = (n) => String(n).padStart(2, "0");

// —— Haqiqiy Billz tarixi ————————————————————————————
// Sotuv tarixi endi generatsiya qilinmaydi — Billz eksportidan keladi
// (7 779 tranzaksiya, 01.01–22.07.2026). Har chekda haqiqiy kassir,
// mijoz, to'lov taqsimoti va chegirma bor.
//
// Tranzaksiyada tovar tarkibi YO'Q, chunki bu ESKI Excel eksporti —
// Billz uni alohida hisobotda berardi. Bu massiv faqat demo rejim va
// baza bo'sh bo'lgan holat uchun qoldi.
//
// JONLI ma'lumotda tovar tarkibi BOR: 2026-08-19 dan beri chek qatorlari
// Billz API'dan keladi (`/v3/order-search` javobining ichida) va
// `sale_items` jadvaliga yoziladi — 34 489 qator. Ya'ni tovar kesimidagi
// foyda, ABC tahlil va do'kon reytingi endi haqiqiy raqamdan hisoblanadi.
function buildSeedSales() {
  // Chekdagi mijoz faqat NOM bilan keladi. Uni bir marta mijoz id'siga
  // bog'lab qo'yamiz — aks holda mijoz kesimidagi barcha hisobotlar
  // (ABC, qarzdorlik, sodiqlik) bo'sh chiqadi.
  const idByName = new Map();
  for (const c of listCustomers()) if (!idByName.has(c.name)) idByName.set(c.name, c.id);

  return EXPORT_TRANSACTIONS.map((t, i) => ({
    id: "tx-" + i,
    no: t.no,
    type: t.type,
    storeId: t.storeId,
    at: t.at,
    items: [],
    itemCount: t.items,
    returnedCount: t.returned,
    subtotal: +(t.total + t.discount).toFixed(2),
    discountPct: 0,
    discountAmt: t.discount,
    total: t.total,
    cash: t.cash,
    card: 0,
    payme: t.payme,
    fromBalance: t.cashback,
    debt: t.debt,
    change: 0,
    cashier: t.cashier,
    customerName: t.customer,
    customerId: idByName.get(t.customer) ?? null,
    imported: true,
  }));
}

let sales = buildSeedSales();
let nextNo = 5000;

// —— Baza ————————————————————————————————————
// Chek va uning qatorlari ikki jadval: `sales` va `sale_items`.
//
// YOZISH: oddiy insert EMAS, `create_sale()` SQL funksiyasi orqali.
// U bitta tranzaksiyada chek raqamini oladi, qatorlarni yozadi,
// qoldiqni kamaytiradi va qarzni ochadi. Ikki kassir bir vaqtda
// sotsa ham chek raqami takrorlanmaydi va qoldiq minusga tushmaydi.
const saleSync = syncTable("sales", {
  table: "sales",
  select: "*, sale_items(id, product_id, name, qty, price, cost_price, total)",
  order: { column: "sold_at", ascending: false },
  get: () => sales,
  set: (v) => { sales = v; },
  sort: (a, b) => new Date(b.at) - new Date(a.at),
  fromRow: (r) => ({
    id: r.id,
    no: r.no,
    type: r.type,
    storeId: r.store_id,
    at: r.sold_at,
    items: (r.sale_items ?? []).map((i) => ({
      productId: i.product_id, name: i.name,
      qty: Number(i.qty), price: Number(i.price), total: Number(i.total),
      // Sotilgan paytdagi tannarx — yalpi foyda shundan hisoblanadi
      // (`managementData.billzInRange`). Ilgari o'qilmasdi, chunki
      // chek qatorlari umuman bo'sh edi.
      costPrice: Number(i.cost_price ?? 0),
    })),
    itemCount: (r.sale_items ?? []).reduce((a, i) => a + Number(i.qty), 0),
    subtotal: Number(r.subtotal),
    discountPct: 0,
    discountAmt: Number(r.discount),
    total: Number(r.total),
    cash: Number(r.cash), card: Number(r.card), payme: Number(r.payme),
    fromBalance: Number(r.from_balance), debt: Number(r.debt),
    change: 0,
    cashier: r.cashier_id,
    customerId: r.customer_id,
    originalSaleId: r.original_id,
    imported: r.imported,
  }),
  // create_sale ishlatilgani uchun toRow faqat qaytarish uchun kerak
  toRow: (s) => ({
    store_id: s.storeId,
    no: s.no,
    type: s.type,
    original_id: s.originalSaleId || null,
    customer_id: s.customerId || null,
    sold_at: s.at,
    subtotal: s.subtotal,
    discount: s.discountAmt ?? 0,
    total: s.total,
    cash: s.cash ?? 0, card: s.card ?? 0, payme: s.payme ?? 0,
    from_balance: s.fromBalance ?? 0, debt: s.debt ?? 0,
  }),
});

// —— Umumiy interfeys ————————————————————————————————————
// Har doim yangi sanadan eskisiga qarab tartiblangan holda qaytadi
export const listSales = () => [...sales].sort((a, b) => new Date(b.at) - new Date(a.at));

export const getSale = (id) => sales.find((s) => s.id === id) || null;

export function addSale({ storeId, items, discountPct = 0, cash = 0, card = 0, payme = 0, fromBalance = 0, debt = 0, cashier = "Sobitxon K.", customerId = null }) {
  const subtotal = +items.reduce((a, i) => a + i.price * i.qty, 0).toFixed(2);
  const discountAmt = +((subtotal * discountPct) / 100).toFixed(2);
  const total = +(subtotal - discountAmt).toFixed(2);
  // Payme ham pul bilan to'langan qismga kiradi (naqd emas, lekin qarz ham emas)
  const paid = +(cash + card + payme + fromBalance).toFixed(2);

  const sale = {
    id: "sale-" + Date.now(),
    no: "CH-" + nextNo++,
    type: "sale",
    storeId,
    at: new Date().toISOString(),
    items: items.map((i) => ({
      productId: i.productId, name: i.name, price: i.price,
      qty: i.qty, total: +(i.price * i.qty).toFixed(2),
    })),
    subtotal, discountPct, discountAmt, total,
    cash: +cash.toFixed(2), card: +card.toFixed(2),
    payme: +payme.toFixed(2), fromBalance: +fromBalance.toFixed(2),
    debt: +debt.toFixed(2),
    // Qarzga yozilgan qism pul bilan to'lanmagan, shuning uchun qaytim
    // faqat naqd+kartadan hisoblanadi
    change: +Math.max(0, paid - (total - debt)).toFixed(2),
    cashier, customerId,
  };

  // Qoldiqni kamaytiramiz
  for (const i of sale.items) decrementStock(i.productId, storeId, i.qty);

  sales = [sale, ...sales];

  // Balansdan to'langan bo'lsa — mijoz balansidan yechamiz
  if (fromBalance > 0 && customerId) {
    spendBalance(customerId, fromBalance, sale.no);
  }
  // Qarzga sotilgan bo'lsa — qarz jurnaliga yozamiz
  if (debt > 0 && customerId) addDebt({ customerId, saleId: sale.id, amount: debt });
  // Cashback faqat haqiqatda to'langan summadan hisoblanadi
  if (customerId && paid > 0) addCashback(customerId, Math.min(paid, total));

  // Bazaga atomik yozish. Xotira allaqachon yangilangan, shuning uchun
  // kassir kutmaydi; xato bo'lsa ekranda ogohlantirish chiqadi.
  if (!DEMO_MODE) {
    rpc("create_sale", {
      p_store: storeId,
      p_items: sale.items.map((i) => ({ product_id: i.productId, qty: i.qty, price: i.price })),
      p_payment: { cash, card, payme, from_balance: fromBalance, debt },
      p_customer: customerId,
      p_discount: discountAmt,
    }, "chekni saqlash").then((r) => {
      if (r?.data) sales = sales.map((x) => (x.id === sale.id ? { ...x, id: r.data } : x));
    });
  }

  return sale;
}

// —— Qaytarish ————————————————————————————————————
// Billz'da qaytarish alohida tranzaksiya sifatida yoziladi (manfiy summa),
// asl chek esa o'zgarmaydi. Shu yondashuv takrorlangan: qaytarish
// alohida yozuv, undan asl chekka havola qoladi.
export function addReturn({ saleId, items, method = "cash", reason = "" }) {
  const orig = sales.find((s) => s.id === saleId);
  if (!orig || !items.length) return null;

  const amount = +items.reduce((a, i) => a + i.price * i.qty, 0).toFixed(2);
  // Asl chekda chegirma bo'lgan bo'lsa, qaytarishga ham o'sha nisbatda qo'llanadi
  const ratio = orig.subtotal > 0 ? orig.total / orig.subtotal : 1;
  const refund = +(amount * ratio).toFixed(2);

  const ret = {
    id: "ret-" + Date.now() + "-" + nextNo,
    no: "QT-" + nextNo++,
    type: "return",
    originalSaleId: orig.id,
    originalNo: orig.no,
    storeId: orig.storeId,
    at: new Date().toISOString(),
    items: items.map((i) => ({
      productId: i.productId, name: i.name, price: i.price,
      qty: i.qty, total: +(i.price * i.qty).toFixed(2),
    })),
    subtotal: -amount,
    discountPct: orig.discountPct, discountAmt: 0,
    // Summalar manfiy: hisobotlarda oddiy qo'shish bilan ayirilib ketadi
    total: -refund,
    cash: method === "cash" ? -refund : 0,
    card: method === "card" ? -refund : 0,
    payme: method === "payme" ? -refund : 0,
    debt: 0, change: 0,
    cashier: orig.cashier,
    customerId: orig.customerId,
    reason,
  };

  // Tovar omborga qaytadi
  for (const i of ret.items) incrementStock(i.productId, orig.storeId, i.qty);

  sales = [ret, ...sales];
  saleSync.created(ret);
  return ret;
}

// Chek bo'yicha allaqachon qaytarilgan miqdorlar: { productId: qty }
export function returnedQtyOf(saleId) {
  const map = {};
  for (const s of sales) {
    if (s.type !== "return" || s.originalSaleId !== saleId) continue;
    for (const i of s.items) map[i.productId] = (map[i.productId] || 0) + i.qty;
  }
  return map;
}

export const returnsOf = (saleId) => sales.filter((s) => s.type === "return" && s.originalSaleId === saleId);

// Tashqi tizimdan yuklangan chek.
// Bu tarixiy ma'lumot, shuning uchun qoldiq kamaytirilmaydi va
// cashback berilmaydi — ular o'z vaqtida allaqachon hisoblangan.
export function addImportedSale({ no, at, storeId, cashier, items, customerId = null }) {
  const subtotal = +items.reduce((a, i) => a + i.price * i.qty, 0).toFixed(2);
  const sale = {
    id: "sale-imp-" + no + "-" + at.getTime(),
    no: String(no),
    storeId,
    at: at.toISOString(),
    items,
    subtotal, discountPct: 0, discountAmt: 0, total: subtotal,
    cash: subtotal, card: 0, debt: 0, change: 0,
    cashier, customerId,
    imported: true,
  };
  sales = [sale, ...sales];
  return sale;
}

// Davr bo'yicha filtr — Dashboard va Hisobotlar uchun
export function salesInRange(from, to) {
  const a = from instanceof Date ? from.getTime() : new Date(from).getTime();
  const b = to instanceof Date ? to.getTime() : new Date(to).getTime();
  return sales.filter((s) => {
    const t = new Date(s.at).getTime();
    return t >= a && t <= b;
  });
}

// Do'kon kesimida jami summa: { s1: 1234, s2: ... }
export function storeTotalsInRange(from, to) {
  const totals = Object.fromEntries(demoStores.map((s) => [s.id, 0]));
  for (const s of salesInRange(from, to)) {
    totals[s.storeId] = +(totals[s.storeId] + s.total).toFixed(2);
  }
  return totals;
}

export const MONTHS_SHORT = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"];

// Grafik nuqtalari juda zich bo'lib ketmasligi uchun davr uzunligiga qarab
// bo'linish tanlanadi: bir kun -> soatlab, bir oygacha -> kunlab, undan uzun -> oylab.
export function granularityFor(from, to) {
  const days = (new Date(to) - new Date(from)) / 86400000;
  if (days <= 1) return "hour";
  if (days <= 45) return "day";
  return "month";
}

// Recharts uchun qator: [{ date:"01.07", s1:.., s2:.., s3:.., all:.. }]
export function salesSeries(from, to) {
  const g = granularityFor(from, to);
  const map = new Map();
  const empty = () => ({ ...Object.fromEntries(demoStores.map((s) => [s.id, 0])), all: 0 });

  const keyOf = (d) =>
    g === "hour" ? `${pad(d.getHours())}:00`
    : g === "day" ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`
    : MONTHS_SHORT[d.getMonth()];

  // Avval butun oraliqni nol qiymatlar bilan to'ldiramiz —
  // shunda sotuvsiz kunlar grafikda uzilib qolmaydi
  const cursor = new Date(from);
  const end = new Date(to);
  if (g === "hour") cursor.setMinutes(0, 0, 0);
  else cursor.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    const key = keyOf(cursor);
    if (!map.has(key)) map.set(key, { date: key, ...empty() });
    if (g === "hour") cursor.setHours(cursor.getHours() + 1);
    else if (g === "day") cursor.setDate(cursor.getDate() + 1);
    else cursor.setMonth(cursor.getMonth() + 1, 1);
  }

  for (const s of salesInRange(from, to)) {
    const row = map.get(keyOf(new Date(s.at)));
    if (!row) continue;
    row[s.storeId] = +(row[s.storeId] + s.total).toFixed(2);
    row.all = +(row.all + s.total).toFixed(2);
  }
  return [...map.values()];
}
