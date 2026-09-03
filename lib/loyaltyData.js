"use client";
// Sodiqlik dasturi: darajalar, guruhlar va teglar.
import { sozlama } from "./companyData";
//
// Billz'da cashback foizi yagona, NSPOS'da esa xarid hajmiga qarab
// daraja beriladi — ko'p xarid qilgan mijoz yuqori foiz oladi.
// Daraja hisoblanadi, saqlanmaydi: xarid summasi o'zgarsa daraja ham
// o'zi ko'tariladi, alohida yangilash kerak emas.

// Standart — kodda; rahbar Sozlamalar → Biznes qoidalari → "Keshbek
// darajalari"da chegarani (min, $) va foizni o'zgartiradi
// (`loyalty.tiers`, 2026-09-03). Nom va rang o'zgarmaydi.
export const TIERS = [
  { key: "oddiy", name: "Oddiy", min: 0, cashbackPct: 1, color: "#94a3b8" },
  { key: "kumush", name: "Kumush", min: 500, cashbackPct: 2, color: "#a1a1aa" },
  { key: "oltin", name: "Oltin", min: 2000, cashbackPct: 3, color: "#eab308" },
  { key: "platina", name: "Platina", min: 5000, cashbackPct: 5, color: "#8b5cf6" },
];
export function tiers() {
  const s = sozlama("loyalty.tiers", null);
  if (!Array.isArray(s)) return TIERS;
  return TIERS.map((t) => {
    const o = s.find((x) => x?.key === t.key);
    return o ? { ...t, min: Number(o.min) >= 0 ? Number(o.min) : t.min,
                 cashbackPct: Number(o.cashbackPct) >= 0 ? Number(o.cashbackPct) : t.cashbackPct } : t;
  });
}

// Xarid summasiga mos eng yuqori daraja
export function tierOf(totalPurchases) {
  const v = Number(totalPurchases) || 0;
  const list = tiers();
  return [...list].reverse().find((t) => v >= t.min) ?? list[0];
}

// Keyingi darajagacha qancha qolgani — mijoz kartasida ko'rsatiladi
export function nextTier(totalPurchases) {
  const v = Number(totalPurchases) || 0;
  const next = tiers().find((t) => v < t.min);
  return next ? { tier: next, remaining: +(next.min - v).toFixed(2) } : null;
}

export const cashbackPctFor = (totalPurchases) => tierOf(totalPurchases).cashbackPct;

// —— Guruhlar va teglar ————————————————————————————
// Guruh — mijozning doimiy toifasi (bittadan ortiq bo'lishi mumkin).
// Teg — erkin belgi, tezkor filtrlash uchun.
let groups = [
  { id: "g1", name: "Ustalar", color: "#2563eb", note: "O'rnatuvchi ustalar, ko'p va muntazam oladi" },
  { id: "g2", name: "Do'konlar", color: "#059669", note: "Qayta sotuvchi do'konlar" },
  { id: "g3", name: "Yakka mijozlar", color: "#d97706", note: "Oddiy chakana xaridorlar" },
  { id: "g4", name: "Qora ro'yxat", color: "#dc2626", note: "Qarzni muntazam kechiktiradiganlar" },
];

let tags = [
  { id: "t1", name: "Qarzdor", color: "#dc2626" },
  { id: "t2", name: "Yirik mijoz", color: "#7c3aed" },
  { id: "t3", name: "Namangan", color: "#0891b2" },
  { id: "t4", name: "Optim", color: "#2563eb" },
];

let idSeq = 0;

export const listGroups = () => [...groups];
export const listTags = () => [...tags];
export const getGroup = (id) => groups.find((g) => g.id === id) || null;
export const getTag = (id) => tags.find((t) => t.id === id) || null;

export function addGroup(data) {
  const item = { id: "g" + Date.now() + "-" + idSeq++, color: "#2563eb", note: "", ...data };
  groups = [...groups, item];
  return item;
}
export function updateGroup(id, patch) {
  groups = groups.map((g) => (g.id === id ? { ...g, ...patch } : g));
}
export function removeGroup(id) {
  groups = groups.filter((g) => g.id !== id);
}

export function addTag(data) {
  const item = { id: "t" + Date.now() + "-" + idSeq++, color: "#64748b", ...data };
  tags = [...tags, item];
  return item;
}
export function removeTag(id) {
  tags = tags.filter((t) => t.id !== id);
}
