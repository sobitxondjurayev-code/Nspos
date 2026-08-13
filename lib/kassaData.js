"use client";
// ══════════════════════════════════════════════════════════════
// KASSALAR — DO'KONLAR + KOMPANIYA BALANSI
// ══════════════════════════════════════════════════════════════
// Billz'dagi "закрыть кассу" bilan bir xil model: pul bitta umumiy
// qopda emas, har do'konning o'z kassasida yuriladi. Billz'da ular
// "Касса NSkamera" va "Cashbox nskamera namangan" deb ataladi.
// Ustiga NSPOS'niki qo'shiladi:
//
//   <do'kon>  — do'kon menejeri javob beradi
//   company   — asosiy (kompaniya) balansi, faqat rahbarniki
//
// Har kassa uch hamyonga bo'linadi: naqd, Payme (Click va barcha
// kartalar shu yerda) va servis.
//
// PUL QANDAY YURADI:
//   1. Kun davomidagi kirim-chiqim Billz ДДС eksportidan olinadi
//      (kassaIncome.js). Bu Billz'ning o'z yozuvi — menejer unga
//      tegolmaydi, shuning uchun balans "aytilgan" emas, "bo'lgan"
//      raqamga tayanadi.
//   2. Menejer kassadan qo'lda ham chiqim qila oladi (mayda xarajat).
//   3. Kun oxirida qolgan pulni rahbarga o'tkazadi — bu TRANSFER.
//      U darrov kompaniya balansiga tushmaydi: rahbar tasdiqlaguncha
//      "yo'lda" turadi. Rahbar rad etsa, pul menejer kassasida qoladi.
//   4. Rahbar tasdiqlagach pul kompaniya balansiga qo'shiladi va faqat
//      shu yerdan import, tovar keltirish, shaxsiy xarajat kabi
//      chiqimlar qilinadi.
//
// Nega tasdiq kerak: "topshirdim" bilan "olmadim" o'rtasidagi bahsni
// faqat ikki tomon bosgan tugma yopadi. Tasdiqsiz o'tkazma — hisobot
// emas, umid.
import { demoStores } from "./demoData";
import { listStaff } from "./staffData";
import { listAllDays, getType, hasType } from "./kpiData";
import { expensesInRange, SERVICE_CATEGORIES, categoryLabel as expenseCategoryLabel, somOf as expenseSom } from "./expensesData";
import { listOperations } from "./financeData";
import { billzServiceIncome } from "./serviceIncome";
import { billzKassaFlow, billzKassaDays } from "./kassaIncome";
import { getLedgerStart, somToUsd } from "./companyData";
import { syncTable } from "./sync";

// —— Kassalar ————————————————————————————————————
// Billz'dagidek: har do'konning o'z kassasi bor ("Касса NSkamera",
// "Cashbox nskamera namangan"), ustiga kompaniyaning asosiy balansi
// qo'shiladi. Ombor kassa emas — unda savdo bo'lmaydi.
//
// KASSAS obyekti FUNKSIYA orqali yig'iladi: bazadan do'konlar kelganda
// ularning id'i UUID ga almashadi (storesData.js), qotib qolgan ro'yxat
// eskirib qolardi.
export const COMPANY = "company";

const isKassaStore = (s) =>
  s.kind ? s.kind !== "warehouse" : !/sklad|склад|ombor/i.test(s.name || "");

export function listKassas() {
  return [
    ...demoStores.filter(isKassaStore).map((s) => ({
      id: s.id,
      label: `${s.name} kassasi`,
      hint: "Do'kon menejeri javob beradi",
      storeId: s.id,
    })),
    {
      id: COMPANY,
      label: "Kompaniya balansi",
      hint: "Asosiy balans — faqat rahbar boshqaradi",
      storeId: null,
      main: true,
    },
  ];
}

// Eski kod `KASSAS[k].label` shaklida yozilgan — o'sha ko'rinishni
// saqlaymiz, lekin ichi har chaqiruvda qaytadan yig'iladi.
export const KASSAS = new Proxy({}, {
  get: (_, k) => listKassas().find((x) => x.id === k),
  has: (_, k) => listKassas().some((x) => x.id === k),
  ownKeys: () => listKassas().map((x) => x.id),
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
});

export const WALLETS = { cash: "Naqd", payme: "Payme", service: "Servis" };

// —— Qaysi kassada qaysi hamyon bor ————————————————
// B2B (optom) kassada SERVIS hamyoni bo'lmaydi — optom savdoda
// o'rnatish xizmati sotilmaydi. Do'kon B2B ekani qo'lda belgilanmaydi:
// unga "B2B menejer" turidagi xodim biriktirilgan bo'lsa, o'sha do'kon
// B2B hisoblanadi (KPI va oylik bo'limidagi tur). Menejer boshqa
// do'konga o'tsa — belgi ham o'zi ko'chadi.
const b2bStoreIds = () => new Set(
  listStaff()
    .filter((s) => s.storeId && hasType(s.id) && getType(s.id) === "b2b")
    .map((s) => s.storeId)
);

// Shu kassa optom (B2B) do'konnikimi. Xarajat oynasi shunga qarab
// kimlar ro'yxatini chiqaradi: optomda faqat o'sha do'kon xodimi,
// do'kon kassasida esa ustalar ham (ular servis ishini qiladi).
export const isB2bKassa = (kassaId) => b2bStoreIds().has(kassaId);

export function walletsOf(kassaId) {
  const b2b = b2bStoreIds();
  return WALLET_IDS.filter((w) => w !== "service" || !b2b.has(kassaId));
}

export const kassaIds = () => listKassas().map((k) => k.id);
export const WALLET_IDS = Object.keys(WALLETS);

// —— Kategoriyalar ————————————————————————————————
// Rahbar bergan ro'yxat. Yangi tur kerak bo'lsa shu yerga bitta qator.
export const KASSA_CATEGORIES = {
  in: {
    collection: "Inkassatsiya",
    debt_in: "Qaytgan qarz",
    other_in: "Boshqa kirim",
  },
  out: {
    import: "Import xarajati",
    goods: "Tovar keltirish",
    // Rahbarlar biznesdan o'ziga oladigan pul. Rahbar buni "NS" deb
    // yuritadi — jadvalda ham shu nom bilan turadi. Kalit `personal`
    // bo'lib qoldi: eski yozuvlar shu bilan kiritilgan, nomi
    // o'zgargani bilan pul o'sha joyda qolaveradi.
    personal: "NS (rahbar olgan pul)",
    salary: "Oylik maoshlar",
    other_out: "Boshqa chiqim",
  },
};

export const categoryLabel = (k) =>
  KASSA_CATEGORIES.in[k] ?? KASSA_CATEGORIES.out[k] ?? k;

// —— Xotira va baza ————————————————————————————————
// Yozuv: { id, kassa, wallet, kind, amount, date, category, note,
//          staffId, status, decidedBy, decidedAt, at }
//   kind = "in" | "out" | "transfer"
//   status faqat transferda: "pending" | "approved" | "rejected"
let ops = [];
let seq = 1;
const nextId = () => "k-" + (seq++) + "-" + Date.now().toString(36);

const sync = syncTable("kassa_ops", {
  table: "kassa_ops",
  order: { column: "op_date", ascending: false },
  get: () => ops,
  set: (v) => { ops = v; },
  sort: (a, b) => (a.date === b.date ? (a.at < b.at ? 1 : -1) : (a.date < b.date ? 1 : -1)),
  fromRow: (r) => ({
    id: r.id,
    kassa: r.kassa,
    wallet: r.wallet,
    kind: r.kind,
    amount: Number(r.amount),
    // Kiritilgan so'm va o'sha kundagi kurs — chiqim so'mda kiritiladi,
    // shuning uchun asl raqam ham saqlanadi (companyData.fromSom)
    amountSom: r.amount_som == null ? null : Number(r.amount_som),
    rateUsed: r.rate_used == null ? null : Number(r.rate_used),
    date: String(r.op_date).slice(0, 10),
    category: r.category ?? null,
    note: r.note ?? "",
    staffId: r.staff_id ?? null,
    status: r.status ?? null,
    decidedBy: r.decided_by ?? null,
    decidedAt: r.decided_at ?? null,
    at: r.created_at ?? new Date().toISOString(),
  }),
  toRow: (o) => ({
    kassa: o.kassa,
    wallet: o.wallet,
    kind: o.kind,
    amount: o.amount,
    amount_som: o.amountSom ?? null,
    rate_used: o.rateUsed ?? null,
    op_date: o.date,
    category: o.category,
    note: o.note || null,
    staff_id: o.staffId || null,
    status: o.status,
    decided_by: o.decidedBy,
    decided_at: o.decidedAt,
  }),
});

const put = (o) => { ops = [o, ...ops.filter((x) => x.id !== o.id)]; return o; };

export const listOps = (from, to) =>
  ops.filter((o) => (!from || o.date >= iso(from)) && (!to || o.date <= iso(to)));

const iso = (d) => (typeof d === "string" ? d.slice(0, 10)
  : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);

const today = () => iso(new Date());

// —— Kirim / chiqim ————————————————————————————————
export function addOp({ kassa, wallet, kind, amount, amountSom = null, rateUsed = null,
                        date, category, note = "", staffId = null }) {
  const o = {
    id: nextId(), kassa, wallet, kind,
    amount: +Number(amount).toFixed(2),
    amountSom, rateUsed,
    date: iso(date || new Date()),
    category: category ?? (kind === "in" ? "other_in" : "other_out"),
    note, staffId, status: null, decidedBy: null, decidedAt: null,
    at: new Date().toISOString(),
  };
  put(o);
  // Xotiradagi id vaqtinchalik — bazaga tushgach haqiqiysiga almashadi.
  // Ba'zi chaqiruvchilar (to'lov rejasi) aynan shu yozuvga bog'lanadi,
  // shuning uchun haqiqiy id va'da qilib qaytariladi.
  o.saved = sync.created(o).then((r) => r?.data?.id ?? o.id);
  return o;
}

export function removeOp(id) {
  ops = ops.filter((o) => o.id !== id);
  sync.deleted(id);
}

// —— Transfer: menejer → rahbar ————————————————————
// Pul manba kassasidan darrov chiqmaydi. Balansda u "yo'lda" sifatida
// alohida ko'rsatiladi — menejer ham, rahbar ham qancha pul kutilayotganini
// ko'rib turadi.
export function requestTransfer({ kassa, wallet, amount, date, note = "", staffId = null,
                                  category = null }) {
  const o = {
    id: nextId(), kassa, wallet, kind: "transfer",
    amount: +Number(amount).toFixed(2),
    date: iso(date || new Date()),
    // category = "close" bo'lsa — bu kunlik yopilish (pastdagi bo'limga
    // qarang). Oddiy o'tkazmada bo'sh qoladi.
    category, note, staffId,
    status: "pending", decidedBy: null, decidedAt: null,
    at: new Date().toISOString(),
  };
  put(o);
  sync.created(o);
  return o;
}

function decide(id, status, byStaffId) {
  const cur = ops.find((o) => o.id === id);
  if (!cur || cur.kind !== "transfer" || cur.status !== "pending") return null;
  const next = { ...cur, status, decidedBy: byStaffId ?? null, decidedAt: new Date().toISOString() };
  put(next);
  sync.changed(next);
  return next;
}

export const approveTransfer = (id, byStaffId) => decide(id, "approved", byStaffId);
export const rejectTransfer = (id, byStaffId) => decide(id, "rejected", byStaffId);

export const pendingTransfers = () =>
  ops.filter((o) => o.kind === "transfer" && o.status === "pending");

// —— Balanslar ————————————————————————————————————
// Qaytadi: { <kassaId>: { cash, payme, service, total, pending }, ... }
//   pending — rahbar tasdig'ini kutayotgan, ya'ni yo'ldagi pul.
//             U hali manba kassasidan chiqmagan.
export function kassaBalances(asOf = new Date()) {
  const to = iso(asOf);
  // Hisob shu kundan boshlanadi (Sozlamalarda). Undan oldingi pul
  // harakati sanalmaydi: o'tgan oylardagi tushum allaqachon sarflangan,
  // uni bugungi kassa qoldig'iga qo'shish balansni yolg'on qiladi.
  const from = getLedgerStart();
  const ids = kassaIds();

  const out = {};
  for (const k of ids) out[k] = { cash: 0, payme: 0, service: 0, total: 0, pending: 0 };

  // 1) Do'kon kassalarining KIRIMI — menejerlarning kunlik jadvalidan.
  //    Chiqim bu yerdan kelmaydi: Billz'da xarajat yuritilmaydi, u
  //    platformada qo'lda kiritiladi (pastdagi 3-band).
  const inc = kpiIncome(from, to);
  let kpiService = 0;
  for (const [store, w] of Object.entries(inc)) {
    if (!out[store]) continue;
    out[store].cash += w.cash;
    out[store].payme += w.payme;
    out[store].service += w.service;
    kpiService += w.service;
  }

  // 2) Servis kirimi. Asosiy manba — menejer kunlik jadvalga yozgan
  //    "Servis" ustuni (yuqorida do'kon kassasiga tushdi). Menejer
  //    hali yozmagan bo'lsa, Billz'dagi montaj sotuvidan olinadi va
  //    kompaniya servis hamyoniga tushadi. Ikkalasi birga qo'shilmaydi:
  //    bu bitta pul, ikki xil manbadan yozilgani.
  if (kpiService === 0) {
    out[COMPANY].service += billzServiceIncome(from, to).revenue;
  }

  // Xarajatlar moduli ham shu yerdan pul olib chiqadi — aks holda
  // to'langan ijara balansda "hamon turgan pul" bo'lib ko'rinardi.
  // Diqqat: expensesInRange chegarani vaqt bilan solishtiradi va kun
  // ichidagi yozuvni soat 12:00 deb oladi — shuning uchun oxirgi kunning
  // OXIRI beriladi, aks holda bugungi xarajat tushib qolardi.
  for (const e of expensesInRange(new Date(from + "T00:00:00"), new Date(to + "T23:59:59"))) {
    const b = out[e.kassa] ?? out[COMPANY];
    const w = WALLET_IDS.includes(e.method) ? e.method : "cash";
    b[w] -= e.amount;
  }

  // 4) NSPOS ichida qilingan TO'LOVLAR: ish haqi, yetkazib beruvchiga
  //    to'lov, tovar xaridi va boshqa kassa chiqimlari. Ular ham pulni
  //    kassadan olib chiqadi — aks holda ish haqi to'langanda qarz
  //    kamayadi-yu, pul joyida turgandek ko'rinardi.
  //
  //    Faqat CHIQIM olinadi: kirim (sotuv, qarz to'lovi) allaqachon
  //    Billz ДДС da bor, ikkinchi marta qo'shsak pul ikkilanardi.
  for (const o of listOperations()) {
    if (o.type !== "chiqim") continue;
    const day = String(o.at).slice(0, 10);
    if (day > to || day < from) continue;
    const b = out[o.storeId] ?? out[COMPANY];
    const w = WALLET_IDS.includes(o.method) ? o.method : "cash";
    b[w] -= o.amount;
  }

  for (const o of ops) {
    if (o.date > to || o.date < from) continue;
    const b = out[o.kassa];
    if (!b) continue;
    if (o.kind === "in") b[o.wallet] += o.amount;
    else if (o.kind === "out") b[o.wallet] -= o.amount;
    else if (o.kind === "transfer") {
      if (o.status === "pending") b.pending += o.amount;
      else if (o.status === "approved") {
        b[o.wallet] -= o.amount;
        out[COMPANY][o.wallet] += o.amount;
      }
    }
  }

  for (const k of ids) {
    for (const w of WALLET_IDS) out[k][w] = +out[k][w].toFixed(2);
    out[k].total = +(out[k].cash + out[k].payme + out[k].service).toFixed(2);
    out[k].pending = +out[k].pending.toFixed(2);
  }
  return out;
}

// —— Davr bo'yicha pul oqimi ————————————————————————
// "Shu oyda qancha pul kirdi, qancha chiqdi" degan savolga javob.
// Manbalar aynan kassaBalances'nikidek — aks holda rahbar ikki
// sahifada ikki xil raqam ko'rib, ikkalasiga ham ishonmay qolardi.
//
// Farqi shundaki, balans hisob boshidan bugungacha yig'iladi, bu esa
// berilgan oraliqni oladi. O'tkazmalar bu yerda sanalmaydi: pul
// kassadan kassaga ko'chadi, kompaniyaga yangi pul kelmaydi.
export function moneyFlow(from, to) {
  const a = iso(from), b = iso(to);

  // KIRIM — menejerlarning kunlik jadvali (do'kon kassalari) va
  // Billz'dagi montaj sotuvi (servis kassasi)
  const kpi = kpiIncome(a, b);
  const kpiTotal = +Object.values(kpi)
    .reduce((s, w) => s + (w.cash || 0) + (w.payme || 0), 0).toFixed(2);
  // Servis: menejer yozgani ustun, yozmagan bo'lsa Billz'dan
  const kpiService = +Object.values(kpi)
    .reduce((s, w) => s + (w.service || 0), 0).toFixed(2);
  const service = kpiService || billzServiceIncome(a, b).revenue;
  const opsIn = +ops
    .filter((o) => o.kind === "in" && o.date >= a && o.date <= b)
    .reduce((s, o) => s + o.amount, 0).toFixed(2);

  // CHIQIM — xarajatlar moduli, kassadan qo'lda chiqim va NSPOS ichida
  // qilingan to'lovlar (ish haqi, yetkazib beruvchi, tovar)
  const exp = +expensesInRange(new Date(a + "T00:00:00"), new Date(b + "T23:59:59"))
    .reduce((s, e) => s + e.amount, 0).toFixed(2);
  const opsOut = +ops
    .filter((o) => o.kind === "out" && o.date >= a && o.date <= b)
    .reduce((s, o) => s + o.amount, 0).toFixed(2);
  const payments = +listOperations()
    .filter((o) => o.type === "chiqim" && String(o.at).slice(0, 10) >= a
                && String(o.at).slice(0, 10) <= b)
    .reduce((s, o) => s + o.amount, 0).toFixed(2);

  const income = +(kpiTotal + service + opsIn).toFixed(2);
  const outcome = +(exp + opsOut + payments).toFixed(2);
  return {
    from: a, to: b,
    in: income, out: outcome, net: +(income - outcome).toFixed(2),
    // Qismlari — kartochka ostidagi izoh uchun
    inStores: kpiTotal, inService: service, inOther: opsIn,
    outExpenses: exp, outKassa: +(opsOut + payments).toFixed(2),
  };
}

// —— Rahbar jadvalining bir qatori ————————————————
// Rahbar Google Sheets'da yuritgan ustunlar. Har biri allaqachon
// platformada bor ma'lumotdan hisoblanadi — qo'lda ikkinchi marta
// yozish shart emas:
//
//   B2B / B2C          — menejerlarning kunlik jadvalidagi kirim
//   B2B xarajatlari    — B2B kassasidan chiqqan xarajat
//   Do'kon xarajatlari — B2C kassasidan chiqqan xarajat
//   Servis xarajatlar  — servis hamyonidan (yoki servis turidagi) xarajat
//   Oylik maoshlar     — kassadan to'langan maosh + ustalar olgan pul
//   NS                 — rahbar o'ziga olgan pul
//
// B2B/B2C do'kon nomidan emas, XODIM turidan aniqlanadi: do'konda
// "B2B menejer" ishlasa, o'sha do'kon optom hisoblanadi (KPI bo'limi).
// Menejer boshqa do'konga o'tsa — belgi ham o'zi ko'chadi.

// Xarajat servisnikimi: puli servis hamyonidan chiqqan bo'lsa yoki
// turi servisga tegishli bo'lsa (mashina gazi, avtol, mayda-chuda…).
const isServiceExpense = (e) =>
  e.method === "service" || SERVICE_CATEGORIES.includes(e.category);

// Ustalar "olgan pul"i kunlik jadvalda SO'Mda yoziladi, bu jadval esa
// dollarda — o'girib qo'shamiz. Kurs bo'lmasa qo'shilmaydi: yolg'on
// raqamdan ko'ra bo'sh katak yaxshi.
const installerIds = () =>
  new Set(listStaff().filter((s) => s.role === "installer").map((s) => s.id));

function fillDays(a, b, row) {
  const b2b = b2bStoreIds();
  const staffStore = new Map(listStaff().map((s) => [s.id, s.storeId]));
  const ustalar = installerIds();

  // Kirim va ustalar olgan puli — menejerlarning kunlik jadvalidan
  for (const d of listAllDays(a, b)) {
    const r = row(d.date);
    const c = Number(d.cash) || 0;
    const p = Number(d.payme) || 0;
    if (c || p) {
      const store = staffStore.get(d.staffId);
      if (store) {
        r.cash += c;
        r.payme += p;
        if (b2b.has(store)) r.b2b += c + p; else r.b2c += c + p;
      }
    }
    // Servis kirimi — o'rnatish xizmatidan tushgan pul. Do'kon savdosi
    // emas (menejer uni naqddan ayirib yozadi), shuning uchun b2c ga
    // qo'shilmaydi — o'z ustuni bor va servis xarajatlari shundan
    // chiqadi.
    if (d.service) r.service += Number(d.service) || 0;
    // Usta olgan pul — bu ham oylik
    if (ustalar.has(d.staffId) && d.olgan) {
      const usd = somToUsd(d.olgan);
      if (usd) r.salary += usd;
    }
  }

  // Xarajatlar — qaysi kassadan chiqqaniga qarab ustunga tushadi
  for (const e of expensesInRange(new Date(a + "T00:00:00"), new Date(b + "T23:59:59"))) {
    const r = row(e.date);
    // Oylik qaysi kassadan chiqqanidan qat'i nazar "Oylik maoshlar"
    // ustuniga boradi — rahbar uni do'kon xarajati deb ko'rmaydi
    if (e.category === "salary") r.salary += e.amount;
    else if (isServiceExpense(e)) r.svcExp += e.amount;
    else if (b2b.has(e.kassa)) r.b2bExp += e.amount;
    else if (e.kassa && e.kassa !== COMPANY) r.storeExp += e.amount;
    else r.companyExp += e.amount;
  }

  // Maosh va NS — kassa chiqimlari. Ish haqi bo'limida "To'lash"
  // bosilganda shu yerga tushadi, NS esa rahbar kassadan olganda.
  for (const o of ops) {
    if (o.kind !== "out" || o.date < a || o.date > b) continue;
    if (o.category === "salary") row(o.date).salary += o.amount;
    else if (o.category === "personal") row(o.date).ns += o.amount;
  }
}

// —— Katak ortidagi yozuvlar ————————————————————————
// Jadvaldagi raqam qayerdan chiqqani. Rahbar "5 419 qayerdan keldi?"
// deb so'raganda javob shu yerdan: qaysi kuni, kim, qancha, nima uchun.
// fillDays bilan BIR XIL qoida bo'yicha ajratiladi — aks holda ochilgan
// ro'yxatning yig'indisi katakdagi raqamga to'g'ri kelmay qolardi.
// key — bitta ustun ("cash", "storeExp"...) yoki guruh:
//   "in"  — hamma kirim (b2b + b2c + servis)
//   "out" — hamma chiqim (xarajat, oylik, NS)
// opts.kassa berilsa — faqat o'sha kassaning yozuvlari.
const IN_KEYS = ["b2b", "b2c", "service"];
const OUT_KEYS = ["b2bExp", "storeExp", "svcExp", "companyExp", "salary", "ns"];

export function flowSources(from, to, key, opts = {}) {
  const group = key === "in" ? IN_KEYS
    : key === "out" ? OUT_KEYS
    : key === "all" ? [...IN_KEYS, ...OUT_KEYS] : null;
  if (group) return group.flatMap((k) => flowSources(from, to, k, opts))
    .sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));

  const onlyKassa = opts.kassa ?? null;
  const a = iso(from), b = iso(to);
  const b2b = b2bStoreIds();
  const staff = new Map(listStaff().map((s) => [s.id, s]));
  const ustalar = installerIds();
  const out = [];
  const add = (o) => { if (Math.abs(o.amount) > 0.004) out.push(o); };

  // 1) Menejerlarning kunlik jadvali — kirim
  for (const d of listAllDays(a, b)) {
    const s = staff.get(d.staffId);
    const store = s?.storeId;
    const who = s?.name ?? "—";
    const c = Number(d.cash) || 0, p = Number(d.payme) || 0, sv = Number(d.service) || 0;
    if (store && (!onlyKassa || store === onlyKassa)) {
      const isB2b = b2b.has(store);
      if (key === "b2b" && isB2b) add({ date: d.date, title: who, note: "Kunlik jadval · naqd + Payme", amount: c + p });
      if (key === "b2c" && !isB2b) add({ date: d.date, title: who, note: "Kunlik jadval · naqd + Payme", amount: c + p });
      if (key === "cash") add({ date: d.date, title: who, note: "Kunlik jadval · naqd", amount: c });
      if (key === "payme") add({ date: d.date, title: who, note: "Kunlik jadval · Payme", amount: p });
      if (key === "service") add({ date: d.date, title: who, note: "Kunlik jadval · servis kirimi", amount: sv });
    }
    // Usta olgan pul ham oylik hisoblanadi
    if (key === "salary" && ustalar.has(d.staffId) && d.olgan) {
      add({ date: d.date, title: who, note: "Usta olgan pul", out: true,
        amount: somToUsd(d.olgan) || 0, amountSom: Number(d.olgan) || 0 });
    }
  }

  // 2) Xarajatlar — fillDays'dagi ustunga ajratish qoidasi aynan shu
  for (const e of expensesInRange(new Date(a + "T00:00:00"), new Date(b + "T23:59:59"))) {
    if (onlyKassa && e.kassa !== onlyKassa) continue;
    const col = e.category === "salary" ? "salary"
      : isServiceExpense(e) ? "svcExp"
      : b2b.has(e.kassa) ? "b2bExp"
      : e.kassa && e.kassa !== COMPANY ? "storeExp" : "companyExp";
    if (col !== key) continue;
    const who = e.paidTo || staff.get(e.staffId)?.name || null;
    add({ date: e.date, out: true,
      title: expenseCategoryLabel(e.category),
      note: [who, e.note].filter(Boolean).join(" · "),
      amount: e.amount, amountSom: expenseSom(e),
      repeat: e.source === "recurring" });
  }

  // 3) Kassa chiqimlari: ish haqi to'lovi va rahbar olgan shaxsiy pul
  for (const o of ops) {
    if (o.kind !== "out" || o.date < a || o.date > b) continue;
    if (onlyKassa && o.kassa !== onlyKassa) continue;
    const col = o.category === "salary" ? "salary" : o.category === "personal" ? "ns" : null;
    if (col !== key) continue;
    add({ date: o.date, out: true,
      title: o.category === "personal" ? "NS — shaxsiy pul" : "Ish haqi to'lovi",
      note: o.note || "", amount: o.amount, amountSom: o.amountSom ?? null });
  }

  return out.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
}

const emptyRow = (date) => ({
  date, b2b: 0, b2bExp: 0, b2c: 0, service: 0, storeExp: 0, svcExp: 0,
  salary: 0, cash: 0, payme: 0, ns: 0, companyExp: 0,
});

const roundRow = (r) => {
  const out = { date: r.date };
  for (const k of Object.keys(r)) if (k !== "date") out[k] = +r[k].toFixed(2);
  return out;
};

export function summaryRow(from, to) {
  const a = iso(from), b = iso(to);
  const total = emptyRow(null);
  fillDays(a, b, () => total);
  return roundRow(total);
}

// —— O'sha jadval, lekin kunlar bo'yicha ————————————
// Rahbar bir qatorli yig'indini emas, "qaysi kuni nima bo'lgani"ni
// ko'rmoqchi — daftardagi kabi har sana alohida qator.
//
// Bo'sh kunlar chiqarilmaydi: pul ham kirmagan, ham chiqmagan kun
// jadvalda bo'sh qator bo'lib turadi va muhim kunlarni ko'zdan
// yashiradi.
export function dailyRows(from, to) {
  const a = iso(from), b = iso(to);
  const map = new Map();
  const row = (d) => {
    if (!map.has(d)) map.set(d, emptyRow(d));
    return map.get(d);
  };

  fillDays(a, b, row);

  return [...map.values()]
    .map(roundRow)
    .filter((r) => Object.keys(r).some((k) => k !== "date" && r[k] !== 0))
    .sort((x, y) => (x.date < y.date ? -1 : 1));
}

// —— Kunlik jadvaldan kirim ————————————————————————
// Menejerlar har kuni KPI jadvaliga o'z kassasiga tushgan naqd va
// Payme'ni yozadi — kassa kirimi shundan olinadi.
//
// Nega Billz ДДС emas: ДДС "Отчеты → Финансы" ichida va menejerda unga
// ruxsat bo'lmasligi mumkin. Kunlik jadvalni esa ular allaqachon
// to'ldiradi. Shu bilan birga bu raqamdan inkassatsiya bonusi ham
// hisoblanadi — ya'ni uni oshirish foydali. Shuning uchun ДДС yuklansa,
// pastdagi kamomad jadvali ikkalasini solishtirib ko'rsatadi.
export function kpiIncome(from, to) {
  const staffStore = new Map(listStaff().map((s) => [s.id, s.storeId]));
  const out = {};
  for (const d of listAllDays(from, to)) {
    const store = staffStore.get(d.staffId);
    if (!store) continue;
    const k = (out[store] ??= { cash: 0, payme: 0, service: 0 });
    k.cash += Number(d.cash) || 0;
    k.payme += Number(d.payme) || 0;
    // Servis — o'rnatish xizmatidan tushgan pul (B2C do'kon menejeri
    // kunlik jadvalga yozadi). Do'konning savdo puli emas, shuning
    // uchun alohida hamyonga boradi.
    k.service += Number(d.service) || 0;
  }
  for (const k of Object.keys(out)) {
    out[k].cash = +out[k].cash.toFixed(2);
    out[k].payme = +out[k].payme.toFixed(2);
    out[k].service = +out[k].service.toFixed(2);
  }
  return out;
}

// —— Kamomad nazorati ————————————————————————————
// Ikkita manba bir xil pulni ko'rsatishi kerak:
//   Billz ДДС     — kassaga haqiqatda tushgan pul (Billz o'zi yozadi)
//   KPI jadvali   — menejer "shuncha topshirdim" deb kiritgan raqam
//
// Ular teng bo'lmasa — kamomad. Menejerning inkassatsiya bonusi KPI
// raqamidan hisoblanadi, shuning uchun uni oshirish foydali; farqni
// ko'rsatib qo'ymasak, hech kim sezmaydi.
//
// Solishtirish ДДС yuklamasi qamragan davr bo'yicha boradi — aks holda
// bir manba to'liq, ikkinchisi yarim davr bo'lib, farq soxta chiqadi.
export function kassaControl() {
  const flow = billzKassaFlow(getLedgerStart(), iso(new Date()));
  if (!flow.ready || !flow.period) return { ready: false, period: null, rows: [] };

  const { from, to } = flow.period;
  const kpi = kpiIncome(from, to);

  const rows = kassaIds()
    .filter((k) => k !== COMPANY)
    .map((k) => {
      const b = flow.byStore[k] ?? {};
      // Billz raqami — KIRIM MINUS CHIQIM. To'lov turi almashtirilganda
      // Billz uchta qator yozadi (naqd −20, naqd +20, Payme +20); faqat
      // kirim olinsa raqam soxta ko'p chiqadi. Menejer esa kassada
      // qolgan pulni yozadi, ya'ni sof harakatni.
      const billz = +(
        (b.cash?.in ?? 0) - (b.cash?.out ?? 0)
        + (b.payme?.in ?? 0) - (b.payme?.out ?? 0)
      ).toFixed(2);
      // Menejer servisni naqddan AYIRIB yozadi (731 → 700 naqd + 31
      // servis), Billz esa montajni oddiy sotuv sifatida naqdga qo'shib
      // yuboradi. Shuning uchun solishtirishda servis qaytariladi —
      // aks holda har kuni aynan servis summasicha "kamomad" chiqadi.
      const said = +((kpi[k]?.cash ?? 0) + (kpi[k]?.payme ?? 0) + (kpi[k]?.service ?? 0)).toFixed(2);
      // MUHIM: netto farq yetarli emas. Bir kuni 1000 ko'p, boshqa kuni
      // 1000 kam bo'lsa netto NOL chiqadi va ikkala muammo ko'rinmay
      // qoladi. Shuning uchun kam va ko'p alohida yig'iladi.
      const days = kassaControlDays(k);
      const short = +days.filter((d) => d.diff < -0.01)
        .reduce((a, d) => a + d.diff, 0).toFixed(2);
      const over = +days.filter((d) => d.diff > 0.01)
        .reduce((a, d) => a + d.diff, 0).toFixed(2);
      return {
        kassa: k,
        label: KASSAS[k]?.label ?? k,
        billz, said,
        // Manfiy — menejer Billz ko'rsatgandan KAM topshirgan
        diff: +(said - billz).toFixed(2),
        short, over,
        shortDays: days.filter((d) => d.diff < -0.01).length,
        overDays: days.filter((d) => d.diff > 0.01).length,
        pct: billz > 0 ? +(((said - billz) / billz) * 100).toFixed(2) : null,
        hasKpi: said > 0,
      };
    });

  return { ready: true, period: flow.period, rows };
}

// —— Farq qaysi kunlarda chiqqan ————————————————————
// Kamomad jadvalidagi "Farq" ustiga bosilganda ochiladi: har kun uchun
// Billz yozgan pul, menejer topshirgan pul va ularning farqi. Umumiy
// raqam bilan bir xil qoidada hisoblanadi (naqd + Payme, faqat kirim).
export function kassaControlDays(kassaId) {
  const flow = billzKassaFlow(getLedgerStart(), iso(new Date()));
  if (!flow.ready || !flow.period) return [];
  const { from, to } = flow.period;

  const billzDays = billzKassaDays(kassaId, from, to);
  const staffStore = new Map(listStaff().map((s) => [s.id, s.storeId]));

  // Menejer kunlik jadvalga yozgani — shu kassaga tegishli xodimlarniki
  const said = {};
  for (const d of listAllDays(from, to)) {
    if (staffStore.get(d.staffId) !== kassaId) continue;
    const s = (said[d.date] ??= { cash: 0, payme: 0, service: 0 });
    s.cash += Number(d.cash) || 0;
    s.payme += Number(d.payme) || 0;
    // Servis ham kassaga tushgan pul — Billz uni naqd sotuv deb yozadi
    s.service += Number(d.service) || 0;
  }

  const days = [...new Set([...Object.keys(billzDays), ...Object.keys(said)])].sort();
  return days.map((date) => {
    const b = billzDays[date] ?? { cash: 0, payme: 0 };
    const k = said[date] ?? { cash: 0, payme: 0, service: 0 };
    const billz = +(b.cash + b.payme).toFixed(2);
    const kpi = +(k.cash + k.payme + k.service).toFixed(2);
    return {
      date, billz, kpi,
      billzCash: b.cash, billzPayme: b.payme,
      kpiCash: +k.cash.toFixed(2), kpiPayme: +k.payme.toFixed(2),
      kpiService: +k.service.toFixed(2),
      diff: +(kpi - billz).toFixed(2),
    };
  });
}

// ══════════════════════════════════════════════════════════════
// KASSA KUNLIK YOPILADI
// ══════════════════════════════════════════════════════════════
// Ilgari "Kassani yopish" hisob boshidan yig'ilgan HAMMA pulni bir
// bosishda rahbarga uzatardi — qaysi kunniki ekani yo'qolardi va
// yopilmay qolgan kun ko'rinmasdi. Endi har kun alohida yopiladi:
//
//   kun qoldig'i = o'sha kundagi kirim − chiqim − allaqachon topshirilgani
//
// Yopilgan kun `kassa_ops` da `kind='transfer', category='close'` yozuvi
// bilan belgilanadi (hamyon boshiga bitta). Topshiriladigan pul bo'lmasa
// ham kun yopiladi — 0 summali yozuv "bu kun tekshirildi" degani.
export const CLOSE = "close";

const zero = () => ({ cash: 0, payme: 0, service: 0 });
const sumW = (w) => +((w.cash || 0) + (w.payme || 0) + (w.service || 0)).toFixed(2);

// Yozuv qaysi kassaga tegishli. kassaBalances bilan BIR XIL qoida:
// noma'lum kassa kompaniya balansiga tushadi (aks holda pul yo'qoladi).
const kassaOf = (id) => (kassaIds().includes(id) ? id : COMPANY);
const walletOf = (m) => (WALLET_IDS.includes(m) ? m : "cash");

// —— Bir kassaning kunma-kun daftari ————————————————
// Manbalar kassaBalances'nikidek: menejerning kunlik jadvali (kirim),
// Xarajatlar moduli, NSPOS to'lovlari va kassa yozuvlari (chiqim).
// Bitta joyda yig'iladi — jadvaldagi raqam ham, ustiga bosilganda
// ochiladigan ro'yxat ham shundan chiqadi, shuning uchun ular hech
// qachon bir-biriga qarama-qarshi bo'lmaydi.
function dayMapOf(kassaId, a, b) {
  const map = new Map();
  const row = (d) => {
    if (!map.has(d)) map.set(d, {
      date: d, in: zero(), out: zero(), sent: zero(), wait: zero(), src: [],
    });
    return map.get(d);
  };
  const inRange = (d) => d >= a && d <= b;
  const isCompany = kassaId === COMPANY;

  // 1) Kirim — menejerlarning kunlik jadvali (do'kon kassalari)
  if (!isCompany) {
    const staff = new Map(listStaff().map((s) => [s.id, s]));
    for (const d of listAllDays(a, b)) {
      const s = staff.get(d.staffId);
      if (s?.storeId !== kassaId) continue;
      const r = row(d.date);
      const who = s?.name ?? "—";
      for (const [w, v, lbl] of [
        ["cash", Number(d.cash) || 0, "Kunlik jadval · naqd"],
        ["payme", Number(d.payme) || 0, "Kunlik jadval · Payme"],
        ["service", Number(d.service) || 0, "Kunlik jadval · servis"],
      ]) {
        if (!v) continue;
        r.in[w] += v;
        r.src.push({ date: d.date, title: who, note: lbl, amount: v, bucket: "in", wallet: w });
      }
    }
  }

  // 2) Chiqim — Xarajatlar moduli
  for (const e of expensesInRange(new Date(a + "T00:00:00"), new Date(b + "T23:59:59"))) {
    if (kassaOf(e.kassa) !== kassaId) continue;
    const r = row(e.date);
    const w = walletOf(e.method);
    r.out[w] += e.amount;
    r.src.push({ date: e.date, out: true, title: expenseCategoryLabel(e.category),
      note: [e.paidTo, e.note].filter(Boolean).join(" · "),
      amount: e.amount, amountSom: expenseSom(e), bucket: "out", wallet: w });
  }

  // 3) NSPOS ichidagi to'lovlar (ish haqi, yetkazib beruvchi, tovar)
  for (const o of listOperations()) {
    if (o.type !== "chiqim") continue;
    const day = String(o.at).slice(0, 10);
    if (!inRange(day) || kassaOf(o.storeId) !== kassaId) continue;
    const r = row(day);
    const w = walletOf(o.method);
    r.out[w] += o.amount;
    r.src.push({ date: day, out: true, title: "To'lov", note: o.note || "", amount: o.amount,
      bucket: "out", wallet: w });
  }

  // 4) Kassaning o'z yozuvlari: qo'lda kirim/chiqim va o'tkazmalar
  for (const o of ops) {
    if (!inRange(o.date)) continue;
    const mine = o.kassa === kassaId;
    if (mine && o.kind === "in") {
      const r = row(o.date);
      r.in[o.wallet] += o.amount;
      r.src.push({ date: o.date, title: categoryLabel(o.category), note: o.note || "",
        amount: o.amount, amountSom: o.amountSom ?? null, bucket: "in", wallet: o.wallet });
    } else if (mine && o.kind === "out") {
      const r = row(o.date);
      r.out[o.wallet] += o.amount;
      r.src.push({ date: o.date, out: true, title: categoryLabel(o.category),
        note: o.note || "", amount: o.amount, amountSom: o.amountSom ?? null,
        bucket: "out", wallet: o.wallet });
    } else if (o.kind === "transfer") {
      // Do'kon kassasida — chiqib ketgan pul; kompaniya balansida esa
      // aynan o'sha pul kirim bo'lib tushadi (tasdiqlangandan keyin).
      if (mine) {
        const r = row(o.date);
        if (o.status === "approved") r.sent[o.wallet] += o.amount;
        else if (o.status === "pending") r.wait[o.wallet] += o.amount;
        if (o.status !== "rejected") {
          r.src.push({ date: o.date, out: true,
            title: o.category === CLOSE ? "Kassa yopildi" : "Rahbarga o'tkazma",
            note: [WALLETS[o.wallet], o.status === "pending" ? "tasdiq kutmoqda" : "tasdiqlangan",
              o.note].filter(Boolean).join(" · "),
            amount: o.amount, bucket: "given", wallet: o.wallet });
        }
      } else if (isCompany && o.status === "approved") {
        const r = row(o.date);
        r.in[o.wallet] += o.amount;
        r.src.push({ date: o.date, title: KASSAS[o.kassa]?.label ?? o.kassa,
          note: o.category === CLOSE ? "Kassa yopildi" : "Rahbarga o'tkazma",
          amount: o.amount, bucket: "in", wallet: o.wallet });
      }
    }
  }

  return map;
}

// Kunlik yopilishlar: sana → { status, amount, byWallet, ids, staffId }
// Rad etilgani hisobga olinmaydi — u kun qaytadan yopilishi kerak.
export function closingsOf(kassaId) {
  const out = {};
  for (const o of ops) {
    if (o.kind !== "transfer" || o.category !== CLOSE) continue;
    if (o.kassa !== kassaId || o.status === "rejected") continue;
    const c = (out[o.date] ??= {
      date: o.date, amount: 0, byWallet: zero(), ids: [],
      staffId: o.staffId, at: o.at, status: "approved",
    });
    c.amount = +(c.amount + o.amount).toFixed(2);
    c.byWallet[o.wallet] += o.amount;
    c.ids.push(o.id);
    // Bittasi ham tasdiqlanmagan bo'lsa — butun kun "yo'lda"
    if (o.status === "pending") c.status = "pending";
  }
  return out;
}

export const closingOf = (kassaId, date) => closingsOf(kassaId)[iso(date)] ?? null;

// —— Kun qoldig'i ————————————————————————————————
// Yopishda rahbarga aynan shu pul uzatiladi: kun kirimidan chiqim va
// allaqachon topshirilgani ayriladi. Manfiy hamyon uzatilmaydi (o'sha
// kuni chiqim kirimdan ko'p bo'lgan) — u qoldiqda qolib ketadi.
export function dayRemainder(kassaId, date) {
  const d = iso(date);
  const m = dayMapOf(kassaId, d, d).get(d);
  const byWallet = {}, given = {};
  for (const w of walletsOf(kassaId)) {
    // Allaqachon topshirilgani (qo'lda o'tkazma) ham ayriladi — bir pul
    // ikki marta uzatilmasin
    given[w] = +((m ? m.sent[w] + m.wait[w] : 0)).toFixed(2);
    const v = m ? m.in[w] - m.out[w] - given[w] : 0;
    byWallet[w] = +v.toFixed(2);
  }
  return {
    date: d,
    byWallet,
    total: +Object.values(byWallet).reduce((s, v) => s + v, 0).toFixed(2),
    in: m ? sumW(m.in) : 0,
    out: m ? sumW(m.out) : 0,
    // Har hamyonning O'Z kirimi va chiqimi. Servis ham shu qatorda:
    // servis materiallari servis pulidan chiqadi, shuning uchun
    // topshiriladigani — servis kirimi minus servis chiqimi.
    inByWallet: m ? { ...m.in } : zero(),
    outByWallet: m ? { ...m.out } : zero(),
    givenByWallet: given,
    givenTotal: +Object.values(given).reduce((s, v) => s + v, 0).toFixed(2),
  };
}

// —— Kunni yopish ————————————————————————————————
// Har hamyon o'z turi bilan boradi (naqd naqdga, Payme Payme'ga).
// Rahbar tasdiqlaguncha pul "yo'lda" turadi.
export function closeDay({ kassa, date, staffId = null, note = "" }) {
  const d = iso(date);
  if (closingOf(kassa, d)) return null;              // allaqachon yopilgan
  const rem = dayRemainder(kassa, d);
  const parts = Object.entries(rem.byWallet).filter(([, v]) => v > 0.004);
  const made = parts.map(([wallet, amount]) =>
    requestTransfer({ kassa, wallet, amount, date: d, staffId, category: CLOSE, note }));
  // Topshiriladigan pul bo'lmasa ham kun yopiladi: 0 summali yozuv
  // "bu kun tekshirildi, pul qolmadi" degani. Busiz o'sha kun abadiy
  // "yopilmagan" bo'lib qizarib turardi.
  if (!made.length) {
    made.push(requestTransfer({ kassa, wallet: "cash", amount: 0, date: d, staffId,
      category: CLOSE, note }));
  }
  return made;
}

// Yopishni bekor qilish — faqat rahbar hali tasdiqlamagan bo'lsa.
// Tasdiqlangan pul harakati o'chirilmaydi: u tarix (bazada ham shunday).
export function cancelClose(kassa, date) {
  const c = closingOf(kassa, date);
  if (!c || c.status !== "pending") return false;
  for (const id of c.ids) removeOp(id);
  return true;
}

// —— Kunma-kun jadval ————————————————————————————
// Qaytadi: { carry, rows: [...], today }
//   carry — davr boshigacha kassada qolgan pul
//   row   — { date, in, out, net, sent, wait, left, close, billz, diff }
//
// "left" (kassada qoldi) kassa kartochkasidagi raqam bilan bir xil
// qoidada: tasdiqlangan o'tkazma pulni olib chiqadi, tasdiq kutayotgani
// esa hali kassada sanaladi (kartochkada ham u alohida "yo'lda" deb
// turadi). Ikki joyda ikki xil raqam chiqmasligi uchun shunday.
export function kassaDailyRows(kassaId, from, to) {
  const start = getLedgerStart();
  const a0 = iso(from), b = iso(to);
  const a = a0 < start ? start : a0;               // hisob boshidan oldin pul yo'q
  const map = dayMapOf(kassaId, a, b);
  const closes = closingsOf(kassaId);

  // Davr boshigacha qolgan pul — mavjud balans funksiyasidan olinadi,
  // shunda qatorlarning oxirgi qoldig'i kartochkadagi raqamga tushadi.
  let carry = 0;
  if (a > start) {
    const prev = new Date(a + "T12:00:00");
    prev.setDate(prev.getDate() - 1);
    carry = kassaBalances(prev)[kassaId]?.total ?? 0;
  }

  // Yopilgan kun jadvalda DOIM qator bo'ladi — o'sha kuni pul harakati
  // bo'lmagan bo'lsa ham (0 bilan yopilgan kun ham ko'rinishi kerak).
  for (const d of Object.keys(closes)) {
    if (d < a || d > b || map.has(d)) continue;
    map.set(d, { date: d, in: zero(), out: zero(), sent: zero(), wait: zero(), src: [] });
  }

  const billz = billzKassaDays(kassaId, a, b);
  let run = carry;
  const rows = [...map.values()]
    .sort((x, y) => (x.date < y.date ? -1 : 1))
    .map((r) => {
      const inTotal = sumW(r.in), outTotal = sumW(r.out);
      const sent = sumW(r.sent), wait = sumW(r.wait);
      run = +(run + inTotal - outTotal - sent).toFixed(2);
      const bz = billz[r.date] ? +(billz[r.date].cash + billz[r.date].payme).toFixed(2) : null;
      return {
        date: r.date,
        in: inTotal, out: outTotal,
        // Har hamyonning o'z kirimi va chiqimi ("Ustunlar" dan yoqiladi):
        // servis puli servis xarajatiga ketadi, shuning uchun ikkalasi
        // yonma-yon turishi kerak — topshiriladigani ularning farqi.
        inCash: +r.in.cash.toFixed(2), inPayme: +r.in.payme.toFixed(2),
        inService: +r.in.service.toFixed(2),
        outCash: +r.out.cash.toFixed(2), outPayme: +r.out.payme.toFixed(2),
        outService: +r.out.service.toFixed(2),
        net: +(inTotal - outTotal).toFixed(2),
        sent, wait, given: +(sent + wait).toFixed(2),
        left: run,
        close: closes[r.date] ?? null,
        // ДДС yuklangan bo'lsa: Billz o'sha kuni kassaga nima yozgan
        billz: bz, diff: bz == null ? null : +(inTotal - bz).toFixed(2),
      };
    });

  return { carry: +carry.toFixed(2), rows, from: a, to: b };
}

// —— Katak ortidagi yozuvlar ————————————————————————
// Jadvaldagi HAR raqam bosiladigan: kun katagi ham, tepadagi "Jami" ham.
// Yozuvlar jadval raqami bilan BITTA manbadan (dayMapOf) chiqadi —
// shuning uchun ro'yxatning yig'indisi katakdagi raqamga doim teng.
//
// colKey — jadvaldagi ustun kaliti:
//   in / out / given          — kirim, chiqim, topshirilgan
//   net                       — kun qoldig'i (kirim va chiqim birga)
//   inCash / inPayme / inService — kirimning hamyon bo'yicha qismi
const SRC_FILTER = {
  in: (s) => s.bucket === "in",
  out: (s) => s.bucket === "out",
  given: (s) => s.bucket === "given",
  net: (s) => s.bucket === "in" || s.bucket === "out",
  inCash: (s) => s.bucket === "in" && s.wallet === "cash",
  inPayme: (s) => s.bucket === "in" && s.wallet === "payme",
  inService: (s) => s.bucket === "in" && s.wallet === "service",
  outCash: (s) => s.bucket === "out" && s.wallet === "cash",
  outPayme: (s) => s.bucket === "out" && s.wallet === "payme",
  outService: (s) => s.bucket === "out" && s.wallet === "service",
};

export const hasSources = (colKey) => !!SRC_FILTER[colKey];

export function kassaSources(kassaId, from, to, colKey = "net") {
  const a = iso(from), b = iso(to);
  const start = getLedgerStart();
  const keep = SRC_FILTER[colKey] ?? (() => true);
  const out = [];
  for (const m of dayMapOf(kassaId, a < start ? start : a, b).values())
    for (const s of m.src) if (keep(s)) out.push(s);
  // Sana bo'yicha, bir kun ichida esa hamyon tartibida (naqd → Payme →
  // servis) — ro'yxat har safar bir xil ko'rinishda chiqsin.
  return out.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1
    : WALLET_IDS.indexOf(x.wallet) - WALLET_IDS.indexOf(y.wallet)));
}

export const kassaDaySources = (kassaId, date, colKey = "net") =>
  kassaSources(kassaId, date, date, colKey);

// —— Yopilmagan kunlar ————————————————————————————
// Kartochkadagi ogohlantirish uchun: bugungi kundan oldingi qaysi
// kunlarda pul harakati bo'lgan-u, kassa yopilmagan.
export function unclosedDays(kassaId, from, to) {
  const start = getLedgerStart();
  const a = iso(from ?? start), b = iso(to ?? new Date());
  const today = iso(new Date());
  const { rows } = kassaDailyRows(kassaId, a < start ? start : a, b);
  return rows
    .filter((r) => r.date < today && !r.close && (r.in > 0.004 || r.out > 0.004))
    .map((r) => r.date);
}

// —— Tasdiq kutayotganlar, kun bo'yicha guruhlangan ————
// Kun yopilganda uchtagacha yozuv tug'iladi (naqd, Payme, servis).
// Rahbarga ular uchta alohida qator bo'lib emas, bitta kun bo'lib
// ko'rinadi — u kunni tasdiqlaydi, hamyonni emas.
export function pendingGroups() {
  const m = new Map();
  for (const o of ops) {
    if (o.kind !== "transfer" || o.status !== "pending") continue;
    const close = o.category === CLOSE;
    const key = `${o.kassa}|${o.date}|${close ? "c" : "m"}`;
    const g = m.get(key) ?? {
      key, kassa: o.kassa, date: o.date, close, total: 0, items: [],
      staffId: o.staffId, note: o.note || "",
    };
    g.total = +(g.total + o.amount).toFixed(2);
    g.items.push({ id: o.id, wallet: o.wallet, amount: o.amount });
    // Hamyonlar doim bir tartibda: naqd, Payme, servis
    g.items.sort((x, y) => WALLET_IDS.indexOf(x.wallet) - WALLET_IDS.indexOf(y.wallet));
    m.set(key, g);
  }
  return [...m.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export const approveGroup = (g, byStaffId) =>
  g.items.forEach((i) => approveTransfer(i.id, byStaffId));
export const rejectGroup = (g, byStaffId) =>
  g.items.forEach((i) => rejectTransfer(i.id, byStaffId));

// —— Kim qaysi kassaga javob beradi ————————————————
// Rahbar hammasini ko'radi. Xodim esa faqat O'Z DO'KONINING kassasini:
// bu profilidagi do'kondan olinadi (profiles.store_id), ya'ni Billz'dagi
// "kassir qaysi kassada ishlaydi" bilan bir xil mantiq.
export function kassasOf(user) {
  if (!user) return [];
  if (user.role === "owner") return kassaIds();
  if (!user.storeId) return [];          // do'koni yo'q — kassasi ham yo'q
  return kassaIds().includes(user.storeId) ? [user.storeId] : [];
}

export const canOperate = (user, kassa) =>
  user?.role === "owner" ? true : kassasOf(user).includes(kassa) && kassa !== COMPANY;
