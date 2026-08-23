-- ══════════════════════════════════════════════════════════════
-- XODIM HISOBINI OCHISH VA LOGINNI ALMASHTIRISH
-- ══════════════════════════════════════════════════════════════
-- NEGA KERAK (2026-08-24):
-- `app/api/staff/route.js` Supabase'ning admin API'siga tayanardi —
-- `admin.auth.admin.createUser()`, `updateUserById()`, `deleteUser()`.
-- Supabase 2026-08-23 da butunlay olib tashlangan, ya'ni bu uchala
-- chaqiriq ham mavjud bo'lmagan yo'lga borardi:
--
--   • yangi xodim OCHILMASDI
--   • parol TIKLANMASDI      (menejer ustaga login bera olmasdi —
--                             CLAUDE.md, 2026-08-13 dagi talab)
--   • telefon (login) ALMASHMASDI
--
-- Marshrut xatoni yutib, "Xodim ochilmadi" deb qaytarardi va sabab
-- hech qayerda ko'rinmasdi.
--
-- `auth.kirish()` va `auth.parol_almashtir()` allaqachon bor
-- (`scripts/sql/vps/00-shim.sql`). Yetishmagani — hisob OCHISH va
-- EMAIL almashtirish. Ikkalasi ham shu yerda.
--
-- Nega SQL funksiyasi, ilovadan `insert` emas: `auth.users` ga
-- `nspos_app` roli umuman tegolmaydi (select ham, insert ham yo'q) —
-- va shunday qolishi kerak. Parol xeshi baza ichida yaraladi, ilova
-- tomonga hech qachon chiqmaydi.

-- ── Yangi hisob ochish ────────────────────────────────────────
-- Qaytaradi: yangi id, yoki NULL — email band bo'lsa.
-- Xato TASHLANMAYDI: "bu telefon allaqachon ro'yxatda" — oddiy holat,
-- uni chaqiruvchi foydalanuvchiga tushunarli qilib aytadi.
create or replace function auth.foydalanuvchi_ochish(p_email text, p_parol text)
returns uuid
language plpgsql
security definer
set search_path to 'auth', 'public', 'pg_temp'
as $$
declare
  yangi uuid;
begin
  if p_email is null or p_parol is null or length(p_parol) < 6 then
    return null;
  end if;

  -- O'chirilgan hisob ham band hisoblanadi: uni tiriltirish alohida
  -- qaror, jimgina ustiga yozib yuborilmaydi (CLAUDE.md: hech narsa
  -- o'chirilmaydi va birlashtirilmaydi).
  if exists (select 1 from auth.users where lower(email) = lower(p_email)) then
    return null;
  end if;

  insert into auth.users (id, email, encrypted_password, email_confirmed_at)
  values (gen_random_uuid(), lower(p_email), crypt(p_parol, gen_salt('bf')), now())
  returning id into yangi;

  return yangi;
end;
$$;

-- ── Loginni (email) almashtirish ──────────────────────────────
-- Qaytaradi: true — almashdi, false — topilmadi yoki band.
create or replace function auth.email_almashtir(p_id uuid, p_email text)
returns boolean
language plpgsql
security definer
set search_path to 'auth', 'public', 'pg_temp'
as $$
begin
  if p_email is null or p_id is null then
    return false;
  end if;
  -- Boshqa birovda bormi. O'ZIDA bo'lsa xato emas — bir xil raqamni
  -- qayta saqlash oddiy holat.
  if exists (
    select 1 from auth.users
    where lower(email) = lower(p_email) and id <> p_id
  ) then
    return false;
  end if;

  update auth.users
     set email = lower(p_email),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at = now()
   where id = p_id and deleted_at is null;
  return found;
end;
$$;

-- ── Yarim ochilgan hisobni orqaga qaytarish ───────────────────
-- Hisob ochildi-yu, profil yozilmadi (masalan do'kon id noto'g'ri) —
-- o'sha bo'sh qatorni olib tashlaydi. Aks holda telefon "band" bo'lib
-- qolardi va xodim qayta ochilmasdi.
--
-- Bu CLAUDE.md dagi "hech narsa o'chirilmaydi" qoidasiga zid EMAS:
-- qoida BIZNES ma'lumotiga tegishli (mijoz, sotuv, qarz). Bu yerda
-- esa bir necha millisekund oldin yaralgan, PROFILI YO'Q qator.
-- Shart aynan shuni mahkamlaydi: profili bor hisobga tegmaydi.
create or replace function auth.foydalanuvchi_ochirish(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'auth', 'public', 'pg_temp'
as $$
begin
  if exists (select 1 from public.profiles where id = p_id) then
    return false;   -- profili bor — bu biznes ma'lumoti, tegilmaydi
  end if;
  delete from auth.users where id = p_id;
  return found;
end;
$$;

-- Ilova roli — funksiyalarni chaqira oladi, `auth.users` ga esa
-- baribir tegolmaydi (huquq berilmagan).
grant execute on function auth.foydalanuvchi_ochish(text, text) to nspos_app;
grant execute on function auth.email_almashtir(uuid, text) to nspos_app;
grant execute on function auth.foydalanuvchi_ochirish(uuid) to nspos_app;
