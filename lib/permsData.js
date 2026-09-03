"use client";
// ══════════════════════════════════════════════════════════════
// HUQUQ MATRITSASI — rol × kalit (2026-09-03)
// ══════════════════════════════════════════════════════════════
// Rahbar Sozlamalar → "Rollar va huquqlar"da belgilaydi. BITTA manba:
// `role_permissions` jadvali — bazadagi RLS (`has_perm('kalit')`) ham,
// interfeysdagi `auth.can()` ham shundan. Ilgari ikkisi alohida edi:
// rahbar xodimga bo'lim ochsa sahifa ochilar, yozuv esa RLS'da rad
// bo'lardi ("saqlash ishlamayapti").
//
// Jadval bo'sh/yuklanmagan bo'lsa `auth.js` PERMISSIONS (standart)
// ishlaydi — `allowedIn` null qaytaradi. Owner jadvalga yozilmaydi:
// u doim ruxsatli (`has_perm` ham shunday).
import { registerModule, upsert, xotiraYangilandi } from "./db";

let rows = [];
const map = new Map();          // role → Map(key → allowed)

function qur() {
  map.clear();
  for (const r of rows) {
    if (!map.has(r.role)) map.set(r.role, new Map());
    map.get(r.role).set(r.key, !!r.allowed);
  }
}

registerModule("role_permissions", {
  table: "role_permissions",
  select: "role,key,allowed,updated_at",
  realtime: true,
  fromRow: (r) => ({ role: r.role, key: r.key, allowed: !!r.allowed }),
  restore: (list) => { rows = list; qur(); },
  apply: ({ eventType, new: row, old }) => {
    const k = (x) => `${x.role}|${x.key}`;
    if (eventType === "DELETE") rows = rows.filter((x) => k(x) !== k(old));
    else { const it = { role: row.role, key: row.key, allowed: !!row.allowed }; rows = [...rows.filter((x) => k(x) !== k(it)), it]; }
    qur();
  },
});

// Jadvalda javob bo'lsa true/false, bo'lmasa null (standart ishlaydi)
export const allowedIn = (role, key) => {
  if (!rows.length) return null;
  const v = map.get(role)?.get(key);
  return v === undefined ? null : v;
};
export const permsLoaded = () => rows.length > 0;

// Rahbar belgini o'zgartiradi: xotira darrov, baza fonda, rad bo'lsa orqaga
export function setPerm(role, key, allowed) {
  const oldingi = rows;
  const it = { role, key, allowed: !!allowed };
  rows = [...rows.filter((x) => !(x.role === role && x.key === key)), it];
  qur(); xotiraYangilandi();
  return upsert("role_permissions", { role, key, allowed: !!allowed, updated_at: new Date().toISOString() },
    "company_id,role,key", "Huquq").then((r) => {
    if (r && !r.ok) { rows = oldingi; qur(); xotiraYangilandi(); }
    return r;
  });
}
