// ══════════════════════════════════════════════════════════════
// KOD TEKSHIRUVI — raqam emas, KODNING O'ZI
// ══════════════════════════════════════════════════════════════
// `moslik.js` raqamlarni, `audit.js` ma'lumotni tekshiradi. Lekin
// ba'zi xato raqamda ham, ma'lumotda ham ko'rinmaydi — u kodning
// tuzilishida bo'ladi va faqat brauzerda ochilib qoladi.
//
// Birinchi shunday tekshiruv: `lib/billzExport.js` (2 MB, 6 792 ta
// haqiqiy telefon raqami) ilova kodidan import qilinmasin. Import
// qilinsa u brauzer to'plamiga tushadi va RLS uni to'xtata olmaydi —
// ma'lumot bazadan emas, kodning ichidan keladi.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ILDIZ = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");

function* fayllar(dir) {
  for (const nom of readdirSync(dir)) {
    if (nom === "node_modules" || nom === ".next" || nom === ".git" || nom === ".tmp") continue;
    const yol = join(dir, nom);
    if (statSync(yol).isDirectory()) yield* fayllar(yol);
    else if (/\.(js|jsx|mjs)$/.test(nom)) yield yol;
  }
}

// { fayl: taqiqlangan modul, sabab: nega, faqat: qaysi papkalarda }
const TAQIQ = [
  {
    modul: "billzExport",
    papkalar: ["lib", "app", "components"],
    ozi: "lib/billzExport.js",
    sabab: "2 MB, 6 792 ta haqiqiy telefon raqami — import qilinsa brauzer to'plamiga tushadi va RLS uni to'xtata olmaydi",
  },
];

export function kodMuammolari() {
  const chiqdi = [];
  for (const t of TAQIQ) {
    const uchragan = [];
    for (const papka of t.papkalar) {
      for (const yol of fayllar(join(ILDIZ, papka))) {
        const nisbiy = relative(ILDIZ, yol);
        if (nisbiy === t.ozi) continue;
        const matn = readFileSync(yol, "utf8");
        const re = new RegExp(`(?:from|import)\\s*\\(?\\s*["'][^"']*${t.modul}["']`);
        if (re.test(matn)) uchragan.push(nisbiy);
      }
    }
    if (uchragan.length) {
      chiqdi.push({
        id: `kod-${t.modul}`,
        text: `${uchragan.length} ta fayl \`${t.ozi}\` ni import qilyapti`,
        hint: `${uchragan.join(", ")} — ${t.sabab}. Ma'lumotni bazadan o'qing.`,
      });
    }
  }
  return chiqdi;
}
