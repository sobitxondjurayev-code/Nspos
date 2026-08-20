-- ══════════════════════════════════════════════════════════════
-- AUTH QATLAMI — Supabase o'rnini bosuvchi
-- ══════════════════════════════════════════════════════════════
-- Muammo: bazadagi 56 ta RLS siyosati `auth.uid()` va `auth.role()`
-- ga murojaat qiladi. Bular Supabase'ning `auth` sxemasidan keladi,
-- oddiy Postgres'da esa yo'q.
--
-- Birinchi o'y — siyosatlarni qayta yozish edi. QILINMADI: 56 ta
-- siyosat, har biri pul va maosh ko'rinishini boshqaradi. Bittasida
-- adashilsa menejer boshqa do'konning raqamini ko'rib qoladi va buni
-- hech kim payqamaydi.
--
-- Yechim: `auth.uid()` ning O'ZI yoziladi. Shunda siyosatlar BIR HARF
-- ham o'zgarmaydi — ular qanday bo'lsa shundayligicha ko'chadi.
--
-- Qanday ishlaydi: har so'rov boshida server kim so'rayotganini
-- ulanishga yozib qo'yadi:
--     select set_config('app.user_id', '<foydalanuvchi id>', true);
-- `true` — FAQAT shu tranzaksiya uchun, ya'ni ulanish qayta
-- ishlatilganda oldingi foydalanuvchi qolib ketmaydi (ulanish
-- havzasida bu eng xavfli xato bo'lardi).

-- `crypt()` shu yerdan keladi — parol tekshiruvi unga tayanadi.
-- 01-sxema.sql da ham bor, lekin u KEYIN yuriladi: shim birinchi
-- bo'lgani uchun kengaytma shu yerda ham chaqiriladi.
create extension if not exists pgcrypto;

create schema if not exists auth;

-- Kim so'rayapti. Qo'yilmagan bo'lsa NULL — ya'ni hech narsa
-- ko'rinmaydi. Xatoga yo'l qo'yilganda "hamma narsa ochiq" emas,
-- "hech narsa ochiq emas" holatiga tushishi kerak.
--
-- IKKI manbani biladi, chunki bazaga ikki yo'ldan kelinadi:
--   1. `request.jwt.claims` — PostgREST shu yerga JWT ichini yozadi
--      (Supabase ham aynan shunday qiladi). Ilova shu yo'ldan keladi.
--   2. `app.user_id` — to'g'ridan-to'g'ri ulanish (skriptlar,
--      migratsiya, tekshiruv). JWT yasab o'tirish shart emas.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    nullif(current_setting('app.user_id', true), '')
  )::uuid;
$$;

-- Supabase'da `auth.role()` kirgan foydalanuvchi uchun
-- 'authenticated', kirmagani uchun 'anon' qaytaradi. Aynan shu
-- ma'noni saqlaymiz.
create or replace function auth.role()
returns text
language sql
stable
as $$
  select case when auth.uid() is null then 'anon' else 'authenticated' end;
$$;

-- ── Foydalanuvchilar jadvali ──────────────────────────────────
-- To'rtta tashqi kalit `auth.users(id)` ga tayanadi (`profiles`,
-- `kpi_assign`, `kpi_day`, `kpi_plan`). Ularni uzib tashlash mumkin
-- edi, lekin shunda o'chirilgan xodimning KPI qatorlari bazada
-- osilib qolardi. Shuning uchun jadvalning o'zi yoziladi.
--
-- Supabase'dagi asl jadvalda 35 ta ustun bor — ularning ko'pi
-- Supabase'ning o'z ishi uchun (SSO, telefon tasdiqlash, email
-- almashtirish tokenlari). Bu yerda faqat ILOVA ishlatadigani.
--
-- MUHIM: parol `$2a$…` ko'rinishida, ya'ni bcrypt. `pgcrypto` uni
-- tushunadi — demak 16 ta xodimning HOZIRGI paroli o'z holicha
-- ko'chadi va hech kim parol almashtirmaydi.
create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  phone               text,
  encrypted_password  text,
  email_confirmed_at  timestamptz,
  last_sign_in_at     timestamptz,
  raw_user_meta_data  jsonb   not null default '{}'::jsonb,
  banned_until        timestamptz,
  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Kirish tekshiruvi. Parol xeshi ilovaga HECH QACHON berilmaydi:
-- ilova bu funksiyani chaqiradi, u esa faqat id qaytaradi.
-- `security definer` — funksiya egasi huquqi bilan ishlaydi, ya'ni
-- ilova roli `auth.users` ni o'qiy olmasa ham kirish ishlaydi.
create or replace function auth.kirish(p_email text, p_parol text)
returns uuid
language sql
security definer
set search_path = auth, public, pg_temp
as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(p_email)
    and u.deleted_at is null
    and (u.banned_until is null or u.banned_until < now())
    and u.encrypted_password = crypt(p_parol, u.encrypted_password);
$$;

-- ── Rollar ────────────────────────────────────────────────────
-- RLS jadval EGASIGA qo'llanmaydi. Ya'ni ilova jadval egasi bo'lib
-- ulansa, butun himoya jimgina o'chib qoladi va buni hech qanday
-- xato ko'rsatmaydi. Shuning uchun uch rol:
--
--   nspos_owner — jadvallar EGASI. Faqat migratsiya uchun.
--   nspos_app   — ilova shu bilan ulanadi. Egasi EMAS → RLS ishlaydi.
--   nspos_sync  — Billz sinxronizatsiyasi va zaxira. RLS'dan o'tadi
--                 (Supabase'dagi service_role o'rni).
--
-- Parol bu faylda YO'Q — u serverda alohida qo'yiladi:
--   alter role nspos_app with password '…';
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'nspos_owner') then
    create role nspos_owner nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'nspos_app') then
    create role nspos_app login;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'nspos_sync') then
    create role nspos_sync login bypassrls;
  end if;
end $$;

grant usage on schema public, auth to nspos_app, nspos_sync;
grant execute on all functions in schema auth to nspos_app, nspos_sync;

-- `auth.users` ILOVA roliga BERILMAYDI — u yerda parol xeshlari bor.
-- Ilova faqat `auth.kirish()` orqali ishlaydi (yuqorida, security
-- definer). Sinxronizatsiya/zaxira roli esa to'liq o'qiydi.
grant select, insert, update on auth.users to nspos_sync;

-- Kelajakda yaratiladigan jadvallarga ham o'zi tarqalsin
alter default privileges in schema public
  grant select, insert, update, delete on tables to nspos_app;
alter default privileges in schema public
  grant select, insert, update, delete on tables to nspos_sync;
alter default privileges in schema public
  grant usage, select on sequences to nspos_app, nspos_sync;
