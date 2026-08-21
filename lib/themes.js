"use client";
// Tema palitralari. Ranglar CSS o'zgaruvchilari sifatida <html> ga yoziladi,
// shuning uchun butun interfeys hech qanday qo'shimcha kodsiz o'zgaradi.
// Qiymatlar "R G B" ko'rinishida (Tailwind rgb(var(--x) / alpha) uchun).

export const MODES = [
  { key: "light", label: "Yorug'" },
  { key: "dark", label: "Qorong'i" },
  { key: "system", label: "Tizim bo'yicha" },
];

// —— Qorong'i rejim palitralari ————————————————————————
export const DARK_PRESETS = {
  // Billz'ning o'zidagi kabi neytral kulrang — ko'kish tus yo'q
  grey: {
    label: "Billz kulrang",
    swatch: ["#181818", "#262626", "#3d3d3d"],
    vars: {
      "--c-ink": "235 235 235",
      "--c-muted": "154 154 154",
      "--c-line": "56 56 56",
      "--c-surface": "24 24 24",
      "--c-panel": "38 38 38",
      "--c-track": "48 48 48",
      "--c-track2": "68 68 68",
      "--c-faint": "94 94 94",
      "--c-overlay": "0 0 0",
      "--c-ok": "61 194 134",
      "--c-ok-soft": "26 51 40",
      "--c-warn": "240 180 70",
      "--c-warn-soft": "56 45 22",
      "--c-danger": "255 107 107",
      "--c-danger-soft": "58 32 32",
      "--chart-grid": "#303030",
      "--chart-tick": "#9a9a9a",
      "--chart-dot-stroke": "#262626",
    },
  },
  // Ko'kish-navy (avvalgi variant)
  navy: {
    label: "Tungi ko'k",
    swatch: ["#0d111b", "#161c29", "#2b3446"],
    vars: {
      "--c-ink": "226 232 240",
      "--c-muted": "138 152 172",
      "--c-line": "39 48 66",
      "--c-surface": "13 17 27",
      "--c-panel": "22 28 41",
      "--c-track": "30 37 52",
      "--c-track2": "51 61 80",
      "--c-faint": "71 84 105",
      "--c-overlay": "2 4 10",
      "--c-ok": "52 199 145",
      "--c-ok-soft": "20 45 38",
      "--c-warn": "245 178 66",
      "--c-warn-soft": "51 40 18",
      "--c-danger": "248 113 113",
      "--c-danger-soft": "56 26 28",
      "--chart-grid": "#232c3d",
      "--chart-tick": "#8a98ac",
      "--chart-dot-stroke": "#161c29",
    },
  },
  // OLED ekranlar uchun to'q qora
  black: {
    label: "Qora (OLED)",
    swatch: ["#000000", "#141414", "#333333"],
    vars: {
      "--c-ink": "240 240 240",
      "--c-muted": "150 150 150",
      "--c-line": "42 42 42",
      "--c-surface": "0 0 0",
      "--c-panel": "20 20 20",
      "--c-track": "32 32 32",
      "--c-track2": "56 56 56",
      "--c-faint": "84 84 84",
      "--c-overlay": "0 0 0",
      "--c-ok": "61 194 134",
      "--c-ok-soft": "18 40 30",
      "--c-warn": "240 180 70",
      "--c-warn-soft": "46 36 16",
      "--c-danger": "255 107 107",
      "--c-danger-soft": "48 26 26",
      "--chart-grid": "#242424",
      "--chart-tick": "#969696",
      "--chart-dot-stroke": "#141414",
    },
  },
};

// —— Asosiy rang ————————————————————————————————
// Har rang uchun yorug' va qorong'i rejimga alohida qiymat:
// qora fonda rang yorqinroq bo'lishi kerak, aks holda o'qilmaydi.
// Faqat ko'k rang — boshqa ranglar olib tashlangan
export const ACCENTS = {
  blue: {
    label: "Ko'k", hex: "#2f80ff",
    light: { "--c-brand": "37 99 235", "--c-brand-soft": "239 244 255", "--c-brand-dark": "29 78 216" },
    dark: { "--c-brand": "47 128 255", "--c-brand-soft": "27 43 68", "--c-brand-dark": "96 160 255" },
  },
};

export const DEFAULTS = { mode: "system", darkPreset: "grey", accent: "blue" };

const LIGHT_CHART = { grid: "#eef2f7", tick: "#64748b", dot: "#ffffff" };

// HOLAT ranglari grafik uchun. `globals.css` dagi `--c-ok`/`--c-warn`/
// `--c-danger` bilan bir xil qiymatlar — Recharts CSS o'zgaruvchisini
// tushunmaydi, unga tayyor hex kerak.
//
// Ilgari grafiklarda "#22c55e", "#ef4444", "#f59e0b" QOTIRIB yozilgan
// edi. Ular yorug' temaning taxminiy nusxasi bo'lib, qorong'i rejimda
// fonga singib ketardi va tema almashganda o'zgarmasdi.
//
// DIQQAT: bular SERIYA rangi emas. Seriya (do'kon, xodim, tovar) uchun
// `lib/chartColors.js` dagi palitra ishlatiladi. Bu yerdagilar faqat
// MA'NO tashiganda: foyda/zarar, kirim/chiqim, kam/ko'p.
const STATUS_LIGHT = { ok: "#059669", warn: "#d97706", danger: "#ef4444" };
const STATUS_DARK = { ok: "#3dc286", warn: "#f0b446", danger: "#ff6b6b" };

// Grafik ranglari DOM'dan emas, to'g'ridan-to'g'ri sozlamadan hisoblanadi —
// aks holda CSS o'zgaruvchilari yozilishidan oldin o'qib, bir qadam orqada qolardi.
export function chartColors({ resolved, darkPreset, accent }) {
  const acc = ACCENTS[accent] ?? ACCENTS.blue;
  const brand = `rgb(${(resolved === "dark" ? acc.dark : acc.light)["--c-brand"]})`;
  if (resolved !== "dark") return { ...LIGHT_CHART, ...STATUS_LIGHT, brand };

  const p = DARK_PRESETS[darkPreset] ?? DARK_PRESETS.grey;
  return {
    grid: p.vars["--chart-grid"],
    tick: p.vars["--chart-tick"],
    dot: p.vars["--chart-dot-stroke"],
    ...STATUS_DARK,
    brand,
  };
}

// Barcha boshqariladigan o'zgaruvchilar — rejim almashganda tozalash uchun
export const ALL_VARS = [
  ...new Set([
    ...Object.values(DARK_PRESETS).flatMap((p) => Object.keys(p.vars)),
    ...Object.values(ACCENTS).flatMap((a) => [...Object.keys(a.light), ...Object.keys(a.dark)]),
  ]),
];

// Tanlangan sozlamaga qarab <html> ga inline o'zgaruvchilarni yozadi.
// Yorug' rejimda qorong'i palitra o'zgaruvchilari olib tashlanadi —
// shunda globals.css dagi :root qiymatlari qayta kuchga kiradi.
export function applyTheme({ resolved, darkPreset, accent }) {
  const el = document.documentElement;
  for (const v of ALL_VARS) el.style.removeProperty(v);

  if (resolved === "dark") {
    const preset = DARK_PRESETS[darkPreset] ?? DARK_PRESETS.grey;
    for (const [k, v] of Object.entries(preset.vars)) el.style.setProperty(k, v);
  }

  const acc = ACCENTS[accent] ?? ACCENTS.blue;
  for (const [k, v] of Object.entries(resolved === "dark" ? acc.dark : acc.light)) {
    el.style.setProperty(k, v);
  }

  el.classList.toggle("dark", resolved === "dark");
}
