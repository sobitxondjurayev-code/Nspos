// Ustalarni tizimga qo'shadi: auth hisob + profil (role=installer) +
// KPI turi "installer". Telefon vaqtinchalik (placeholder) — keyin
// Sozlamalardan haqiqiysiga o'zgartiriladi. Parol: Sinov2026.
//   node scripts/add-installers.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
  if (m) process.env[m[1]] ??= m[2];
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });

const PASSWORD = "Sinov2026";

// Qo'shiladigan ustalar. "Tohir aka" allaqachon bor — ro'yxatда yo'q.
// Har biriga vaqtinchalik raqam: +998 90 100 00 0X
const INSTALLERS = [
  { name: "Otabek",    phone: "901000001" },
  { name: "Tohirjon",  phone: "901000002" },
  { name: "Azizbek",   phone: "901000003" },
  { name: "Abdulatif", phone: "901000004" },
  { name: "Sohibjon",  phone: "901000005" },
  { name: "Qobilxon",  phone: "901000006" },
  { name: "Abdulaziz", phone: "901000007" },
  { name: "Akramjon",  phone: "901000008" },
  { name: "Abbosxon",  phone: "901000009" },
  { name: "Muzaffar",  phone: "901000010" },
];

const email = (local) => `998${local}@nspos.app`;
const pretty = (l) => `+998 ${l.slice(0,2)} ${l.slice(2,5)} ${l.slice(5,7)} ${l.slice(7,9)}`;

const { data: profs } = await db.from("profiles").select("full_name, company_id, role");
const owner = profs.find((p) => p.role === "owner");
const company_id = owner.company_id;
const existing = new Set(profs.map((p) => (p.full_name || "").toLowerCase()));

const out = [];
for (const it of INSTALLERS) {
  if (existing.has(it.name.toLowerCase())) { out.push({ Ism: it.name, Holat: "bor edi — o'tkazildi" }); continue; }

  const { data: created, error: cErr } = await db.auth.admin.createUser({
    email: email(it.phone), password: PASSWORD, email_confirm: true,
  });
  if (cErr) { out.push({ Ism: it.name, Holat: "XATO: " + cErr.message }); continue; }

  const id = created.user.id;
  const { error: pErr } = await db.from("profiles").insert({
    id, company_id, full_name: it.name, phone: pretty(it.phone),
    role: "installer", store_id: null,
    fixed_salary: 0, sales_pct: 0, service_pct: 0, is_active: true,
  });
  if (pErr) { await db.auth.admin.deleteUser(id); out.push({ Ism: it.name, Holat: "profil XATO: " + pErr.message }); continue; }

  // KPI turi — "installer" (reyting/oylik shu bo'yicha hisoblanadi)
  await db.from("kpi_assign").upsert({ staff_id: id, kpi_type: "installer" }, { onConflict: "staff_id" });

  out.push({ Ism: it.name, Telefon: pretty(it.phone), Holat: "qo'shildi" });
}

console.table(out);
console.log(`\nParol (hammasi): ${PASSWORD}`);
