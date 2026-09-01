// ══════════════════════════════════════════════════════════════
// LOGINLARNI ESKIDAN OLIB, HAMMAGA YANGI PAROL QO'YISH
// ══════════════════════════════════════════════════════════════
// Ishlatish:
//   node scripts/login-kochir.mjs            # --dry: SQL + ro'yxat yoziladi, VPS'ga TEGILMAYDI
//   node scripts/login-kochir.mjs --bajar    # VPS'ga qo'llaydi, har login bilan kirib tekshiradi
//
// NEGA (2026-09-02): VPS `auth.users` — 23.08 nusxasi. Undan keyin
// menejer ESKI saytda ustalarning haqiqiy raqamini kiritgan
// (`/api/staff` PATCH → `email_almashtir`). Ya'ni xodim biladigan
// login eski bazada, VPS'da esa o'rinbosar raqam (`9989010000NN`).
// Rahbar qarori: login eskisidan olinadi, parol HAMMAGA YANGI.
//
// Manba: eski Supabase — faqat `supabase db query --linked` (o'qish).
// Nishon: VPS — SSH + psql (`postgres` roli, `scripts/sql.mjs` kabi).
// `/api/staff` PATCH ISHLATILMAYDI: u telefonni o'zgartirganda
// `email_almashtir` ni ham chaqiradi va loginni buzadi.
//
// Unique tuzog'i: eski bazada ikkita hisob raqamini ALMASHGAN
// (ikki Akramjon). Bitta `update` ichida almashtirish `auth.users.email`
// unique indeksiga uriladi — shuning uchun avval hammasiga vaqtinchalik
// email, keyin haqiqiysi (bitta tranzaksiyada).
//
// Parol fayli `.tmp/loginlar-<sana>.json` — BIR MARTA yaratiladi va
// qayta ishlatiladi (dry va bajar bir xil parolni ko'rsin). `.tmp/`
// gitignore'da; ro'yxat repoga tushmaydi.
import { execFileSync } from "child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from "fs";
import { randomInt } from "crypto";

const REF = "vysygcnsjqedwqaymxsd";
const SERVER = process.env.NSPOS_SERVER ?? "root@169.58.216.246";
const KALIT = process.env.NSPOS_KEY ?? `${process.env.HOME}/.ssh/nspos`;
const BAZA = "nspos";
const MANZIL = "https://tizim.enes.uz";
const bor = (nom) => process.argv.includes(`--${nom}`);
const arg = (nom, standart) => {
  const p = process.argv.find((a) => a.startsWith(`--${nom}=`));
  return p ? p.slice(nom.length + 3) : standart;
};
const BAJAR = bor("bajar");
const SANA = arg("sana", new Date().toLocaleDateString("sv-SE"));   // YYYY-MM-DD, mahalliy
mkdirSync(".tmp", { recursive: true });
const PAROL_FAYL = `.tmp/loginlar-${SANA}.json`;
const MD_FAYL = `.tmp/loginlar-${SANA}.md`;
const SQL_FAYL = `.tmp/login-kochir-${SANA}.sql`;

// ── Qo'riqchi: CLI aynan eski loyihaga bog'langanmi ──
let ref = "";
try { ref = readFileSync("supabase/.temp/project-ref", "utf8").trim(); } catch {}
if (ref !== REF) {
  console.error(`TO'XTADI: supabase CLI '${ref || "hech narsa"}' ga bog'langan, kutilgani '${REF}'.`);
  process.exit(1);
}

// Supabase CLI har so'rovda vaqtinchalik rol yaratadi; ikki CLI bir vaqtda
// ishlasa yoki tarmoq uzilsa "failed to connect as temp role" chiqadi
// (2026-09-02 da solishtir.mjs bilan parallel yurganda ko'rildi).
// Shuning uchun 3 urinish, orasida kutish. Ikki CLI skript PARALLEL
// yurgizilmasin.
function eski(sql, urinish = 3) {
  let oxirgi;
  for (let i = 0; i < urinish; i++) {
    try {
      const out = execFileSync("supabase", ["db", "query", "--linked", sql], {
        encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"],
      });
      const j = JSON.parse(out);
      if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 300));
      return j.rows ?? [];
    } catch (e) {
      oxirgi = e;
      const sabab = String(e.stdout ?? e.message).slice(0, 200);
      console.error(`  ⚠ eski bazaga so'rov ${i + 1}/${urinish} o'tmadi: ${sabab}`);
      execFileSync("sleep", [String(3 * (i + 1))]);
    }
  }
  throw oxirgi;
}
// VPS'dan o'qish: SELECT `json_agg` ichiga o'raladi (solishtir.mjs bilan bir usul)
function vps(sql) {
  const ichki = sql.trim().replace(/;\s*$/, "");
  const out = execFileSync("ssh", ["-i", KALIT, "-o", "ConnectTimeout=20", SERVER,
    `sudo -u postgres psql -tAX -v ON_ERROR_STOP=1 -d ${BAZA} -f -`],
    { encoding: "utf8", input: `select coalesce(json_agg(t), '[]'::json) from (${ichki}) t;`,
      stdio: ["pipe", "pipe", "pipe"] });
  return JSON.parse(out);
}
function vpsBajar(sqlMatn) {
  return execFileSync("ssh", ["-i", KALIT, "-o", "ConnectTimeout=20", SERVER,
    `sudo -u postgres psql -v ON_ERROR_STOP=1 -d ${BAZA} -f -`],
    { encoding: "utf8", input: sqlMatn, stdio: ["pipe", "pipe", "pipe"] });
}

// ── 1. Ikkala bazadan hisoblar ──
const eskiRows = eski(`
  select u.id, u.email, p.full_name, p.phone, p.role, p.store_id, p.is_active,
         p.fixed_salary, p.sales_pct, p.service_pct, p.perms
  from auth.users u join public.profiles p on p.id = u.id
  where u.deleted_at is null order by p.role, p.full_name`);
const vpsRows = vps(`
  select u.id, u.email, p.full_name, p.phone, p.role
  from auth.users u join profiles p on p.id = u.id
  where u.deleted_at is null order by p.role, p.full_name`);

const eskiById = new Map(eskiRows.map((r) => [r.id, r]));
const vpsById = new Map(vpsRows.map((r) => [r.id, r]));
const faqatEski = eskiRows.filter((r) => !vpsById.has(r.id));
const faqatVps = vpsRows.filter((r) => !eskiById.has(r.id));

console.log(`\n  Manba (eski):  Supabase: ${REF} — ${eskiRows.length} hisob`);
console.log(`  Nishon (VPS):  ${SERVER} → ${BAZA} — ${vpsRows.length} hisob`);
if (faqatEski.length) {
  console.log(`\n  ⚠ Faqat eskida (VPS'da hisobi yo'q — bu skript OCHMAYDI, qo'lda ko'riladi):`);
  for (const r of faqatEski) console.log(`     ${r.full_name} · ${r.email}`);
}
if (faqatVps.length) {
  console.log(`\n  Faqat VPS'da (login o'zgarmaydi, faqat yangi parol): ${faqatVps.map((r) => r.full_name).join(", ")}`);
}

// ── 2. Parollar: bor bo'lsa o'qiladi, yo'q bo'lsa yaratiladi ──
// O'qishga oson: ikki bo'g'in + chiziqcha + 4 raqam. Chalkashadigan
// belgilar yo'q: 0/O, 1/l/I. Masalan `tuma-4728`.
const UNDOSH = "bdfghjkmnpqrstvxyz", UNLI = "aeu", RAQAM = "23456789";
const tanla = (s) => s[randomInt(s.length)];
const parolYasa = () => tanla(UNDOSH) + tanla(UNLI) + tanla(UNDOSH) + tanla(UNLI)
  + "-" + Array.from({ length: 4 }, () => tanla(RAQAM)).join("");
let parollar = {};
if (existsSync(PAROL_FAYL)) {
  parollar = JSON.parse(readFileSync(PAROL_FAYL, "utf8"));
  console.log(`\n  Parollar mavjud fayldan olindi: ${PAROL_FAYL}`);
} else {
  console.log(`\n  Parollar YANGI yaratildi: ${PAROL_FAYL}`);
}
for (const r of vpsRows) parollar[r.id] ??= parolYasa();
writeFileSync(PAROL_FAYL, JSON.stringify(parollar, null, 2));
chmodSync(PAROL_FAYL, 0o600);

// ── 3. Reja: har VPS hisobi uchun yakuniy login ──
const reja = vpsRows.map((v) => {
  const e = eskiById.get(v.id);
  return {
    id: v.id,
    full_name: e?.full_name ?? v.full_name,
    role: e?.role ?? v.role,
    phone: e?.phone ?? v.phone,
    eskiLogin: v.email,
    login: e?.email ?? v.email,
    parol: parollar[v.id],
    profil: e ?? null,
  };
});
const ozgargan = reja.filter((r) => r.login !== r.eskiLogin);

// Unique tekshiruvi: yakuniy loginlar o'zaro takrorlanmasin
const takror = reja.map((r) => r.login.toLowerCase()).filter((x, i, a) => a.indexOf(x) !== i);
if (takror.length) { console.error(`\n❌ Yakuniy loginlar takrorlanadi: ${takror.join(", ")}`); process.exit(1); }

console.log(`\n  ${"Ism".padEnd(30)} ${"VPS login".padEnd(24)} → yangi login`);
for (const r of reja) {
  console.log(`  ${r.full_name.padEnd(30)} ${r.eskiLogin.padEnd(24)} → ${r.login}${r.login !== r.eskiLogin ? "   (o'zgaradi)" : ""}`);
}
console.log(`\n  Login o'zgaradi: ${ozgargan.length} ta · Parol yangilanadi: ${reja.length} ta`);

// ── 4. SQL (bitta tranzaksiya, oxirida kirish tekshiruvi — o'tmasa ROLLBACK) ──
const J = (x) => "$eski$" + JSON.stringify(x) + "$eski$::jsonb";
const profilJson = reja.filter((r) => r.profil).map((r) => ({
  id: r.id, full_name: r.profil.full_name, phone: r.profil.phone, role: r.profil.role,
  store_id: r.profil.store_id, is_active: r.profil.is_active, fixed_salary: r.profil.fixed_salary,
  sales_pct: r.profil.sales_pct, service_pct: r.profil.service_pct, perms: r.profil.perms,
}));
const sql = `-- login-kochir ${SANA} — ${MANZIL}
begin;

-- 1) Unique to'qnashuvi bo'lmasin: o'zgaradiganlarga avval vaqtinchalik email
update auth.users set email = id::text || '@almashmoqda.local'
 where id in (select (e->>'id')::uuid from jsonb_array_elements(${J(ozgargan.map((r) => ({ id: r.id })))}) e);

-- 2) Haqiqiy login (eski bazadagi email)
update auth.users u set email = e.email, updated_at = now()
  from jsonb_to_recordset(${J(ozgargan.map((r) => ({ id: r.id, email: r.login })))})
    as e(id uuid, email text)
 where u.id = e.id;

-- 3) Profil: eski nusxa ustun (ism, telefon, rol, do'kon, oylik, ruxsatlar)
update profiles p
   set full_name = e.full_name, phone = e.phone, role = e.role, store_id = e.store_id,
       is_active = e.is_active, fixed_salary = e.fixed_salary, sales_pct = e.sales_pct,
       service_pct = e.service_pct, perms = e.perms
  from jsonb_to_recordset(${J(profilJson)})
    as e(id uuid, full_name text, phone text, role user_role, store_id uuid, is_active boolean,
         fixed_salary numeric, sales_pct numeric, service_pct numeric, perms jsonb)
 where p.id = e.id;

-- 4) Hammaga yangi parol
${reja.map((r) => `select auth.parol_almashtir('${r.id}', '${r.parol}');`).join("\n")}

-- 5) Tekshiruv: har login o'z paroli bilan kiradi, aks holda butun tranzaksiya qaytadi
do $$
declare k int; j int;
begin
  select count(*) filter (where auth.kirish(e.email, e.parol) = e.id), count(*)
    into k, j
    from jsonb_to_recordset(${J(reja.map((r) => ({ id: r.id, email: r.login, parol: r.parol })))})
      as e(id uuid, email text, parol text);
  if k <> j then
    raise exception 'Kirish tekshiruvi o''tmadi: % / % — ROLLBACK', k, j;
  end if;
  raise notice 'Kirish tekshiruvi: % / % hisob kiradi', k, j;
end $$;

commit;
`;
writeFileSync(SQL_FAYL, sql); chmodSync(SQL_FAYL, 0o600);

// ── 5. Xodimga beriladigan ro'yxat ──
const tartib = { owner: 0, manager: 1, installer: 2 };
const md = `# tizim.enes.uz — loginlar (${SANA})

Manzil: **${MANZIL}** · Login — telefon raqami (faqat raqamlar) · Parol — yangi.
Parol unutilsa: rahbar → Sozlamalar → Ustalar → yangi parol.
Bu fayl repoga tushmaydi. Har kimga faqat o'z qatori beriladi.

| # | Ism | Rol | Login | Parol |
|---|---|---|---|---|
${[...reja].sort((a, b) => (tartib[a.role] ?? 9) - (tartib[b.role] ?? 9) || a.full_name.localeCompare(b.full_name))
  .map((r, i) => `| ${i + 1} | ${r.full_name} | ${r.role} | \`${r.login.replace(/@.*/, "")}\` | \`${r.parol}\` |`).join("\n")}
`;
writeFileSync(MD_FAYL, md); chmodSync(MD_FAYL, 0o600);
console.log(`\n  Yozildi: ${SQL_FAYL}, ${MD_FAYL}`);

if (!BAJAR) {
  console.log(`\nBu --dry. VPS'ga qo'llash: node scripts/login-kochir.mjs --bajar --sana=${SANA}`);
  process.exit(0);
}

// ── 6. Qo'llash ──
const out = vpsBajar(sql);
console.log(out.trim());
const keyin = vps(`select u.id, u.email from auth.users u where u.deleted_at is null`);
const keyinById = new Map(keyin.map((r) => [r.id, r.email]));
const xato = reja.filter((r) => keyinById.get(r.id) !== r.login);
if (xato.length) {
  console.error(`\n❌ ${xato.length} hisobda login kutilganidek emas: ${xato.map((r) => r.full_name).join(", ")}`);
  process.exit(1);
}
console.log(`\n✓ ${reja.length} hisob: login eskidan, parol yangi. Ro'yxat: ${MD_FAYL}`);
