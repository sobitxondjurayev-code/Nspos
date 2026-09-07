// ══════════════════════════════════════════════════════════════
// BILLZ ↔ NSPOS KO'ZGUSI — id bo'yicha solishtiruv (FAQAT O'QIYDI)
// ══════════════════════════════════════════════════════════════
//   npm run billz:solishtir                 → tovar/qoldiq, ochiq qarz, 7 kun chek
//   npm run billz:solishtir -- --qarz=hammasi   → 11 000 qarzning hammasi (~2 daqiqa)
//   npm run billz:solishtir -- --kun=30 --only=chek
//
// Nega bor (DAFTAR 17): 02.09 da "Qoldiq salomatligi" va qarz Billz'dan
// farq qilganda javob shu solishtiruvdan chiqdi — qoldiq 656/656 mos,
// qarz esa 150 ta yorliqsiz + 12 ta yopilgani ko'rilmagan. Sinxron
// jurnali "OK" deb turgan edi. Chiqarishdan oldin va farq detektori
// (`billzSync.moslikTekshir`) qizarganda yurgiziladi.
//
// Farq detektoridan farqi: u SANOQ bilan ishlaydi (arzon, har 5 daqiqa),
// bu esa HAR QATORNI id bo'yicha ko'radi va aynan qaysi tovar/qarz/chek
// farq qilayotganini aytadi.
//
// HECH NARSA YOZMAYDI: Billz'ga faqat GET, bazadan faqat select.
// Bazaga PostgREST service kaliti bilan boradi (RLS chetlab o'tiladi —
// aks holda bo'sh javob "farq" bo'lib ko'rinardi, CLAUDE.md 2026-08-28).
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { bazaTekshir } from "./lib/baza.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
  if (m && m[2]) process.env[m[1]] ??= m[2];
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !process.env.BILLZ_SECRET_TOKEN) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY va BILLZ_SECRET_TOKEN kerak (.env.local)");
  process.exit(1);
}

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const val = (n, d = null) => { const h = argv.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d; };

// Manba tekshiruvi ENG BIRINCHI (CLAUDE.md 2026-08-28)
const manba = bazaTekshir(url, { ruxsat: flag("boshqa-baza"), nima: "billz-solishtir" });
console.log(`manba: ${manba}`);

const only = val("only") ? val("only").split(",") : ["tovar", "qarz", "chek"];
const kun = Number(val("kun", 7));
const qarzRejim = val("qarz", "ochiq");     // ochiq | hammasi

const api = await import("../lib/billzApi.js");
const { isDeleted } = await import("../lib/billzMap.js");
const db = createClient(url, key, { auth: { persistSession: false } });

async function readAll(table, select, filter) {
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
const r2 = (x) => Math.round(Number(x || 0) * 100) / 100;
const sum = (arr, f) => r2(arr.reduce((a, x) => a + f(x), 0));
let farqBor = false;
const sarlavha = (s) => console.log(`\n══ ${s} ══`);
const natija = (n, matn) => { if (n) farqBor = true; console.log(`${n ? "✗" : "✓"} ${matn}`); };

// ── 1. TOVAR VA QOLDIQ ───────────────────────────────────────
if (only.includes("tovar")) {
  sarlavha("Tovar va qoldiq (id bo'yicha)");
  const billz = new Map();
  let billzTotalSupply = 0;
  for await (const p of api.productPages(null)) {
    const act = (p.shop_measurement_values ?? []).reduce((a, s) => a + Number(s.active_measurement_value || 0), 0);
    let pSupply = 0;
    if (p.product_supplier_stock?.length) {
      for (const ss of p.product_supplier_stock) {
        const q = Number(ss.measurement_value || 0);
        const cost = Number(ss.max_supply_price || ss.min_supply_price || 0);
        pSupply += q * cost;
      }
    }
    billzTotalSupply += pSupply;
    billz.set(p.id, { name: (p.name || "").trim(), qoldiq: act, supply: pSupply });
  }
  const rows = await readAll("products", "id,billz_id,name,is_active,cost_price,is_service,stock(qty)", (q) => q.not("billz_id", "is", null));
  const farq = [], yoq = [];
  let nsposTotalSupply = 0;
  for (const r of rows) {
    const b = billz.get(r.billz_id);
    if (!b) { if (r.is_active) yoq.push(r.name); continue; }
    const dbq = (r.stock ?? []).reduce((a, s) => a + Number(s.qty || 0), 0);
    if (Math.abs(dbq - b.qoldiq) > 0.001) farq.push({ tovar: r.name, nspos: dbq, billz: b.qoldiq });
    if (r.is_active && !r.is_service) {
      nsposTotalSupply += dbq * Number(r.cost_price || 0);
    }
  }
  const dbIds = new Set(rows.map((r) => r.billz_id));
  const bazadaYoq = [...billz.entries()].filter(([id]) => !dbIds.has(id)).map(([, b]) => b.name);
  console.log(`Billz ${billz.size} tovar · NSPOS ${rows.length} (faol ${rows.filter((r) => r.is_active).length})`);
  natija(farq.length, `qoldiq farqi: ${farq.length}`);
  for (const f of farq.slice(0, 15)) console.log(`   ${f.tovar} — NSPOS ${f.nspos}, Billz ${f.billz}`);
  natija(bazadaYoq.length, `Billz'da bor, bazada yo'q: ${bazadaYoq.length}${bazadaYoq.length ? " — " + bazadaYoq.slice(0, 5).join(", ") : ""}`);
  natija(yoq.length, `bazada faol, Billz'da yo'q: ${yoq.length}${yoq.length ? " — " + yoq.slice(0, 5).join(", ") : ""}`);
  console.log(`Qoldiq qiymati: Billz $${billzTotalSupply.toFixed(2)} · NSPOS $${nsposTotalSupply.toFixed(2)} (farq: $${Math.abs(billzTotalSupply - nsposTotalSupply).toFixed(2)})`);
}

// ── 2. QARZ ──────────────────────────────────────────────────
if (only.includes("qarz")) {
  sarlavha(`Qarz (${qarzRejim === "hammasi" ? "hammasi" : "ochiqlar: unpaid + overdue oqimlari"})`);
  const billz = new Map();
  async function* oqim() {
    if (qarzRejim === "hammasi") { yield* api.debtPages(); return; }
    yield* api.openDebtPages();
    yield* api.overdueDebtPages();
  }
  for await (const d of oqim()) {
    if (billz.has(d.id)) continue;
    const del = d.deleted_at && d.deleted_at !== "0" && !String(d.deleted_at).startsWith("0001") && d.deleted_at !== "";
    if (del) continue;
    billz.set(d.id, { status: d.status, amount: Number(d.amount || 0), paid: Number(d.paid_amount || 0) });
  }
  const rows = await readAll("debts", "id,billz_id,source,status,amount,paid_amount,closed_at", (q) => q.not("billz_id", "is", null));
  const dbBy = new Map(rows.map((r) => [r.billz_id, r]));
  const dbOchiqBillzYopgan = [], paidFarq = [], billzOchiqDbYoq = [], yorliq = [];
  for (const r of rows) {
    if (r.source !== "billz") yorliq.push(r);
    const b = billz.get(r.billz_id);
    const dbOchiq = !r.closed_at;
    if (!b) continue;                                   // ochiq oqimda kelmagan yopiq qarz — normal
    const bOchiq = b.status !== "fully_paid";
    if (dbOchiq && !bOchiq) dbOchiqBillzYopgan.push({ amount: r.amount, dbPaid: r.paid_amount, bzPaid: b.paid });
    else if (dbOchiq && bOchiq && Math.abs(Number(r.paid_amount) - b.paid) > 0.0001)
      paidFarq.push({ amount: r.amount, dbPaid: r.paid_amount, bzPaid: b.paid });
  }
  for (const [id, b] of billz) if (b.status !== "fully_paid" && !dbBy.has(id)) billzOchiqDbYoq.push(b);
  const dbOchiq = rows.filter((r) => !r.closed_at);
  const bzOchiq = [...billz.values()].filter((b) => b.status !== "fully_paid");
  console.log(`Ochiq qarz — Billz ${bzOchiq.length} ta / ${sum(bzOchiq, (b) => b.amount - b.paid)} $ · NSPOS ${dbOchiq.length} ta / ${sum(dbOchiq, (d) => Number(d.amount) - Number(d.paid_amount))} $`);
  natija(dbOchiqBillzYopgan.length, `NSPOS ochiq, Billz yopgan: ${dbOchiqBillzYopgan.length} (${sum(dbOchiqBillzYopgan, (x) => Number(x.amount) - Number(x.dbPaid))} $)`);
  natija(paidFarq.length, `to'langan summa farq qiladi: ${paidFarq.length} (Billz ko'proq: ${sum(paidFarq, (x) => x.bzPaid - Number(x.dbPaid))} $)`);
  natija(billzOchiqDbYoq.length, `Billz ochiq, bazada yo'q: ${billzOchiqDbYoq.length} (${sum(billzOchiqDbYoq, (b) => b.amount - b.paid)} $)`);
  natija(yorliq.length, `Billz qarzi 'billz' yorlig'isiz: ${yorliq.length}`);
  if (qarzRejim === "hammasi") {
    const dbOchiqBillzYoq = dbOchiq.filter((r) => !billz.has(r.billz_id));
    natija(dbOchiqBillzYoq.length, `NSPOS ochiq, Billz'da umuman yo'q: ${dbOchiqBillzYoq.length}`);
  }
}

// ── 3. CHEKLAR ───────────────────────────────────────────────
if (only.includes("chek")) {
  sarlavha(`Cheklar — oxirgi ${kun} kun (id bo'yicha)`);
  const from = new Date(Date.now() - kun * 864e5);
  const dbIds = new Set((await readAll("sales", "billz_id",
    (q) => q.not("billz_id", "is", null).gte("sold_at", new Date(Date.now() - (kun + 2) * 864e5).toISOString())))
    .map((s) => s.billz_id));
  let n = 0, del = 0; const yoq = [];
  for await (const o of api.orderPages({ from, to: new Date() })) {
    n++;
    if (isDeleted(o)) { del++; continue; }
    if (!dbIds.has(o.id)) yoq.push({ no: o.order_number, total: o.order_detail?.total_price, sana: String(o.sold_at ?? o.created_at ?? "").slice(0, 10) });
  }
  console.log(`Billz ${n} chek (o'chirilgan ${del}) · bazada oxirgi ${kun + 2} kun: ${dbIds.size}`);
  natija(yoq.length, `Billz'da bor, bazada yo'q: ${yoq.length} (${sum(yoq, (x) => Math.abs(Number(x.total || 0)))} $)`);
  for (const y of yoq.slice(0, 10)) console.log(`   ${y.sana} №${y.no} — ${y.total}`);
}

console.log(farqBor ? "\n❌ Farq bor — sinxronni to'liq yurgizing (Sozlamalar → to'liq tortish yoki `npm run billz -- --full`)." : "\n✓ Ko'zgu Billz bilan mos.");
process.exit(farqBor ? 1 : 0);
