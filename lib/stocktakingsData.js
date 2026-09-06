"use client";
// ══════════════════════════════════════════════════════════════
// INVENTARIZATSIYA — Billz ko'zgusi (sanoq, kamomad, ortiqcha)
// ══════════════════════════════════════════════════════════════
// DAFTAR 24: ilgari "Billz'da inventarizatsiya metodi yo'q" deb
// hisoblanardi (45 nomzod urilgan, hammasi 404). Haqiqiy yo'l
// `/v2/stocktaking` — kabinet kuzatilib topildi va u ochiq.
//
// Hujjat SARLAVHA darajasida: `items` API'da doim null. Ya'ni bu yerda
// "qaysi tovar yo'q" emas, "qancha kamomad/ortiqcha va qancha summa"
// savoliga javob bor.
//
// MUHIM AJRATISH: Billz bu ro'yxatga transferga bog'liq jarayonlarni ham
// qo'shadi (`type=TRANSFER`). Kompaniyada hozircha HAMMASI shunday, ya'ni
// haqiqiy sanoq (`INVENTORY`) hali qilinmagan. Shuning uchun ekranga
// chiqadigan raqam `sanoqlar()` dan olinadi — aks holda "8 ta
// inventarizatsiya" degan yolg'on ko'rinardi.
//
// Qoida: Billz raqami qayta hisoblanmaydi — faqat davr bo'yicha yig'iladi.
import { syncTable } from "./sync";
import { storeName } from "./storesData";

let stocktakings = [];

syncTable("stocktakings", {
  table: "stocktakings",
  select: "id,billz_id,external_id,name,store_id,shop_name,type,status_id,qty,new_products,"
        + "shortage,surplus,postponed,difference_sum,process_percentage,transfer_billz_id,"
        + "created_by,finished_by,locked,deleted,created_at,finished_at,updated_at",
  order: { column: "created_at", ascending: false },
  realtime: true,
  get: () => stocktakings,
  set: (v) => { stocktakings = v; },
  fromRow: (r) => ({
    id: r.id, billzId: r.billz_id, no: r.external_id, name: r.name,
    storeId: r.store_id, shopName: r.shop_name,
    type: (r.type ?? "").toUpperCase(),
    qty: Number(r.qty), newProducts: Number(r.new_products),
    shortage: Number(r.shortage), surplus: Number(r.surplus),
    postponed: Number(r.postponed),
    differenceSum: Number(r.difference_sum),
    percent: Number(r.process_percentage),
    transferBillzId: r.transfer_billz_id,
    createdBy: r.created_by, finishedBy: r.finished_by,
    locked: !!r.locked, deleted: !!r.deleted,
    at: r.created_at, finishedAt: r.finished_at,
  }),
  // Ilova yozmaydi — faqat sinxron. `toRow` shakl uchun.
  toRow: (s) => ({ billz_id: s.billzId }),
});

export const listStocktakings = () => [...stocktakings];

/** Haqiqiy sanoq — transferga bog'liq jarayonlar chiqarib tashlanadi. */
export const sanoqlar = () => stocktakings.filter((s) => s.type !== "TRANSFER" && !s.deleted);

/** Davr ichidagilar (boshlangan sana bo'yicha). */
export function sanoqlarInRange(from, to, { storeId = null } = {}) {
  const a = new Date(from).getTime(), b = new Date(to).getTime();
  return sanoqlar().filter((s) => {
    const x = new Date(s.at).getTime();
    if (x < a || x > b) return false;
    if (storeId && s.storeId !== storeId) return false;
    return true;
  });
}

/**
 * Yig'indi: nechta sanoq, kamomad/ortiqcha dona va farq summasi.
 * Ekran, API va bot bitta funksiyadan oladi.
 */
export function stocktakingSummary(from, to, opts = {}) {
  const rows = sanoqlarInRange(from, to, opts);
  const yigʻ = (f) => rows.reduce((a, s) => a + (Number(s[f]) || 0), 0);
  return {
    soni: rows.length,
    shortage: yigʻ("shortage"),
    surplus: yigʻ("surplus"),
    differenceSum: +yigʻ("differenceSum").toFixed(2),
    // Oxirgi sanoq qachon bo'lgani — "inventarizatsiya qilinmagan"
    // holatini aynan shu ko'rsatadi (bo'sh bo'lsa null).
    oxirgi: rows.reduce((a, s) => (!a || s.at > a ? s.at : a), null),
    dokonlar: [...new Set(rows.map((s) => storeName(s.storeId) ?? s.shopName ?? "?"))],
  };
}

/**
 * Butun tarix bo'yicha oxirgi sanoq (davrdan qat'i nazar). Ombor
 * sahifasidagi "oxirgi inventarizatsiya" qatori shundan.
 */
export function oxirgiSanoq() {
  const r = sanoqlar();
  if (!r.length) return null;
  return r.reduce((a, s) => (!a || s.at > a.at ? s : a), null);
}

/**
 * Transferga bog'liq jarayonlar (`type=TRANSFER`) — ular sanoq emas,
 * LEKIN ichida kamomad bo'lishi mumkin (qabulda yetmay chiqqan tovar).
 *
 * Shuning uchun bu yerda faqat SONI emas, kamomadi ham qaytariladi:
 * kompaniyada 2024-yilda 329 dona / −2 540.50 $ kamomad aynan shu
 * jarayonlarda yozilgan. "Sanoq qilinmagan" deb faqat sonini ko'rsatish
 * o'sha raqamni jimgina yashirardi.
 */
export function transferJarayonSummary() {
  const rows = stocktakings.filter((s) => s.type === "TRANSFER" && !s.deleted);
  const kamomadli = rows.filter((s) => s.shortage > 0 || s.differenceSum < 0);
  const yigʻ = (f) => rows.reduce((a, s) => a + (Number(s[f]) || 0), 0);
  return {
    soni: rows.length,
    shortage: yigʻ("shortage"),
    surplus: yigʻ("surplus"),
    differenceSum: +yigʻ("differenceSum").toFixed(2),
    kamomadliSoni: kamomadli.length,
    oxirgiKamomad: kamomadli.reduce((a, s) => (!a || s.at > a ? s.at : a), null),
    oxirgi: rows.reduce((a, s) => (!a || s.at > a.at ? s : a), null),
  };
}
