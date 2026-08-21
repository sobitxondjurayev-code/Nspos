"use client";
// ══════════════════════════════════════════════════════════════
// SESSIYA — `supabase.auth` NING O'RNI
// ══════════════════════════════════════════════════════════════
// Supabase Auth (GoTrue) o'rniga o'z tizimimiz. Interfeys ATAYLAB
// o'xshash qilingan (`getSession`, `signInWithPassword`, `signOut`,
// `onAuthStateChange`) — shunda chaqiruvchi joylar deyarli
// o'zgarmaydi va xato qilish ehtimoli kamayadi.
//
// Token cookie'da turadi va uni brauzerdagi kod O'QIY OLADI: u
// PostgREST'ga `Authorization` sarlavhasida yuborilishi kerak.
// Supabase ham xuddi shunday ishlaydi — u tokenni `localStorage` da
// saqlaydi, ya'ni bizniki undan yomonroq emas (cookie ustiga
// `SameSite=Strict` bilan boshqa saytga ketmaydi).
import { COOKIE } from "./jwt";

const kuzatuvchilar = new Set();

export function tokenOl() {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(?:^|; )" + COOKIE + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

// Tokendagi ma'lumot. IMZO TEKSHIRILMAYDI — brauzerda sir yo'q va
// bo'lishi ham kerak emas. Haqiqiy tekshiruv PostgREST'da bo'ladi:
// u imzoni tekshirmasa so'rovni rad etadi. Bu yerdagi o'qish faqat
// "kim kirgan" ni bilish uchun.
export function sessiyaOl() {
  const t = tokenOl();
  if (!t) return null;
  try {
    const p = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (p.exp && p.exp * 1000 < Date.now()) return null;
    return { token: t, user: { id: p.sub } };
  } catch {
    return null;
  }
}

export async function kirish(email, parol) {
  const r = await fetch("/api/kirish", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, parol }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { error: { message: j.xato ?? "Kirib bo'lmadi" } };
  xabar();
  return { error: null };
}

export async function chiqish() {
  await fetch("/api/chiqish", { method: "POST" });
  xabar();
}

// Sessiya o'zgarganini kuzatish
export function ozgarishda(fn) {
  kuzatuvchilar.add(fn);
  return () => kuzatuvchilar.delete(fn);
}

function xabar() {
  const s = sessiyaOl();
  for (const fn of kuzatuvchilar) fn(s);
}
