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
  // Supabase — baza va realtime; cbu.uz — valyuta kursi
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cbu.uz",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig = {
  // Server versiyasini oshkor qilmaydi
  poweredByHeader: false,

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
