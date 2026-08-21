"use client";
// ══════════════════════════════════════════════════════════════
// GRAFIK RANGLARI
// ══════════════════════════════════════════════════════════════
// `lib/themes.js` dagi `chartColors()` — bu grafikning CHIROYI uchun
// (to'r, o'q belgilari, nuqta chegarasi). Bu fayl esa boshqa savolga
// javob beradi: **seriyalar qaysi rangda bo'ladi.**
//
// Nega alohida palitra kerak bo'ldi (2026-08-21 da hisoblab ko'rildi):
// temadagi `brand`/`ok`/`warn`/`danger` ni seriya rangi qilib ishlatish
// IKKI sababdan yaramaydi.
//
// 1. Ular bir-biridan farq qilmaydi. Tekshiruvchi natijasi:
//
//      #ef4444 (danger) ↔ #d97706 (warn)
//      ΔE 4.4  deuteranopiyada   → amalda bir xil rang
//      ΔE 11.8 oddiy ko'zda      → 15 chegarasidan past
//
//    Ya'ni qizil va sariq ustunni oddiy odam ham ajrata olmaydi.
//
// 2. Ular MA'NO tashiydi. `danger` — "xato", `ok` — "yaxshi". Uchinchi
//    do'konni qizil qilib qo'ysak, ekran "bu do'konda muammo bor" deb
//    turadi, holbuki u shunchaki uchinchi.
//
// Shuning uchun IKKI xil rang ishlatiladi va ular ARALASHTIRILMAYDI:
//
//   SERIYA  — do'kon, xodim, tovar, kategoriya (kim/nima). Quyidagi
//             palitra, HAR DOIM bir xil tartibda.
//   HOLAT   — foyda/zarar, kam/ko'p, tugagan/yetarli. `ok`/`warn`/
//             `danger` tokenlari.
//
// Palitra `dataviz` tekshiruvchisidan o'tgan — yorug' rejimda ham,
// qorong'ida ham beshta tekshiruv (yorqinlik diapazoni, rang
// to'yinganligi, rang ko'rmaslikda ajralish, oddiy ko'zda ajralish,
// fon bilan kontrast):
//
//   node scripts/validate_palette.js "#2563eb,#ea580c,#059669,#7c3aed,#0891b2" --mode light
//   node scripts/validate_palette.js "#2563eb,#ea580c,#059669,#7c3aed,#0891b2" --mode dark
//
// Ikkalasida ham: ALL CHECKS PASS.
export const SERIES = [
  "#2563eb",   // ko'k    — birinchi seriya (brand bilan bir xil oila)
  "#ea580c",   // to'q sariq
  "#059669",   // yashil
  "#7c3aed",   // binafsha
  "#0891b2",   // moviy
];

// —— Rang SHAXSGA bog'lanadi, o'ringa emas ————————————
// Filtr bir seriyani olib tashlaganda qolganlar rangini O'ZGARTIRMASIN.
// Aks holda "Optim ko'k edi" deb o'rgangan odam adashadi.
//
// Shuning uchun rang ID bo'yicha beriladi: bir xil ID — har doim bir
// xil rang, ro'yxatda nechanchi turishidan qat'i nazar.
export function seriesColor(id, tartib) {
  if (Array.isArray(tartib)) {
    const i = tartib.indexOf(id);
    if (i >= 0) return SERIES[i % SERIES.length];
  }
  // Tartib berilmasa — ID dan barqaror raqam (har safar bir xil)
  const s = String(id ?? "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return SERIES[h % SERIES.length];
}

// Ro'yxat uchun: { id → rang }. Tartib BIR MARTA belgilanadi va
// filtrdan qat'i nazar saqlanadi.
export const seriesMap = (ids) =>
  Object.fromEntries(ids.map((id, i) => [id, SERIES[i % SERIES.length]]));

// —— Nechta seriya ko'p ————————————————————————————
// Sakkizdan ortiq rang ajratib bo'lmaydi — yangi rang o'ylab topilmaydi,
// qolgani "Boshqalar" ga yig'iladi.
export const SERIES_MAX = SERIES.length;

export function foldSeries(rows, { id, value, max = SERIES_MAX, otherLabel = "Boshqalar" } = {}) {
  if (rows.length <= max) return rows;
  const tartib = [...rows].sort((a, b) => value(b) - value(a));
  const asosiy = tartib.slice(0, max - 1);
  const qolgan = tartib.slice(max - 1);
  return [...asosiy, {
    [id]: otherLabel,
    __other: true,
    __count: qolgan.length,
    ...(typeof value(qolgan[0]) === "number"
      ? { __value: qolgan.reduce((s, r) => s + value(r), 0) } : {}),
  }];
}
