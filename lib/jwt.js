// ══════════════════════════════════════════════════════════════
// JWT — IMZOLASH VA TEKSHIRISH
// ══════════════════════════════════════════════════════════════
// PostgREST kirgan foydalanuvchini shu token orqali taniydi: u
// imzoni tekshiradi va `sub` ni `request.jwt.claims` ga qo'yadi,
// bazadagi `auth.uid()` esa o'shani o'qiydi.
//
// Kutubxona ishlatilmadi — kerak bo'lgani HMAC-SHA256, u Node'ning
// o'zida bor. Bitta bog'liqlik kam bo'lgani yaxshi: har yangi paket
// yangilanishi va xavfsizlik ogohlantirishi bilan keladi.
import { createHmac, timingSafeEqual } from "crypto";

const b64 = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

const sir = () => {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET yo'q yoki juda qisqa");
  return s;
};

// Token qancha yashaydi. Uzoq bo'lsa — o'g'irlangani uzoq ishlaydi;
// qisqa bo'lsa — xodim ish kuni davomida qayta-qayta kiradi.
// 12 soat: bir ish kunini qoplaydi, ertasiga qaytadan kiriladi.
const UMR = 12 * 60 * 60;

export function imzola(payload) {
  const head = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64(JSON.stringify({
    ...payload,
    // PostgREST shu ikkisini talab qiladi
    role: "nspos_app",
    aud: "authenticated",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + UMR,
  }));
  const imzo = b64(createHmac("sha256", sir()).update(`${head}.${body}`).digest());
  return `${head}.${body}.${imzo}`;
}

// Xato bo'lsa NULL qaytaradi — chaqiruvchi "kirmagan" deb qaraydi.
// Xato tashlanmaydi: buzuq token oddiy holat, ilova yiqilmasligi kerak.
export function tekshir(token) {
  try {
    const [head, body, imzo] = String(token ?? "").split(".");
    if (!head || !body || !imzo) return null;

    const kutilgan = createHmac("sha256", sir()).update(`${head}.${body}`).digest();
    const kelgan = unb64(imzo);
    // `timingSafeEqual` — imzoni belgima-belgi solishtirish vaqti
    // bo'yicha sirni fosh qilmasligi uchun
    if (kelgan.length !== kutilgan.length) return null;
    if (!timingSafeEqual(kelgan, kutilgan)) return null;

    const p = JSON.parse(unb64(body).toString());
    if (p.exp && p.exp < Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch {
    return null;
  }
}

export const COOKIE = "nspos_token";
