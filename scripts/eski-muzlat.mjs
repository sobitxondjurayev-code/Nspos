// ══════════════════════════════════════════════════════════════
// ESKI SAYTNI MUZLATISH — eski Supabase hisoblarini yopish
// ══════════════════════════════════════════════════════════════
// Ishlatish:
//   node scripts/eski-muzlat.mjs            # faqat o'lchaydi (--dry)
//   node scripts/eski-muzlat.mjs --bajar    # ban + sessiyalarni bekor qiladi
//   node scripts/eski-muzlat.mjs --qaytar   # banni olib tashlaydi
//
// NEGA (2026-09-02): VPS'ga 22–23.08 da ko'chilgan, lekin eski sayt
// (`nspos.vercel.app`) tirik qoldi va brauzerdagi saqlangan parol
// xodimni har kuni o'sha yerga qaytardi. Ikki hafta hech kim
// o'qimaydigan bazaga yozildi. Saytni ko'chirish — odamni ko'chirish
// emas: eski manzilga KIRISH to'xtamasa odam ko'chmaydi.
//
// QANDAY: eski bazaga faqat `supabase db query --linked` orqali (CLI
// login qilingan, kalit kerak emas). Ikki yozuv, ikkalasi QAYTARILADI:
//   1) auth.users.banned_until = 2126 — GoTrue banned hisobni kiritmaydi
//      ("user is banned"); parol tekshirilmaydi ham.
//   2) auth.refresh_tokens.revoked = true — ochiq sessiyalar
//      yangilanmaydi, access token muddati (1 soat) tugagach chiqib ketadi.
// HECH NARSA O'CHIRILMAYDI — eski baza qaytish yo'li bo'lib turadi.
// Vercel croni (03:13) eski bazaga yozaveradi — zararsiz, uni endi
// hech kim o'qimaydi.
import { execFileSync } from "child_process";
import { readFileSync, appendFileSync, mkdirSync } from "fs";

const REF = "vysygcnsjqedwqaymxsd";
const BAN_GACHA = "2126-01-01";
const bor = (nom) => process.argv.includes(`--${nom}`);
const BAJAR = bor("bajar");
const QAYTAR = bor("qaytar");

// ── Qo'riqchi: CLI aynan ESKI loyihaga bog'langanmi ──
// `--linked` qaysi loyihaga borishini `supabase/.temp/project-ref` aytadi.
// Boshqa loyiha bo'lsa — to'xtaymiz: bu skript faqat eskisi uchun.
let ref = "";
try { ref = readFileSync("supabase/.temp/project-ref", "utf8").trim(); } catch {}
if (ref !== REF) {
  console.error(`TO'XTADI: supabase CLI '${ref || "hech narsa"}' ga bog'langan, kutilgani '${REF}'.`);
  console.error(`  supabase link --project-ref ${REF}`);
  process.exit(1);
}

// Supabase CLI har so'rovda vaqtinchalik rol yaratadi; ikki CLI bir vaqtda
// ishlasa yoki tarmoq uzilsa "failed to connect as temp role" chiqadi
// (2026-09-02 da solishtir.mjs bilan parallel yurganda ko'rildi).
// Shuning uchun 3 urinish, orasida kutish. Ikki CLI skript PARALLEL
// yurgizilmasin.
function sorov(sql, urinish = 3) {
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

mkdirSync(".tmp", { recursive: true });
const JURNAL = ".tmp/eski-muzlat.log";
const yoz = (s) => { console.log(s); appendFileSync(JURNAL, s + "\n"); };

function olchov(sarlavha) {
  const [r] = sorov(`
    select (select count(*) from auth.users)                                   as hisoblar,
           (select count(*) from auth.users where banned_until > now())        as banned,
           (select count(*) from auth.refresh_tokens where revoked = false)    as faol_sessiya,
           (select max(last_sign_in_at)::text from auth.users)                 as oxirgi_kirish,
           (select max(created_at)::text from public.expenses)                 as oxirgi_xarajat,
           (select max(created_at)::text from public.kassa_ops)                as oxirgi_kassa,
           (select max(updated_at)::text from public.kpi_day)                  as oxirgi_kpi`);
  yoz(`\n── ${sarlavha} · ${new Date().toISOString()} · Supabase: ${REF}`);
  for (const [k, v] of Object.entries(r)) yoz(`  ${k.padEnd(15)} ${v ?? "—"}`);
  return r;
}

const oldin = olchov(BAJAR ? "MUZLATISHDAN OLDIN" : QAYTAR ? "QAYTARISHDAN OLDIN" : "HOLAT (dry)");

if (QAYTAR) {
  sorov(`update auth.users set banned_until = null, updated_at = now()
         where banned_until = '${BAN_GACHA}'`);
  const keyin = olchov("QAYTARILDI");
  if (Number(keyin.banned) !== 0) { yoz("❌ Ban hali turibdi"); process.exit(1); }
  yoz("✓ Eski saytga kirish QAYTA OCHILDI (sessiyalar qaytmaydi — qayta kiriladi).");
  process.exit(0);
}

if (!BAJAR) {
  yoz(`\nBu --dry. Muzlatish uchun: node scripts/eski-muzlat.mjs --bajar`);
  yoz(`Yoziladigan narsa: ${oldin.hisoblar} hisobga banned_until=${BAN_GACHA}, ${oldin.faol_sessiya} sessiya revoked=true.`);
  process.exit(0);
}

// ── Muzlatish ──
sorov(`update auth.users set banned_until = '${BAN_GACHA}', updated_at = now()
       where banned_until is null or banned_until < now()`);
sorov(`update auth.refresh_tokens set revoked = true, updated_at = now()
       where revoked = false`);

const keyin = olchov("MUZLATILDI");
const xato = [];
if (Number(keyin.banned) !== Number(keyin.hisoblar)) xato.push(`banned ${keyin.banned} ≠ hisoblar ${keyin.hisoblar}`);
if (Number(keyin.faol_sessiya) !== 0) xato.push(`faol sessiya ${keyin.faol_sessiya} ≠ 0`);
if (xato.length) { yoz("❌ " + xato.join("; ")); process.exit(1); }
yoz(`✓ Eski sayt muzlatildi: ${keyin.hisoblar} hisob banned, sessiyalar bekor.`);
yoz(`  Qaytarish: node scripts/eski-muzlat.mjs --qaytar`);
