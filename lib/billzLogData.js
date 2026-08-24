"use client";
// ══════════════════════════════════════════════════════════════
// BILLZ SINXRONIZATSIYA JURNALI — O'QISH UCHUN
// ══════════════════════════════════════════════════════════════
// Ogohlantirishlar (`lib/audit.js`) uchta savolga javob beradi va
// uchalasi ham shu jurnalda yozilgan:
//   • Billz'da tanilmagan to'lov turi chiqdimi? (pul jim yo'qoladi)
//   • Do'koni tanilmagani uchun chek tashlandimi? (butun do'kon yo'qoladi)
//   • Tortish chala tugadimi? (orqada qolish o'sib boradi)
//
// O'QISH KO'RINISHDAN, YOZISH — YO'Q.
// `v_billz_sync_oxirgi` har bosqichning FAQAT oxirgi yurishini beradi
// (6 qator). Butun jurnalni brauzerga tashish shart emas: u har
// 30 daqiqada 6 qatordan o'sib boradi va bir oyda 8 000 qatordan
// oshadi. Jurnalga yozishni faqat server qiladi (service key), ya'ni
// bu modulda `toRow` umuman kerak emas.
//
// DIQQAT — BO'SH RO'YXAT "HAMMASI JOYIDA" DEGANI EMAS.
// `billz_sync_log` ustidagi RLS faqat rahbar va menejerga o'qishga
// ruxsat beradi (`is_manager()`). Usta yoki kassir ochsa PostgREST
// xato emas, BO'SH ro'yxat qaytaradi (CLAUDE.md 2026-08-21). Shuning
// uchun bu yerdan chiqadigan ogohlantirishlar "yozuv bor va u yomon"
// deganda chiqadi — "yozuv yo'q" jim o'tiladi. Aks holda huquqi
// yo'q xodim ekranida soxta trevoga turardi.
import { syncTable } from "./sync";

let jurnal = [];

syncTable("billz_sync_log", {
  table: "billz_sync_log",
  readTable: "v_billz_sync_oxirgi",
  // Jonli kuzatuv YO'Q: ko'rinishni PostgREST realtime'i uzata olmaydi,
  // va bu ma'lumot sekundlab yangilanishi ham shart emas. Yangi holat
  // yon paneldagi "Yangilash" tugmasidan keyin (sahifa qayta yuklanadi)
  // yoki ilova ochilganda keladi.
  realtime: false,
  get: () => jurnal,
  set: (v) => { jurnal = v; },
  fromRow: (r) => ({
    id: r.id,
    entity: r.entity,
    mode: r.mode,
    startedAt: r.started_at,
    finishedAt: r.finished_at ?? null,
    cursorAt: r.cursor_at ?? null,
    fetched: Number(r.fetched ?? 0),
    inserted: Number(r.inserted ?? 0),
    updated: Number(r.updated ?? 0),
    skipped: Number(r.skipped ?? 0),
    // Do'koni tanilmagani uchun YOZILMAGAN cheklar soni
    noStore: Number(r.no_store ?? 0),
    // `false` — "yana qoldi" (chegara yoki muddat tugagan).
    // `null` — eski yozuv, bu ustun paydo bo'lishidan oldingi.
    // Ikkalasini farqlash SHART: `null` ni `false` deb o'qisak
    // butun eski jurnal "chala" bo'lib ko'rinardi.
    exhausted: r.exhausted ?? null,
    warnings: r.warnings ?? null,
  }),
  toRow: () => ({}),
});

export const listSinxronJurnal = () => [...jurnal];

/** Bitta bosqichning oxirgi yurishi (`orders`, `products`, `debts`…) */
export const sinxronBosqich = (entity) => jurnal.find((x) => x.entity === entity) ?? null;
