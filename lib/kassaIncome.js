"use client";
// ══════════════════════════════════════════════════════════════
// KASSA KIRIM-CHIQIMI — BILLZ ДДС EKSPORTIDAN
// ══════════════════════════════════════════════════════════════
// Billz'da "Движение денежных средств" hisoboti har bir pul harakatini
// yozib boradi. Ustunlari:
//
//   Дата и время · Касса · Тип денежной операции · Тип транзакции ·
//   Откуда · Куда · Сумма ИЗ · Сумма В · Пользователь
//
//   Тип денежной операции — Наличные / Payme / Click  → hamyon
//   Тип транзакции        — Доход / Расход            → kirim / chiqim
//   Сумма В               — kirim summasi
//   Сумма ИЗ              — chiqim summasi
//
// Nega KPI jadvalidan emas, shundan: KPI'dagi Naqd/Payme raqamini
// menejerning o'zi kiritadi va o'sha raqamdan bonusi hisoblanadi.
// Bitta raqam ham bonusni, ham kassa balansini belgilasa, uni oshirish
// foydali bo'lib qoladi. ДДС esa Billz'ning o'z yozuvi — menejer
// tegolmaydi. Ikkisining farqi = kamomad, o'zi ko'rinib turadi.
//
// Diqqat: "Сумма ИЗ (USD)" ustuni faylda IKKI marta uchraydi (ikkinchisi
// boshqa valyuta uchun, doim bo'sh). datasets.js takroriy nomlarga " (2)"
// qo'shadi, shuning uchun bu yerda birinchisi olinadi.
import { listDatasets, numberOf, textOf } from "./datasets";
import { demoStores } from "./demoData";

const REPORT_ID = "cashflow";

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
const CASH_WORDS = ["наличн", "naqd", "нақд", "cash"];
const NONCASH_WORDS = ["payme", "click", "karta", "карта", "плас", "plas", "card", "uzcard", "humo"];

function walletOf(v) {
  const n = String(v || "").trim().toLowerCase();
  if (!n) return null;
  if (CASH_WORDS.some((w) => n.includes(w))) return "cash";
  if (NONCASH_WORDS.some((w) => n.includes(w))) return "payme";
  return null;
}

const col = (header, ...names) =>
  header.find((h) => names.some((n) => h.toLowerCase().startsWith(n.toLowerCase()))) ?? null;

// —— Asosiy funksiya ————————————————————————————————
// Qaytadi: { ready, rows, period, byStore: { s1: { cash:{in,out}, ... } } }
export function billzKassaFlow(from, to) {
  const ds = listDatasets().find((d) => d.reportId === REPORT_ID);
  const empty = { ready: false, rows: 0, period: null, byStore: {} };
  if (!ds || !ds.rows?.length) return empty;

  const header = ds.header ?? [];
  // Ustun nomlari ham tilga qarab o'zgarishi mumkin — ikkalasi ham
  // ro'yxatda tursin, aks holda fayl "tanilmadi" bo'lib qolardi.
  const cDate = col(header, "Дата", "Sana", "Date");
  const cKassa = col(header, "Касса", "Kassa");
  const cType = col(header, "Тип денежной операции", "Тип операции", "Pul operatsiya", "To'lov turi");
  const cKind = col(header, "Тип транзакции", "Tranzaksiya");
  const cOut = col(header, "Сумма ИЗ", "Summa IZ");
  const cIn = col(header, "Сумма В", "Summa V");
  if (!cKassa || !cKind || !cIn) return empty;

  const byStore = {};
  const bucket = (s) => (byStore[s] ??= {
    cash: { in: 0, out: 0 }, payme: { in: 0, out: 0 }, service: { in: 0, out: 0 },
  });

  let count = 0, minD = null, maxD = null;
  const days = new Set();
  for (const r of ds.rows) {
    const day = String(textOf(r, cDate)).slice(0, 10);
    if (from && day && day < String(from).slice(0, 10)) continue;
    if (to && day && day > String(to).slice(0, 10)) continue;

    const store = storeOfKassaName(textOf(r, cKassa));
    const wallet = walletOf(textOf(r, cType));
    if (!store || !wallet) continue;

    // Kirimmi chiqimmi — SUMMA USTUNIDAN aniqlanadi, matndan emas.
    // Billz tili o'zbekchaga o'tsa "Доход" o'rniga "Daromad" yoziladi va
    // matnga bog'langan tekshiruv jimgina nol qaytarardi. Summa esa
    // qaysi tilda bo'lsa ham o'sha ustunda turadi.
    const inAmt = numberOf(r, cIn);
    const outAmt = numberOf(r, cOut);
    const kindText = textOf(r, cKind).toLowerCase();
    const isIn = inAmt > 0 ? true
      : outAmt > 0 ? false
      : /доход|daromad|kirim|приход/.test(kindText);
    const amount = isIn ? inAmt : outAmt;
    if (!(amount > 0)) continue;

    bucket(store)[wallet][isIn ? "in" : "out"] += amount;
    count++;
    if (day) {
      days.add(day);
      if (!minD || day < minD) minD = day;
      if (!maxD || day > maxD) maxD = day;
    }
  }

  for (const s of Object.keys(byStore))
    for (const w of Object.keys(byStore[s])) {
      byStore[s][w].in = +byStore[s][w].in.toFixed(2);
      byStore[s][w].out = +byStore[s][w].out.toFixed(2);
    }

  return {
    ready: true, rows: count, days: days.size,
    period: minD ? { from: minD, to: maxD } : null,
    byStore,
  };
}

// —— Bitta kassaning KUNLIK kirimi ————————————————————
// "Farq qayerdan chiqdi?" degan savolga javob: qaysi kunda Billz qancha
// yozgan. Yuqoridagi funksiya bilan bir xil qoida bo'yicha o'qiydi —
// aks holda kunlar yig'indisi umumiy raqamga to'g'ri kelmay qolardi.
export function billzKassaDays(store, from, to) {
  const ds = listDatasets().find((d) => d.reportId === REPORT_ID);
  if (!ds || !ds.rows?.length) return {};

  const header = ds.header ?? [];
  const cDate = col(header, "Дата", "Sana", "Date");
  const cKassa = col(header, "Касса", "Kassa");
  const cType = col(header, "Тип денежной операции", "Тип операции", "Pul operatsiya", "To'lov turi");
  const cKind = col(header, "Тип транзакции", "Tranzaksiya");
  const cOut = col(header, "Сумма ИЗ", "Summa IZ");
  const cIn = col(header, "Сумма В", "Summa V");
  if (!cKassa || !cKind || !cIn || !cDate) return {};

  const out = {};
  for (const r of ds.rows) {
    const day = String(textOf(r, cDate)).slice(0, 10);
    if (!day) continue;
    if (from && day < String(from).slice(0, 10)) continue;
    if (to && day > String(to).slice(0, 10)) continue;
    if (storeOfKassaName(textOf(r, cKassa)) !== store) continue;

    const wallet = walletOf(textOf(r, cType));
    if (wallet !== "cash" && wallet !== "payme") continue;

    const inAmt = numberOf(r, cIn);
    const outAmt = numberOf(r, cOut);
    const kindText = textOf(r, cKind).toLowerCase();
    const isIn = inAmt > 0 ? true
      : outAmt > 0 ? false
      : /доход|daromad|kirim|приход/.test(kindText);
    const amount = isIn ? inAmt : outAmt;
    if (!(amount > 0)) continue;

    // KIRIM − CHIQIM. Nega ayriladi: Billz'da to'lov turi almashtirilsa
    // uch qator yoziladi — naqd chiqim 20, naqd kirim 20, Payme kirim 20.
    // Faqat kirimni qo'shsak naqd 20 ga ko'p chiqadi, menejer esa
    // kassada qolgan haqiqiy pulni yozadi. Qaytarilgan pul ham shunday.
    const d = (out[day] ??= { cash: 0, payme: 0 });
    d[wallet] += isIn ? amount : -amount;
  }
  for (const day of Object.keys(out)) {
    out[day].cash = +out[day].cash.toFixed(2);
    out[day].payme = +out[day].payme.toFixed(2);
  }
  return out;
}

// Kassa nomlari — yuklamada qaysi kassalar borligini ko'rsatish uchun
export function billzKassaNames() {
  const ds = listDatasets().find((d) => d.reportId === REPORT_ID);
  if (!ds?.rows?.length) return [];
  const cKassa = col(ds.header ?? [], "Касса");
  if (!cKassa) return [];
  return [...new Set(ds.rows.map((r) => textOf(r, cKassa)).filter(Boolean))];
}
