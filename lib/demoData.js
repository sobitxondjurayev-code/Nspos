// DEMO rejim uchun ma'lumotlar — Supabase ulanmaguncha ishlatiladi.
export const demoStores = [
  // `code` — barqaror kalit: bazadagi `stores.code` bilan bog'lanadi (storesData)
  { id: "s1", code: "s1", name: "NScamera Optim", kind: "shop", color: "#6b8afd" },
  { id: "s2", code: "s2", name: "NScamera Namangan", kind: "shop", color: "#b03be0" },
  { id: "s3", code: "s3", name: "Sklad", kind: "warehouse", color: "#f0a53a" },
];

// 01.07 - 19.07 oralig'idagi kunlik sotuvlar (USD)
export const demoDailySales = [
  { date: "01.07", s1: 3780, s2: 0, s3: 0 },
  { date: "02.07", s1: 3900, s2: 0, s3: 0 },
  { date: "03.07", s1: 3350, s2: 0, s3: 0 },
  { date: "04.07", s1: 2850, s2: 0, s3: 0 },
  { date: "05.07", s1: 4600, s2: 0, s3: 0 },
  { date: "06.07", s1: 8200, s2: 0, s3: 0 },
  { date: "07.07", s1: 2400, s2: 200, s3: 0 },
  { date: "08.07", s1: 3100, s2: 3720, s3: 0 },
  { date: "09.07", s1: 4900, s2: 2100, s3: 0 },
  { date: "10.07", s1: 1876.55, s2: 2945.77, s3: 0 },
  { date: "11.07", s1: 2150, s2: 2050, s3: 0 },
  { date: "12.07", s1: 2000, s2: 1500, s3: 0 },
  { date: "13.07", s1: 2600, s2: 1300, s3: 0 },
  { date: "14.07", s1: 2350, s2: 2500, s3: 0 },
  { date: "15.07", s1: 2450, s2: 2550, s3: 0 },
  { date: "16.07", s1: 3400, s2: 1900, s3: 0 },
  { date: "17.07", s1: 3550, s2: 2050, s3: 0 },
  { date: "18.07", s1: 2900, s2: 2100, s3: 0 },
  { date: "19.07", s1: 4400, s2: 700, s3: 0 },
];

export const demoUser = {
  name: "Sobitxon K.",
  company: "NScamera",
  role: "Egasi",
  initials: "SK",
};

export function storeTotals() {
  const totals = { s1: 0, s2: 0, s3: 0 };
  for (const d of demoDailySales) {
    totals.s1 += d.s1; totals.s2 += d.s2; totals.s3 += d.s3;
  }
  return totals;
}

// Pul formatlash `lib/format.js` ga ko'chdi. Bu yerda faqat yo'naltirish
// qoladi — 408 ta chaqiruvni birdan o'zgartirmaslik uchun.
//
// Eski ta'rif himoyasiz edi va bu ekranda ko'rinardi:
//   fmtUSD(null)      -> TypeError, butun sahifa xato ekraniga tushardi
//   fmtUSD(NaN)       -> "не число USD"  (ruscha matn)
//   fmtUSD({})        -> "[object Object] USD"
//   fmtUSD("abc")     -> "abc USD"
// To'g'ri qiymatlarda natija AYNAN bir xil qoladi ("1 234.50 USD"),
// faqat manfiy sonda tipografik minus ishlatiladi (− o'rniga -).
export { pul as fmtUSD } from "./format";
