// ══════════════════════════════════════════════════════════════
// KIRGAN HOLATDA BRAUZER TEKSHIRUVI
// ══════════════════════════════════════════════════════════════
//   node scripts/server/brauzer-kirgan.mjs [manzil]
//
// `brauzer-tekshir.sh` sahifalarni KIRMASDAN ochadi — u ildiz
// layoutidagi xatoni tutadi (aynan shunday xato 2026-08-22 da butun
// saytni o'ldirgan edi), lekin kirgandan keyin chiziladigan
// komponentning ichki xatosini KO'RMAYDI: hamma sahifa /login ga
// yo'naltiriladi va bir xil rasm chiqadi.
//
// Bu skript Chrome'ni DevTools protokoli orqali boshqaradi:
// sessiya cookie'sini QO'YADI, sahifani ochadi, konsoldagi har
// istisnoni yig'adi va skrinshot oladi.
//
// Token serverdagi `JWT_SECRET` bilan shu yerda imzolanadi — ya'ni
// haqiqiy parol kerak emas va hech qayerga yozilmaydi.
import { createHmac } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MANZIL = process.argv[2] ?? "http://169.58.216.246";
const SERVER = process.env.NSPOS_SERVER ?? "root@169.58.216.246";
const KALIT = process.env.NSPOS_KEY ?? `${process.env.HOME}/.ssh/nspos`;
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;

// `NSPOS_YOLLAR` berilsa faqat o'shalar tekshiriladi (vergul bilan) —
// bitta sahifani tez ko'rish uchun.
const YOLLAR = process.env.NSPOS_YOLLAR ? process.env.NSPOS_YOLLAR.split(",") : [
  "/dashboard", "/finance/pnl", "/finance/kassa", "/finance/debts", "/finance/expenses",
  "/finance/balance", "/finance/payroll", "/finance/plan", "/products", "/clients",
  "/sales", "/services", "/kpi", "/installers", "/nps", "/management", "/settings",
  "/reports", "/reports/product_profit", "/reports/stock_health", "/reports/rfm", "/reports/ar_aging",
];

const b64 = (s) => Buffer.from(s).toString("base64url");
const kut = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Server sirini va rahbar id'sini olamiz ────────────────────
function serverdan(buyruq) {
  return execFileSync("ssh", ["-i", KALIT, "-o", "BatchMode=yes", SERVER, buyruq], {
    encoding: "utf8", timeout: 30000,
  }).trim();
}

const sir = serverdan("grep -h '^JWT_SECRET=' /opt/nspos/app/.env* 2>/dev/null | head -1 | cut -d= -f2-")
  .replace(/^["']|["']$/g, "");
if (!sir) { console.error("   ✗ JWT_SECRET topilmadi"); process.exit(1); }

const rahbarId = serverdan(
  `sudo -u postgres psql -d nspos -Atc "select id from profiles where role='owner' limit 1" 2>/dev/null`
).split("\n").pop().trim();
if (!/^[0-9a-f-]{36}$/.test(rahbarId)) {
  console.error("   ✗ rahbar profili topilmadi:", rahbarId); process.exit(1);
}

// Token ilovaning O'Z formatida (lib/jwt.js) imzolanadi
const hozir = Math.floor(Date.now() / 1000);
const head = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
const body = b64(JSON.stringify({
  sub: rahbarId, role: "nspos_app", aud: "authenticated",
  iat: hozir, exp: hozir + 3600,
}));
const token = `${head}.${body}.${b64(createHmac("sha256", sir).update(`${head}.${body}`).digest())}`;

// ── Chrome ─────────────────────────────────────────────────────
const profil = mkdtempSync(join(tmpdir(), "nspos-cdp-"));
const chrome = spawn(CHROME, [
  "--headless", "--disable-gpu", "--no-sandbox", "--no-first-run",
  "--no-default-browser-check", "--disable-extensions",
  `--user-data-dir=${profil}`, "--window-size=1400,1000",
  `--remote-debugging-port=${PORT}`, "about:blank",
], { stdio: "ignore" });

const tozala = () => { try { chrome.kill("SIGKILL"); } catch {} rmSync(profil, { recursive: true, force: true }); };
process.on("exit", tozala);
process.on("SIGINT", () => { tozala(); process.exit(130); });

// Chrome ko'tarilishini kutamiz
let ws = null;
for (let i = 0; i < 60 && !ws; i++) {
  await kut(500);
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    ws = (await r.json()).webSocketDebuggerUrl;
  } catch {}
}
if (!ws) { console.error("   ✗ Chrome ko'tarilmadi"); process.exit(1); }

// ── Minimal CDP mijozi ────────────────────────────────────────
const soket = new WebSocket(ws);
await new Promise((ok, xato) => { soket.onopen = ok; soket.onerror = xato; });

let raqam = 0;
const kutilmoqda = new Map();
const hodisalar = [];
soket.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && kutilmoqda.has(m.id)) {
    const { ok, xato } = kutilmoqda.get(m.id);
    kutilmoqda.delete(m.id);
    m.error ? xato(new Error(m.error.message)) : ok(m.result);
  } else if (m.method) hodisalar.push(m);
};
const yubor = (method, params = {}, sessionId) =>
  new Promise((ok, xato) => {
    const id = ++raqam;
    kutilmoqda.set(id, { ok, xato });
    soket.send(JSON.stringify({ id, method, params, sessionId }));
  });

// Sahifa (tab) ochamiz va unga ulanamiz
const { targetId } = await yubor("Target.createTarget", { url: "about:blank" });
const { sessionId } = await yubor("Target.attachToTarget", { targetId, flatten: true });

await yubor("Page.enable", {}, sessionId);
await yubor("Runtime.enable", {}, sessionId);
await yubor("Log.enable", {}, sessionId);
await yubor("Network.enable", {}, sessionId);

// Sessiya cookie'si. `lib/jwt.js` dagi COOKIE nomi.
const host = new URL(MANZIL).hostname;
await yubor("Network.setCookie", {
  name: "nspos_token", value: token, domain: host, path: "/", sameSite: "Strict",
}, sessionId);

const SHOVQIN = /Cross-Origin-Opener-Policy|fonts\.googleapis|Password field|Autofill|favicon|DevTools/i;

let xato = 0;
for (const yol of YOLLAR) {
  hodisalar.length = 0;
  try {
    await yubor("Page.navigate", { url: MANZIL + yol }, sessionId);
  } catch (e) {
    console.log(`   ✗ ${yol.padEnd(28)} ochilmadi: ${e.message}`); xato++; continue;
  }
  // Kutish vaqti: og'ir jadvallar (9 032 chek, 34 489 qator) fonda
  // yuklanadi va bosh sahifa aynan o'shanga bog'liq. 4.5 soniya
  // yetmaydi — 8 soniya real o'lchov bo'yicha yetarli.
  await kut(Number(process.env.NSPOS_KUT ?? 8000));

  // Istisnolar: `Runtime.exceptionThrown` va konsoldagi xato darajasi
  // Muvaffaqiyatsiz so'rovlar — manzili bilan. "Failed to load
  // resource" degan umumiy xabardan foyda yo'q, qaysi so'rov
  // yiqilgani kerak.
  const sorovlar = hodisalar
    .filter((h) => h.method === "Network.responseReceived" && h.params?.response?.status >= 400)
    .map((h) => `${h.params.response.status} ${h.params.response.url.replace(MANZIL, "")}`);

  const muammolar = hodisalar
    .filter((h) => h.method === "Runtime.exceptionThrown" || (h.method === "Log.entryAdded" && h.params?.entry?.level === "error"))
    .map((h) => h.params?.exceptionDetails?.exception?.description ?? h.params?.exceptionDetails?.text ?? h.params?.entry?.text ?? "")
    .filter((s) => s && !SHOVQIN.test(s) && !/Failed to load resource/i.test(s));
  if (sorovlar.length) muammolar.unshift(...[...new Set(sorovlar)].slice(0, 3));

  // Chizildimi: sahifada matn bormi va "Application error" chiqmadimi
  const { result } = await yubor("Runtime.evaluate", {
    expression: "JSON.stringify({len: document.body.innerText.length, err: document.body.innerText.includes('Application error'), yol: location.pathname})",
    returnByValue: true,
  }, sessionId);
  const holat = JSON.parse(result.value);

  if (muammolar.length) {
    console.log(`   ✗ ${yol.padEnd(28)} ${muammolar[0].split("\n")[0].slice(0, 100)}`); xato++;
  } else if (holat.err) {
    console.log(`   ✗ ${yol.padEnd(28)} Application error`); xato++;
  } else if (holat.yol === "/login") {
    console.log(`   ✗ ${yol.padEnd(28)} /login ga yo'naltirildi — sessiya ishlamadi`); xato++;
  } else if (holat.len < 200) {
    console.log(`   ✗ ${yol.padEnd(28)} sahifa bo'sh (${holat.len} belgi)`); xato++;
  } else {
    console.log(`   ✓ ${yol.padEnd(28)} ${holat.len} belgi`);
  }
}

// Oxirgi sahifadan skrinshot — ko'z bilan ko'rish uchun
try {
  const { data } = await yubor("Page.captureScreenshot", { format: "png" }, sessionId);
  const yol = process.env.NSPOS_SHOT;
  if (yol) writeFileSync(yol, Buffer.from(data, "base64"));
} catch {}

soket.close();
if (xato) { console.log(`   ── ${xato} ta sahifa kirgan holatda ishdan chiqdi`); process.exit(1); }
console.log(`   ── ${YOLLAR.length} ta sahifa kirgan holatda chizildi`);
