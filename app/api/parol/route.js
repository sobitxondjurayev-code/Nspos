// ══════════════════════════════════════════════════════════════
// PAROLNI ALMASHTIRISH
// ══════════════════════════════════════════════════════════════
// Xesh BAZADA yasaladi (`crypt` + `gen_salt('bf')`), ya'ni ochiq
// parol na bu yerda, na jurnalda qolmaydi.
import { sorov } from "@/lib/pg";
import { tekshir } from "@/lib/jwt";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const claim = tekshir(token);
  if (!claim?.sub) return Response.json({ xato: "Kirilmagan" }, { status: 401 });

  let parol;
  try { ({ parol } = await req.json()); } catch { parol = null; }

  // Uzunlik SERVERDA ham tekshiriladi. Brauzerdagi tekshiruv
  // qulaylik uchun — uni chetlab o'tish oson.
  if (!parol || String(parol).length < 6) {
    return Response.json({ xato: "Parol kamida 6 belgi bo'lishi kerak" }, { status: 400 });
  }

  // To'g'ridan-to'g'ri `update auth.users` QILINMAYDI: ilova roli
  // o'sha jadvalga yozish huquqiga ega emas va bo'lmasligi ham kerak —
  // u yerda hamma xodimning paroli turadi. Funksiya esa faqat bitta
  // qatorning faqat parol ustunini o'zgartiradi.
  try {
    const r = await sorov("select auth.parol_almashtir($1, $2) as ok", [claim.sub, parol]);
    if (!r[0]?.ok) return Response.json({ xato: "Saqlab bo'lmadi" }, { status: 400 });
  } catch {
    return Response.json({ xato: "Baza javob bermayapti" }, { status: 503 });
  }
  return Response.json({ ok: true });
}
