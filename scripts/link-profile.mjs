// ══════════════════════════════════════════════════════════════
// XODIMNI KOMPANIYAGA BOG'LASH
// ══════════════════════════════════════════════════════════════
// Supabase Authentication'da hisob ochilgandan keyin ishga tushiriladi.
// Hisob — bu faqat "kim kirdi" degani; u qaysi kompaniyada, qaysi rol
// bilan va qaysi do'konda ishlashi `profiles` jadvalida yoziladi.
//
// Ishlatish:
//   node scripts/link-profile.mjs email@example.com owner
//   node scripts/link-profile.mjs kassir@example.com cashier "NScamera Optim"
//
// Rollar: owner | manager | cashier | storekeeper | installer
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
  if (m) process.env[m[1]] ??= m[2];
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const [email, role = "owner", storeName = null, fullName = null] = process.argv.slice(2);
if (!email) {
  console.error("Ishlatish: node scripts/link-profile.mjs <email> [rol] [do'kon nomi] [F.I.O]");
  process.exit(1);
}

// —— 1. Auth foydalanuvchisini topish ————————————————
// listUsers sahifalab qaytaradi; email bo'yicha qidiramiz.
let user = null;
for (let page = 1; page <= 20 && !user; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
  if (error) { console.error("Auth:", error.message); process.exit(1); }
  user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
  if (data.users.length < 200) break;
}
if (!user) {
  console.error(`"${email}" topilmadi.
Supabase > Authentication > Users da hisob ochilganini tekshiring
("Auto Confirm User" yoqilgan bo'lsin).`);
  process.exit(1);
}

// —— 2. Kompaniya va do'kon ————————————————————————
const { data: company } = await db.from("companies")
  .select("id,name").eq("name", "NScamera").maybeSingle();
if (!company) {
  console.error("Kompaniya topilmadi — avval seed-supabase.mjs ni yugurting.");
  process.exit(1);
}

let storeId = null;
if (storeName) {
  const { data: store } = await db.from("stores")
    .select("id,name").eq("company_id", company.id).eq("name", storeName).maybeSingle();
  if (!store) { console.error(`Do'kon topilmadi: "${storeName}"`); process.exit(1); }
  storeId = store.id;
}

// —— 3. Profil ————————————————————————————————————
// Bor bo'lsa yangilanadi, yo'q bo'lsa yaratiladi.
const row = {
  id: user.id,
  company_id: company.id,
  full_name: fullName ?? user.email.split("@")[0],
  role,
  store_id: storeId,
  is_active: true,
};

const { error } = await db.from("profiles").upsert(row);
if (error) { console.error("Profil:", error.message); process.exit(1); }

console.log(`✓ ${email}
  kompaniya  ${company.name}
  rol        ${role}
  do'kon     ${storeName ?? "barchasi"}
  ism        ${row.full_name}

Endi shu email va parol bilan tizimga kirishingiz mumkin.`);
