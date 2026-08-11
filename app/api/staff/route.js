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
import { createClient } from "@supabase/supabase-js";
import { phoneToEmail, normalizePhone } from "@/lib/loginId";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

// So'rovchi EGASI ekanini tekshiradi. { admin, prof } yoki { error } qaytaradi.
async function authOwner(req) {
  if (!service) return { error: json({ error: "Server sozlanmagan (service kalit yo'q)" }, 500) };
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return { error: json({ error: "Avtorizatsiya yo'q" }, 401) };

  const asCaller = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: me } = await asCaller.auth.getUser();
  if (!me?.user) return { error: json({ error: "Sessiya yaroqsiz" }, 401) };

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: prof } = await admin
    .from("profiles").select("company_id, role").eq("id", me.user.id).maybeSingle();
  if (!prof || prof.role !== "owner") {
    return { error: json({ error: "Faqat egasi bu amalni bajaradi" }, 403) };
  }
  return { admin, prof };
}

// Nishon xodim CHAQIRUVCHINING kompaniyasidami. Buni tekshirmaslik
// jiddiy teshik edi: egalikni tasdiqlagach, `id` kimniki ekani
// so'ralmasdi — ya'ni bir kompaniya egasi butun loyihadagi istalgan
// hisobning parolini va login raqamini almashtira olardi.
async function sameCompany(admin, prof, id) {
  const { data: target } = await admin
    .from("profiles").select("company_id").eq("id", id).maybeSingle();
  return !!target && target.company_id === prof.company_id;
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
  const { admin, prof, error } = await authOwner(req);
  if (error) return error;

  let body;
  try { body = await req.json(); } catch { return json({ error: "Noto'g'ri so'rov" }, 400); }
  const { phone, password, name, role, storeId, salary, salesPct, servicePct } = body;
  const digits = normalizePhone(phone);
  if (!digits || digits.length < 9 || !password || password.length < 6 || !name) {
    return json({ error: "Telefon raqami, parol (6+ belgi) va ism kerak" }, 400);
  }
  const allowed = ["owner", "manager", "cashier", "storekeeper", "installer"];
  if (!allowed.includes(role)) return json({ error: "Rol noto'g'ri" }, 400);
  if (!(await ownStore(admin, prof, storeId))) {
    return json({ error: "Bu do'kon sizning kompaniyangizda emas" }, 403);
  }

  // Telefon ichkarida barqaror email'ga aylanadi (SMS yo'q). Hisob
  // tasdiqlangan holda ochiladi — xodim darrov kiradi.
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email: phoneToEmail(phone),
    password,
    email_confirm: true,
  });
  if (cErr) {
    const dup = /registered|exists|duplicate/i.test(cErr.message);
    if (dup) return json({ error: "Bu telefon allaqachon ro'yxatda" }, 400);
    return fail(cErr, "Xodim ochilmadi. Ma'lumotlarni tekshirib qayta urinib ko'ring.");
  }

  const { error: pErr } = await admin.from("profiles").insert({
    id: created.user.id,
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
    await admin.auth.admin.deleteUser(created.user.id);
    return fail(pErr, "Profil yozilmadi. Rahbarga murojaat qiling.");
  }

  return json({ ok: true, id: created.user.id });
}

// —— Parolni yangilash (egasi xodim parolini tiklaydi) ————————————
export async function PATCH(req) {
  const { admin, prof, error } = await authOwner(req);
  if (error) return error;

  let body;
  try { body = await req.json(); } catch { return json({ error: "Noto'g'ri so'rov" }, 400); }
  const { id, password, phone } = body;
  if (!id) return json({ error: "ID kerak" }, 400);
  if (!password && !phone) return json({ error: "Parol yoki telefon kiriting" }, 400);
  // Egalik yetarli emas — xodim AYNAN shu kompaniyaniki bo'lishi shart
  if (!(await sameCompany(admin, prof, id))) {
    return json({ error: "Bu xodim sizning kompaniyangizda emas" }, 403);
  }

  // Parol (ixtiyoriy)
  if (password) {
    if (password.length < 6) return json({ error: "Parol kamida 6 belgi bo'lishi kerak" }, 400);
    const { error: pwErr } = await admin.auth.admin.updateUserById(id, { password });
    if (pwErr) return fail(pwErr, "Parolni yangilab bo'lmadi.");
  }

  // Telefon (login) — ixtiyoriy. Auth email (raqam@nspos.app) va profil
  // telefonini birga yangilaymiz. Boshqa hisob bilan to'qnashsa — xato.
  if (phone) {
    const digits = normalizePhone(phone);
    if (!digits || digits.length < 12) return json({ error: "Telefon raqami noto'g'ri" }, 400);
    const { error: eErr } = await admin.auth.admin.updateUserById(id, {
      email: phoneToEmail(phone), email_confirm: true,
    });
    if (eErr) {
      const dup = /registered|exists|duplicate/i.test(eErr.message);
      if (dup) return json({ error: "Bu telefon allaqachon band" }, 400);
      return fail(eErr, "Telefon raqamini yangilab bo'lmadi.");
    }
    await admin.from("profiles").update({ phone: phone.trim() }).eq("id", id);
  }

  return json({ ok: true });
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status, headers: { "Content-Type": "application/json" },
  });

// Baza xatosini brauzerga o'z holicha qaytarmaymiz: u jadval va ustun
// nomlarini, ba'zan cheklov nomlarini oshkor qiladi. Batafsili server
// jurnaliga tushadi (Vercel logs), foydalanuvchi esa nima qilishini
// tushunadigan qisqa xabar oladi.
function fail(err, human, status = 400) {
  console.error("[api/staff]", err?.message ?? err);
  return json({ error: human }, status);
}
