"use client";
// Mijozlar uchun ma'lumot qatlami.
// Demo rejimda xotirada saqlaydi; Supabase ulanganda shu funksiyalar
// supabase so'rovlariga almashtiriladi (interfeys o'zgarmaydi).

import { EXPORT_CUSTOMERS } from "./billzExport";
import { cashbackPctFor } from "./loyaltyData";
import { syncTable } from "./sync";
import { uploadedCustomers } from "./customersUpload";

// To'lov xulqi profillari — seed qarzlarni yasashda ishlatiladi.
// tez: ~7 kun, o'rtacha: ~18 kun, sekin: ~35 kun
export const PAY_PROFILES = {
  tez: { meanDays: 7, spread: 4 },
  orta: { meanDays: 18, spread: 7 },
  sekin: { meanDays: 34, spread: 12 },
};

// Mijozlar haqiqiy Billz bazasidan (lib/billzData.js).
// Billz'da 4606 ta mijoz bor — bu yerda 1-sahifadagi 10 tasi va
// qarzdorlar ro'yxatidagi 4 ta yirik qarzdor.
// To'lov xulqi profili joriy qarziga qarab taxmin qilinadi: qarzi
// yo'qlar tez to'lovchi, qarzi bori sekinroq.
// Mijozlar Billz eksportidan — 6800 ta, xarid bo'yicha tartiblangan.
// Qarz ma'lumoti eksportda yo'q, shuning uchun xarid hajmiga qarab
// taxminiy profil beriladi (statistika uchun; haqiqiy qarz Billz'da).
let customers = EXPORT_CUSTOMERS.map((c, i) => ({
  id: "m" + (i + 1),
  name: c.name,
  phone: c.phone,
  storeId: c.storeId,
  profile: c.purchases > 3000 ? "sekin" : c.purchases > 500 ? "orta" : "tez",
  // Billz cashback yuritmaydi — NSPOS'ning o'z ko'rsatkichi
  cashback: +((c.purchases ?? 0) * 0.01).toFixed(2),
  createdAt: c.registeredAt,
  billzPurchases: c.purchases ?? 0,
  billzDebt: 0,
  billzDueDate: null,
  salesCount: c.salesCount,
  itemsBought: c.itemsBought,
  returning: c.returning,
  // Oldindan to'lov balansi. Billz'da hammasi 0 va eksportda bu ustun
  // yo'q — o'ylab topilgan raqam balansdagi majburiyatni buzadi,
  // shuning uchun nol. Balans faqat NSPOS ichida to'ldirilganda o'sadi.
  balance: 0,
  // Guruh va teglar: nomi va xarid hajmiga qarab
  groups: c.purchases > 5000 ? ["g2"] : /usta|дукон|dokon|дўкон/i.test(c.name) ? ["g1"] : ["g3"],
  tags: [
    ...(c.purchases > 1000 ? ["t2"] : []),
    c.storeId === "s2" ? "t3" : "t4",
  ],
}));

// —— Balans jurnali ————————————————————————————————
// Har harakat yozib boriladi: kassir "balansim qayerga ketdi?" degan
// savolga javob bera olishi kerak.
let balanceLog = [];
let logSeq = 0;

export const listBalanceLog = (customerId) =>
  balanceLog
    .filter((b) => !customerId || b.customerId === customerId)
    .sort((a, b) => new Date(b.at) - new Date(a.at));

function logBalance(customerId, type, amount, note) {
  balanceLog = [
    { id: "bl" + Date.now() + "-" + logSeq++, customerId, type, amount: +amount.toFixed(2), at: new Date().toISOString(), note },
    ...balanceLog,
  ];
}

// Balansni to'ldirish (mijoz oldindan pul qoldirdi)
export function topUpBalance(customerId, amount, note = "") {
  const amt = Number(amount) || 0;
  if (amt <= 0) return null;
  customers = customers.map((c) =>
    c.id === customerId ? { ...c, balance: +((c.balance ?? 0) + amt).toFixed(2) } : c
  );
  logBalance(customerId, "kirim", amt, note);
  customerSync.changed(getCustomer(customerId));
  return getCustomer(customerId);
}

// Sotuvda balansdan yechish. Balansdan ortiq yechilmaydi.
export function spendBalance(customerId, amount, note = "") {
  const c = getCustomer(customerId);
  if (!c) return 0;
  const amt = Math.min(Number(amount) || 0, c.balance ?? 0);
  if (amt <= 0) return 0;
  customers = customers.map((x) =>
    x.id === customerId ? { ...x, balance: +((x.balance ?? 0) - amt).toFixed(2) } : x
  );
  logBalance(customerId, "chiqim", -amt, note);
  customerSync.changed(getCustomer(customerId));
  return amt;
}

// —— Baza ————————————————————————————————————
// Billz eksportidagi xarid statistikasi (billzPurchases, salesCount)
// bazada saqlanmaydi — u cheklardan hisoblanadi. Shuning uchun
// fromRow'da ular 0 bo'ladi va hisobotlar sotuvlardan oladi.
const customerSync = syncTable("customers", {
  table: "customers",
  get: () => customers,
  set: (v) => { customers = v; },
  fromRow: (r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone ?? "",
    storeId: r.store_id,
    profile: "orta",
    cashback: Number(r.cashback ?? 0),
    balance: Number(r.balance ?? 0),
    createdAt: String(r.created_at).slice(0, 10),
    note: r.note ?? "",
    billzPurchases: 0, salesCount: 0, itemsBought: 0, returning: false,
    groups: [], tags: [],
  }),
  toRow: (c) => ({
    name: c.name,
    phone: c.phone || null,
    store_id: c.storeId || null,
    balance: c.balance ?? 0,
    cashback: c.cashback ?? 0,
    note: c.note || null,
  }),
});

// Billz mijozlar hisoboti yuklangan bo'lsa — o'shandan. Statik ro'yxat
// 22-iyulda qotib qolgan; undan keyin qo'shilgan mijozlar tanish
// bo'lmagani uchun qarzlarning bir qismi "Ro'yxatdan o'tmagan
// mijozlar" qatoriga tushib ketardi.
export const listCustomers = () => {
  const up = uploadedCustomers();
  return up.ready ? [...up.rows] : [...customers];
};

export const getCustomer = (id) => listCustomers().find((c) => c.id === id) || null;

// Telefon yoki ism bo'yicha qidiruv — POS kassada ishlatiladi
export function searchCustomers(q) {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const digits = s.replace(/\D/g, "");
  return listCustomers().filter(
    (c) =>
      c.name.toLowerCase().includes(s) ||
      (digits && c.phone.replace(/\D/g, "").includes(digits))
  );
}

let idSeq = 0;
export function addCustomer(data) {
  const item = {
    id: "m" + Date.now() + "-" + idSeq++,
    profile: "orta",
    cashback: 0,
    createdAt: new Date().toISOString().slice(0, 10),
    ...data,
  };
  customers = [item, ...customers];
  customerSync.created(item);
  return item;
}

export function updateCustomer(id, patch) {
  customers = customers.map((c) => (c.id === id ? { ...c, ...patch } : c));
  customerSync.changed(customers.find((c) => c.id === id));
}

export function removeCustomer(id) {
  customers = customers.filter((c) => c.id !== id);
  customerSync.deleted(id);
}

// Cashback foizi endi qat'iy emas — mijozning sodiqlik darajasidan olinadi
export const CASHBACK_PCT = 1; // eng quyi daraja, eski kod uchun saqlangan

// Mijozning jami xaridi (Billz raqami) darajani belgilaydi
export const totalPurchasesOf = (c) => +(c?.billzPurchases ?? 0).toFixed(2);

export function addCashback(customerId, saleTotal, pct = null) {
  const c = getCustomer(customerId);
  if (!c) return 0;
  // Foiz berilmasa darajaga mos foiz olinadi (Oddiy 1% → Platina 5%)
  const rate = pct ?? cashbackPctFor(totalPurchasesOf(c));
  const amount = +((saleTotal * rate) / 100).toFixed(2);
  customers = customers.map((x) =>
    x.id === customerId ? { ...x, cashback: +(x.cashback + amount).toFixed(2) } : x
  );
  customerSync.changed(getCustomer(customerId));
  return amount;
}
