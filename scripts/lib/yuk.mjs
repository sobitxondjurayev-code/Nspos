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
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import { bazaTekshir } from "./baza.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Sozlama fayli: kompyuterda `.env.local`, serverda `.env.production`.
// Bo'lmasa ham to'xtamaydi — o'zgaruvchilar tashqaridan berilgan
// bo'lishi mumkin (masalan systemd `EnvironmentFile` orqali).
for (const nom of [".env.local", ".env.production"]) {
  let matn;
  try { matn = readFileSync(path.join(root, nom), "utf8"); } catch { continue; }
  for (const line of matn.split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m) process.env[m[1]] ??= m[2];
  }
}

const token = process.env.SUPABASE_ACCESS_TOKEN;

// ── QAYSI BAZA O'QILADI ──
// Odatda `.env.local` dagi manzil. Lekin eski Supabase'ni ATAYLAB
// o'qish kerak bo'lgan bitta hol bor — yopishdan oldingi solishtirish
// (`scripts/solishtir.mjs`). O'shanda manzil BUYRUQDA beriladi:
//
//   NSPOS_MANBA_URL=https://vysygcnsjqedwqaymxsd.supabase.co \
//     node scripts/solishtir.mjs --target "postgres://…/nspos"
//
// Nega sozlama faylida emas: `.env.local` ga qo'yilsa u YANA jimgina
// hamma skriptga tarqaladi va biz endigina chiqqan tuzoqqa qaytamiz
// (DAFTAR 11.2). Buyruqda turgani esa bir martalik va ko'rinib turadi.
const manbaUrl = process.env.NSPOS_MANBA_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ataylab = !!process.env.NSPOS_MANBA_URL || process.argv.includes("--boshqa-baza");
const ref = manbaUrl.match(/https:\/\/([a-z0-9]+)\.supabase/)?.[1];


// Ikkinchi yo'l: Supabase CLI. Management API kaliti shaxsiy va uni
// har kompyuterga qo'yish shart emas — `supabase login` qilingan
// bo'lsa CLI o'sha kalitni o'zi biladi. Tekshiruv saytga chiqarishdan
// oldin MAJBURIY (CLAUDE.md, 2026-08-13), shuning uchun u kalit
// yo'qligi sababli o'tkazib yuborilmasligi kerak.
//   supabase link --project-ref <ref>
const cliReady = !token && (() => {
  try { execFileSync("supabase", ["--version"], { stdio: "ignore" }); return true; }
  catch { return false; }
})();

// Uchinchi yo'l: to'g'ridan-to'g'ri Postgres. `NSPOS_PG` berilsa
// hammasidan ustun turadi.
//
// Nega kerak: `loadApp()` yigirmadan ortiq so'rovni BAROBAR yuboradi va
// Supabase Management API limitiga uriladi — tekshiruv "Baza to'liq
// o'qilmadi" deb to'xtaydi (2026-08-21 da shunday bo'ldi). Mahalliy
// nusxada esa limit yo'q va javob bir necha barobar tez.
//
// Ikkinchi sabab: VPS'ga ko'chgach baza aynan shu yo'l bilan o'qiladi —
// ya'ni bu vaqtinchalik chora emas, kelajakdagi asosiy yo'l.
//
//   NSPOS_PG="postgres://localhost/nspos_sinov" npm run tekshir
const pgUrl = process.env.NSPOS_PG;

// ── ESKI SUPABASE'GA TASODIFAN BORISH ──
// Aynan shu xato tekshiruvni besh kun muzlab qolgan nusxa ustida
// yurgizgan edi. Ataylab aytilmagan bo'lsa — to'xtaymiz.
//
// `pgUrl` DAN KEYIN turishi shart: mahalliy nusxa bilan ishlaganda
// (`NSPOS_PG=... npm run tekshir`) `.env.local` dagi manzil umuman
// o'qilmaydi, ya'ni u eski bo'lsa ham zarari yo'q. To'siq yuqorida
// tursa o'sha holatni ham bekorga to'sib qo'yardi.
if (!pgUrl && ref && !ataylab) {
  bazaTekshir(manbaUrl, { nima: "tekshiruv" });   // ichida process.exit(1)
}

// ══════════════════════════════════════════════════════════════
// QAYSI BAZA O'QILGANI DOIM AYTILADI
// ══════════════════════════════════════════════════════════════
// 2026-08-23 da aniqlandi: VPS'ga ko'chgandan keyin ham `.env.local`
// da eski Supabase manzili turgan edi va `npm run tekshir` kompyuterda
// ESKI, muzlab qolgan nusxani o'qirdi. Ikki baza butunlay boshqa
// raqam berardi:
//
//   eski Supabase → kirim 93 460.03 · kassada 58 277.43 · 332 s
//   VPS (haqiqiy) → kirim 82 308.87 · kassada 47 344.28 ·  5.5 s
//
// Ya'ni saytga chiqarishdan oldingi MAJBURIY tekshiruv bir necha kun
// davomida noto'g'ri baza ustida "hammasi joyida" deb turgan. Xato
// ko'rinmadi, chunki hech qayerda "men qaysi bazani o'qidim" deb
// yozilmagan edi.
//
// Endi manba HAR SAFAR bosh qatorda ko'rinadi. Parol chiqmaydi —
// faqat qayerdaligi.
export const manbaNomi = () => {
  if (pgUrl) {
    const host = pgUrl.replace(/^postgres(ql)?:\/\//, "").split("@").pop().split("?")[0];
    return `Postgres: ${host || "mahalliy soket"}`;
  }
  if (ref) return `Supabase: ${ref}`;
  return "noma'lum";
};

if (!pgUrl && (!ref || (!token && !cliReady))) {
  // Ilgari bu matn Supabase'ga ko'rsatardi. Supabase 2026-08-23 da
  // tark etilgan — ya'ni maslahatning o'zi eskirgan edi va odamni
  // yo'q tizimga yuborardi. Endi ikkita ishlaydigan yo'l aytiladi.
  console.error("");
  console.error("Bazaga yo'l topilmadi.");
  console.error("");
  console.error("  Baza endi VPS'da (tizim.enes.uz) va u tashqariga Postgres");
  console.error("  porti ochmaydi. Shuning uchun tekshiruv SERVERDA yuritiladi:");
  console.error("");
  console.error("      npm run tekshir:server");
  console.error("");
  console.error("  Kompyuterda yuritish kerak bo'lsa, mahalliy nusxa ko'rsatiladi:");
  console.error("");
  console.error("      NSPOS_PG=\"postgres://localhost/nspos_sinov\" npm run tekshir");
  console.error("");
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
  if (pgUrl) return sqlViaPsql(query);
  if (cliReady) return sqlViaCli(query);

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

// CLI javobi: { boundary, rows: [...], warning }. `maxBuffer` oshirilgan —
// `sales` 7 000 dan ortiq qator qaytaradi va standart 1 MB yetmaydi.
function sqlViaCli(query) {
  const out = execFileSync("supabase", ["db", "query", "--linked", query], {
    encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"],
  });
  const parsed = JSON.parse(out);
  if (parsed.error) throw new Error(JSON.stringify(parsed.error).slice(0, 300));
  return parsed.rows ?? [];
}

// To'g'ridan-to'g'ri Postgres. Har qanday SELECT `json_agg` ichiga
// o'raladi — natija CLI bilan bir xil ko'rinishda (obyektlar massivi)
// qaytadi, ya'ni chaqiruvchi tomonda hech narsa o'zgarmaydi.
function sqlViaPsql(query) {
  const ichki = query.trim().replace(/;\s*$/, "");
  const out = execFileSync("psql", [pgUrl, "-tAX", "-v", "ON_ERROR_STOP=1", "-c",
    `select coalesce(json_agg(t), '[]'::json) from (${ichki}) t;`],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  return JSON.parse(out);
}

// Modul QAYSI USTUNLARNI so'rasa, tekshiruv ham aynan o'shani oladi.
// `select *` qilib qo'ysak tekshiruv brauzerdan KO'PROQ ma'lumot
// ko'rardi va ustun tushib qolgan xatoni sezmasdi — 2026-08-14 da
// `companies` ro'yxatida `ledger_start` yo'q edi, ya'ni ilova hisob
// boshini bazadan emas, joriy oy boshidan olardi.
//
// Ichma-ich so'rov ("*, stock(store_id, qty)") — bu PostgREST'ning
// o'z yozuvi, SQL da bunday yozib bo'lmaydi. Shuning uchun bola
// jadval ALOHIDA olinadi va ota qatorga biriktiriladi. Busiz `stock`
// kelmasdi va tekshiruv omborni butunlay bo'sh deb ko'rardi
// (balansdagi "Ombordagi tovar" 0 chiqib, soxta xato berardi).
const parseSelect = (select) => {
  if (!select || select === "*") return { cols: "*", embeds: [] };
  const embeds = [...select.matchAll(/(\w+)\(([^)]*)\)/g)].map((m) => ({
    table: m[1], cols: m[2].split(",").map((c) => c.trim()).filter(Boolean),
  }));
  const own = select.replace(/,?\s*\w+\([^)]*\)/g, "").trim().replace(/,$/, "");
  return { cols: own || "*", embeds };
};

// Bola jadval ota jadvalga qaysi ustun orqali bog'langan — taxmin
// qilmaymiz, bazaning o'zidan so'raymiz.
// Tashqi kalit ustuni `pg_catalog` dan o'qiladi, `information_schema`
// dan EMAS.
//
// Nega (2026-08-22 da API'ni serverga qo'yganda aniqlandi):
// `information_schema.constraint_column_usage` faqat jadval EGASIGA
// ko'rinadi. Kompyuterda baza mening nomimda, shuning uchun hammasi
// ishlardi. Serverda esa API `nspos` roli bilan ulanadi va u ega
// emas — ko'rinish BO'SH qaytardi.
//
// Natijasi jimgina va og'ir edi: 9 032 chekning BIRORTASIDA tovar
// tarkibi yo'q, 10 837 qarzda birorta to'lov yo'q. Xato chiqmadi —
// API shunchaki boshqa raqam berdi: tushum 17 188 (aslida 76 723),
// ochiq qarz 62 728 (aslida 50 930).
//
// `pg_constraint` esa hamma uchun ko'rinadi.
async function fkColumn(child, parent) {
  const rows = await sql(`
    select a.attname as column_name
    from pg_constraint c
    join pg_class ch on ch.oid = c.conrelid
    join pg_class p on p.oid = c.confrelid
    join pg_namespace n on n.oid = ch.relnamespace
    join unnest(c.conkey) with ordinality as k(attnum, ord) on true
    join pg_attribute a on a.attrelid = ch.oid and a.attnum = k.attnum
    where c.contype = 'f' and n.nspname = 'public'
      and ch.relname = '${child}' and p.relname = '${parent}'
    order by k.ord
    limit 1`);
  return rows[0]?.column_name ?? null;
}

async function attachEmbeds(parent, rows, embeds) {
  for (const e of embeds) {
    const fk = await fkColumn(e.table, parent);
    if (!fk) { for (const r of rows) r[e.table] = []; continue; }
    const want = e.cols.includes("*") || !e.cols.length
      ? "*" : [...new Set([fk, ...e.cols])].join(", ");
    const kids = await sql(`select ${want} from ${e.table}`);
    const byParent = new Map();
    for (const k of kids) {
      const id = k[fk];
      if (!byParent.has(id)) byParent.set(id, []);
      byParent.get(id).push(k);
    }
    for (const r of rows) r[e.table] = byParent.get(r.id) ?? [];
  }
}

// —— Modullarni to'ldirish ————————————————————————
// Ilovadagi har modul import qilinishi bilan o'zini `registerModule`
// ga yozadi. Shuning uchun avval hammasini import qilamiz.
export async function loadApp() {
  const { listModules } = await import("../../lib/db.js");

  await Promise.all([
    "companyData", "storesData", "staffData", "kpiData", "expensesData",
    "kassaData", "payoutsData", "payrollData", "datasets", "debtsData",
    "customersData", "salesData", "productsData", "categoriesData", "servicesData",
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
      const { cols, embeds } = parseSelect(m.select);
      const rows = await sql(`select ${cols} from ${table}`);
      if (embeds.length) {
        await attachEmbeds(table, rows, embeds);
        // Ichma-ich jadval BO'SH chiqsa — bu deyarli har doim huquq
        // yoki bog'lanish muammosi, "haqiqatan bo'sh" emas. Jimgina
        // o'tkazib yuborilsa raqamlar noto'g'ri chiqadi va buni hech
        // narsa bildirmaydi (2026-08-22, `fkColumn` hodisasi).
        for (const e of embeds) {
          if (!rows.length) break;
          const bor = rows.some((r) => (r[e.table] ?? []).length);
          if (!bor) throw new Error(`${e.table}: ${rows.length} qatorning birortasida ham yo'q — huquq yoki bog'lanish muammosi`);
        }
      }
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

