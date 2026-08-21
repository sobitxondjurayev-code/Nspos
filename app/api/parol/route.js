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

  try {
    await sorov(
      "update auth.users set encrypted_password = crypt($2, gen_salt('bf')), updated_at = now() where id = $1",
      [claim.sub, parol]);
  } catch {
    return Response.json({ xato: "Saqlab bo'lmadi" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
