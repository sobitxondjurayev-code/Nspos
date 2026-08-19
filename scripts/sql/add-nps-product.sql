-- NPS: mahsulot bahosi (1–10) + izoh ustunlari.
-- Supabase → SQL Editor'da bir marta ishga tushiriladi.
alter table public.nps_records
  add column if not exists product_score int,
  add column if not exists product_comment text;
