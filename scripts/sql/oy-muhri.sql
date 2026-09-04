-- ══════════════════════════════════════════════════════════════
-- OY MUHRI — yopilgan oy raqami o'zgarmaydi (2026-09-05, DAFTAR 20 K)
-- ══════════════════════════════════════════════════════════════
--   node scripts/sql.mjs -f scripts/sql/oy-muhri.sql
--
-- Rahbar oyni yopganda P&L, qarz, kassa, ombor va kapital raqamlari
-- shu jadvalga muhrlanadi. Keyin hisob o'zgarsa (kech kiritilgan
-- xarajat, Billz'da tuzatilgan chek, kurs) `audit` → `oy-muhri` farqni
-- ko'rsatadi: muhr yashirin o'zgarmaydi, farq ochiq turadi.
-- Yozish — `finance.balance` huquqi (standart: faqat rahbar). Ilova
-- yozadi (syncTable), sinxron tegmaydi. Hech narsa o'chirilmaydi.
begin;

create table if not exists oy_muhri (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null default auth_company_id() references companies(id) on delete cascade,
  oy            text not null,                          -- 'YYYY-MM'
  kurs          numeric(12,2),                          -- oy kursi (ratesData.oyKursi)
  savdo         numeric(14,2) not null default 0,       -- sof savdo (qaytarish ayrilgan)
  tannarx       numeric(14,2) not null default 0,
  yalpi_foyda   numeric(14,2) not null default 0,
  xarajat       numeric(14,2) not null default 0,       -- OPEX + ish haqi + boshqa
  sof_foyda     numeric(14,2) not null default 0,
  qarz          numeric(14,2) not null default 0,       -- ochiq qarz oy oxiri holatida (to'lov yozuvlaridan)
  ombor         numeric(14,2) not null default 0,       -- ombor tannarxda — MUHRLASH PAYTIDAGI (tarix yo'q)
  kassa         numeric(14,2) not null default 0,       -- kassalar jami oy oxiri
  kapital       numeric(14,2) not null default 0,
  tafsilot      jsonb not null default '{}'::jsonb,     -- to'liq surat (P&L, ko'prik, yosh guruhlari…)
  yopgan        uuid references profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, oy)
);

alter table oy_muhri enable row level security;
drop policy if exists "oy_muhri_read" on oy_muhri;
create policy "oy_muhri_read" on oy_muhri
  for select to public
  using (company_id = auth_company_id());
drop policy if exists "oy_muhri_rw" on oy_muhri;
create policy "oy_muhri_rw" on oy_muhri
  for all to public
  using (company_id = auth_company_id() and has_perm('finance.balance'))
  with check (company_id = auth_company_id() and has_perm('finance.balance'));

grant select, insert, update, delete on oy_muhri to nspos_app;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'nspos') then
    grant select on oy_muhri to nspos;
  end if;
  if exists (select 1 from pg_roles where rolname = 'nspos_sync') then
    grant select on oy_muhri to nspos_sync;
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
select count(*) as muhrlar from oy_muhri;
