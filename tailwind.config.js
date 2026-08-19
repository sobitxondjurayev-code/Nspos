/** @type {import('tailwindcss').Config} */
// Ranglar CSS o'zgaruvchilaridan olinadi (globals.css dagi :root va .dark).
// Shu sababli komponentlarda `dark:` variantlarini yozish shart emas —
// bitta klass ikkala rejimda ham to'g'ri ishlaydi.
const v = (name) => `rgb(var(${name}) / <alpha-value>)`;

module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: v("--c-brand"),
          soft: v("--c-brand-soft"),
          dark: v("--c-brand-dark"),
        },
        ink: v("--c-ink"),
        muted: v("--c-muted"),
        line: v("--c-line"),
        surface: v("--c-surface"),
        panel: v("--c-panel"),      // kartalar, modallar, sidebar foni
        track: v("--c-track"),      // tab konteyneri
        track2: v("--c-track2"),    // tumbler o'chiq holati
        faint: v("--c-faint"),      // juda och matn (kalendar tashqi kunlari)
        overlay: v("--c-overlay"),  // modal orqa foni
        ok: { DEFAULT: v("--c-ok"), soft: v("--c-ok-soft") },
        warn: { DEFAULT: v("--c-warn"), soft: v("--c-warn-soft") },
        danger: { DEFAULT: v("--c-danger"), soft: v("--c-danger-soft") },
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        pop: "var(--shadow-pop)",
      },
    },
  },
  plugins: [],
};
