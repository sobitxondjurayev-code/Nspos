// ══════════════════════════════════════════════════════════════
// SO'ROVNI KIM YUBORDI — SERVER MARSHRUTLARI UCHUN
// ══════════════════════════════════════════════════════════════
// Faqat `app/api/**` ichidan chaqiriladi (brauzerga tushmaydi).
//
// NEGA BU FAYL PAYDO BO'LDI (2026-08-24):
// Uchta marshrut — `/api/billz/sync`, `/api/backup`, `/api/staff` —
// hali ham `supabase.auth.getUser(token)` bilan tekshirardi. Supabase
// Auth esa 2026-08-23 da butunlay olib tashlangan (CLAUDE.md: kirish
// o'z JWT'imiz bilan). PostgREST'da `/auth/v1/user` degan yo'l yo'q,
// shuning uchun:
//
//   { data: { user } } = await admin.auth.getUser(...)
//
// `data` null bo'lib qaytardi va destrukturizatsiya TypeError berardi.
// Ya'ni javob "401 Ruxsat yo'q" emas, **500** edi — nginx jurnalida
// 22-avgustda 43 ta `GET /api/billz/sync → 500`. Rahbar Sozlamalardagi
// "Billz'dan yangilash" tugmasini bosardi va "server xatosi" ko'rardi.
// `/api/staff` ham shu sabab ishlamasdi: menejer ustaga login ocholmasdi.
//
// Endi tekshiruv BITTA joyda: token o'z imzomiz bilan tekshiriladi
// (`lib/jwt.js`), rol esa BAZADAN o'qiladi — tokenga yozilmagan, chunki
// xodimning roli o'zgarganda eski token eski rol bilan ishlayverardi.
import { createClient } from "@supabase/supabase-js";
import { tekshir, COOKIE } from "./jwt";

const url = process.env.NSPOS_REST_INTERNAL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json" },
  });
}

// RLS'ni chetlab o'tadigan mijoz — rol va kompaniyani tekshirish uchun.
// Bu kalit brauzerga HECH QACHON chiqmaydi.
export const adminDb = () => createClient(url, service, { auth: { persistSession: false } });

// Token `Authorization: Bearer …` da yoki cookie'da bo'lishi mumkin.
// Cookie ham qabul qilinadi: `fetch` bir xil manzilga borganda uni
// o'zi qo'shadi, ya'ni chaqiruvchi sarlavhani unutsa ham ishlaydi.
export function tokenOlish(req) {
  const auth = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (auth) return auth;
  const raw = req.headers.get("cookie") || "";
  const m = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : "";
}

// Cron o'z siri bilan keladi (`06-billz-cron.sh`, `05-zaxira.sh`).
// Sir sozlanmagan bo'lsa bu yo'l umuman ochilmaydi.
export function cronmi(req) {
  const sir = process.env.CRON_SECRET;
  return !!sir && tokenOlish(req) === sir;
}

/**
 * Kim chaqirdi. Muvaffaqiyatda { admin, prof }, aks holda { error }.
 *
 * @param {Request} req
 * @param {string[]} rollar — ruxsat etilgan rollar (bo'sh bo'lsa hammasi)
 */
export async function kimChaqirdi(req, rollar = []) {
  if (!url || !service) {
    return { error: json({ error: "Server sozlanmagan (service kalit yo'q)" }, 500) };
  }
  const token = tokenOlish(req);
  if (!token) return { error: json({ error: "Avtorizatsiya yo'q" }, 401) };

  // `tekshir` imzoni ham, muddatni ham ko'radi va xato bo'lsa null
  // qaytaradi — muddati o'tgan token "kirmagan" bilan bir xil.
  const p = tekshir(token);
  if (!p?.sub) return { error: json({ error: "Sessiya yaroqsiz" }, 401) };

  const admin = adminDb();
  const { data: prof } = await admin
    .from("profiles").select("id, company_id, role, store_id").eq("id", p.sub).maybeSingle();
  if (!prof) return { error: json({ error: "Sessiya yaroqsiz" }, 401) };
  if (rollar.length && !rollar.includes(prof.role)) {
    return { error: json({ error: "Bu amalni bajarishga huquqingiz yo'q" }, 403) };
  }
  return { admin, prof };
}
