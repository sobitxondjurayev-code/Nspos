-- ══════════════════════════════════════════════════════════════
-- TOVAR ARXIVI (2026-09-03) — o'chirish o'rniga
-- ══════════════════════════════════════════════════════════════
--   node scripts/sql.mjs -f scripts/sql/products-arxiv.sql
--
-- Rahbar: "eski tovarlarni o'chirish mumkin bo'lsin". Jismoniy o'chirish
-- YO'Q: (1) Billz'dan kelgan yozuv o'chirilmaydi (2026-08-19 qoidasi);
-- (2) `sale_items.product_id` FK `on delete` siz — sotilgan tovar baribir
-- o'chmaydi; (3) Billz sinxroni `company_id,billz_id` bo'yicha qaytarib
-- keladi. Ilgari o'chirish tugmasi bor edi-yu, `products` da delete
-- siyosati yo'q edi — qator ekrandan yo'qolib, F5 da qaytib kelardi.
--
-- Ikki bayroq, ikki egasi:
--   is_active   — BILLZ'niki: to'liq katalog sinxronida Billz ro'yxatida
--                 yo'q tovar `false` bo'ladi (qaytsa `true`).
--   archived_at — NSPOS'niki: rahbar/menejer qo'lda arxivlaydi; sinxron
--                 unga TEGMAYDI (`PRODUCT_FIELDS` da yo'q).
-- Ro'yxat ikkalasi ham "faol" bo'lganini ko'rsatadi.

begin;

alter table products add column if not exists archived_at timestamptz;
alter table products add column if not exists archived_by uuid references profiles(id) on delete set null;
create index if not exists products_archived_idx on products (company_id) where archived_at is not null;

-- `products_public` (RLS'siz o'qish ko'rinishi) ham ustunlarni ko'rsin
create or replace view products_public with (security_invoker=true) as
  select id, company_id, name, sku, barcode, category_id, brand, sale_price,
         is_service, is_active, archived_at
  from products;

commit;

-- PostgREST sxema keshi — yangi ustunlar darrov ko'rinsin (aks holda
-- "Could not find the 'archived_at' column in the schema cache")
notify pgrst, 'reload schema';
