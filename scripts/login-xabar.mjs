// ══════════════════════════════════════════════════════════════
// HAR XODIMGA ALOHIDA TELEGRAM XABARI — login va parol bilan
// ══════════════════════════════════════════════════════════════
// Ishlatish:
//   node scripts/login-xabar.mjs                 # bugungi sana
//   node scripts/login-xabar.mjs --sana=2026-09-02
//
// NEGA (2026-09-02): rahbar parollarni o'zi tarqatadi — Telegram'da har
// xodimga alohida xabar nusxalab tashlaydi. `login-kochir.mjs` yozgan
// `.tmp/loginlar-<sana>.md` jadval; Telegram'ga jadval tushmaydi, har
// odamga o'z qatori kerak. Bu skript o'sha parollardan (JSON) va VPS'dagi
// hozirgi login/ismdan bitta faylga 17 ta tayyor xabar yozadi.
//
// Eski bazaga BORMAYDI (CLI kerak emas). VPS'dan faqat o'qiydi.
// Chiqish `.tmp/` da — repoga tushmaydi, fayl ruxsati 600.
import { execFileSync } from "child_process";
import { readFileSync, writeFileSync, existsSync, chmodSync } from "fs";

const SERVER = process.env.NSPOS_SERVER ?? "root@169.58.216.246";
const KALIT = process.env.NSPOS_KEY ?? `${process.env.HOME}/.ssh/nspos`;
const BAZA = "nspos";
const MANZIL = "https://tizim.enes.uz";
const arg = (nom, standart) => {
  const p = process.argv.find((a) => a.startsWith(`--${nom}=`));
  return p ? p.slice(nom.length + 3) : standart;
};
const SANA = arg("sana", new Date().toLocaleDateString("sv-SE"));
const PAROL_FAYL = `.tmp/loginlar-${SANA}.json`;
const CHIQISH = `.tmp/xabarlar-${SANA}.md`;

if (!existsSync(PAROL_FAYL)) {
  console.error(`Parol fayli yo'q: ${PAROL_FAYL} — avval login-kochir.mjs yurgiziladi.`);
  process.exit(1);
}
const parollar = JSON.parse(readFileSync(PAROL_FAYL, "utf8"));

// VPS'dan hozirgi login (email) va ism — `login-kochir.mjs` dagi usul
function vps(sql) {
  const ichki = sql.trim().replace(/;\s*$/, "");
  const out = execFileSync("ssh", ["-i", KALIT, "-o", "ConnectTimeout=20", SERVER,
    `sudo -u postgres psql -tAX -v ON_ERROR_STOP=1 -d ${BAZA} -f -`],
    { encoding: "utf8", input: `select coalesce(json_agg(t), '[]'::json) from (${ichki}) t;`,
      stdio: ["pipe", "pipe", "pipe"] });
  return JSON.parse(out);
}
const hisoblar = vps(`
  select u.id, u.email, p.full_name, p.role
  from auth.users u join profiles p on p.id = u.id
  where u.deleted_at is null and p.is_active`);

const tartib = { owner: 0, manager: 1, installer: 2 };
const royxat = hisoblar
  .filter((h) => parollar[h.id])
  .sort((a, b) => (tartib[a.role] ?? 9) - (tartib[b.role] ?? 9) || a.full_name.localeCompare(b.full_name));
const parolsiz = hisoblar.filter((h) => !parollar[h.id]).map((h) => h.full_name);

// Login: telefon bo'lsa faqat raqamlar, ism bo'lsa ism (`lib/loginId.js` ikkalasini tushunadi)
const loginOf = (email) => email.replace(/@.*$/, "");
const ismOf = (s) => s.replace(/\s*\(.*\)\s*$/, "").trim();   // "Akramjon (retention menejer)" → "Akramjon"

const xabar = (h) => `Assalomu alaykum, ${ismOf(h.full_name)}!
Bugundan dastur yangi manzilda: ${MANZIL}
Eski manzil (nspos.vercel.app) yopildi — unga kirib bo'lmaydi.

Login: ${loginOf(h.email)}${/^\d+$/.test(loginOf(h.email)) ? "   (telefon raqamingiz, faqat raqamlar)" : ""}
Parol: ${parollar[h.id]}

Kirgach parolni o'zingiz o'zgartirib oling:
Sozlamalar → "Parolni yangilash" (kamida 6 belgi).

Iltimos:
1) yangi manzilni zakladkaga qo'ying, eskisini o'chiring;
2) Chrome eski parolni eslab qolgan bo'lsa o'chiring:
   Sozlamalar → Parollar → nspos.vercel.app;
3) kirib, bugungi kassa yoki xarajatni kiriting.
Kira olmasangiz — menga yozing.`;

const matn = `# Telegram xabarlari — ${SANA} (${royxat.length} ta, har biri alohida nusxalanadi)
# Bu fayl repoga tushmaydi. Xabarni "---" dan "---" gacha belgilab, Telegram'ga tashlang.

${royxat.map((h) => `--- ${h.full_name} · ${h.role} ---\n${xabar(h)}\n`).join("\n")}`;

writeFileSync(CHIQISH, matn);
chmodSync(CHIQISH, 0o600);

// Tekshiruv: har xabarda login VPS'dagi email bilan, parol JSON bilan mos
const mos = royxat.filter((h) => matn.includes(`Login: ${loginOf(h.email)}`) && matn.includes(`Parol: ${parollar[h.id]}`)).length;
console.log(`  ${royxat.length} ta xabar yozildi: ${CHIQISH}`);
console.log(`  login/parol mosligi: ${mos}/${royxat.length}`);
if (parolsiz.length) console.log(`  ⚠ JSON'da paroli yo'q (xabar yozilmadi): ${parolsiz.join(", ")}`);
if (mos !== royxat.length) { console.error("❌ mos kelmadi"); process.exit(1); }
