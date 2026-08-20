// ══════════════════════════════════════════════════════════════
// MA'LUMOTNI KO'CHIRISH — Supabase → o'z Postgres'imiz
// ══════════════════════════════════════════════════════════════
// Ishlatish:
//   node scripts/kochirish.mjs --target "postgres://…/nspos"
//   node scripts/kochirish.mjs --target "…" --only=sales,sale_items
//   node scripts/kochirish.mjs --target "…" --tekshir     (faqat solishtirish)
//
// MANBAGA TEGILMAYDI. Skript Supabase'dan faqat O'QIYDI — eski baza
// o'z holicha qoladi va yangi tizim ishlaganiga ishonch hosil
// bo'lgunicha qaytish yo'li bo'lib turadi.
//
// —— Nega JSON orqali ——
// Ma'lumot manbadan JSON bo'lib keladi (Management API shunday
// beradi). Uni CSV ga aylantirib yozish mumkin edi, lekin har tur
// uchun alohida qoida kerak bo'lardi: jsonb ichidagi vergul, massiv
// yozuvi `{a,b}`, enum, sana formati, NULL va bo'sh satr farqi.
// Bittasida adashilsa ma'lumot JIMGINA buziladi.
//
// Shuning uchun boshqa yo'l: qator butun holicha jsonb bo'lib
// vaqtinchalik jadvalga tushadi, keyin `jsonb_populate_record` uni
// jadvalning O'Z turlariga o'giradi. Turlarni Postgres'ning o'zi
// biladi — biz taxmin qilmaymiz.
//
// —— Tetiklar ——
// Yuklash paytida `session_replication_role = replica` qo'yiladi:
// tashqi kalit tekshiruvi ham, `audit_log` tetigi ham o'chadi.
// Busiz: (1) jadval tartibi muhim bo'lardi, (2) 84 000 qator uchun
// 84 000 ta audit yozuvi paydo bo'lardi.
import { execFileSync } from "child_process";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { sql } from "./lib/yuk.mjs";
import { BACKUP_TABLES } from "../lib/backupTables.js";

const arg = (nom, standart = null) => {
  const p = process.argv.find((a) => a.startsWith(`--${nom}=`));
  if (p) return p.slice(nom.length + 3);
  const i = process.argv.indexOf(`--${nom}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1] : standart;
};
const bor = (nom) => process.argv.includes(`--${nom}`);

const TARGET = arg("target");
if (!TARGET) {
  console.error("--target kerak. Masalan:");
  console.error('  node scripts/kochirish.mjs --target "postgres://localhost/nspos"');
  process.exit(1);
}

// `auth.users` ro'yxatda YO'Q (u `public` da emas), lekin `profiles`
// unga tashqi kalit bilan bog'langan — ya'ni u BIRINCHI ko'chadi.
const AUTH_USTUN = "id, email, phone, encrypted_password, email_confirmed_at,"
                 + " last_sign_in_at, raw_user_meta_data, banned_until, deleted_at,"
                 + " created_at, updated_at";
const JADVALLAR = [{ nom: "auth.users", ustun: AUTH_USTUN }, ...BACKUP_TABLES.map((t) => ({ nom: t, ustun: "*" }))];

const faqat = arg("only");
const royxat = faqat
  ? JADVALLAR.filter((j) => faqat.split(",").includes(j.nom.replace("auth.", "")))
  : JADVALLAR;

const ISH = ".tmp/kochirish";
mkdirSync(ISH, { recursive: true });

const psql = (buyruq, kirish = null) => execFileSync("psql", [TARGET, "-v", "ON_ERROR_STOP=1",
  "--set=client_min_messages=warning", "-q", "-c", buyruq],
  { encoding: "utf8", input: kirish ?? undefined, maxBuffer: 256 * 1024 * 1024 });

const psqlFayl = (yol) => execFileSync("psql", [TARGET, "-v", "ON_ERROR_STOP=1",
  "--set=client_min_messages=warning", "-q", "-f", yol],
  { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

const son = (n) => Number(n).toLocaleString("ru-RU");

// ── Manbadan sahifalab o'qish ─────────────────────────────────
// Bir so'rovda hammasini so'rasak `sale_items` (34 489 qator) javobi
// juda katta bo'lib uziladi.
//
// Sahifalash TARTIBI muhim: `offset/limit` faqat tartib BARQAROR
// bo'lgandagina to'g'ri ishlaydi. Avval `order by 1` yozilgan edi —
// birinchi ustun noyob bo'lmasa (masalan `stock.product_id`, har
// tovar uch do'konda) Postgres teng qatorlarni har so'rovda boshqa
// tartibda berishi mumkin va sahifa chegarasida qator IKKI MARTA
// yoki UMUMAN kelmasligi mumkin. Shuning uchun tartib birlamchi
// kalit bo'yicha olinadi — u ta'rifi bo'yicha noyob.
const pkKesh = new Map();
async function pkUstunlari(jadval) {
  if (pkKesh.has(jadval)) return pkKesh.get(jadval);
  const [sxema, nom] = jadval.includes(".") ? jadval.split(".") : ["public", jadval];
  const rows = await sql(`
    select a.attname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    join pg_attribute a on a.attrelid = t.oid and a.attnum = any(c.conkey)
    where n.nspname = '${sxema}' and t.relname = '${nom}' and c.contype = 'p'
    order by array_position(c.conkey, a.attnum);`);
  const list = rows.map((r) => `"${r.attname}"`);
  pkKesh.set(jadval, list);
  return list;
}

async function oqi(jadval, ustun) {
  const QADAM = 5000;
  const pk = await pkUstunlari(jadval);

  // Birlamchi kaliti yo'q jadval — sahifalanmaydi. Bunday jadvallar
  // kichik (eng kattasi bir necha yuz qator), ya'ni bitta so'rov
  // yetadi. Sahifalash esa barqaror tartibsiz XAVFLI bo'lardi.
  if (!pk.length) return await sql(`select ${ustun} from ${jadval};`);

  const tartib = pk.join(", ");
  const out = [];
  for (let ofset = 0; ; ofset += QADAM) {
    const rows = await sql(
      `select ${ustun} from ${jadval} order by ${tartib} offset ${ofset} limit ${QADAM};`);
    out.push(...rows);
    if (rows.length < QADAM) return out;
  }
}

// ── Yuklash ───────────────────────────────────────────────────
// Matn formatida faqat ikki belgi maxsus: teskari chiziq va tab.
// JSON.stringify yangi qator va tabni o'zi qochiradi (\n, \t), ya'ni
// bizga faqat teskari chiziqni ikkilantirish qoladi.
function yukla(jadval, qatorlar) {
  if (!qatorlar.length) return 0;
  const fayl = `${ISH}/${jadval.replace(".", "_")}.txt`;
  writeFileSync(fayl, qatorlar.map((r) => JSON.stringify(r).replace(/\\/g, "\\\\")).join("\n") + "\n");

  const sqlFayl = `${ISH}/_yukla.sql`;
  writeFileSync(sqlFayl, `
begin;
  set local session_replication_role = replica;   -- FK va tetiklar o'chadi
  create temp table _yuk (data jsonb) on commit drop;
  \\copy _yuk (data) from '${process.cwd()}/${fayl}'
  insert into ${jadval}
    select (jsonb_populate_record(null::${jadval}, data)).* from _yuk
    on conflict do nothing;
commit;
`);
  psqlFayl(sqlFayl);
  return qatorlar.length;
}

// ══ 1. KO'CHIRISH ═════════════════════════════════════════════
const hisobot = [];
if (!bor("tekshir")) {
  console.log(`Ko'chirilmoqda → ${TARGET.replace(/:[^:@]*@/, ":***@")}\n`);
  for (const j of royxat) {
    process.stdout.write(`  ${j.nom.padEnd(24)}`);
    try {
      const rows = await oqi(j.nom, j.ustun);
      const n = yukla(j.nom, rows);
      console.log(`${son(n).padStart(8)} qator`);
      hisobot.push({ jadval: j.nom, olindi: rows.length });
    } catch (e) {
      console.log(`XATO: ${e.message.split("\n")[0].slice(0, 90)}`);
      hisobot.push({ jadval: j.nom, xato: e.message.slice(0, 200) });
    }
  }

  // Ketma-ketliklar: yuklashdan keyin sanog'i oxirgi qatorga
  // qo'yiladi. Busiz keyingi yangi yozuv 1-raqamdan boshlanib,
  // birlamchi kalit to'qnashardi.
  console.log("\n  ketma-ketliklar tekislanmoqda…");
  psql(`
    do $$
    declare r record; oxirgi bigint;
    begin
      for r in
        select s.sequencename as ket, t.relname as jadval, a.attname as ustun
        from pg_sequences s
        join pg_class sc on sc.relname = s.sequencename
        join pg_depend d on d.objid = sc.oid and d.deptype = 'a'
        join pg_class t on t.oid = d.refobjid
        join pg_attribute a on a.attrelid = t.oid and a.attnum = d.refobjsubid
        where s.schemaname = 'public'
      loop
        execute format('select coalesce(max(%I), 0) from public.%I', r.ustun, r.jadval) into oxirgi;
        perform setval(format('public.%I', r.ket), greatest(oxirgi, 1), oxirgi > 0);
      end loop;
    end $$;`);
}

// ══ 2. SOLISHTIRISH ═══════════════════════════════════════════
// Qator soni yetarli emas: qator o'tib, ichidagi raqam buzilishi
// mumkin. Shuning uchun PUL yig'indilari ham solishtiriladi.
const PUL = {
  sales: "total", sale_items: "total", expenses: "amount",
  debts: "amount", debt_payments: "amount", kassa_ops: "amount",
  payouts: "amount", payroll_payments: "amount", products: "sale_price",
  stock: "qty", customers: "balance",
};

console.log("\n══ SOLISHTIRISH ══");
console.log(`  ${"jadval".padEnd(22)} ${"manba".padStart(8)} ${"nusxa".padStart(8)}  ${"pul (manba)".padStart(14)} ${"pul (nusxa)".padStart(14)}`);

let xato = 0;
for (const j of royxat) {
  const pulUstun = PUL[j.nom];
  const pulIfoda = pulUstun ? `, coalesce(round(sum(${pulUstun})::numeric, 2), 0) as pul` : ", 0 as pul";

  const [m] = await sql(`select count(*) as soni ${pulIfoda} from ${j.nom};`);
  const n = JSON.parse(psql(
    `select json_build_object('soni', count(*), 'pul', coalesce(round(sum(${pulUstun ?? 0})::numeric,2),0)) from ${j.nom};`)
    .split("\n").filter((l) => l.trim().startsWith("{"))[0]);

  const teng = Number(m.soni) === Number(n.soni) && Math.abs(Number(m.pul) - Number(n.pul)) < 0.01;
  if (!teng) xato++;
  console.log(`  ${teng ? "✓" : "✗"} ${j.nom.padEnd(20)} ${son(m.soni).padStart(8)} ${son(n.soni).padStart(8)}`
    + `  ${Number(m.pul).toFixed(2).padStart(14)} ${Number(n.pul).toFixed(2).padStart(14)}`);
}

if (!bor("saqla")) rmSync(ISH, { recursive: true, force: true });

console.log(xato
  ? `\n❌ ${xato} ta jadvalda farq bor — ko'chirish TUGALLANMAGAN.`
  : `\n✓ Hammasi mos. Manba tegilmagan holicha qoldi.`);
process.exit(xato ? 1 : 0);
