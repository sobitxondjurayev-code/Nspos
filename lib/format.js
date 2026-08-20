"use client";
// ══════════════════════════════════════════════════════════════
// RAQAM, PUL VA SANA FORMATLASH — YAGONA JOY
// ══════════════════════════════════════════════════════════════
// Nega alohida fayl kerak bo'ldi (2026-08-21 da o'lchandi):
//
//   • Bitta summa uch xil ko'rinardi:
//       fmtUSD          -> "1 234.50 USD"
//       kpi dagi usd()  -> "1 234,5"   (vergul, tiyin yo'qoladi)
//       qo'lda toFixed  -> "1234.50 $" (minglik ajratilmagan)
//   • So'm formatlash 4 nusxada, sana formatlash 20 dan ortiq nusxada
//     takrorlangan edi.
//   • Eng jiddiyi: `fmtUSD` HIMOYASIZ edi —
//       fmtUSD(null) / fmtUSD(undefined)  -> TypeError, butun sahifa
//                                            xato ekraniga tushardi
//       fmtUSD(NaN)                       -> ekranda "не число USD"
//                                            (ruscha matn!)
//     Bu nazariy emas: P&L raqamini chaqirganda ekranga
//     "Tushum не число" chiqqani ko'rilgan.
//
// Qoida: ekranga chiqadigan har qanday raqam SHU YERDAN o'tadi.
// Yangi format kerak bo'lsa — shu faylga funksiya qo'shiladi, sahifada
// `toLocaleString` yozilmaydi.

// —— Xavfsiz songa keltirish ————————————————————————
// null, undefined, "", NaN, obyekt, Infinity — hammasi 0 ga tushadi.
// Sabab: noto'g'ri raqam ko'rsatgandan ko'ra nol ko'rsatgan yaxshiroq,
// lekin ikkalasidan ham yaxshisi — sahifani yiqitmaslik.
export const raqam = (n) => {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : 0;
};

// Minus belgisi: loyihada ikki xil ishlatilgan edi — ASCII "-" (fmtUSD
// ichidan) va U+2212 "−" (qo'lda qo'yilgan). Endi hamma joyda tipografik
// minus: u raqam bilan bir balandlikda turadi va tire bilan chalkashmaydi.
const MINUS = "−";
const belgi = (v, matn) => (v < 0 ? MINUS + matn : matn);

// Ming ajratgichi — uzluksiz bo'shliq (U+00A0). Oddiy bo'sh joy bo'lsa
// raqam qator oxirida "1 234" bo'lib ikkiga bo'linib ketadi.
const guruh = (v, kasr = 2) =>
  Math.abs(v).toLocaleString("ru-RU", {
    minimumFractionDigits: kasr,
    maximumFractionDigits: kasr,
  }).replace(",", ".");   // ru-RU kasrni vergul bilan beradi, bizda nuqta

// —— Pul ————————————————————————————————————————
// `pul(1234.5)`        -> "1 234.50 USD"
// `pul(1234.5, {qisqa: true})` -> "1 234.50"   (ustun ichida, sarlavhada
//                                               valyuta bir marta yozilsa)
export function pul(n, { qisqa = false, valyuta = "USD" } = {}) {
  const v = raqam(n);
  const s = guruh(v, 2);
  return belgi(v, qisqa ? s : `${s} ${valyuta}`);
}

// —— So'm ————————————————————————————————————————
// So'mda tiyin yuritilmaydi — yaxlitlanadi.
// `somda(11880000)` -> "11 880 000 so'm"
export function somda(n, { qisqa = false } = {}) {
  const v = Math.round(raqam(n));
  const s = Math.abs(v).toLocaleString("ru-RU");
  return belgi(v, qisqa ? s : `${s} so'm`);
}

// —— Oddiy son (dona, soni) ————————————————————————
// `son(1956)`      -> "1 956"
// `son(1.5, 1)`    -> "1.5"
export function son(n, kasr = 0) {
  const v = raqam(n);
  return belgi(v, guruh(v, kasr));
}

// —— Foiz ————————————————————————————————————————
// Aniqlik BIR joyda belgilanadi. Ilgari `.toFixed(1)`, `Math.round()`
// va `.toFixed(0)` aralash ishlatilardi.
// `foiz(31.44)` -> "31.4%"
export function foiz(n, kasr = 1) {
  const v = raqam(n);
  return belgi(v, `${guruh(v, kasr)}%`);
}

// —— Sana ————————————————————————————————————————
// Date, ISO satr va "YYYY-MM-DD" — uchalasi ham qabul qilinadi.
// Ilgari har sahifa o'z `fmtDay`/`fmtWhen` ini yozardi (20 dan ortiq
// nusxa) va ba'zilari faqat Date, ba'zilari faqat satr olardi.
// `sana("2026-08-21")` -> "21.08.2026"
export function sana(d) {
  const t = d instanceof Date ? d : new Date(String(d ?? ""));
  if (Number.isNaN(t.getTime())) return "—";
  const p = (x) => String(x).padStart(2, "0");
  return `${p(t.getDate())}.${p(t.getMonth() + 1)}.${t.getFullYear()}`;
}

// Sana va vaqt: "21.08.2026 14:30"
export function sanaVaqt(d) {
  const t = d instanceof Date ? d : new Date(String(d ?? ""));
  if (Number.isNaN(t.getTime())) return "—";
  const p = (x) => String(x).padStart(2, "0");
  return `${sana(t)} ${p(t.getHours())}:${p(t.getMinutes())}`;
}
