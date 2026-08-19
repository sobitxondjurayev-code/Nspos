// ══════════════════════════════════════════════════════════════
// BILLZ → NSPOS SINXRONIZATSIYASI (YADRO) — FAQAT SERVER
// ══════════════════════════════════════════════════════════════
// Bir tushuncha — bitta funksiya (CLAUDE.md, 2026-08-14). Sinxronizatsiya
// ikki joydan chaqiriladi:
//   • `app/api/billz/sync/route.js` — Vercel Cron va Sozlamalardagi tugma
//   • `scripts/billz-sync.mjs`      — bir martalik to'liq tortish
// Ikkalasi ham AYNAN shu fayldagi bosqichlarni ishlatadi. Agar server
// bir xil, skript boshqacha yozganda, ikkalasidan qaysi biri to'g'ri
// yozganini keyin aniqlab bo'lmasdi.
//
// Nima uchun bosqichlar aynan shu tartibda: tovar kategoriyaga,
// chek do'kon/mijoz/tovarga tayanadi. Tartib buzilsa bog'lanishlar
// bo'sh qolib ketadi.
import {
  fetchShops, fetchCategories, fetchSuppliers,
  productPages, clientPages, orderPages, debtPages, openDebtPages, fmtBillzDay, BillzError,
} from "./billzApi";
import {
  matchStores, flattenCategories, categoryRow, supplierRow,
  productRow, stockRows, customerRow, saleRow, saleItemRows,
  mergeProduct, mergeCustomer, phoneKey, billzTime, isDeleted, saleType,
  debtRow, debtPaymentRows,
} from "./billzMap";

export const STAGES = ["categories", "suppliers", "products", "customers", "orders", "debts"];

const CHUNK = 500;          // bitta upsert'da nechta qator
const now = () => new Date().toISOString();
const clean = (v) => (v === undefined || v === null ? "" : String(v).trim());

// —— Sinov rejimi ————————————————————————————————
// `--dry` da HECH NARSA yozilmasligi kerak. Buni har bosqichga
// `if (dry) return` qo'yib emas, mijozning o'zini o'rab qo'yish bilan
// qilamiz: shunda yangi bosqich qo'shilganda "dry ni unutish" degan
// xato bo'lmaydi — yozuv jismonan chiqmaydi.
const DRY_ID = "00000000-0000-0000-0000-000000000000";
const WRITES = new Set(["insert", "upsert", "update", "delete"]);

export function dryClient(db) {
  const fake = () => {
    const res = { data: { id: DRY_ID }, error: null, count: 0 };
    const chain = {
      select: () => chain, single: () => chain, maybeSingle: () => chain,
      eq: () => chain, in: () => chain, is: () => chain, not: () => chain,
      order: () => chain, limit: () => chain, range: () => chain,
      then: (f, r) => Promise.resolve(res).then(f, r),
      catch: (r) => Promise.resolve(res).catch(r),
      finally: (f) => Promise.resolve(res).finally(f),
    };
    return chain;
  };
  return {
    from: (table) => {
      const real = db.from(table);
      return new Proxy(real, {
        get(t, prop) {
          if (WRITES.has(prop)) return fake;
          const v = t[prop];
          return typeof v === "function" ? v.bind(t) : v;
        },
      });
    },
    rpc: (...a) => db.rpc(...a),
  };
}

// —— Yordamchilar ————————————————————————————————
async function readAll(db, table, select, filter) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from(table).select(select).range(from, from + 999);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table} o'qilmadi: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

// Bir necha mingta bitta-bitta UPDATE ketma-ket yuborilsa har biriga
// ~60 ms yo'l vaqti ketadi va bog'lash bosqichi 3 daqiqaga cho'ziladi.
// Yigirmatasi barobar yuborilsa — 10 soniya. Ko'proq qilinmaydi:
// bepul tarifdagi ulanish soni cheklangan.
async function inPool(items, worker, size = 20) {
  let i = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    for (;;) {
      const idx = i++;
      if (idx >= items.length) return;
      await worker(items[idx]);
    }
  });
  await Promise.all(runners);
}

// Katta massiv bo'laklab yoziladi: bitta so'rovda 5 000 qator yuborilsa
// ulanish uziladi (`scripts/seed-supabase.mjs` da ham shu sabab).
async function upsertAll(db, table, rows, onConflict) {
  let done = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await db.from(table).upsert(slice, onConflict ? { onConflict } : undefined);
    if (error) throw new Error(`${table} yozilmadi: ${error.message}`);
    done += slice.length;
  }
  return done;
}

// —— Jurnal ————————————————————————————————————
// Kursor SHU JADVALDA turadi: "qayerda to'xtagan edik". Xato bo'lsa
// `cursor_at` yozilmaydi — keyingi urinish o'sha joydan qaytadan
// boshlaydi va oradagi o'zgarish yo'qolmaydi.
async function lastCursor(db, companyId, entity) {
  const { data } = await db.from("billz_sync_log")
    .select("cursor_at")
    .eq("company_id", companyId).eq("entity", entity)
    .not("cursor_at", "is", null)
    .order("started_at", { ascending: false }).limit(1);
  return data?.[0]?.cursor_at ?? null;
}

async function writeLog(db, row) {
  const { error } = await db.from("billz_sync_log").insert(row);
  if (error) console.error("[billz] jurnal yozilmadi:", error.message);
}

// ══════════════════════════════════════════════════════════════
// KONTEKST
// ══════════════════════════════════════════════════════════════
export async function buildContext(db) {
  const { data: companies, error } = await db.from("companies").select("id,name").limit(1);
  if (error) throw new Error(`companies o'qilmadi: ${error.message}`);
  if (!companies?.length) throw new Error("companies bo'sh — avval kompaniya yaratilsin");
  const companyId = companies[0].id;

  const [stores, shops] = await Promise.all([
    readAll(db, "stores", "id,name"),
    fetchShops(),
  ]);
  const { byBillz: storeByBillz, unmatched } = matchStores(shops, stores);
  if (!storeByBillz.size) {
    throw new Error("Birorta do'kon mos kelmadi — `stores` nomlarini Billz bilan solishtiring");
  }

  return {
    companyId, companyName: companies[0].name,
    storeByBillz, unmatchedShops: unmatched,
    categoryIdByBillz: new Map(),
    productIdByBillz: new Map(),
    customerIdByBillz: new Map(),
  };
}

// ══════════════════════════════════════════════════════════════
// 0. BOG'LASH — mavjud yozuvlarga billz_id qo'yish
// ══════════════════════════════════════════════════════════════
// Excel'dan kelgan 407 tovar va 6 800 mijozda billz_id yo'q. Bog'lanmasa
// birinchi sinxronizatsiya ularni YANGI deb qo'shadi: katalog ikkilanadi,
// mijozlar ro'yxatida har kim ikki marta chiqadi va qarzlar ikkiga
// bo'linadi. Shuning uchun avval shtrix-kod / telefon bo'yicha ulaymiz.
export async function linkExisting(db, ctx) {
  const stat = { products: 0, customers: 0, ambiguous: [] };

  // —— Tovarlar: shtrix-kod bo'yicha ————————————————
  const existing = await readAll(db, "products", "id,barcode,billz_id", (q) => q.is("billz_id", null));
  const byBarcode = new Map();
  for (const p of existing) if (p.barcode) byBarcode.set(p.barcode, p.id);

  const updates = [];
  const seenBarcode = new Set();
  for await (const bp of productPages(null)) {
    const code = String(bp.barcode ?? "").trim();
    if (!code) continue;
    // Billz'da bitta shtrix-kod ikki tovarga tegishli bo'lsa, taxmin
    // qilmaymiz — qo'lda hal qilinsin, aks holda noto'g'ri bog'lanadi.
    if (seenBarcode.has(code)) { stat.ambiguous.push(code); byBarcode.delete(code); continue; }
    seenBarcode.add(code);
    const id = byBarcode.get(code);
    if (id) updates.push({ id, billz_id: bp.id });
  }
  await inPool(updates, async (u) => {
    const { error } = await db.from("products").update({ billz_id: u.billz_id }).eq("id", u.id);
    if (error) throw new Error(`products bog'lanmadi: ${error.message}`);
  });
  stat.products = updates.length;

  // —— Mijozlar: telefon bo'yicha ————————————————
  const cust = await readAll(db, "customers", "id,phone,billz_id", (q) => q.is("billz_id", null));
  const byPhone = new Map();
  const dupPhone = new Set();
  for (const c of cust) {
    const k = phoneKey(c.phone);
    if (!k) continue;
    if (byPhone.has(k)) dupPhone.add(k); else byPhone.set(k, c.id);
  }
  for (const k of dupPhone) byPhone.delete(k);   // ikkilangan telefon — tegilmaydi

  const cUpdates = [];
  const seenPhone = new Set();
  for await (const bc of clientPages()) {
    const k = phoneKey((bc.phone_numbers ?? [])[0]);
    if (!k) continue;
    if (seenPhone.has(k)) { byPhone.delete(k); continue; }
    seenPhone.add(k);
    const id = byPhone.get(k);
    if (id) cUpdates.push({ id, billz_id: bc.id });
  }
  await inPool(cUpdates, async (u) => {
    const { error } = await db.from("customers").update({ billz_id: u.billz_id }).eq("id", u.id);
    if (error) throw new Error(`customers bog'lanmadi: ${error.message}`);
  });
  stat.customers = cUpdates.length;

  return stat;
}

// ══════════════════════════════════════════════════════════════
// 0-B. ESKI CHEKLARNI BILLZ CHEKIGA BOG'LASH
// ══════════════════════════════════════════════════════════════
// Bazada Excel'dan kelgan 7 779 chek bor (01.01–22.07.2026) va ularda
// `billz_id` yo'q. Bog'lanmasa API o'sha davrni QAYTA tortadi va har
// chek IKKI marta yoziladi: tushum ikki barobar, foyda ikki barobar,
// kassa ikki barobar — butun moliya yolg'on bo'lib qoladi.
//
// Nega faqat chek raqami yetarli emas: Billz qaytarish chekiga ASL
// chekning raqamini beradi. 7 779 qatorda atigi 6 855 noyob raqam —
// ya'ni 924 ta juftlik. Shuning uchun kalit uchta bo'lakdan:
// raqam + tur + summa.
export async function linkSales(db, ctx, { from = null, to = null, log = () => {} } = {}) {
  const stat = { checked: 0, linked: 0, ambiguous: 0, notFound: 0 };

  const old = await readAll(db, "sales", "id,no,type,total", (q) => q.is("billz_id", null));
  if (!old.length) return stat;

  // Kalit: "raqam|tur|summa". Bir xil kalitli bir nechta eski qator
  // bo'lsa — taxmin qilmaymiz, tegmaymiz (ular baribir bir xil chek
  // emasligiga ishonch yo'q).
  const key = (no, type, total) => `${String(no).trim()}|${type}|${Math.abs(Number(total)).toFixed(2)}`;
  const byKey = new Map();
  const dup = new Set();
  for (const s of old) {
    const k = key(s.no, s.type, s.total);
    if (byKey.has(k)) dup.add(k); else byKey.set(k, s.id);
  }
  for (const k of dup) byKey.delete(k);
  stat.ambiguous = dup.size;

  const updates = [];
  for await (const o of orderPages({ from, to })) {
    if (isDeleted(o)) continue;
    stat.checked++;
    const type = saleType(o);
    const total = o.order_detail?.total_price ?? 0;
    const id = byKey.get(key(o.order_number, type, total));
    if (!id) { stat.notFound++; continue; }
    updates.push({ id, billz_id: o.id });
    byKey.delete(key(o.order_number, type, total));   // bir eski qator — bir Billz cheki
  }

  await inPool(updates, async (u) => {
    const { error } = await db.from("sales").update({ billz_id: u.billz_id }).eq("id", u.id);
    if (error) throw new Error(`sales bog'lanmadi: ${error.message}`);
  });
  stat.linked = updates.length;
  log(`  cheklar bog'landi: ${stat.linked} / ${old.length}`);
  return stat;
}

// ══════════════════════════════════════════════════════════════
// 1. KATEGORIYALAR
// ══════════════════════════════════════════════════════════════
export async function syncCategories(db, ctx) {
  const flat = flattenCategories(await fetchCategories());
  const rows = flat.map((c) => categoryRow(c, ctx));

  // NSPOS'da `unique (company_id, name)` — Excel'dan kelgan 31 ta
  // kategoriya nomi bo'yicha bog'lanadi, aks holda upsert o'sha
  // cheklovga urilib butun bosqichni to'xtatardi.
  const existing = await readAll(db, "categories", "id,name,billz_id");
  const byName = new Map(existing.map((c) => [c.name.toLowerCase(), c]));

  const insert = [], update = [];
  // Billz daraxtida bir nom bir necha tugunda uchraydi (masalan ota va
  // bola bir xil atalgan). NSPOS'da esa nom yagona — birinchisini olamiz,
  // aks holda `unique (company_id, name)` butun bo'lakni yiqitardi.
  const taken = new Set();
  for (const r of rows) {
    const key = r.name.toLowerCase();
    if (taken.has(key)) continue;
    taken.add(key);
    const old = byName.get(key);
    if (old) update.push({ id: old.id, billz_id: r.billz_id });
    else insert.push(r);
  }
  for (const u of update) await db.from("categories").update({ billz_id: u.billz_id }).eq("id", u.id);
  if (insert.length) await upsertAll(db, "categories", insert, "company_id,billz_id");

  // Kontekstga: tovar shu jadvaldan kategoriya id'sini oladi
  for (const c of await readAll(db, "categories", "id,billz_id")) {
    if (c.billz_id) ctx.categoryIdByBillz.set(c.billz_id, c.id);
  }
  return { fetched: rows.length, inserted: insert.length, updated: update.length };
}

// ══════════════════════════════════════════════════════════════
// 2. TA'MINOTCHILAR
// ══════════════════════════════════════════════════════════════
export async function syncSuppliers(db, ctx) {
  const rows = (await fetchSuppliers()).map((s) => supplierRow(s, ctx));
  if (rows.length) await upsertAll(db, "suppliers", rows, "company_id,billz_id");
  return { fetched: rows.length, inserted: rows.length, updated: 0 };
}

// ══════════════════════════════════════════════════════════════
// 3. TOVARLAR + QOLDIQ
// ══════════════════════════════════════════════════════════════
// `since` berilsa Billz faqat o'zgargan tovarlarni qaytaradi. Shu sabab
// har 30 daqiqada 652 tovar emas, 2–3 tasi keladi.
export async function syncProducts(db, ctx, { since = null } = {}) {
  const existing = await readAll(db, "products", "id,billz_id,barcode,sku,brand,supplier,unit,description,category_id,sale_price,cost_price");
  const byBillz = new Map(existing.filter((p) => p.billz_id).map((p) => [p.billz_id, p]));
  const byBarcode = new Map(existing.filter((p) => p.barcode).map((p) => [p.barcode, p]));

  const rows = [];
  const stock = [];
  const conflicts = [];
  let fetched = 0, relinked = 0, newest = since ? new Date(since).getTime() : 0;

  for await (const bp of productPages(since)) {
    fetched++;
    const raw = productRow(bp, ctx);
    let old = byBillz.get(bp.id) ?? null;

    // Shtrix-kod bo'yicha topilgan, lekin hali bog'lanmagan tovar.
    //
    // NEGA ALOHIDA UPDATE: `products` da `unique (company_id, barcode)`
    // ham bor. Upsert (company_id, billz_id) bo'yicha ketadi, ya'ni bu
    // qatorni YANGI deb qo'shmoqchi bo'ladi va o'sha zahoti shtrix-kod
    // cheklovига urilib butun bo'lak yiqiladi. Shuning uchun avval
    // mavjud qatorga billz_id qo'yamiz — keyin upsert uni topadi.
    if (!old && raw.barcode) {
      const hit = byBarcode.get(raw.barcode);
      if (hit && !hit.billz_id) {
        const { error } = await db.from("products").update({ billz_id: bp.id }).eq("id", hit.id);
        if (error) throw new Error(`products bog'lanmadi: ${error.message}`);
        hit.billz_id = bp.id;
        byBillz.set(bp.id, hit);
        old = hit;
        relinked++;
      } else if (hit && hit.billz_id !== bp.id) {
        // Bir shtrix-kod ikki Billz tovariga tegishli — bunday bo'lmasligi
        // kerak. Shtrix-kodsiz yozamiz va ogohlantiramiz: ma'lumot
        // yo'qolmaydi, lekin baza cheklovi ham buzilmaydi.
        conflicts.push({ barcode: raw.barcode, billz_id: bp.id, name: raw.name });
        raw.barcode = null;
      }
    }

    rows.push(mergeProduct(old, raw));
    stock.push(...stockRows(bp, ctx));
    const t = new Date(raw.updated_at).getTime();
    if (t > newest) newest = t;
  }

  if (rows.length) await upsertAll(db, "products", rows, "company_id,billz_id");

  // Qoldiq tovar id'siga tayanadi — shuning uchun tovarlar yozilgandan
  // KEYIN o'qib olamiz (yangi qo'shilganlarning id'si endi bor).
  const after = await readAll(db, "products", "id,billz_id");
  ctx.productIdByBillz = new Map(after.filter((p) => p.billz_id).map((p) => [p.billz_id, p.id]));

  const stockRowsFinal = [];
  for (const s of stock) {
    const pid = ctx.productIdByBillz.get(s._billzProductId);
    if (!pid) continue;
    stockRowsFinal.push({ product_id: pid, store_id: s.store_id, qty: s.qty, updated_at: now() });
  }
  if (stockRowsFinal.length) await upsertAll(db, "stock", stockRowsFinal, "product_id,store_id");

  return {
    fetched, inserted: rows.length, updated: relinked,
    stock: stockRowsFinal.length,
    conflicts,
    cursor_at: newest ? new Date(newest).toISOString() : null,
  };
}

// ══════════════════════════════════════════════════════════════
// 4. MIJOZLAR
// ══════════════════════════════════════════════════════════════
// Billz mijozlarda `last_updated_date` filtri yo'q, lekin ro'yxatni
// yangisidan eskisiga qarab beradi. Inkremental rejimda o'tgan
// safargi eng yangi `created_at` ga yetganda to'xtaymiz — 4 901
// mijozni har yarim soatda qayta tortish 50 ta ortiqcha so'rov degani.
export async function syncCustomers(db, ctx, { since = null, full = false } = {}) {
  const existing = await readAll(db, "customers", "id,billz_id,phone,name,store_id,first_purchase_at,last_purchase_at");
  const byBillz = new Map(existing.filter((c) => c.billz_id).map((c) => [c.billz_id, c]));
  const byPhone = new Map(existing.filter((c) => c.phone).map((c) => [phoneKey(c.phone), c]));

  const stopAt = full || !since ? 0 : new Date(since).getTime();
  const rows = [];
  let fetched = 0, newest = 0, stopped = false;

  for await (const bc of clientPages()) {
    fetched++;
    const raw = customerRow(bc, ctx);
    const t = new Date(raw.created_at ?? 0).getTime();
    if (t > newest) newest = t;
    // Eski mijozlarga yetdik — qolganini tortishning hojati yo'q
    if (stopAt && t && t < stopAt) { stopped = true; break; }
    const old = byBillz.get(bc.id) ?? (raw.phone ? byPhone.get(phoneKey(raw.phone)) : null);
    rows.push(mergeCustomer(old, raw));
  }

  if (rows.length) await upsertAll(db, "customers", rows, "company_id,billz_id");

  const after = await readAll(db, "customers", "id,billz_id");
  ctx.customerIdByBillz = new Map(after.filter((c) => c.billz_id).map((c) => [c.billz_id, c.id]));

  return {
    fetched, inserted: rows.length, updated: 0, stopped,
    cursor_at: newest ? new Date(newest).toISOString() : null,
  };
}

// ══════════════════════════════════════════════════════════════
// 5. CHEKLAR + CHEK QATORLARI
// ══════════════════════════════════════════════════════════════
// ASOSIY TESHIK SHU YERDA YOPILADI. Excel eksportida chek ichidagi
// tovarlar yo'q edi (lib/salesData.js), shuning uchun `sale_items`
// jadvali 7 779 chekka qaramay BO'SH turardi va `v_product_margin`
// hech qachon to'lmasdi. API har chekni ichidagi tovarlari bilan
// beradi — lekin HAR CHEK UCHUN ALOHIDA so'rov kerak.
//
// Hisob: 7 779 chek × ~0.55 s = ~72 daqiqa. Vercel'da bitta chaqiriq
// 300 soniya, ya'ni sig'maydi. Shuning uchun `maxOrders` bilan bo'lak
// olinadi va kursor saqlanadi; to'liq tarix esa
// `scripts/billz-sync.mjs` bilan bir marta tortiladi.
// Chekda uchragan, lekin katalogda yo'q tovarlarni yaratadi.
// Chek qatoridagi `product` obyektida id, nom va shtrix-kod bor —
// shundan to'liq kartochka yasaladi.
async function ensureMissingProducts(db, ctx, orders) {
  const need = new Map();
  for (const o of orders) {
    for (const it of o.order_detail?.order_items ?? []) {
      const bid = it.product_id || it.product?.id;
      if (!bid || bid === "00000000-0000-0000-0000-000000000000") continue;
      if (ctx.productIdByBillz.has(bid) || need.has(bid)) continue;
      need.set(bid, {
        company_id: ctx.companyId,
        billz_id: bid,
        name: (it.product?.name || it.name || "Billz tovari").trim(),
        // Shtrix-kod `unique (company_id, barcode)` cheklovi ostida —
        // band bo'lsa yozmaymiz, aks holda butun bo'lak yiqiladi
        barcode: null,
        sku: (it.sku || "").trim() || null,
        sale_price: Math.abs(Number(it.sale_price ?? it.price) || 0),
        cost_price: Math.abs(Number(it.supply_price) || 0),
        // Katalogda yo'q — ro'yxatlarda ko'rinmasin, lekin tarix saqlansin
        is_active: false,
      });
    }
  }
  if (!need.size) return;

  const rows = [...need.values()];
  const { data, error } = await db.from("products")
    .upsert(rows, { onConflict: "company_id,billz_id" })
    .select("id,billz_id");
  if (error) throw new Error(`yo'qolgan tovar yaratilmadi: ${error.message}`);
  for (const r of data ?? []) ctx.productIdByBillz.set(r.billz_id, r.id);
}

export async function syncOrders(db, ctx, {
  from = null, to = null, maxOrders = Infinity,
  deadline = Infinity, onProgress = null,
} = {}) {
  const stat = {
    fetched: 0, inserted: 0, items: 0, skipped: 0,
    unknownPayments: {}, noStore: 0, noItems: 0, deleted: 0,
    missingProducts: new Set(), cursor_at: null, exhausted: true,
  };
  const unknown = new Map();

  // Billz chek qatorida tannarxni bermaydi (doim 0). Katalogdagi joriy
  // tannarxni tayyorlab qo'yamiz — `saleItemRows` shundan oladi.
  const cat = await readAll(db, "products", "id,billz_id,cost_price");
  ctx.productIdByBillz = new Map(cat.filter((p) => p.billz_id).map((p) => [p.billz_id, p.id]));
  ctx.costByBillzProduct = new Map(cat.filter((p) => p.billz_id).map((p) => [p.billz_id, Number(p.cost_price) || 0]));

  // Mijoz bog'lami. `--only=orders` bilan alohida ishga tushirilganda
  // `syncCustomers` chaqirilmaydi va bu jadval bo'sh qolardi — natijada
  // HAMMA chek mijozsiz yozilib, qarzdorlik va mijoz kesimidagi barcha
  // hisobot bo'sh chiqardi (birinchi sinovda 85 tadan 85 tasi shunday).
  const cust = await readAll(db, "customers", "id,billz_id", (q) => q.not("billz_id", "is", null));
  ctx.customerIdByBillz = new Map(cust.map((c) => [c.billz_id, c.id]));

  const existing = await readAll(db, "sales", "id,billz_id", (q) => q.not("billz_id", "is", null));
  const saleIdByBillz = new Map(existing.map((s) => [s.billz_id, s.id]));

  // Qaytarish cheki ota chekka havola qiladi (`parent_id`). Ota chek
  // ro'yxatda keyinroq kelishi mumkin, shuning uchun bog'lash oxirida.
  const parents = [];
  let newest = null;
  let batch = [];        // yozilishi kutayotgan cheklar
  const pending = [];    // { billzOrder } — qatorlari yozilishi kerak

  async function flush() {
    if (!batch.length) return;
    const rows = batch.map((b) => b.row);
    const { data, error } = await db.from("sales")
      .upsert(rows, { onConflict: "company_id,billz_id" })
      .select("id,billz_id");
    if (error) throw new Error(`sales yozilmadi: ${error.message}`);
    for (const r of data ?? []) saleIdByBillz.set(r.billz_id, r.id);
    stat.inserted += rows.length;

    // Katalogda yo'q tovar. Billz `/v2/products` o'chirilgan tovarni
    // qaytarmaydi, lekin eski chekda u turaveradi. Qatorni tashlab
    // yuborsak chek summasi qatorlar yig'indisiga teng bo'lmay qoladi
    // (2 ta chekda 186 $ yo'qolgan edi). Shuning uchun chekdagi
    // ma'lumotdan tovar kartochkasi yaratiladi — nom va shtrix-kod
    // o'sha yerda bor. `is_active = false`: katalogda ko'rinmaydi,
    // lekin tarixdagi foyda to'g'ri hisoblanadi.
    await ensureMissingProducts(db, ctx, batch.map((b) => b.order));

    // Chek qatorlari — cheklar yozilgandan keyin (sale_id kerak)
    const itemRows = [];
    for (const b of batch) {
      const saleId = saleIdByBillz.get(b.order.id);
      if (!saleId) continue;
      const { rows: ir, missing } = saleItemRows(b.order, saleId, ctx);
      for (const m of missing) stat.missingProducts.add(m);
      // `product_id` NOT NULL — tovari topilmagan qator yozilmaydi,
      // lekin hisobga olinadi (jimgina yo'qolmasin)
      const ok = ir.filter((r) => r.product_id);
      stat.skipped += ir.length - ok.length;
      itemRows.push(...ok);
      if (!ir.length) stat.noItems++;
    }
    if (itemRows.length) {
      await upsertAll(db, "sale_items", itemRows, "sale_id,billz_id");
      stat.items += itemRows.length;
    }
    batch = [];
    onProgress?.(stat);
  }

  for await (const o of orderPages({ from, to })) {
    if (Date.now() > deadline) { stat.exhausted = false; break; }
    if (stat.fetched >= maxOrders) { stat.exhausted = false; break; }
    stat.fetched++;

    // O'chirilgan chek hisobotga kirmaydi
    if (isDeleted(o)) { stat.deleted++; continue; }

    const { row, parentBillzId, unknownPayments } = saleRow(o, ctx);
    for (const u of unknownPayments) unknown.set(u.name, (unknown.get(u.name) ?? 0) + u.amount);

    if (!row.store_id) { stat.noStore++; stat.skipped++; continue; }
    if (!row.sold_at) { stat.skipped++; continue; }
    if (!newest || row.sold_at > newest) newest = row.sold_at;
    if (parentBillzId) parents.push({ billzId: o.id, parentBillzId });

    batch.push({ row, order: o });
    if (batch.length >= 200) await flush();
  }
  await flush();

  // Qaytarish → asl chek bog'lami
  const links = parents
    .map((p) => ({ id: saleIdByBillz.get(p.billzId), original: saleIdByBillz.get(p.parentBillzId) }))
    .filter((x) => x.id && x.original);
  await inPool(links, async (l) => {
    await db.from("sales").update({ original_id: l.original }).eq("id", l.id);
  });

  // Mijoz statistikasi cheklardan hisoblanadi (jami xarid, savdo soni,
  // olingan tovar, "qaytuvchi mijoz"). Ilgari bu to'rt ustun faqat
  // Excel yuklamasida bor edi va shuning uchun Mijozlar sahifasi
  // bazani emas, yuklamani o'qirdi. Endi bitta SQL bilan yangilanadi.
  const { error: statErr } = await db.rpc("refresh_customer_stats");
  if (statErr) console.error("[billz] mijoz statistikasi yangilanmadi:", statErr.message);

  stat.cursor_at = newest;
  stat.unknownPayments = Object.fromEntries(unknown);
  stat.missingProducts = [...stat.missingProducts];
  stat.linkedReturns = links.length;
  return stat;
}

// ══════════════════════════════════════════════════════════════
// 6. QARZLAR
// ══════════════════════════════════════════════════════════════
// Billz qarzni sotuvdan alohida yuritadi va 10 844 yozuv beradi.
// Bazadagi eski 659 qarzda qaytish sanalari MODELLASHTIRILGAN edi
// (lib/debtsData.js) — shuning uchun ilova bazani emas, Excel
// yuklamasini o'qirdi. Endi haqiqiy raqam bor.
//
// Qarz ikki jadvalga tushadi: `debts` (berilgani) va `debt_payments`
// (har qaytish). Ikkinchisi bo'lmasa "o'rtacha necha kunda qaytadi"
// degan savolga javob yo'q — shuning uchun schema qarzni balans emas,
// HODISA ko'rinishida saqlaydi.
/**
 * @param opts.mode  "full"  — hammasi (10 844 yozuv, ~60 s)
 *                   "light" — faqat o'zgarishi mumkin bo'lganlari (~5 s)
 *
 * NEGA IKKI REJIM: qarzda `last_updated_date` filtri yo'q, ya'ni har
 * safar 109 sahifa tortiladi. Ilova ochilganda fonda ishga tushadigan
 * sinxronizatsiya uchun bu ortiqcha va Vercel'ning 300 soniyasini yeb
 * qo'yadi. Yengil rejimda ikki narsa olinadi:
 *   1. `status=unpaid` — hali yopilmagan 273 qarz. Faqat SHULAR
 *      o'zgarishi mumkin: yopilgan qarz boshqa o'zgarmaydi.
 *   2. kursordan keyin ochilgan yangi qarzlar (sana bo'yicha).
 * To'liq rejim kuniga bir marta (cron) ishlaydi va to'lov tarixini
 * boshidan solishtirib chiqadi.
 */
export async function syncDebts(db, ctx, { deadline = Infinity, mode = "full", since = null } = {}) {
  const stat = { mode, fetched: 0, inserted: 0, payments: 0, skipped: 0,
                 noCustomer: 0, cursor_at: null, exhausted: true };

  // Bog'lamlar: mijoz va chek allaqachon Billz id bilan yozilgan
  const cust = await readAll(db, "customers", "id,billz_id", (q) => q.not("billz_id", "is", null));
  ctx.customerIdByBillz = new Map(cust.map((c) => [c.billz_id, c.id]));
  const sold = await readAll(db, "sales", "id,billz_id", (q) => q.not("billz_id", "is", null));
  ctx.saleIdByBillzOrder = new Map(sold.map((s) => [s.billz_id, s.id]));

  let batch = [];
  let newest = null;

  async function flush() {
    if (!batch.length) return;
    const { data, error } = await db.from("debts")
      .upsert(batch.map((b) => b.row), { onConflict: "company_id,billz_id" })
      .select("id,billz_id");
    if (error) throw new Error(`debts yozilmadi: ${error.message}`);
    const idByBillz = new Map((data ?? []).map((r) => [r.billz_id, r.id]));
    stat.inserted += batch.length;

    const pays = [];
    for (const b of batch) {
      const id = idByBillz.get(b.debt.id);
      if (id) pays.push(...debtPaymentRows(b.debt, id));
    }
    if (pays.length) {
      await upsertAll(db, "debt_payments", pays, "debt_id,billz_key");
      stat.payments += pays.length;
    }
    batch = [];
  }

  // Yengil rejimda ikki oqim birlashtiriladi; bir qarz ikkalasiga ham
  // tushishi mumkin, shuning uchun ko'rilganlari belgilanadi.
  const seen = new Set();
  async function* source() {
    if (mode !== "light") { yield* debtPages(); return; }
    yield* openDebtPages();
    // Kursordan keyin ochilgan yangilar. Kursor bo'lmasa — oxirgi 30 kun.
    const from = since ? new Date(since) : new Date(Date.now() - 30 * 864e5);
    yield* debtPages({ start_date: fmtBillzDay(from), end_date: fmtBillzDay(new Date()) });
  }

  for await (const d of source()) {
    if (Date.now() > deadline) { stat.exhausted = false; break; }
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    stat.fetched++;
    if (clean(d.deleted_at)) { stat.skipped++; continue; }

    const row = debtRow(d, ctx);
    // `customer_id` MAJBURIY (not null) — mijozsiz qarz yozib bo'lmaydi.
    // Bunday holat mijoz Billz'da o'chirilganda bo'ladi.
    if (!row.customer_id) { stat.noCustomer++; stat.skipped++; continue; }
    if (!row.issued_at) { stat.skipped++; continue; }
    if (!newest || row.issued_at > newest) newest = row.issued_at;

    batch.push({ row, debt: d });
    if (batch.length >= 200) await flush();
  }
  await flush();

  stat.cursor_at = newest;
  return stat;
}

// ══════════════════════════════════════════════════════════════
// HAMMASI BIRGA
// ══════════════════════════════════════════════════════════════
/**
 * @param db          service-role Supabase mijozi
 * @param opts.only   ["products", "orders"] — bo'sh bo'lsa hammasi
 * @param opts.full   kursorsiz, to'liq tortish
 * @param opts.deadline  Date.now() birligida — Vercel 300 s cheklovi uchun
 */
export async function runSync(db, opts = {}) {
  const { only = null, full = false, dry = false, link = false,
          linkSales: linkSalesToo = false, debtsMode = "full",
          from = null, to = null, maxOrders = Infinity,
          deadline = Infinity, log = () => {} } = opts;

  const want = (s) => !only || only.includes(s);
  if (dry) db = dryClient(db);
  const ctx = await buildContext(db);
  const out = { company: ctx.companyName, stages: {}, warnings: [] };

  if (ctx.unmatchedShops.length) {
    out.warnings.push(`Billz do'koni NSPOS'da topilmadi: ${ctx.unmatchedShops.map((s) => s.name).join(", ")}`);
  }

  if (link) {
    log("bog'lanmoqda (shtrix-kod / telefon)…");
    out.stages.link = await linkExisting(db, ctx);
  }
  if (linkSalesToo) {
    log("eski cheklar Billz chekiga bog'lanmoqda…");
    out.stages.linkSales = await linkSales(db, ctx, { from, to, log });
  }

  const stages = [
    ["categories", () => syncCategories(db, ctx)],
    ["suppliers",  () => syncSuppliers(db, ctx)],
    ["products",   async () => syncProducts(db, ctx, { since: full ? null : await lastCursor(db, ctx.companyId, "products") })],
    ["customers",  async () => syncCustomers(db, ctx, { since: full ? null : await lastCursor(db, ctx.companyId, "customers"), full })],
    ["orders",     async () => syncOrders(db, ctx, {
        from: from ?? (full ? null : await lastCursor(db, ctx.companyId, "orders")),
        to, maxOrders, deadline,
      })],
    ["debts",      async () => syncDebts(db, ctx, {
        deadline, mode: debtsMode,
        since: full ? null : await lastCursor(db, ctx.companyId, "debts"),
      })],
  ];

  for (const [name, fn] of stages) {
    if (!want(name)) continue;
    const started = now();
    log(`${name}…`);
    try {
      const r = await fn();
      out.stages[name] = r;
      await writeLog(db, {
        company_id: ctx.companyId, entity: name,
        // Qarzda rejim o'zining ichida hal bo'ladi (full/light) —
        // jurnal aynan qaysi rejim ishlaganini yozadi, chunki
        // "to'liq tortish qachon bo'lgan" degan savol shundan o'qiladi.
        mode: r.mode ?? (full ? "full" : "incremental"),
        started_at: started, finished_at: now(),
        cursor_at: r.cursor_at ?? null,
        fetched: r.fetched ?? 0, inserted: r.inserted ?? 0,
        updated: r.updated ?? 0, skipped: r.skipped ?? 0,
      });
      log(`  ${name}: ${JSON.stringify({ ...r, missingProducts: undefined })}`);
    } catch (e) {
      const forbidden = e instanceof BillzError && e.forbidden;
      out.stages[name] = { error: e.message, forbidden };
      out.warnings.push(
        forbidden
          ? `${name}: Billz kalitida huquq yo'q (403). BILLZ UI → Integratsiya kalitlari → Rol.`
          : `${name}: ${e.message}`
      );
      await writeLog(db, {
        company_id: ctx.companyId, entity: name,
        mode: full ? "full" : "incremental",
        started_at: started, finished_at: now(), error: e.message.slice(0, 500),
      });
      log(`  ${name} XATO: ${e.message}`);
      // Bir bosqich yiqilsa qolganlari davom etaveradi: sotuvlarga
      // huquq bo'lmasa ham katalog yangilanishi kerak.
    }
  }

  return out;
}
