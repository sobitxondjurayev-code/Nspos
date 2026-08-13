import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const mode = process.argv[2];
const email = "998900000199@nspos.app";
if (mode === "up") {
  const { data: c } = await admin.from("companies").select("id").limit(1).single();
  const { data: s } = await admin.from("stores").select("id").eq("kind","shop").limit(1).single();
  const { data: u, error } = await admin.auth.admin.createUser({ email, password: "test-menejer-2026", email_confirm: true });
  if (error) throw error;
  await admin.from("profiles").insert({ id: u.user.id, company_id: c.id, full_name: "TEST menejer", phone: "+998 90 000 01 99", role: "manager", store_id: s.id });
  console.log("ochildi:", u.user.id);
} else {
  const { data } = await admin.from("profiles").select("id").like("full_name","TEST%");
  for (const p of data ?? []) { await admin.from("profiles").delete().eq("id", p.id); await admin.auth.admin.deleteUser(p.id).catch(()=>{}); }
  console.log("o'chirildi:", (data ?? []).length);
}
