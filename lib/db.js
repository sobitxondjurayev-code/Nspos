"use client";
// ══════════════════════════════════════════════════════════════
// BAZA QATLAMI
// ══════════════════════════════════════════════════════════════
// Tanlangan arxitektura: "xotirada ishla, bazaga yoz" (write-through).
//
//   1. Ilova ochilganda barcha ma'lumot bir marta bazadan o'qiladi va
//      modullarning xotirasiga joylanadi.
//   2. Sahifalar ilgarigidek SINXRON funksiyalarni chaqiraveradi —
//      salesInRange(), listProducts() va hokazo. Hech qaysi sahifa
//      o'zgartirilmaydi.
//   3. O'zgartirish bo'lganda avval xotira yangilanadi (interfeys
//      darhol javob beradi), keyin fonda bazaga yoziladi.
//   4. Realtime orqali boshqa xodimning o'zgarishi xotiraga tushadi
//      va daraxt qayta chiziladi.
//
// Nega shunday: 5–10 foydalanuvchi va shu hajmdagi ma'lumot uchun eng
// sodda va eng tez yo'l. Har sahifani async qilish 23 ta sahifani
// qayta yozishni talab qilardi va har bosishda kutish paydo bo'lardi.
import { createClient } from "@supabase/supabase-js";
import { tokenOl } from "./sessiya";

// ── Manzil ────────────────────────────────────────────────────
// Kutubxona `@supabase/supabase-js` QOLDIRILDI, lekin u endi
// Supabase'ga emas, O'Z SERVERIMIZDAGI PostgREST'ga boradi.
//
// Nega almashtirilmadi: bu kutubxona aslida PostgREST mijozi, ya'ni
// so'rov yozuvi (`select`, `eq`, ichma-ich `debt_payments(...)`)
// aynan bir xil. O'z mijozimizni yozsak, 50 dan ortiq modulning
// so'rovlari qayta yozilardi — va aynan o'sha yerda "raqam jimgina
// noto'g'ri" xatosi tug'iladi.
//
// `NEXT_PUBLIC_SUPABASE_URL` nomi ham o'zgartirilmadi: u 20 dan
// ortiq joyda ishlatiladi va nomni almashtirish hech qanday foyda
// bermay, xato ehtimolini oshirardi. Endi u shunchaki "baza qaysi
// manzilda" degani.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

// ── Kalit ─────────────────────────────────────────────────────
// Supabase paytida bu "anon key" edi — hamma uchun bitta. Endi bu
// KIRGAN ODAMNING tokeni: PostgREST undan `sub` ni olib
// `request.jwt.claims` ga qo'yadi, baza esa `auth.uid()` orqali
// o'qiydi va RLS ishlaydi.
//
// Token HAR SO'ROVDA cookie'dan o'qiladi (2026-09-03). Ilgari modul
// yuklanganda BIR MARTA o'qilardi: ochiq oynada sessiya yangilansa yoki
// qaytadan kirilsa eski token bilan so'rov ketaverardi (DAFTAR 13.4 —
// ekranda eski raqamlar, jurnalda 401). Endi har so'rov o'sha paytdagi
// cookie'ni oladi; `createClient` ga beriladigan "kalit" faqat `apikey`
// sarlavhasi uchun — bizning PostgREST uni o'qimaydi.
//
// Kirmagan odam ham so'rov yubora oladi — lekin RLS unga hech narsa
// ko'rsatmaydi (sinaldi: 0 sotuv, 0 xarajat, 0 xodim). Ya'ni
// himoya bitta joyda: bazadagi siyosatlarda.
const tokenHozir = () => (typeof document !== "undefined" ? tokenOl() : null) ?? "kirmagan";

// Manzil sozlanmagan bo'lsa demo rejim: hamma narsa xotirada, Billz
// eksporti seed sifatida ishlatiladi.
export const DEMO_MODE = !url;
export const supabase = DEMO_MODE ? null : createClient(url, "kirmagan", {
  auth: {
    // Supabase Auth ISHLATILMAYDI — kirish o'z yo'limizda
    // (`/api/kirish`). Bu sozlamalarsiz kutubxona tokenni
    // localStorage da qidiradi va o'zicha yangilashga urinadi.
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    // Kutubxona o'z `Authorization` ini qo'yadi (kalitdan); biz uni
    // har so'rovda joriy token bilan almashtiramiz.
    fetch: async (manzil, sozlama = {}) => {
      const sarlavha = new Headers(sozlama.headers ?? {});
      sarlavha.set("Authorization", `Bearer ${tokenHozir()}`);
      const t0 = Date.now();
      const javob = await fetch(manzil, { ...sozlama, headers: sarlavha });
      qaydSorov(manzil, Date.now() - t0, javob.headers.get("content-length"));
      return javob;
    },
  },
});

// —— Modullar ro'yxati ————————————————————————————
// Har modul o'zini shu yerga qayd qiladi: qaysi jadvaldan o'qiydi,
// kelgan qatorlarni qanday qabul qiladi.
const modules = new Map();

/**
 * @param {string} name    modul nomi (jurnal uchun)
 * @param {object} cfg
 *   table    — Supabase jadvali nomi
 *   select   — ustunlar (default "*")
 *   order    — { column, ascending }
 *   restore  — (rows) => void, bazadan kelgan qatorlarni xotiraga joylaydi
 *   toRow    — (item) => object, xotiradagi yozuvni jadval qatoriga aylantiradi
 *   fromRow  — (row) => object, teskarisi
 */
export function registerModule(name, cfg) {
  modules.set(name, { name, select: "*", ...cfg });
}

// Ro'yxatdan o'tgan modullar. Brauzerda kerak emas — buni tekshiruv
// skripti (`npm run tekshir`) ishlatadi: u shu ro'yxat bo'yicha har
// modulni haqiqiy baza qatorlari bilan to'ldiradi va keyin ilovaning
// AYNAN o'z funksiyalarini chaqirib raqamlarni solishtiradi.
export const listModules = () => [...modules.values()];

// ══════════════════════════════════════════════════════════════
// YUKLASH O'LCHOVI (2026-09-12)
// ══════════════════════════════════════════════════════════════
// "Ilova sekin ochiladi" degan gapni tuzatishdan OLDIN qaysi jadval
// sekinligi o'lchanadi. DAFTAR 24 dagi xato aynan o'lchamasdan
// xulosa qilishdan chiqqan edi ("huquq yetishmayapti" — aslida yo'q).
//
// Har jadval uchun: nechta qator, necha so'rov, qancha bayt, necha
// millisekund. Bayt `content-length` dan — nginx JSON'ni gzip bilan
// beradi, ya'ni bu TARMOQDAN o'tgan hajm. Sarlavha bo'lmasa (chunked
// javob) `null` yoziladi: 0 yozilsa "hech narsa kelmadi" degan
// yolg'on bo'lardi.
const sorovlar = new Map();   // jadval → { soni, ms, bayt }

function jadvalNomi(manzil) {
  const yol = String(manzil).split("?")[0];
  const m = yol.match(/\/rest\/v1\/(?:rpc\/)?([^/?]+)/);
  return m ? m[1] : null;
}

function qaydSorov(manzil, ms, uzunlik) {
  const nom = jadvalNomi(manzil);
  if (!nom) return;
  const q = sorovlar.get(nom) ?? { soni: 0, ms: 0, bayt: null };
  q.soni += 1;
  q.ms += ms;
  const bayt = uzunlik == null ? null : Number(uzunlik);
  if (Number.isFinite(bayt)) q.bayt = (q.bayt ?? 0) + bayt;
  sorovlar.set(nom, q);
}

export const sorovOlchovi = () => Object.fromEntries(sorovlar);

// ══════════════════════════════════════════════════════════════
// QAYSI SANADAN BERI MA'LUMOT TO'LIQ
// ══════════════════════════════════════════════════════════════
// Og'ir jadval (chek + chek qatorlari) IKKI TO'LQINDA keladi: avval
// oxirgi `OYNA_KUN` kun, keyin qolgan tarix. Orasidagi bir necha
// soniyada ekran ikki xil xato qilishi mumkin edi:
//
//   - butun sahifani "yuklanmoqda" qilib qo'yish — ma'lumot aslida
//     bor, foydalanuvchi behuda kutadi;
//   - bor ma'lumotni ko'rsatib qo'yish — "Yil" davri tanlangan bo'lsa
//     raqam KAM chiqadi va buni hech narsa bildirmaydi.
//
// Shuning uchun ilova aynan qaysi SANADAN beri ma'lumot to'liq ekanini
// biladi: davri o'sha sanadan keyin boshlanadigan sahifa darrov
// chiziladi, oldin boshlanadigani esa to'liq yuklanishni kutadi
// (`useDavrToliq`).
const modulHolat = new Map();    // jadval → kesim sanasi (ISO) yoki null (to'liq)
let kutilganModul = 0;
let oynaTayyor = false;          // hamma modul kamida bir to'lqin berdi
let oynaChegara = null;          // eng KECH kesim sanasi (ISO) yoki null
const oynaKuzatuvchilar = new Set();

export const oynaHolat = () => ({ tayyor: oynaTayyor, dan: oynaChegara });

export function onOyna(fn) {
  if (typeof fn !== "function") return () => {};
  if (oynaTayyor) { queueMicrotask(fn); return () => {}; }
  oynaKuzatuvchilar.add(fn);
  return () => oynaKuzatuvchilar.delete(fn);
}

function holatQoy(table, sana) {
  modulHolat.set(table, sana);
  if (modulHolat.size < kutilganModul) return;
  // Eng KECH kesim: bitta modul 120 kunlik oyna bilan kelgan bo'lsa,
  // butun ilova o'sha sanagacha "to'liq emas" hisoblanadi.
  const chegara = [...modulHolat.values()]
    .reduce((eng, s) => (s && (!eng || s > eng) ? s : eng), null);
  const ozgardi = !oynaTayyor || chegara !== oynaChegara;
  oynaTayyor = true;
  oynaChegara = chegara;
  if (!ozgardi) return;
  for (const fn of oynaKuzatuvchilar) { try { fn(); } catch {} }
}

// —— Ma'lumot versiyasi ————————————————————————————
// Og'ir hisoblar natijani keshlaydi (`kassaIncome.kunlikKirim` — u 9 263
// chek, 35 312 chek qatori va 16 123 qarz to'lovini aylanib chiqadi va
// har xodim-oy uchun chaqiriladi). Kesh qachon eskirganini bilishi uchun
// BITTA hisoblagich yetadi: xotiradagi qatorlar almashganda o'sadi
// (`sync.js` → restore/apply/created/changed/deleted).
//
// Nega uzunligi bilan emas: mavjud chek YANGILANSA uzunlik o'zgarmaydi.
// Billz sinxroni aynan shunday ishlaydi — qo'shadi VA yangilaydi, ya'ni
// uzunlikka tayangan kesh jimgina eski raqamni ko'rsatib turardi.
let dataV = 0;
export const dataVersion = () => dataV;
export const bumpData = () => { dataV += 1; };

// —— Xotira ORQAGA qaytganda ekranni qayta chizish ——————————
// Baza yozuvni rad etsa (RLS, sessiya) `sync.js` xotirani oldingi
// holatga qaytaradi. Lekin sahifa buni o'zi sezmaydi — u o'z `tick`
// holati bilan chizilgan. Shu tinglovchi `DataProvider` ga "version"
// ni oshirishni aytadi (`useLive`). Bir tick ichidagi bir nechta
// qaytarish BITTA xabarga yig'iladi.
const xotiraKuzatuvchilar = new Set();
let xotiraXabarRejalangan = false;
export const onXotira = (fn) => { xotiraKuzatuvchilar.add(fn); return () => xotiraKuzatuvchilar.delete(fn); };
export function xotiraYangilandi() {
  bumpData();
  if (xotiraXabarRejalangan || !xotiraKuzatuvchilar.size) return;
  xotiraXabarRejalangan = true;
  setTimeout(() => {
    xotiraXabarRejalangan = false;
    for (const fn of xotiraKuzatuvchilar) { try { fn(); } catch {} }
  }, 0);
}

// —— Boshlang'ich yuklash ————————————————————————
let bootstrapped = false;
export const isBootstrapped = () => bootstrapped;

// ══════════════════════════════════════════════════════════════
// OG'IR JADVALLAR TUGAGANDA XABAR — NEGA RO'YXAT KERAK
// ══════════════════════════════════════════════════════════════
// Ilgari `bootstrap(onBackground)` bitta funksiyani olardi va uni
// og'ir jadvallar yuklangach chaqirardi. Ikki teshigi bor edi:
//
//   1. Chaqiruvchi (`DataProvider`) uni `alive && setVersion(...)`
//      bilan o'rardi. React effekti qayta ishga tushsa (sahifa
//      almashgan, sessiya yangilangan) `alive` FALSE bo'lardi — va
//      10 soniyadan keyin kelgan xabar hech kimga yetmasdi.
//   2. Ikkinchi chaqiriqda `bootstrapped` allaqachon true, ya'ni
//      yangi funksiya umuman ro'yxatga olinmasdi.
//
// Natijasi: BOSH SAHIFA abadiy "0.00 USD" ko'rsatardi. Ma'lumot
// bazadan kelgan, xotirada turgan — lekin ekran qayta chizilmagan.
// Boshqa sahifalar ishlardi, chunki ular ma'lumot kelgandan KEYIN
// ochilardi. (2026-08-22 da brauzerda topildi.)
//
// Endi: tinglovchilar RO'YXATI, va yuklash allaqachon tugagan
// bo'lsa yangi tinglovchi DARROV xabar oladi.
let backgroundDone = false;
const backgroundListeners = new Set();

function backgroundTugadi() {
  backgroundDone = true;
  for (const fn of backgroundListeners) { try { fn(); } catch {} }
}

export function onBackgroundReady(fn) {
  if (typeof fn !== "function") return () => {};
  if (backgroundDone) { queueMicrotask(fn); return () => {}; }
  backgroundListeners.add(fn);
  return () => backgroundListeners.delete(fn);
}

// Ilova ochilishi uchun ZARUR bo'lgan kichik jadvallar. Faqat shular
// kutiladi — ilova darrov ochiladi. Og'irlari (savdo/tovar/mijoz)
// orqada yuklanadi.
const CRITICAL = new Set([
  "profiles", "stores", "store_plans", "companies",
  "kpi_assign", "kpi_plan", "kpi_day", "nps_records",
  "kassa_ops", "payouts",
  // Xarajat turlari — Xarajat oynasi ilova ochilishi bilan kerak (2026-09-03)
  "expense_categories",
  // Huquq matritsasi — menyu va tugmalar shundan (2026-09-03)
  "role_permissions",
]);

// PostgREST bitta so'rovda `max-rows` dan ortiq qaytarmaydi (bizda
// 10 000), shuning uchun har jadval sahifalab o'qiladi.
//
// ── NEGA 5000, 1000 EMAS ──
// Server Yevropada, foydalanuvchi O'zbekistonda — har so'rov borib
// kelishi ~250 ms. 1000 qatorda: savdo 10 so'rov, qarz 12, mijoz 10,
// jami 40 dan ortiq borib-kelish = 10 soniyadan ko'p FAQAT kutishga
// ketardi.
//
// O'lchandi (2026-08-22, bosh sahifada raqam chiqquncha):
//   1000 qator → 26.9 soniya
//   5000 qator → pastda yozilgan
//
// 10 000 emas: `max-rows` ga tegib turish xavfli — jadval o'ssa
// PostgREST jimgina kesib qo'yadi va biz buni sezmaymiz.
const PAGE = 5000;

// Bitta sahifa. `hisob` berilsa PostgREST javob bilan BIRGA jami
// sonni ham qaytaradi (`count=exact`) — ya'ni "nechta qator bor"
// uchun alohida so'rov ketmaydi.
async function sahifaOl(m, from, { hisob = false, gte, lt } = {}) {
  // readTable — o'qish uchun boshqa manba. Xodimlar ro'yxati shu
  // orqali ketadi: yozish profiles ga, o'qish esa staff_directory
  // ko'rinishidan (u oylikni faqat rahbarga ko'rsatadi).
  let q = supabase.from(m.readTable ?? m.table)
    .select(m.select, hisob ? { count: "exact" } : undefined);
  if (m.order) q = q.order(m.order.column, { ascending: m.order.ascending ?? true });
  if (gte) q = q.gte(gte[0], gte[1]);
  if (lt) q = q.lt(lt[0], lt[1]);
  const { data, error, count } = await q.range(from, from + PAGE - 1);
  if (error) throw error;
  return { data, count };
}

// ── NEGA SAHIFALAR BAROBAR OLINADI (2026-09-12) ──
// Ilgari sahifalar KETMA-KET olinardi: 11 752 qarz = 3 ta borib-kelish,
// har biri ~250 ms + javobni kutish. Jami soni birinchi sahifa bilan
// birga kelgani uchun qolgan sahifalarni kutib o'tirmasdan barobar
// so'rash mumkin.
//
// Oxirgi halqa ATAYLAB qoldirilgan: yuklash paytida yangi qator
// qo'shilsa (Billz sinxroni har 5 daqiqada yozadi) jami son eskirgan
// bo'ladi va oxirida qolib ketgan qatorlar ketma-ket olinadi. Busiz
// chek jimgina tushib qolardi.
async function readAll(m, filtr = {}) {
  const bir = await sahifaOl(m, 0, { ...filtr, hisob: true });
  const out = [...bir.data];
  if (bir.data.length < PAGE) return out;

  let keyingi = PAGE;
  const jami = Number.isFinite(bir.count) ? bir.count : null;
  if (jami != null && jami > PAGE) {
    const boshlar = [];
    for (let from = PAGE; from < jami; from += PAGE) boshlar.push(from);
    const javoblar = await Promise.all(boshlar.map((from) => sahifaOl(m, from, filtr)));
    for (const j of javoblar) out.push(...j.data);
    const oxirgi = javoblar[javoblar.length - 1];
    if (oxirgi.data.length < PAGE) return out;
    keyingi = boshlar[boshlar.length - 1] + PAGE;
  }

  for (let from = keyingi; ; from += PAGE) {
    const j = await sahifaOl(m, from, filtr);
    out.push(...j.data);
    if (j.data.length < PAGE) return out;
  }
}

// Og'ir jadval nechta kunlik birinchi to'lqin bilan keladi.
// 120 kun — bosh sahifa (Oy), KPI va kassa davrlari shu ichida;
// "Yil" va hisobotlar ikkinchi to'lqinni kutadi (`useDavrToliq`).
const OYNA_KUN = 120;
const oynaSanasi = (kun) => new Date(Date.now() - kun * 86400_000).toISOString();

async function loadModule(m, ctx) {
  const t0 = Date.now();
  const qabul = (rows) => m.restore(rows.map((r) => (m.fromRow ? m.fromRow(r) : r)));
  // Yiqilib qolsa qaysi holat aytiladi: birinchi to'lqin kelgan bo'lsa
  // kesim sanasi, aks holda null. Ikkinchi to'lqin yiqilib, holat
  // "to'liq" deb aytilsa — bu ekranda kam raqamni to'liq qilib
  // ko'rsatardi, ya'ni yana o'sha ishonarli yolg'on.
  let holatSana = null;
  try {
    if (m.oyna) {
      // 1-to'lqin: oxirgi kunlar — ekran shu bilan chiziladi
      const chegara = oynaSanasi(m.oyna.kun ?? OYNA_KUN);
      const yangi = await readAll(m, { gte: [m.oyna.ustun, chegara] });
      qabul(yangi);
      holatSana = chegara;
      holatQoy(m.table, chegara);
      // 2-to'lqin: qolgan tarix. Xotiraga IKKALASI birga qo'yiladi —
      // `restore` ro'yxatni almashtiradi, ya'ni faqat eskisini bersak
      // yangi cheklar yo'qolardi.
      const eski = await readAll(m, { lt: [m.oyna.ustun, chegara] });
      const hammasi = [...yangi, ...eski];
      qabul(hammasi);
      holatSana = null;
      ctx.loaded += hammasi.length;
      ctx.report.push({ table: m.table, rows: hammasi.length, ms: Date.now() - t0, oyna: yangi.length });
    } else {
      const rows = await readAll(m);
      qabul(rows);
      ctx.loaded += rows.length;
      ctx.report.push({ table: m.table, rows: rows.length, ms: Date.now() - t0 });
    }
    holatQoy(m.table, null);
  } catch (e) {
    console.error(`[db] ${m.name} yuklanmadi:`, e.message);
    const missing = e.code === "PGRST205" || e.code === "42P01" ||
      /could not find the table|does not exist/i.test(e.message ?? "");
    ctx.report.push({ table: m.table, error: missing ? "jadval yo'q" : e.message });
    if (missing) ctx.pending.add(m.table);
    else if (sessiyaTugadimi(e)) sessiyaXabar();
    else notify(`${m.table}: ${e.message}`);
    // Yiqilgan modul ham holat beradi: aks holda "davr to'liq keldi"
    // signali hech qachon chiqmaydi va butun ilova abadiy
    // "yuklanmoqda" bo'lib qolardi. Xatoning o'zi yuqorida aytilgan.
    holatQoy(m.table, holatSana);
  }
}

export async function bootstrap(onBackground) {
  const ochir = onBackgroundReady(onBackground);
  if (DEMO_MODE || bootstrapped) {
    bootstrapped = true;
    if (DEMO_MODE) backgroundTugadi();
    return { demo: DEMO_MODE, loaded: 0, ochir };
  }

  const ctx = { loaded: 0, report: [], pending: new Set() };
  const all = [...modules.values()];
  // Nechta modul holat berishi kutiladi (`holatQoy`) — shusiz
  // "davr to'liq keldi" signali erta chiqib ketardi.
  kutilganModul = all.length;
  const critical = all.filter((m) => CRITICAL.has(m.table));
  const background = all.filter((m) => !CRITICAL.has(m.table));

  // 1) Zarur kichik jadvallar — kutamiz (bir necha yuz qator, tez)
  await Promise.all(critical.map((m) => loadModule(m, ctx)));
  bootstrapped = true;

  // 2) Og'ir jadvallar — orqada, kutmasdan. Tugagach bir marta
  //    interfeysni yangilaymiz (dashboard/hisobotlar to'ladi).
  Promise.all(background.map((m) => loadModule(m, ctx))).then(() => {
    backgroundTugadi();
    // `console.table` chiroyli, lekin uni DASTURDAN o'qib bo'lmaydi
    // (DevTools protokoli faqat "Array(27)" deb ko'rsatadi). Shuning
    // uchun yoniga bitta o'qiladigan qator: qaysi jadvaldan nechta
    // qator kelgani. Brauzer tekshiruvi aynan shuni o'qiydi.
    console.log("[db] yuklandi:", ctx.report.map((r) => `${r.table}=${r.error ? "XATO" : r.rows}`).join(" "));
    // O'lchov: qator soni yonida VAQT, so'rov soni va tarmoqdan
    // o'tgan hajm. Aynan shu jadval "nima sekin?" degan savolga
    // taxmin emas, raqam beradi (`window.__nsposYuklash`).
    console.table(ctx.report.map((r) => {
      const q = sorovlar.get(r.table) ?? {};
      return {
        jadval: r.table,
        qator: r.error ? "XATO" : r.rows,
        soniya: r.ms == null ? null : +(r.ms / 1000).toFixed(1),
        sorov: q.soni ?? null,
        KB: q.bayt == null ? null : Math.round(q.bayt / 1024),
      };
    }));
    if (ctx.pending.size) console.info("[db] hali o'rnatilmagan jadvallar:", [...ctx.pending].join(", "));
  });

  // Saytda o'lchashning yagona yo'li — konsol. `console.table` ni
  // dasturdan o'qib bo'lmaydi (DevTools "Array(27)" deb ko'rsatadi),
  // shuning uchun raqamlar obyekt bo'lib ham qoldiriladi:
  //   __nsposYuklash()   → { jadvallar: [...], sorovlar: {...} }
  if (typeof window !== "undefined") {
    window.__nsposYuklash = () => ({ jadvallar: ctx.report, sorovlar: sorovOlchovi() });
  }

  return { demo: false, loaded: ctx.loaded, report: ctx.report, pending: [...ctx.pending], ochir };
}

// —— Yozish ————————————————————————————————————
// Xotira allaqachon yangilangan, bu yerda faqat bazaga yetkazamiz.
// Xato bo'lsa foydalanuvchiga ko'rsatiladi, lekin interfeys qotmaydi.
const listeners = new Set();
export const onDbError = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const notify = (msg) => listeners.forEach((fn) => fn(msg));

// ── SESSIYA TUGAGANI ALOHIDA XATO ─────────────────────────────
// PostgREST muddati o'tgan tokenga 401 va `PGRST301` beradi. Bu
// boshqa xatolardan TUBDAN farq qiladi: baza ham, tarmoq ham
// joyida, foydalanuvchi shunchaki qaytadan kirishi kerak.
//
// Ilgari u "Bazaga yozilmadi: JWT expired" bo'lib chiqardi — ya'ni
// xodim nima qilishini bilmasdi va odatda e'tibor bermay ishlashda
// davom etardi. Kiritgani esa saqlanmasdi. (2026-08-24)
const SESSIYA_TUGADI = "Sessiya muddati tugagan — qaytadan kiring.";
export const sessiyaTugadimi = (e) =>
  e?.code === "PGRST301" || e?.status === 401 ||
  /jwt (expired|invalid)|jwsError/i.test(e?.message ?? "");

// Bir marta aytiladi: har so'rov uchun takrorlansa ekran xabarga
// to'lib ketardi.
let sessiyaAytildi = false;
function sessiyaXabar() {
  if (sessiyaAytildi) return;
  sessiyaAytildi = true;
  notify(SESSIYA_TUGADI);
}

// Bazaning xato matni xodim tiliga o'giriladi. Asl matn konsolda
// qoladi. "new row violates row-level security policy" xodim uchun
// hech narsa demaydi — "ruxsat yo'q" esa nima qilishni aytadi.
export function xatoMatni(e) {
  const m = e?.message ?? String(e ?? "");
  if (e?.code === "42501" || /row-level security/i.test(m)) return "ruxsat yo'q (baza siyosati)";
  if (e?.code === "PGRST116" || e?.code === "NSPOS_0") return "ruxsat yo'q yoki yozuv topilmadi";
  if (e?.code === "23503") return "bog'liq yozuv bor — o'chirib bo'lmaydi";
  if (e?.code === "23505") return "bunday yozuv allaqachon bor";
  return m;
}

// Modullar o'z xabarini ham shu toast orqali beradi (bola jadval
// yozuvchilari, hisobot fayli) — xato yutilmasin.
export const dbXabar = (msg) => notify(msg);

async function run(promise, what, silent = false, { kamidaBir = false } = {}) {
  if (DEMO_MODE) return { ok: true, demo: true };
  const { data, error } = await promise;
  if (error) {
    console.error(`[db] ${what}:`, error.message);
    // Sessiya tugagani "jim rejim"ga ham bo'ysunmaydi: yozuv
    // saqlanmagani va sababi AYTILISHI shart, aks holda xodim
    // bilmay ishlab yuraveradi.
    if (sessiyaTugadimi(error)) sessiyaXabar();
    // Jim rejim: faqat AVTOMAT yozuvlar uchun (kurs). Odam bosgan
    // tugmaning natijasi hech qachon jim bo'lmaydi (2026-09-03).
    else if (!silent) notify(`${what}: ${xatoMatni(error)}`);
    return { ok: false, error };
  }
  // ── 0 QATOR = XATO ────────────────────────────────────────────
  // PostgREST RLS rad etgan o'chirishga xato BERMAYDI: 204 va bo'sh
  // ro'yxat. Ilgari `remove()` `.select()` siz ketardi va har rad
  // etilgan o'chirish "ok" bo'lib qaytardi — tovar, menejerning
  // kechagi xarajati ekrandan yo'qolib, F5 da qaytib kelardi
  // (2026-09-03). Endi o'chirilgan qatorlar so'raladi va nol bo'lsa
  // bu XATO.
  if (kamidaBir && Array.isArray(data) && data.length === 0) {
    const err = { code: "NSPOS_0", message: "ruxsat yo'q yoki yozuv topilmadi" };
    console.error(`[db] ${what}: 0 qator (ruxsat yo'q yoki yozuv yo'q)`);
    if (!silent) notify(`${what}: ${err.message}`);
    return { ok: false, error: err };
  }
  return { ok: true, data };
}

export const insert = (table, row, what = "saqlash") =>
  DEMO_MODE ? Promise.resolve({ ok: true, demo: true })
            : run(supabase.from(table).insert(row).select().single(), what);

export const update = (table, id, patch, what = "yangilash", silent = false) =>
  DEMO_MODE ? Promise.resolve({ ok: true, demo: true })
            : run(supabase.from(table).update(patch).eq("id", id).select().single(), what, silent);

// `.select("id")` — o'chirilgan qatorlar qaytsin; nol bo'lsa `run` xato beradi
export const remove = (table, id, what = "o'chirish") =>
  DEMO_MODE ? Promise.resolve({ ok: true, demo: true })
            : run(supabase.from(table).delete().eq("id", id).select("id"), what, false, { kamidaBir: true });

// Bor bo'lsa yangilaydi, yo'q bo'lsa qo'shadi (PK yoki `conflict`
// ustunlari bo'yicha). KPI kunlik yozuvlari shu orqali yoziladi:
// bir kun bir necha marta tahrirlanadi, har safar ustiga yoziladi.
export const upsert = (table, row, conflict, what = "saqlash", silent = false) =>
  DEMO_MODE ? Promise.resolve({ ok: true, demo: true })
            : run(supabase.from(table).upsert(row, conflict ? { onConflict: conflict } : undefined)
                          .select().single(), what, silent);

// Atomik amallar SQL funksiyalari orqali (schema.sql, 13-bo'lim).
// Qoldiq kamaytirish va chek raqami aynan shu yerda o'tadi — ikki
// kassir bir vaqtda ishlaganda poyga bo'lmasligi uchun.
export const rpc = (fn, args, what = fn, silent = false) =>
  DEMO_MODE ? Promise.resolve({ ok: true, demo: true })
            : run(supabase.rpc(fn, args), what, silent);

// —— Jonli yangilanish ————————————————————————
// Boshqa xodim tovar sotsa qoldiq shu yerda yangilanadi.
//
// Ilgari Supabase Realtime (WebSocket) ishlatilardi. PostgREST'da
// unday narsa yo'q, shuning uchun DAVRIY SO'ROV.
//
// Nega WebSocket qayta qurilmadi: bu 5-10 xodimlik tizim va
// o'zgarish kuniga bir necha o'nlab marta bo'ladi. Har 20 soniyada
// bitta yengil so'rov — kuniga ~1 500 so'rov, ya'ni hech narsa.
// WebSocket xizmati esa yana bitta ishlab turishi kerak bo'lgan
// dastur, uzilishlarni qayta ulash mantig'i va nosozlik manbai
// bo'lardi. Ehtiyoj paydo bo'lsa `LISTEN/NOTIFY` bilan qo'shiladi.
//
// So'rov FAQAT jadval eng oxirgi marta qachon o'zgargani haqida
// (`max(updated_at)`), ya'ni butun jadval tortilmaydi.
//
// ── NEGA BITTA SO'ROV (2026-09-12) ────────────────────────────
// Ilgari har 20 soniyada HAR JADVAL uchun alohida so'rov ketardi va
// ular KETMA-KET edi: 21 ta jadval × ~250 ms = har aylanish
// ~5 soniya uzluksiz so'rov, kun bo'yi. Yomoni — bu birinchi
// aylanish ILOVA OCHILAYOTGANDA boshlanardi va brauzerning bitta
// manzilga ochadigan 6 ta ulanishini og'ir jadvallar bilan bo'lishib
// olardi, ya'ni yuklanishni sekinlashtirardi.
//
// Endi bitta chaqiriq (`jadval_yangilanish`) hamma jadvalning
// `max(updated_at)` ini qaytaradi. Funksiya `security invoker` —
// RLS o'z kuchida, ya'ni xodim ko'ra olmaydigan qator uni bezovta
// ham qilmaydi.
//
// Migratsiya qo'llanmagan bazada funksiya yo'q (PGRST202) — o'shanda
// eski yo'lga tushiladi, lekin BIR MARTA aytib: jimgina sekin
// ishlab turgan tizim eng yomon holat (DAFTAR 24).
const TEKSHIRISH_ORALIGI = 20_000;
const funksiyaYoq = (e) =>
  e?.code === "PGRST202" || /could not find the function|does not exist/i.test(e?.message ?? "");

export function subscribeAll(onChange) {
  if (DEMO_MODE) return () => {};

  const realtimeModullar = [...modules.values()].filter((m) => m.realtime);
  if (!realtimeModullar.length) return () => {};
  const nomlar = realtimeModullar.map((m) => m.table);

  const oxirgi = new Map();
  const xatolar = new Map();      // jadval → ketma-ket nechta xato
  const aytildi = new Set();      // bir xato ikki marta bezovta qilmasin
  let toxtadi = false;
  let rpcBor = true;              // bitta so'rovli yo'l ishlaydimi

  // ── NEGA XATO YUTILMAYDI ────────────────────────────────────
  // Ilgari bu yerda `catch {}` turardi: "tarmoq uzilsa jim o'tamiz".
  // Natijada 2026-08-22 gacha jonli yangilanish UMUMAN ishlamagani
  // bilinmadi — 39 jadvaldan 33 tasida `updated_at` ustuni yo'q edi
  // va PostgREST har so'rovga 400 qaytarardi. Har 20 soniyada, jim.
  //
  // Endi: bir-ikki xato (tarmoq uzilishi) jimgina o'tadi, lekin
  // KETMA-KET uchtasi rahbarga aytiladi.
  function xatoAyt(nom, e) {
    // Sessiya tugagan bo'lsa so'rashning ma'nosi yo'q — hammasi bir
    // xil 401 beradi. Kuzatuv butunlay to'xtaydi: aks holda ochiq
    // oyna har 20 soniyada befoyda so'rov yuborib turardi
    // (nginx jurnalida shu ko'rindi, 2026-08-24).
    if (sessiyaTugadimi(e)) { toxtadi = true; sessiyaXabar(); return; }
    const n = (xatolar.get(nom) ?? 0) + 1;
    xatolar.set(nom, n);
    if (n >= 3 && !aytildi.has(nom)) {
      aytildi.add(nom);
      notify(`${nom}: jonli yangilanish ishlamayapti — ${e?.message ?? e}`);
    }
  }

  // Jadval o'zgargan bo'lsa xabar beramiz. Birinchi o'qishda
  // berilmaydi — u boshlang'ich holat.
  function qoy(table, yangi) {
    if (!yangi) return;
    const eski = oxirgi.get(table);
    oxirgi.set(table, yangi);
    if (eski && eski !== yangi) onChange?.(table, { table });
  }

  // Yo'l 1 — bitta chaqiriq (hamma jadval)
  async function hammasiBirda() {
    const { data, error } = await supabase.rpc("jadval_yangilanish", { jadvallar: nomlar });
    if (error) {
      if (!funksiyaYoq(error)) throw error;
      rpcBor = false;
      console.info(
        "[db] `jadval_yangilanish` funksiyasi bazada yo'q — jonli yangilanish eski (jadvalma-jadval) yo'lda. " +
        "Migratsiya: node scripts/sql.mjs -f scripts/sql/jadval-yangilanish.sql");
      return false;
    }
    xatolar.delete("jadval_yangilanish");
    for (const r of data ?? []) qoy(r.jadval, r.ozgargan);
    return true;
  }

  // Yo'l 2 — zaxira: har jadval alohida (migratsiya qo'llanmagan baza)
  async function birmaBir() {
    for (const m of realtimeModullar) {
      if (toxtadi) return;
      try {
        const { data, error } = await supabase
          .from(m.table)
          .select("updated_at")
          .order("updated_at", { ascending: false })
          .limit(1);
        if (error) throw error;
        xatolar.delete(m.table);
        qoy(m.table, data?.[0]?.updated_at ?? null);
      } catch (e) {
        xatoAyt(m.table, e);
      }
    }
  }

  async function tekshir() {
    if (toxtadi || document.hidden) return;   // fon oynada so'ramaymiz
    if (rpcBor) {
      try {
        if (await hammasiBirda()) return;
      } catch (e) {
        // Tarmoq yoki baza xatosi — 21 ta so'rovga tushib ketmaymiz,
        // keyingi aylanishda qaytadan uriniladi.
        xatoAyt("jadval_yangilanish", e);
        return;
      }
    }
    await birmaBir();
  }

  // ── KUZATUV YUKLASHDAN KEYIN BOSHLANADI ───────────────────────
  // Ilgari birinchi tekshiruv `bootstrap()` bilan BIR VAQTDA ketardi
  // va brauzerning 6 ta ulanishini og'ir jadvallar bilan bo'lishardi:
  // kuzatuv so'rovlari yengil bo'lsa ham, navbatda chek va qarz
  // oldida turardi. Endi og'ir jadvallar kelgach boshlanadi.
  let t = null;
  const faollashdi = () => { if (!document.hidden) tekshir(); };
  const boshla = () => {
    if (toxtadi) return;
    tekshir();
    t = setInterval(tekshir, TEKSHIRISH_ORALIGI);
    document.addEventListener("visibilitychange", faollashdi);
  };
  const ochirBoshlash = onBackgroundReady(boshla);

  return () => {
    toxtadi = true;
    ochirBoshlash();
    if (t) clearInterval(t);
    document.removeEventListener("visibilitychange", faollashdi);
  };
}
