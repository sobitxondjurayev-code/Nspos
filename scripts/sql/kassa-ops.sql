-- ══════════════════════════════════════════════════════════════
-- KASSALAR: b2b · b2c · kompaniya
-- ══════════════════════════════════════════════════════════════
-- Bitta jadval uchala kassaning harakatini saqlaydi. Balans shu
-- yozuvlardan hisoblanadi (kirim − chiqim ± tasdiqlangan o'tkazma),
-- ustiga KPI kunlik jadvalidagi Naqd/Payme qo'shiladi.
--
-- kind:
--   in       — kassaga kirim
--   out      — kassadan chiqim
--   transfer — menejer kassasidan kompaniyaga o'tkazma. Pul faqat
--              status='approved' bo'lgach ko'chadi; 'pending' — yo'lda.
create table if not exists kassa_ops (
  id          uuid primary key default gen_random_uuid(),
  kassa       text not null check (kassa in ('b2b', 'b2c', 'company')),
  wallet      text not null check (wallet in ('cash', 'payme', 'service')),
  kind        text not null check (kind in ('in', 'out', 'transfer')),
  amount      numeric(14,2) not null check (amount > 0),
  op_date     date not null default current_date,
  category    text,
  note        text,
  staff_id    uuid references profiles(id) on delete set null,
  -- faqat transferda to'ladi
  status      text check (status in ('pending', 'approved', 'rejected')),
  decided_by  uuid references profiles(id) on delete set null,
  decided_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists kassa_ops_date_idx on kassa_ops (op_date desc);
create index if not exists kassa_ops_kassa_idx on kassa_ops (kassa, wallet);
-- Tasdiq kutayotganlarni tez topish uchun
create index if not exists kassa_ops_pending_idx on kassa_ops (status) where status = 'pending';

-- O'tkazmada status majburiy, oddiy kirim/chiqimda bo'lmasligi kerak —
-- aks holda "tasdiqlanmagan chiqim" degan tushunarsiz holat paydo bo'ladi.
alter table kassa_ops drop constraint if exists kassa_ops_status_kind;
alter table kassa_ops add constraint kassa_ops_status_kind check (
  (kind = 'transfer' and status is not null) or (kind <> 'transfer' and status is null)
);

alter table kassa_ops enable row level security;

-- O'qish: rahbar va menejerlar. Menejer qaysi kassani ko'rishi
-- interfeysda cheklanadi; bu yerda muhimi — kassir va usta ko'rmasin.
drop policy if exists kassa_ops_read on kassa_ops;
create policy kassa_ops_read on kassa_ops for select using (is_manager());

-- Yozish: menejer o'z kassasiga kirim/chiqim va o'tkazma so'rovi
-- kirita oladi, lekin KOMPANIYA kassasiga tegolmaydi.
drop policy if exists kassa_ops_insert on kassa_ops;
create policy kassa_ops_insert on kassa_ops for insert
  with check (is_owner() or (is_manager() and kassa <> 'company'));

-- O'zgartirish: o'tkazmani tasdiqlash/rad etish faqat rahbarniki.
-- Menejer o'zining hali hal qilinmagan yozuvinigina tahrirlaydi.
drop policy if exists kassa_ops_update on kassa_ops;
create policy kassa_ops_update on kassa_ops for update
  using (is_owner() or (is_manager() and kassa <> 'company' and coalesce(status, 'x') <> 'approved'))
  with check (is_owner() or (is_manager() and kassa <> 'company' and coalesce(status, 'x') <> 'approved'));

-- O'chirish: tasdiqlangan pul harakati o'chirilmaydi — u tarix.
drop policy if exists kassa_ops_delete on kassa_ops;
create policy kassa_ops_delete on kassa_ops for delete
  using ((is_owner() or (is_manager() and kassa <> 'company'))
         and coalesce(status, 'x') <> 'approved');
