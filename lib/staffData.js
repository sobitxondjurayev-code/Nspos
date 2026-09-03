"use client";
// Xodimlar. Hozircha o'rnatuvchi ustalarni biriktirish uchun kerak;
// 8-bosqichda (Boshqaruv) shu ro'yxat rollar va do'kon biriktirish bilan
// to'ldiriladi, ish haqi moduli ham shundan foydalanadi.

import { BILLZ_STAFF } from "./billzData";
import { syncTable } from "./sync";
import { supabase, DEMO_MODE, dbXabar, xatoMatni } from "./db";

// Rollar auth.js dan keladi — bitta manba bo'lishi uchun.
export { ROLES } from "./auth";

// Kassirlar haqiqiy Billz "Топ-10 продавцов" hisobotidan (KPI bilan).
// Ustalar Billz'da yo'q — o'rnatish xizmatlari NSPOS'ning o'z moduli.
let staff = BILLZ_STAFF.map((s) => ({ ...s }));

// —— Baza ————————————————————————————————————
// Xodim = auth foydalanuvchisi + profil. Yangi xodim qo'shish
// Supabase Authentication bo'limida hisob ochishni talab qiladi,
// shuning uchun bu yerdan faqat mavjud profil tahrirlanadi.
const fromRow = (r) => ({
  id: r.id,
  name: r.full_name,
  phone: r.phone ?? "",
  role: r.role,
  storeId: r.store_id,
  active: r.is_active,
  salary: Number(r.fixed_salary),
  salesPct: Number(r.sales_pct),
  servicePct: Number(r.service_pct),
  perms: r.perms ?? null,
});

const staffSync = syncTable("profiles", {
  table: "profiles",
  // O'qish ko'rinishdan: ism/rol/do'kon hammaga ko'rinadi, oylik esa
  // faqat rahbarga (boshqalarga null keladi). Yozish avvalgidek
  // profiles ga boradi — u yerda tahrir huquqi faqat rahbarda.
  readTable: "staff_directory",
  get: () => staff,
  set: (v) => { staff = v; },
  fromRow,
  toRow: (x) => ({
    full_name: x.name,
    phone: x.phone || null,
    role: x.role,
    store_id: x.storeId || null,
    is_active: x.active !== false,
    fixed_salary: x.salary ?? 0,
    sales_pct: x.salesPct ?? 0,
    service_pct: x.servicePct ?? 0,
    ...(x.perms !== undefined ? { perms: x.perms } : {}),
  }),
});

export const listStaff = () => [...staff];

// Ro'yxatni bazadan qayta o'qish. Realtime faqat O'ZI ko'ra oladigan
// qatorni yetkazadi: `profiles` da menejer uchun bu — o'z qatori
// (staff-directory.sql). Ya'ni menejer usta ochganda yangi qator
// realtime bilan KELMAYDI va ro'yxat bo'sh qolib ketardi. Shuning uchun
// usta ochilgandan/tahrirlangandan keyin shu funksiya chaqiriladi.
export async function reloadStaff() {
  if (DEMO_MODE) return;
  const { data, error } = await supabase.from("staff_directory").select("*");
  // Xato jim o'tmasin — ro'yxat eskicha qolgani ko'rinmasdi (2026-09-03)
  if (error) { dbXabar(`xodimlar ro'yxati: ${xatoMatni(error)}`); return; }
  if (!data) return;
  staff = data.map(fromRow);
}
export const getStaff = (id) => staff.find((s) => s.id === id) || null;
export const listInstallers = () => staff.filter((s) => s.role === "installer" && s.active);

export function addStaff(data) {
  const item = { id: "u" + Date.now(), active: true, ...data };
  staff = [...staff, item];
  staffSync.created(item);
  return item;
}

export function updateStaff(id, patch) {
  staff = staff.map((s) => (s.id === id ? { ...s, ...patch } : s));
  staffSync.changed(staff.find((s) => s.id === id));
}

export function removeStaff(id) {
  staff = staff.filter((s) => s.id !== id);
  staffSync.deleted(id);
}
