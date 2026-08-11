// Barcha login hisoblarini ro'yxatlaydi: ism, rol, telefon (login), email.
// Faqat rahbar uchun — service key bilan lokal ishlaydi.
//   node scripts/list-logins.mjs
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

// 1) profiles: ism + rol
const { data: profiles, error: pErr } = await db
  .from("profiles").select("id, full_name, role");
if (pErr) { console.error("profiles:", pErr.message); process.exit(1); }
const byId = new Map(profiles.map((p) => [p.id, p]));

// 2) auth users: email (telefon@nspos.app) va phone
const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (error) { console.error("auth:", error.message); process.exit(1); }

const prettyPhone = (d) => {
  if (!d) return "";
  const s = String(d).replace(/\D/g, "");
  const x = s.startsWith("998") ? s : "998" + s;
  return `+${x.slice(0,3)} ${x.slice(3,5)} ${x.slice(5,8)} ${x.slice(8,10)} ${x.slice(10,12)}`.trim();
};

const rows = data.users.map((u) => {
  const prof = byId.get(u.id) || {};
  const digits = (u.email || "").endsWith("@nspos.app")
    ? (u.email || "").split("@")[0]
    : (u.phone || "");
  return {
    Ism: prof.full_name || "—",
    Rol: prof.role || "—",
    Telefon: prettyPhone(digits) || (u.email || "—"),
    Email: u.email || "—",
  };
});

rows.sort((a, b) => (a.Rol > b.Rol ? 1 : -1));
console.table(rows);
console.log(`\nJami: ${rows.length} ta hisob`);
