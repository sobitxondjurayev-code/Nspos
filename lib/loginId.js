// ══════════════════════════════════════════════════════════════
// TELEFON RAQAMI — LOGIN
// ══════════════════════════════════════════════════════════════
// Xodimlar telefon raqami + parol bilan kiradi. SMS ham, Supabase'da
// telefon-provayder sozlash ham kerak emas: raqam ichkarida barqaror
// "email"ga aylanadi (998901234567@nspos.app) va oddiy email+parol
// autentifikatsiyasi ishlaydi. Bu — bepul va darrov ishlaydigan yo'l.
//
// Eski hisoblar (haqiqiy email bilan ochilgan egalar) ham ishlayveradi:
// kiritishda "@" bo'lsa — email deb olinadi, aks holda telefon.

// Raqamni bir ko'rinishga keltiramiz — turli yozuv bir hisobga tushsin.
// O'zbekiston: 9 xonali raqamga 998 qo'shiladi.
export function normalizePhone(raw) {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 9) d = "998" + d;          // 901234567 -> 998901234567
  return d;
}

export const phoneToEmail = (raw) => `${normalizePhone(raw)}@nspos.app`;

// Kirish uchun login/parolni Supabase tushunadigan ko'rinishga o'giradi
export function toCredential(idRaw, password) {
  const id = String(idRaw ?? "").trim();
  if (id.includes("@")) return { email: id.toLowerCase(), password };  // eski email hisob
  return { email: phoneToEmail(id), password };
}

// Kiritish paytida jonli ajratib ko'rsatadi: +998 99 990 00 04
// (raqamlar yopishib qolmasin). Harf yoki "@" bo'lsa — eski email
// hisob deb, hech narsani o'zgartirmaymiz.
export function formatPhoneInput(raw) {
  const s = String(raw ?? "");
  if (/[a-zA-Z@]/.test(s)) return s;          // email — tegmaymiz
  let d = s.replace(/\D/g, "");
  if (d.startsWith("998")) d = d.slice(3);    // 998 prefiksni ajratamiz
  d = d.slice(0, 9);                           // mahalliy 9 xona
  if (!d) return "";
  const g = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return `+998 ${g.join(" ")}`;
}

// Ko'rsatish uchun chiroyli format: +998 90 123 45 67
export function prettyPhone(raw) {
  const d = normalizePhone(raw);
  if (d.length === 12 && d.startsWith("998")) {
    const p = d.slice(3);
    return `+998 ${p.slice(0, 2)} ${p.slice(2, 5)} ${p.slice(5, 7)} ${p.slice(7)}`;
  }
  return raw || "";
}
