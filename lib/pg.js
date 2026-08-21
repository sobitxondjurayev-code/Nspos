// ══════════════════════════════════════════════════════════════
// POSTGRES — FAQAT SERVER TOMONIDA
// ══════════════════════════════════════════════════════════════
// Bu fayl brauzerga TUSHMAYDI ("use client" yo'q va u faqat
// `app/api/**` ichidan chaqiriladi). Baza faqat `localhost` da
// tinglaydi, ya'ni brauzerdan unga to'g'ridan-to'g'ri borib ham
// bo'lmaydi.
//
// Ilova ma'lumotni PostgREST orqali o'qiydi (RLS bilan). Bu yerdagi
// to'g'ridan-to'g'ri ulanish faqat KIRISH uchun: parolni tekshirish
// `auth.kirish()` funksiyasida bo'ladi va parol xeshi hech qachon
// baza tashqarisiga chiqmaydi.
import { Pool } from "pg";

let pool;

export function db() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30_000,
      // Ulanish osilib qolsa so'rov abadiy kutmasin
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export async function sorov(matn, qiymatlar = []) {
  const { rows } = await db().query(matn, qiymatlar);
  return rows;
}
