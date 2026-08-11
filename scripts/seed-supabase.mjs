// ══════════════════════════════════════════════════════════════
// BILLZ EKSPORTINI SUPABASE'GA YUKLASH
// ══════════════════════════════════════════════════════════════
// Ishga tushirishdan oldin:
//   1. Supabase loyihasi ochilgan bo'lsin
//   2. schema.sql SQL Editor'da bajarilgan bo'lsin
//   3. .env.local ga yozilsin:
//        NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
//        SUPABASE_SERVICE_ROLE_KEY=eyJ...      ← anon emas, SERVICE key
//
// Ishga tushirish:  node scripts/seed-supabase.mjs
//
// Nega service key: RLS siyosatlari anon kalitga yozishga ruxsat
// bermaydi (to'g'ri qiladi). Yuklash bir martalik ma'muriy amal,
// shuning uchun service key bilan bajariladi. Bu kalit HECH QACHON
// brauzerga tushmasligi kerak — faqat shu skriptda.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, "..");

// .env.local ni o'zimiz o'qiymiz — qo'shimcha paket kerak emas
for (const line of readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
  if (m) process.env[m[1]] ??= m[2];
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY kerak (.env.local)");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

// —— Eksportni o'qish ————————————————————————————
// billzExport.js — ESM sintaksisida, lekin package.json da "type":"module"
// yo'q, shuning uchun Node .js ni CommonJS deb o'qiydi va "export" da
// yiqiladi. Yechim: vaqtincha .mjs nusxa yasaymiz (.mjs har doim ESM).
const tmp = path.join(root, ".billz-export.tmp.mjs");
writeFileSync(tmp, readFileSync(path.join(root, "lib/billzExport.js"), "utf8")
  .replace(/^\s*["']use client["'];?\s*$/m, ""));
const exp = await import(pathToFileURL(tmp).href);
unlinkSync(tmp);

const COMPANY = "NScamera";
const STORE_NAMES = {
  s1: { name: "NScamera Optim", kind: "shop" },
  s2: { name: "NScamera Namangan", kind: "shop" },
  s3: { name: "Sklad", kind: "warehouse" },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Bepul tarifda va sekin internetda katta bo'lak yuborilsa ulanish
// uziladi (ETIMEDOUT). Shuning uchun bo'lak kichik va har bo'lak
// uch marta qayta uriniladi — bir marta uzilgani butun yuklashni
// bekor qilmasin.
async function insertAll(table, rows, chunk = 200) {
  let done = 0;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);

    let lastErr = null;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const { error } = await db.from(table).insert(slice);
        if (!error) { lastErr = null; break; }
        lastErr = error;
        // Takror kalit — qayta urinish yordam bermaydi
        if (error.code === "23505") throw error;
      } catch (e) {
        lastErr = e;
        if (e.code === "23505") throw e;
      }
      process.stdout.write(`\r  ${table}: ${done}/${rows.length} — qayta urinish ${attempt}`);
      await sleep(attempt * 1500);
    }
    if (lastErr) {
      console.error(`\n  ✗ ${table} [${i}..${i + slice.length}]:`, lastErr.message);
      throw lastErr;
    }

    done += slice.length;
    process.stdout.write(`\r  ${table}: ${done}/${rows.length}          `);
  }
  process.stdout.write(`\r  ✓ ${table}: ${rows.length}                    \n`);
}

// TUZOQ: Supabase (PostgREST) har select'da eng ko'pi 1000 qator
// qaytaradi — cheklov so'ralmasa ham. Shu sababli 6 800 mijozdan
// faqat 1 000 tasi o'qilib, cheklarning ko'pi mijozsiz qolgan edi.
// Shuning uchun katta jadvallar HAR DOIM shu funksiya bilan o'qiladi.
async function fetchAll(table, select, filter = (q) => q, page = 1000) {
  const out = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await filter(db.from(table).select(select))
      .range(from, from + page - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < page) break;
  }
  return out;
}

// Jadvalda nechta qator bor — uzilgan joydan davom etish uchun
async function countOf(table, companyCol = "company_id") {
  const { count } = await db.from(table)
    .select("*", { count: "exact", head: true })
    .eq(companyCol, companyId);
  return count ?? 0;
}

// Bosqich to'liq yuklangan bo'lsa o'tkazib yuboramiz; yarim
// yuklangan bo'lsa tozalab qaytadan yozamiz (yarim ma'lumot
// keyingi bosqichlarni buzadi).
async function stage(table, rows, { wipe, count } = {}) {
  const have = count ? await count() : await countOf(table);
  if (have === rows.length) {
    console.log(`  · ${table}: ${have} — allaqachon yuklangan, o'tkazildi`);
    return;
  }
  if (have > 0) {
    console.log(`  ! ${table}: ${have}/${rows.length} yarim yuklangan — tozalanmoqda`);
    await (wipe ? wipe() : db.from(table).delete().eq("company_id", companyId));
  }
  await insertAll(table, rows);
}

console.log("Yuklash boshlandi\n");

// —— 1. Kompaniya va do'konlar ————————————————————
// Skript qayta ishga tushsa uzilgan joydan davom etadi: mavjud
// kompaniya qayta ishlatiladi, to'liq yuklangan jadvallar
// o'tkazib yuboriladi.
const { data: existing } = await db.from("companies").select("id").eq("name", COMPANY);

let companyId;
if (existing?.length) {
  companyId = existing[0].id;
  console.log("  · kompaniya mavjud, davom etamiz:", companyId);
} else {
  const { data, error } = await db
    .from("companies").insert({ name: COMPANY, currency: "USD" }).select().single();
  if (error) { console.error("Kompaniya:", error.message); process.exit(1); }
  companyId = data.id;
  console.log("  ✓ kompaniya:", companyId);
}
const company = { id: companyId };

const storeIds = {};
{
  const { data: have } = await db.from("stores").select("id,name").eq("company_id", companyId);
  const byName = new Map((have ?? []).map((s) => [s.name, s.id]));
  for (const [key2, s] of Object.entries(STORE_NAMES)) {
    if (byName.has(s.name)) { storeIds[key2] = byName.get(s.name); continue; }
    const { data } = await db.from("stores")
      .insert({ company_id: companyId, name: s.name, kind: s.kind }).select().single();
    storeIds[key2] = data.id;
  }
}
console.log("  ✓ do'konlar: 3");

// —— 2. Kategoriyalar ————————————————————————————
const catNames = [...new Set(exp.EXPORT_PRODUCTS.map((p) => p.category).filter(Boolean))];
await stage("categories", catNames.map((name) => ({ company_id: companyId, name })));
const { data: cats } = await db.from("categories").select("id,name").eq("company_id", companyId);
const catId = Object.fromEntries(cats.map((c) => [c.name, c.id]));

// —— 3. Tovarlar ————————————————————————————————
// "montaj" — xizmat: qoldiq yuritilmaydi, aks holda minus qoldiq chiqadi
const isService = (p) => /montaj|xizmat|ustanovka/i.test(p.name);

await stage("products", exp.EXPORT_PRODUCTS.map((p) => ({
  company_id: companyId,
  name: p.name,
  sku: p.sku || null,
  barcode: p.barcode || null,
  category_id: catId[p.category] ?? null,
  brand: p.brand || null,
  supplier: p.supplier || null,
  sale_price: p.salePrice,
  cost_price: p.costPrice,
  is_service: isService(p),
})));

const prods = await fetchAll("products", "id,barcode,name",
  (q) => q.eq("company_id", companyId));
const prodId = new Map(prods.map((p) => [p.barcode || p.name, p.id]));

// —— 4. Qoldiqlar ————————————————————————————————
const stockRows = [];
for (const p of exp.EXPORT_PRODUCTS) {
  const id = prodId.get(p.barcode || p.name);
  if (!id) continue;
  for (const [sk, qty] of Object.entries(p.stock)) {
    if (!qty) continue;
    stockRows.push({ product_id: id, store_id: storeIds[sk], qty });
  }
}
// stock jadvalida company_id ustuni yo'q — sanash va tozalash
// do'kon/tovar orqali bajariladi
await stage("stock", stockRows, {
  count: async () => {
    const { count } = await db.from("stock")
      .select("*", { count: "exact", head: true })
      .in("store_id", Object.values(storeIds));
    return count ?? 0;
  },
  wipe: async () => {
    for (const sid of Object.values(storeIds)) {
      await db.from("stock").delete().eq("store_id", sid);
    }
  },
});

// —— 5. Mijozlar ————————————————————————————————
await stage("customers", exp.EXPORT_CUSTOMERS.map((c) => ({
  company_id: companyId,
  name: c.name,
  phone: c.phone || null,
  store_id: storeIds[c.storeId] ?? null,
})));

const custs = await fetchAll("customers", "id,name",
  (q) => q.eq("company_id", companyId));
const custId = new Map();
for (const c of custs) if (!custId.has(c.name)) custId.set(c.name, c.id);
console.log(`  · mijoz kartotekasi: ${custId.size} nom`);

// —— 6. Tranzaksiyalar ————————————————————————————
// imported=true: bu tarixiy chek, qoldiqqa ta'sir qilmaydi
// (qoldiq allaqachon 4-bosqichda joriy holat bilan yozilgan).
//
// Diqqat: Billz qaytarish chekiga ASL chek raqamini beradi. Shu
// tufayli qaytarishni asl chekka bog'lash mumkin — original_id
// keyinroq (7-bosqichda) to'ldiriladi.
await stage("sales", exp.EXPORT_TRANSACTIONS.map((t) => ({
  company_id: companyId,
  store_id: storeIds[t.storeId],
  no: t.no,
  type: t.type,
  customer_id: custId.get(t.customer) ?? null,
  sold_at: t.at,
  subtotal: +(t.total + t.discount).toFixed(2),
  discount: t.discount,
  total: t.total,
  cash: t.cash,
  payme: t.payme,
  from_balance: t.cashback,
  debt: t.debt,
  imported: true,
})));

// —— 6b. Qaytarishni asl chekka bog'lash ————————————
// Raqam bir xil bo'lgani uchun juftlashtiramiz: eng yaqin oldingi
// sotuv — o'sha qaytarishning asli.
{
  const rows = await fetchAll("sales", "id,no,type,sold_at",
    (q) => q.eq("company_id", companyId));
  const saleByNo = new Map();
  for (const r of rows) if (r.type === "sale") saleByNo.set(r.no, r.id);

  const links = rows
    .filter((r) => r.type !== "sale" && saleByNo.has(r.no))
    .map((r) => ({ id: r.id, original_id: saleByNo.get(r.no) }));

  let linked = 0;
  for (const l of links) {
    const { error } = await db.from("sales")
      .update({ original_id: l.original_id }).eq("id", l.id);
    if (!error) linked++;
    if (linked % 100 === 0) process.stdout.write(`\r  bog'lash: ${linked}/${links.length}`);
  }
  process.stdout.write(`\r  ✓ qaytarish → asl chek: ${linked}\n`);
}

// —— 7. Qarzlar ————————————————————————————————
// MUHIM QAROR. Billz qarz TO'LOVLARI tarixini bermaydi — faqat
// qaysi chek qarzga ketganini bildiramiz. Agar yil boshidan beri
// berilgan hamma qarzni ochiq deb yozsak, debitor qarzdorlik
// 591 476 USD chiqadi — bu haqiqat emas, ularning ko'pi to'langan.
//
// Ma'lumotga ko'ra pul o'rtacha 27 kunda qaytadi. Shuning uchun
// faqat OXIRGI DEBT_WINDOW_DAYS kundagi qarzlar ochiq deb olinadi.
// Raqamni o'zingiz to'g'rilashingiz mumkin: haqiqiy qarzdorlikni
// bilsangiz shu yerdagi kunni moslang va skriptni qayta yugurting.
const DEBT_WINDOW_DAYS = 45;

const lastDate = exp.EXPORT_TRANSACTIONS
  .reduce((m, t) => (t.at > m ? t.at : m), "");
const debtSince = new Date(new Date(lastDate).getTime() - DEBT_WINDOW_DAYS * 86400000);

const allCredit = exp.EXPORT_TRANSACTIONS.filter(
  (t) => t.type === "sale" && t.debt > 0 && custId.has(t.customer)
);
const openCredit = allCredit.filter((t) => new Date(t.at) >= debtSince);

const sum = (list) => +list.reduce((a, t) => a + t.debt, 0).toFixed(2);
console.log(`
  qarz: yil bo'yicha berilgan  ${sum(allCredit).toLocaleString("ru-RU")} USD (${allCredit.length} ta)
        ochiq deb olinadi      ${sum(openCredit).toLocaleString("ru-RU")} USD (${openCredit.length} ta, oxirgi ${DEBT_WINDOW_DAYS} kun)
        to'langan deb tashlandi ${(sum(allCredit) - sum(openCredit)).toLocaleString("ru-RU")} USD
`);

const debtRows = openCredit
  .map((t) => ({
    company_id: companyId,
    customer_id: custId.get(t.customer),
    store_id: storeIds[t.storeId],
    amount: t.debt,
    issued_at: t.at,
    due_date: new Date(new Date(t.at).getTime() + 30 * 86400000).toISOString().slice(0, 10),
  }));
await stage("debts", debtRows);

// —— 8. Chek raqami sanog'ini oldinga surish ————————————
// Yangi cheklar eski raqamlarni takrorlamasin
for (const sk of Object.keys(storeIds)) {
  await db.from("doc_counters").insert({
    company_id: companyId, store_id: storeIds[sk], kind: "sale", next_no: 1,
  });
}

console.log(`
Tayyor.
  tovar        ${exp.EXPORT_PRODUCTS.length}
  qoldiq       ${stockRows.length}
  mijoz        ${exp.EXPORT_CUSTOMERS.length}
  chek         ${exp.EXPORT_TRANSACTIONS.length}
  qarz         ${debtRows.length}

Keyingi qadam: Supabase > Authentication > Users da xodimlarga
hisob oching, keyin profiles jadvaliga rol va do'kon yozing.
`);
