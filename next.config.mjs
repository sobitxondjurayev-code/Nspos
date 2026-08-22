/** @type {import('next').NextConfig} */

// Xavfsizlik sarlavhalari. Ilgari bu fayl bo'sh edi — Vercel faqat HSTS
// qo'yardi, qolgani yo'q edi. Ya'ni saytni istalgan odam iframe ichiga
// solib, foydalanuvchiga bilintirmay tugma bostirishi mumkin edi
// (clickjacking).
//
// CSP'dagi 'unsafe-inline' va 'unsafe-eval' — Next.js ishlab chiqarish
// rejimida ham inline skript va style ishlatadi, Recharts esa o'lchash
// uchun. Ularsiz sahifa buziladi. Nonce bilan qattiqroq qilish mumkin,
// lekin u middleware talab qiladi — hozircha shu daraja.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // Baza endi O'Z serverimizda (PostgREST, /rest/v1) — ya'ni `self`.
  // Supabase manzillari 2026-08-22 da olib tashlandi: ular ishlatilmaydi
  // va CSP da turgan har ortiqcha manzil hujum yuzasini kengaytiradi.
  // cbu.uz — valyuta kursi (yagona tashqi manba).
  "connect-src 'self' https://cbu.uz",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  // Kodda qolib ketgan biror `http://` havola bo'lsa, brauzer uni
  // BLOKLAMASDAN HTTPS'ga ko'taradi. HTTPS'ga o'tishda eng ko'p
  // uchraydigan nosozlik — "aralash kontent": sahifa https, ichidagi
  // so'rov esa http, va brauzer uni jimgina tashlab yuboradi.
  "upgrade-insecure-requests",
].join("; ");

const nextConfig = {
  // Server versiyasini oshkor qilmaydi
  poweredByHeader: false,

  // ── `/` YO'NALTIRISHI SOZLAMADA ─────────────────────────────
  // Ilgari buni `app/page.jsx` qilardi: server komponenti ichida
  // `redirect("/dashboard")`. Sahifa STATIK bo'lgani uchun Next uni
  // mijoz tomonida ham qayta ishlashga urinardi va router'ning
  // hook tartibi buzilardi:
  //
  //   Minified React error #310 — "Rendered more hooks than during
  //   the previous render", Next'ning O'Z `AppRouter` komponentida.
  //
  //   Natijada saytga `tizim.enes.uz` deb kirgan odam "Application
  //   error" ko'rardi. `/login` yoki `/dashboard` ni to'g'ridan-
  //   to'g'ri ochsa esa hammasi ishlardi — shuning uchun tekshiruv
  //   buni ko'rmadi (2026-08-22).
  //
  // Sozlamadagi yo'naltirish React umuman yuklanmasdan, HTTP
  // darajasida bajariladi. Buziladigan joy qolmaydi.
  async redirects() {
    return [{ source: "/", destination: "/dashboard", permanent: false }];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      {
        // API javobi keshlanmasin
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
