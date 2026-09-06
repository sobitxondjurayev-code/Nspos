-- ══════════════════════════════════════════════════════════════
-- BILLZ INVENTARIZATSIYASI — `/v2/stocktaking` ko'zgusi (2026-09-06)
-- ══════════════════════════════════════════════════════════════
--   node scripts/sql.mjs -f scripts/sql/stocktakings.sql
--
-- DAFTAR 24: ilgari "Billz'da inventarizatsiya metodi yo'q" deb
-- yozilgandi — 45 nomzod sinalgan va hammasi 404 bergandi. Kabinetning
-- o'zi kuzatilganda haqiqiy yo'l chiqdi: `/v2/stocktaking`, va u
-- integratsiya kalitiga OCHIQ. Ya'ni metod bor edi, biz nomini
-- bilmasdik.
--
-- HOZIRGI HOLAT (o'lchandi, 06.09): 8 ta hujjat, HAMMASI `type=TRANSFER`
-- — ya'ni kompaniya haqiqiy inventarizatsiya (sanoq) hali qilmagan,
-- bular transferga bog'liq jarayonlar. Ko'zgu shunga qaramay quriladi:
-- `supplier_invoices` da ham xuddi shunday qilingan (1 ta hujjat,
-- DAFTAR 20 E) — sanoq boshlangan kuni kamomad va ortiqcha o'zi keladi,
-- keyin qidirib o'tirilmaydi.
--
-- Tovar qatorlari (`items`) ro'yxatda `null`, `/v2/stocktaking/{id}`
-- esa yopiq — shuning uchun jadval SARLAVHA darajasida (transferlarda
-- ham shunday, DAFTAR 18).
begin;

create table if not exists stocktakings (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null default auth_company_id() references companies(id) on delete cascade,
  billz_id           uuid not null,
  external_id        bigint,
  name               text,
  store_id           uuid references stores(id),
  shop_name          text,                                  -- Billz nomi (bog'lanmasa ham qolsin)
  type               text,                                  -- Billz: TRANSFER | INVENTORY …
  status_id          text,
  qty                numeric(12,3) not null default 0,      -- total_measurement_value
  new_products       numeric(12,3) not null default 0,
  shortage           numeric(12,3) not null default 0,      -- kamomad (dona)
  surplus            numeric(12,3) not null default 0,      -- ortiqcha (dona)
  postponed          numeric(12,3) not null default 0,
  difference_sum     numeric(14,2) not null default 0,      -- farq summasi ($)
  process_percentage numeric(6,2)  not null default 0,
  transfer_billz_id  uuid,                                  -- transferga bog'liq bo'lsa
  created_by         text,
  finished_by        text,
  locked             boolean not null default false,
  deleted            boolean not null default false,
  created_at         timestamptz not null,
  finished_at        timestamptz,
  updated_at         timestamptz not null default now(),
  unique (company_id, billz_id)
);
create index if not exists stocktakings_created_idx on stocktakings (company_id, created_at desc);
create index if not exists stocktakings_store_idx   on stocktakings (company_id, store_id);

alter table stocktakings enable row level security;
drop policy if exists "stocktaking_read" on stocktakings;
create policy "stocktaking_read" on stocktakings
  for select to public
  using (company_id = auth_company_id());
-- Yozish faqat sinxron (nspos_sync, RLS'ni chetlab o'tadi) — ilova yozmaydi.

grant select on stocktakings to nspos_app;
grant select, insert, update, delete on stocktakings to nspos_sync;
-- `nspos` (tekshiruv roli, faqat o'qiydi)
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'nspos') then
    grant select on stocktakings to nspos;
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
