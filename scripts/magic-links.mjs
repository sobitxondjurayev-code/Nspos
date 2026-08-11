// Har hisob uchun YANGI bir martalik kirish linki generatsiya qiladi.
// Diqqat: magic link ~1 soatda eskiradi va bir marta ishlaydi.
// Doimiy kirish uchun telefon + parol ishlatilsin.
//   node scripts/magic-links.mjs
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

const REDIRECT = "https://nspos.vercel.app";

const { data: profiles } = await db.from("profiles").select("id, full_name, role");
const byId = new Map((profiles || []).map((p) => [p.id, p]));

const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (error) { console.error(error.message); process.exit(1); }

for (const u of data.users.sort((a, b) => (a.email > b.email ? 1 : -1))) {
  if (!u.email) continue;
  const prof = byId.get(u.id) || {};
  const { data: link, error: e } = await db.auth.admin.generateLink({
    type: "magiclink",
    email: u.email,
    options: { redirectTo: REDIRECT },
  });
  if (e) { console.log(`\n${prof.full_name || u.email} — XATO: ${e.message}`); continue; }
  console.log(`\n${prof.full_name || "—"}  (${prof.role || "—"})  ${u.email}`);
  console.log(link.properties.action_link);
}
