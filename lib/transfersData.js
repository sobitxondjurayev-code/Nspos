"use client";
// ══════════════════════════════════════════════════════════════
// TRANSFERLAR — Billz ko'zgusi (sklad ↔ filial ko'chirish)
// ══════════════════════════════════════════════════════════════
// Rahbar (2026-09-03): "skladdan qancha transfer bo'layotgani
// ko'rinmayapti". Billz `/v2/transfer` sarlavha darajasida beradi:
// qaysi do'kondan qaysiga, necha dona, sotuv/tannarx summasi, kim,
// qachon. Tovar qatorlari API'da bo'sh keladi (DAFTAR 18) — shuning
// uchun bu yerda "qaysi tovar" emas, "qancha va qayerga" savoliga
// javob bor. Qoida: Billz raqami qayta hisoblanmaydi — faqat davr va
// yo'nalish bo'yicha yig'iladi.
import { syncTable } from "./sync";
import { storeName } from "./storesData";

let transfers = [];

syncTable("stock_transfers", {
  table: "stock_transfers",
  select: "id,billz_id,external_id,name,from_store_id,to_store_id,from_name,to_name,qty,qty_arrived,"
        + "retail_total,supply_total,status_id,differs,created_by,accepted_by,comment,created_at,accepted_at,updated_at",
  order: { column: "created_at", ascending: false },
  realtime: true,
  get: () => transfers,
  set: (v) => { transfers = v; },
  fromRow: (r) => ({
    id: r.id, billzId: r.billz_id, no: r.external_id, name: r.name,
    fromStoreId: r.from_store_id, toStoreId: r.to_store_id,
    fromName: r.from_name, toName: r.to_name,
    qty: Number(r.qty), qtyArrived: Number(r.qty_arrived),
    retailTotal: Number(r.retail_total), supplyTotal: Number(r.supply_total),
    differs: !!r.differs, createdBy: r.created_by, acceptedBy: r.accepted_by,
    comment: r.comment ?? "", at: r.created_at, acceptedAt: r.accepted_at,
  }),
  // Ilova yozmaydi — faqat sinxron. `toRow` shakl uchun.
  toRow: (t) => ({ billz_id: t.billzId }),
});

export const listTransfers = () => [...transfers];

// Davr ichidagi transferlar (jo'natilgan sana bo'yicha). Filtr:
// `fromStoreId` / `toStoreId` — bittasi yoki ikkalasi.
export function transfersInRange(from, to, { fromStoreId = null, toStoreId = null } = {}) {
  const a = new Date(from).getTime(), b = new Date(to).getTime();
  return transfers.filter((t) => {
    const x = new Date(t.at).getTime();
    if (x < a || x > b) return false;
    if (fromStoreId && t.fromStoreId !== fromStoreId) return false;
    if (toStoreId && t.toStoreId !== toStoreId) return false;
    return true;
  });
}

// Yo'nalish bo'yicha yig'indi: "Sklad → Optim": soni, dona, tannarx,
// sotuv narxi, oxirgi sana. Ekran, API va bot BITTA yig'indini oladi.
export function transferSummary(from, to, opts = {}) {
  const rows = transfersInRange(from, to, opts);
  const map = new Map();
  for (const t of rows) {
    const key = `${t.fromStoreId ?? t.fromName}→${t.toStoreId ?? t.toName}`;
    const cur = map.get(key) ?? {
      key,
      fromStoreId: t.fromStoreId, toStoreId: t.toStoreId,
      fromName: storeName(t.fromStoreId) ?? t.fromName ?? "?",
      toName: storeName(t.toStoreId) ?? t.toName ?? "?",
      soni: 0, dona: 0, donaQabul: 0, supplyTotal: 0, retailTotal: 0, farqli: 0, oxirgi: null,
    };
    cur.soni++;
    cur.dona += t.qty;
    cur.donaQabul += t.qtyArrived;
    cur.supplyTotal += t.supplyTotal;
    cur.retailTotal += t.retailTotal;
    if (t.differs) cur.farqli++;
    if (!cur.oxirgi || t.at > cur.oxirgi) cur.oxirgi = t.at;
    map.set(key, cur);
  }
  const routes = [...map.values()].map((r) => ({
    ...r,
    supplyTotal: +r.supplyTotal.toFixed(2),
    retailTotal: +r.retailTotal.toFixed(2),
  })).sort((x, y) => y.dona - x.dona);
  return {
    routes,
    soni: rows.length,
    dona: rows.reduce((a, t) => a + t.qty, 0),
    supplyTotal: +rows.reduce((a, t) => a + t.supplyTotal, 0).toFixed(2),
    retailTotal: +rows.reduce((a, t) => a + t.retailTotal, 0).toFixed(2),
  };
}
