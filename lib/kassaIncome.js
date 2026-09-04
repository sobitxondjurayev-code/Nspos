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
import { ymd } from "./dates";
import { listSales } from "./salesData";
import { listDebts } from "./debtsData";
import { storeOfKassaName, CASH_WORDS, NONCASH_WORDS } from "./kassaNomlari";
import { jonliServisKirim } from "./serviceIncome";
import { dataVersion } from "./db";

const REPORT_ID = "cashflow";

// Eski chaqiruvlar buzilmasin — nom xaritasi endi kassaNomlari.js da
export { storeOfKassaName };

function walletOf(v) {
  const n = String(v || "").trim().toLowerCase();
  if (!n) return null;
  if (CASH_WORDS.some((w) => n.includes(w))) return "cash";
  if (NONCASH_WORDS.some((w) => n.includes(w))) return "payme";
  return null;
}

const col = (header, ...names) =>
  header.find((h) => names.some((n) => h.toLowerCase().startsWith(n.toLowerCase()))) ?? null;

// ══════════════════════════════════════════════════════════════
// BAZADAN — ДДС Excel'ining o'rniga
// ══════════════════════════════════════════════════════════════
// ДДС faylni qo'lda yuklash kerak edi va u ertami-kech eskiradi:
// oxirgi yuklama 01–12 avgustni qamragan, ya'ni 13-avgustdan keyingi
// kamomad nazorati BO'SH turgan. Endi Billz cheklari bazada, demak
// o'sha raqamni o'zimiz chiqaramiz.
//
// **Tiyinigacha tekshirildi (2026-08-21), 01–12 avgust:**
//   naqd:  baza 42 926.40 · ДДС 42 926.34 → farq 0.06
//   payme: baza 10 492.26 · ДДС 10 492.27 → farq 0.01
//
// Qoida uchtadan iborat va uchalasi ham tajribada topilgan:
//
// 1. **Qaytarish cheki `cash`/`payme` ni MUSBAT yozadi** — bu
//    qaytarilgan pul. ДДС uni "Расход" qiladi. Shuning uchun u
//    `in` ga emas, `out` ga tushadi. Qo'shib yuborilsa naqd ikki
//    barobar qaytarish summasicha ko'p chiqadi.
// 2. **Qarz to'lovlari ham kassaga tushadi.** Avgustda sotuvning
//    49 580 $ i nasiyaga ketgan, eski qarzdan esa 60 744 $ qaytgan —
//    ya'ni kassadagi naqdning YARMIDAN KO'PI qarz puli. Ularsiz
//    hisob soxta kamomad ko'rsatardi.
// 3. **`kind = 'return'` to'lov emas** — u tovar qaytishi, pul
//    harakati emas.
//
// `service` hamyoni bu yerda doim nol: ДДС da ham servis alohida
// turmaydi, montaj oddiy tovar kabi sotiladi.
//
// ⚠ BITTA CHEKLOV — DO'KON KESIMI.
// Qarz to'lovi qaysi kassada olinganini baza BILMAYDI:
// `debt_payments.received_by` Billz'da bo'sh (13 503 yozuvdan
// NOLTASIDA to'ldirilgan). Shuning uchun to'lov qarz BERILGAN
// do'konga yoziladi. Mijoz boshqa do'konda to'lasa raqam o'sha
// do'konlar orasida siljiydi.
//
// O'lchandi (01–12 avgust, ДДС bilan yonma-yon):
//   Namangan  naqd +341.12 · payme −292.24
//   Optim     naqd −341.07 · payme +292.23
// Ya'ni farqlar OYNA AKSI — pul yo'qolmaydi, faqat do'kon o'rtasida
// boshqacha taqsimlanadi. KOMPANIYA bo'yicha yig'indi ДДС ga
// tiyinigacha teng (naqd 0.06 · payme 0.01 farq).
//
// Buni tuzatish uchun Billz'dan to'lovni qabul qilgan kassa kerak —
// hozircha yo'q. Do'kon kesimidagi kamomad raqamiga shu bo'shliq
// bilan qaraladi (12 kunda ~340 $, kunlik ~28 $).
// Qarz to'lovi usuli → kassa hamyoni. `card` (Click/Uzum/Humo) ham bank
// hamyoni (`payme`) — chekdagi bilan bir xil qoida. `unknown` va
// `return` — hamyon yo'q (birinchisi audit `qarz-nomalum-usul`,
// ikkinchisi tovar qaytishi, pul emas).
const hamyonUsuli = (method) =>
  method === "cash" ? "cash" : (method === "payme" || method === "card") ? "payme" : null;

function flowFromDb(from, to) {
  const a = ymd(from), b = ymd(to);
  const byStore = {};
  const bucket = (s) => (byStore[s] ??= {
    cash: { in: 0, out: 0 }, payme: { in: 0, out: 0 }, service: { in: 0, out: 0 },
  });

  const days = new Set();
  let count = 0, minD = null, maxD = null;
  const belgila = (day) => {
    days.add(day);
    if (!minD || day < minD) minD = day;
    if (!maxD || day > maxD) maxD = day;
  };

  for (const s of listSales()) {
    const day = ymd(s.at);
    if (!day || day < a || day > b) continue;
    if (!s.storeId) continue;
    const bk = bucket(s.storeId);
    // Qaytarish — chiqim; sotuv va almashuv — kirim
    const yon = s.type === "return" ? "out" : "in";
    bk.cash[yon] += +s.cash || 0;
    // Karta (Click/Uzum/Humo terminal) ham bank hamyoniga — `payme`.
    // 2026-09-04 gacha `card` hech qaysi hamyonga tushmasdi: Click
    // yoqilsa pul jimgina yo'qolardi (audit `kirim-hamyonsiz`, DAFTAR 20).
    bk.payme[yon] += (+s.payme || 0) + (+s.card || 0);
    count++;
    belgila(day);
  }

  for (const d of listDebts()) {
    if (!d.storeId) continue;
    for (const p of d.payments ?? []) {
      if (p.kind === "return") continue;          // tovar qaytishi, pul emas
      const day = ymd(p.at);
      if (!day || day < a || day > b) continue;
      const w = hamyonUsuli(p.method);
      if (!w) continue;                            // 'unknown' — audit `qarz-nomalum-usul`
      bucket(d.storeId)[w].in += +p.amount || 0;
      count++;
      belgila(day);
    }
  }

  for (const st of Object.keys(byStore))
    for (const w of Object.keys(byStore[st])) {
      byStore[st][w].in = +byStore[st][w].in.toFixed(2);
      byStore[st][w].out = +byStore[st][w].out.toFixed(2);
    }

  return {
    ready: count > 0, rows: count, days: days.size,
    period: minD ? { from: minD, to: maxD } : null,
    byStore, manba: "baza",
  };
}

// —— Asosiy funksiya ————————————————————————————————
// Qaytadi: { ready, rows, period, byStore: { s1: { cash:{in,out}, ... } } }
export function billzKassaFlow(from, to) {
  // Baza birinchi: u to'liq va o'zi yangilanadi. ДДС yuklamasi
  // zaxira bo'lib qoladi — baza bo'sh bo'lsa (demo rejim yoki
  // sinxronizatsiya hali yurmagan) o'sha ishlaydi.
  const db = flowFromDb(from, to);
  if (db.ready) return db;

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
    const day = ymd(textOf(r, cDate));
    if (from && day && day < ymd(from)) continue;
    if (to && day && day > ymd(to)) continue;

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
// Bazadan — yuqoridagi `flowFromDb` bilan AYNAN bir xil qoida.
// Ikki joyda ikki xil hisoblansa kunlar yig'indisi umumiy raqamga
// to'g'ri kelmay qoladi (bu loyihada bir necha marta bo'lgan xato).
//
// HAMMA DO'KON BIR AYLANISHDA. Ilgari bu funksiya bitta do'konni
// o'qirdi va har chaqiriqda 9 263 chek + 16 123 qarz to'lovini boshdan
// aylanardi. KPI jadvali uni har xodim-oy uchun chaqiradi, ya'ni bitta
// sahifada o'nlab marta. Endi bir marta yig'iladi va keshlanadi.
function kunlarBazadan(a, b) {
  const out = {};
  const kun = (store, d) => {
    const s = (out[store] ??= {});
    return (s[d] ??= { cash: 0, payme: 0 });
  };

  for (const s of listSales()) {
    if (!s.storeId) continue;
    const day = ymd(s.at);
    if (!day || day < a || day > b) continue;
    // Qaytarish — MANFIY (pul kassadan chiqadi), qolgani musbat
    const ishora = s.type === "return" ? -1 : 1;
    const d = kun(s.storeId, day);
    d.cash += ishora * (+s.cash || 0);
    d.payme += ishora * ((+s.payme || 0) + (+s.card || 0));   // karta ham bank hamyoni
  }

  for (const dd of listDebts()) {
    if (!dd.storeId) continue;
    for (const p of dd.payments ?? []) {
      if (p.kind === "return") continue;
      const day = ymd(p.at);
      if (!day || day < a || day > b) continue;
      const w = hamyonUsuli(p.method);
      if (!w) continue;
      kun(dd.storeId, day)[w] += +p.amount || 0;
    }
  }

  for (const store of Object.keys(out))
    for (const day of Object.keys(out[store])) {
      out[store][day].cash = +out[store][day].cash.toFixed(2);
      out[store][day].payme = +out[store][day].payme.toFixed(2);
    }
  return out;
}

function daysFromDb(store, from, to) {
  return kunlarBazadan(ymd(from), ymd(to))[store] ?? {};
}

export function billzKassaDays(store, from, to) {
  const db = daysFromDb(store, from, to);
  if (Object.keys(db).length) return db;

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
    const day = ymd(textOf(r, cDate));
    if (!day) continue;
    if (from && day < ymd(from)) continue;
    if (to && day > ymd(to)) continue;
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

// ══════════════════════════════════════════════════════════════
// KUNLIK KIRIM — NAQD · PAYME · SERVIS (2026-08-26 dan)
// ══════════════════════════════════════════════════════════════
// Ilgari bu uch raqamni menejer KPI kunlik jadvaliga QO'LDA yozardi.
// Bazadan o'lchandi (1–19 avgust, 37 kun-do'kon): u Billz raqamini
// ko'chirib yozar ekan — servis 19 kundan 18 tasida tiyinigacha teng
// (07-avgustda 10 $ terish xatosi), naqd/payme ham. Ya'ni qo'l mehnati
// ma'lumot QO'SHMAY, faqat kechikish qo'shardi: 20-avgustdan 26-igacha
// hech kim yozmagani uchun kassa kirimi, inkassatsiya bonusi va hamyon
// balansi yetti kun bo'sh turdi (Namangan 12 218.51 $ · Optim
// 15 470.96 $).
//
// MONTAJ NAQDDAN AYRILADI. Menejer shunday yozardi (731 → 700 naqd +
// 31 servis), Billz esa montajni oddiy naqd sotuv qilib yuboradi.
// Ayirilmasa "Jami tushum" aynan servis summasicha ikki marta sanaladi.
// O'lchandi: 238 ta montajli kun-do'kondan BIRORTASIDA ham montaj
// o'sha kunlik naqddan katta emas (eng kam qoldiq 69.91 $), ya'ni
// ayirish naqdni manfiyga tushirmaydi. Tushirsa — `moslik.js` dagi
// `kpi-tushum` va auditdagi "hamyon manfiy emas" darrov qizaradi.
//
// Qaytadi: { [storeId]: { "YYYY-MM-DD": { cash, payme, service } } }
const kirimKesh = new Map();

export function kunlikKirim(from, to) {
  const a = ymd(from), b = ymd(to);
  // Kesh kaliti ma'lumot versiyasi bilan birga — qatorlar almashsa
  // (Billz sinxroni, realtime) eski natija o'zi yaroqsiz bo'ladi.
  const kalit = `${a}|${b}|${dataVersion()}`;
  const bor = kirimKesh.get(kalit);
  if (bor) return bor;

  const hamyon = kunlarBazadan(a, b);
  const montaj = jonliServisKirim(a, b).byDay ?? {};

  const out = {};
  for (const store of new Set([...Object.keys(hamyon), ...Object.keys(montaj)])) {
    const kunlar = {};
    const sanalar = new Set([
      ...Object.keys(hamyon[store] ?? {}),
      ...Object.keys(montaj[store] ?? {}),
    ]);
    for (const day of sanalar) {
      const w = hamyon[store]?.[day] ?? { cash: 0, payme: 0 };
      const sv = +(montaj[store]?.[day] ?? 0);
      kunlar[day] = {
        cash: +(w.cash - sv).toFixed(2),
        payme: +w.payme.toFixed(2),
        service: +sv.toFixed(2),
      };
    }
    out[store] = kunlar;
  }

  // Kesh cheksiz o'smasin: davr tanlagichi har bosilganda yangi kalit
  // beradi, versiya esa har sinxronda o'zgaradi.
  if (kirimKesh.size > 60) kirimKesh.clear();
  kirimKesh.set(kalit, out);
  return out;
}

// Bitta do'konning kunlik kirimi — yuqoridagining kesimi.
export const kunlikKirimStore = (store, from, to) =>
  kunlikKirim(from, to)[store] ?? {};

// Davr bo'yicha do'kon yig'indisi: { [storeId]: { cash, payme, service } }
// `kassaData.kpiIncome()` shundan o'qiydi — kunlar yig'indisi umumiy
// raqamga hech qachon qarama-qarshi bo'lmasin.
export function kirimYigindisi(from, to) {
  const kunlar = kunlikKirim(from, to);
  const out = {};
  for (const [store, days] of Object.entries(kunlar)) {
    const k = { cash: 0, payme: 0, service: 0 };
    for (const d of Object.values(days)) {
      k.cash += d.cash; k.payme += d.payme; k.service += d.service;
    }
    out[store] = {
      cash: +k.cash.toFixed(2),
      payme: +k.payme.toFixed(2),
      service: +k.service.toFixed(2),
    };
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
