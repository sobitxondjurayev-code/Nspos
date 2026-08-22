// ══════════════════════════════════════════════════════════════
// BILLZ API MIJOZI — FAQAT SERVER
// ══════════════════════════════════════════════════════════════
// Bu faylda "use client" YO'Q va bo'lmaydi ham: ichida
// BILLZ_SECRET_TOKEN ishlatiladi. U brauzerga tushsa, tokenni olgan
// har kim butun katalog, mijozlar bazasi va sotuv tarixini o'qiy oladi.
// Faqat `app/api/billz/*` va `scripts/billz-sync.mjs` chaqiradi.
//
// Billz 2.0 REST API. Hujjat:
//   https://billzuz.notion.site/API-c2f91aa254f94f8eb7c1b26415dcb25b
//
// Bilib qo'yish kerak bo'lgan uchta narsa (tekshirilgan, 19.08.2026):
//   1. Metod nomlari bir xil emas: tovar `/v2/products` (ko'plik),
//      do'kon `/v1/shop` (birlik), kategoriya `/v2/category`. Taxmin
//      qilib bo'lmaydi — pastdagi ro'yxat sinab ko'rilgan.
//   2. `last_updated_date` faqat "yyyy-mm-dd hh:mm:ss" (UTC) formatini
//      qabul qiladi; ISO yuborilsa BAD_REQUEST qaytadi.
//   3. Kalit chiqarilganda faqat bazaviy metodlar ochiladi. Sotuvlar
//      403 ("access denied") yoki bo'sh ro'yxat qaytarsa — bu xato
//      emas, BILLZ UI'da kalitga rol/huquq berilmagan.

const BASE = process.env.BILLZ_API_URL || "https://api-admin.billz.io";
const SECRET = process.env.BILLZ_SECRET_TOKEN;

export const isConfigured = () => !!SECRET;

// —— Tezlik cheklovi ————————————————————————————————
// Billz bitta IP'dan sekundiga 2 so'rovga ruxsat beradi, oshsa 429.
// Undan ham yomoni: hujjatda "evristik tahlilchi" borligi va shubhali
// IP butunlay bloklanishi yozilgan. Shuning uchun so'rovlar navbatga
// solinadi — parallel yuborilmaydi.
const MIN_GAP_MS = 550;              // ~1.8 so'rov/sek — chegaradan pastda
let queue = Promise.resolve();
let lastAt = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function throttled(fn) {
  const run = queue.then(async () => {
    const wait = lastAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastAt = Date.now();
    return fn();
  });
  // Navbat xato tufayli uzilib qolmasin
  queue = run.then(() => {}, () => {});
  return run;
}

// —— Token ————————————————————————————————————————
// JWT 15 kun yashaydi. Har so'rovda qayta login qilish — bekorga
// sarflangan so'rov (navbatdagi joyni egallaydi), shuning uchun
// xotirada saqlanadi va muddati tugashiga 1 soat qolganda yangilanadi.
let cached = null;      // { token, expMs }

function jwtExp(token) {
  try {
    const p = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    return (p.exp ?? 0) * 1000;
  } catch { return 0; }
}

export async function getToken(force = false) {
  if (!SECRET) throw new Error("BILLZ_SECRET_TOKEN sozlanmagan (.env.local)");
  if (!force && cached && cached.expMs - Date.now() > 3600_000) return cached.token;

  const res = await throttled(() => fetch(`${BASE}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ secret_token: SECRET }),
  }));
  const body = await res.json().catch(() => ({}));
  const token = body?.data?.access_token;
  if (!res.ok || !token) {
    throw new Error(`Billz login xatosi ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
  }
  cached = { token, expMs: jwtExp(token) || Date.now() + 14 * 864e5 };
  return token;
}

// —— So'rov ————————————————————————————————————————
export class BillzError extends Error {
  constructor(status, path, body) {
    super(`Billz ${status} ${path}: ${JSON.stringify(body).slice(0, 200)}`);
    this.status = status;
    this.path = path;
    this.body = body;
    // 403 — kalitga huquq berilmagan. Buni xato deb to'xtatmaymiz:
    // katalog sinxronlanaveradi, faqat sotuvlar o'tkazib yuboriladi.
    this.forbidden = status === 403;
  }
}

const qs = (params) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v === undefined || v === null || v === "") continue;
    u.set(k, Array.isArray(v) ? v.join(",") : String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : "";
};

// Oldingi urinish 401 bergan bo'lsa keyingisida token majburan
// yangilanadi (aks holda o'sha eskirgan token qayta yuborilaverardi).
let lastWas401 = false;

export async function billzGet(path, params, { retries = 3 } = {}) {
  const url = `${BASE}${path}${qs(params)}`;

  for (let attempt = 0; ; attempt++) {
    const token = await getToken(attempt > 0 && lastWas401);
    const res = await throttled(() => fetch(url, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    }));

    // 401 — token eskirgan. Bir marta majburiy qayta login qilamiz.
    if (res.status === 401 && attempt < retries) { lastWas401 = true; continue; }
    lastWas401 = false;

    // 429 yoki serverning vaqtinchalik xatosi — kutib qayta urinamiz.
    // Kutish o'sib boradi: 2s, 4s, 8s.
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      await sleep(2000 * 2 ** attempt);
      continue;
    }

    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.error) throw new BillzError(res.status, path, body);
    return body;
  }
}

// —— Sahifalash ————————————————————————————————————
// Billz javobi bir xil emas: kalit nomi metodga qarab `products`,
// `shops`, `clients`... bo'ladi, jami esa `count` da keladi. `pick`
// aynan shu farqni yopadi.
export async function* pages(path, params, pick, { limit = 100, max = Infinity } = {}) {
  let page = 1;
  let seen = 0;
  for (;;) {
    const body = await billzGet(path, { ...params, page, limit });
    const rows = pick(body) ?? [];
    if (!rows.length) return;
    for (const r of rows) {
      yield r;
      if (++seen >= max) return;
    }
    const total = Number(body.count ?? 0);
    if (rows.length < limit || (total && seen >= total)) return;
    page++;
  }
}

export async function collect(path, params, pick, opts) {
  const out = [];
  for await (const r of pages(path, params, pick, opts)) out.push(r);
  return out;
}

// —— Sana ————————————————————————————————————————
// Billz `last_updated_date` ni "yyyy-mm-dd hh:mm:ss" UTC kutadi.
// Boshqa format (ISO, Z bilan) — BAD_REQUEST.
export const fmtBillzDate = (d) =>
  new Date(d).toISOString().slice(0, 19).replace("T", " ");

// Faqat sana kerak bo'lgan joylar uchun (order-search: start / end_date)
export const fmtBillzDay = (d) => new Date(d).toISOString().slice(0, 10);

// ══════════════════════════════════════════════════════════════
// METODLAR
// ══════════════════════════════════════════════════════════════
// Har biri sinab ko'rilgan; izohda holati ko'rsatilgan.

// ✅ ishlaydi
export const fetchCompany   = () => billzGet("/v1/company");
export const fetchShops     = () => collect("/v1/shop", {}, (b) => b.shops);
export const fetchCategories= () => collect("/v2/category", {}, (b) => b.categories);
export const fetchBrands    = () => collect("/v2/brand", {}, (b) => b.brands);
export const fetchSuppliers = () => collect("/v1/supplier", {}, (b) => b.suppliers);
export const fetchUsers     = () => collect("/v1/user", {}, (b) => b.users);

/** Tovarlar. `since` berilsa faqat o'zgarganlari (inkremental). */
export const productPages = (since, opts) =>
  pages("/v2/products", since ? { last_updated_date: fmtBillzDate(since) } : {},
        (b) => b.products, opts);

/** Mijozlar. */
export const clientPages = (opts) =>
  pages("/v1/client", {}, (b) => b.clients, opts);

/**
 * Sotuvlar. Javob sana bo'yicha guruhlangan holda keladi
 * (`orders_sorted_by_date_list[].orders[]`) — tekislab beramiz.
 *
 * DIQQAT: parametr nomi `start_date` va `end_date`.
 * Hujjatning jadvalida `start` deb yozilgan — U XATO. Sinab ko'rilganda
 * (19.08.2026) `start` e'tiborga olinmaydi va javob faqat bugungi
 * cheklarni qaytaradi: `start=2026-01-01` → 34 ta, `start_date` bilan
 * o'sha oraliq → 8 993 ta. Ya'ni xato parametr xato BERMAYDI, jimgina
 * kam ma'lumot qaytaradi — eng yomon turdagi xato.
 */
// Kursor bo'lmaganda qayerdan boshlanadi. Billz "sanasiz" so'rovni
// bo'sh javob bilan qaytaradi, shuning uchun aniq sana kerak.
// Kompaniya 2015 dan oldin ishlamagan — bu xavfsiz quyi chegara.
const BOSHLANISH = "2015-01-01";

export async function* orderPages({ from, to, shopIds } = {}, { limit = 100, max = Infinity } = {}) {
  let page = 1;
  let seen = 0;
  for (;;) {
    const body = await billzGet("/v3/order-search", {
      page, limit,
      // Ikkala sana ham DOIM yuboriladi. `start_date` bo'lmasa ham
      // Billz bo'sh ro'yxat qaytaradi — ya'ni "hammasini ber" degan
      // ma'no yo'q. Kursor o'qilmay qolgan paytda (`from = null`)
      // sinxronizatsiya jimgina 0 ta chek olardi.
      start_date: fmtBillzDay(from ?? BOSHLANISH),
      // ── `end_date` MAJBURIY ──────────────────────────────────
      // Billz `end_date` siz so'ralganda faqat `start_date` KUNINI
      // qaytaradi — butun oraliqni emas. Bu jimgina xato: so'rov
      // muvaffaqiyatli tugaydi, javob to'g'ri ko'rinadi, shunchaki
      // ma'lumot kam bo'ladi.
      //
      // Aniqlandi 2026-08-22 da, o'lchov bilan:
      //   start_date=2026-08-19               →  34 ta (faqat 19.08)
      //   start_date=2026-08-19 + end_date    → 135 ta (22.08 gacha)
      //
      // Ta'siri: sinxronizatsiya har 30 daqiqada o'sha 34 ta chekni
      // qayta tortardi, kursor 19.08 da qotib qolgandi va 101 ta
      // yangi chek bazaga umuman tushmagandi. Hech qanday xato
      // ko'rinmasdi.
      end_date: fmtBillzDay(to ?? new Date()),
      shop_ids: shopIds,
    });
    const groups = body.orders_sorted_by_date_list ?? [];
    const rows = groups.flatMap((g) => (g.orders ?? []).map((o) => ({ ...o, _date: g.date })));
    if (!rows.length) return;
    for (const r of rows) {
      yield r;
      if (++seen >= max) return;
    }
    const total = Number(body.count ?? 0);
    if (rows.length < limit || (total && seen >= total)) return;
    page++;
  }
}

/**
 * Qarzlar. Javob `{ count, data[] }` ko'rinishida — boshqa metodlarda
 * ro'yxat kaliti nom bilan (`products`, `clients`), bu yerda `data`.
 */
export const debtPages = (params, opts) => pages("/v1/debt", params ?? {}, (b) => b.data, opts);

/**
 * Faqat YOPILMAGAN qarzlar. `status=unpaid` — nomi chalg'itadi: u
 * "to'lanmagan" emas, "TO'LIQ to'lanmagan" degani va ichida `unpaid`
 * ham, `overdue` ham keladi (15 + 258 = 273). Ya'ni bu — hali
 * o'zgarishi mumkin bo'lgan qarzlarning to'liq ro'yxati; qolgan
 * 10 571 tasi yopilgan va boshqa o'zgarmaydi.
 */
export const openDebtPages = (opts) => pages("/v1/debt", { status: "unpaid" }, (b) => b.data, opts);

/** Bitta chek — ichidagi tovarlar bilan. Asosiy teshikni shu yopadi. */
export const fetchOrder = (id) => billzGet(`/v2/order/${id}`);

// —— Tashxis ————————————————————————————————————
// "Nega sotuvlar kelmayapti?" degan savolga bir chaqiriqda javob:
// qaysi metod ochiq, qaysisi huquq kutyapti.
export async function probe() {
  const checks = [
    ["company",    () => fetchCompany()],
    ["shops",      () => billzGet("/v1/shop", { limit: 1 })],
    ["products",   () => billzGet("/v2/products", { limit: 1 })],
    ["categories", () => billzGet("/v2/category", { limit: 1 })],
    ["clients",    () => billzGet("/v1/client", { limit: 1 })],
    ["suppliers",  () => billzGet("/v1/supplier", { limit: 1 })],
    ["users",      () => billzGet("/v1/user", { limit: 1 })],
    // Sanasiz so'ralsa Billz faqat BUGUNGI cheklarni qaytaradi (34 ta) —
    // ekranda bu "sotuv deyarli yo'q" bo'lib ko'rinadi. Shuning uchun
    // oxirgi 30 kun so'raladi.
    ["orders",     () => billzGet("/v3/order-search", {
        limit: 1, page: 1,
        start_date: fmtBillzDay(new Date(Date.now() - 30 * 864e5)),
        end_date: fmtBillzDay(new Date()),
      })],
    ["debts",      () => billzGet("/v1/debt", { limit: 1, page: 1 })],
  ];
  const out = {};
  for (const [name, fn] of checks) {
    try {
      const b = await fn();
      const count = b.count ?? (b.id ? 1 : 0);
      // order-search huquqsiz kalitda 403 emas, BO'SH ro'yxat qaytaradi —
      // shuning uchun 0 ni ham alohida belgilaymiz.
      out[name] = { ok: true, count, empty: count === 0 };
    } catch (e) {
      out[name] = { ok: false, forbidden: !!e.forbidden, error: e.message.slice(0, 160) };
    }
  }
  return out;
}
