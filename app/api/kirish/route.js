// ══════════════════════════════════════════════════════════════
// KIRISH — Supabase Auth o'rnini bosadi
// ══════════════════════════════════════════════════════════════
// Xodim telefon raqami va parol bilan kiradi. Telefon ichki
// "email" ga aylantiriladi (`998…@nspos.app`) — bu naqsh
// Supabase paytidan qolgan va O'ZGARTIRILMADI: bazadagi 16 ta
// hisob aynan shu ko'rinishda yozilgan.
//
// Parol tekshiruvi BAZADA bo'ladi (`auth.kirish()`), ya'ni xesh
// hech qachon bu yerga ham, brauzerga ham chiqmaydi.
import { sorov } from "@/lib/pg";
import { imzola, COOKIE } from "@/lib/jwt";

export const dynamic = "force-dynamic";

export async function POST(req) {
  let email, parol;
  try {
    ({ email, parol } = await req.json());
  } catch {
    return Response.json({ xato: "So'rov noto'g'ri" }, { status: 400 });
  }

  if (!email || !parol) {
    return Response.json({ xato: "Telefon va parol kerak" }, { status: 400 });
  }

  let id = null;
  try {
    const r = await sorov("select auth.kirish($1, $2) as id", [email, parol]);
    id = r[0]?.id ?? null;
  } catch (e) {
    // Baza javob bermasa — bu foydalanuvchining aybi emas
    return Response.json({ xato: "Baza javob bermayapti" }, { status: 503 });
  }

  // MUHIM: "bunday odam yo'q" va "parol noto'g'ri" bir xil javob
  // beradi. Farq qilinsa, kimdir qaysi telefon ro'yxatda borligini
  // birma-bir tekshirib chiqishi mumkin bo'lardi.
  if (!id) {
    return Response.json({ xato: "Telefon yoki parol noto'g'ri" }, { status: 401 });
  }

  let role = "owner";
  try {
    const prof = await sorov("select role from profiles where id = $1", [id]);
    if (prof[0]?.role) role = prof[0].role;
  } catch {}

  // Rol va do'kon tokenga qo'yilmaydi — ular BAZADAN o'qiladi.
  // Tokenga yozilsa, xodimning roli o'zgarganda eski token
  // eski rol bilan ishlayverardi.
  const token = imzola({ sub: id });

  const res = Response.json({ ok: true, role });
  res.headers.set("set-cookie", [
    `${COOKIE}=${token}`,
    "Path=/",
    "Max-Age=43200",
    "SameSite=Strict",
    // `HttpOnly` ATAYLAB YO'Q: brauzerdagi kod tokenni o'qib,
    // PostgREST'ga yuborishi kerak. Supabase ham xuddi shunday
    // ishlaydi (u tokenni localStorage da saqlaydi), farqi —
    // cookie SameSite=Strict bilan boshqa saytga ketmaydi.
    process.env.NODE_ENV === "production" ? "Secure" : "",
  ].filter(Boolean).join("; "));
  return res;
}
