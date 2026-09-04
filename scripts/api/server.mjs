// ══════════════════════════════════════════════════════════════
// NSPOS API — FAQAT O'QISH
// ══════════════════════════════════════════════════════════════
//   node --import ./scripts/lib/register.mjs scripts/api/server.mjs
//
// Kim uchun: biznes egasi (Excel/Google Sheets), tashqi vositalar va
// AI agent. Javob BIZNES TILIDA — "tushum", "sof foyda", "qarz", —
// jadval nomlari va ustunlar emas.
//
// ── ENG MUHIM QOIDA ──
// Bu API raqamni O'ZI HISOBLAMAYDI. U ekrandagi raqamni chiqaradigan
// AYNAN o'sha funksiyalarni chaqiradi (`profitAndLoss`,
// `kassaBalances`, `arAging`, `rfm`…). Agar API o'z formulasini
// yozsa, u ekrandan asta uzoqlashadi va bir kun "saytda 50 930,
// API'da 54 921" bo'lib chiqadi — buni hech kim sezmaydi.
// (2026-08-14 da tekshiruv skriptida aynan shunday bo'lgan.)
//
// Modullar Node'da haqiqiy baza qatorlari bilan to'ldiriladi
// (`scripts/lib/yuk.mjs`) — tekshiruv skripti bilan bir xil yo'l.
//
// ── FAQAT O'QISH ──
// Faqat GET qabul qilinadi. Yozish yo'li umuman yo'q: AI agent yoki
// tashqi vosita bazaga hech narsa yoza olmaydi.
import { createServer } from "node:http";
import { loadApp } from "../lib/yuk.mjs";

const PORT = Number(process.env.NSPOS_API_PORT ?? 3002);
const TOKEN = process.env.NSPOS_API_TOKEN ?? "";
// Ma'lumot shu muddatdan eski bo'lsa qayta o'qiladi. 31 000 qatorni
// o'qish ~2 soniya — har so'rovda qilish isrof, kuniga bir marta esa
// eskirib qoladi.
const YANGILASH_MS = Number(process.env.NSPOS_API_TTL ?? 5 * 60_000);

let yuklandi = 0;
let yuklanmoqda = null;
let app = null;

async function tayyorla(majburiy = false) {
  if (!majburiy && app && Date.now() - yuklandi < YANGILASH_MS) return app;
  if (yuklanmoqda) return yuklanmoqda;
  // `finally` SHART: busiz bir marta yiqilgan yuklash abadiy
  // eslab qolinardi — `yuklanmoqda` rad etilgan va'da bo'lib qolib,
  // keyingi har so'rov AYNAN o'sha eski xatoni qaytarardi. Baza
  // tuzalganidan keyin ham API "Baza to'liq o'qilmadi" deb turardi
  // (2026-08-22 da shunday bo'ldi).
  yuklanmoqda = (async () => {
    await loadApp();
    app = {
      pnl: await import("../../lib/pnlData.js"),
      kassa: await import("../../lib/kassaData.js"),
      qarz: await import("../../lib/debtsData.js"),
      tahlil: await import("../../lib/analytics.js"),
      boshqaruv: await import("../../lib/managementData.js"),
      moslik: await import("../../lib/moslik.js"),
      audit: await import("../../lib/audit.js"),
      dokon: await import("../../lib/storesData.js"),
      sana: await import("../../lib/dates.js"),
    };
    yuklandi = Date.now();
    return app;
  })().finally(() => { yuklanmoqda = null; });
  return yuklanmoqda;
}

// ── Davr ───────────────────────────────────────────────────────
// `dan`/`gacha` berilmasa — joriy oy. Sana "YYYY-MM-DD".
function davr(q) {
  const bugun = new Date();
  const dan = q.get("dan") ? new Date(q.get("dan") + "T00:00:00") : new Date(bugun.getFullYear(), bugun.getMonth(), 1);
  const gacha = q.get("gacha") ? new Date(q.get("gacha") + "T23:59:59") : bugun;
  return { dan, gacha };
}
// `toISOString()` UTC ga o'giradi va Toshkent (+5) da sana BIR KUN
// ORQAGA suriladi: 01.08 mahalliy yarim tunda "2026-07-31" bo'lib
// chiqadi. Shuning uchun mahalliy komponentlardan yig'amiz.
const iso = (d) => {
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
};

// ── Yo'llar ────────────────────────────────────────────────────
const YOLLAR = {
  "/api/v1": () => ({
    nom: "NSPOS API",
    tavsif: "Faqat o'qish. Har raqam saytdagi bilan bir xil funksiyadan chiqadi.",
    yollar: {
      "/api/v1/xulosa": "Bugungi holat: savdo, foyda, kassa, qarz, ogohlantirishlar",
      "/api/v1/savdo?dan=&gacha=": "Foyda va zarar: tushum, tannarx, xarajat, sof foyda",
      "/api/v1/kassa": "Har hamyonda qancha pul bor",
      "/api/v1/qarz": "Ochiq qarz yosh guruhlari va kimga birinchi qo'ng'iroq qilish",
      "/api/v1/tovar-foyda?dan=&gacha=&kesim=tovar|kategoriya|brend|dokon": "Nima qancha sof foyda keltirdi",
      "/api/v1/qoldiq": "Nimani buyurtma qilish kerak va qaysi tovarga pul muzlagan",
      "/api/v1/mijoz": "Mijoz segmentlari (RFM)",
      "/api/v1/ogohlantirish": "Raqamlar bir-biriga to'g'ri kelyaptimi va ma'lumotda xato bormi",
    },
    kirish: "Authorization: Bearer <token>",
    izoh: "Sana formati YYYY-MM-DD. Davr berilmasa — joriy oy.",
  }),

  "/api/v1/savdo": (a, q) => {
    const { dan, gacha } = davr(q);
    const p = a.pnl.profitAndLoss(dan, gacha);
    return {
      davr: { dan: iso(dan), gacha: iso(gacha) },
      tushum: { jami: p.revenue.total, tovar: p.revenue.goods, xizmat: p.revenue.services,
                qaytarilgan: p.revenue.returns, chegirma: p.revenue.discounts },
      tannarx: p.cogs.total,
      yalpi_foyda: p.grossProfit,
      yalpi_marja_foiz: p.grossMargin,
      xarajat: { jami: p.expenses.total, oylik: p.expenses.payroll,
                 usta_ulushi: p.expenses.installerShare, doimiy: p.expenses.opex },
      sof_foyda: p.netProfit,
      sof_marja_foiz: p.netMargin,
    };
  },

  // `kassaBalances` obyekt qaytaradi: { kassaId: {cash, payme,
  // service, total, pending} }. Boshida u massiv deb o'ylangan edi
  // va API bo'sh ro'yxat qaytarardi — shakl KODDAN tekshirildi.
  "/api/v1/kassa": (a) => {
    const b = a.kassa.kassaBalances(new Date());
    const nomlar = Object.fromEntries(a.kassa.listKassas().map((k) => [k.id, k.label]));
    const rows = Object.entries(b).map(([id, v]) => ({
      kassa: nomlar[id] ?? id,
      naqd: v.cash, payme_karta: v.payme, servis: v.service,
      jami: v.total, yolda: v.pending,
    }));
    return {
      sana: iso(new Date()),
      hamyonlar: rows,
      jami: +rows.reduce((s2, r) => s2 + r.jami, 0).toFixed(2),
      yolda_jami: +rows.reduce((s2, r) => s2 + r.yolda, 0).toFixed(2),
      izoh: "\"Yo'lda\" — kassadan chiqqan, lekin kompaniyaga hali yetib bormagan pul.",
    };
  },

  "/api/v1/qarz": (a) => {
    const d = a.tahlil.arAging();
    // Jami qarzdorlik — Billz "Jami qarz" bilan bir xil ta'rif
    // (`debtsData.jamiQarz`); ekrandagi kartochka ham shu funksiya.
    const j = a.qarz.jamiQarz();
    return {
      jami_qarzdorlik: j.jami,
      qarz_soni: j.soni,
      mijoz_soni: j.mijozlar,
      // Rahbar muddati bo'yicha (Sozlamalar → Qarz muddati), Billz yorlig'i emas
      muddat_kun: j.muddatKun,
      muddati_otgan: j.muddatiOtgan,
      muddati_kelmagan: j.muddatiKelmagan,
      qisman_tolangan: j.qismanTolangan,
      shubhali: j.shubhali,
      top10: j.top10,
      dso_kun: j.dso,
      billz_overdue: j.billzOverdue,
      billz_sinxroni: j.billzVaqti,
      ochiq_qarz: d.open,
      qarzdor_soni: d.rows.length,
      yosh_guruhlari: d.buckets.map((x) => ({ guruh: x.label, qarz_soni: x.count, summa: x.open })),
      birinchi_qongiroq: d.birinchi.map((r) => ({
        mijoz: r.name, telefon: r.phone, qarz: r.open, eng_eski_kun: r.oldest,
        avval_ortacha_kunda_tolagan: r.ortachaKun,
      })),
    };
  },

  "/api/v1/tovar-foyda": (a, q) => {
    const { dan, gacha } = davr(q);
    const xarita = { tovar: "product", kategoriya: "category", brend: "brand", dokon: "store" };
    const kesim = xarita[q.get("kesim") ?? "tovar"] ?? "product";
    const rows = a.tahlil.productProfit(dan, gacha, { by: kesim });
    const chegara = Number(q.get("nechta") ?? 50);
    return {
      davr: { dan: iso(dan), gacha: iso(gacha) },
      kesim: q.get("kesim") ?? "tovar",
      jami: {
        tushum: +rows.reduce((s, r) => s + r.revenue, 0).toFixed(2),
        foyda: +rows.reduce((s, r) => s + r.profit, 0).toFixed(2),
      },
      zararda: rows.filter((r) => r.profit < 0)
        .map((r) => ({ nom: r.name, foyda: r.profit, dona: r.qty })),
      qatorlar: rows.slice(0, chegara).map((r) => ({
        nom: r.name, dona: r.qty, tushum: r.revenue, tannarx: r.cogs,
        foyda: r.profit, marja_foiz: r.margin, donasiga_foyda: r.perUnit,
      })),
    };
  },

  "/api/v1/qoldiq": (a) => {
    const buyurtma = a.tahlil.reorderList();
    const olik = a.tahlil.deadStock();
    // Yig'indi — ekrandagi kartochka bilan bitta funksiya (`reorderSummary`)
    const y = a.tahlil.reorderSummary(buyurtma);
    return {
      buyurtma_qilish_kerak: y.buyurtma,
      tugagan_lekin_sotilyapti: y.tugagan,
      tugagan_30_kun_sotilmagan: y.sokin,
      kuniga_yoqotilayotgan_foyda: y.yoqotishKun,
      tannarxi_nomalum: y.tannarxsiz,
      muddat_kun: { yetkazish: y.muddat.lead, zaxira: y.muddat.cover },
      buyurtma: buyurtma.slice(0, 50).map((r) => ({
        tovar: r.product.name, qoldiq: r.stock, kuniga_sotiladi: r.avgDaily,
        tezlik_oynasi_kun: r.oyna, oxirgi_sotuv: r.lastSoldAt,
        necha_kunga_yetadi: r.daysLeft, buyurtma_miqdori: r.buyurtma,
        kunlik_yoqotish: r.kunlikYoqotish,
      })),
      olik_qoldiq: {
        summa: olik.value, pozitsiya: olik.rows.length,
        guruhlar: olik.buckets.map((b) => ({ guruh: b.label, soni: b.count, summa: b.value })),
        eng_qimmat: olik.rows.slice(0, 20).map((r) => ({
          tovar: r.product.name, qoldiq: r.stock, muzlagan_pul: r.stockValue,
          qimirlamagan_kun: r.idleDays,
        })),
      },
      izoh: `Sotuv tarixi ${olik.tarix.kun} kun (${olik.tarix.boshi} dan). Undan uzoq muddatni bu ma'lumot ko'rsata olmaydi.`,
    };
  },

  "/api/v1/mijoz": (a) => {
    const d = a.tahlil.rfm();
    return {
      odam: d.rows.length,
      jami_qoldirgan_puli: d.money,
      segmentlar: d.segments.map((s) => ({
        segment: s.label, odam: s.count, puli: s.money,
        izoh: s.izoh, nima_qilish: s.nima,
      })),
      eng_qimmatli: d.rows.slice(0, 20).map((r) => ({
        mijoz: r.name, telefon: r.phone, xarid: r.checks, puli: r.money,
        ortacha_chek: r.avgCheck, oxirgi_xarid_kun_oldin: r.recency, segment: r.segment,
      })),
      izoh: "Bir odam bazada bir necha marta yozilgan bo'lishi mumkin — telefon bo'yicha birlashtirilgan.",
    };
  },

  "/api/v1/ogohlantirish": (a) => {
    const moslik = a.moslik.runChecks();
    const pul = a.audit.moneyWarnings({ role: "owner" });
    return {
      nomuvofiqlik: moslik.flatMap((g) => g.problems.map((p) => ({
        tekshiruv: g.name, daraja: p.level === "error" ? "xato" : "ogohlantirish",
        matn: p.title, tafsilot: p.detail,
      }))),
      malumot_xatolari: pul.map((w) => ({ matn: w.title, tafsilot: w.detail })),
    };
  },

  "/api/v1/xulosa": (a) => {
    const bugun = new Date();
    const oyBoshi = new Date(bugun.getFullYear(), bugun.getMonth(), 1);
    const p = a.pnl.profitAndLoss(oyBoshi, bugun);
    const kun = a.pnl.profitAndLoss(new Date(iso(bugun) + "T00:00:00"), bugun);
    const qarz = a.tahlil.arAging();
    const buyurtma = a.tahlil.reorderList();
    const xato = a.moslik.runChecks().flatMap((g) => g.problems).filter((x) => x.level === "error");
    return {
      sana: iso(bugun),
      bugun: { tushum: kun.revenue.total, sof_foyda: kun.netProfit },
      shu_oy: { tushum: p.revenue.total, yalpi_foyda: p.grossProfit,
                sof_foyda: p.netProfit, marja_foiz: p.netMargin },
      ochiq_qarz: a.qarz.jamiQarz().jami,
      qarz_90_kundan_eski: qarz.buckets.find((b) => b.id === "d90p")?.open ?? 0,
      tugagan_tovar: a.tahlil.reorderSummary(buyurtma).tugagan,
      kuniga_yoqotilayotgan_foyda: a.tahlil.reorderSummary(buyurtma).yoqotishKun,
      xatolar: xato.map((x) => x.title),
    };
  },
};

// ── Server ─────────────────────────────────────────────────────
createServer(async (req, res) => {
  const javob = (kod, obj) => {
    res.writeHead(kod, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    res.end(JSON.stringify(obj, null, 2));
  };

  // FAQAT O'QISH — boshqa usul umuman qabul qilinmaydi
  if (req.method !== "GET") return javob(405, { xato: "Faqat GET. Bu API hech narsa yozmaydi." });

  const u = new URL(req.url, "http://x");
  const yol = u.pathname.replace(/\/+$/, "") || "/api/v1";

  if (yol === "/api/v1/salomat") return javob(200, { ok: true, yuklandi: yuklandi ? new Date(yuklandi).toISOString() : null });

  const ish = YOLLAR[yol];
  if (!ish) return javob(404, { xato: "Bunday yo'l yo'q", yollar: Object.keys(YOLLAR) });

  // Katalog tokensiz ochiq — nima borligini bilish uchun sir kerak emas
  if (yol !== "/api/v1") {
    const kelgan = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    if (!TOKEN || kelgan !== TOKEN) return javob(401, { xato: "Token noto'g'ri yoki berilmagan" });
  }

  try {
    const a = yol === "/api/v1" ? null : await tayyorla(u.searchParams.get("yangila") === "1");
    javob(200, ish(a, u.searchParams));
  } catch (e) {
    javob(500, { xato: String(e?.message ?? e) });
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`NSPOS API 127.0.0.1:${PORT}`);
});
