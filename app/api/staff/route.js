// ══════════════════════════════════════════════════════════════
// XODIM OCHISH — SERVER YO'LI
// ══════════════════════════════════════════════════════════════
// Egasi Sozlamalardan xodim qo'shsa, shu yo'l chaqiriladi. Bu yerda
// service kalit ISHLATILADI — u faqat serverda, brauzerga hech qachon
// tushmaydi. Shuning uchun bu fayl "use client" EMAS va Vercel'da
// server funksiyasi sifatida ishlaydi.
//
// Nega admin orqali: Supabase bepul tarifda tasdiqlash xatini soatiga
// bir-ikki marta yuboradi ("email rate limit"). Admin bilan ochilgan
// hisob tasdiqlangan holda keladi — xat umuman yuborilmaydi, xodim
// darrov kiradi.
import { phoneToEmail, normalizePhone } from "@/lib/loginId";
import { kimChaqirdi, json } from "@/lib/apiAuth";
import { sorov } from "@/lib/pg";

// Bazaga ikki yo'ldan boriladi va ikkalasi ham `lib/` da:
//   • `admin` (service kalit → PostgREST, RLS chetlab) — profiles,
//     stores. `lib/apiAuth.js` beradi, ichki manzil o'sha yerda.
//   • `sorov` (to'g'ridan-to'g'ri Postgres) — `auth` sxemasi.
//     PostgREST faqat `public` ni ko'radi, ya'ni parol funksiyalariga
//     u orqali borib bo'lmaydi.
//
// So'rovchini aniqlaydi. { admin, prof } yoki { error } qaytaradi.
//
// Egasi hamma rol bilan ishlaydi. Menejer esa faqat USTA hisobini
// ocha/tiklay oladi — do'kon menejeri kundalik ishni ustalar bilan
// yuritadi va yangi usta kelganda rahbarni kutib turmasligi kerak.
// Cheklov shu yerda: `role` va nishon xodim har amalda tekshiriladi.
// Tekshiruv `lib/apiAuth.js` da — u tokenni O'Z imzomiz bilan ko'radi.
// Ilgari bu yerda `asCaller.auth.getUser()` turardi (Supabase Auth),
// u 2026-08-23 da olib tashlangan: marshrut ishlashdan to'xtagan va
// menejer ustaga login ocholmay qolgan. (2026-08-24 da topildi.)
const authCaller = (req) => kimChaqirdi(req, ["owner", "manager"]);

// Nishon xodim CHAQIRUVCHINING kompaniyasidami va u bilan ishlashga
// huquq bormi. Kompaniyani tekshirmaslik jiddiy teshik edi: egalikni
// tasdiqlagach, `id` kimniki ekani so'ralmasdi — ya'ni bir kompaniya
// egasi butun loyihadagi istalgan hisobning parolini va login raqamini
// almashtira olardi. Menejer uchun esa yana bitta shart: nishon FAQAT
// usta bo'lsin — aks holda u rahbarning parolini almashtirib,
// hisobiga kirib olardi.
async function canTouch(admin, prof, id) {
  const { data: target } = await admin
    .from("profiles").select("company_id, role").eq("id", id).maybeSingle();
  if (!target || target.company_id !== prof.company_id) {
    return { ok: false, msg: "Bu xodim sizning kompaniyangizda emas" };
  }
  if (prof.role !== "owner" && target.role !== "installer") {
    return { ok: false, msg: "Siz faqat ustalar hisobini boshqarasiz" };
  }
  return { ok: true };
}

// Do'kon ham o'z kompaniyanikimi — xodimni begona do'konga biriktirib
// bo'lmasin
async function ownStore(admin, prof, storeId) {
  if (!storeId) return true;
  const { data: s } = await admin
    .from("stores").select("company_id").eq("id", storeId).maybeSingle();
  return !!s && s.company_id === prof.company_id;
}

// —— Yangi xodim ochish ————————————————————————————————
export async function POST(req) {
  const { admin, prof, error } = await authCaller(req);
  if (error) return error;

  let body;
  try { body = await req.json(); } catch { return json({ error: "Noto'g'ri so'rov" }, 400); }
  const { phone, password, name, role } = body;
  let { storeId, salary, salesPct, servicePct } = body;
  const digits = normalizePhone(phone);
  if (!digits || digits.length < 9 || !password || password.length < 6 || !name) {
    return json({ error: "Telefon raqami, parol (6+ belgi) va ism kerak" }, 400);
  }
  const allowed = ["owner", "manager", "cashier", "storekeeper", "installer"];
  if (!allowed.includes(role)) return json({ error: "Rol noto'g'ri" }, 400);
  // Menejer faqat usta ocha oladi va pul shartlariga tegmaydi — ish haqi
  // rahbarning ishi (u menejerga oylik ustunlarini umuman ko'rsatmaydi
  // ham: staff_directory ularni null qaytaradi).
  if (prof.role !== "owner") {
    if (role !== "installer") return json({ error: "Siz faqat usta hisobini ocha olasiz" }, 403);
    // Usta do'konga biriktirilmaydi: u ikkala do'kon buyurtmasiga ham
    // chiqadi va reytingda kompaniya bo'yicha turadi (mavjud ustalarning
    // hammasida store_id bo'sh). Ish haqi shartlari — rahbarning ishi.
    storeId = null;
    salary = 0; salesPct = 0; servicePct = 0;
  }
  if (!(await ownStore(admin, prof, storeId))) {
    return json({ error: "Bu do'kon sizning kompaniyangizda emas" }, 403);
  }

  // Telefon ichkarida barqaror email'ga aylanadi (SMS yo'q). Hisob
  // tasdiqlangan holda ochiladi — xodim darrov kiradi.
  //
  // Parol BAZA ICHIDA xeshlanadi (`auth.foydalanuvchi_ochish`), ochiq
  // matn hech qaerga yozilmaydi. Ilgari bu yerda Supabase admin API
  // turardi — u olib tashlangandan keyin xodim ochish umuman
  // ishlamay qolgan edi (scripts/sql/auth-xodim.sql dagi izoh).
  let yangiId;
  try {
    const r = await sorov("select auth.foydalanuvchi_ochish($1, $2) as id",
      [phoneToEmail(phone), password]);
    yangiId = r[0]?.id ?? null;
  } catch (e) {
    return fail(e, "Xodim ochilmadi. Ma'lumotlarni tekshirib qayta urinib ko'ring.");
  }
  if (!yangiId) return json({ error: "Bu telefon allaqachon ro'yxatda" }, 400);

  const { error: pErr } = await admin.from("profiles").insert({
    id: yangiId,
    company_id: prof.company_id,
    full_name: name.trim(),
    phone: phone.trim(),
    role,
    store_id: storeId || null,
    fixed_salary: salary ?? 0,
    sales_pct: salesPct ?? 0,
    service_pct: servicePct ?? 0,
  });
  if (pErr) {
    // Yarim ochilgan hisobni orqaga qaytaramiz — aks holda telefon
    // "band" bo'lib qolardi va xodim qayta ochilmasdi. Funksiya
    // profili BOR hisobga tegmaydi.
    try { await sorov("select auth.foydalanuvchi_ochirish($1)", [yangiId]); } catch {}
    return fail(pErr, "Profil yozilmadi. Rahbarga murojaat qiling.");
  }

  return json({ ok: true, id: yangiId });
}

// —— Login ma'lumotini yangilash (parol tiklash, raqam/ism almashtirish) ——
export async function PATCH(req) {
  const { admin, prof, error } = await authCaller(req);
  if (error) return error;

  let body;
  try { body = await req.json(); } catch { return json({ error: "Noto'g'ri so'rov" }, 400); }
  const { id, password, phone, name } = body;
  if (!id) return json({ error: "ID kerak" }, 400);
  if (!password && !phone && !name) return json({ error: "O'zgartirish uchun ma'lumot yo'q" }, 400);
  // Egalik yetarli emas — xodim AYNAN shu kompaniyaniki bo'lishi shart,
  // menejer uchun esa ustadan boshqasiga tegib bo'lmaydi
  const touch = await canTouch(admin, prof, id);
  if (!touch.ok) return json({ error: touch.msg }, 403);

  // Parol (ixtiyoriy). Xesh baza ichida yaraladi — ochiq parol
  // ilovadan nariga o'tmaydi.
  if (password) {
    if (password.length < 6) return json({ error: "Parol kamida 6 belgi bo'lishi kerak" }, 400);
    let ok;
    try {
      const r = await sorov("select auth.parol_almashtir($1, $2) as ok", [id, password]);
      ok = r[0]?.ok === true;
    } catch (e) { return fail(e, "Parolni yangilab bo'lmadi."); }
    if (!ok) return fail(new Error("parol_almashtir=false"), "Parolni yangilab bo'lmadi.");
  }

  // Telefon (login) — ixtiyoriy. Auth email (raqam@nspos.app) va profil
  // telefonini birga yangilaymiz. Boshqa hisob bilan to'qnashsa — xato.
  if (phone) {
    const digits = normalizePhone(phone);
    if (!digits || digits.length < 12) return json({ error: "Telefon raqami noto'g'ri" }, 400);
    let ok;
    try {
      const r = await sorov("select auth.email_almashtir($1, $2) as ok", [id, phoneToEmail(phone)]);
      ok = r[0]?.ok === true;
    } catch (e) { return fail(e, "Telefon raqamini yangilab bo'lmadi."); }
    if (!ok) return json({ error: "Bu telefon allaqachon band" }, 400);
    await admin.from("profiles").update({ phone: phone.trim() }).eq("id", id);
  }

  // Ism (ixtiyoriy). Menejer profiles ga to'g'ridan-to'g'ri yoza olmaydi
  // (RLS faqat rahbarda), shuning uchun ustaning ismi ham shu yo'ldan
  // o'tadi — bitta joyda tekshiriladi.
  if (name && name.trim()) {
    const { error: nErr } = await admin
      .from("profiles").update({ full_name: name.trim() }).eq("id", id);
    if (nErr) return fail(nErr, "Ismni yangilab bo'lmadi.");
  }

  return json({ ok: true });
}

// Baza xatosini brauzerga o'z holicha qaytarmaymiz: u jadval va ustun
// nomlarini, ba'zan cheklov nomlarini oshkor qiladi. Batafsili server
// jurnaliga tushadi (Vercel logs), foydalanuvchi esa nima qilishini
// tushunadigan qisqa xabar oladi.
function fail(err, human, status = 400) {
  console.error("[api/staff]", err?.message ?? err);
  return json({ error: human }, status);
}
