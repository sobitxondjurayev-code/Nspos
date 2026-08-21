// ══════════════════════════════════════════════════════════════
// IMPORT QILINMAGAN NOMLAR
// ══════════════════════════════════════════════════════════════
//   npm run nomlar
//
// Faqat BITTA qoida: `no-undef`. Nega alohida tekshiruv kerak bo'ldi
// (2026-08-22):
//
// `components/AuthProvider.jsx` da `sessiyaOl()` chaqirilardi, lekin
// import qilinmagan edi (Supabase Auth'dan o'z tizimimizga o'tishda
// qolib ketgan). AuthProvider ildiz layoutida — ya'ni BUTUN SAYT
// brauzerda ochilmasdi: "ReferenceError: sessiyaOl is not defined".
//
// Buni HECH BIR mavjud tekshiruv ko'rmadi:
//   `next build`        — o'tdi (webpack import qilinmagan nomni
//                          global deb hisoblaydi, xato bermaydi)
//   `node --check`      — o'tdi (sintaksis to'g'ri)
//   `npm run tekshir`   — o'tdi (u ma'lumot qatlamini tekshiradi)
//   `curl` 200          — o'tdi (Next.js HTML qobiqni beradi;
//                          ishdan chiqish brauzerda, hidratsiyada)
//
// Birinchi ishga tushirishda YANA 8 ta shunday xato topildi:
// AbcReport da 4 ta import yo'q, kassaIncome da CASH_WORDS,
// pnl sahifasida boshqa komponentning o'zgaruvchisi.
const brauzer = {
  window: "readonly", document: "readonly", navigator: "readonly", location: "readonly",
  localStorage: "readonly", sessionStorage: "readonly", fetch: "readonly", console: "readonly",
  setTimeout: "readonly", clearTimeout: "readonly", setInterval: "readonly", clearInterval: "readonly",
  URL: "readonly", URLSearchParams: "readonly", Blob: "readonly", File: "readonly", FileReader: "readonly",
  FormData: "readonly", Headers: "readonly", Request: "readonly", Response: "readonly",
  WebSocket: "readonly", crypto: "readonly", btoa: "readonly", atob: "readonly", alert: "readonly",
  confirm: "readonly", prompt: "readonly", requestAnimationFrame: "readonly", queueMicrotask: "readonly",
  matchMedia: "readonly", Image: "readonly", Event: "readonly", CustomEvent: "readonly",
  AbortController: "readonly", TextEncoder: "readonly", TextDecoder: "readonly", structuredClone: "readonly",
  performance: "readonly", history: "readonly", HTMLElement: "readonly", Node: "readonly",
  indexedDB: "readonly", IDBKeyRange: "readonly",
  process: "readonly", Buffer: "readonly", global: "readonly", __dirname: "readonly",
  React: "readonly",
};
export default [
  {
    files: ["**/*.js", "**/*.jsx"],
    languageOptions: {
      ecmaVersion: 2022, sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: brauzer,
    },
    rules: { "no-undef": "error" },
  },
];
