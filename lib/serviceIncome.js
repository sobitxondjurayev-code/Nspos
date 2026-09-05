"use client";
// ══════════════════════════════════════════════════════════════
// SERVIS KASSASINING KIRIMI
// ══════════════════════════════════════════════════════════════
// Servis kassasiga pul Billz'dan keladi. Billz'da xizmat alohida bo'lim
// emas — u oddiy tovar kabi sotiladi ("montaj"), shuning uchun kirim
// tovar nomlari bo'yicha ajratiladi. Qaysi nomlar xizmat ekani
// Sozlamalarda belgilanadi (companyData.getServiceNames).
//
// Manba — "Эффективность товаров" yuklamasi (tahlil: "Servis foydasi").
// Diqqat: bu hisobotda KUNLIK taqsimot yo'q, davri ustun nomida yozilgan
// bo'ladi: "Продажи товаров 2026-06-20 - 2026-08-04 · ...". Shuning uchun
// so'ralgan davrga KUNLAR NISBATIDA bo'lib beriladi va hisobotda
// yuklama qaysi davrni qamragani yozib qo'yiladi — raqam qayerdan
// kelgani ko'rinib tursin.
//
// Qatorlarni ajratish mantig'i ServiceReport.jsx dagi bilan bir xil:
// ikkalasi ham `isServiceName` ga tayanadi.
//
// ── 2026-08-24 DAN: ASOSIY MANBA JONLI SAVDO ──
// Yuqoridagi Excel yo'li ikki sababdan yomon edi:
//   1. KUNLIK taqsimot yo'q — 46 kunlik hisobot so'ralgan davrga
//      kunlar NISBATIDA bo'linardi. Ya'ni "5-avgustdagi servis"
//      degan raqam aslida o'rtacha edi, o'sha kunniki emas.
//   2. Fayl QO'LDA yuklanadi. 24-avgustda eng yangisi 15-avgustники
//      edi — 9 kunlik servis kirimi umuman yo'q, lekin ekranda
//      raqam turgani uchun buni hech kim sezmasdi.
// Cheklar esa Billz API'dan har 30 daqiqada kelib turadi va ularda
// montaj alohida QATOR bo'lib yotibdi — kunma-kun, do'konma-do'kon.
// Excel yo'li zaxira bo'lib qoladi: API'dan oldingi tarix (2026-08-19
// gacha) faqat o'sha yerda.
import { listDatasets, numberOf, textOf } from "./datasets";
import { isServiceName } from "./companyData";
import { listSales } from "./salesData";
import { ymd } from "./dates";

const REPORT_ID = "efficiency";
const DAY = 86400000;

const day = (v) => {
  const d = v instanceof Date ? v : new Date(v);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
};

// Ustun nomlaridagi davr: "… 2026-06-20 - 2026-08-04 …"
function periodOf(header = []) {
  for (const h of header) {
    const m = String(h).match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
    if (m) return { from: m[1], to: m[2] };
  }
  return null;
}

// —— Servis kirimi ————————————————————————————————
// Qaytadi: { revenue, ready, period, covered }
//   ready   — yuklama bor va qatorlari o'qilgan
//   period  — yuklama qamragan davr (interfeysda ko'rsatiladi)
//   covered — shu davrning so'ralgan oraliqqa tushgan ulushi (0…1)
export function billzServiceIncome(from, to) {
  const ds = listDatasets().find((d) => d.reportId === REPORT_ID);
  const period = ds ? periodOf(ds.header) : null;
  const empty = { revenue: 0, ready: false, period, covered: 0 };

  // Qatorlar ro'yxat bilan birga kelmaydi — kerak bo'lganda tortiladi
  if (!ds || !ds.rows?.length) return empty;

  const header = ds.header ?? [];
  const nameCol = header.find((h) => h === "Наименование")
    ?? header.find((h) => h.toLowerCase().includes("наименование"));
  const qtyCol = header.find((h) => h.startsWith("Продажи товаров") && h.endsWith("Кол-во"));
  const revCol = header.find((h) => h.startsWith("Продажи товаров") && h.includes("скидк"));
  const revListCol = header.find((h) => h.startsWith("Продажи товаров")
    && h.includes("Сумма продажи") && !h.includes("скидк"));
  if (!nameCol || !qtyCol) return empty;

  let total = 0;
  for (const r of ds.rows) {
    if (numberOf(r, qtyCol) <= 0) continue;
    if (!isServiceName(textOf(r, nameCol))) continue;
    total += numberOf(r, revCol) || numberOf(r, revListCol);
  }

  // Davr bo'yicha ulush. Yuklama davri noma'lum bo'lsa to'liq olinadi.
  let covered = 1;
  if (period && from && to) {
    const pFrom = day(period.from), pTo = day(period.to);
    const rFrom = day(from), rTo = day(to);
    const overlap = Math.min(pTo, rTo) - Math.max(pFrom, rFrom) + DAY;
    const span = pTo - pFrom + DAY;
    covered = span > 0 ? Math.max(0, Math.min(1, overlap / span)) : 0;
  }

  return { revenue: +(total * covered).toFixed(2), ready: true, period, covered };
}

// —— Jonli servis kirimi: chek qatorlaridan ————————————————
// Billz'da montaj oddiy tovar bo'lib sotiladi, ya'ni u chek ichida
// alohida QATOR bo'lib yotadi. Nomi bo'yicha ajratamiz — xuddi
// Excel yo'lidagidek (`isServiceName`), farqi shundaki bu yerda
// sana ANIQ va do'kon ham ma'lum.
//
// ISHORA. `sale_items.qty` va `total` ishorali keladi (qaytarishda
// manfiy), `price` va `cost_price` esa doim musbat birlik raqami —
// `billzMap.saleItemRows` shunday yozadi. Shuning uchun `total` ni
// oddiy qo'shish net natijani beradi: qaytarilgan montaj o'zini
// o'zi ayiradi.
//
// MONTAJ UMUMIY SAVDO ICHIDA QOLADI. Bu funksiya hech narsani
// savdodan ayirmaydi — u faqat "shu davrda montajdan qancha tushdi"
// degan savolga javob beradi. Ayirilsa nasiya aynan servis
// summasiga oshib ketardi (DAFTAR 4-bo'lim, 2026-08-07).
// `byDay` — do'kon va SANA kesimi: { [storeId]: { "YYYY-MM-DD": summa } }.
// KPI kunlik jadvalidagi "Servis" ustuni va kassaning kunlik kirimi
// shundan to'ladi. Alohida sikl yozilmadi — o'sha bir aylanishning
// ichida yig'iladi, aks holda ikki joyda ikki xil "servis" chiqardi.
export function jonliServisKirim(from, to) {
  const a = from ? ymd(from) : null;
  const b = to ? ymd(to) : null;
  const byStore = {};
  const byDay = {};
  // Xizmat NOMI kesimi — "Servis foydasi" hisobotidagi jadval shundan.
  // Bu yerda yig'ilishi SHART: hisobot o'zicha `listSales()` ni
  // aylantirsa, xizmat ta'rifi (qaysi nom xizmat) ikki joyda bo'lib
  // qolardi (CLAUDE.md 2026-08-14).
  const byName = new Map();
  let revenue = 0, qty = 0, cost = 0, cheklar = 0;

  for (const s of listSales()) {
    // Sana "YYYY-MM-DD" ga keltirilib solishtiriladi — `String(sana)`
    // "Sat Aug 0" beradi va bitta ham kun tanlanmaydi (DAFTAR 4).
    const k = ymd(s.at);
    if (!k) continue;
    if (a && k < a) continue;
    if (b && k > b) continue;

    let chekda = 0;
    for (const i of s.items ?? []) {
      if (!isServiceName(i.name)) continue;
      const t = +i.total || 0;
      const n = +i.qty || 0;
      const c = (+i.costPrice || 0) * n;
      chekda += t;
      revenue += t;
      qty += n;
      cost += c;
      const kalit = `${i.name}__${s.storeId}`;
      const cur = byName.get(kalit) ?? { name: i.name, store: s.storeId, qty: 0, revenue: 0, cost: 0 };
      cur.qty += n; cur.revenue += t; cur.cost += c;
      byName.set(kalit, cur);
    }
    if (chekda) {
      cheklar++;
      byStore[s.storeId] = +((byStore[s.storeId] ?? 0) + chekda).toFixed(2);
      const kunlar = (byDay[s.storeId] ??= {});
      kunlar[k] = +((kunlar[k] ?? 0) + chekda).toFixed(2);
    }
  }

  return {
    revenue: +revenue.toFixed(2),
    qty: +qty.toFixed(2),
    cost: +cost.toFixed(2),
    cheklar,
    byStore,
    byDay,
    byName: [...byName.values()].map((x) => ({
      ...x, qty: +x.qty.toFixed(2), revenue: +x.revenue.toFixed(2), cost: +x.cost.toFixed(2),
    })).sort((a, b) => b.revenue - a.revenue),
    ready: true,
    manba: "baza",
    covered: 1,
    period: a && b ? { from: a, to: b } : null,
  };
}

// —— Servis kirimi: YAGONA kirish nuqtasi ————————————————
// Bir tushuncha — bitta funksiya (CLAUDE.md 2026-08-14). Kassa
// balansi ham, servis hisoboti ham SHUNI chaqiradi, aks holda ikki
// sahifada ikki xil servis raqami turadi.
//
// Jonli savdo bo'lsa — o'sha; bo'lmasa Excel yuklamasi. Tartib shu,
// chunki:
//   • jonli yo'l kunma-kun aniq va o'zi yangilanib turadi
//   • Excel yo'li API'dan oldingi tarix va demo rejim uchun kerak
// "Jonli savdo bor" degani — SHU DAVRDA chek bor. Davrda umuman
// chek bo'lmasa (masalan iyul oyi so'ralsa) Excel'ga tushamiz.
export function servisKirim(from, to) {
  const jonli = jonliServisKirim(from, to);
  if (jonli.cheklar > 0) return jonli;

  // Excel yo'lida kunlik taqsimot YO'Q — shuning uchun `byDay` bo'sh
  // turadi (undefined emas: chaqiruvchi har safar tekshirib o'tirmasin).
  // Kunlik servis faqat jonli yo'ldan keladi.
  // Excel yo'lida kunlik va NOM kesimi yo'q — bo'sh (undefined emas)
  const excel = billzServiceIncome(from, to);
  return excel.ready ? { ...excel, byDay: {}, byName: [], manba: "excel" } : jonli;
}
