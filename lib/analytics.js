"use client";
// Hisobotlar uchun hisob-kitoblar: ombor qoplamasi va ABC-analiz.
import { demoStores } from "./demoData";
import { storeName as storeNameOf } from "./storesData";
import { listProducts, totalQty } from "./productsData";
import { categoryName } from "./categoriesData";
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

// —— 3. Tovar kesimida HAQIQIY foyda ————————————————
// Billz "eng ko'p sotilgan" ni beradi, lekin "eng ko'p FOYDA
// keltirgan" ni bermaydi — u tannarxni hisobotga qo'shmaydi.
// Holbuki bu ikkisi ko'pincha BOSHQA tovarlar bo'lib chiqadi:
// arzon aksessuar ko'p sotiladi, lekin foyda kamera va domofonda.
//
// Endi bazada 34 489 chek qatori bor va HAR QATORDA o'sha paytdagi
// tannarx saqlangan (`sale_items.cost_price`) — ya'ni foydani
// taxmin qilmasdan, aniq hisoblash mumkin.
//
// `by` — kesim: "product" | "category" | "brand" | "store"
export function productProfit(from, to, { by = "product", storeId = "all" } = {}) {
  const catalog = listProducts();
  const byId = new Map(catalog.map((p) => [p.id, p]));

  // Kesim kaliti va nomi. Kategoriya/brend nomi tovar kartochkasidan
  // olinadi — chek qatorida u yo'q.
  const kalit = (p, s) =>
    by === "category" ? (p?.categoryId ?? "yo'q")
    : by === "brand" ? (p?.brand || "—")
    : by === "store" ? s.storeId
    : (p?.id ?? "yo'q");

  const nomi = (p, s) =>
    by === "category" ? (categoryName(p?.categoryId) ?? "Kategoriyasiz")
    : by === "brand" ? (p?.brand || "Brendsiz")
    : by === "store" ? (storeNameOf(s.storeId) ?? s.storeId)
    : (p?.name ?? "Katalogda yo'q");

  const map = new Map();
  for (const s of salesInRange(from, to)) {
    if (storeId !== "all" && s.storeId !== storeId) continue;
    for (const i of s.items ?? []) {
      const p = byId.get(i.productId);
      const k = kalit(p, s);
      let r = map.get(k);
      if (!r) {
        r = { key: k, name: nomi(p, s), product: by === "product" ? p : null,
              qty: 0, revenue: 0, cogs: 0, checks: new Set() };
        map.set(k, r);
      }
      // Qaytarish qatorida qty ham, total ham MANFIY — yig'indi o'zi
      // tuzatiladi, alohida ayirish shart emas (ishora qator
      // darajasida, DAFTAR 2026-08-19).
      r.qty += i.qty;
      r.revenue += +i.total || 0;
      // Tannarx chek qatorining O'ZIDA; bo'lmasa katalogdagi joriy
      const unit = i.costPrice || p?.costPrice || 0;
      r.cogs += unit * i.qty;
      r.checks.add(s.id);
    }
  }

  const rows = [...map.values()].map((r) => {
    const revenue = +r.revenue.toFixed(2);
    const cogs = +r.cogs.toFixed(2);
    const profit = +(revenue - cogs).toFixed(2);
    return {
      ...r,
      revenue, cogs, profit,
      checks: r.checks.size,
      qty: +r.qty.toFixed(3),
      // Marja — foydaning TUSHUMGA nisbati. Tushum nol yoki manfiy
      // bo'lsa (faqat qaytarish bo'lgan tovar) marja ma'nosiz.
      margin: revenue > 0 ? +((profit / revenue) * 100).toFixed(1) : null,
      // Bitta donadan qancha foyda — narx qo'yishda eng foydali raqam
      perUnit: r.qty > 0 ? +(profit / r.qty).toFixed(2) : null,
    };
  });

  return rows.sort((a, b) => b.profit - a.profit);
}

// —— 4. O'lik qoldiq va buyurtma taklifi ————————————————
// Ikkala savol ham BITTA manbadan (`stockCoverage`) chiqadi, shuning
// uchun shu yerda turadi: ekran, REST API va Telegram bot AYNAN shu
// funksiyani chaqiradi, har biri o'zicha hisoblamaydi.
//
// ── Buyurtma taklifi ──
// Formula ataylab ODDIY: "shuncha kunga yetadigan miqdor".
//
//   kerak = kunlik o'rtacha × (yetkazish kuni + zaxira kuni) − qoldiq
//
// Murakkabroq model (EOQ, xavfsizlik zaxirasi) yozish mumkin edi,
// lekin u yetkazish muddatining TARQOQLIGINI talab qiladi — bizda
// esa yetkazish sanasi umuman yozilmaydi. Bo'lmagan ma'lumotdan
// chiqarilgan aniq raqam — aniq ko'rinadigan taxmin, bu esa
// taxmin ekani ko'rinib turgan raqamdan yomonroq.
export function reorderList({ windowDays = 30, storeId = "all", leadDays = 14, coverDays = 30, now = new Date() } = {}) {
  return stockCoverage({ windowDays, storeId, now })
    .filter((r) => r.avgDaily > 0 && (r.tugagan || (r.daysLeft != null && r.daysLeft <= leadDays)))
    .map((r) => {
      const kerak = Math.ceil(r.avgDaily * (leadDays + coverDays) - r.stock);
      return {
        ...r,
        buyurtma: Math.max(kerak, 1),
        // Tugab turgan tovarda sotuv YO'QOTILADI. Kuniga qancha
        // yo'qotilayotganini pulda ko'rsatamiz — "40 ta tovar
        // tugagan" dan ko'ra "kuniga 82 $ yo'qotilyapti" tushunarli.
        kunlikYoqotish: r.tugagan
          ? +(r.avgDaily * ((r.product.salePrice || 0) - (r.product.costPrice || 0))).toFixed(2)
          : 0,
      };
    })
    .sort((a, b) => {
      if (a.tugagan !== b.tugagan) return a.tugagan ? -1 : 1;
      if (a.tugagan) return b.kunlikYoqotish - a.kunlikYoqotish;
      return (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999);
    });
}

// ── O'lik qoldiq ──
// "O'lik" = qoldig'i bor, lekin `idleDays` kundan beri qimirlamagan.
//
// ── TARIX CHEGARASI ──
// Bu yerda oson yolg'on gapirib qo'yish mumkin. Boshida guruhlar
// qotirib yozilgan edi: 90–180 kun, 180–365 kun, "1 YILDAN ORTIQ".
// Oxirgisi 0 ta chiqdi — go'yo bir yildan ortiq yotgan tovar yo'q.
//
// Aslida bazadagi sotuv tarixi 230 KUN (01.01.2026 dan). Bir yildan
// ortiq yotgan tovar BO'LISHI mumkin, biz shunchaki BILMAYMIZ. "0 ta"
// degan raqam esa "yo'q" degan ishonch beradi — bu yolg'on.
//
// Shuning uchun guruhlar tarix uzunligidan HISOBLANADI va oxirgi
// guruh "tarix boshidan beri sotilmagan" deb ataladi — bu aniq va
// tekshirib bo'ladigan gap.
export function salesHistory() {
  let eng = null, yangi = null;
  for (const s of listSales()) {
    const k = ymd(s.at);
    if (!k) continue;
    if (!eng || k < eng) eng = k;
    if (!yangi || k > yangi) yangi = k;
  }
  const kun = eng && yangi ? Math.round((new Date(yangi) - new Date(eng)) / DAY) : 0;
  return { boshi: eng, oxiri: yangi, kun };
}

export function deadStock({ idleDays = 90, storeId = "all", now = new Date() } = {}) {
  const tarix = salesHistory();

  // Guruh chegaralari tarixdan oshmaydi. Tarix qisqa bo'lsa oraliq
  // guruh umuman tushib qoladi — bo'sh guruh ko'rsatmaymiz.
  const chegara = [180, 365].filter((d) => d < tarix.kun);
  const buckets = [
    { id: `b${idleDays}`, label: `${idleDays}–${chegara[0] ?? tarix.kun} kun`, min: idleDays, max: chegara[0] ?? Infinity },
    ...chegara.map((d, i) => ({
      id: `b${d}`,
      label: chegara[i + 1] ? `${d}–${chegara[i + 1]} kun` : `${d} kundan ortiq`,
      min: d, max: chegara[i + 1] ?? Infinity,
    })),
    { id: "never", label: `${tarix.boshi ?? "tarix boshi"} dan beri sotilmagan`, min: null, max: null },
  ];

  const guruh = (r) => {
    if (r.lastSoldAt == null) return "never";
    for (let i = buckets.length - 2; i >= 0; i--) {
      if (r.idleDays >= buckets[i].min) return buckets[i].id;
    }
    return buckets[0].id;
  };

  const rows = stockCoverage({ windowDays: 30, storeId, now })
    .filter((r) => r.stock > 0 && (r.lastSoldAt == null || r.idleDays >= idleDays))
    .map((r) => ({ ...r, bucket: guruh(r) }))
    .sort((a, b) => b.stockValue - a.stockValue);

  return {
    rows, tarix,
    buckets: buckets.map((b) => {
      const ichida = rows.filter((r) => r.bucket === b.id);
      return { ...b, count: ichida.length, value: +ichida.reduce((a, r) => a + r.stockValue, 0).toFixed(2) };
    }),
    value: +rows.reduce((a, r) => a + r.stockValue, 0).toFixed(2),
  };
}
