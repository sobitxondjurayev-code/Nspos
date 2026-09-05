// ══════════════════════════════════════════════════════════════
// QAYSI BILLZ KALITI BILAN ISHLAYAPMIZ VA U NIMANI OCHADI
// ══════════════════════════════════════════════════════════════
//   node --import ./scripts/lib/register.mjs scripts/billz-kalit.mjs
//   node --import ./scripts/lib/register.mjs scripts/billz-kalit.mjs --kalit=2
//   BILLZ_KALIT=<token> node --import ./scripts/lib/register.mjs scripts/billz-kalit.mjs
//
// NEGA KERAK. Billz'da ikkita faol integratsiya kaliti bor ("Dashboard"
// 19.08.2026 va "tizim.enes.uz" 24.08.2026), tizim esa bittasi bilan
// ishlaydi — QAYSI BIRI ekani hech qayerda yozilmagan edi. Bu muhim,
// chunki DAFTAR 20.5 (4) dagi "spisanie va kassa smenasi 403" xulosasi
// aynan kalitning roliga bog'liq: o'lchov boshqa kalit bilan qilingan
// bo'lsa, xulosa noto'g'ri kalitga tegishli bo'ladi va rahbardan
// bekorga ish so'ralayotgan bo'ladi.
//
// XAVFSIZLIK. Token — na maxfiy kalit, na Billz qaytargan JWT — ekranga
// CHIQMAYDI. Faqat sha256 ning dastlabki 8 belgisi ("barmoq izi")
// chiqadi: u ikki kalitni va lokal ↔ server sozlamasini solishtirishga
// yetadi, lekin kalitni tiklab bo'lmaydi.
//
// Billz'ga hech narsa YOZILMAYDI: faqat login va GET so'rovlar.
import { readFileSync } from "fs";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
import path from "path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Sozlama fayli: kompyuterda `.env.local`, serverda `.env.production`.
// DIQQAT: nom qolipida RAQAM ham bor (`[A-Z0-9_]`). Boshqa skriptlarda
// u `[A-Z_]` — o'sha qolip `BILLZ_KALIT_2` ni JIMGINA o'tkazib yuboradi
// va "kalit topilmadi" degan chalg'ituvchi xato beradi.
for (const nom of [".env.local", ".env.production"]) {
  let matn;
  try { matn = readFileSync(path.join(root, nom), "utf8"); } catch { continue; }
  for (const qator of matn.split("\n")) {
    const m = qator.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[2]) process.env[m[1]] ??= m[2];
  }
}

// —— Qaysi kalit sinaladi ————————————————————————————
const arg = process.argv.find((a) => a.startsWith("--kalit="))?.split("=")[1];
const manba =
  process.env.BILLZ_KALIT            ? ["buyruqdagi kalit (BILLZ_KALIT)", process.env.BILLZ_KALIT]
  : arg                              ? [`.env dagi BILLZ_KALIT_${arg}`, process.env[`BILLZ_KALIT_${arg}`]]
  :                                    [".env dagi BILLZ_SECRET_TOKEN", process.env.BILLZ_SECRET_TOKEN];

if (!manba[1]) {
  console.error(`Kalit topilmadi: ${manba[0]}`);
  process.exit(1);
}

const izi = (s) => createHash("sha256").update(s).digest("hex").slice(0, 8);

// `lib/billzApi.js` maxfiy kalitni MODUL YUKLANGANDA bir marta o'qiydi
// (`const SECRET = process.env.BILLZ_SECRET_TOKEN`). Shuning uchun kalit
// import'dan OLDIN qo'yiladi — bitta yurishda bitta kalit sinaladi.
process.env.BILLZ_SECRET_TOKEN = manba[1];
const { getToken, billzGet, probe } = await import("../lib/billzApi.js");

console.log("");
console.log(`Kalit manbai : ${manba[0]}`);
console.log(`Barmoq izi   : ${izi(manba[1])}   (sha256, dastlabki 8 belgi)`);
console.log(`Uzunligi     : ${manba[1].length} belgi`);
console.log("");

// —— 1. Kalit KIM sifatida kiradi ————————————————————
// Billz JWT'sining ichidagi da'volar kalitni nomi bilan aytadi.
// Token o'zi chiqmaydi — faqat ochilgan da'volar, ular ham sirni
// eslatadigan kalitlardan tozalanadi.
let dava = {};
try {
  const jwt = await getToken(true);
  dava = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
} catch (e) {
  console.error(`✗ Login bo'lmadi: ${String(e.message).slice(0, 200)}`);
  process.exit(1);
}

console.log("── Billz kimni ko'ryapti (JWT da'volari)");
for (const [k, v] of Object.entries(dava)) {
  if (/token|secret|password|signature/i.test(k)) continue;
  const q = typeof v === "object" ? JSON.stringify(v) : String(v);
  console.log(`   ${k.padEnd(18)} ${q.slice(0, 120)}`);
}
console.log("");

// —— 2. Kalit KIM sifatida kirdi ————————————————————
// Billz har integratsiya kaliti uchun `<nom> api` degan soxta xodim
// yaratadi. JWT dagi `user_id` shu ro'yxatdagi qaysi qatorga tushsa —
// kalit nomi o'sha. Nomni taxmin qilmaymiz: id bo'yicha topamiz.
const meningIdim = dava.user_id ?? dava.id ?? dava.sub ?? null;
try {
  const b = await billzGet("/v1/user", { limit: 100, page: 1 });
  const users = b.users ?? [];
  const men = users.find((u) => u.id === meningIdim);
  console.log(`── Kalit KIM: ${men ? `${men.first_name} ${men.last_name}`.trim() : "(xodimlar ro'yxatidan topilmadi)"}`);
  for (const u of users) {
    const nom = [u.first_name, u.last_name].filter(Boolean).join(" ") || "(nomsiz)";
    const rol = (u.roles ?? []).map((r) => r?.role?.name ?? r?.name ?? "?").join(", ") || "—";
    const dokon = (u.shops ?? []).map((s) => s?.shop?.name).filter(Boolean).join(", ") || "—";
    const belgi = u.id === meningIdim ? "→" : " ";
    console.log(`   ${belgi} ${nom.padEnd(22)} rol: ${rol.padEnd(18)} do'kon: ${dokon}`);
  }
  // Rol nomi (`Ключ "…"`) bu ro'yxatda KELMAYDI — API xodimlarida
  // `roles: null`. Ya'ni "kalitga qanday huquq berilgan" savoliga
  // faqat quyidagi jadval (nima ochiq) javob beradi.
} catch (e) {
  console.log(`── Kalit xodimlari: o'qib bo'lmadi (${String(e.message).slice(0, 80)})`);
}
console.log("");

// —— 3. Nima ochiq ————————————————————————————————
// `probe()` ilovaning O'ZI ishlatadigan funksiya (Sozlamalar tashxisi va
// `/api/billz/sync?probe=1`) — ya'ni bu yerdagi natija ekrandagi tashxis
// bilan bir xil bo'lishi shart.
console.log("── Qaysi metod ochiq");
const natija = await probe();
for (const [nom, h] of Object.entries(natija)) {
  const holat = h.ok ? (h.empty ? "BO'SH " : "OCHIQ ") : (h.forbidden ? "403   " : "XATO  ");
  const izoh = h.ok ? `count=${h.count}` : String(h.error ?? "").slice(0, 90);
  console.log(`   ${holat} ${nom.padEnd(26)} ${izoh}`);
}
console.log("");

// Xulosa: aynan ochiq band (DAFTAR 20.5 №4) bo'yicha bir qatorli javob.
const muhim = ["write-off (spisanie)", "cash-shifts (smena)", "supplier-orders (xarid)"];
const ochiq = muhim.filter((k) => natija[k]?.ok);
console.log(ochiq.length
  ? `XULOSA: bu kalitda OCHIQ → ${ochiq.join(", ")}`
  : "XULOSA: spisanie ham, kassa smenasi ham bu kalitga berilmagan (403).");
console.log("");
