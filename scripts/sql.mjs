// ══════════════════════════════════════════════════════════════
// SQL ISHGA TUSHIRISH — baza tuzilishini o'zgartirish uchun
// ══════════════════════════════════════════════════════════════
// Supabase Management API orqali ixtiyoriy SQL bajaradi: jadval/ustun
// qo'shish, RLS siyosati, indeks va h.k. Endi dashboard'ni ochish shart
// emas — migratsiyalar shu yerdan o'tadi.
//
// Ishlatish:
//   node scripts/sql.mjs "alter table x add column y int;"
//   node scripts/sql.mjs -f scripts/sql/add-nps-product.sql
//
// Kalit .env.local dagi SUPABASE_ACCESS_TOKEN — hech qachon brauzerga
// tushmaydi va jurnalga chiqarilmaydi.
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
  if (m) process.env[m[1]] ??= m[2];
}

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("SUPABASE_ACCESS_TOKEN topilmadi (.env.local).");
  process.exit(1);
}
// Loyiha ref'i NEXT_PUBLIC_SUPABASE_URL dan olinadi
const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").match(/https:\/\/([a-z0-9]+)\.supabase/)?.[1];
if (!ref) { console.error("Loyiha ref'i aniqlanmadi."); process.exit(1); }

const args = process.argv.slice(2);
let query;
if (args[0] === "-f" && args[1]) query = readFileSync(path.resolve(args[1]), "utf8");
else query = args.join(" ");

if (!query.trim()) {
  console.error('Foydalanish: node scripts/sql.mjs "SQL..."  yoki  node scripts/sql.mjs -f fayl.sql');
  process.exit(1);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query }),
});

const text = await res.text();
if (!res.ok) {
  console.error(`XATO ${res.status}:`, text.slice(0, 500));
  process.exit(1);
}

let out;
try { out = JSON.parse(text); } catch { out = text; }
if (Array.isArray(out) && out.length) console.table(out.slice(0, 50));
else if (Array.isArray(out)) console.log("Bajarildi. Qator qaytmadi.");
else console.log(out);
