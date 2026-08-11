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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// .env sozlanmagan bo'lsa demo rejim: hamma narsa xotirada, Billz
// eksporti seed sifatida ishlatiladi.
export const DEMO_MODE = !url || !anonKey;
export const supabase = DEMO_MODE ? null : createClient(url, anonKey);

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

// —— Boshlang'ich yuklash ————————————————————————
let bootstrapped = false;
export const isBootstrapped = () => bootstrapped;

// Ilova ochilishi uchun ZARUR bo'lgan kichik jadvallar. Faqat shular
// kutiladi — ilova darrov ochiladi. Og'irlari (savdo/tovar/mijoz)
// orqada yuklanadi.
const CRITICAL = new Set([
  "profiles", "stores", "store_plans", "companies",
  "kpi_assign", "kpi_plan", "kpi_day", "nps_records",
  "kassa_ops", "payouts",
]);

// PostgREST bitta so'rovda eng ko'pi 1000 qator qaytaradi — shuning
// uchun har jadval sahifalab o'qiladi (7 779 chek yarim yo'lda kesilmasin).
async function readAll(m) {
  const PAGE = 1000;
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
    else notify(`${m.table}: ${e.message}`);
  }
}

export async function bootstrap(onBackground) {
  if (DEMO_MODE || bootstrapped) {
    bootstrapped = true;
    return { demo: DEMO_MODE, loaded: 0 };
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
    onBackground?.();
    console.table(ctx.report);
    if (ctx.pending.size) console.info("[db] hali o'rnatilmagan jadvallar:", [...ctx.pending].join(", "));
  });

  return { demo: false, loaded: ctx.loaded, report: ctx.report, pending: [...ctx.pending] };
}

// —— Yozish ————————————————————————————————————
// Xotira allaqachon yangilangan, bu yerda faqat bazaga yetkazamiz.
// Xato bo'lsa foydalanuvchiga ko'rsatiladi, lekin interfeys qotmaydi.
const listeners = new Set();
export const onDbError = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const notify = (msg) => listeners.forEach((fn) => fn(msg));

async function run(promise, what, silent = false) {
  if (DEMO_MODE) return { ok: true, demo: true };
  const { data, error } = await promise;
  if (error) {
    console.error(`[db] ${what}:`, error.message);
    // Jim rejim: KPI kabi localStorage'da ham saqlanadigan yozuvlar
    // baza hali tayyor bo'lmasa foydalanuvchini bezovta qilmaydi
    if (!silent) notify(`${what}: ${error.message}`);
    return { ok: false, error };
  }
  return { ok: true, data };
}

export const insert = (table, row, what = "saqlash") =>
  DEMO_MODE ? Promise.resolve({ ok: true, demo: true })
            : run(supabase.from(table).insert(row).select().single(), what);

export const update = (table, id, patch, what = "yangilash", silent = false) =>
  DEMO_MODE ? Promise.resolve({ ok: true, demo: true })
            : run(supabase.from(table).update(patch).eq("id", id).select().single(), what, silent);

export const remove = (table, id, what = "o'chirish") =>
  DEMO_MODE ? Promise.resolve({ ok: true, demo: true })
            : run(supabase.from(table).delete().eq("id", id), what);

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

// —— Realtime ————————————————————————————————
// Boshqa xodim tovar sotsa qoldiq shu yerda yangilanadi.
export function subscribeAll(onChange) {
  if (DEMO_MODE) return () => {};

  const channel = supabase.channel("nspos");
  for (const m of modules.values()) {
    if (!m.realtime) continue;
    channel.on("postgres_changes",
      { event: "*", schema: "public", table: m.table },
      (payload) => {
        m.apply?.(payload);
        onChange?.(m.table, payload);
      });
  }
  channel.subscribe();
  return () => supabase.removeChannel(channel);
}
