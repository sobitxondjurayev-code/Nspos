// ══════════════════════════════════════════════════════════════
// PUL HISOBINI TEKSHIRISH — haqiqiy baza, ilovaning O'Z kodi bilan
// ══════════════════════════════════════════════════════════════
// Ishlatish:  npm run tekshir        (saytga chiqarishdan OLDIN majburiy)
//
// Nima qiladi: ilovaning modullarini (lib/*.js) haqiqiy baza qatorlari
// bilan to'ldiradi va ekrandagi raqamlarni chiqaradigan AYNAN o'sha
// funksiyalarni chaqiradi. Keyin ikki xil savolni beradi:
//
//   1. Sahifalararo moslik (lib/moslik.js) — bir xil ma'nodagi raqam
//      ikki sahifada teng chiqyaptimi. "Kirgan pul" kartochkasi
//      jadvalga, kassa kartochkasi kunlik jadvalga, bosilgan raqam
//      ochilgan ro'yxatga teng bo'lishi shart.
//   2. Ma'lumot xatosi (lib/audit.js) — minusdagi hamyon, ikkilangan
//      to'lov, kurssiz xarajat, kassaga tushmagan kirim.
//
// NEGA SHUNDAY YOZILGAN: ilgari bu skript formulalarni QAYTA yozardi.
// 2026-08-14 da shu sababli u "naqd 26 786.89 — hammasi joyida" deb
// turgan paytda ekranda 25 286.89 turgan edi: doimiy xarajat (ijara
// 1 500) skriptga kiritilmagan edi. Endi formula bitta joyda —
// ilovaning ichida, skript esa faqat CHAQIRADI.
//
// Yozish xavfi yo'q: modullar DEMO rejimda ishga tushadi (yuk.mjs),
// ya'ni insert/update/delete umuman bazaga bormaydi.
import { loadApp } from "./lib/yuk.mjs";
import { kodMuammolari } from "./lib/kod-tekshir.mjs";

const t0 = Date.now();
let report;
try {
  report = await loadApp();
} catch (e) {
  // Ma'lumot to'liq kelmasa tekshiruv umuman o'tkazilmaydi — yarim
  // ma'lumot ustida "hammasi buzilgan" degan soxta xato chiqadi.
  console.error(`\n❌ ${e.message}\n\n   Internet yoki Supabase javob bermayotgan bo'lishi mumkin. Qayta urining.\n`);
  process.exit(2);
}

const { getLedgerStart, getUsdRate } = await import("../lib/companyData.js");
const { KASSAS, WALLET_IDS, WALLETS, kassaIds, kassaBalances, moneyFlow } = await import("../lib/kassaData.js");
const moslik = await import("../lib/moslik.js");
const { moneyWarnings } = await import("../lib/audit.js");

const usd = (v) => `${(+v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;

// —— Holat ————————————————————————————————————
const start = getLedgerStart();
const bugun = new Date();
const bal = kassaBalances(bugun);
const wallet = (w) => +kassaIds().reduce((s, k) => s + (bal[k]?.[w] ?? 0), 0).toFixed(2);
const jami = +WALLET_IDS.reduce((s, w) => s + wallet(w), 0).toFixed(2);
const flow = moneyFlow(new Date(start + "T00:00:00"), bugun);

const yuklama = report.filter((r) => r.table === "datasets")[0];
console.log(`\nHisob boshi: ${start} · kurs ${Number(getUsdRate() ?? 0).toLocaleString("ru-RU")} so'm`);
console.log(`Baza: ${report.reduce((s, r) => s + (r.rows ?? 0), 0)} qator` +
  (yuklama?.qator ? ` · yuklamalarda ${yuklama.qator} qator` : "") +
  ` · ${((Date.now() - t0) / 1000).toFixed(1)} s\n`);

console.log(`Kirim ${usd(flow.in)} − chiqim ${usd(flow.out)} = ${usd(flow.net)}`);
console.log(`Hamyonlar: ${WALLET_IDS.map((w) => `${WALLETS[w]} ${usd(wallet(w))}`).join(" · ")}`);
console.log(`Jami kassalarda: ${usd(jami)}`);
for (const k of kassaIds()) {
  console.log(`   ${(KASSAS[k]?.label ?? k).padEnd(26)} ${usd(bal[k].total).padStart(13)}` +
    (bal[k].pending ? `  (yo'lda ${usd(bal[k].pending)})` : ""));
}
console.log("");

// —— Tekshiruvlar ————————————————————————————————
let xato = 0, ogoh = 0;

function chiqar(sarlavha, groups) {
  console.log(sarlavha);
  for (const g of groups) {
    const bad = g.problems.filter((p) => p.level === "error");
    const warn = g.problems.filter((p) => p.level !== "error");
    xato += bad.length;
    ogoh += warn.length;
    const belgi = bad.length ? "✗ XATO" : warn.length ? "⚠" : "✓";
    console.log(`${belgi.padEnd(7)} ${g.name}`);
    for (const p of g.problems) {
      console.log(`        ${p.level === "error" ? "•" : "·"} ${p.title}`);
      if (p.detail) console.log(`          ${p.detail}`);
    }
  }
  console.log("");
}

// Kod tuzilishi. Bu raqamda ham, ma'lumotda ham ko'rinmaydi — faqat
// brauzerda ochilib qoladi, shuning uchun alohida tekshiriladi.
chiqar("── Kod tuzilishi ────────────────────────────────", [{
  name: "Maxfiy ma'lumot brauzer to'plamiga tushmaydi",
  problems: kodMuammolari().map((m) => ({ level: "error", title: m.text, detail: m.hint })),
}]);

chiqar("── Sahifalararo moslik ──────────────────────────", moslik.runChecks());

// Ma'lumot xatolari: rahbar ko'radigan to'liq ro'yxat. Ular audit.js da
// bitta funksiyada yig'ilgan, shuning uchun turi bo'yicha guruhlaymiz.
const warnings = moneyWarnings({ role: "owner" });
const byKind = new Map();
for (const w of warnings) {
  const kind = String(w.id).split("-")[0];
  byKind.set(kind, [...(byKind.get(kind) ?? []), w]);
}
const KINDS = {
  rate: "Valyuta kursi qo'yilgan",
  neg: "Hech bir hamyon manfiy emas",
  unclosed: "Yopilmagan kun yo'q",
  unlinked: "Har to'langan reja kassa yozuviga bog'langan",
  dup: "Ikkilangan kassa chiqimi yo'q",
  dubl: "Usta puli ikki marta hisoblanmagan",
  nostaff: "Har oylik to'lovi xodimga bog'langan",
  nostore: "Kassaga tushmay qolgan kirim yo'q",
};
chiqar("── Ma'lumot xatolari ────────────────────────────",
  Object.entries(KINDS).map(([k, name]) => ({ name, problems: byKind.get(k) ?? [] })));

// audit.js ga yangi tur qo'shilsa u yuqoridagi ro'yxatga tushmasligi
// mumkin — jimgina yo'qolib ketmasin.
const boshqa = warnings.filter((w) => !KINDS[String(w.id).split("-")[0]]);
if (boshqa.length) chiqar("── Boshqa ogohlantirishlar ──────────────────────",
  [{ name: "Ro'yxatga kiritilmagan tekshiruvlar", problems: boshqa }]);

console.log(xato === 0
  ? `✅ Hammasi joyida — raqamlar bir-biriga to'g'ri keladi.${ogoh ? ` (${ogoh} ta ogohlantirish)` : ""}\n`
  : `❌ ${xato} ta nomuvofiqlik topildi — saytga chiqarishdan oldin tuzatilsin.\n`);
process.exit(xato === 0 ? 0 : 1);
