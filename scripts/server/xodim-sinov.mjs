// ══════════════════════════════════════════════════════════════
// XODIM HISOBI BILAN SAYT SINOVI (2026-09-03)
// ══════════════════════════════════════════════════════════════
//   npm run xodim -- --rol=manager
//   npm run xodim -- --rol=installer
//   npm run xodim -- --rol=owner --faqat-sahifa      (rahbar: faqat sahifalar)
//
// `brauzer-kirgan.mjs` naqshi: JWT serverdagi sir bilan shu yerda
// imzolanadi (parol kerak emas), xodim `profiles` dan roli bo'yicha
// olinadi. Ikki qism:
//   1) YOZUVLAR — o'sha token bilan PostgREST (`/rest/v1`) orqali
//      HAQIQIY insert → darrov delete (`return=representation` bilan
//      qator soni tekshiriladi): KPI kuni, xarajat, kassa kirimi, NPS,
//      qarz to'lovi jurnali; ruxsat yo'q yozuv (payouts, kompaniya
//      balansi, xarajat turi) 42501 bilan RAD bo'lishi ham sinaladi.
//      Bazada iz qolmaydi (audit_log dan tashqari). `--faqat-sahifa`
//      bilan o'tkazib yuboriladi — rahbar uchun SHART (ruxsat kutilmagan
//      yozuv rahbarda o'tib ketadi va o'chirilmaydi).
//   2) SAHIFALAR — Chrome (DevTools): konsol xatosi, 4xx/5xx so'rov,
//      "Application error", /login ga tushib ketish, "hali yuklanmoqda"
//      banneri. Har sahifa skrinshoti .tmp/shot-<rol>-<sahifa>.png
//
// Muhit: NSPOS_YOLLAR=/kpi,/finance/kassa (sahifalar), NSPOS_KUT=60000
// (kutish ms), NSPOS_REST=1 (har PostgREST so'rovi: range, hajm, vaqt +
// `[db] yuklandi` konsoli), NSPOS_UI_KPI=1 (/kpi da bugungi "Dam"
// katakchasini bosib → F5 → turibdimi → qaytarish: haqiqiy UI yozuv yo'li),
// NSPOS_MATN="regex;;regex" (sahifa matnidan bo'lak), NSPOS_QAYTA=1
// (20 s dan keyin va "Yangilash" bosib qayta o'lchash).
//
// 2026-09-03 natija: menejer 28/28 ✓, usta 17/17 ✓; topilgani — Kassa
// sahifasi yuklanish paytida "Optim naqd minusda −61 367 $" (yolg'on,
// to'liq kelgach 14 452 $), /finance da o'chirilgan /finance/import
// kartasi (404), "−0 so'm" formati. DAFTAR 18.10.
import { createHmac } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MANZIL = "https://tizim.enes.uz";
const SERVER = process.env.NSPOS_SERVER ?? "root@169.58.216.246";
const KALIT = process.env.NSPOS_KEY ?? `${process.env.HOME}/.ssh/nspos`;
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9334;
const ROL = (process.argv.find((a) => a.startsWith("--rol=")) ?? "--rol=manager").slice(6);
const FAQAT_SAHIFA = process.argv.includes("--faqat-sahifa");   // yozuv sinovisiz (rahbar uchun)

const b64 = (s) => Buffer.from(s).toString("base64url");
const kut = (ms) => new Promise((r) => setTimeout(r, ms));
const serverdan = (buyruq) => execFileSync("ssh", ["-i", KALIT, "-o", "BatchMode=yes", SERVER, buyruq], { encoding: "utf8", timeout: 30000 }).trim();

const sir = serverdan("grep -h '^JWT_SECRET=' /opt/nspos/app/.env* 2>/dev/null | head -1 | cut -d= -f2-").replace(/^["']|["']$/g, "");
if (!sir) { console.error("✗ JWT_SECRET topilmadi"); process.exit(1); }

// Roldagi xodim (do'koni bor bo'lsa avval) va rahbar id (KPI "boshqa" sinovi)
const q = (sql) => serverdan(`sudo -u postgres psql -d nspos -Atc "${sql.replace(/"/g, '\\"')}" 2>/dev/null`).split("\n").filter(Boolean).pop() ?? "";
const [id, ism, storeId] = q(`select id||'|'||coalesce(full_name,'')||'|'||coalesce(store_id::text,'') from profiles where role='${ROL}' order by (store_id is null), created_at limit 1`).split("|");
const ownerId = q("select id from profiles where role='owner' limit 1");
if (!/^[0-9a-f-]{36}$/.test(id ?? "")) { console.error(`✗ '${ROL}' rolida xodim yo'q`); process.exit(1); }
console.log(`xodim: ${ism} (${ROL}) · do'kon: ${storeId || "yo'q"}`);

const hozir = Math.floor(Date.now() / 1000);
const head = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
const body = b64(JSON.stringify({ sub: id, role: "nspos_app", aud: "authenticated", iat: hozir, exp: hozir + 3600 }));
const token = `${head}.${body}.${b64(createHmac("sha256", sir).update(`${head}.${body}`).digest())}`;

// ── 2-qism avval: PostgREST yozuv sinovlari (Chrome kerak emas) ──
const REST = `${MANZIL}/rest/v1`;
async function rest(method, yol, tana, prefer = "return=representation") {
  const r = await fetch(`${REST}/${yol}`, {
    method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json", prefer },
    body: tana ? JSON.stringify(tana) : undefined,
  });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, j };
}
const bugun = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);   // Toshkent
let ok = 0, xato = 0;
const belgi = (nom, sart, izoh = "") => { if (sart) { ok++; console.log(`   ✓ ${nom}${izoh ? " — " + izoh : ""}`); } else { xato++; console.log(`   ✗ ${nom}${izoh ? " — " + izoh : ""}`); } };

// insert → (kutilgan: ruxsat) → delete; ruxsat kutilmasa 401/403/409 kutiladi
async function yozibOchir(nom, jadval, qator, ruxsat, filtr) {
  const r = await rest("POST", jadval, qator);
  if (!ruxsat) { belgi(nom + " (rad kutildi)", r.status >= 400 && r.status !== 500, `HTTP ${r.status} ${r.j?.code ?? ""} ${String(r.j?.message ?? "").slice(0, 60)}`); return; }
  const yozildi = r.status === 201 && Array.isArray(r.j) && r.j.length === 1;
  if (!yozildi) { belgi(nom, false, `HTTP ${r.status} ${JSON.stringify(r.j).slice(0, 120)}`); return; }
  const f = filtr ? filtr(r.j[0]) : `id=eq.${r.j[0].id}`;
  const d = await rest("DELETE", `${jadval}?${f}`);
  const ochdi = d.status === 200 && Array.isArray(d.j) && d.j.length === 1;
  belgi(nom, ochdi, ochdi ? "yozildi va o'chirildi" : `yozildi, o'chirish HTTP ${d.status} ${JSON.stringify(d.j).slice(0, 100)}`);
}

console.log("── Yozuv sinovlari (PostgREST, haqiqiy token) ──");
if (!FAQAT_SAHIFA) {
  const p = await rest("GET", `profiles?select=id,role,store_id&id=eq.${id}`);
  belgi("o'z profilini o'qish", p.status === 200 && p.j?.[0]?.role === ROL, `HTTP ${p.status}`);
  const m = await rest("GET", "role_permissions?select=role,key,allowed&limit=1");
  belgi("huquq matritsasini o'qish", m.status === 200 && m.j?.length === 1, `HTTP ${m.status}`);
  const tr = await rest("GET", "stock_transfers?select=id&limit=1");
  belgi("transferlarni o'qish", tr.status === 200, `HTTP ${tr.status}`);

  const kassa = storeId || "company";
  const manager = ROL === "manager", cashier = ROL === "cashier";
  await yozibOchir("KPI kuni (o'ziga)", "kpi_day", { id: `d:${id}:2000-01-01`, staff_id: id, date: "2000-01-01", data: { sinov: true } }, true);
  await yozibOchir("KPI kuni (rahbarga)", "kpi_day", { id: `d:${ownerId}:2000-01-02`, staff_id: ownerId, date: "2000-01-02", data: { sinov: true } }, manager);
  await yozibOchir("xarajat (o'z kassasi, bugun)", "expenses", { category: "other", amount: 1, kassa, spent_on: bugun, note: "__sinov" }, manager && !!storeId);
  await yozibOchir("xarajat (kompaniya balansi)", "expenses", { category: "other", amount: 1, kassa: "company", spent_on: bugun, note: "__sinov" }, false);
  await yozibOchir("kassa kirimi (o'z kassasi)", "kassa_ops", { kassa, wallet: "cash", kind: "in", amount: 1, category: "other_in", note: "__sinov" }, manager && !!storeId);
  await yozibOchir("NPS baho", "nps_records", { id: `__sinov-${Date.now()}`, month: "2000-01", customer_name: "__sinov" }, manager || cashier);
  await yozibOchir("qarz to'lovi jurnali (cash_operations)", "cash_operations", { direction: "in", category: "other_in", amount: 1, store_id: storeId || null, note: "__sinov" }, manager || cashier);
  await yozibOchir("pul rejasi (payouts)", "payouts", { title: "__sinov", amount: 1, due_date: bugun }, false);
  await yozibOchir("xarajat turi qo'shish", "expense_categories", { key: "__sinov", label: "__sinov" }, false);
  // Mijoz: no-op yangilash (o'chirish siyosati yo'q — qator qolmasin)
  const c = await rest("GET", "customers?select=id,name&limit=1");
  if (c.j?.[0]) {
    const u = await rest("PATCH", `customers?id=eq.${c.j[0].id}`, { name: c.j[0].name });
    belgi("mijozni yangilash", (manager || cashier) ? (u.status === 200 && u.j?.length === 1) : (u.status >= 400 || u.j?.length === 0), `HTTP ${u.status}, ${u.j?.length ?? "-"} qator`);
  }
  // Tovar: no-op yangilash
  const pr = await rest("GET", "products?select=id,name&limit=1");
  if (pr.j?.[0]) {
    const u = await rest("PATCH", `products?id=eq.${pr.j[0].id}`, { name: pr.j[0].name });
    belgi("tovarni yangilash", manager ? (u.status === 200 && u.j?.length === 1) : (u.status >= 400 || u.j?.length === 0), `HTTP ${u.status}, ${u.j?.length ?? "-"} qator`);
  }
  if (ROL === "installer") {
    const so = await rest("GET", `service_orders?select=id,status&installer_id=eq.${id}&limit=1`);
    if (so.j?.[0]) {
      const r = await rest("POST", "rpc/service_status_set", { p_id: so.j[0].id, p_status: so.j[0].status }, "");
      belgi("o'z buyurtmasi holati (RPC)", r.status === 200, `HTTP ${r.status} ${JSON.stringify(r.j).slice(0, 80)}`);
    } else console.log("   · ustaning buyurtmasi yo'q — RPC sinalmadi");
  }
}

// ── 1-qism: sahifalar Chrome'da ──
const YOLLAR = process.env.NSPOS_YOLLAR ? process.env.NSPOS_YOLLAR.split(",") : ROL === "installer"
  ? ["/kpi", "/services", "/settings"]
  : ["/dashboard", "/kpi", "/installers", "/nps", "/finance", "/finance/kassa", "/finance/expenses",
     "/finance/debts", "/products", "/clients", "/services", "/reports", "/reports/stock_health", "/settings"];
console.log(`── Sahifalar (${ROL}) ──`);
const profil = mkdtempSync(join(tmpdir(), "nspos-xodim-"));
const chrome = spawn(CHROME, ["--headless", "--disable-gpu", "--no-sandbox", "--no-first-run", "--no-default-browser-check",
  "--disable-extensions", `--user-data-dir=${profil}`, "--window-size=1400,1000", `--remote-debugging-port=${PORT}`, "about:blank"], { stdio: "ignore" });
const tozala = () => { try { chrome.kill("SIGKILL"); } catch {} try { rmSync(profil, { recursive: true, force: true, maxRetries: 3 }); } catch {} };
process.on("exit", tozala);
let ws = null;
for (let i = 0; i < 60 && !ws; i++) { await kut(500); try { ws = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; } catch {} }
if (!ws) { console.error("✗ Chrome ko'tarilmadi"); process.exit(1); }
const soket = new WebSocket(ws);
await new Promise((r, x) => { soket.onopen = r; soket.onerror = x; });
let raqam = 0; const kutilmoqda = new Map(); const hodisalar = [];
soket.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && kutilmoqda.has(m.id)) { const { ok, xato } = kutilmoqda.get(m.id); kutilmoqda.delete(m.id); m.error ? xato(new Error(m.error.message)) : ok(m.result); } else if (m.method) hodisalar.push(m); };
const yubor = (method, params = {}, sessionId, kutish = 60000) => new Promise((ok, xato) => {
  const id = ++raqam; const soat = setTimeout(() => { kutilmoqda.delete(id); xato(new Error(`${method}: javob yo'q`)); }, kutish);
  kutilmoqda.set(id, { ok: (v) => { clearTimeout(soat); ok(v); }, xato: (e) => { clearTimeout(soat); xato(e); } });
  soket.send(JSON.stringify({ id, method, params, sessionId }));
});
const { targetId } = await yubor("Target.createTarget", { url: "about:blank" });
const { sessionId } = await yubor("Target.attachToTarget", { targetId, flatten: true });
for (const m of ["Page.enable", "Runtime.enable", "Log.enable", "Network.enable"]) await yubor(m, {}, sessionId);
await yubor("Network.setCookie", { name: "nspos_token", value: token, domain: new URL(MANZIL).hostname, path: "/", sameSite: "Strict", secure: true }, sessionId);

const SHOVQIN = /Cross-Origin-Opener-Policy|fonts\.googleapis|Password field|Autofill|favicon|DevTools/i;
const XATO = /(Uncaught [A-Za-z]*Error|ReferenceError|TypeError|SyntaxError|Minified React error|^Error):/im;
const REST_JURNAL = process.env.NSPOS_REST === "1";
for (const yol of YOLLAR) {
  hodisalar.length = 0;
  await yubor("Page.navigate", { url: MANZIL + yol }, sessionId);
  await kut(Number(process.env.NSPOS_KUT ?? 9000));
  const sorovlar = [...new Set(hodisalar.filter((h) => h.method === "Network.responseReceived" && h.params?.response?.status >= 400)
    .map((h) => `${h.params.response.status} ${h.params.response.url.replace(MANZIL, "").slice(0, 90)}`))];
  const muammolar = hodisalar.filter((h) => h.method === "Runtime.exceptionThrown" || (h.method === "Log.entryAdded" && h.params?.entry?.level === "error"))
    .map((h) => h.params?.exceptionDetails?.exception?.description ?? h.params?.exceptionDetails?.text ?? h.params?.entry?.text ?? "")
    .filter((s) => s && !SHOVQIN.test(s) && !/Failed to load resource/i.test(s) && XATO.test(s));
  const { result } = await yubor("Runtime.evaluate", { expression: "JSON.stringify({len: document.body.innerText.length, err: document.body.innerText.includes('Application error'), yol: location.pathname, yopiq: document.body.innerText.includes('Bu bo\\'lim sizga yopiq'), banner: document.body.innerText.includes('hali yuklanmoqda'), toast: (document.body.innerText.match(/Bazaga yozilmadi[^\\n]*\\n[^\\n]*/)||[''])[0], matn: "+(process.env.NSPOS_MATN ? `${JSON.stringify(process.env.NSPOS_MATN.split(";;"))}.map((r) => (document.body.innerText.match(new RegExp(r, "s"))||[""])[0]).join(" ## ")` : "\"\"")+"})", returnByValue: true }, sessionId);
  const h = JSON.parse(result.value);
  if (h.matn) console.log("      MATN: " + h.matn.replace(/\n+/g, " | ").slice(0, 1500));
  if (process.env.NSPOS_QAYTA && process.env.NSPOS_MATN) {
    const ifoda = `${JSON.stringify(process.env.NSPOS_MATN.split(";;"))}.map((r) => (document.body.innerText.match(new RegExp(r, "s"))||[""])[0]).join(" ## ")`;
    await kut(20000);
    let r = await yubor("Runtime.evaluate", { expression: ifoda, returnByValue: true }, sessionId);
    console.log("      QAYTA +20s: " + String(r.result.value).replace(/\n+/g, " | ").slice(0, 600));
    await yubor("Runtime.evaluate", { expression: "[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Yangilash')?.click()" }, sessionId);
    await kut(10000);
    r = await yubor("Runtime.evaluate", { expression: ifoda, returnByValue: true }, sessionId);
    console.log("      QAYTA Yangilash +10s: " + String(r.result.value).replace(/\n+/g, " | ").slice(0, 600));
  }
  if (REST_JURNAL) {
    const t0 = hodisalar.find((e) => e.method === "Network.requestWillBeSent")?.params.timestamp ?? 0;
    for (const e of hodisalar) {
      if (e.method === "Runtime.consoleAPICalled") { const m = e.params.args.map((x) => x.value ?? x.description ?? "").join(" "); if (/\[db\]|yuklanmadi|Error/i.test(m)) console.log(`      KONSOL: ${m.slice(0, 400)}`); }
    }
    // Har /rest/v1 so'rovi: jadval · Range (ExtraInfo'dan) · status · content-range · qator soni (javob tanasidan)
    const sorov = new Map();
    for (const e of hodisalar) {
      if (e.method === "Network.requestWillBeSent" && /\/rest\/v1\//.test(e.params.request.url)) {
        const u = new URL(e.params.request.url);
        sorov.set(e.params.requestId, { jadval: u.pathname.split("/rest/v1/")[1] + (u.search.length > 60 ? "?" + u.search.slice(1, 40) + "…" : u.search), range: "", status: "", cr: "", qator: "" });
      }
      if (e.method === "Network.requestWillBeSentExtraInfo" && sorov.has(e.params.requestId)) {
        const h = e.params.headers; sorov.get(e.params.requestId).range = h.Range ?? h.range ?? "";
      }
      if (e.method === "Network.responseReceived" && sorov.has(e.params.requestId)) {
        const r = sorov.get(e.params.requestId); r.status = e.params.response.status;
        r.cr = e.params.response.headers["content-range"] ?? e.params.response.headers["Content-Range"] ?? "";
      }
    }
    for (const e of hodisalar) {
      if (e.method === "Network.loadingFinished" && sorov.has(e.params.requestId)) sorov.get(e.params.requestId).qator = `${Math.round(e.params.encodedDataLength / 1024)}KB@${(e.params.timestamp - t0).toFixed(1)}s`;
      if (e.method === "Network.loadingFailed" && sorov.has(e.params.requestId)) sorov.get(e.params.requestId).qator = "XATO:" + e.params.errorText;
    }
    const jamlanma = {};
    for (const r of sorov.values()) { const k = r.jadval.split("?")[0]; (jamlanma[k] ??= []).push(`${r.range || "-"}→${r.status}/${r.cr || "-"}/${r.qator}`); }
    for (const [k, v] of Object.entries(jamlanma).sort()) console.log(`      ${k.padEnd(22)} ${v.join("  ")}`);
  }
  if (process.env.NSPOS_UI_KPI && yol === "/kpi") {
    const bugunQator = `[...document.querySelectorAll("tbody tr")].find((tr) => tr.innerText.replace(/^[^0-9]+/, "").startsWith("${bugun.slice(8, 10)}.${bugun.slice(5, 7)}"))`;
    const holat = `(() => { const tr = ${bugunQator}; const cb = tr && tr.querySelectorAll("input[type=checkbox]")[1]; return cb ? String(cb.checked) : "yo'q"; })()`;
    const bos = `(() => { const tr = ${bugunQator}; const cb = tr && tr.querySelectorAll("input[type=checkbox]")[1]; if (cb) cb.click(); return !!cb; })()`;
    const toast = `(document.body.innerText.match(/(Bazaga yozilmadi|Saqlanmadi|ruxsat yo'q)[^\\n]*/) || [""])[0]`;
    const ev = async (x) => (await yubor("Runtime.evaluate", { expression: x, returnByValue: true }, sessionId)).result.value;
    const avval = await ev(holat);
    if (avval === "yo'q") {
      const d = await ev(`JSON.stringify({tr: document.querySelectorAll("tr").length, cb: document.querySelectorAll("input[type=checkbox]").length, qator: (${bugunQator})?.innerText?.slice(0, 80) ?? null, bugun: ${JSON.stringify(bugun)}, namuna: document.querySelector("tbody tr")?.innerText?.slice(0, 60)})`);
      console.log("      UI KPI: bugungi qator/katakcha topilmadi " + d);
    }
    else {
      await ev(bos); await kut(5000);
      const t1 = await ev(toast);
      await yubor("Page.reload", {}, sessionId); await kut(12000);
      const keyin = await ev(holat);
      belgi(`UI KPI 'Dam' ${avval}→${keyin} (F5 dan keyin)`, keyin !== avval, t1 ? "toast: " + t1 : "toast yo'q");
      await ev(bos); await kut(5000);
      await yubor("Page.reload", {}, sessionId); await kut(12000);
      const qaytdi = await ev(holat);
      belgi(`UI KPI 'Dam' qaytarildi ${keyin}→${qaytdi}`, qaytdi === avval);
    }
  }
  try { const { data } = await yubor("Page.captureScreenshot", { format: "png" }, sessionId, 20000); writeFileSync(`.tmp/shot-${ROL}-${yol.replace(/\//g, "_") || "root"}.png`, Buffer.from(data, "base64")); } catch {}
  const izoh = [muammolar[0]?.split("\n")[0].slice(0, 90), ...sorovlar.slice(0, 2), h.err ? "Application error" : "", h.yopiq ? "bo'lim yopiq (kutilgan bo'lishi mumkin)" : "", h.banner ? "BANNER: hali yuklanmoqda" : "", h.toast ? "TOAST: " + h.toast.slice(0, 80) : ""].filter(Boolean).join(" · ");
  const yomon = muammolar.length || h.err || h.yol === "/login" || (h.len < 200 && !h.yopiq) || sorovlar.some((s) => /^5\d\d/.test(s));
  belgi(`${yol.padEnd(24)} ${h.len} belgi → ${h.yol}`, !yomon, izoh);
}
soket.close();
console.log(`── ${ok} ✓ · ${xato} ✗`);
process.exit(xato ? 1 : 0);
