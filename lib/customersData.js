"use client";
// Mijozlar uchun ma'lumot qatlami.
// Demo rejimda xotirada saqlaydi; Supabase ulanganda shu funksiyalar
// supabase so'rovlariga almashtiriladi (interfeys o'zgarmaydi).

// ══════════════════════════════════════════════════════════════
// DIQQAT: `lib/billzExport.js` BU YERDA ISHLATILMAYDI
// ══════════════════════════════════════════════════════════════
// U 2 MB lik fayl bo'lib, ichida 6 792 ta HAQIQIY telefon raqami va
// mijoz ismi bor. Import qilinsa u brauzer to'plamiga tushadi —
// ya'ni har xodim DevTools ochib butun mijozlar bazasini ko'ra
// oladi. Bazadagi 56 ta RLS siyosati bunga TA'SIR QILMAYDI, chunki
// ma'lumot bazadan emas, KODNING ICHIDAN keladi.
//
// Endi baza to'la (9 087 mijoz, 9 032 chek, 34 489 qator) va u
// yagona manba. Boshlang'ich qiymat BO'SH: ma'lumot kelguncha
// ekranda "yuklanmoqda" turadi — bu soxta raqamdan yaxshiroq.
//
// Fayl repoda qoladi (hech narsa o'chirilmaydi), lekin uni endi
// hech kim import qilmaydi va u to'plamga tushmaydi.
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
let customers = [];

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
    // Xarid statistikasi cheklardan hisoblanadi va `refresh_customer_stats()`
    // orqali ustunlarga yozib qo'yiladi (sinxronizatsiya oxirida). Ilgari
    // bu to'rt raqam faqat Excel yuklamasida bor edi — shuning uchun
    // sahifa bazani emas, yuklamani o'qirdi.
    billzPurchases: Number(r.purchases_total ?? 0),
    salesCount: Number(r.sales_count ?? 0),
    itemsBought: Number(r.items_bought ?? 0),
    returning: !!r.is_returning,
    lastPurchaseAt: r.last_purchase_at ?? null,
    billzExternalId: r.billz_external_id ?? null,
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
// Mijozlar BAZADAN o'qiladi.
//
// 2026-08-19 gacha bu yerda Excel yuklamasi ustun turardi
// (`up.ready ? up.rows : customers`) — chunki bazada xarid statistikasi
// yo'q edi. Natijada baza 9 084 mijozga to'lgan bo'lsa ham ekranda
// 05.08 dagi 6 997 qatorli fayl ko'rinardi va yangi mijoz umuman
// chiqmasdi. Endi statistika ham bazada (`refresh_customer_stats()`),
// shuning uchun manba bitta.
//
// Yuklama butunlay tashlanmaydi: baza bo'sh bo'lsa (demo rejim yoki
// jadval hali yo'q) u zaxira bo'lib qoladi.
export const listCustomers = () => {
  if (customers.length) return [...customers];
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
