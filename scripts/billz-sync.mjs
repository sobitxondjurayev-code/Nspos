// ══════════════════════════════════════════════════════════════
// BILLZ'DAN TORTIB OLISH — BIR MARTALIK / QO'LDA
// ══════════════════════════════════════════════════════════════
// Serverdagi yo'l (`/api/billz/sync`) Vercel'ning 300 soniyalik
// cheklovi ostida ishlaydi va har safar kichik bo'lak oladi. Butun
// tarixni tortish uchun esa u yaramaydi: 7 779 chekning har biriga
// alohida so'rov kerak va Billz sekundiga 2 so'rovga ruxsat beradi —
// bu ~72 daqiqa. Shuning uchun to'liq tortish shu skript orqali,
// kompyuterda, cheklovsiz bajariladi.
//
// Ishlatish:
//   node scripts/billz-sync.mjs --probe
//   node scripts/billz-sync.mjs --link --dry
//   node scripts/billz-sync.mjs --link
//   node scripts/billz-sync.mjs --only=categories,suppliers,products
//   node scripts/billz-sync.mjs --only=customers --full
//   node scripts/billz-sync.mjs --only=orders --from=2026-01-01 --to=2026-08-19
//
// Bayroqlar:
//   --probe   qaysi Billz metodi ochiq, qaysisi huquq kutyapti
//   --link    tovar/mijozni billz_id ga bog'lash (shtrix-kod/telefon)
//   --link-sales  eski Excel cheklarini Billz chekiga bog'lash (raqam+tur+summa)
//   --dry     hech narsa yozilmaydi, faqat hisobot
//   --full    kursorni e'tiborga olmay to'liq tortish
//   --max=N   nechta chek olinsin (sinov uchun)
//   --debts=light  qarzning faqat yopilmaganini tortish (tez)
//
// Kalit `.env.local` dan o'qiladi va HECH QACHON jurnalga chiqarilmaydi.
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
  if (m && m[2]) process.env[m[1]] ??= m[2];
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY kerak (.env.local)");
  process.exit(1);
}
if (!process.env.BILLZ_SECRET_TOKEN) {
  console.error("BILLZ_SECRET_TOKEN kerak (.env.local)");
  process.exit(1);
}

// —— Bayroqlar ————————————————————————————————
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const val = (name, dflt = null) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};

const opts = {
  only: val("only") ? val("only").split(",").map((s) => s.trim()).filter(Boolean) : null,
  full: flag("full"),
  dry: flag("dry"),
  link: flag("link"),
  linkSales: flag("link-sales"),
  debtsMode: val("debts", "full"),   // full | light
  from: val("from"),
  to: val("to"),
  maxOrders: val("max") ? Number(val("max")) : Infinity,
};

const db = createClient(url, key, { auth: { persistSession: false } });
const t0 = Date.now();
const log = (msg) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s] ${msg}`);

// —— Tashxis ————————————————————————————————
if (flag("probe")) {
  const { probe } = await import("../lib/billzApi.js");
  const r = await probe();
  console.table(r);
  const orders = r.orders;
  if (orders?.empty || orders?.forbidden) {
    console.log("\n⚠️  Sotuvlar bo'sh yoki yopiq.");
    console.log("   BILLZ UI → Sozlamalar → Integratsiya kalitlari → kalitga Rol biriktiring,");
    console.log("   o'sha rolda Продажи / Заказы / Отчёты bo'limlariga o'qish huquqini bering.");
  }
  process.exit(0);
}

// —— Ishga tushirish ————————————————————————————
const { runSync } = await import("../lib/billzSync.js");

log(`boshlandi${opts.dry ? " (DRY — yozilmaydi)" : ""}`);
if (opts.only) log(`bosqichlar: ${opts.only.join(", ")}`);

let out;
try {
  out = await runSync(db, { ...opts, log });
} catch (e) {
  console.error("\nXATO:", e.message);
  process.exit(1);
}

// —— Hisobot ————————————————————————————————
console.log("\n══ NATIJA ══");
console.log("kompaniya:", out.company);
for (const [stage, r] of Object.entries(out.stages)) {
  if (r.error) { console.log(`  ${stage.padEnd(12)} XATO: ${r.error}`); continue; }
  const parts = [];
  if (r.fetched != null) parts.push(`olindi ${r.fetched}`);
  if (r.inserted) parts.push(`yozildi ${r.inserted}`);
  if (r.updated) parts.push(`bog'landi ${r.updated}`);
  if (r.stock) parts.push(`qoldiq ${r.stock}`);
  if (r.items) parts.push(`chek qatori ${r.items}`);
  if (r.skipped) parts.push(`o'tkazildi ${r.skipped}`);
  if (r.products != null) parts.push(`tovar ${r.products}`);
  if (r.customers != null) parts.push(`mijoz ${r.customers}`);
  if (r.checked != null) parts.push(`ko'rildi ${r.checked}`);
  if (r.linked != null) parts.push(`bog'landi ${r.linked}`);
  if (r.notFound) parts.push(`topilmadi ${r.notFound}`);
  if (r.ambiguous) parts.push(`noaniq ${r.ambiguous}`);
  console.log(`  ${stage.padEnd(12)} ${parts.join(" · ")}`);

  if (r.conflicts?.length) {
    console.log(`      ⚠️  shtrix-kod to'qnashuvi: ${r.conflicts.length} ta`);
    for (const c of r.conflicts.slice(0, 5)) console.log(`         ${c.barcode} — ${c.name}`);
  }
  if (r.unknownPayments && Object.keys(r.unknownPayments).length) {
    console.log("      ⚠️  tanilmagan to'lov turlari:", JSON.stringify(r.unknownPayments));
    console.log("         lib/billzMap.js → PAYMENT_KINDS ga qo'shing");
  }
  if (r.noStore) console.log(`      ⚠️  do'koni topilmagan chek: ${r.noStore}`);
  if (r.missingProducts?.length) console.log(`      ⚠️  tovari topilmagan qator: ${r.missingProducts.length}`);
  if (r.exhausted === false) console.log("      ↻ hammasi olinmadi — qaytadan ishga tushiring");
  if (r.stopped) console.log("      ↺ eski yozuvlarga yetdi, to'xtatildi (kursor)");
}

if (out.warnings.length) {
  console.log("\n⚠️  Ogohlantirishlar:");
  for (const w of out.warnings) console.log("  ·", w);
}

// —— Baza holati ————————————————————————————
const counts = {};
for (const t of ["products", "stock", "customers", "sales", "sale_items", "categories", "suppliers"]) {
  const { count } = await db.from(t).select("*", { count: "exact", head: true });
  counts[t] = count;
}
console.log("\n══ BAZA ══");
console.table(counts);
process.exit(0);
