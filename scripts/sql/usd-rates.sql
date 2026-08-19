-- ══════════════════════════════════════════════════════════════
-- DOLLAR KURSI TARIXI
-- ══════════════════════════════════════════════════════════════
-- Kurs `companies.usd_rate` da bitta joyda turadi — hisob shundan
-- yuritiladi. Lekin "o'sha kuni qanaqa kurs bilan yozgan edik?" degan
-- savol keyinroq chiqadi: xarajat so'mda kiritiladi, dollarga o'sha
-- kundagi kurs bilan o'giriladi. Shu sabab har o'zgarish alohida
-- qatorga yoziladi.
create table if not exists usd_rates (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade default auth_company_id(),
  rate        numeric(14,2) not null check (rate > 0),
  -- manual — qo'lda yozilgan, cbu — Markaziy bankdan olingan
  source      text not null default 'manual' check (source in ('manual', 'cbu')),
  note        text,
  created_by  uuid references profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create index if not exists usd_rates_at_idx on usd_rates (created_at desc);

alter table usd_rates enable row level security;

-- O'qish: rahbar va menejerlar (kurs jadvalda ko'rinib turadi)
drop policy if exists usd_rates_read on usd_rates;
create policy usd_rates_read on usd_rates for select
  using (is_manager() and company_id = auth_company_id());

-- Yozish: menejer ham yangilay oladi — kun davomida kurs o'zgarsa
-- xarajat kiritayotgan odam darrov to'g'irlashi kerak. Kim yozgani
-- created_by da qolgani uchun javobgarlik yo'qolmaydi.
drop policy if exists usd_rates_insert on usd_rates;
create policy usd_rates_insert on usd_rates for insert
  with check (is_manager() and company_id = auth_company_id());
