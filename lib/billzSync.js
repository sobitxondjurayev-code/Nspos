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
  productPages, clientPages, orderPages, debtPages, openDebtPages, overdueDebtPages,
  customerDebtPages, transferPages, billzGet, fmtBillzDay, BillzError,
} from "./billzApi";
import {
  matchStores, flattenCategories, categoryRow, supplierRow,
  productRow, stockRows, customerRow, saleRow, saleItemRows,
  mergeProduct, mergeCustomer, phoneKey, billzTime, isDeleted, saleType,
  debtRow, debtPaymentRows, servisNomi, transferRow,
} from "./billzMap";

export const STAGES = ["categories", "suppliers", "products", "customers", "orders", "debts", "transfers"];

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
  // Yozuv chaqiruvi javobni ham QAYTARADI va chaqiruvchi o'sha javobga
  // tayanadi: `upsert(...).select("id,billz_id")` dan kelgan qatorlar
  // bo'yicha qarz id'lari yig'iladi, keyin to'lovlar o'shanga bog'lanadi.
  // Ilgari bu yerda bitta OBYEKT qaytarilardi, PostgREST esa MASSIV
  // beradi — natijada `--dry --only=debts` "(data ?? []) is not iterable"
  // bo'lib to'xtardi va qarz yo'lini quruq rejimda umuman sinab
  // bo'lmasdi (aynan o'sha yo'l eng ko'p yozuv yozadi).
  //
  // Endi javob yozilmoqchi bo'lgan qatorlarning O'ZIDAN yasaladi:
  // dry natijasi haqiqiysiga o'xshab chiqadi, faqat baza tegilmaydi.
  const fake = (rows) => {
    const arr = Array.isArray(rows) ? rows : rows ? [rows] : [];
    const back = arr.map((r, i) => ({ ...r, id: r?.id ?? `${DRY_ID}-${i}` }));
    let one = false;   // `single()` chaqirilsa massiv emas, bitta qator
    const res = () => ({
      data: one ? (back[0] ?? { id: DRY_ID }) : back,
      error: null,
      count: back.length,
    });
    const chain = {
      select: () => chain,
      single: () => { one = true; return chain; },
      maybeSingle: () => { one = true; return chain; },
      eq: () => chain, in: () => chain, is: () => chain, not: () => chain,
      order: () => chain, limit: () => chain, range: () => chain,
      // `res()` — chaqirilgan PAYTDA yasaladi, chunki `single()` undan
      // keyin ham chaqirilishi mumkin
      then: (f, r) => Promise.resolve(res()).then(f, r),
      catch: (r) => Promise.resolve(res()).catch(r),
      finally: (f) => Promise.resolve(res()).finally(f),
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
    // ── `rpc` HAM TO'SILADI ──
    // Ilgari bu yerda `rpc: (...a) => db.rpc(...a)` turardi, ya'ni
    // saqlangan protsedura HAQIQIY bazada ishlayverardi. `syncOrders`
    // oxirida `refresh_customer_stats()` chaqiriladi va u
    // `customers` jadvalining to'rt ustunini QAYTA YOZADI — ya'ni
    // "hech narsa yozilmaydi" deb ishga tushirilgan `--dry` aslida
    // yozardi. Bu `dryClient` ning butun maqsadiga zid: yozuvni
    // shart bilan emas, JISMONAN to'sish kerak edi, `rpc` esa
    // to'sishdan chetda qolgan yagona yo'l edi.
    //
    // Javob shakli haqiqiysiga o'xshaydi (`{ data, error }`) —
    // chaqiruvchi `statErr` ni tekshiradi va soxta xato chiqmasin.
    rpc: async () => ({ data: null, error: null }),
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

// Qator soni — jadvalni tortmasdan (PostgREST `count=exact`, `head`).
async function countRows(db, table, filter) {
  let q = db.from(table).select("id", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count, error } = await q;
  if (error) throw new Error(`${table} sanalmadi: ${error.message}`);
  return count ?? 0;
}

// ══════════════════════════════════════════════════════════════
// FAQAT O'ZGARGANINI YOZISH
// ══════════════════════════════════════════════════════════════
// Postgres UPDATE tetiklarini qiymat o'zgarmagan bo'lsa ham ishga
// tushiradi. Bazada `audit_log` tetigi bor, ya'ni har `upsert`
// qatoriga bitta audit yozuvi qo'shiladi — o'zgarish bo'lmasa ham.
//
// O'lchandi (2026-08-20): kunlik to'liq qarz sinxronizatsiyasi
// 10 837 qarz + 15 987 to'lov = 27 483 audit yozuvi ≈ 31 MB/kun.
// Supabase bepul tarifi 500 MB, bazaning 178 MB'i band edi — ya'ni
// ~10 kunda to'lib qolardi. Odatdagi kunlik ish esa atigi 10–40 yozuv.
//
// Shuning uchun yozishdan OLDIN bazadagi qator bilan solishtiriladi
// va bir xil bo'lsa umuman yuborilmaydi.

// Raqam ustunlari PostgREST'dan SATR bo'lib keladi ("260.00"), sana esa
// har xil yozilishi mumkin ("...Z" / "+00:00") — shuning uchun oddiy
// `===` yaramaydi.
function sameValue(a, b) {
  if (a === b) return true;
  const aEmpty = a === null || a === undefined || a === "";
  const bEmpty = b === null || b === undefined || b === "";
  if (aEmpty && bEmpty) return true;
  if (aEmpty !== bEmpty) return false;

  if (typeof a === "boolean" || typeof b === "boolean") return !!a === !!b;

  const na = Number(a), nb = Number(b);
  // Chegara 0.00005 (ilgari 0.005): qarz endi 4 xona bilan yuriladi
  // va tiyinning kasri ham o'zgarish — aks holda 188.04 ↔ 188.035
  // "bir xil" bo'lib, aniq qiymat hech qachon yozilmasdi. Float
  // shovqini bundan ancha kichik.
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return Math.abs(na - nb) < 0.00005;

  const da = Date.parse(a), db = Date.parse(b);
  if (!Number.isNaN(da) && !Number.isNaN(db)) return da === db;

  return String(a) === String(b);
}

/**
 * YANGI va O'ZGARGAN ALOHIDA sanaladi.
 *
 * Nega bu shu yerda: `write` — "bazaga yuboriladigan qator", ya'ni
 * yangisi ham, o'zgargani ham. Chaqiruvchilar uzoq vaqt shu bitta
 * raqamni `inserted` deb jurnalga yozdi va jurnal har yarim soatda
 * "N ta qo'shildi" derdi — bazada esa yangi qator yo'q edi. Aynan
 * shu sabab 2026-08-19 dagi haqiqiy nosozlik besh kun ko'rinmadi
 * (`syncOrders` ichida 2026-08-24 da tuzatilgan edi, qolgan besh
 * bosqichda esa qolib ketgan — DAFTAR 14.7).
 *
 * Endi farq shu yerda, bir joyda hisoblanadi: yangi bosqich
 * qo'shilganda ham to'g'ri sanaydi.
 *
 * @param rows        yozilmoqchi bo'lgan qatorlar
 * @param existing    Map: kalit → bazadagi qator
 * @param keyOf       (row) => kalit
 * @param fields      solishtiriladigan ustunlar
 * @returns {{ write: object[], same: number, yangi: number, ozgargan: number }}
 */
function onlyChanged(rows, existing, keyOf, fields) {
  const write = [];
  let same = 0, yangi = 0;
  for (const r of rows) {
    const old = existing.get(keyOf(r));
    if (old && fields.every((f) => sameValue(old[f], r[f]))) { same++; continue; }
    if (!old) yangi++;
    write.push(r);
  }
  return { write, same, yangi, ozgargan: write.length - yangi };
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

// Bosqich nimadan shikoyat qilyapti — jurnalning `warnings` ustuniga.
// Ustun emas, JSONB: turlar oldindan noma'lum (Billz to'lov turini
// o'zi nomlaydi), ya'ni har yangi nom uchun sxema o'zgartirib
// bo'lmaydi. Bo'sh bo'lsa `null` yoziladi — jurnalda faqat aytadigan
// gapi bori tursin.
function sinxronOgohlari(r, ctx) {
  const o = {};
  if (r.unknownPayments && Object.keys(r.unknownPayments).length) {
    o.unknownPayments = r.unknownPayments;
  }
  // Do'koni tanilmagan chek AYNAN shu bosqichda tashlanadi, shuning
  // uchun ro'yxat ham shu yerga yoziladi — "nega tashlandi" degan
  // savolga javob bir joyda tursin.
  if (r.noStore > 0 && ctx.unmatchedShops?.length) {
    o.unmatchedShops = ctx.unmatchedShops.slice(0, 20).map((s) => s.name);
  }
  // Billz'da yo'q bo'lib qolgan tovar nofaol qilindi (to'liq katalog) —
  // ko'p bo'lsa jurnalda ko'rinsin; qo'riqchi to'xtatgan bo'lsa sababi
  if (r.deactivated > 0) o.deactivated = r.deactivated;
  if (r.ogoh) o.ogoh = r.ogoh;
  return Object.keys(o).length ? o : null;
}

// ══════════════════════════════════════════════════════════════
// KONTEKST
// ══════════════════════════════════════════════════════════════
export async function buildContext(db) {
  const { data: companies, error } = await db.from("companies")
    // `service_names` — qaysi tovar nomi XIZMAT ekani (odatda "montaj").
    // Sinxronizatsiya shu ro'yxatga qarab `products.is_service` yozadi.
    .select("id,name,service_names").limit(1);
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
    // DIQQAT: ajratish qoidasi `companyData.getServiceNames()` bilan
    // AYNAN bir xil bo'lishi kerak (vergul, trim, kichik harf).
    // Nusxalanishining sababi: `companyData` "use client" moduli va
    // serverga import qilinmaydi. Biri o'zgarsa ikkinchisi ham
    // o'zgarishi SHART — aks holda katalogdagi belgi bilan hisobotdagi
    // ajratish bir-biriga to'g'ri kelmay qoladi.
    servisNomlari: String(companies[0].service_names ?? "montaj")
      .toLowerCase().split(",").map((s) => s.trim()).filter(Boolean),
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

  // Kalit: "raqam|tur". Bir xil kalitli bir nechta eski qator bo'lsa —
  // taxmin qilmaymiz, tegmaymiz (ular baribir bir xil chek emasligiga
  // ishonch yo'q).
  //
  // ── NEGA SUMMA KALITDA EMAS ──
  // Ilgari kalit "raqam|tur|summa" edi va summa AYNAN mos kelishi
  // talab qilinardi. 7 779 chekdan 7 740 tasi bog'landi, 39 tasi
  // qoldi — sababi bir tiyin:
  //   000500084216 → Excel 1030.53 · Billz 1030.54
  //   000301099246 → Excel  395.93 · Billz  395.94
  // Farq Billz tomonidagi yaxlitlashdan. Natijada o'sha 39 chek
  // bazada IKKI marta turib qoldi va tarixiy tushum 17 052.88 $ ga
  // oshib ketdi (2026-08-23 da topildi, `sales.superseded_by` bilan
  // yopildi).
  //
  // Endi summa kalitda emas, TEKSHIRUV bo'lib qoldi: juftlik topilgach
  // farq bir tiyindan oshmasligi ko'riladi. Ya'ni yaxlitlash o'tadi,
  // boshqa chek esa baribir o'tmaydi.
  const YAXLITLASH = 0.02;
  const key = (no, type) => `${String(no).trim()}|${type}`;
  const byKey = new Map();
  const dup = new Set();
  for (const s of old) {
    const k = key(s.no, s.type);
    if (byKey.has(k)) dup.add(k); else byKey.set(k, { id: s.id, total: Math.abs(Number(s.total) || 0) });
  }
  for (const k of dup) byKey.delete(k);
  stat.ambiguous = dup.size;

  const updates = [];
  for await (const o of orderPages({ from, to })) {
    if (isDeleted(o)) continue;
    stat.checked++;
    const type = saleType(o);
    const total = o.order_detail?.total_price ?? 0;
    const k = key(o.order_number, type);
    const hit = byKey.get(k);
    if (!hit) { stat.notFound++; continue; }
    // Summa bir tiyindan ko'p farq qilsa — bu boshqa chek
    if (Math.abs(hit.total - Math.abs(Number(total) || 0)) > YAXLITLASH) {
      stat.notFound++;
      continue;
    }
    updates.push({ id: hit.id, billz_id: o.id });
    byKey.delete(k);   // bir eski qator — bir Billz cheki
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
    // O'ZGARMAGAN QATORGA TEGILMAYDI. Ilgari shart yo'q edi va har
    // sinxronizatsiya 35 ta kategoriyaning hammasini qaytadan yozardi —
    // kuniga ~1 500 ortiqcha PATCH (48 yurish × 35). Bekorga yozilgan
    // qator `updated_at` ni ham surib qo'yadi, ya'ni brauzerdagi jonli
    // yangilanish har 30 daqiqada "kategoriya o'zgardi" deb butun
    // ro'yxatni qayta tortardi. (2026-08-24, nginx jurnali bo'yicha.)
    if (old) { if (old.billz_id !== r.billz_id) update.push({ id: old.id, billz_id: r.billz_id }); }
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

  // Ilgari bu yerda `inserted: rows.length` qattiq yozilgan edi va
  // ikkala ta'minotchi ham HAR YURISHDA qayta yozilardi. Jurnalda esa
  // har yarim soatda "suppliers inserted=2" turardi — 2026-08-28 da
  // haqiqiy bazadan o'qilgan 48 ta yozuvning hammasi shunday edi,
  // holbuki yangi ta'minotchi qo'shilmagandi.
  //
  // Ikki zarari bor edi:
  //   • jurnalga ishonib bo'lmasdi — "qo'shildi" hech narsa demasdi;
  //   • har yozuv `audit_log` ga tetik qo'yadi: 2 qator × 48 yurish
  //     = kuniga 96 ta bekorga yozuv (DAFTAR 10.3 dagi 31 MB/kun
  //     muammosining kichik ko'rinishi).
  const SUPPLIER_FIELDS = ["name", "phone", "note"];
  const have = new Map(
    (await readAll(db, "suppliers", "id,billz_id,name,phone,note",
      (q) => q.not("billz_id", "is", null))).map((r) => [r.billz_id, r])
  );
  const { write, same, yangi, ozgargan } = onlyChanged(
    rows, have, (r) => r.billz_id, SUPPLIER_FIELDS);
  if (write.length) await upsertAll(db, "suppliers", write, "company_id,billz_id");

  return { fetched: rows.length, inserted: yangi, updated: ozgargan, unchanged: same };
}

// ══════════════════════════════════════════════════════════════
// 3. TOVARLAR + QOLDIQ
// ══════════════════════════════════════════════════════════════
// `since` berilsa Billz faqat o'zgargan tovarlarni qaytaradi. Shu sabab
// har 30 daqiqada 652 tovar emas, 2–3 tasi keladi.
export async function syncProducts(db, ctx, { since = null } = {}) {
  // Kategoriya bog'lami. `--only=products` bilan alohida ishga
  // tushirilganda `syncCategories` chaqirilmaydi va bu jadval bo'sh
  // qolardi — natijada BUTUN katalogga `category_id = null` yozilib,
  // keyingi safar hammasi "o'zgargan" bo'lib qayta yozilardi
  // (652 ta ortiqcha audit yozuvi, har safar).
  if (!ctx.categoryIdByBillz.size) {
    for (const c of await readAll(db, "categories", "id,billz_id")) {
      if (c.billz_id) ctx.categoryIdByBillz.set(c.billz_id, c.id);
    }
  }

  const existing = await readAll(db, "products",
    // DIQQAT: bu ro'yxat `PRODUCT_FIELDS` bilan bir xil bo'lishi SHART.
    // Solishtiriladigan ustun bu yerda bo'lmasa bazadan `undefined`
    // kelib, har qator "o'zgargan" bo'lib chiqadi va butun katalog
    // har safar qayta yoziladi (652 ortiqcha audit yozuvi).
    "id,billz_id,name,barcode,sku,brand,supplier,unit,description," +
    "category_id,sale_price,cost_price,is_variative,is_service,is_active");
  const byBillz = new Map(existing.filter((p) => p.billz_id).map((p) => [p.billz_id, p]));
  const byBarcode = new Map(existing.filter((p) => p.barcode).map((p) => [p.barcode, p]));

  const rows = [];
  const stock = [];
  const conflicts = [];
  let fetched = 0, relinked = 0, stat_unchanged = 0;
  let newest = since ? new Date(since).getTime() : 0;

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

  // Faqat o'zgargani. `updated_at` solishtirilmaydi — u har safar
  // yangi bo'ladi va o'zi bilan butun katalogni qayta yozdirardi.
  const PRODUCT_FIELDS = ["name", "sku", "barcode", "category_id", "brand",
                          "supplier", "sale_price", "cost_price", "unit",
                          "description", "is_variative", "is_service", "is_active"];
  const haveProducts = new Map(existing.filter((p) => p.billz_id).map((p) => [p.billz_id, p]));
  const pChanged = onlyChanged(rows, haveProducts, (r) => r.billz_id, PRODUCT_FIELDS);
  stat_unchanged += pChanged.same;
  if (pChanged.write.length) await upsertAll(db, "products", pChanged.write, "company_id,billz_id");

  // ── BILLZ'DA YO'Q BO'LIB QOLGAN TOVAR → NOFAOL (2026-09-03) ──
  // Sinxron faqat qo'shadi va yangilaydi, O'CHIRMAYDI (qoida). Lekin
  // Billz'da o'chirilgan tovar NSPOS ro'yxatida abadiy qolardi — rahbar
  // "eski tovarlar" dedi. TO'LIQ katalogda (since = null) Billz
  // ro'yxatida kelmagan, `billz_id` li faol tovar `is_active = false`
  // bo'ladi (update, delete emas); qaytib kelsa `productRow` uni yana
  // `true` qiladi. QO'RIQCHI: Billz yarim javob bersa (tarmoq, 500)
  // butun katalog "yo'q" bo'lib chiqmasin — kelgan soni bazadagining
  // kamida yarmi bo'lsagina ishlaydi.
  let deactivated = 0, ogoh = null;
  if (since === null) {
    const kelgan = new Set(rows.map((r) => r.billz_id));
    const yoq = existing.filter((p) => p.billz_id && p.is_active !== false && !kelgan.has(p.billz_id));
    const bazada = existing.filter((p) => p.billz_id).length;
    if (yoq.length && fetched >= bazada * 0.5) {
      for (let i = 0; i < yoq.length; i += 200) {
        const ids = yoq.slice(i, i + 200).map((p) => p.id);
        const { error } = await db.from("products").update({ is_active: false, updated_at: now() }).in("id", ids);
        if (error) throw new Error(`products nofaol qilinmadi: ${error.message}`);
        deactivated += ids.length;
      }
    } else if (yoq.length) {
      ogoh = `Billz ${fetched} tovar berdi, bazada ${bazada} — ${yoq.length} ta "yo'q" tovar nofaol QILINMADI (javob chala bo'lishi mumkin)`;
    }
  }

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
  // Qoldiq ham xuddi shunday: 1 956 qatordan odatda 5-10 tasi o'zgaradi
  const haveStock = new Map(
    (await readAll(db, "stock", "product_id,store_id,qty"))
      .map((r) => [`${r.product_id}|${r.store_id}`, r])
  );
  const sChanged = onlyChanged(stockRowsFinal, haveStock,
    (r) => `${r.product_id}|${r.store_id}`, ["qty"]);
  stat_unchanged += sChanged.same;
  if (sChanged.write.length) await upsertAll(db, "stock", sChanged.write, "product_id,store_id");

  return {
    // `relinked` — shtrix-kod bo'yicha billz_id ga BOG'LANGAN eski
    // qator. U "yangilandi" degani emas, shuning uchun o'z nomi
    // bilan qaytadi; `updated` esa qiymati haqiqatan o'zgarganini
    // sanaydi. Ilgari ikkalasi bitta ustunda aralashardi.
    fetched, inserted: pChanged.yangi, updated: pChanged.ozgargan, relinked,
    stock: sChanged.write.length, unchanged: stat_unchanged,
    // Billz'da yo'q bo'lib qolgani — nofaol (faqat to'liq katalogda)
    deactivated, ogoh,
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
  const existing = await readAll(db, "customers", "id,billz_id,phone,name,store_id,balance,billz_external_id,first_purchase_at,last_purchase_at");
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

  const CUSTOMER_FIELDS = ["name", "phone", "balance", "billz_external_id",
                           "first_purchase_at", "last_purchase_at", "store_id"];
  const haveCust = new Map(existing.filter((c) => c.billz_id).map((c) => [c.billz_id, c]));
  const cChanged = onlyChanged(rows, haveCust, (r) => r.billz_id, CUSTOMER_FIELDS);
  if (cChanged.write.length) await upsertAll(db, "customers", cChanged.write, "company_id,billz_id");

  const after = await readAll(db, "customers", "id,billz_id");
  ctx.customerIdByBillz = new Map(after.filter((c) => c.billz_id).map((c) => [c.billz_id, c.id]));

  return {
    fetched, inserted: cChanged.yangi, updated: cChanged.ozgargan, stopped,
    unchanged: cChanged.same,
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
      const nomi = (it.product?.name || it.name || "Billz tovari").trim();
      need.set(bid, {
        company_id: ctx.companyId,
        billz_id: bid,
        name: nomi,
        // Shtrix-kod `unique (company_id, barcode)` cheklovi ostida —
        // band bo'lsa yozmaymiz, aks holda butun bo'lak yiqiladi
        barcode: null,
        sku: (it.sku || "").trim() || null,
        sale_price: Math.abs(Number(it.sale_price ?? it.price) || 0),
        cost_price: Math.abs(Number(it.supply_price) || 0),
        // Katalogdan o'chirilgan XIZMAT ham bo'lishi mumkin (eski
        // "montaj" kartochkasi). Belgi shu yerda ham qo'yiladi, aks
        // holda katalogdagi montaj xizmat, chekdan tiklangani esa
        // oddiy tovar bo'lib qolardi va qoldiq hisobi buzilardi.
        is_service: servisNomi(nomi, ctx),
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
    fetched: 0, inserted: 0, updated: 0, items: 0, skipped: 0,
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
    // Yangi va yangilangan ALOHIDA sanaladi. Ilgari `upsert` ga
    // ketgan hamma qator "inserted" deb hisoblanardi va jurnal har
    // 30 daqiqada "34 ta chek qo'shildi" deb yozardi — bazada esa
    // yangi qator yo'q edi. Bunday jurnalga ishonib bo'lmaydi, va
    // aynan shu sabab haqiqiy nosozlik uzoq vaqt ko'rinmadi.
    const yangiSoni = rows.filter((r) => !saleIdByBillz.has(r.billz_id)).length;
    const { data, error } = await db.from("sales")
      .upsert(rows, { onConflict: "company_id,billz_id" })
      .select("id,billz_id");
    if (error) throw new Error(`sales yozilmadi: ${error.message}`);
    for (const r of data ?? []) saleIdByBillz.set(r.billz_id, r.id);
    stat.inserted += yangiSoni;
    stat.updated = (stat.updated ?? 0) + (rows.length - yangiSoni);

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
 * safar 111 sahifa tortiladi — har 5 daqiqada bu ortiqcha. Yengil
 * rejimda to'rt oqim olinadi (DAFTAR 17, 02.09 o'lchovi):
 *   1. `status=unpaid`  — to'lov tushmagan ochiqlar (289).
 *   2. `status=overdue` — muddati o'tganlar, QISMAN TO'LANGANI HAM (374,
 *      shundan 96 tasi 1-oqimda YO'Q). Ilgari faqat 1-oqim olinardi va
 *      qisman to'lov, yopilish 20 soatgacha ko'rinmasdi.
 *   3. kursordan keyin ochilgan yangilar (sana bo'yicha).
 *   4. bazada ochiq-u 1–3 da KELMAGAN qarz = Billz'da yopilgan (yoki
 *      muddati kelmagan `partial_paid`). Ular MIJOZ bo'yicha so'raladi
 *      (`customer_id`) — id bo'yicha yo'l 403 beradi. Mijoz ko'p bo'lsa
 *      (> 40) to'liq ro'yxat olinadi.
 * To'liq rejim har 2 soatda (route o'zi hal qiladi) to'lov tarixini
 * boshidan solishtirib chiqadi.
 */
export async function syncDebts(db, ctx, { deadline = Infinity, mode = "full", since = null } = {}) {
  const stat = { mode, fetched: 0, inserted: 0, updated: 0, payments: 0, skipped: 0,
                 noCustomer: 0, cursor_at: null, exhausted: true,
                 // Billz'dagi OCHIQ qarz (fully_paid dan boshqa, o'chirilmagan) —
                 // farq detektori bazadagi ochiq qarz bilan solishtiradi.
                 // `toliq` — ro'yxat to'liq ko'rildimi (yengil rejimda 4-oqim
                 // tugagach ham to'liq: bazada ochiq bo'lgan har qarz ko'rilgan).
                 billzOchiq: { soni: 0, summa: 0, toliq: mode !== "light" },
                 yopilganNomzod: 0, mijozOqimi: 0 };

  // Bog'lamlar: mijoz va chek allaqachon Billz id bilan yozilgan
  const cust = await readAll(db, "customers", "id,billz_id", (q) => q.not("billz_id", "is", null));
  ctx.customerIdByBillz = new Map(cust.map((c) => [c.billz_id, c.id]));
  const custBillzById = new Map(cust.map((c) => [c.id, c.billz_id]));
  const sold = await readAll(db, "sales", "id,billz_id", (q) => q.not("billz_id", "is", null));
  ctx.saleIdByBillzOrder = new Map(sold.map((s) => [s.billz_id, s.id]));

  // Bazadagi holat — o'zgarmaganini qayta yozmaslik uchun
  const haveDebts = new Map(
    (await readAll(db, "debts", "id,billz_id,amount,paid_amount,status,closed_at,due_date,customer_id,sale_id,store_id,source",
      (q) => q.not("billz_id", "is", null))).map((d) => [d.billz_id, d])
  );
  // To'lovlar o'zgarmaydi: bir marta yozilgan qator qayta yozilmaydi
  const havePayments = new Set(
    (await readAll(db, "debt_payments", "debt_id,billz_key", (q) => q.not("billz_key", "is", null)))
      .map((p) => `${p.debt_id}|${p.billz_key}`)
  );
  stat.unchanged = 0;

  let batch = [];
  let newest = null;

  // `source` ham solishtiriladi: yorlig'i 'nspos' bo'lib qolgan eski
  // qator keyingi yurishda o'zi 'billz' ga tuzaladi.
  const DEBT_FIELDS = ["amount", "paid_amount", "status", "closed_at",
                       "due_date", "customer_id", "sale_id", "store_id", "source"];

  async function flush() {
    if (!batch.length) return;

    // `yangi`/`ozgargan` haveDebts MUTATSIYASIDAN OLDIN hisoblanadi —
    // pastda upsert javobi o'sha map'ga yangi qatorlarni qo'shadi.
    const { write, same, yangi, ozgargan } = onlyChanged(
      batch.map((b) => b.row), haveDebts, (r) => r.billz_id, DEBT_FIELDS);
    stat.unchanged += same;

    const idByBillz = new Map(haveDebts.size
      ? [...haveDebts].map(([bid, d]) => [bid, d.id]) : []);

    if (write.length) {
      const { data, error } = await db.from("debts")
        .upsert(write, { onConflict: "company_id,billz_id" })
        .select("id,billz_id");
      if (error) throw new Error(`debts yozilmadi: ${error.message}`);
      for (const r of data ?? []) {
        idByBillz.set(r.billz_id, r.id);
        haveDebts.set(r.billz_id, { ...write.find((w) => w.billz_id === r.billz_id), id: r.id });
      }
      stat.inserted += yangi;
      stat.updated += ozgargan;
    }

    // To'lovlar: bazada bori qayta yozilmaydi. To'liq rejimda bu
    // 15 987 yozuvning deyarli hammasini olib tashlaydi.
    const pays = [];
    for (const b of batch) {
      const id = idByBillz.get(b.debt.id);
      if (!id) continue;
      for (const row of debtPaymentRows(b.debt, id)) {
        const k = `${id}|${row.billz_key}`;
        if (havePayments.has(k)) { stat.unchanged++; continue; }
        havePayments.add(k);
        pays.push(row);
      }
    }
    if (pays.length) {
      await upsertAll(db, "debt_payments", pays, "debt_id,billz_key");
      stat.payments += pays.length;
    }
    batch = [];
  }

  // Yengil rejimda oqimlar birlashtiriladi; bir qarz bir nechtasiga
  // tushishi mumkin, shuning uchun ko'rilganlari belgilanadi.
  const seen = new Set();
  async function* source() {
    if (mode !== "light") { yield* debtPages(); return; }
    yield* openDebtPages();
    yield* overdueDebtPages();
    // Kursordan keyin ochilgan yangilar. Kursor bo'lmasa — oxirgi 30 kun.
    const from = since ? new Date(since) : new Date(Date.now() - 30 * 864e5);
    yield* debtPages({ start_date: fmtBillzDay(from), end_date: fmtBillzDay(new Date()) });

    // 4-oqim. `seen` shu paytgacha yuqoridagi uch oqimning HAMMASINI
    // ko'rgan (generator dangasa — iste'molchi qator-qator oladi).
    const qolgan = [...haveDebts.values()].filter((x) => !x.closed_at && !seen.has(x.billz_id));
    stat.yopilganNomzod = qolgan.length;
    if (!qolgan.length) { stat.billzOchiq.toliq = true; return; }
    const mijozlar = new Set(qolgan.map((x) => custBillzById.get(x.customer_id)).filter(Boolean));
    // Mijozi bog'lanmagan qarz bo'lsa yoki mijoz ko'p bo'lsa — to'liq ro'yxat
    if (mijozlar.size > 40 || qolgan.some((x) => !custBillzById.get(x.customer_id))) {
      stat.mode = "light+full";
      yield* debtPages();
      stat.billzOchiq.toliq = true;
      return;
    }
    stat.mijozOqimi = mijozlar.size;
    for (const id of mijozlar) yield* customerDebtPages(id);
    stat.billzOchiq.toliq = true;
  }

  for await (const d of source()) {
    if (Date.now() > deadline) { stat.exhausted = false; stat.billzOchiq.toliq = false; break; }
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    stat.fetched++;
    if (clean(d.deleted_at)) { stat.skipped++; continue; }
    if (clean(d.status).toLowerCase() !== "fully_paid") {
      stat.billzOchiq.soni++;
      stat.billzOchiq.summa += Math.round((Number(d.amount || 0) - Number(d.paid_amount || 0)) * 10000) / 10000;
    }

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
  stat.billzOchiq.summa = Math.round(stat.billzOchiq.summa * 100) / 100;
  return stat;
}

// ══════════════════════════════════════════════════════════════
// FARQ DETEKTORI — ko'zgu Billz bilan mosmi
// ══════════════════════════════════════════════════════════════
// Sinxron "OK" deb turib ko'zgu orqada qolishi mumkin: filtr to'liq
// ro'yxat bermaydi (`status=unpaid`), yorliq yozilmaydi (`source`),
// do'kon nomi o'zgaradi. Bularning birortasi xato bermaydi. Shuning
// uchun har yurish oxirida Billz'ning O'Z sonlari bilan solishtiriladi
// — arzon (`limit=1` → `count`) va 7 kunlik cheklar id bo'yicha.
// Natija `billz_sync_log` (`entity='moslik'`) → `audit.js` `billz-farq`
// → ekrandagi muhr ("Billz: 23:30 · mos ✓" yoki qizil "2 ta farq").
export async function moslikTekshir(db, ctx, { debts = null } = {}) {
  const farq = [];
  const olchov = {};
  const tekshir = (nom, billz, nspos, { chegara = 0 } = {}) => {
    olchov[nom] = { billz, nspos };
    if (billz == null || nspos == null) return;
    if (Math.abs(billz - nspos) > chegara) farq.push({ nima: nom, billz, nspos });
  };

  // 1. Tovar soni. Chekdan yaratilgan kartochka (`is_active=false`,
  //    Billz'da o'chirilgan tovar) hisobga kirmaydi — u Billz'da yo'q.
  const bp = (await billzGet("/v2/products", { limit: 1, page: 1 })).count ?? null;
  tekshir("tovar", bp == null ? null : Number(bp),
    await countRows(db, "products", (q) => q.not("billz_id", "is", null).eq("is_active", true)));

  // 2. Mijoz soni
  const bc = (await billzGet("/v1/client", { limit: 1, page: 1 })).count ?? null;
  tekshir("mijoz", bc == null ? null : Number(bc),
    await countRows(db, "customers", (q) => q.not("billz_id", "is", null)));

  // 3. Ochiq qarz — soni va summasi. Faqat qarz bosqichi ro'yxatni
  //    TO'LIQ ko'rgan bo'lsa (aks holda soxta farq chiqadi).
  if (debts?.billzOchiq?.toliq) {
    const ochiq = await readAll(db, "debts", "amount,paid_amount",
      (q) => q.not("billz_id", "is", null).is("closed_at", null));
    const summa = Math.round(ochiq.reduce((a, d) => a + Number(d.amount) - Number(d.paid_amount), 0) * 100) / 100;
    tekshir("ochiq qarz soni", debts.billzOchiq.soni, ochiq.length);
    tekshir("ochiq qarz summasi", debts.billzOchiq.summa, summa, { chegara: 0.02 });
  } else {
    olchov["ochiq qarz"] = { izoh: "yengil rejimda to'liq ko'rilmadi — solishtirilmadi" };
  }

  // 4. Oxirgi 7 kun cheklari — id bo'yicha. Sanoq emas: Billz `count`
  //    kun chegarasini UTC bilan oladi va sof sanoq soxta farq berardi
  //    (02.09: 1 312 ↔ 1 271, aslida hammasi bor edi).
  const from = new Date(Date.now() - 7 * 864e5);
  const dbIds = new Set((await readAll(db, "sales", "billz_id",
    (q) => q.not("billz_id", "is", null).gte("sold_at", new Date(Date.now() - 9 * 864e5).toISOString())))
    .map((s) => s.billz_id));
  let n = 0, yoq = 0, yoqSumma = 0;
  for await (const o of orderPages({ from, to: new Date() })) {
    n++;
    if (isDeleted(o)) continue;
    if (!dbIds.has(o.id)) { yoq++; yoqSumma += Math.abs(Number(o.order_detail?.total_price ?? 0)); }
  }
  olchov["7 kun chek"] = { billz: n, yoq, yoqSumma: Math.round(yoqSumma * 100) / 100 };
  if (yoq) farq.push({ nima: "7 kun chek (bazada yo'q)", billz: n, nspos: n - yoq, summa: Math.round(yoqSumma * 100) / 100 });

  return { fetched: Object.keys(olchov).length, farqSoni: farq.length, farq, olchov };
}

// ══════════════════════════════════════════════════════════════
// 7. TRANSFERLAR — sklad ↔ filial ko'chirish (2026-09-03)
// ══════════════════════════════════════════════════════════════
// Billz `/v2/transfer` yangisidan eskisiga beradi, sana filtri yo'q.
// Inkremental: sahifalab boriladi, sahifadagi HAMMA yozuv bazada bor va
// o'zgarmagan bo'lsa to'xtaydi (yangi transfer doim tepada). `full` —
// oxirigacha (2 063 yozuv = 21 sahifa, ~11 s). Qabul qilinishi keyin
// bo'ladi (`accepted_at`, `qty_arrived`) — shuning uchun sahifa
// "o'zgargan" bo'lsa ham davom etadi.
export async function syncTransfers(db, ctx, { full = false } = {}) {
  const FIELDS = ["name", "from_store_id", "to_store_id", "from_name", "to_name", "qty",
                  "qty_arrived", "retail_total", "supply_total", "status_id", "differs",
                  "created_by", "accepted_by", "comment", "created_at", "accepted_at"];
  const existing = await readAll(db, "stock_transfers",
    "id,billz_id," + FIELDS.join(","), (q) => q.not("billz_id", "is", null));
  const have = new Map(existing.map((r) => [r.billz_id, r]));

  const rows = [];
  let fetched = 0, page = 0, sahifadaYangi = 0;
  for await (const t of transferPages({ limit: 100, max: full ? Infinity : 500 })) {
    fetched++;
    const raw = transferRow(t, ctx);
    rows.push(raw);
    const old = have.get(raw.billz_id);
    if (!old || FIELDS.some((f) => !sameValue(old[f], raw[f]))) sahifadaYangi++;
    if (fetched % 100 === 0) {
      page++;
      // Butun sahifa eskicha — davomi ham eskicha (tartib: yangisi tepada)
      if (!full && sahifadaYangi === 0) break;
      sahifadaYangi = 0;
    }
  }

  const { write, same, yangi, ozgargan } = onlyChanged(rows, have, (r) => r.billz_id, FIELDS);
  if (write.length) await upsertAll(db, "stock_transfers", write, "company_id,billz_id");
  const bogʻlanmagan = rows.filter((r) => !r.from_store_id || !r.to_store_id).length;
  return {
    fetched, inserted: yangi, updated: ozgargan, unchanged: same,
    // Do'koni tanilmagan transfer — nom bilan saqlanadi, lekin hisobotda
    // yo'nalish "?" bo'ladi; jurnalda ko'rinsin
    noStore: bogʻlanmagan,
    mode: full ? "full" : "incremental",
    cursor_at: rows[0]?.created_at ?? null,
  };
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
    // Transferlar: birinchi marta (bazada bo'sh) to'liq, keyin inkremental
    ["transfers",  async () => syncTransfers(db, ctx, {
        full: full || !(await lastCursor(db, ctx.companyId, "transfers")),
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
        // ── NIMA TASHLAB KETILGANI ──
        // Jurnal ORTIQCHA aytmasligi kerak edi (DAFTAR 10.4), lekin
        // KAM aytishi ham xuddi shunday xavfli: quyidagi uch raqam
        // bosqich ichida hisoblanardi-yu, javob JSON'ida qolib
        // ketardi. Cron esa javobdan faqat `inserted|items|payments`
        // ni grep qiladi — ya'ni "34 ta chek qo'shildi" degan qator
        // 101 ta chek tashlanganini yashirib turardi.
        no_store: r.noStore ?? 0,
        exhausted: r.exhausted ?? null,
        warnings: sinxronOgohlari(r, ctx),
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

  // Farq detektori — faqat TO'LIQ aylanishda (`only` bo'lmasa): bitta
  // bosqich chaqirilganda qolganlari eskirgan bo'ladi va solishtiruv
  // soxta qizaradi.
  if (!only && !dry) {
    const started = now();
    log("moslik…");
    try {
      const r = await moslikTekshir(db, ctx, { debts: out.stages.debts });
      out.stages.moslik = r;
      await writeLog(db, {
        company_id: ctx.companyId, entity: "moslik", mode: "moslik",
        started_at: started, finished_at: now(),
        fetched: r.fetched, skipped: r.farqSoni,
        warnings: { farq: r.farq, olchov: r.olchov },
      });
      log(`  moslik: ${r.farqSoni ? JSON.stringify(r.farq) : "farq yo'q"}`);
    } catch (e) {
      out.stages.moslik = { error: e.message };
      await writeLog(db, {
        company_id: ctx.companyId, entity: "moslik", mode: "moslik",
        started_at: started, finished_at: now(), error: e.message.slice(0, 500),
      });
      log(`  moslik XATO: ${e.message}`);
    }
  }

  return out;
}
