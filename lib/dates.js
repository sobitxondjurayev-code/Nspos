"use client";
// Sana yordamchilari — davr tablari va sana tanlagich uchun umumiy.

export const MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];
// Hafta dushanbadan boshlanadi
export const WEEKDAYS = ["Du", "Se", "Cho", "Pa", "Ju", "Sha", "Yak"];

export const PERIODS = ["Kecha", "Bugun", "Hafta", "Oy", "Yil"];

const pad = (n) => String(n).padStart(2, "0");

// Har qanday sanani "YYYY-MM-DD" ga keltiradi. Yuklamalardagi sana matn
// bo'lgani uchun taqqoslash matnli ketadi, davr tanlagichi esa Date
// qaytaradi: Date'ni String() qilib kesish "Sat Aug 01" beradi va
// taqqoslash buziladi (jadval bo'sh, tushum 0 bo'lib qoladi).
export function ymd(v) {
  if (v == null) return null;
  if (v instanceof Date) {
    return isNaN(v) ? null : `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }
  const s = String(v).trim();
  const dot = s.match(/^(\d{2})\.(\d{2})\.(\d{4})/);   // 01.08.2026
  if (dot) return `${dot[3]}-${dot[2]}-${dot[1]}`;
  return s.slice(0, 10);
}

export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// Dushanbadan boshlanadigan hafta boshi
export function startOfWeek(d) {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // Yakshanba(0) -> 6
  return addDays(x, -dow);
}

export const startOfMonth = (d) => startOfDay(new Date(d.getFullYear(), d.getMonth(), 1));
export const startOfYear = (d) => startOfDay(new Date(d.getFullYear(), 0, 1));

// Davr nomidan sana oralig'i. Billz'dagi kabi: joriy hafta/oy/yil bugun bilan tugaydi.
export function periodRange(period, now = new Date()) {
  switch (period) {
    case "Kecha": {
      const y = addDays(now, -1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case "Hafta":
      return { from: startOfWeek(now), to: endOfDay(now) };
    case "Oy":
      return { from: startOfMonth(now), to: endOfDay(now) };
    case "Yil":
      return { from: startOfYear(now), to: endOfDay(now) };
    case "Bugun":
    default:
      return { from: startOfDay(now), to: endOfDay(now) };
  }
}

export const fmtDate = (d) =>
  `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;

export const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Oy uchun kalendar katakchalari (oldingi/keyingi oy kunlari bilan to'ldirilgan)
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // dushanbadan
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, 1 - lead + i);
    cells.push({ date: d, outside: d.getMonth() !== month });
  }
  return cells;
}
