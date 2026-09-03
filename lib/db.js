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
    fetch: (manzil, sozlama = {}) => {
      const sarlavha = new Headers(sozlama.headers ?? {});
      sarlavha.set("Authorization", `Bearer ${tokenHozir()}`);
      return fetch(manzil, { ...sozlama, headers: sarlavha });
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
async function readAll(m) {
  const PAGE = 5000;
  const out = [];
  for (let from = 0; ; from += PAGE) {
    // readTable — o'qish uchun boshqa manba. Xodimlar ro'yxati shu
    // orqali ketadi: yozish profiles ga, o'qish esa staff_directory
    // ko'rinishidan (u oylikni faqat rahbarga ko'rsatadi).
    let q = supabase.from(m.readTable ?? m.table).select(m.select);
    if (m.order) q = q.order(m.order.column, { ascending: m.order.ascending ?? true });
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < PAGE) return out;
  }
}

async function loadModule(m, ctx) {
  try {
    const rows = await readAll(m);
    m.restore(rows.map((r) => (m.fromRow ? m.fromRow(r) : r)));
    ctx.loaded += rows.length;
    ctx.report.push({ table: m.table, rows: rows.length });
  } catch (e) {
    console.error(`[db] ${m.name} yuklanmadi:`, e.message);
    const missing = e.code === "PGRST205" || e.code === "42P01" ||
      /could not find the table|does not exist/i.test(e.message ?? "");
    ctx.report.push({ table: m.table, error: missing ? "jadval yo'q" : e.message });
    if (missing) ctx.pending.add(m.table);
    else if (sessiyaTugadimi(e)) sessiyaXabar();
    else notify(`${m.table}: ${e.message}`);
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
    console.table(ctx.report);
    if (ctx.pending.size) console.info("[db] hali o'rnatilmagan jadvallar:", [...ctx.pending].join(", "));
  });

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
const TEKSHIRISH_ORALIGI = 20_000;

export function subscribeAll(onChange) {
  if (DEMO_MODE) return () => {};

  const realtimeModullar = [...modules.values()].filter((m) => m.realtime);
  if (!realtimeModullar.length) return () => {};

  const oxirgi = new Map();
  const xatolar = new Map();      // jadval → ketma-ket nechta xato
  const aytildi = new Set();      // bir xato ikki marta bezovta qilmasin
  let toxtadi = false;

  async function tekshir() {
    if (toxtadi || document.hidden) return;   // fon oynada so'ramaymiz
    for (const m of realtimeModullar) {
      try {
        const { data, error } = await supabase
          .from(m.table)
          .select("updated_at")
          .order("updated_at", { ascending: false })
          .limit(1);

        // ── NEGA XATO YUTILMAYDI ──────────────────────────────
        // Ilgari bu yerda `catch {}` turardi: "tarmoq uzilsa jim
        // o'tamiz". Natijada 2026-08-22 gacha jonli yangilanish
        // UMUMAN ishlamagani bilinmadi — 39 jadvaldan 33 tasida
        // `updated_at` ustuni yo'q edi va PostgREST har so'rovga
        // 400 qaytarardi. Har 20 soniyada, jim.
        //
        // Endi: bir-ikki xato (tarmoq uzilishi) jimgina o'tadi,
        // lekin KETMA-KET uchtasi rahbarga aytiladi.
        if (error) throw error;

        xatolar.delete(m.table);
        const yangi = data?.[0]?.updated_at ?? null;
        if (!yangi) continue;
        const eski = oxirgi.get(m.table);
        oxirgi.set(m.table, yangi);
        // Birinchi o'qishda xabar berilmaydi — u boshlang'ich holat
        if (eski && eski !== yangi) onChange?.(m.table, { table: m.table });
      } catch (e) {
        // Sessiya tugagan bo'lsa qolgan jadvallarni so'rashning
        // ma'nosi yo'q — hammasi bir xil 401 beradi. Kuzatuv
        // butunlay to'xtaydi: aks holda ochiq oyna har 20 soniyada
        // 39 ta befoyda so'rov yuborib turardi (nginx jurnalida
        // shu ko'rindi, 2026-08-24).
        if (sessiyaTugadimi(e)) { toxtadi = true; sessiyaXabar(); return; }
        const n = (xatolar.get(m.table) ?? 0) + 1;
        xatolar.set(m.table, n);
        if (n >= 3 && !aytildi.has(m.table)) {
          aytildi.add(m.table);
          notify(`${m.table}: jonli yangilanish ishlamayapti — ${e?.message ?? e}`);
        }
      }
    }
  }

  tekshir();
  const t = setInterval(tekshir, TEKSHIRISH_ORALIGI);
  // Oyna qaytib faollashganda darrov tekshiramiz — xodim boshqa
  // ilovadan qaytganda eski raqamni ko'rmasin
  const faollashdi = () => { if (!document.hidden) tekshir(); };
  document.addEventListener("visibilitychange", faollashdi);

  return () => {
    toxtadi = true;
    clearInterval(t);
    document.removeEventListener("visibilitychange", faollashdi);
  };
}
