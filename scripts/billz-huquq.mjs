// ══════════════════════════════════════════════════════════════
// BILLZ KABINETINI O'LCHASH — HUQUQ, ROL VA HAQIQIY METODLAR
// ══════════════════════════════════════════════════════════════
//   BILLZ_UI_TEL=93… BILLZ_UI_PAROL=… node scripts/billz-huquq.mjs
//     · standart          — Dashboard kalitining roli va butun huquq daraxti
//     · --kuzat           — kabinet O'ZI qaysi manzilga borishini yozib oladi
//                           (BILLZ_KUZAT_YOL=/products/write-off,… )
//     · --kirish-yoli     — kirish qaysi metod orqali ketganini ko'rsatadi
//     · --tuzilish        — bitta qatorning HTML'ini chiqaradi
//     · BILLZ_SORA=/api/… — kabinet sessiyasi bilan GET (javob to'liq)
//     · BILLZ_SHAKL=/api/…— o'sha, lekin faqat MAYDON NOMLARI (qiymat emas)
//     · --korinmas        — brauzer ko'rinmasin
//
// NEGA YOZILGAN. Tizim spisanie va kassa smenasini ololmaydi: 403.
// Ilgari sabab "kalit roliga huquq berilmagan" deb hisoblangan
// (DAFTAR 20.5 №4). 2026-09-06 da shu skript bilan o'lchandi va
// XULOSA NOTO'G'RI ekani chiqdi: rol katakchalari integratsiya
// kalitiga UMUMAN ta'sir qilmaydi (DAFTAR 24). Ya'ni bu vosita
// "huquq beruvchi" emas — O'LCHOV asbobi.
//
// HECH NARSA BOSILMAYDI VA O'ZGARTIRILMAYDI. Faqat kiradi, o'qiydi,
// skrinshot oladi. Yozadigan rejim ATAYLAB yo'q: begona tizimda
// taxmin bilan katakcha bosish — qilinadigan eng yomon ish, va
// o'lchov ko'rsatdiki bu baribir yordam bermaydi.
//
// Naqsh: `scripts/server/brauzer-kirgan.mjs` — Chrome + xom CDP,
// yangi bog'liqliksiz (loyihada playwright/puppeteer yo'q).
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const KORINMAS = process.argv.includes("--korinmas");
const ASOS = process.env.BILLZ_UI_ASOS ?? "https://nskamera.billz.io";
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = Number(process.env.BILLZ_UI_PORT ?? 9334);
const SHOTLAR = join(root, ".tmp", "billz-huquq");

// Kirish ma'lumotlari: env yoki `.env.local`. Ekranga CHIQMAYDI.
let TEL = process.env.BILLZ_UI_TEL;
let PAROL = process.env.BILLZ_UI_PAROL;
if (!TEL || !PAROL) {
  try {
    for (const q of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
      const m = q.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m?.[1] === "BILLZ_UI_TEL") TEL ??= m[2];
      if (m?.[1] === "BILLZ_UI_PAROL") PAROL ??= m[2];
    }
  } catch {}
}
if (!TEL || !PAROL) {
  console.error("BILLZ_UI_TEL va BILLZ_UI_PAROL kerak (env yoki .env.local)");
  process.exit(1);
}

const kut = (ms) => new Promise((r) => setTimeout(r, ms));
const ayt = (s) => console.log(s);

// ── Chrome ────────────────────────────────────────────────────
mkdirSync(SHOTLAR, { recursive: true });
const profil = mkdtempSync(join(tmpdir(), "billz-cdp-"));
const chrome = spawn(CHROME, [
  ...(KORINMAS ? ["--headless", "--disable-gpu"] : []),
  "--no-sandbox", "--no-first-run", "--no-default-browser-check",
  "--disable-extensions", `--user-data-dir=${profil}`,
  "--window-size=1500,1100", `--remote-debugging-port=${PORT}`, "about:blank",
], { stdio: "ignore" });

// Chrome o'chishi bilan bir vaqtda profil papkasiga yozayotgan
// bo'lishi mumkin — o'shanda `rmSync` ENOTEMPTY beradi va SKRIPT
// tugagandan KEYIN xato ko'rsatadi (ish bajarilgan bo'lsa ham
// "yiqildi" bo'lib ko'rinadi). Tozalash — yordamchi ish, u
// natijani buzmasligi kerak.
const tozala = () => {
  try { chrome.kill("SIGKILL"); } catch {}
  try { rmSync(profil, { recursive: true, force: true }); } catch {}
};
process.on("exit", tozala);
process.on("SIGINT", () => { tozala(); process.exit(130); });

let ws = null;
for (let i = 0; i < 60 && !ws; i++) {
  await kut(500);
  try { ws = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; } catch {}
}
if (!ws) { console.error("✗ Chrome ko'tarilmadi"); process.exit(1); }

// ── Minimal CDP mijozi ────────────────────────────────────────
// Har buyruq MUDDAT bilan: javobsiz qolgan bitta buyruq butun ishni
// abadiy osib qo'yadi (brauzer-kirgan.mjs, 2026-08-23 tajribasi).
const soket = new WebSocket(ws);
await new Promise((ok, xato) => { soket.onopen = ok; soket.onerror = xato; });
let raqam = 0;
let sessionId;                 // sahifaga ulangach to'ladi
const kutilmoqda = new Map();
const hodisalar = [];
soket.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.method) hodisalar.push(m);
  if (m.id && kutilmoqda.has(m.id)) {
    const { ok, xato } = kutilmoqda.get(m.id);
    kutilmoqda.delete(m.id);
    m.error ? xato(new Error(m.error.message)) : ok(m.result);
  }
};
const yubor = (method, params = {}, kutish = 60_000) =>
  new Promise((ok, xato) => {
    const id = ++raqam;
    const soat = setTimeout(() => { kutilmoqda.delete(id); xato(new Error(`${method}: javob kelmadi`)); }, kutish);
    kutilmoqda.set(id, { ok: (v) => { clearTimeout(soat); ok(v); }, xato: (e) => { clearTimeout(soat); xato(e); } });
    soket.send(JSON.stringify({ id, method, params, sessionId }));
  });

// `sessionId` hali bo'sh — bu ikki buyruq BRAUZER darajasida ketadi.
const { targetId } = await yubor("Target.createTarget", { url: "about:blank" });
({ sessionId } = await yubor("Target.attachToTarget", { targetId, flatten: true }));
await yubor("Page.enable");
await yubor("Runtime.enable");
await yubor("Network.enable");

// ── Yordamchilar ──────────────────────────────────────────────
const bahola = async (ifoda) => {
  const r = await yubor("Runtime.evaluate", { expression: ifoda, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.slice(0, 200) ?? "evaluate xatosi");
  return r.result.value;
};
const och = async (yol) => { await yubor("Page.navigate", { url: yol.startsWith("http") ? yol : ASOS + yol }); await kut(2500); };
// Shart bajarilguncha kutamiz. Sobit `sleep` emas: SMS kod yoki sekin
// tarmoq bo'lsa ham ish davom etsin, lekin abadiy osilib qolmasin.
const kutgin = async (ifoda, soniya = 30, nima = "shart") => {
  for (let i = 0; i < soniya * 2; i++) {
    try { if (await bahola(ifoda)) return true; } catch {}
    await kut(500);
  }
  throw new Error(`${soniya} s ichida bajarilmadi: ${nima}`);
};
const shot = async (nom) => {
  try {
    const { data } = await yubor("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(SHOTLAR, `${nom}.png`), Buffer.from(data, "base64"));
    ayt(`   · skrinshot: .tmp/billz-huquq/${nom}.png`);
  } catch (e) { ayt(`   · skrinshot olinmadi: ${e.message}`); }
};

// React nazorat qiladigan input: oddiy `value = …` E'TIBORGA OLINMAYDI,
// chunki React o'z holatini o'zgarmagan deb biladi. Shuning uchun
// prototipdagi haqiqiy setter chaqiriladi va hodisa qo'lda yuboriladi.
const yozIfoda = (topish, qiymat) => `(() => {
  const el = ${topish};
  if (!el) return false;
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  set.call(el, ${JSON.stringify(qiymat)});
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
})()`;

// ── 1. Kirish ─────────────────────────────────────────────────
ayt("── Kirish");
await och("/login");
await kutgin(`!!document.querySelector('input[type=password]')`, 30, "login formasi");

await bahola(yozIfoda(`document.querySelector('input[type=password]')`, PAROL));
await bahola(yozIfoda(
  `[...document.querySelectorAll('input')].find(i => i.type !== 'password' && i.type !== 'hidden')`, TEL));
await kut(500);
// Tugma matni tilga qarab o'zgaradi: vaqtinchalik profil EN bilan
// ochiladi ("Sign in"), rahbarning brauzerida RU ("Вход в аккаунт").
// Shuning uchun uchala til ham qamrab olinadi — aks holda skript
// tugmani topmay `form.requestSubmit()` ga tushardi va JIMGINA
// login sahifasida qolardi (birinchi urinishda aynan shunday bo'ldi).
const bosildi = await bahola(`(() => {
  const t = [...document.querySelectorAll('button')]
    .find(b => /Вход|Войти|Kirish|Sign\\s*in|Log\\s*in/i.test(b.textContent));
  if (t) { t.click(); return "tugma: " + t.textContent.trim().slice(0, 30); }
  const f = document.querySelector('form'); if (f) { f.requestSubmit?.(); return "forma submit"; }
  return "";
})()`);
ayt(`   · ${bosildi || "tugma TOPILMADI"}`);

// Kirish tugagunini kutamiz. 120 s — SMS kod so'ralsa rahbar
// ko'rinib turgan oynada o'zi kiritsin va ish davom etsin.
try {
  await kutgin(`!location.pathname.includes('/login')`, 120, "kirish");
  ayt(`   ✓ kirdi: ${await bahola("location.pathname")}`);
} catch (e) {
  await shot("01-login-otmadi");
  // Sabab ko'rinsin: sahifadagi matn (xato xabari, SMS so'rovi…)
  const matn = await bahola(`document.body.innerText.replace(/\\s+/g, " ").slice(0, 400)`).catch(() => "");
  ayt(`   ✗ ${e.message}`);
  ayt(`   · sahifada: ${matn}`);
  process.exit(1);
}

// Kirish qaysi metod orqali ketganini ko'rsatamiz (parol EMAS —
// faqat metod, manzil va javob kodi). Kerak: integratsiya kaliti
// yopiq bo'lgan metodlarni foydalanuvchi sessiyasi bilan olish
// mumkinmi degan savolga javob shu yerdan boshlanadi.
if (process.argv.includes("--kirish-yoli")) {
  const chiq = new Map();
  for (const h of hodisalar) {
    if (h.method === "Network.requestWillBeSent" && /\/api\//.test(h.params.request.url))
      chiq.set(h.params.requestId, `${h.params.request.method} ${h.params.request.url.replace(/^https?:\/\/[^/]+/, "")}`);
    if (h.method === "Network.responseReceived" && chiq.has(h.params.requestId))
      chiq.set(h.params.requestId, `${h.params.response.status} ${chiq.get(h.params.requestId)}`);
  }
  console.log("── KIRISH PAYTIDAGI SO'ROVLAR ──");
  for (const v of new Set(chiq.values())) console.log(`   ${v.slice(0, 140)}`);
}

// ── 2. Dashboard kalitining ROLI qayerda ──────────────────────
// Rol id TAXMIN QILINMAYDI: integratsiya kalitlari sahifasidagi
// "Dashboard" qatoridan rol havolasi olinadi.
ayt("── Integratsiya kalitlari");
await och("/settings/company/integration-keys");
await kutgin(`document.body.innerText.includes('Dashboard')`, 30, "kalitlar ro'yxati");
await shot("02-kalitlar");

const qatorlar = await bahola(`(() => {
  const out = [];
  for (const tr of document.querySelectorAll('tr')) {
    const t = tr.innerText.replace(/\\s+/g, ' ').trim();
    if (!t) continue;
    out.push({ matn: t.slice(0, 120), havola: [...tr.querySelectorAll('a')].map(a => a.getAttribute('href')) });
  }
  return out;
})()`);
console.log(JSON.stringify(qatorlar, null, 1));

const dashboard = qatorlar.find((q) => /^Dashboard\b/.test(q.matn));
const rolYol = dashboard?.havola?.find((h) => h && h.includes("/roles/"));
if (!rolYol) {
  console.error("✗ Dashboard kalitining rol havolasi topilmadi");
  process.exit(1);
}
ayt(`   ✓ Dashboard kaliti → xodim ${dashboard.havola[0]?.split("/").pop()}`);
ayt(`   ✓ roli: ${rolYol}`);

// ── 3c. SHAKL: yopiq metodlar ichida NIMA borligini o'lchash ──
// Faqat MAYDON NOMLARI va son chiqadi, QIYMAT emas — mijoz va pul
// ma'lumoti terminalga tushmasin (`billz-probe-xarid.mjs` qoidasi).
if (process.env.BILLZ_SHAKL) {
  await och("/dashboard");
  await kut(4000);
  for (const yol of process.env.BILLZ_SHAKL.split(",").filter(Boolean)) {
    const ifoda = "(async () => { try {" +
      " const r = await fetch(" + JSON.stringify(yol) + ", { credentials: 'include' });" +
      " const b = await r.json();" +
      " const royxat = Array.isArray(b) ? b : Object.values(b).find(v => Array.isArray(v));" +
      " return { holat: r.status, kalitlar: Object.keys(b || {}), soni: b && b.count, royxatSoni: royxat && royxat.length," +
      " birinchi: royxat && royxat[0] ? Object.keys(royxat[0]) : null," +
      " ichkiRoyxat: royxat && royxat[0] ? Object.entries(royxat[0]).filter(([, v]) => Array.isArray(v) && v[0] && typeof v[0] === 'object').map(([k, v]) => k + ': [' + Object.keys(v[0]).join(', ') + ']') : null };" +
      " } catch (e) { return { xato: String(e.message) }; } })()";
    const j = await bahola(ifoda);
    console.log("── " + yol);
    console.log(JSON.stringify(j, null, 1));
  }
  soket.close();
  process.exit(0);
}

// ── 3b. SO'ROV: kabinet sessiyasi bilan Billz API'sidan o'qish ──
// Faqat GET va faqat o'z domenida (sessiya cookie/token bilan). Nega
// kerak: katakchaning ko'rinishi bilan Billz'ning HAQIQATDA nima deb
// bilishi boshqa narsa bo'lishi mumkin. `/api/v2/user/<id>/permissions`
// — kabinetning O'ZI ishlatadigan metod, ya'ni eng ishonchli o'lchov.
if (process.env.BILLZ_SORA) {
  await och("/dashboard");
  await kut(4000);
  for (const yol of process.env.BILLZ_SORA.split(",").filter(Boolean)) {
    const ifoda = "(async () => { try { const r = await fetch(" + JSON.stringify(yol) +
      ", { credentials: 'include' }); const t = await r.text(); return r.status + ' ' + t; }" +
      " catch (e) { return 'XATO ' + e.message; } })()";
    const javob = await bahola(ifoda);
    console.log("── " + yol);
    console.log(String(javob).slice(0, Number(process.env.BILLZ_SORA_UZUNLIK ?? 4000)));
  }
  soket.close();
  process.exit(0);
}

// ── 3a. KUZATUV: Billz'ning O'ZI qaysi metodni chaqiradi ──────
// Nega kerak. Rolda «Списание» ning HAMMA ichki huquqi belgilangan,
// «Кассовые смены» da esa «Возможность просмотра кассовых смен»
// belgilangan — lekin integratsiya kaliti baribir 403 oladi. Demak
// bizning taxminimiz (`/v2/write-off`, `/v1/order/cash-shifts`)
// noto'g'ri bo'lishi mumkin: bu yo'llar hujjatdan emas, 45 nomzodni
// sinab topilgan edi. Billz kabinetining O'ZI qaysi manzilga
// borishini ko'rsak — taxmin o'rniga o'lchov bo'ladi.
if (process.argv.includes("--kuzat")) {
  await yubor("Network.enable");
  const menyu = await bahola(`(() => [...document.querySelectorAll('a[href]')]
    .map(a => ({ matn: a.innerText.replace(/\\s+/g, " ").trim().slice(0, 40), yol: a.getAttribute('href') }))
    .filter(x => x.matn))()`);
  console.log("── MENYU HAVOLALARI ──");
  console.log(JSON.stringify(menyu, null, 0).slice(0, 3000));

  for (const nishon of (process.env.BILLZ_KUZAT_YOL ?? "").split(",").filter(Boolean)) {
    hodisalar.length = 0;
    ayt(`── Kuzatuv: ${nishon}`);
    await och(nishon);
    await kut(6000);
    const soralgan = new Map();
    for (const h of hodisalar) {
      if (h.method === "Network.requestWillBeSent") {
        const u = h.params.request.url;
        if (/api-admin\.billz\.io|\/v[0-9]\//.test(u) && !/\.(js|css|png|svg|woff2?)/.test(u)) {
          soralgan.set(h.params.requestId, `${h.params.request.method} ${u.replace(/^https?:\/\/[^/]+/, "")}`);
        }
      }
      if (h.method === "Network.responseReceived" && soralgan.has(h.params.requestId)) {
        soralgan.set(h.params.requestId, `${h.params.response.status} ${soralgan.get(h.params.requestId)}`);
      }
    }
    for (const v of new Set(soralgan.values())) console.log(`   ${v.slice(0, 160)}`);
    const yonMenyu = await bahola(`(() => [...document.querySelectorAll('a[href]')]
      .map(a => a.innerText.replace(/\\s+/g, " ").trim().slice(0, 30) + " → " + a.getAttribute('href'))
      .filter(x => !x.startsWith(" →")))()`).catch(() => []);
    console.log(`   menyu: ${JSON.stringify(yonMenyu).slice(0, 1500)}`);
  }
  soket.close();
  process.exit(0);
}

// ── 3. Rol sahifasi: holatni O'QIYMIZ ─────────────────────────
ayt("── Rol sahifasi");
await och(rolYol);
await kutgin(`document.querySelectorAll('input[type=checkbox]').length > 3`, 30, "huquqlar ro'yxati");
await kut(1500);

// Sahifa — MUI TreeView. Har qator `li.MuiTreeItem-root`, ichida
// `input[type=checkbox]` va uning `value` da HUQUQ ID si (uuid).
// Yig'ilgan qatorning bolalari DOM'da UMUMAN yo'q — shuning uchun
// avval hammasini ochamiz.
//
// DIQQAT: "yarim belgilangan" (indeterminate) holat `input.indeterminate`
// xossasida emas, `data-indeterminate` ATRIBUTIDA turadi. Birinchi
// o'lchovda shu sabab «Кассовые смены» "bo'sh" bo'lib ko'rindi — aslida
// uning ba'zi bolalari belgilangan edi. Ya'ni noto'g'ri o'qish bizni
// noto'g'ri xulosaga olib borayotgan edi.
const hammasiniOch = async () => {
  for (let bosqich = 0; bosqich < 10; bosqich++) {
    const ochildi = await bahola(`(() => {
      const yopiq = [...document.querySelectorAll('li.MuiTreeItem-root[aria-expanded="false"]')];
      for (const li of yopiq) {
        const ikon = li.querySelector('.MuiTreeItem-iconContainer');
        if (ikon) ikon.click();
      }
      return yopiq.length;
    })()`);
    if (!ochildi) return bosqich;
    await kut(600);
  }
  return 10;
};

const holat = async () => bahola(`(() => {
  const chuqurlik = (li) => { let d = 0, n = li.parentElement; while (n) { if (n.matches?.('li.MuiTreeItem-root')) d++; n = n.parentElement; } return d; };
  const qatorlar = [...document.querySelectorAll('li.MuiTreeItem-root')].map((li) => {
    const cb = li.querySelector(':scope > .MuiTreeItem-content input[type=checkbox], :scope > div input[type=checkbox]');
    const nom = li.querySelector(':scope > div .MuiFormControlLabel-label span span span, :scope > div .MuiFormControlLabel-label span span');
    return {
      chuqur: chuqurlik(li),
      nom: (nom?.textContent || li.innerText.split("\\n")[0] || "").trim().slice(0, 60),
      id: cb?.value || "",
      belgi: !cb ? "?" : (cb.getAttribute("data-indeterminate") === "true" ? "yarim" : (cb.checked ? "belgilangan" : "bo'sh")),
      bolasiBor: li.getAttribute("aria-expanded") !== null,
    };
  });
  return {
    qatorlar,
    tugmalar: [...document.querySelectorAll('button')].map((b) => b.textContent.replace(/\\s+/g, " ").trim()).filter(Boolean),
  };
})()`);

const bosqich = await hammasiniOch();
ayt(`   · daraxt ochildi (${bosqich} bosqich)`);
await kut(800);
const h = await holat();
await shot("03-rol");
ayt(`   · qator: ${h.qatorlar.length}`);
console.log("── TUGMALAR ──");
console.log(JSON.stringify(h.tugmalar.slice(0, 20)));
console.log("── HUQUQLAR DARAXTI ──");
for (const q of h.qatorlar) {
  console.log(`   ${"  ".repeat(q.chuqur)}${q.belgi.padEnd(12)} ${q.nom}`);
}

// Ichki huquqlar (Просмотр/Создание…) yig'ilgan holda ko'rinmaydi —
// qatorni ochish kerak. Ochuvchi element <button> emas (tugmalar
// ro'yxatida yo'q), shuning uchun avval MARKUP ga qaraymiz.
if (process.argv.includes("--tuzilish")) {
  const html = await bahola(`(() => {
    const cbs = [...document.querySelectorAll('input[type=checkbox]')];
    const kes = (el, n) => { let x = el; for (let i = 0; i < n && x.parentElement; i++) x = x.parentElement; return x.outerHTML.slice(0, 1800); };
    return { spisanie: kes(cbs[3], 3), smena: kes(cbs[13], 3) };
  })()`);
  console.log("── SPISANIE MARKUP ──\n" + html.spisanie);
  console.log("── SMENA MARKUP ──\n" + html.smena);
}

soket.close();
ayt("");
ayt("(o'lchov tugadi — hech narsa bosilmadi va o'zgartirilmadi)");
process.exit(0);
