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
import { billzKassaFlow } from "./kassaIncome";
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
export function requestTransfer({ kassa, wallet, amount, date, note = "", staffId = null }) {
  const o = {
    id: nextId(), kassa, wallet, kind: "transfer",
    amount: +Number(amount).toFixed(2),
    date: iso(date || new Date()),
    category: null, note, staffId,
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
export function flowSources(from, to, key) {
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
    if (store) {
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
      const billz = +((b.cash?.in ?? 0) + (b.payme?.in ?? 0)).toFixed(2);
      const said = +((kpi[k]?.cash ?? 0) + (kpi[k]?.payme ?? 0)).toFixed(2);
      return {
        kassa: k,
        label: KASSAS[k]?.label ?? k,
        billz, said,
        // Manfiy — menejer Billz ko'rsatgandan KAM topshirgan
        diff: +(said - billz).toFixed(2),
        pct: billz > 0 ? +(((said - billz) / billz) * 100).toFixed(1) : null,
        hasKpi: said > 0,
      };
    });

  return { ready: true, period: flow.period, rows };
}

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
