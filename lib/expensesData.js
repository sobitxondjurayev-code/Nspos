"use client";
// ══════════════════════════════════════════════════════════════
// XARAJATLAR MODULI
// ══════════════════════════════════════════════════════════════
// Billz'da xarajat yuritilmaydi — uning "Прибыли и убытки" hisoboti
// faqat tannarxni chegiradi, shuning uchun undagi "чистая прибыль"
// aslida YALPI foyda. Haqiqiy sof foyda shu moduldagi xarajatlar
// chegirilgandan keyin chiqadi.
//
// Ikki turdagi xarajat bor:
//   1. TAKRORLANUVCHI (recurring) — har oy bir xil: ijara, internet,
//      qo'riqlash, soliq. Bir marta kiritiladi, har oyga o'zi tarqaladi.
//   2. BIR MARTALIK (one-off) — sana bilan kiritiladi: ta'mirlash,
//      reklama kampaniyasi, transport.
//
// Do'kon biriktirish: xarajat "s1"/"s2"/"s3" ga tegishli bo'lishi yoki
// "all" (umumkorxona) bo'lishi mumkin. "all" xarajatlar hisobotlarda
// do'konlarga TUSHUM nisbatida taqsimlanadi — ko'p sotgan do'kon
// ko'proq umumiy xarajat ko'taradi.
import { demoStores } from "./demoData";
import { storeTotalsInRange } from "./salesData";
import { registerModule, insert, update as dbUpdate, remove as dbRemove, xotiraYangilandi } from "./db";
import { syncTable } from "./sync";
import { getUser } from "./auth";
import { getUsdRate, sozlama } from "./companyData";
import { oyKursi } from "./ratesData";
import { storeByCode } from "./storesData";
import { listAllDays } from "./kpiData";
import { listStaff } from "./staffData";
import { jonliServisKirim } from "./serviceIncome";

// —— Kategoriyalar ————————————————————————————————————
// group: "fixed" — hajmga bog'liq emas (ijara har oy bir xil)
//        "variable" — savdo hajmiga qarab o'zgaradi
// NScamera'ning haqiqiy xarajatlari (rahbar bergan ro'yxat).
//   fixed    — har oy deyarli bir xil (ijara, internet, kommunal)
//   variable — hajmga qarab o'zgaradi (yo'lkira, ovqat, paket)
// Hisobotda shu ikki guruh alohida ko'rsatiladi: doimiy xarajat
// savdo tushsa ham kamaymaydi, o'zgaruvchani esa boshqariladi.
//
// ── 2026-09-03: RO'YXAT ENDI BAZADAN (`expense_categories`) ──
// Rahbar Sozlamalardan qo'shadi/nomini o'zgartiradi/yashiradi. Quyidagi
// STANDART ro'yxat — seed va zaxira (jadval bo'sh yoki yuklanmagan
// bo'lsa). `EXPENSE_CATEGORIES` obyektining O'RNI ALMASHTIRILMAYDI —
// uni 6 modul import qilgan (`Object.keys`, `[k]?.label`); jadval
// kelganda ichi qayta to'ldiriladi (`demoCategories` naqshi).
const STANDART_CATEGORIES = {
  // —— Doimiy ————————————————————————————
  rent_store: { label: "Do'kon ijarasi", group: "fixed" },
  rent_warehouse: { label: "Ombor ijarasi", group: "fixed" },
  internet: { label: "Internet", group: "fixed" },
  electricity: { label: "Elektr energiya", group: "fixed" },
  water: { label: "Suv tarmog'i", group: "fixed" },
  tax: { label: "Soliq", group: "fixed" },
  // Oylik — savdo bo'lmasa ham to'lanadi, shuning uchun doimiy xarajat.
  // Ish haqi bo'limidan to'langan maosh kassa yozuvi bo'lib tushadi;
  // bu yerdagi tur esa qo'lda kiritilganlari uchun. Ikkalasi ham Pul
  // rejasidagi "Oylik maoshlar" ustuniga boradi (kassaData.fillDays).
  salary: { label: "Oylik", group: "fixed" },

  // —— O'zgaruvchan ————————————————————————
  // `staff_travel` — XODIM qatnovi (uyiga, ishga). Tovarga aloqasi
  // yo'q, shuning uchun tannarxga KIRMAYDI.
  staff_travel: { label: "Xodimlarga yo'lkira", group: "variable" },
  // —— Tovar kelish xarajati (cogs: true) ————————————
  // Bu ikkisi OPEX emas: tovarning o'z narxi. Mahsulot 25 $ ga
  // olinadi, kelib qo'yilganda 30 $ turadi — shuning uchun P&L da
  // tannarx ostida alohida qator bo'lib turadi va yalpi marja
  // haqiqiy chiqadi. Sof foydaga ta'siri o'zgarmaydi (2026-09-05).
  import_freight: { label: "Import yo'lkira (chegara, Xitoy)", group: "variable", cogs: true, noteRequired: true },
  delivery: { label: "Dastavka — tovar kelishi (yo'lkira)", group: "variable", cogs: true },
  lunch: { label: "Tushlik", group: "variable" },
  dinner: { label: "Kechki ovqat", group: "variable" },
  packaging: { label: "Paket", group: "variable" },
  drinking_water: { label: "Filter suv", group: "variable" },
  air_freshener: { label: "Atir", group: "variable" },
  cleaning: { label: "Tozalik", group: "variable" },

  // —— Servisga tegishli ————————————————————
  // service: true — "Servis foydasi" hisobotida ustalar oyligi bilan
  // birga xizmat tannarxiga qo'shiladi. Umumiy P&L da esa oddiy
  // xarajat sifatida bir marta hisoblanadi (ikki marta sanalmaydi).
  svc_fuel: { label: "Mashina gazi", group: "variable", service: true },
  svc_oil: { label: "Avtol va moy", group: "variable", service: true },
  // Shurup va samarez alohida turgandi — rahbar ularni ajratib
  // yuritishni ortiqcha deb topdi, ikkalasi bitta "Mayda-chuda"ga
  // birlashtirildi.
  svc_misc: { label: "Mayda-chuda", group: "variable", service: true },
  svc_material: { label: "Boshqa o'rnatish materiali", group: "variable", service: true },
  // Ko'chadan yollangan usta. Ikki tur — rahbar ikki holatni ajratdi
  // (2026-09-05): mijoz montaj puli to'lagan yoki montaj bepul
  // berilgan. Ikkalasi ham servis xarajati; ajratilgani "bepul
  // montajga qancha ketdi" degan savolga javob beradi.
  svc_installer: { label: "Ko'cha ustasi — o'rnatish (mijoz to'lagan)", group: "variable", service: true, noteRequired: true },
  svc_installer_free: { label: "Ko'cha ustasi — o'rnatish (bepul montaj)", group: "variable", service: true, noteRequired: true },

  other: { label: "Boshqa xarajatlar", group: "variable", noteRequired: true },
};
export const EXPENSE_CATEGORIES = { ...STANDART_CATEGORIES };

// ══════════════════════════════════════════════════════════════
// XARAJAT TURLARI — BAZA (`expense_categories`)
// ══════════════════════════════════════════════════════════════
// Qator: { id, key, label, group, service, noteRequired, sort, isActive }.
// Faol → EXPENSE_CATEGORIES (tanlanadi); nofaol → LEGACY_CATEGORIES
// (tanlanmaydi, eski xarajatlarda nomi ko'rinadi). Ikkalasi ham
// JONLI obyekt: jadval kelganda yoki rahbar o'zgartirganda ichi
// qayta to'ldiriladi, importlar o'sha obyektga qarab turadi.
let kategoriyalar = [];

function turlarniQoy(list) {
  kategoriyalar = [...list].sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
  for (const k of Object.keys(EXPENSE_CATEGORIES)) delete EXPENSE_CATEGORIES[k];
  for (const k of Object.keys(LEGACY_CATEGORIES)) delete LEGACY_CATEGORIES[k];
  const manba = kategoriyalar.length ? kategoriyalar : Object.entries(STANDART_CATEGORIES)
    .map(([key, c], i) => ({ key, ...c, noteRequired: !!c.noteRequired, sort: (i + 1) * 10, isActive: true }));
  for (const c of manba) {
    if (c.isActive) EXPENSE_CATEGORIES[c.key] = { label: c.label, group: c.group, service: !!c.service, cogs: !!c.cogs, noteRequired: !!c.noteRequired };
    else LEGACY_CATEGORIES[c.key] = c.label;
  }
  if (!kategoriyalar.length) Object.assign(LEGACY_CATEGORIES, STANDART_LEGACY);
  SERVICE_CATEGORIES.length = 0;
  SERVICE_CATEGORIES.push(
    ...Object.entries(EXPENSE_CATEGORIES).filter(([, c]) => c.service).map(([k]) => k),
    ...manba.filter((c) => !c.isActive && c.service).map((c) => c.key),
    ...(kategoriyalar.length ? [] : Object.keys(STANDART_LEGACY)),
  );
  // Nofaol tur ham qo'shiladi: eski yozuv o'sha kalitda turadi va
  // uning MA'NOSI (tannarxmi yoki OPEX) o'zgarmasligi kerak — aks
  // holda tur yashirilgan zahoti o'tgan oylarning marjasi sakraydi.
  TANNARX_CATEGORIES.length = 0;
  TANNARX_CATEGORIES.push(
    ...Object.entries(EXPENSE_CATEGORIES).filter(([, c]) => c.cogs).map(([k]) => k),
    ...manba.filter((c) => !c.isActive && c.cogs).map((c) => c.key),
  );
}

const turSync = syncTable("expense_categories", {
  table: "expense_categories",
  // `cogs` shu ro'yxatda BO'LISHI SHART: `scripts/lib/yuk.mjs` aynan
  // shu ustunlar bo'yicha o'qiydi. Tushib qolsa skript bayroqni doim
  // `false` deb ko'radi va tekshiruv jimgina "hammasi joyida" deydi.
  select: "id,key,label,\"group\",service,cogs,note_required,sort,is_active,updated_at",
  realtime: true,
  get: () => kategoriyalar,
  set: (v) => turlarniQoy(v),
  fromRow: (r) => ({
    id: r.id, key: r.key, label: r.label, group: r.group ?? "variable",
    service: !!r.service, cogs: !!r.cogs, noteRequired: !!r.note_required,
    sort: Number(r.sort ?? 100), isActive: r.is_active !== false,
  }),
  toRow: (c) => ({
    key: c.key, label: c.label, group: c.group ?? "variable",
    service: !!c.service, cogs: !!c.cogs, note_required: !!c.noteRequired,
    sort: Number(c.sort ?? 100), is_active: c.isActive !== false,
    updated_at: new Date().toISOString(),
  }),
});

// Rahbar uchun to'liq ro'yxat (faol + nofaol), tartib bilan
export const listExpenseCategories = () => [...kategoriyalar];
export const categoryOf = (key) => kategoriyalar.find((c) => c.key === key) ?? null;
// Tur nechta xarajatda ishlatilgan — o'chirish/yashirish qaroriga
export const categoryUsage = (key) =>
  oneOff.filter((e) => e.category === key).length + recurring.filter((r) => r.category === key).length;

// Nomdan kalit: "Ofis ijarasi" → "ofis_ijarasi"; band bo'lsa raqam
function slug(label) {
  const s = String(label).toLowerCase()
    .replace(/['ʻ’`]/g, "").replace(/[^a-z0-9а-яё]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "tur";
  let k = s, n = 2;
  while (kategoriyalar.some((c) => c.key === k) || STANDART_CATEGORIES[k]) k = `${s}_${n++}`;
  return k;
}

export function addExpenseCategory({ label, group = "variable", service = false, cogs = false, noteRequired = false }) {
  const nom = String(label ?? "").trim();
  if (!nom) return null;
  // `service` va `cogs` bir vaqtda bo'la olmaydi (baza cheklovi ham
  // shuni aytadi): servis turi "Servis foydasi"da tannarxga qo'shiladi,
  // `cogs` esa P&L tannarxiga — bir pul ikki marta sanalardi.
  const c = {
    id: "ec-" + Date.now(), key: slug(nom), label: nom, group,
    service: !!service, cogs: !service && !!cogs,
    noteRequired: !!noteRequired, sort: (kategoriyalar.at(-1)?.sort ?? 0) + 10, isActive: true,
  };
  turlarniQoy([...kategoriyalar, c]);
  turSync.created(c);
  return c;
}
export function updateExpenseCategory(key, patch) {
  const cur = categoryOf(key);
  if (!cur) return null;
  const next = { ...cur, ...patch, key };
  // Ikkalasi yoqilgan holat bazaga umuman bormasin: oxirgi tanlov g'olib
  if (next.service && next.cogs) {
    if (patch.service) next.cogs = false;
    else next.service = false;
  }
  turlarniQoy(kategoriyalar.map((c) => (c.key === key ? next : c)));
  turSync.changed(next);
  return next;
}
export const setExpenseCategoryActive = (key, active) => updateExpenseCategory(key, { isActive: !!active });
// O'chirish: ishlatilgan bo'lsa YASHIRILADI (tarix nomi bilan qoladi),
// ishlatilmagan bo'lsa o'chadi (baza siyosati ham shuni qo'riqlaydi)
export function removeExpenseCategory(key) {
  const cur = categoryOf(key);
  if (!cur) return { ok: false };
  if (categoryUsage(key) > 0) { setExpenseCategoryActive(key, false); return { ok: true, yashirildi: true }; }
  turlarniQoy(kategoriyalar.filter((c) => c.key !== key));
  turSync.deleted(cur.id);
  return { ok: true, ochirildi: true };
}

// —— Xodim bo'lmagan oluvchilar ————————————————————
// Ko'chadan chaqirilgan usta tizimda ro'yxatda yo'q, lekin unga
// to'langan pul ham kimgadir tegishli. Shunday hollarda `staffId`
// bo'sh qoladi, ism esa `paidTo` da matn bo'lib saqlanadi.
export const STREET_INSTALLER = "Ko'cha usta";

// —— Eskirgan turlar ————————————————————————————
// Endi tanlanmaydi, lekin ilgari shu bilan kiritilgan yozuvlar
// hisobotda kalit emas, o'z nomi bilan ko'rinishi kerak.
const STANDART_LEGACY = {
  svc_screws: "Shurup",
  svc_dowel: "Samarez",
};
const LEGACY_CATEGORIES = { ...STANDART_LEGACY };

// Xarajat kimga tegishli — ismi. Xodim bo'lsa uning ismi tashqarida
// qo'shiladi (getStaff), bo'lmasa shu yerdagi matn.
export const paidToLabel = (e) => e.paidTo || null;

// —— Ko'rinish uchun turlar ————————————————————————
// Rahbarga o'tkazma xarajat EMAS (pul kompaniyada qoladi) va bu yerdan
// tanlanmaydi ham — lekin Xarajatlar ro'yxatida ko'rinadi (rahbar
// qoidasi, 2026-08-15). Nomi shu yerdan olinadi.
const VIRTUAL_CATEGORIES = { owner_transfer: "Rahbarga o'tkazma" };

export const categoryLabel = (k) =>
  EXPENSE_CATEGORIES[k]?.label ?? LEGACY_CATEGORIES[k] ?? VIRTUAL_CATEGORIES[k] ?? k;

// Servis tannarxiga kiradigan kategoriyalar (eskilari ham — ular
// ham o'sha paytda servis pulidan chiqqan)
// JONLI massiv — `turlarniQoy` to'ldiradi (o'rni almashmaydi)
export const SERVICE_CATEGORIES = [
  ...Object.entries(EXPENSE_CATEGORIES).filter(([, c]) => c.service).map(([k]) => k),
  ...Object.keys(LEGACY_CATEGORIES),
];

// —— Tovar kelish xarajati (tannarxga kiradigan turlar) ————
// Menejerlar so'rovi (2026-09-05): "tovar keldi — yo'lkira, dostavka"
// oddiy xarajat bo'lib turmasin, TANNARXGA qo'shilsin. Mahsulot 25 $
// ga olinadi, kelib qo'yilganda 30 $ turadi — ya'ni bu pul ijara kabi
// umumiy xarajat emas, o'sha tovarning narxi.
//
// P&L da: OPEX dan chiqadi, tannarx ostida alohida qator bo'ladi.
// Sof foyda O'ZGARMAYDI (pul bir qatordan ikkinchisiga ko'chadi),
// yalpi marja esa haqiqiy bo'ladi. SERVICE_CATEGORIES kabi JONLI
// massiv — `turlarniQoy` to'ldiradi, o'rni almashtirilmaydi.
export const TANNARX_CATEGORIES = [
  ...Object.entries(EXPENSE_CATEGORIES).filter(([, c]) => c.cogs).map(([k]) => k),
];

export const tannarxgaMi = (key) => TANNARX_CATEGORIES.includes(key);

// —— "Boshqa" turlari ————————————————————————————
// Nomi hech narsa aytmaydigan turlar: xarajatlarda "Boshqa xarajatlar"
// (jadvalda `note_required`), kassada "Boshqa kirim/chiqim"
// (kassaData.KASSA_CATEGORIES). Bularda izoh majburiy — aks holda
// hisobotda kimga, nimaga ketgani noma'lum summa qolib ketadi.
const NOTE_REQUIRED_KASSA = ["other_in", "other_out"];
export const needsNote = (category) =>
  !!EXPENSE_CATEGORIES[category]?.noteRequired || NOTE_REQUIRED_KASSA.includes(category);

// —— Hamyonlar ————————————————————————————————————
// Xarajat qaysi PUL TURIDAN to'langani (kassaData.WALLETS bilan bir xil):
//   cash    — naqd
//   payme   — Payme hisobi (barcha kartalar)
//   service — servis puli
// Qaysi KASSADAN (b2b / b2c / kompaniya) chiqqani `kassa` maydonida
// turadi — ikkalasi birga "b2c kassaning naqd hamyoni" degani.
export const EXPENSE_METHODS = {
  cash: "Naqd",
  payme: "Payme",
  service: "Servis",
};

// Eskirgan kassalar — endi tanlanmaydi, lekin ilgari shu bilan kiritilgan
// xarajatlar hisobotda kalit emas, nomi bilan ko'rinishi uchun saqlanadi.
const LEGACY_METHODS = {
  card: "Plastik",
  bank: "Bank o'tkazmasi",
};

export const methodLabel = (k) => EXPENSE_METHODS[k] ?? LEGACY_METHODS[k] ?? k;

// ══════════════════════════════════════════════════════════════
// MA'LUMOT KIRITISH JOYI
// ══════════════════════════════════════════════════════════════
// Haqiqiy raqamlar shu ikki massivga yoziladi. Interfeysdan qo'shilgani
// ham shu tuzilmaga tushadi.
//
// Takrorlanuvchi: { category, storeId, amount, method, day, from, to, note }
//   from/to — "YYYY-MM" formatida. to: null → hozirgacha davom etadi.
//   day     — oyning nechanchi kunida to'lanadi (hisobot sanasi uchun).
// Misol:
//   { id: "r1", category: "rent_store", storeId: "s1", amount: 1200,
//     method: "cash", day: 5, from: "2026-01", to: null, note: "Optim do'koni" },
let recurring = [];

// Bir martalik: { date: "YYYY-MM-DD", category, storeId, amount, method, note }
let oneOff = [];

let seq = 1;
const nextId = (p) => p + "-" + (seq++) + "-" + Date.now().toString(36);

// ══════════════════════════════════════════════════════════════
// BAZA BILAN BOG'LANISH
// ══════════════════════════════════════════════════════════════
// Bitta `expenses` jadvali ikkala turni ham saqlaydi: is_recurring
// bayrog'i ularni ajratadi (schema.sql, 11-bo'lim).
//
// Bu blok qolgan 14 modul uchun NAMUNA: registerModule bilan qayd
// qilinadi, mutatsiya funksiyalari avval xotirani yangilaydi, keyin
// fonda bazaga yozadi. Demo rejimda yozish shunchaki o'tkazib
// yuboriladi — interfeys ikkalasida ham bir xil ishlaydi.
const TABLE = "expenses";

const toRow = (e) => ({
  id: e.id.startsWith("rec-") || e.id.startsWith("exp-") ? undefined : e.id,
  store_id: e.storeId === "all" ? null : e.storeId,
  category: e.category,
  amount: e.amount,
  method: e.method,
  kassa: e.kassa || "company",
  // Xarajat qaysi ustaga tegishli (mashina gazi, shurup, samarez…).
  // Umumiy xarajatlarda bo'sh — vaqtinchalik id bazaga yuborilmaydi.
  staff_id: e.staffId && /^[0-9a-f-]{36}$/.test(e.staffId) ? e.staffId : null,
  // Xodim bo'lmagan oluvchi (masalan ko'cha usta) — ismi matn bilan
  paid_to: e.paidTo || null,
  note: e.note || null,
  // Kiritilgan so'm va o'sha paytdagi kurs — asosiy qiymat baribir
  // dollar (amount), bular faqat tahrirlashda aynan kiritilgan
  // raqamni qaytarish uchun. Eski qatorlarda bo'sh bo'ladi.
  amount_som: e.amountSom ?? null,
  rate_used: e.rateUsed ?? null,
  is_recurring: !!e.from,
  spent_on: e.from ? null : e.date,
  day_of_month: e.from ? e.day : null,
  active_from: e.from ? e.from + "-01" : null,
  active_to: e.to ? e.to + "-01" : null,
});

const fromRow = (r) =>
  r.is_recurring
    ? {
        id: r.id, category: r.category, storeId: r.store_id ?? "all",
        amount: Number(r.amount), method: r.method, kassa: r.kassa ?? "company",
        staffId: r.staff_id ?? null,
        paidTo: r.paid_to ?? null,
        amountSom: r.amount_som == null ? null : Number(r.amount_som),
        rateUsed: r.rate_used == null ? null : Number(r.rate_used),
        createdBy: r.created_by ?? null,
        note: r.note ?? "",
        day: r.day_of_month, from: String(r.active_from).slice(0, 7),
        to: r.active_to ? String(r.active_to).slice(0, 7) : null,
        active: true,
      }
    : {
        id: r.id, date: String(r.spent_on).slice(0, 10),
        category: r.category, storeId: r.store_id ?? "all",
        amount: Number(r.amount), method: r.method, kassa: r.kassa ?? "company",
        staffId: r.staff_id ?? null,
        paidTo: r.paid_to ?? null,
        amountSom: r.amount_som == null ? null : Number(r.amount_som),
        rateUsed: r.rate_used == null ? null : Number(r.rate_used),
        createdBy: r.created_by ?? null,
        note: r.note ?? "",
        source: "manual",
      };

// ── BAZA RAD ETSA XOTIRA ORQAGA QAYTADI (2026-09-03) ──
// Baza tasdiqlagan oxirgi holat. Menejer kechagi xarajatni o'chirsa
// RLS rad etadi (faqat bugungisi) — ilgari qator ekrandan yo'qolib,
// F5 da qaytib kelardi, toast ham yo'q edi (`remove` 0 qatorga "ok"
// derdi). Endi rad bo'lsa qator joyiga qaytadi va sabab aytiladi.
const tasdiq = new Map();
const rad = (r) => r && !r.ok;
function orqaga(id) {
  const t = tasdiq.get(id);
  recurring = recurring.filter((x) => x.id !== id);
  oneOff = oneOff.filter((x) => x.id !== id);
  if (t?.from) recurring = [...recurring, t];
  else if (t) oneOff = [...oneOff, t].sort((a, b) => (a.date < b.date ? 1 : -1));
  xotiraYangilandi();
}

registerModule("expenses", {
  table: TABLE,
  fromRow,
  realtime: true,
  restore(rows) {
    recurring = rows.filter((r) => r.from);
    oneOff = rows.filter((r) => !r.from);
    for (const r of rows) tasdiq.set(r.id, r);
  },
  // Boshqa xodim xarajat qo'shsa/o'chirsa xotirani moslaymiz
  apply({ eventType, new: row, old }) {
    if (eventType === "DELETE") {
      recurring = recurring.filter((r) => r.id !== old.id);
      oneOff = oneOff.filter((e) => e.id !== old.id);
      tasdiq.delete(old.id);
      return;
    }
    const item = fromRow(row);
    tasdiq.set(item.id, item);
    const list = item.from ? "rec" : "one";
    const put = (arr) => [...arr.filter((x) => x.id !== item.id), item];
    if (list === "rec") recurring = put(recurring);
    else oneOff = put(oneOff).sort((a, b) => (a.date < b.date ? 1 : -1));
  },
});

// ── Kim qaysi xarajatni o'chira/tuzata oladi — RLS KO'ZGUSI ──
// Bazadagi `expense_update`/`expense_delete` siyosati bilan BIR XIL:
// rahbar — hammasini; menejer — faqat o'z kassasidagi, BUGUNGI
// (Toshkent vaqti), bir martalik xarajatni. Doimiy qoida (`spent_on`
// NULL) menejer uchun hech qachon "bugun" bo'lmaydi. Tugma shu shart
// bilan chiqadi — aks holda bosilib, rad bo'lib, "ishlamayapti" deyiladi.
export const bugunToshkent = () =>
  new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
export function canTouchExpense(e, user = getUser()) {
  if (!e || !user) return false;
  if (e.source === "installer" || e.source === "transfer") return false;
  if (user.role === "owner") return true;
  if (user.role !== "manager") return false;
  if (e.from || e.source === "recurring") return false;
  if (!user.storeId || String(e.kassa) !== String(user.storeId)) return false;
  return String(e.date).slice(0, 10) === bugunToshkent();
}

// —— Takrorlanuvchi xarajatlar ————————————————————————
export const listRecurring = () => [...recurring];

export function addRecurring({ category, storeId = "all", amount, amountSom = null, rateUsed = null, method = "cash", kassa = "company", staffId = null, paidTo = null, day = 1, from, to = null, note = "" }) {
  const r = {
    id: nextId("rec"), category, storeId,
    amount: +Number(amount).toFixed(2), amountSom, rateUsed,
    method, kassa, staffId, paidTo, day: Math.min(28, Math.max(1, Number(day) || 1)),
    from, to, note, active: true, createdBy: getUser()?.id ?? null,
  };
  recurring = [...recurring, r];
  // Xotira yangilandi, endi fonda bazaga yozamiz. Baza id qaytarsa
  // vaqtinchalik id o'sha id bilan almashtiriladi; rad etsa — olib tashlanadi.
  insert(TABLE, toRow(r), "xarajat qo'shish").then((res) => {
    if (res?.data) {
      recurring = recurring.map((x) => (x.id === r.id ? { ...x, id: res.data.id } : x));
      tasdiq.set(res.data.id, { ...r, id: res.data.id });
    } else if (rad(res)) orqaga(r.id);
  });
  return r;
}

export function updateRecurring(id, patch) {
  recurring = recurring.map((r) => (r.id === id ? { ...r, ...patch } : r));
  const next = recurring.find((r) => r.id === id) ?? null;
  if (next) dbUpdate(TABLE, id, toRow(next), "xarajatni yangilash").then((res) => {
    if (res?.ok) tasdiq.set(id, next); else if (rad(res)) orqaga(id);
  });
  return next;
}

export function removeRecurring(id) {
  recurring = recurring.filter((r) => r.id !== id);
  dbRemove(TABLE, id, "xarajatni o'chirish").then((res) => {
    if (res?.ok) tasdiq.delete(id); else if (rad(res)) orqaga(id);
  });
}

// —— Bir martalik xarajatlar ————————————————————————
export const listOneOff = () => [...oneOff].sort((a, b) => (a.date < b.date ? 1 : -1));

export function addExpense({ date, category, storeId = "all", amount, amountSom = null, rateUsed = null, method = "cash", kassa = "company", staffId = null, paidTo = null, note = "" }) {
  const e = {
    id: nextId("exp"), date: String(date).slice(0, 10),
    category, storeId,
    amount: +Number(amount).toFixed(2), amountSom, rateUsed,
    method, kassa, staffId, paidTo, note, source: "manual",
    // Kim kiritgani so'ralmaydi — kirgan hisobdan olinadi. Bazada ham
    // shu: created_by ustuni auth.uid() bilan o'zi to'ladi, shuning
    // uchun toRow() uni yubormaydi (brauzerdan o'zgartirib bo'lmasin).
    createdBy: getUser()?.id ?? null,
  };
  oneOff = [e, ...oneOff];
  insert(TABLE, toRow(e), "xarajat qo'shish").then((res) => {
    if (res?.data) {
      oneOff = oneOff.map((x) => (x.id === e.id ? { ...x, id: res.data.id } : x));
      tasdiq.set(res.data.id, { ...e, id: res.data.id });
    } else if (rad(res)) orqaga(e.id);
  });
  return e;
}

export function updateExpense(id, patch) {
  oneOff = oneOff.map((e) => (e.id === id ? { ...e, ...patch } : e));
  const next = oneOff.find((e) => e.id === id) ?? null;
  if (next) dbUpdate(TABLE, id, toRow(next), "xarajatni yangilash").then((res) => {
    if (res?.ok) tasdiq.set(id, next); else if (rad(res)) orqaga(id);
  });
  return next;
}

export function removeExpense(id) {
  oneOff = oneOff.filter((e) => e.id !== id);
  dbRemove(TABLE, id, "xarajatni o'chirish").then((res) => {
    if (res?.ok) tasdiq.delete(id); else if (rad(res)) orqaga(id);
  });
}

// —— Takrorlanuvchini kunlik yozuvlarga yoyish ————————————
// "Har oy 1200$ ijara" → har oy uchun bitta yozuv. Shunda oraliq
// bo'yicha filtr, kategoriya kesimi va grafik bir xil ishlaydi.
const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

function materialize(from, to) {
  const a = new Date(from), b = new Date(to);
  const out = [];
  for (const r of recurring) {
    if (r.active === false) continue;
    // Oraliqdagi har oyni aylanib chiqamiz
    const cursor = new Date(a.getFullYear(), a.getMonth(), 1);
    while (cursor <= b) {
      const key = ym(cursor);
      const started = !r.from || key >= r.from;
      const notEnded = !r.to || key <= r.to;
      if (started && notEnded) {
        const d = new Date(cursor.getFullYear(), cursor.getMonth(), r.day);
        // Oy oxirgi kunidan oshib ketmasin
        if (d.getMonth() !== cursor.getMonth()) d.setDate(0);
        if (d >= a && d <= b) {
          out.push({
            id: r.id + "@" + key,
            date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
            category: r.category, storeId: r.storeId, amount: r.amount,
            // Qoidada kiritilgan so'm va kurs har oylik nusxaga ham
            // o'tadi — aks holda har oy dollardan qaytarib hisoblanardi
            amountSom: r.amountSom ?? null, rateUsed: r.rateUsed ?? null,
            method: r.method, kassa: r.kassa || "company",
            staffId: r.staffId ?? null,
            paidTo: r.paidTo ?? null,
            // Qoidani kim kiritgan bo'lsa, undan yoyilgan qatorlar ham
            // o'shanikidir — har oyni alohida kimdir yozmaydi
            createdBy: r.createdBy ?? null,
            note: r.note, source: "recurring", recurringId: r.id,
          });
        }
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }
  return out;
}

// —— Ustalar olgan puli ham xarajat ————————————————
// Usta pulni KPI jadvalidan (ustalar reytingi) oladi, Xarajatlar
// bo'limiga alohida yozilmaydi. Lekin bu ham OYLIK va pul servis
// kassasidan chiqadi — shuning uchun shu yerda virtual yozuv bo'lib
// qo'shiladi. Shunda hamma hisobot (Xarajatlar, kassa balansi, Pul
// rejasi, P&L) bitta manbadan o'qiydi va raqamlar bir-biriga to'g'ri
// keladi. Bu yozuvlar tahrirlanmaydi — ular KPI jadvalida yuritiladi.
// Servis puli qaysi do'kon kassasida yuritilsa, usta ham o'sha
// kassadan olgan hisoblanadi. Ustalarga do'kon biriktirilmagan
// (hozir hammasida shunday), shuning uchun kunlik jadvalda servis
// kirimi bor do'kon olinadi — aks holda pul kompaniya kassasidan
// chiqqan bo'lib, servis kirimi bir kassada, chiqimi boshqasida
// qolardi (2026-08-13).
function serviceStore() {
  // 2026-08-26 dan: servis kirimi Billz cheklaridagi montaj
  // qatorlaridan keladi, ya'ni do'kon TO'G'RIDAN-TO'G'RI ma'lum —
  // ilgari uni menejerning kunlik jadvalidan qidirish kerak edi.
  const byStore = jonliServisKirim().byStore ?? {};
  for (const [store, sum] of Object.entries(byStore)) if (sum > 0) return store;
  return null;
}

// Usta puli QAYSI servis hamyonidan chiqadi.
//
// Do'konning servis kassasi har kuni NOL qilib topshiriladi — pul
// `kassa_ops` transfer'i bilan kompaniya balansiga ko'chadi
// (`kassaData.kassaBalances`: approved transfer → `out[COMPANY]`).
// Ya'ni usta puli do'kon hamyonidan yozilsa, o'sha hamyon minusga
// tushadi va menejer yangi xarajat kirita olmay qoladi ("kassa
// minusda" deb rad etiladi) — rahbar fidbegi, 2026-09-03.
//
// O'lchandi (01.08 dan): servis kirimi 10 165.50 $ Namanganda,
// topshirilgani 7 082.76 $, usta puli 5 367.53 $. Do'kon hamyoni
// −2 284.79 $ edi; puli topshirilgan joydan yozilsa do'kon +3 082.74 $,
// kompaniya +1 715.23 $ — ikkalasi ham musbat, minus ko'chmaydi.
//
// FAQAT HAMYON o'zgaradi. `storeId` o'z joyida qoladi, ya'ni do'kon
// kesimi (`expensesByStore`) va "Oylik maoshlar" ustuni (DAFTAR 68:
// `category === "salary" && method === "service"` → `r.salary`) avvalgidek.
//
// Sozlamadan: "company" (standart) yoki do'kon KODI ("s1") — nom bilan
// emas (CLAUDE.md 2026-09-03).
function ustaKassaId() {
  const v = sozlama("kpi.ustaKassa", "company");
  if (!v || v === "company") return "company";
  return storeByCode(v)?.id ?? "company";
}

function installerPayouts(inR) {
  const rate = getUsdRate();
  if (!rate) return [];
  const byId = new Map(listStaff().map((s) => [s.id, s]));
  const svcStore = serviceStore();
  const ustaKassa = ustaKassaId();
  const ustalar = new Map(
    listStaff().filter((s) => s.role === "installer").map((s) => [s.id, s]));
  const out = [];
  for (const d of listAllDays()) {
    const st = ustalar.get(d.staffId);
    if (!st || !d.olgan || !inR(d.date)) continue;
    const som = Number(d.olgan) || 0;
    // KURS — kiritilgan kundagi (`olganKurs`, 2026-09-04 dan yoziladi),
    // bo'lmasa o'sha OYNING kursi (`ratesData.oyKursi`). Bugungi kurs
    // emas: avgustda berilgan pul kurs o'zgarganda o'zgarmasin (DAFTAR 20 G).
    const kurs = Number(d.olganKurs) > 0 ? Number(d.olganKurs)
      : (oyKursi(String(d.date).slice(0, 7)).rate || rate);
    const amount = +(som / kurs).toFixed(2);
    if (!(amount > 0)) continue;
    out.push({
      id: `usta:${d.staffId}:${d.date}`,
      date: d.date,
      category: "salary",
      storeId: st.storeId ?? svcStore ?? "all",
      amount, amountSom: som, rateUsed: kurs,
      // Usta puli servis kassasidan beriladi — pul topshirilgan
      // hamyondan (yuqoridagi `ustaKassaId` izohiga qarang)
      method: "service",
      kassa: ustaKassa,
      staffId: st.id, paidTo: null,
      note: "Usta olgan pul",
      createdBy: null,
      source: "installer",
    });
  }
  return out;
}

// —— Oraliq bo'yicha barcha xarajatlar ————————————————
export function expensesInRange(from, to) {
  const a = new Date(from).getTime(), b = new Date(to).getTime();
  const inR = (d) => {
    const t = new Date(d + "T12:00:00").getTime();
    return t >= a && t <= b;
  };
  return [...oneOff.filter((e) => inR(e.date)), ...materialize(from, to),
          ...installerPayouts(inR)]
    .sort((x, y) => (x.date < y.date ? 1 : -1));
}

export const totalExpenses = (from, to) =>
  +expensesInRange(from, to).reduce((s, e) => s + e.amount, 0).toFixed(2);

// —— So'm ————————————————————————————————————————
// Xarajat so'mda to'lanadi va so'mda kiritiladi, shuning uchun
// Xarajatlar bo'limi ham so'mda ko'rsatiladi. Bazadagi asosiy qiymat
// baribir dollar — P&L, balans va boshqa hisobotlar o'shanda yuriladi.
//
// Har qatorda kiritilgan so'm saqlanadi (amount_som), shu sababli
// yig'indilar aynan kiritilgan raqamlarning yig'indisi bo'ladi —
// dollardan qaytarib hisoblanmaydi va yaxlitlash farqi to'planmaydi.
// Eski yozuvlarda amount_som yo'q: ular bugungi kurs bilan o'giriladi.
export const somOf = (e) => {
  if (e.amountSom != null) return e.amountSom;
  // Kiritilgan so'm saqlanmagan eski yozuv: o'sha kundagi kurs bilan
  // o'giramiz. Bugungi kurs bilan o'girilsa, raqam har kuni o'zgarib
  // turardi — bo'lib o'tgan xarajat esa o'zgarmasligi kerak.
  const r = e.rateUsed ?? getUsdRate();
  return r ? e.amount * r : 0;
};

// —— Kategoriya kesimi ————————————————————————————
export function expensesByCategory(from, to) {
  const rows = expensesInRange(from, to);
  const map = new Map();
  for (const e of rows) {
    const cur = map.get(e.category) ?? { key: e.category, amount: 0, som: 0, count: 0, fixed: 0, variable: 0 };
    cur.amount += e.amount;
    cur.som += somOf(e);
    cur.count += 1;
    map.set(e.category, cur);
  }
  const total = rows.reduce((s, e) => s + e.amount, 0);
  return [...map.values()]
    .map((c) => ({
      ...c,
      amount: +c.amount.toFixed(2),
      som: Math.round(c.som),
      label: categoryLabel(c.key),
      group: EXPENSE_CATEGORIES[c.key]?.group ?? "variable",
      share: total > 0 ? +((c.amount / total) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

// —— Tovar kelish xarajati — YAGONA TA'RIF ————————————
// P&L, moslik tekshiruvi, API va o'lchov skripti SHU funksiyani
// chaqiradi. Hech kim `filter(cogs)` ni qayta yozmaydi — aks holda
// ekranda bir raqam, tekshiruvda boshqasi bo'lib qolardi
// (CLAUDE.md 2026-08-14: bir tushuncha — bitta funksiya).
export function kelishXarajati(from, to) {
  const rows = expensesInRange(from, to).filter((e) => tannarxgaMi(e.category));
  const map = new Map();
  let total = 0, som = 0;
  for (const e of rows) {
    total += e.amount;
    som += somOf(e);
    const cur = map.get(e.category) ?? { key: e.category, amount: 0, som: 0, count: 0 };
    cur.amount += e.amount;
    cur.som += somOf(e);
    cur.count += 1;
    map.set(e.category, cur);
  }
  return {
    total: +total.toFixed(2),
    som: Math.round(som),
    byCategory: [...map.values()]
      .map((c) => ({ ...c, amount: +c.amount.toFixed(2), som: Math.round(c.som), label: categoryLabel(c.key) }))
      .sort((a, b) => b.amount - a.amount),
  };
}

// —— Do'kon kesimi (umumiy xarajatlar tushumga qarab taqsimlanadi) ——
export function expensesByStore(from, to) {
  const rows = expensesInRange(from, to);
  const direct = Object.fromEntries(demoStores.map((s) => [s.id, 0]));
  const directSom = Object.fromEntries(demoStores.map((s) => [s.id, 0]));
  let shared = 0, sharedSom = 0;

  for (const e of rows) {
    if (e.storeId && direct[e.storeId] !== undefined) {
      direct[e.storeId] += e.amount;
      directSom[e.storeId] += somOf(e);
    } else {
      shared += e.amount;
      sharedSom += somOf(e);
    }
  }

  // Taqsimlash bazasi — davrdagi tushum
  const revenue = storeTotalsInRange(from, to);
  const revTotal = Object.values(revenue).reduce((a, v) => a + Math.max(0, v), 0);

  return demoStores.map((s) => {
    const share = revTotal > 0 ? Math.max(0, revenue[s.id]) / revTotal : 1 / demoStores.length;
    const allocated = +(shared * share).toFixed(2);
    const allocatedSom = Math.round(sharedSom * share);
    return {
      storeId: s.id, name: s.name,
      revenue: +(revenue[s.id] ?? 0).toFixed(2),
      direct: +direct[s.id].toFixed(2),
      allocated,
      total: +(direct[s.id] + allocated).toFixed(2),
      directSom: Math.round(directSom[s.id]),
      allocatedSom,
      totalSom: Math.round(directSom[s.id]) + allocatedSom,
      sharePct: +(share * 100).toFixed(1),
    };
  });
}

// —— Doimiy / o'zgaruvchan bo'linishi ————————————————
export function expenseStructure(from, to) {
  const rows = expensesInRange(from, to);
  let fixed = 0, variable = 0, fixedSom = 0, variableSom = 0;
  for (const e of rows) {
    if ((EXPENSE_CATEGORIES[e.category]?.group ?? "variable") === "fixed") {
      fixed += e.amount; fixedSom += somOf(e);
    } else {
      variable += e.amount; variableSom += somOf(e);
    }
  }
  const total = fixed + variable;
  return {
    fixed: +fixed.toFixed(2),
    variable: +variable.toFixed(2),
    total: +total.toFixed(2),
    fixedSom: Math.round(fixedSom),
    variableSom: Math.round(variableSom),
    totalSom: Math.round(fixedSom + variableSom),
    fixedPct: total > 0 ? +((fixed / total) * 100).toFixed(1) : 0,
  };
}

// —— Oylik grafik ————————————————————————————————
const MONTHS_SHORT = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"];

export function expenseSeries(from, to) {
  const rows = expensesInRange(from, to);
  const map = new Map();
  const cursor = new Date(new Date(from).getFullYear(), new Date(from).getMonth(), 1);
  const end = new Date(to);
  while (cursor <= end) {
    map.set(ym(cursor), {
      date: MONTHS_SHORT[cursor.getMonth()],
      fixed: 0, variable: 0, all: 0,
      fixedSom: 0, variableSom: 0, allSom: 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  for (const e of rows) {
    const row = map.get(e.date.slice(0, 7));
    if (!row) continue;
    const g = EXPENSE_CATEGORIES[e.category]?.group ?? "variable";
    row[g] = +(row[g] + e.amount).toFixed(2);
    row.all = +(row.all + e.amount).toFixed(2);
    row[g + "Som"] = Math.round(row[g + "Som"] + somOf(e));
    row.allSom = Math.round(row.allSom + somOf(e));
  }
  return [...map.values()];
}

// —— Oyiga o'rtacha doimiy xarajat (zararsizlik nuqtasi uchun) ————
const activeRecurring = () => {
  const key = ym(new Date());
  return recurring.filter((r) => r.active !== false && (!r.from || key >= r.from) && (!r.to || key <= r.to));
};

export function monthlyFixedRunRate() {
  return +activeRecurring().reduce((s, r) => s + r.amount, 0).toFixed(2);
}

export function monthlyFixedRunRateSom() {
  return Math.round(activeRecurring().reduce((s, r) => s + somOf(r), 0));
}

// —— Ommaviy yuklash (men sizning raqamlaringizni shu orqali kiritaman) ——
export function loadExpenses({ recurring: rec = [], oneOff: one = [] } = {}) {
  for (const r of rec) addRecurring(r);
  for (const e of one) addExpense(e);
  return { recurring: recurring.length, oneOff: oneOff.length };
}
