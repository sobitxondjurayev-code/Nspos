// B2B Excel raqamlarini KPI jadvaliga ko'chiradi (kpi_day + kpi_plan + kpi_assign).
// Manba: "Kunlik raqamlar b2b (2).xlsx" — Iyul 2026.
//   node scripts/import-b2b-kpi.mjs
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

const MONTH = "2026-07";
// Excel'dan (sariq kataklar). Bo'sh kunlar tashlab yuborilgan.
// Ustunlar: payme (Payme $), cash (Naqd $), sales (Bugungi savdo $),
// wholesalePosts (Optomga yangilik: Ha=1/Yo'q=0), clientCalls (Eski
// mijozlarga aloqa), revision (Kamomad $), late/dayOff (Kech/Dam).
const DAYS = [
  { d: 5,  revision: 0 },
  { d: 8,  payme: 823,  cash: 1403, sales: 2899 },
  { d: 9,  payme: 292,  cash: 1365, sales: 4965 },
  { d: 10, payme: 1111, cash: 844,  sales: 1876, revision: 0 },
  { d: 11, payme: 1101, cash: 4207, sales: 1976 },
  { d: 12, payme: 267,  cash: 1107, sales: 1429, dayOff: true },
  { d: 13, payme: 579,  cash: 1507, sales: 2352, late: true },
  { d: 14, payme: 449,  cash: 2993, sales: 2003 },
  { d: 15, payme: 425,  cash: 270,  sales: 1484, revision: 0 },
  { d: 16, payme: 557,  cash: 1239, sales: 2786 },
  { d: 17, payme: 445,  cash: 1449, sales: 2186 },
  { d: 18, payme: 403,  cash: 3936, sales: 3883 },
  { d: 19, payme: 65,   cash: 2332, sales: 2370, late: true },
  { d: 20, payme: 524,  cash: 900,  sales: 1554, revision: 0 },
  { d: 21, payme: 169,  cash: 1117, sales: 1228 },
  { d: 22, payme: 97,   cash: 1321, sales: 3182, clientCalls: 3 },
  { d: 23, payme: 853,  cash: 5168, sales: 1498, dayOff: true, clientCalls: 4 },
  { d: 24, payme: 463,  cash: 914,  sales: 3276, clientCalls: 2 },
  { d: 25, payme: 124,  cash: 1558, sales: 1513, wholesalePosts: 1, clientCalls: 5, revision: 0 },
  { d: 26, payme: 361,  cash: 3081, sales: 3737, wholesalePosts: 0, clientCalls: 3 },
  { d: 27, payme: 760,  cash: 1718, sales: 2058, wholesalePosts: 1, clientCalls: 2 },
  { d: 28, payme: 1206, cash: 1328, sales: 2519, late: true, wholesalePosts: 1, clientCalls: 6 },
  { d: 29, payme: 169,  cash: 2078, sales: 5446, wholesalePosts: 1, clientCalls: 4 },
  { d: 30, clientCalls: 2, revision: 0 },
];

// —— Kimga: B2B menejer ————————————————————————————
const { data: profs } = await db.from("profiles").select("id, full_name, role");
const { data: assigns } = await db.from("kpi_assign").select("staff_id, kpi_type");
const byId = new Map(profs.map((p) => [p.id, p]));
const managers = profs.filter((p) => p.role === "manager");
let targetId = (assigns.find((a) => a.kpi_type === "b2b") || {}).staff_id;
if (!targetId) targetId = (managers.find((m) => /abduvahid/i.test(m.full_name)) || managers[0] || {}).id;
if (!targetId) { console.log("Menejer topilmadi"); process.exit(1); }
const target = byId.get(targetId);
console.log(`B2B menejer: ${target.full_name} (${targetId})`);

// —— Tur = b2b ————————————————————————————————
await db.from("kpi_assign").upsert({ staff_id: targetId, kpi_type: "b2b" }, { onConflict: "staff_id" });

// —— Reja (Savdo plani $100 000) ————————————————————
await db.from("kpi_plan").upsert({
  id: `p:${targetId}:${MONTH}`, staff_id: targetId, month: MONTH,
  data: { salesPlan: 100000, akbPlan: 40, akbFact: 0, clientCallsPlan: 0, newGroupsPlan: 0, wholesalePlan: 0 },
}, { onConflict: "id" });

// —— Kunlik yozuvlar ————————————————————————————
const rows = DAYS.map(({ d, ...rest }) => {
  const date = `${MONTH}-${String(d).padStart(2, "0")}`;
  const data = {};
  for (const [k, v] of Object.entries(rest)) if (v !== undefined && v !== null) data[k] = v;
  return { id: `d:${targetId}:${date}`, staff_id: targetId, date, data };
});
const { error } = await db.from("kpi_day").upsert(rows, { onConflict: "id" });
if (error) { console.log("XATO:", error.message); process.exit(1); }

const totalSales = DAYS.reduce((a, r) => a + (r.sales || 0), 0);
console.log(`Yozildi: ${rows.length} kun · jami savdo $${totalSales.toLocaleString("en-US")} · reja $100 000`);
