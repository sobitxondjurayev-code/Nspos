-- ══════════════════════════════════════════════════════════════
-- BILLZ XARID HUJJATI (supplier-order) KO'ZGUSI — 2026-09-05, DAFTAR 20 E
-- ══════════════════════════════════════════════════════════════
--   node scripts/sql.mjs -f scripts/sql/supplier-orders.sql
--
-- Billz `/v2/supplier-order` ochiq (probe 05.09), lekin kompaniya uni
-- ISHLATMAYDI: butun tarixda 1 ta hujjat (14.10.2025, 21 $). Ko'zgu
-- shunga qaramay quriladi — rahbar Billz'da xaridni yuritishni
-- boshlasa, ta'minotchi qarzi (AP) va ombor kirimi o'zi keladi.
-- `supplier_invoices` jadvali kengaytiriladi (yangi jadval emas —
-- balans `payablesSummary` shundan o'qiydi, ikkinchi ta'rif bo'lmasin).
begin;

alter table supplier_invoices
  add column if not exists billz_id      uuid,
  add column if not exists store_id      uuid references stores(id),
  add column if not exists supplier_name text,
  add column if not exists supply_total  numeric(14,2),
  add column if not exists retail_total  numeric(14,2),
  add column if not exists qty           numeric(12,3),
  add column if not exists status_id     text,
  add column if not exists paid_amount   numeric(14,2) not null default 0,
  add column if not exists source        text not null default 'nspos',
  add column if not exists accepted_at   timestamptz,
  add column if not exists updated_at    timestamptz not null default now();

-- Billz hujjatida ta'minotchi bog'lanmagan bo'lishi mumkin — nom qoladi
alter table supplier_invoices alter column supplier_id drop not null;

-- TO'LIQ unique cheklov (qisman indeks emas): `upsert ... on conflict
-- (company_id, billz_id)` qisman indeksni ko'rmaydi — 05.09 da birinchi
-- yurish "no unique or exclusion constraint" bilan yiqildi. NULL
-- billz_id (NSPOS fakturasi) unique'da bir-biriga teng emas — bemalol.
drop index if exists supplier_invoices_billz_uq;
alter table supplier_invoices drop constraint if exists supplier_invoices_company_billz_key;
alter table supplier_invoices add constraint supplier_invoices_company_billz_key unique (company_id, billz_id);

-- Sinxron yozadi (RLS'ni chetlab), ilova o'qiydi; tekshiruv roli o'qiydi
grant select, insert, update on supplier_invoices to nspos_sync;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'nspos') then
    grant select on supplier_invoices to nspos;
    grant select on supplier_payments to nspos;
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
select count(*) n, count(*) filter (where source = 'billz') billz from supplier_invoices;
