"use client";
// ══════════════════════════════════════════════════════════════
// NPS BAHOLARI
// ══════════════════════════════════════════════════════════════
// Retention menejer har o'rnatishdan keyin mijozga qo'ng'iroq qilib
// baho qo'yadi: mijoz ismi, telefoni, qaysi usta o'rnatgani, 1–10 baho
// va izoh. Har ustaning o'rtacha bahosi "Ustalar reytingi"da chiqadi.
//
// Saqlash: localStorage (tez) + Supabase nps_records (qurilmalar aro,
// realtime). KPI ma'lumoti kabi write-through.
import { registerModule, upsert, remove as dbRemove, DEMO_MODE } from "./db";

let records = [];
let seq = 0;

const LS_KEY = "nspos.nps.v1";
function persist() {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(LS_KEY, JSON.stringify(records)); } catch {}
}
(function hydrate() {
  if (typeof window === "undefined") return;
  try { const s = JSON.parse(localStorage.getItem(LS_KEY) || "null"); if (Array.isArray(s)) records = s; } catch {}
})();

const fromRow = (r) => ({
  id: r.id, installerId: r.installer_id, customerName: r.customer_name,
  phone: r.phone, score: r.score, comment: r.comment, month: r.month,
  installedDate: r.installed_date,      // o'rnatilgan sana — qo'lda
  createdAt: r.created_at,              // to'ldirilgan sana — avtomat
  createdBy: r.created_by,
  productScore: r.product_score,        // mahsulot bahosi (1–10)
  productComment: r.product_comment,    // mahsulot izohi
});
// created_at YUBORILMAYDI — baza o'zi qo'yadi (to'ldirilgan sana avtomat)
const toRow = (x) => ({
  id: x.id, installer_id: x.installerId, customer_name: x.customerName || null,
  phone: x.phone || null, score: x.score ?? null, comment: x.comment || null,
  month: x.month, installed_date: x.installedDate || null, created_by: x.createdBy || null,
  product_score: x.productScore ?? null, product_comment: x.productComment || null,
});

registerModule("nps_records", {
  table: "nps_records", select: "*", realtime: true,
  fromRow,
  restore: (rows) => {
    const byId = new Map(records.map((r) => [r.id, r]));
    for (const r of rows) byId.set(r.id, r);
    records = [...byId.values()]; persist();
  },
  apply: ({ eventType, new: row, old }) => {
    if (eventType === "DELETE") records = records.filter((r) => r.id !== old.id);
    else { const it = fromRow(row); records = [...records.filter((r) => r.id !== it.id), it]; }
    persist();
  },
});

const newId = () => `nps-${Date.now().toString(36)}-${++seq}`;

// Oy bo'yicha barcha baholar (eng yangisi yuqorida)
export const listNps = (month) =>
  records.filter((r) => r.month === month).sort((a, b) => (a.id < b.id ? 1 : -1));

// Bitta ustaning o'sha oydagi o'rtacha bahosi va soni
export function npsForInstaller(installerId, month) {
  const rs = records.filter((r) => r.installerId === installerId && r.month === month && r.score != null);
  if (!rs.length) return { avg: null, count: 0 };
  const sum = rs.reduce((a, r) => a + (Number(r.score) || 0), 0);
  return { avg: sum / rs.length, count: rs.length };
}

// Retention menejerning KUNLIK jadvali shu sonlardan avtomat to'ladi:
//   O'rnatilgan (ta) — installedDate (o'rnatilgan sana) bo'yicha kunma-kun
//   NPS olingan (ta) — to'ldirilgan (createdAt) sana bo'yicha kunma-kun
// Shuning uchun menejer bu ustunlarni qo'lda kiritmaydi — NPS baho
// qo'shsa yetarli.
export function npsDayCounts(ym) {
  const installed = {}, taken = {};
  for (const r of records) {
    if (r.installedDate && String(r.installedDate).startsWith(ym))
      installed[r.installedDate] = (installed[r.installedDate] || 0) + 1;
    const td = String(r.createdAt || "").slice(0, 10);
    if (td.startsWith(ym) && r.score != null)
      taken[td] = (taken[td] || 0) + 1;
  }
  return { installed, taken };
}
export function npsMonthTotals(ym) {
  const c = npsDayCounts(ym);
  const sum = (o) => Object.values(o).reduce((a, n) => a + n, 0);
  return { installed: sum(c.installed), taken: sum(c.taken) };
}

// O'sha oydagi mahsulot bahosining o'rtachasi va soni
export function productAvg(month) {
  const rs = records.filter((r) => r.month === month && r.productScore != null);
  if (!rs.length) return { avg: null, count: 0 };
  const sum = rs.reduce((a, r) => a + (Number(r.productScore) || 0), 0);
  return { avg: sum / rs.length, count: rs.length };
}

const saveNpsRow = (it) => {
  if (!DEMO_MODE) upsert("nps_records", toRow(it), undefined, "NPS baho", true);
};

export function addNps(rec) {
  // To'ldirilgan sana — avtomat (baza ham qo'yadi, bu darrov ko'rinishi uchun)
  const it = { ...rec, id: newId(), createdAt: new Date().toISOString() };
  records = [...records, it]; persist();
  saveNpsRow(it);
  return it;
}
export function updateNps(id, patch) {
  const cur = records.find((r) => r.id === id);
  if (!cur) return;
  const it = { ...cur, ...patch };
  records = records.map((r) => (r.id === id ? it : r)); persist();
  saveNpsRow(it);
}
export function removeNps(id) {
  records = records.filter((r) => r.id !== id); persist();
  if (!DEMO_MODE) dbRemove("nps_records", id, "NPS baho");
}
