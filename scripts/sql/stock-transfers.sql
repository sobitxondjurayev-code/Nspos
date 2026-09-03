-- ══════════════════════════════════════════════════════════════
-- BILLZ TRANSFERLARI — sklad ↔ filial ko'chirish (2026-09-03)
-- ══════════════════════════════════════════════════════════════
--   node scripts/sql.mjs -f scripts/sql/stock-transfers.sql
--
-- Rahbar: "skladdan qancha transfer bo'layotgani ko'rinmayapti".
-- Billz `/v2/transfer` beradi (2 063 yozuv): qaysi do'kondan qaysiga,
-- necha dona yuborilgan/qabul qilingan, sotuv va tannarx summasi, kim
-- yaratgan, kim qabul qilgan, qachon. TOVAR QATORLARI (`transfer_items`)
-- API'da BO'SH keladi — sinovda 9 ta yo'l urildi (DAFTAR 18) — shuning
-- uchun jadval sarlavha darajasida. Ko'zgu: sinxron faqat qo'shadi va
-- yangilaydi, o'chirmaydi.
begin;

create table if not exists stock_transfers (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null default auth_company_id() references companies(id) on delete cascade,
  billz_id        uuid not null,
  external_id     bigint,
  name            text,
  from_store_id   uuid references stores(id),
  to_store_id     uuid references stores(id),
  from_name       text,                 -- Billz do'kon nomi (bog'lanmasa ham qolsin)
  to_name         text,
  qty             numeric(12,3) not null default 0,     -- yuborilgan dona
  qty_arrived     numeric(12,3) not null default 0,     -- qabul qilingan dona
  retail_total    numeric(14,2) not null default 0,     -- sotuv narxida
  supply_total    numeric(14,2) not null default 0,     -- tannarxda
  status_id       text,
  differs         boolean not null default false,      -- yuborilgan ≠ qabul qilingan
  created_by      text,
  accepted_by     text,
  comment         text,
  created_at      timestamptz not null,                 -- Billz: yaratilgan (jo'natilgan)
  accepted_at     timestamptz,                          -- Billz: qabul qilingan
  updated_at      timestamptz not null default now(),
  unique (company_id, billz_id)
);
create index if not exists stock_transfers_created_idx on stock_transfers (company_id, created_at desc);
create index if not exists stock_transfers_route_idx on stock_transfers (company_id, from_store_id, to_store_id);

alter table stock_transfers enable row level security;
drop policy if exists "transfer_read" on stock_transfers;
create policy "transfer_read" on stock_transfers
  for select to public
  using (company_id = auth_company_id());
-- Yozish faqat sinxron (nspos_sync, RLS'ni chetlab o'tadi) — ilova yozmaydi.

grant select on stock_transfers to nspos_app;
grant select, insert, update, delete on stock_transfers to nspos_sync;
-- `nspos` (tekshiruv roli, faqat o'qiydi)
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'nspos') then
    grant select on stock_transfers to nspos;
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
