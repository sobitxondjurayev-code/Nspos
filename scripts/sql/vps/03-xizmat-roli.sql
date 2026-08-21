-- ══════════════════════════════════════════════════════════════
-- XIZMAT ROLI — Billz sinxronizatsiyasi uchun
-- ══════════════════════════════════════════════════════════════
-- Billz'dan kelgan ma'lumot RLS ni chetlab o'tib yozilishi kerak:
-- u hech kimning nomidan emas, TIZIM nomidan keladi. Supabase'da
-- bu `service_role` edi, bizda — `nspos_sync` (rolbypassrls).
--
-- Muammo (2026-08-22): `/api/billz/sync` 500 qaytarardi —
-- "permission denied to set role nspos_sync". PostgREST bazaga
-- `authenticator` sifatida ulanadi va JWT dagi rolga O'TADI
-- (`set role`). O'tish uchun esa u o'sha rolning A'ZOSI bo'lishi
-- shart. `nspos_app` ga a'zolik bor edi, `nspos_sync` ga yo'q.
--
-- XAVFSIZLIK: bu rolga faqat JWT_SECRET bilan imzolangan token
-- orqali kirish mumkin, sir esa faqat serverda (`.env.production`,
-- 600, root). Brauzerga hech qachon tushmaydi — o'zgaruvchi nomida
-- `NEXT_PUBLIC_` prefiksi yo'q.

grant nspos_sync to authenticator;

-- Chetlab o'tish YETARLI EMAS: rolda oddiy huquq ham bo'lishi kerak.
grant usage on schema public to nspos_sync;
grant select, insert, update, delete on all tables in schema public to nspos_sync;
grant usage, select on all sequences in schema public to nspos_sync;
grant execute on all functions in schema public to nspos_sync;

-- Keyin qo'shiladigan jadvallar uchun ham
alter default privileges in schema public
  grant select, insert, update, delete on tables to nspos_sync;
alter default privileges in schema public
  grant usage, select on sequences to nspos_sync;
