"use client";
// Hisobotlar uchun hisob-kitoblar: ombor qoplamasi va ABC-analiz.
import { demoStores } from "./demoData";
import { listProducts, totalQty } from "./productsData";
import { salesInRange, listSales } from "./salesData";
import { listCustomers } from "./customersData";
import { ymd } from "./dates";

const DAY = 86400000;

// —— 1. Ombor qoplamasi: "necha kunga yetadi" ————————————————
//
// 2026-08-21 gacha bu hisob **butunlay muzlatilgan faylga** tayanardi.
// Ikki sabab bir joyda uchrashgan edi:
//
//   1. Kunlik tezlik `EXPORT_EFFICIENCY` dan olinardi — bu Billz'ning
//      "Tovar samaradorligi" Excel'i, `lib/billzExport.js` ichiga
//      yozib qo'yilgan va **22.07.2026 da to'xtagan**.
//   2. Bazadagi sotuvlar esa `!s.imported` filtri bilan chetlab
//      o'tilardi — Billz'dan kelgan chekning HAMMASI `imported`,
//      ya'ni 9 032 chekdan bittasi ham sanalmasdi.
//
// Natijada "necha kunga yetadi" bir oydan beri qimirlamagan raqamdan
// chiqardi va buni hech narsa ko'rsatmasdi.
//
// Endi tezlik BAZADAN, chek qatorlaridan hisoblanadi (34 489 qator,
// 01.01–19.08). Qaytarish qatorlari manfiy dona bilan keladi, ya'ni
// yig'indi o'zi tuzatiladi — alohida ayirish shart emas.
//
// **Nimani yo'qotdik va nega roziman:** Billz'ning `salesSpeed` i
// "tovar omborda BO'LGAN kunlar" ga bo'lardi, ya'ni qoldiq tugagan
// kunlar tezlikni pastga tortmasdi. Bizda qoldiq tarixi yo'q, shuning
// uchun bunday hisoblab bo'lmaydi. Buning o'rniga ikki oyna olinadi:
// qisqa (30 kun) va uzun (90 kun). Qisqa oynada sotuv bo'lmasa uzun
// oyna ishlatiladi — shunda vaqtincha tugab turgan tovar "umuman
// sotilmaydi" bo'lib qolmaydi. Aniq, lekin bir oy eskirgan raqamdan
// ko'ra taxminiy, lekin bugungi raqam foydaliroq.
export function stockCoverage({ windowDays = 30, storeId = "all", now = new Date() } = {}) {
  const from = new Date(now.getTime() - windowDays * DAY);
  const uzunKun = windowDays * 3;
  const uzunFrom = new Date(now.getTime() - uzunKun * DAY);

  const qisqa = new Map();      // tanlangan oynadagi dona
  const uzun = new Map();       // uch barobar oynadagi dona
  for (const s of salesInRange(uzunFrom, now)) {
    if (storeId !== "all" && s.storeId !== storeId) continue;
    const yangi = new Date(s.at) >= from;
    for (const i of s.items ?? []) {
      uzun.set(i.productId, (uzun.get(i.productId) || 0) + i.qty);
      if (yangi) qisqa.set(i.productId, (qisqa.get(i.productId) || 0) + i.qty);
    }
  }

  // Butun tarix: jami sotilgan va OXIRGI sotilgan kun. Oxirgi kun
  // "o'lik qoldiq" uchun kerak — qancha vaqtdan beri qimirlamayapti.
  const jami = new Map();
  const oxirgiKun = new Map();
  for (const s of listSales()) {
    if (storeId !== "all" && s.storeId !== storeId) continue;
    for (const i of s.items ?? []) {
      jami.set(i.productId, (jami.get(i.productId) || 0) + i.qty);
      const kun = ymd(s.at);
      if (i.qty > 0 && (!oxirgiKun.has(i.productId) || kun > oxirgiKun.get(i.productId))) {
        oxirgiKun.set(i.productId, kun);
      }
    }
  }

  const bugun = ymd(now);
  return listProducts()
    // Xizmat (montaj) omborda turmaydi — qoldig'i manfiy bo'lishi ham
    // mumkin (`allowNegative`). "Necha kunga yetadi" savoli unga
    // umuman tegishli emas, lekin sotuvi katta bo'lgani uchun u
    // ro'yxatning tepasiga chiqib, haqiqiy tovarlarni bosib qolardi.
    .filter((p) => !p.isService)
    .map((p) => {
      const total = totalQty(p);
      const stock = storeId === "all" ? total : (p.stock[storeId] ?? 0);

      const q = qisqa.get(p.id) || 0;
      const u = uzun.get(p.id) || 0;
      // Qisqa oynada sotuv bo'lsa — o'shanisi (bugungi holatga yaqin).
      // Bo'lmasa uzun oyna: sekin sotiladigan tovar ham tezlikka ega.
      const avgDaily = +(q > 0 ? q / windowDays : Math.max(u, 0) / uzunKun).toFixed(3);

      const daysLeft = avgDaily > 0 ? Math.round(stock / avgDaily) : null;
      const oxirgi = oxirgiKun.get(p.id) ?? null;
      return {
        product: p, stock, avgDaily, daysLeft,
        // Qoldig'i tugagan, lekin sotilib turgan tovar — ALOHIDA holat.
        // "0 kun qoldi" deb kritiklar ichiga qo'shilsa, u ro'yxatning
        // tepasini egallaydi va "yaqinda tugaydi" degan haqiqiy
        // ogohlantirishni bosib qoladi. Aslida bu boshqa savol:
        // "tugab bo'lgan, sotuv YO'QOTILYAPTI" (DAFTAR 2026-08-13:
        // shu sabab 163 pozitsiya ko'rinmay qolgan edi).
        tugagan: stock <= 0 && avgDaily > 0,
        soldQty: q,                                   // tanlangan oynada
        soldLong: u,                                  // uch barobar oynada
        soldTotal: jami.get(p.id) || 0,               // butun tarix
        lastSoldAt: oxirgi,
        // Necha kundan beri qimirlamayapti (hech sotilmagan bo'lsa null)
        idleDays: oxirgi ? Math.round((new Date(bugun) - new Date(oxirgi)) / DAY) : null,
        stockValue: +(stock * p.costPrice).toFixed(2),
      };
    })
    .sort((a, b) => {
      // Tartib: avval TUGAGAN (sotuv yo'qotilyapti), keyin eng kam
      // qolganlar, oxirida sotuvi yo'qlar.
      if (a.tugagan !== b.tugagan) return a.tugagan ? -1 : 1;
      if (a.daysLeft == null) return 1;
      if (b.daysLeft == null) return -1;
      return a.daysLeft - b.daysLeft;
    });
}

// Ogohlantirish darajalari.
// `row` berilsa "tugagan" holati ham ajratiladi; eski chaqiruvlar
// (faqat kun beradiganlar) o'z holicha ishlayveradi.
export const coverageLevel = (d, row = null) =>
  row?.tugagan ? "out"
  : d == null ? "none" : d <= 7 ? "critical" : d <= 21 ? "low" : "ok";

// —— 2. ABC-analiz ————————————————————————————————————
// Kumulyativ tushum bo'yicha: A — 80% gacha, B — 95% gacha, C — qolgani.
function classify(rows, valueKey) {
  const total = rows.reduce((a, r) => a + r[valueKey], 0);
  let cum = 0;
  return rows.map((r) => {
    cum += r[valueKey];
    const cumPct = total > 0 ? (cum / total) * 100 : 0;
    return {
      ...r,
      share: total > 0 ? +((r[valueKey] / total) * 100).toFixed(2) : 0,
      cumPct: +cumPct.toFixed(2),
      abc: cumPct <= 80 ? "A" : cumPct <= 95 ? "B" : "C",
    };
  });
}

// Mijozlar kesimida ABC
export function customerABC(from, to) {
  const byCustomer = new Map();
  for (const s of salesInRange(from, to)) {
    if (!s.customerId) continue;
    const cur = byCustomer.get(s.customerId) || { revenue: 0, orders: 0 };
    cur.revenue += s.total;
    cur.orders += 1;
    byCustomer.set(s.customerId, cur);
  }

  const rows = listCustomers()
    .map((c) => {
      const agg = byCustomer.get(c.id);
      if (!agg) return null;
      return {
        customer: c,
        revenue: +agg.revenue.toFixed(2),
        orders: agg.orders,
        avgCheck: +(agg.revenue / agg.orders).toFixed(2),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.revenue - a.revenue);

  return classify(rows, "revenue");
}

// Tovarlar kesimida ABC (6-bosqich uchun ham asqotadi)
export function productABC(from, to) {
  const byProduct = new Map();
  for (const s of salesInRange(from, to)) {
    for (const i of s.items) {
      const cur = byProduct.get(i.productId) || { revenue: 0, qty: 0 };
      cur.revenue += i.total;
      cur.qty += i.qty;
      byProduct.set(i.productId, cur);
    }
  }

  const rows = listProducts()
    .map((p) => {
      const agg = byProduct.get(p.id);
      if (!agg) return null;
      return { product: p, revenue: +agg.revenue.toFixed(2), qty: agg.qty };
    })
    .filter(Boolean)
    .sort((a, b) => b.revenue - a.revenue);

  return classify(rows, "revenue");
}

export const ABC_COLORS = {
  A: { bg: "bg-emerald-50", text: "text-emerald-700" },
  B: { bg: "bg-amber-50", text: "text-amber-700" },
  C: { bg: "bg-slate-100", text: "text-muted" },
};

export const storeOptions = [{ id: "all", name: "Barcha do'konlar" }, ...demoStores];
