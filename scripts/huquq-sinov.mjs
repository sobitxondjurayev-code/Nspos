// ══════════════════════════════════════════════════════════════
// HUQUQ MATRITSASI SINOVI — RLS haqiqatda PERMISSIONS bilan mosmi
// ══════════════════════════════════════════════════════════════
//   npm run huquq
//
// Nega: `npm run tekshir` hisob xatosini tutadi, HUQUQ xatosini
// tutmaydi (CLAUDE.md 2026-08-21) — u qatorlarni SQL orqali o'qiydi va
// RLS chetlab o'tiladi. Xodim hisobida "saqlash ishlamayapti" degan
// shikoyatning sababi esa ko'pincha aynan siyosat: PostgREST rad
// etganini xato bilan emas, 0 qator bilan bildiradi.
//
// Nima qiladi: HAR ROL uchun (owner, manager, cashier, storekeeper,
// installer) serverda `postgres` sifatida ulanib,
//   begin; set_config('app.user_id', <shu roldagi xodim id>);
//   set local role nspos_app; <insert/update/select>; rollback;
// qiladi. `auth.uid()` VPS'da `app.user_id` ni ham o'qiydi
// (`00-shim.sql`), ya'ni JWT yasash shart emas. Har amal alohida
// ichki blokda: rad etilsa `insufficient_privilege`, 0 qator bo'lsa
// "rad0" — ikkalasi ham "yozolmadi". Oxirida ROLLBACK: hech narsa
// yozilmaydi.
//
// Kutilgan javob `lib/auth.js` → PERMISSIONS dan olinadi (interfeys
// nimani ochadi). Bazadagi haqiqat u bilan farq qilsa — chiqish 1.
// Ya'ni: interfeysda tugma bor-u baza rad etadi — XATO; interfeysda
// yo'q-u baza ruxsat beradi — ham XATO (yashirin teshik).
//
// Bazaga ulanish `scripts/sql.mjs` bilan bir xil: SSH → sudo -u postgres.
import { spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { PERMISSIONS } from "../lib/auth.js";

const SERVER = process.env.NSPOS_SERVER ?? "root@169.58.216.246";
const KALIT = process.env.NSPOS_KEY ?? path.join(os.homedir(), ".ssh/nspos");
const BAZA = "nspos";
const ROLLAR = ["owner", "manager", "cashier", "storekeeper", "installer"];

// Har sinov: jadval, amal, PERMISSIONS kaliti ("*" — hamma rol), SQL.
// SQL `nspos_app` roli ostida, o'sha xodim nomidan bajariladi.
// `{BOSHQA}` — boshqa xodimning id'si (KPI: boshqaga yozish).
const SINOVLAR = [
  { t: "customers", op: "insert", kalit: "customer.edit",
    sql: "insert into customers (name) values ('__sinov')" },
  { t: "customers", op: "update", kalit: "customer.edit",
    sql: "update customers set name = name where id = (select id from customers limit 1)" },
  { t: "stock", op: "insert", kalit: "product.edit",
    sql: `insert into stock (product_id, store_id, qty)
          select p.id, s.id, 0 from products p cross join stores s
          where p.company_id = auth_company_id() and s.company_id = auth_company_id()
            and not exists (select 1 from stock x where x.product_id = p.id and x.store_id = s.id)
          limit 1` },
  { t: "stock", op: "update", kalit: "product.edit",
    sql: "update stock set qty = qty where product_id = (select product_id from stock limit 1)" },
  { t: "products", op: "insert", kalit: "product.edit",
    sql: "insert into products (name) values ('__sinov')" },
  { t: "products", op: "update", kalit: "product.edit",
    sql: "update products set name = name where id = (select id from products limit 1)" },
  { t: "expenses", op: "insert", kalit: "finance.expenses",
    sql: `insert into expenses (category, amount, kassa, spent_on)
          values ('other', 1, coalesce(auth_store_id()::text, 'company'), (now() at time zone 'Asia/Tashkent')::date)` },
  { t: "kassa_ops", op: "select", kalit: "kassa.view",
    sql: "select count(*) into n from kassa_ops", select: true },
  { t: "kassa_ops", op: "insert", kalit: "kassa.operate",
    sql: `insert into kassa_ops (kassa, wallet, kind, amount, category)
          values (coalesce(auth_store_id()::text, 'company'), 'cash', 'in', 1, 'other_in')` },
  { t: "nps_records", op: "insert", kalit: "nps.edit",
    sql: "insert into nps_records (id, month) values ('__sinov', '2000-01')" },
  { t: "cash_operations", op: "insert", kalit: "finance.cash",
    sql: "insert into cash_operations (direction, category, amount, store_id) values ('in', 'other_in', 1, auth_store_id())" },
  { t: "service_orders", op: "insert", kalit: "service.edit",
    sql: "insert into service_orders (no) values ('__sinov')" },
  { t: "kpi_day", op: "insert-ozi", kalit: "*",
    sql: "insert into kpi_day (id, staff_id, date) values ('__sinov', auth.uid(), '2000-01-01')" },
  { t: "kpi_day", op: "insert-boshqa", kalit: "kpi.manage",
    sql: "insert into kpi_day (id, staff_id, date) values ('__sinov2', '{BOSHQA}', '2000-01-01')" },
  { t: "debt_payments", op: "insert", kalit: "customer.debt",
    sql: "insert into debt_payments (debt_id, amount) values ((select id from debts limit 1), 0.01)" },
  { t: "warehouse_operations", op: "insert", kalit: "warehouse.operate",
    sql: "insert into warehouse_operations (no, type) values ('__sinov', 'transfer')" },
  { t: "shipments", op: "insert", kalit: "finance.suppliers",
    sql: "insert into shipments (no, shipped_at) values ('__sinov', current_date)" },
  { t: "suppliers", op: "insert", kalit: "finance.suppliers",
    sql: "insert into suppliers (name) values ('__sinov')" },
  { t: "datasets", op: "insert", kalit: "report.view",
    sql: "insert into datasets (name) values ('__sinov')" },
  { t: "usd_rates", op: "insert", kalit: "finance.rate",
    sql: "insert into usd_rates (rate) values (1)" },
  { t: "payouts", op: "insert", kalit: "finance.plan",
    sql: "insert into payouts (title, amount, due_date) values ('__sinov', 1, current_date)" },
  { t: "payroll_payments", op: "insert", kalit: "finance.payroll",
    sql: "insert into payroll_payments (staff_id, amount, period_from, period_to) values (auth.uid(), 1, current_date, current_date)" },
  { t: "store_plans", op: "update", kalit: "finance.payroll",
    sql: "update store_plans set monthly = monthly where store_id = (select store_id from store_plans limit 1)" },
  { t: "companies", op: "update", kalit: "settings.edit",
    sql: "update companies set name = name where id = auth_company_id()" },
];

function psql(sql) {
  const r = spawnSync("ssh", ["-i", KALIT, "-o", "BatchMode=yes", SERVER,
    `sudo -u postgres psql -v ON_ERROR_STOP=0 -qAt -f - ${BAZA}`],
    { input: sql, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (r.error) { console.error("SSH ishga tushmadi:", r.error.message); process.exit(1); }
  return { out: r.stdout ?? "", err: r.stderr ?? "", status: r.status };
}

// 1) Har rol uchun bitta haqiqiy xodim (bitta kompaniya)
const ids = psql(`
  select role, id, coalesce(store_id::text, '') from (
    select distinct on (role) role, id, store_id from profiles
    where company_id = (select id from companies order by created_at limit 1)
    order by role, (store_id is null), created_at
  ) x;
`).out.trim().split("\n").filter(Boolean).map((l) => l.split("|"));
const xodim = Object.fromEntries(ids.map(([role, id, store]) => [role, { id, store }]));

const boshqaId = (role) => (role === "owner" ? xodim.manager?.id ?? xodim.cashier?.id : xodim.owner?.id) ?? null;

console.log(`huquq sinovi — ${SERVER} · ${BAZA} · ${new Date().toISOString().slice(0, 16)}`);
for (const r of ROLLAR) {
  if (!xodim[r]) console.log(`  ${r}: bu rolda xodim yo'q — o'tkazib yuboriladi`);
}

// 2) Har rol uchun sinov SQL: bitta tranzaksiya, ichki bloklar, oxirida rollback
const natija = {};      // role → { "t|op" → 'ok' | 'rad' | 'rad0' | 'xato:…' }
for (const role of ROLLAR) {
  const x = xodim[role];
  if (!x) continue;
  const boshqa = boshqaId(role);
  const bloklar = SINOVLAR.map((s) => {
    const sql = s.sql.replace("{BOSHQA}", boshqa ?? "00000000-0000-0000-0000-000000000000");
    const belgi = `${s.t}|${s.op}`;
    const tekshir = s.select
      ? `if n = 0 then raise notice 'SINOV|${belgi}|rad0'; else raise notice 'SINOV|${belgi}|ok'; end if;`
      : `get diagnostics n = row_count; if n = 0 then raise notice 'SINOV|${belgi}|rad0'; else raise notice 'SINOV|${belgi}|ok'; end if;`;
    return `
    begin
      ${sql};
      ${tekshir}
    exception
      when insufficient_privilege then raise notice 'SINOV|${belgi}|rad';
      when others then raise notice 'SINOV|${belgi}|xato:%', replace(sqlerrm, E'\\n', ' ');
    end;`;
  }).join("\n");

  const sql = `
begin;
select set_config('app.user_id', '${x.id}', true);
set local role nspos_app;
do $sinov$
declare n bigint;
begin
${bloklar}
end
$sinov$;
rollback;
`;
  const { out, err } = psql(sql);
  const map = {};
  // Faqat HAQIQIY natija qatorlari: psql xato matnida so'rov matni qaytib
  // kelsa, undagi 'SINOV|…' bo'laklari natija bo'lib o'qilmasin
  for (const m of (err + "\n" + out).matchAll(/NOTICE:\s+SINOV\|([^|\n]+)\|([^|\n]+)\|(ok|rad0?|xato:[^\n]*)$/gm)) {
    map[`${m[1]}|${m[2]}`] = m[3].trim();
  }
  natija[role] = map;
  // Bitta ham natija kelmasa — sinov SQL ning o'zi yiqilgan; sababi ko'rinsin
  if (!Object.keys(map).length || process.env.HUQUQ_DEBUG) {
    console.log(`  [${role}] psql javobi:\n` + (err + out).split("\n").filter(Boolean).slice(0, 25).map((l) => "    " + l).join("\n"));
  }
}

// 3) Solishtirish: kutilgan (PERMISSIONS) ↔ haqiqat (RLS)
const rollarBor = ROLLAR.filter((r) => xodim[r]);
const kutilgan = (kalit, role) => (kalit === "*" ? true : (PERMISSIONS[kalit] ?? []).includes(role));
let farq = 0, xato = 0;
const kenglik = Math.max(...SINOVLAR.map((s) => (s.t + " " + s.op).length)) + 2;
console.log("\n" + "".padEnd(kenglik) + rollarBor.map((r) => r.padStart(12)).join(""));
for (const s of SINOVLAR) {
  const nom = (s.t + " " + s.op).padEnd(kenglik);
  const kataklar = rollarBor.map((role) => {
    const v = natija[role]?.[`${s.t}|${s.op}`] ?? "?";
    const ok = v === "ok";
    const kut = kutilgan(s.kalit, role);
    let belgi;
    if (v.startsWith("xato:")) { belgi = "⚠ xato"; xato++; }
    else if (ok === kut) belgi = ok ? "✓" : "—";
    else { belgi = ok ? "✗ OCHIQ" : "✗ YOPIQ"; farq++; }
    return belgi.padStart(12);
  });
  console.log(nom + kataklar.join(""));
}
console.log(`\n  ✓ ruxsat va kutilgan · — rad va kutilgan · ✗ OCHIQ — interfeysda yo'q, baza ruxsat beradi · ✗ YOPIQ — interfeysda bor, baza rad etadi`);

// Xato (konstraint, ustun yo'q) — sinovning o'zi buzilgan, uni ham ko'rsatamiz
for (const role of rollarBor) {
  for (const [k, v] of Object.entries(natija[role])) {
    if (v.startsWith("xato:")) console.log(`  ⚠ ${role} · ${k}: ${v.slice(5)}`);
  }
}
for (const s of SINOVLAR) {
  const belgi = `${s.t}|${s.op}`;
  for (const role of rollarBor) {
    const v = natija[role]?.[belgi];
    if (v === undefined) console.log(`  ⚠ ${role} · ${belgi}: natija kelmadi (sinov SQL buzilgan?)`);
  }
}

if (farq || xato) {
  console.log(`\n✗ ${farq} ta farq, ${xato} ta sinov xatosi — RLS va lib/auth.js PERMISSIONS mos emas`);
  process.exit(1);
}
console.log("\n✓ Huquq matritsasi mos");
