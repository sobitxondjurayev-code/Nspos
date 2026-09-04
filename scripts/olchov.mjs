// ══════════════════════════════════════════════════════════════
// EKRAN RAQAMLARINI O'LCHASH — ilovaning O'Z funksiyalari bilan
// ══════════════════════════════════════════════════════════════
//   npm run olchov:server            (serverdagi joylashgan kod, haqiqiy baza)
//   npm run olchov -- --oy=2026-08   (kompyuterda — baza bo'lsa)
//
// `scripts/sql/audit-olchov.sql` xom bazani o'lchaydi; bu skript esa
// rahbar EKRANDA ko'radigan raqamni chiqaradi: P&L, qarz, balans,
// kassa — `profitAndLoss`, `jamiQarz`, `balanceSheet`, `kassaBalances`.
// Formula QAYTA YOZILMAYDI (CLAUDE.md 2026-08-14): faqat chaqiriladi.
//
// Nega kerak: kod o'zgarganda "sof foyda +5 065 $ bo'lishi kerak"
// degan kutilma raqam bilan tasdiqlanadi — o'zgarishdan OLDIN va KEYIN
// bir xil skript (DAFTAR 14.9: ta'sir o'lchanmasa ko'rinmaydi).
import { loadApp, manbaNomi } from "./lib/yuk.mjs";

const arg = (nom) => process.argv.find((a) => a.startsWith(`--${nom}=`))?.split("=")[1];

await loadApp();
const { profitAndLoss, salesPnl, cashFlow, foydaPulKoprigi } = await import("../lib/pnlData.js");
const { jamiQarz } = await import("../lib/debtsData.js");
const { balanceSheet } = await import("../lib/balanceData.js");
const { kassaBalances, kassaIds, KASSAS, WALLET_IDS, WALLETS } = await import("../lib/kassaData.js");
const { productProfit } = await import("../lib/analytics.js");
const { getUsdRate } = await import("../lib/companyData.js");

// Standart — o'tgan oy (Toshkent vaqti)
const hozir = new Date(Date.now() + 5 * 3600e3);
const otganOy = new Date(Date.UTC(hozir.getUTCFullYear(), hozir.getUTCMonth() - 1, 1));
const oy = arg("oy") ?? `${otganOy.getUTCFullYear()}-${String(otganOy.getUTCMonth() + 1).padStart(2, "0")}`;
const [y, m] = oy.split("-").map(Number);
const from = new Date(Date.UTC(y, m - 1, 1, -5));                 // 00:00 Toshkent
const to = new Date(Date.UTC(y, m, 1, -5) - 1);

const usd = (v) => `${(+(v ?? 0)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
const q = (s, v) => console.log(`   ${s.padEnd(34)} ${usd(v).padStart(14)}`);

console.log(`\nManba: ${manbaNomi()} · oy ${oy} · kurs ${getUsdRate() ?? "—"}`);

const p = profitAndLoss(from, to);
const sp = salesPnl(from, to);
console.log(`\n── P&L (${oy}) — profitAndLoss()`);
q("Tovar sotuvi (sof, qaytarish ayrilgan)", p.revenue.goods);
q("  shundan qaytarilgan", -p.revenue.returns);
q("Sotilgan tovar tannarxi", -p.cogs.goods);
if (sp.tannarxsiz) q(`  tannarxsiz qatorlar (${sp.tannarxsiz.qatorlar})`, sp.tannarxsiz.summa);
if (sp.servisQatorlar != null) console.log(`   xizmat qatorlari: ${sp.servisQatorlar} (tannarx 0)`);
q("Yalpi foyda", p.grossProfit);
console.log(`   marja ${p.grossMargin} %`);
q("Ish haqi (payroll)", -p.expenses.payroll);
q("Usta ulushi", -p.expenses.installerShare);
q("OPEX (oylikdan tashqari)", -p.expenses.opex);
q("Jami xarajat", -(p.expenses.total + p.expenses.installerShare));
if (p.expenses.boshqaChiqim) q("  shundan boshqa chiqim (kassa)", -p.expenses.boshqaChiqim);
if (p.expenses.payrollKurslar) console.log(`   oylik kurslari: ${Object.entries(p.expenses.payrollKurslar).map(([m, k]) => `${m} ${k.rate} (${k.manba})`).join(" · ")}`);
if (p.soliq?.summa) q(`Soliq zaxirasi (${p.soliq.foiz} %)`, -p.soliq.summa);
q("SOF FOYDA", p.netProfit);

const kp = foydaPulKoprigi(from, to);
console.log(`\n── Foyda → Pul (${oy}) — foydaPulKoprigi()`);
for (const r of kp.qatorlar) q(r.nom.slice(0, 34), r.summa);
q("= Kutilgan kassa o'zgarishi", kp.kutilgan);
q("Haqiqiy (kassa oxiri − boshi)", kp.haqiqiy);
q("IZOHLANMAGAN", kp.izohlanmagan);

const cf = cashFlow(from, to);
console.log(`\n── Pul oqimi (${oy}) — cashFlow()`);
q("Kirgan", cf.in.total); q("Chiqqan", -cf.out.total); q("Sof pul", cf.net); q("Nasiyaga ketgan (izoh)", cf.onCredit);

const jq = jamiQarz();
console.log(`\n── Qarz (hozir) — jamiQarz()`);
q(`Jami (${jq.soni} qarz)`, jq.jami);
for (const k of Object.keys(jq)) {
  if (["jami", "soni", "billzVaqti"].includes(k)) continue;
  const v = jq[k];
  if (v && typeof v === "object" && "summa" in v) q(`  ${k} (${v.soni ?? "?"})`, v.summa);
  else if (typeof v === "number") q(`  ${k}`, v);
}

if (jq.yosh) console.log(`   yosh: ${jq.yosh.map((g) => `${g.label} ${usd(g.summa)} (${g.soni})`).join(" · ")}`);
if (jq.top10) console.log(`   top-10 ulushi ${jq.top10.ulush} % · DSO ${jq.dso ?? "—"} kun · muddat ${jq.muddatKun} kun`);

const b = balanceSheet(new Date());
console.log(`\n── Balans (hozir) — balanceSheet()`);
q("Aktiv", b.totalAssets); q("Passiv", b.totalLiabilities); q("Kapital", b.equity);
if (b.kapital) for (const [k, v] of Object.entries(b.kapital)) if (typeof v === "number") q(`  ${k}`, v);
for (const a of b.assets ?? []) q(`  aktiv: ${a.label ?? a.key}`, a.amount);
for (const l of b.liabilities ?? []) q(`  passiv: ${l.label ?? l.key}`, l.amount);

const bal = kassaBalances(new Date());
console.log(`\n── Kassalar (hozir) — kassaBalances()`);
for (const k of kassaIds()) q(KASSAS[k]?.label ?? k, bal[k]?.total);
console.log(`   hamyonlar: ${WALLET_IDS.map((w) => `${WALLETS[w]} ${usd(kassaIds().reduce((s, k) => s + (bal[k]?.[w] ?? 0), 0))}`).join(" · ")}`);

const montaj = productProfit(from, to, { by: "product" }).find((r) => r.product?.isService);
if (montaj) {
  console.log(`\n── Xizmat qatori (Tovar kesimida foyda)`);
  q(`${montaj.name}: tushum`, montaj.revenue); q("  tannarx", montaj.cogs); console.log(`   marja ${montaj.margin ?? "—"} %`);
}
console.log("");
