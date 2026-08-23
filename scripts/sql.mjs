// ══════════════════════════════════════════════════════════════
// SQL ISHGA TUSHIRISH — baza tuzilishini o'zgartirish uchun
// ══════════════════════════════════════════════════════════════
// Ishlatish:
//   node scripts/sql.mjs "alter table x add column y int;"
//   node scripts/sql.mjs -f scripts/sql/auth-xodim.sql
//
// NEGA QAYTA YOZILDI (2026-08-24):
// Bu skript Supabase Management API'ga borardi
// (`api.supabase.com/v1/projects/<ref>/database/query`) va loyiha
// ref'ini `NEXT_PUBLIC_SUPABASE_URL` dan olardi. Supabase 2026-08-23
// da yopilgan, manzil esa endi `https://tizim.enes.uz` — ya'ni ref
// umuman topilmasdi va skript birinchi qatorida to'xtardi:
//
//   Loyiha ref'i aniqlanmadi.
//
// Holbuki CLAUDE.md migratsiyani AYNAN shu skript orqali qilishni
// aytadi. Ya'ni hujjatdagi yagona yo'l boshi berk ko'chaga olib
// borardi va har migratsiya qo'lda `ssh` bilan qilinardi.
//
// Endi u serverga SSH bilan boradi va `psql` ni SUPERUSER (postgres)
// sifatida ishga tushiradi — `auth` sxemasidagi funksiyalar va RLS
// siyosatlari uchun shu kerak.
//
// `ON_ERROR_STOP=1` MAJBURIY: busiz psql xato qatoridan keyin ham
// davom etadi va oxirida "bajarildi" deb turadi — yarim ko'chgan
// migratsiya esa eng yomon holat.
import { readFileSync } from "fs";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import os from "os";

const SERVER = process.env.NSPOS_SERVER ?? "root@169.58.216.246";
const KALIT = process.env.NSPOS_KEY ?? path.join(os.homedir(), ".ssh/nspos");
const BAZA = "nspos";

const args = process.argv.slice(2);
let query;
if (args[0] === "-f" && args[1]) {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  query = readFileSync(path.resolve(root, args[1]), "utf8");
} else {
  query = args.join(" ");
}

if (!query.trim()) {
  console.error('Foydalanish: node scripts/sql.mjs "SQL..."  yoki  node scripts/sql.mjs -f fayl.sql');
  process.exit(1);
}

// SQL ARGUMENT bo'lib emas, STDIN orqali beriladi: qo'shtirnoq,
// dollar-qavs (`$$`) va qatorlar buzilmasin. Uzoq tomonda ham
// aynan shunday — `psql` faylni stdin'dan o'qiydi.
const r = spawnSync("ssh", [
  "-i", KALIT, SERVER,
  `sudo -u postgres psql -v ON_ERROR_STOP=1 -f - ${BAZA}`,
], { input: query, encoding: "utf8" });

if (r.error) {
  console.error("SSH ishga tushmadi:", r.error.message);
  process.exit(1);
}
// psql xabarlari stderr'ga chiqadi — ular ham ko'rsatilsin, lekin
// serverning locale ogohlantirishlari shovqin qilmasin.
const shovqin = /locale|LANGUAGE|LC_ALL|LC_CTYPE|LANG =|are supported|fallback locale|^perl:/;
const xato = (r.stderr ?? "").split("\n").filter((s) => s && !shovqin.test(s));
if (r.stdout?.trim()) console.log(r.stdout.trim());
if (xato.length) console.error(xato.join("\n"));
if (r.status !== 0) process.exit(r.status ?? 1);
console.log("✓ Bajarildi");
