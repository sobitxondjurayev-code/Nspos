"use client";
// ══════════════════════════════════════════════════════════════
// DOLLAR KURSI TARIXI
// ══════════════════════════════════════════════════════════════
// Joriy kurs companyData'da turadi (hisob shundan yuriladi), bu modul
// esa "qachon qanaqa kurs yozilgan" degan savolga javob beradi.
//
// Nega kerak: xarajat so'mda kiritiladi va o'sha kundagi kurs bilan
// dollarga o'giriladi. Oy oxirida "bu raqam qayerdan chiqdi?" degan
// savol tug'ilsa, tarix ochib ko'riladi.
import { syncTable } from "./sync";
import { rpc, DEMO_MODE } from "./db";
import { getUser } from "./auth";
import { setUsdRate, getUsdRate, sozlama } from "./companyData";

let rates = [];
let seq = 1;
const nextId = () => "rate-" + (seq++) + "-" + Date.now().toString(36);

const sync = syncTable("usd_rates", {
  table: "usd_rates",
  order: { column: "created_at", ascending: false },
  get: () => rates,
  set: (v) => { rates = v; },
  sort: (a, b) => (a.at < b.at ? 1 : -1),
  fromRow: (r) => ({
    id: r.id,
    rate: Number(r.rate),
    source: r.source ?? "manual",
    note: r.note ?? "",
    createdBy: r.created_by ?? null,
    at: r.created_at ?? new Date().toISOString(),
  }),
  toRow: (r) => ({
    rate: r.rate,
    source: r.source,
    note: r.note || null,
  }),
});

export const listRates = () => [...rates].sort((a, b) => (a.at < b.at ? 1 : -1));
export const lastRate = () => listRates()[0] ?? null;

// Yangi kurs: joriy qiymat ham, tarix ham bir vaqtda yangilanadi.
// setUsdRate avtomat yangilashni o'chiradi — qo'lda yozilgan kurs
// keyingi o'zgartirishgacha o'z kuchida qoladi (rahbar talabi).
export function saveRate(rate, { source = "manual", note = "" } = {}) {
  const n = Number(rate) || 0;
  if (!(n > 0)) return null;

  // Xotira darrov yangilanadi — interfeys kutib turmaydi
  setUsdRate(n);

  const r = {
    id: nextId(), rate: n, source, note,
    createdBy: getUser()?.id ?? null,
    at: new Date().toISOString(),
  };
  rates = [r, ...rates];

  // Bazaga bitta amal bilan: `set_usd_rate` ham joriy kursni yangilaydi,
  // ham tarixga yozadi. Menejer uchun ham ishlaydi (funksiya ichida
  // huquq tekshiriladi), shuning uchun jadvalga alohida insert qilinmaydi.
  if (!DEMO_MODE) rpc("set_usd_rate", { p_rate: n, p_source: source }, "Dollar kursi");

  return r;
}

// ══════════════════════════════════════════════════════════════
// OY KURSI — yopilgan oy raqami bugungi kurs bilan suzmasin
// ══════════════════════════════════════════════════════════════
// DAFTAR 20 (G): oylik (`payrollData.kpiPayroll`) va usta puli
// (`expensesData.installerPayouts`) har ekran chizilganda BUGUNGI kurs
// bilan o'girilardi — avgust P&L kurs o'zgarganda o'zgarardi. Xarajat esa
// kiritilgan kun kursida muzlagan (`rate_used`). Endi so'mdagi oylik
// O'SHA OYNING kursi bilan: qoida Sozlamalar → `kurs.oyQoidasi`:
//   "oxirgi"  — oyda oxirgi kiritilgan kurs (standart)
//   "ortacha" — oydagi kurslar o'rtachasi
// Oyda kurs kiritilmagan bo'lsa — undan oldingi oxirgi kurs; tarix
// umuman bo'lmasa — joriy kurs (`manba: "joriy"`, ya'ni suzadi).
// Joriy (yopilmagan) oy uchun "oxirgi" = bugungi kurs — bu kutilgan.
export function oyKursi(oy) {
  const qoida = sozlama("kurs.oyQoidasi", "oxirgi");
  const hammasi = listRates();                      // yangidan eskiga
  const ichida = hammasi.filter((r) => String(r.at).slice(0, 7) === oy);
  if (ichida.length && qoida === "ortacha") {
    const o = ichida.reduce((a, r) => a + r.rate, 0) / ichida.length;
    return { oy, rate: +o.toFixed(2), manba: "oy-ortacha", soni: ichida.length };
  }
  if (ichida.length) return { oy, rate: ichida[0].rate, manba: "oy-oxirgi", soni: ichida.length };
  const oldingi = hammasi.find((r) => String(r.at).slice(0, 7) < oy);
  if (oldingi) return { oy, rate: oldingi.rate, manba: "oldingi-oy", soni: 0 };
  return { oy, rate: getUsdRate() ?? null, manba: "joriy", soni: 0 };
}
