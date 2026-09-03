"use client";
// ══════════════════════════════════════════════════════════════
// BILLZ KASSA NOMI → NSPOS DO'KONI
// ══════════════════════════════════════════════════════════════
// Alohida modulda turadi, chunki uni IKKI joy ishlatadi:
// `kassaIncome` (ДДС o'qishi) va `customersUpload`. Ilgari u
// `kassaIncome` ichida edi va `customersUpload` o'shandan olardi —
// natijada aylanma bog'liqlik tug'ildi:
//
//   kassaIncome → debtsData → customersData → customersUpload → kassaIncome
//
// Aylana yopilganda `debtsData` o'z boshlang'ich ma'lumotini
// `customersData` hali tayyor bo'lmagan paytda qurishga urinardi va
// ilova "Cannot access 'listCustomers' before initialization" bilan
// ishga tushmasdi. Nom xaritasi hech kimga bog'liq emas — shuning
// uchun uning joyi shu yerda.
import { demoStores } from "./demoData";
import { storeOfBillzName } from "./storesData";

// Billz kassa nomi → NSPOS do'koni. Nom Billz'da qo'lda yozilgan
// ("Касса NSkamera", "Cashbox nskamera namangan"), shuning uchun aniq
// tenglik emas, kalit so'z bo'yicha topiladi.
//
// MUHIM: natija sifatida do'konning HAQIQIY id'si qaytariladi. Ilgari
// bu yerda "s1"/"s2" qotirib qo'yilgandi — demo rejimda ishlardi, lekin
// bazada do'kon id'i UUID bo'lgani uchun jonli tizimda hech narsa mos
// kelmasdi va kassalar nol ko'rinardi.
//
// Tartib muhim: "Cashbox nskamera namangan" ichida "nskamera" ham bor,
// shuning uchun avval "namangan" tekshiriladi.
const STORE_HINTS = [
  { keys: ["namangan"], name: "nscamera namangan" },
  { keys: ["optim", "nskamera", "nscamera"], name: "nscamera optim" },
];

const byName = (needle) =>
  demoStores.find((s) => String(s.name || "").toLowerCase() === needle) ?? null;

export function storeOfKassaName(name) {
  const n = String(name || "").toLowerCase();
  if (!n) return null;
  // 2026-09-03: avval bazadagi `stores.billz_names` (rahbar Sozlamalarda
  // yozadi); pastdagi STORE_HINTS — migratsiyagacha zaxira
  const bazadan = storeOfBillzName(n);
  if (bazadan) return bazadan;
  for (const h of STORE_HINTS) {
    if (!h.keys.some((k) => n.includes(k))) continue;
    const st = byName(h.name);
    if (st) return st.id;
  }
  // Kalit so'z mos kelmasa — do'kon nomi kassa nomining ichida bormi
  const direct = demoStores.find((s) => n.includes(String(s.name || "").toLowerCase()));
  return direct ? direct.id : null;
}

// Billz'dagi to'lov turi → NSPOS hamyoni. Click ham naqdsiz, ya'ni
// Payme hamyoniga qo'shiladi (rahbar: "barcha kartalar Payme").
//
// Billz interfeysi tili o'zgarsa qiymatlar ham o'zgaradi ("Наличные" →
// "Naqd"), shuning uchun ikkala tildagi nom ham tanilishi kerak.
// To'lov usuli nomidan hamyonni aniqlash. Bular ham shu yerda,
// chunki `kassaIncome` va `customersUpload` ikkalasi ham ishlatadi.
export const CASH_WORDS = ["наличн", "naqd", "нақд", "cash"];
export const NONCASH_WORDS = ["payme", "click", "karta", "карта", "плас", "plas", "card", "uzcard", "humo"];

