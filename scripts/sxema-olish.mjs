// ══════════════════════════════════════════════════════════════
// SXEMANI BAZADAN OLIB CHIQISH — VPS'da noldan qurish uchun
// ══════════════════════════════════════════════════════════════
// Nega `supabase db dump` emas:
//
//   1. U Docker talab qiladi (mahalliy Postgres bilan mos versiya
//      uchun), ya'ni har kompyuterda ishlamaydi.
//   2. Muhimrog'i — uning natijasi ODDIY Postgres'ga TUSHMAYDI.
//      Supabase dumpida `auth`, `storage`, `realtime`, `graphql`
//      sxemalari, `supabase_admin`/`authenticator` rollari va
//      `supabase_vault` kengaytmasi bor. VPS'dagi toza Postgres'da
//      bularning hech biri yo'q va tiklash birinchi qatordayoq
//      to'xtaydi.
//
// Shuning uchun sxema bazaning O'ZIDAN, tozalab olinadi: faqat
// `public`, faqat bizniki. Natija — VPS'da bir buyruq bilan
// yuriladigan bitta fayl.
//
// Ishlatish:
//   node scripts/sxema-olish.mjs            → scripts/sql/vps/01-sxema.sql
//
// DIQQAT: bu skript HECH NARSA yozmaydi va o'zgartirmaydi — faqat
// o'qiydi. Bazaga tegmaydi.
import { writeFileSync } from "fs";
import { sql } from "./lib/yuk.mjs";

const CHIQISH = "scripts/sql/vps/01-sxema.sql";

// Kengaytmalar: Supabase'ga xoslari olinmaydi.
//   supabase_vault  — Supabase sirlar ombori, VPS'da kerak emas
//   plpgsql         — Postgres'da o'zi bor
const KENGAYTMA_KERAKMAS = new Set(["supabase_vault", "plpgsql"]);

const q = (s) => s.replace(/"/g, '""');
const bosh = (nom) => `\n-- ${"═".repeat(62)}\n-- ${nom}\n-- ${"═".repeat(62)}\n`;

const b = [];   // yig'iladigan qatorlar

// —— 0. Sarlavha ————————————————————————————————————
b.push(`-- NSPOS — BAZA SXEMASI (avtomatik olingan)
-- Manba: Supabase, public sxemasi. Qayta yaratish:
--   node scripts/sxema-olish.mjs
-- QO'LDA TAHRIRLAMANG — o'zgarish bazada qilinadi, keyin qayta olinadi.
--
-- Ishlatish (VPS'da):
--   psql -d nspos -f scripts/sql/vps/00-shim.sql
--   psql -d nspos -f scripts/sql/vps/01-sxema.sql
--
-- 00-shim.sql BIRINCHI yuriladi: u \`auth.uid()\` va \`auth.role()\`
-- o'rnini bosadi. Busiz RLS siyosatlari yaratilmaydi.

-- Funksiya jadvalga, jadval funksiyaga murojaat qilishi mumkin —
-- tartibdan qat'i nazar ishlashi uchun tana tekshiruvi o'chiriladi.
set check_function_bodies = off;
`);

// —— 1. Kengaytmalar ————————————————————————————————
{
  const rows = await sql(`select extname from pg_extension order by 1;`);
  b.push(bosh("KENGAYTMALAR"));
  for (const r of rows) {
    if (KENGAYTMA_KERAKMAS.has(r.extname)) {
      b.push(`-- ${r.extname} — Supabase'ga xos, VPS'da kerak emas`);
      continue;
    }
    b.push(`create extension if not exists "${q(r.extname)}";`);
  }
}

// —— 1-B. Maxsus turlar (enum) ————————————————————————
// Ustunlar bularga tayanadi, shuning uchun jadvallardan OLDIN.
// Birinchi sinovda aynan shu tushib qolgan edi: 01-sxema.sql
// 109-qatorda "type user_role does not exist" bo'lib to'xtadi.
{
  const rows = await sql(`
    select t.typname,
           string_agg(quote_literal(e.enumlabel), ', ' order by e.enumsortorder) as qiymatlar
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    join pg_enum e on e.enumtypid = t.oid
    where n.nspname = 'public'
    group by t.typname
    order by t.typname;`);
  b.push(bosh(`MAXSUS TURLAR (${rows.length} ta)`));
  for (const r of rows) {
    // `create type` da `if not exists` yo'q — shuning uchun shart bilan
    b.push(`do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                  where n.nspname = 'public' and t.typname = '${q(r.typname)}') then
    create type "${q(r.typname)}" as enum (${r.qiymatlar});
  end if;
end $$;`);
  }
}

// —— 1-C. Ketma-ketliklar (sequence) ————————————————
// `bigserial` ustunlar `nextval('...')` ga tayanadi. Ketma-ketlik
// jadvaldan OLDIN bo'lishi kerak — ikkinchi sinovda aynan shu
// tushib qolgan edi ("relation audit_log_id_seq does not exist").
//
// Egalik (`owned by`) esa jadvaldan KEYIN qo'yiladi — pastda.
let ketmaKet = [];
{
  ketmaKet = await sql(`
    select s.sequencename as nom, s.data_type as turi,
           s.start_value, s.increment_by, s.min_value, s.max_value, s.cache_size,
           t.relname as ega_jadval, a.attname as ega_ustun
    from pg_sequences s
    left join pg_class sc on sc.relname = s.sequencename
    left join pg_depend d on d.objid = sc.oid and d.deptype = 'a'
    left join pg_class t on t.oid = d.refobjid
    left join pg_attribute a on a.attrelid = t.oid and a.attnum = d.refobjsubid
    where s.schemaname = 'public'
    order by s.sequencename;`);
  b.push(bosh(`KETMA-KETLIKLAR (${ketmaKet.length} ta)`));
  for (const r of ketmaKet) {
    b.push(`create sequence if not exists "${q(r.nom)}" as ${r.turi}`
      + ` increment by ${r.increment_by} minvalue ${r.min_value}`
      + ` maxvalue ${r.max_value} start with ${r.start_value} cache ${r.cache_size};`);
  }
}

// —— 2. Funksiyalar ————————————————————————————————
// Kengaytma bilan kelganlari (pg_trgm ~30 ta funksiya qo'shadi)
// TASHLANADI — ular `create extension` bilan o'zi keladi.
{
  const rows = await sql(`
    select p.proname, pg_get_functiondef(p.oid) as tarif
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f', 'p')
      and not exists (select 1 from pg_depend d
                       where d.objid = p.oid and d.deptype = 'e')
    order by p.proname;`);
  b.push(bosh(`FUNKSIYALAR (${rows.length} ta)`));
  for (const r of rows) b.push(`${r.tarif};\n`);
}

// —— 3. Jadvallar ————————————————————————————————————
{
  const cols = await sql(`
    select c.relname as jadval, a.attname as ustun,
           format_type(a.atttypid, a.atttypmod) as turi,
           a.attnotnull as majburiy,
           pg_get_expr(ad.adbin, ad.adrelid) as standart,
           a.attnum
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    left join pg_attrdef ad on ad.adrelid = c.oid and ad.adnum = a.attnum
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname, a.attnum;`);

  const izoh = await sql(`
    select c.relname as jadval, d.description as matn
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_description d on d.objoid = c.oid and d.objsubid = 0
    where n.nspname = 'public' and c.relkind = 'r' and d.description is not null;`);
  const izohBy = new Map(izoh.map((r) => [r.jadval, r.matn]));

  const byTable = new Map();
  for (const c of cols) {
    if (!byTable.has(c.jadval)) byTable.set(c.jadval, []);
    byTable.get(c.jadval).push(c);
  }

  b.push(bosh(`JADVALLAR (${byTable.size} ta)`));
  for (const [jadval, list] of [...byTable].sort()) {
    if (izohBy.has(jadval)) b.push(`-- ${izohBy.get(jadval)}`);
    const qatorlar = list.map((c) => {
      let s = `  "${q(c.ustun)}" ${c.turi}`;
      if (c.standart) s += ` default ${c.standart}`;
      if (c.majburiy) s += " not null";
      return s;
    });
    b.push(`create table if not exists "${q(jadval)}" (\n${qatorlar.join(",\n")}\n);\n`);
  }
}

// —— 3-B. Ketma-ketlik egaligi ————————————————————————
// Jadval o'chirilsa ketma-ketligi ham ketsin (bog'lanmagan
// ketma-ketlik bazada chiqindi bo'lib qoladi).
{
  const bor = ketmaKet.filter((r) => r.ega_jadval && r.ega_ustun);
  if (bor.length) {
    b.push(bosh(`KETMA-KETLIK EGALIGI (${bor.length} ta)`));
    for (const r of bor) {
      b.push(`alter sequence "${q(r.nom)}" owned by "${q(r.ega_jadval)}"."${q(r.ega_ustun)}";`);
    }
  }
}

// —— 4. Cheklovlar ————————————————————————————————
// Tartib muhim: avval PK/unique (ularga FK tayanadi), keyin check,
// oxirida FK.
{
  const rows = await sql(`
    select c.conname, c.contype,
           t.relname as jadval,
           pg_get_constraintdef(c.oid) as tarif
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and c.contype in ('p','u','c','f')
    order by case c.contype when 'p' then 1 when 'u' then 2
                            when 'c' then 3 else 4 end,
             t.relname, c.conname;`);
  b.push(bosh(`CHEKLOVLAR (${rows.length} ta)`));
  const nom = { p: "birlamchi kalit", u: "noyob", c: "tekshiruv", f: "tashqi kalit" };
  let oxirgi = null;
  for (const r of rows) {
    if (r.contype !== oxirgi) { b.push(`\n-- —— ${nom[r.contype]} ——`); oxirgi = r.contype; }
    // Qayta yurgizilsa xato bermasin
    b.push(`alter table "${q(r.jadval)}" drop constraint if exists "${q(r.conname)}";`);
    b.push(`alter table "${q(r.jadval)}" add constraint "${q(r.conname)}" ${r.tarif};`);
  }
}

// —— 5. Indekslar ————————————————————————————————
// Cheklov ortidagi indekslar (PK, unique) tashlanadi — ular
// yuqorida `add constraint` bilan o'zi yaratiladi.
{
  const rows = await sql(`
    select i.indexname, i.indexdef
    from pg_indexes i
    where i.schemaname = 'public'
      and not exists (
        select 1 from pg_constraint c
        join pg_class ic on ic.oid = c.conindid
        where ic.relname = i.indexname)
    order by i.indexname;`);
  b.push(bosh(`INDEKSLAR (${rows.length} ta)`));
  for (const r of rows) b.push(`${r.indexdef};`);
}

// —— 6. Ko'rinishlar ————————————————————————————————
{
  const rows = await sql(`
    select c.relname as nom,
           pg_get_viewdef(c.oid, true) as tarif,
           coalesce(array_to_string(c.reloptions, ', '), '') as sozlama
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
    order by c.relname;`);
  b.push(bosh(`KO'RINISHLAR (${rows.length} ta)`));
  for (const r of rows) {
    const opt = r.sozlama ? ` with (${r.sozlama})` : "";
    b.push(`create or replace view "${q(r.nom)}"${opt} as\n${r.tarif}\n`);
  }
}

// —— 7. Tetiklar ————————————————————————————————————
{
  const rows = await sql(`
    select tg.tgname, t.relname as jadval, pg_get_triggerdef(tg.oid) as tarif
    from pg_trigger tg
    join pg_class t on t.oid = tg.tgrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and not tg.tgisinternal
    order by t.relname, tg.tgname;`);
  b.push(bosh(`TETIKLAR (${rows.length} ta)`));
  for (const r of rows) {
    b.push(`drop trigger if exists "${q(r.tgname)}" on "${q(r.jadval)}";`);
    b.push(`${r.tarif};`);
  }
}

// —— 8. RLS ————————————————————————————————————————
{
  const yoq = await sql(`
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
    order by 1;`);
  const pol = await sql(`
    select tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies where schemaname = 'public'
    order by tablename, policyname;`);

  b.push(bosh(`RLS — QATOR DARAJASIDAGI HIMOYA (${yoq.length} jadval, ${pol.length} siyosat)`));
  b.push(`-- Siyosatlar \`auth.uid()\` / \`auth.role()\` ga murojaat qiladi.
-- VPS'da ular 00-shim.sql dagi funksiyalar bo'ladi — ya'ni siyosatlar
-- BIR HARF ham o'zgarmaydi. Himoya mantiqini qayta yozish eng katta
-- xavf edi (56 ta siyosat), shu yo'l bilan chetlab o'tildi.\n`);

  for (const r of yoq) b.push(`alter table "${q(r.relname)}" enable row level security;`);
  b.push("");

  for (const p of pol) {
    const roles = (p.roles || "{public}").replace(/[{}]/g, "");
    const parts = [`create policy "${q(p.policyname)}" on "${q(p.tablename)}"`];
    if (p.permissive === "RESTRICTIVE") parts.push("  as restrictive");
    parts.push(`  for ${p.cmd.toLowerCase()}`);
    parts.push(`  to ${roles}`);
    if (p.qual) parts.push(`  using (${p.qual})`);
    if (p.with_check) parts.push(`  with check (${p.with_check})`);
    b.push(`drop policy if exists "${q(p.policyname)}" on "${q(p.tablename)}";`);
    b.push(parts.join("\n") + ";\n");
  }
}

b.push(`\n-- —— Tugadi ——`);
writeFileSync(CHIQISH, b.join("\n") + "\n", "utf8");
console.log(`${CHIQISH} yozildi — ${b.join("\n").split("\n").length} qator`);
