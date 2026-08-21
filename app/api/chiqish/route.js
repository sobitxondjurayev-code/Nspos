import { COOKIE } from "@/lib/jwt";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = Response.json({ ok: true });
  // Muddatni o'tmishga qo'yish — cookie'ni o'chirishning yagona yo'li
  res.headers.set("set-cookie", `${COOKIE}=; Path=/; Max-Age=0; SameSite=Strict`);
  return res;
}
