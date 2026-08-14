// ══════════════════════════════════════════════════════════════
// PUL HISOBINI TEKSHIRISH — haqiqiy baza bo'yicha
// ══════════════════════════════════════════════════════════════
// Ishlatish:  node scripts/tekshir.mjs
//
// Nega kerak: bir raqam bir necha bo'limda ko'rinadi (Xarajatlar,
// Pul rejasi, Kassa, P&L). Kodda bittasini o'zgartirib boshqasini
// unutish oson — foydalanuvchi buni ekranda ko'rib qoladi. Bu skript
// bazadagi HAQIQIY yozuvlardan hisoblab, mos kelishi shart bo'lgan
// raqamlarni solishtiradi. Saytga chiqarishdan OLDIN ishlatiladi.
//
// Tekshiradi:
//   1. Har hamyon (naqd/Payme/servis) balansi: kirim − chiqim
//   2. Usta olgan puli servis kassasidan chiqqanmi
//   3. Ikkilangan to'lov (bir xil summa+nom bir necha marta)
//   4. To'langan reja kassa yozuviga bog'langanmi
//   5. Kurssiz yoki manfiy xarajat
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
  if (m) process.env[m[1]] ??= m[2];
}
const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").match(/https:\/\/([a-z0-9]+)\.supabase/)?.[1];
if (!token || !ref) {
  console.error("SUPABASE_ACCESS_TOKEN yoki loyiha ref'i topilmadi (.env.local).");
  process.exit(1);
}

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text.slice(0, 300));
  return JSON.parse(text);
}

const n = (v) => +Number(v ?? 0).toFixed(2);
const usd = (v) => `${n(v).toLocaleString("en-US", { minimumFractionDigits: 2 })} $`;
let bad = 0;
const ok = (name, pass, detail = "") => {
  if (!pass) bad++;
  console.log(`${pass ? "✓" : "✗ XATO"}  ${name}${detail ? `\n         ${detail}` : ""}`);
};

// —— Hisob boshi va kurs ————————————————————————
const [{ ledger_start: START, usd_rate: RATE }] = await sql(
  "select coalesce(ledger_start::text, date_trunc('month', now())::date::text) ledger_start, usd_rate from companies order by created_at limit 1"
);
console.log(`\nHisob boshi: ${START} · kurs ${Number(RATE).toLocaleString("ru-RU")} so'm\n`);

// —— 1. Hamyonlar balansi ————————————————————————
// Formula (kassaData.kassaBalances bilan bir xil):
//   hamyon = KPI kirimi − xarajatlar − kassa chiqimlari
// O'tkazmalar sanalmaydi: pul kassadan kassaga ko'chadi, umumiy
// yig'indi o'zgarmaydi.
const [inc] = await sql(`select
  round(coalesce(sum((data->>'cash')::numeric),0),2) cash,
  round(coalesce(sum((data->>'payme')::numeric),0),2) payme,
  round(coalesce(sum((data->>'service')::numeric),0),2) service
  from kpi_day where date >= '${START}'`);

const exp = await sql(`select method, round(sum(amount),2) total
  from expenses where spent_on >= '${START}' and is_recurring = false group by 1`);
const ops = await sql(`select wallet, round(sum(amount),2) total
  from kassa_ops where kind='out' and op_date >= '${START}' group by 1`);
const [{ olgan_som: OLGAN_SOM }] = await sql(`select coalesce(sum((d.data->>'olgan')::numeric),0) olgan_som
  from kpi_day d join profiles p on p.id = d.staff_id
  where d.date >= '${START}' and p.role = 'installer'`);

const by = (list, key) => n(list.find((x) => x[Object.keys(x)[0]] === key)?.total);
const olganUsd = RATE ? n(Number(OLGAN_SOM) / Number(RATE)) : 0;

const wallets = {
  cash: n(inc.cash - by(exp, "cash") - by(ops, "cash")),
  payme: n(inc.payme - by(exp, "payme") - by(ops, "payme")),
  service: n(inc.service - by(exp, "service") - by(ops, "service") - olganUsd),
};
console.log(`Hamyonlar:  naqd ${usd(wallets.cash)} · Payme ${usd(wallets.payme)} · servis ${usd(wallets.service)}`);
console.log(`Jami kassalarda: ${usd(wallets.cash + wallets.payme + wallets.service)}\n`);

ok("Hech bir hamyon manfiy emas",
  Object.values(wallets).every((v) => v >= -0.01),
  Object.entries(wallets).filter(([, v]) => v < -0.01).map(([k, v]) => `${k}: ${usd(v)}`).join(", "));

// —— 2. Usta olgan puli servis kassasidan ————————————
// Servis kirimidan servis chiqimlari (material + oylik + usta puli)
// ayrilganda kassadagi servis puli chiqishi kerak.
const [svc] = await sql(`select
  round(coalesce(sum(case when category <> 'salary' then amount end),0),2) material,
  round(coalesce(sum(case when category = 'salary' then amount end),0),2) oylik
  from expenses where method='service' and spent_on >= '${START}' and is_recurring = false`);
const svcBal = n(inc.service - svc.material - svc.oylik - olganUsd);
ok("Servis: kirim − (material + oylik + usta puli) = kassadagi servis puli",
  Math.abs(svcBal - wallets.service) < 0.01,
  `${usd(inc.service)} − (${usd(svc.material)} + ${usd(svc.oylik)} + ${usd(olganUsd)}) = ${usd(svcBal)}`);

// —— 3. Ikkilangan to'lov ————————————————————————
// Bir xil kassa+hamyon+summa+izoh bir necha marta yozilgan bo'lsa —
// ehtimol "To'lash" ikki marta bosilgan yoki xato takrorlangan.
const dup = await sql(`select kassa, wallet, amount, coalesce(note,'') note, count(*) n,
    string_agg(op_date::text, ', ' order by op_date) kunlar
  from kassa_ops where kind='out' and op_date >= '${START}'
  group by 1,2,3,4 having count(*) > 1 order by amount desc`);
ok("Ikkilangan kassa chiqimi yo'q", dup.length === 0,
  dup.map((d) => `${d.note || "(izohsiz)"} · ${usd(d.amount)} · ${d.n} marta (${d.kunlar})`).join("\n         "));

// —— 4. To'langan reja kassa yozuviga bog'langanmi ————
// Bog'lanmagan bo'lsa: "rejaga qaytarish" chiqimni o'chira olmaydi va
// pul kassada ikki marta chiqib ketishi mumkin.
const unlinkedPaid = await sql(`select title, amount, paid_at::date::text kun
  from payouts where status='paid' and op_id is null order by paid_at desc`);
ok("Har to'langan reja kassa yozuviga bog'langan", unlinkedPaid.length === 0,
  unlinkedPaid.map((p) => `${p.title} · ${usd(p.amount)} · ${p.kun}`).join("\n         "));

// Aksincha: rejaga bog'lanmagan kassa chiqimi (qo'lda kiritilgani
// bo'lishi mumkin — faqat ogohlantirish)
const orphan = await sql(`select o.note, o.amount, o.op_date::text kun, o.wallet
  from kassa_ops o left join payouts p on p.op_id = o.id
  where o.kind='out' and p.id is null and o.op_date >= '${START}' order by o.created_at desc`);
if (orphan.length) {
  console.log(`\n⚠ Rejaga bog'lanmagan ${orphan.length} ta kassa chiqimi (qo'lda kiritilgan bo'lishi mumkin):`);
  for (const o of orphan.slice(0, 10)) {
    console.log(`   ${o.kun} · ${o.note || "(izohsiz)"} · ${usd(o.amount)} · ${o.wallet}`);
  }
}

// —— 5. Kurssiz yoki manfiy xarajat ————————————————
const badExp = await sql(`select count(*) n from expenses
  where spent_on >= '${START}' and (amount <= 0 or (amount_som is not null and rate_used is null))`);
ok("Xarajatlarda kurssiz yoki manfiy yozuv yo'q", Number(badExp[0].n) === 0,
  `${badExp[0].n} ta yozuv`);

// —— 6. KPI kunlari do'koni bor xodimniki ————————————
// Do'koni yo'q menejer kiritgan kirim hech qaysi kassaga tushmaydi —
// pul jimgina yo'qoladi.
const noStore = await sql(`select p.full_name, count(*) n,
    round(sum(coalesce((d.data->>'cash')::numeric,0) + coalesce((d.data->>'payme')::numeric,0)),2) summa
  from kpi_day d join profiles p on p.id = d.staff_id
  where d.date >= '${START}' and p.store_id is null and p.role <> 'installer'
    and (coalesce((d.data->>'cash')::numeric,0) + coalesce((d.data->>'payme')::numeric,0)) > 0
  group by 1`);
ok("Kassaga tushmay qolgan kirim yo'q", noStore.length === 0,
  noStore.map((x) => `${x.full_name}: ${usd(x.summa)} (${x.n} kun) — do'kon biriktirilmagan`).join("\n         "));

console.log(bad === 0
  ? "\n✅ Hammasi joyida — raqamlar bir-biriga to'g'ri keladi.\n"
  : `\n❌ ${bad} ta muammo topildi — saytga chiqarishdan oldin tuzatilsin.\n`);
process.exit(bad === 0 ? 0 : 1);
