// ══════════════════════════════════════════════════════════════
// NSPOS TELEGRAM BOTI — faqat o'qish
// ══════════════════════════════════════════════════════════════
//   node scripts/bot/bot.mjs
//   (serverda: systemd `nspos-bot`, `scripts/server/11-bot.sh`)
//
// Kim uchun: rahbar telefondan turib "bugun qancha tushdi" deb
// so'raydi va saytga kirmasdan javob oladi.
//
// ── NIMA QILA OLMAYDI ──
// Bazaga ulanmaydi, hech narsa yozmaydi, o'chirmaydi. Butun ish —
// `/api/v1` dan GET qilib, javobni matnga o'girish. Xavfsizlik uch
// qavatli: API faqat GET qabul qiladi · API roli faqat SELECT ·
// botda baza paroli yo'q.
//
// ── KIM GAPLASHA OLADI ──
// Faqat `TELEGRAM_RUXSAT` dagi chat raqamlari. Sabab: API tokeni
// rahbarning O'QISH huquqi — u bilan butun moliya ko'rinadi
// (`scripts/server/07-api.sh` dagi ogohlantirish). Begona odam
// botga yozsa, javob emas, jurnalga qator tushadi.
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { telegram } from "./telegram.mjs";
import { nsposApi } from "./api.mjs";
import * as F from "./format.mjs";

// ── Sozlamalar ─────────────────────────────────────────────────
// Serverda systemd `EnvironmentFile` orqali beradi; kompyuterda
// sinash uchun `.env.local` dan o'qiladi (`yuk.mjs` bilan bir xil
// yo'l — ikki xil qoida bo'lmasin).
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
for (const nom of [".env.local", ".env.production"]) {
  let matn;
  try { matn = readFileSync(path.join(root, nom), "utf8"); } catch { continue; }
  for (const line of matn.split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m) process.env[m[1]] ??= m[2];
  }
}

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_URL = process.env.NSPOS_API_URL ?? "http://127.0.0.1:3002";
const API_TOKEN = process.env.NSPOS_API_TOKEN ?? "";
// Ruxsat ro'yxati bo'lmasa zaxira uchun ishlatiladigan chat olinadi —
// u rahbarning o'zi.
const RUXSAT = new Set((process.env.TELEGRAM_RUXSAT ?? process.env.TELEGRAM_CHAT_ID ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean));

if (!TOKEN) { console.error("TELEGRAM_BOT_TOKEN yo'q"); process.exit(1); }
if (!API_TOKEN) { console.error("NSPOS_API_TOKEN yo'q"); process.exit(1); }
if (!RUXSAT.size) { console.error("TELEGRAM_RUXSAT (yoki TELEGRAM_CHAT_ID) yo'q"); process.exit(1); }

const bot = telegram(TOKEN);
const ol = nsposApi(API_URL, API_TOKEN);
const uxla = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Davr ───────────────────────────────────────────────────────
// Sana Toshkent vaqtida hisoblanadi, serverning vaqt mintaqasidan
// qat'i nazar: server UTC da tursa "bugun" kechqurun soat 5 dan
// keyin bir kun orqaga surilib qolardi.
const TZ = "Asia/Tashkent";
const bugunISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
// Kun qo'shish soat 12:00 UTC dan qilinadi — yarim tun atrofidagi
// siljish qatorni bir kun narigi tomonga o'tkazib yubormasin.
const surish = (kun, n) => {
  const d = new Date(`${kun}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const SANA = /^\d{4}-\d{2}-\d{2}$/;
function davr(sozlar) {
  const b = bugunISO();
  const s = (sozlar[0] ?? "").toLowerCase();
  if (SANA.test(s)) return { dan: s, gacha: SANA.test(sozlar[1] ?? "") ? sozlar[1] : s };
  if (!s || s === "oy") return { dan: `${b.slice(0, 7)}-01`, gacha: b };
  if (s === "bugun") return { dan: b, gacha: b };
  if (s === "kecha") { const k = surish(b, -1); return { dan: k, gacha: k }; }
  if (s === "hafta") return { dan: surish(b, -6), gacha: b };
  return null;
}

// ── Buyruqlar ──────────────────────────────────────────────────
// Har buyruq API'ning bitta yo'liga to'g'ri keladi. Yangi yo'l
// qo'shilsa shu ro'yxatga bitta qator qo'shiladi.
const KESIMLAR = ["tovar", "kategoriya", "brend", "dokon"];

async function bajar(buyruq, sozlar) {
  switch (buyruq) {
    case "/start":
    case "/yordam":
    case "/help":
      return F.YORDAM;

    case "/xulosa":
      return F.xulosa(await ol("/api/v1/xulosa"));

    case "/savdo": {
      const d = davr(sozlar);
      if (!d) return "Davrni tushunmadim.\n\n/savdo bugun · kecha · hafta · oy\n/savdo 2026-08-01 2026-08-23";
      return F.savdo(await ol("/api/v1/savdo", d));
    }

    case "/kassa":
      return F.kassa(await ol("/api/v1/kassa"));

    case "/qarz":
      return F.qarz(await ol("/api/v1/qarz"));

    case "/tovar": {
      const kesim = (sozlar[0] ?? "tovar").toLowerCase();
      if (!KESIMLAR.includes(kesim)) return `Kesim: ${KESIMLAR.join(" · ")}\n\nMasalan: /tovar kategoriya`;
      const d = davr(sozlar.slice(1));
      return F.tovarFoyda(await ol("/api/v1/tovar-foyda", { ...(d ?? {}), kesim }));
    }

    case "/qoldiq":
      return F.qoldiq(await ol("/api/v1/qoldiq"));

    case "/mijoz":
      return F.mijoz(await ol("/api/v1/mijoz"));

    case "/ogohlantirish":
      return F.ogohlantirish(await ol("/api/v1/ogohlantirish"));

    // API ma'lumotni 5 daqiqa keshlaydi. Bu buyruq keshni bekor
    // qilib, bazadan qaytadan o'qitadi (`?yangila=1`).
    case "/yangila": {
      const t0 = Date.now();
      const d = await ol("/api/v1/xulosa", { yangila: 1 });
      return `Ma'lumot qaytadan o'qildi (${((Date.now() - t0) / 1000).toFixed(1)} s).\n\n${F.xulosa(d)}`;
    }

    default:
      return null;
  }
}

// ── Bitta xabar ────────────────────────────────────────────────
// Ruxsatsiz chatga javob BIR MARTA yoziladi: har xabarga javob
// qaytarsak, bot begona odam bilan cheksiz yozishib ketishi mumkin.
const ogohlantirilgan = new Set();

async function xabarniIshla(m) {
  const matn = m?.text?.trim();
  if (!matn) return;
  const chatId = String(m.chat?.id ?? "");

  if (!RUXSAT.has(chatId)) {
    console.warn(`[ruxsatsiz] chat=${chatId} @${m.from?.username ?? "?"} — ${matn.slice(0, 60)}`);
    if (!ogohlantirilgan.has(chatId)) {
      ogohlantirilgan.add(chatId);
      await bot.yubor(chatId, "Bu bot yopiq.").catch(() => {});
    }
    return;
  }

  const [xom, ...sozlar] = matn.split(/\s+/);
  // Guruhda buyruq "/xulosa@BotNomi" bo'lib keladi
  const buyruq = xom.toLowerCase().split("@")[0];

  if (!buyruq.startsWith("/")) {
    await bot.yubor(chatId, `Buyruq bilan so'rang.\n\n${F.YORDAM}`);
    return;
  }

  await bot.yozmoqda(chatId).catch(() => {});
  const t0 = Date.now();
  let javob;
  try {
    javob = await bajar(buyruq, sozlar);
  } catch (e) {
    console.error(`[xato] ${buyruq}: ${e.message}`);
    // Xatoni yashirmaymiz: rahbar "javob kelmadi" bilan "raqam
    // noto'g'ri" ni farqlay olishi kerak.
    await bot.yubor(chatId, `Ma'lumot olinmadi.\n${e.message}\n\nBir ozdan keyin qayta urinib ko'ring.`);
    return;
  }
  if (javob === null) {
    await bot.yubor(chatId, `Bunday buyruq yo'q.\n\n${F.YORDAM}`);
    return;
  }
  console.log(`[${chatId}] ${buyruq} — ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await bot.yubor(chatId, javob);
}

// ── Asosiy sikl ────────────────────────────────────────────────
const me = await bot.getMe();
// Webhook qachondir qo'yilgan bo'lsa `getUpdates` 409 beradi va bot
// birorta xabar ololmaydi — shuning uchun har ishga tushishda
// o'chiriladi.
await bot.webhookOchir();

// Turib qolgan xabarlar TASHLANADI. Telegram javobsiz xabarni 24
// soat saqlaydi: busiz server bir kun o'chib tursa, yoqilgan zahoti
// bot kechagi savollarga birdaniga javob yozib tashlardi.
let ofset = 0;
const oxirgi = await bot.yangiliklar(-1, 0).catch(() => []);
if (oxirgi.length) ofset = oxirgi[oxirgi.length - 1].update_id + 1;

console.log(`@${me.username} ishga tushdi · API ${API_URL} · ruxsat: ${[...RUXSAT].join(", ")}`);

let ketmaKetXato = 0;
for (;;) {
  try {
    const yangi = await bot.yangiliklar(ofset, 25);
    ketmaKetXato = 0;
    for (const u of yangi) {
      ofset = u.update_id + 1;   // xato bo'lsa ham oldinga siljiydi
      try {
        await xabarniIshla(u.message);
      } catch (e) {
        // Bitta xabardagi xato butun siklni to'xtatmasligi kerak
        console.error(`[xabar ${u.update_id}] ${e.message}`);
      }
    }
  } catch (e) {
    // Tarmoq uzilishi yoki Telegram cheklovi. Kutish asta oshadi,
    // lekin bir daqiqadan oshmaydi — aks holda tarmoq tuzalganda
    // bot uzoq vaqt "uxlab" qolardi.
    ketmaKetXato++;
    const kut = Math.min(60, 2 ** Math.min(ketmaKetXato, 6));
    console.error(`[sikl] ${e.message} — ${kut} s dan keyin qayta urinaman`);
    await uxla(kut * 1000);
  }
}
