"use client";
// ══════════════════════════════════════════════════════════════
// XODIM TAKLIFLARI
// ══════════════════════════════════════════════════════════════
// Egasi yangi xodimni email va rol bilan qayd qiladi. Xodim o'sha
// email bilan ro'yxatdan o'tganda profili avtomatik yaratiladi
// (schema.sql, handle_new_user triggeri) va taklif o'chadi.
import { syncTable } from "./sync";

let invites = [];

const inviteSync = syncTable("invites", {
  table: "invites",
  order: { column: "created_at", ascending: false },
  get: () => invites,
  set: (v) => { invites = v; },
  fromRow: (r) => ({
    id: r.id,
    email: r.email,
    name: r.full_name,
    phone: r.phone ?? "",
    role: r.role,
    storeId: r.store_id,
    salary: Number(r.fixed_salary),
    salesPct: Number(r.sales_pct),
    servicePct: Number(r.service_pct),
    at: r.created_at,
  }),
  toRow: (x) => ({
    email: x.email.trim().toLowerCase(),
    full_name: x.name,
    phone: x.phone || null,
    role: x.role,
    store_id: x.storeId || null,
    fixed_salary: x.salary ?? 0,
    sales_pct: x.salesPct ?? 0,
    service_pct: x.servicePct ?? 0,
  }),
});

export const listInvites = () => [...invites];

let seq = 0;
export function addInvite(data) {
  const item = { id: "inv-" + Date.now() + "-" + seq++, at: new Date().toISOString(), ...data };
  invites = [item, ...invites];
  inviteSync.created(item);
  return item;
}

export function removeInvite(id) {
  invites = invites.filter((i) => i.id !== id);
  inviteSync.deleted(id);
}
