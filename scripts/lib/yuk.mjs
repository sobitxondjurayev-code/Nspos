// ══════════════════════════════════════════════════════════════
// ILOVANI NODE'DA HAQIQIY BAZA BILAN TO'LDIRISH
// ══════════════════════════════════════════════════════════════
// Ilovaning modullari (lib/*.js) brauzerda bazadan bir marta o'qib
// xotirada ishlaydi. Shu fayl xuddi shu ishni Node'da qiladi:
// har modul o'zi qayd etgan jadvalni SQL orqali oladi va o'z
// `restore()` funksiyasiga beradi.
//
// Nega SQL orqali (anon kalit bilan emas): RLS anon foydalanuvchiga
// hech narsa ko'rsatmaydi, ya'ni tekshiruv bo'sh ma'lumot ustida
// "hammasi joyida" deb turaverardi.
//
// Yozish xavfi yo'q: NEXT_PUBLIC_* o'zgaruvchilari berilmagani uchun
// ilova DEMO rejimda ishlaydi va insert/update/delete umuman bazaga
// bormaydi.
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

for (const line of readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
  if (m) process.env[m[1]] ??= m[2];
}

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").match(/https:\/\/([a-z0-9]+)\.supabase/)?.[1];
if (!token || !ref) {
  console.error("SUPABASE_ACCESS_TOKEN yoki loyiha ref'i topilmadi (.env.local).");
  process.exit(1);
}

// —— Yozishni butunlay o'chiramiz ————————————————————
// Ilova moduli ba'zan o'qigan zahoti bazaga qaytib yozadi (masalan KPI
// turi qo'yilmagan xodimga standart tur beriladi). Tekshiruv HECH
// NARSANI o'zgartirmasligi kerak: NEXT_PUBLIC_* o'chirilsa `lib/db.js`
// DEMO rejimga o'tadi va insert/update/delete umuman jo'natilmaydi.
// SQL orqali o'qish esa boshqa kalit (SUPABASE_ACCESS_TOKEN) bilan
// ketadi — u shu faylda qoladi.
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Bitta so'rov uzilib qolsa, o'sha jadval BO'SH bo'lib qoladi va
// tekshiruv "hamma hamyon minusda" degan soxta xato chiqaradi. Shuning
// uchun avval qayta urinamiz, keyin ham bo'lmasa — xato yuqoriga
// chiqadi va tekshiruv butunlay to'xtaydi (pastdagi loadApp).
export async function sql(query, urinish = 3) {
  let oxirgi;
  for (let i = 0; i < urinish; i++) {
    try {
      const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text.slice(0, 300));
      return JSON.parse(text);
    } catch (e) {
      oxirgi = e;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw oxirgi;
}

// Modul QAYSI USTUNLARNI so'rasa, tekshiruv ham aynan o'shani oladi.
// `select *` qilib qo'ysak tekshiruv brauzerdan KO'PROQ ma'lumot
// ko'rardi va ustun tushib qolgan xatoni sezmasdi — 2026-08-14 da
// `companies` ro'yxatida `ledger_start` yo'q edi, ya'ni ilova hisob
// boshini bazadan emas, joriy oy boshidan olardi.
// Ichma-ich so'rov ("*, sale_items(*)") SQL da ifodalanmaydi — unda
// hammasi olinadi.
const cols = (select) => (!select || select.includes("(") ? "*" : select);

// —— Modullarni to'ldirish ————————————————————————
// Ilovadagi har modul import qilinishi bilan o'zini `registerModule`
// ga yozadi. Shuning uchun avval hammasini import qilamiz.
export async function loadApp() {
  const { listModules } = await import("../../lib/db.js");

  await Promise.all([
    "companyData", "storesData", "staffData", "kpiData", "expensesData",
    "kassaData", "payoutsData", "payrollData", "datasets", "debtsData",
    "customersData", "salesData", "productsData", "servicesData",
    "warehouseData", "suppliersData", "financeData", "ratesData", "npsData",
  ].map((m) => import(`../../lib/${m}.js`)));

  const mods = listModules();
  const report = [];

  await Promise.all(mods.map(async (m) => {
    // datasets — alohida: qatorlari boshqa jadvalda (pastga qarang)
    if (m.table === "datasets") return;
    try {
      // `staff_directory` ko'rinishi kirgan foydalanuvchi bo'yicha
      // filtrlanadi (auth_company_id) — SQL orqali u BO'SH qaytadi.
      // Shuning uchun asosiy jadvaldan o'qiymiz: skript rahbar
      // ko'radigan to'liq ro'yxatni ko'rishi kerak.
      const table = m.readTable === "staff_directory" ? m.table : (m.readTable ?? m.table);
      const rows = await sql(`select ${cols(m.select)} from ${table}`);
      m.restore(rows.map((r) => (m.fromRow ? m.fromRow(r) : r)));
      report.push({ table: m.table, rows: rows.length });
    } catch (e) {
      report.push({ table: m.table, error: e.message.slice(0, 80) });
    }
  }));

  await loadDatasets(mods, report);

  // Bitta jadval ham kelmasa — TEKSHIRUV O'TKAZILMAYDI.
  // Sabab: yarim ma'lumot ustida hisoblansa, ekranda hech qanday
  // muammo yo'q bo'lsa ham "hamma hamyon minusda", "kirim 0" degan
  // SOXTA xatolar chiqadi. Bunday ogohlantirish eng yomoni: u
  // ishonarli ko'rinadi va odam haqiqiy pulni qidirib ketadi
  // (2026-08-14 da aynan shunday bo'ldi).
  const yiqilgan = report.filter((r) => r.error);
  if (yiqilgan.length) {
    const e = new Error(
      "Baza to'liq o'qilmadi, tekshiruv bekor qilindi:\n" +
      yiqilgan.map((r) => `   ${r.table}: ${r.error}`).join("\n"));
    e.yuklanmadi = yiqilgan;
    throw e;
  }
  return report;
}

// Yuklamalar: ro'yxat `datasets` da, qatorlar `dataset_chunks` da.
// Brauzerda ular kerak bo'lgandagina tortiladi (useUploadRows), bu
// yerda esa hammasi birdan olinadi — tekshiruv to'liq bo'lsin.
async function loadDatasets(mods, report) {
  const m = mods.find((x) => x.table === "datasets");
  if (!m) return;
  try {
    const list = await sql("select * from datasets order by created_at desc");
    const chunks = await sql("select dataset_id, seq, rows from dataset_chunks order by dataset_id, seq");
    const byId = new Map();
    for (const c of chunks) byId.set(c.dataset_id, [...(byId.get(c.dataset_id) ?? []), ...c.rows]);
    m.restore(list.map((r) => ({ ...m.fromRow(r), rows: byId.get(r.id) ?? null })));
    report.push({ table: "datasets", rows: list.length, qator: chunks.reduce((s, c) => s + c.rows.length, 0) });
  } catch (e) {
    report.push({ table: "datasets", error: e.message.slice(0, 80) });
  }
}

