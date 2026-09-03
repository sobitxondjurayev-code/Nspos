-- ══════════════════════════════════════════════════════════════
-- XARAJAT TURLARI — jadval (2026-09-03)
-- ══════════════════════════════════════════════════════════════
--   node scripts/sql.mjs -f scripts/sql/expense-categories.sql
--
-- Rahbar: "xarajat turini qo'shish/o'chirish mumkin bo'lsin". Ilgari
-- ro'yxat kodda qotgan edi (`lib/expensesData.js` EXPENSE_CATEGORIES) —
-- yangi tur = kod + chiqarish. Endi jadval: rahbar Sozlamalardan
-- qo'shadi, nomini o'zgartiradi, yashiradi, ishlatilmaganini o'chiradi.
--
-- `expenses.category` matn (kalit) — FK yo'q, kalit o'zgarmaydi (faqat
-- nom). Ishlatilgan tur O'CHMAYDI (delete siyosati tekshiradi) —
-- "yashiriladi" (`is_active = false`): eski xarajat nomi bilan ko'rinadi.
begin;

create table if not exists expense_categories (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null default auth_company_id() references companies(id) on delete cascade,
  key           text not null,
  label         text not null,
  "group"       text not null default 'variable' check ("group" in ('fixed','variable')),
  service       boolean not null default false,     -- servis tannarxiga kiradi (Servis foydasi)
  note_required boolean not null default false,     -- izoh majburiy ("Boshqa")
  sort          integer not null default 100,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, key)
);

alter table expense_categories enable row level security;
drop policy if exists "expcat_read" on expense_categories;
create policy "expcat_read" on expense_categories
  for select to public using (company_id = auth_company_id());
drop policy if exists "expcat_insert" on expense_categories;
create policy "expcat_insert" on expense_categories
  for insert to public with check (company_id = auth_company_id() and auth_role() = 'owner');
drop policy if exists "expcat_update" on expense_categories;
create policy "expcat_update" on expense_categories
  for update to public
  using (company_id = auth_company_id() and auth_role() = 'owner')
  with check (company_id = auth_company_id() and auth_role() = 'owner');
-- O'chirish: faqat rahbar va faqat ISHLATILMAGAN tur — bazaning o'zi qo'riqlaydi
drop policy if exists "expcat_delete" on expense_categories;
create policy "expcat_delete" on expense_categories
  for delete to public
  using (company_id = auth_company_id() and auth_role() = 'owner'
         and not exists (select 1 from expenses e
                         where e.company_id = expense_categories.company_id
                           and e.category = expense_categories.key));

grant select, insert, update, delete on expense_categories to nspos_app;
grant select on expense_categories to nspos_sync;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'nspos') then
    grant select on expense_categories to nspos;
  end if;
end $$;

-- Seed — kodda turgan ro'yxat (EXPENSE_CATEGORIES + LEGACY), har kompaniyaga.
-- `on conflict do nothing`: qayta yurgizilsa rahbar o'zgartirganini bosmaydi.
insert into expense_categories (company_id, key, label, "group", service, note_required, sort, is_active)
select c.id, v.key, v.label, v.grp, v.service, v.note_required, v.sort, v.is_active
from companies c
cross join (values
  ('rent_store',     'Do''kon ijarasi',              'fixed',    false, false,  10, true),
  ('rent_warehouse', 'Ombor ijarasi',                'fixed',    false, false,  20, true),
  ('internet',       'Internet',                     'fixed',    false, false,  30, true),
  ('electricity',    'Elektr energiya',              'fixed',    false, false,  40, true),
  ('water',          'Suv tarmog''i',                'fixed',    false, false,  50, true),
  ('tax',            'Soliq',                        'fixed',    false, false,  60, true),
  ('salary',         'Oylik',                        'fixed',    false, false,  70, true),
  ('staff_travel',   'Xodimlarga yo''lkira',         'variable', false, false, 100, true),
  ('delivery',       'Dastavka yo''lkira',           'variable', false, false, 110, true),
  ('lunch',          'Tushlik',                      'variable', false, false, 120, true),
  ('dinner',         'Kechki ovqat',                 'variable', false, false, 130, true),
  ('packaging',      'Paket',                        'variable', false, false, 140, true),
  ('drinking_water', 'Filter suv',                   'variable', false, false, 150, true),
  ('air_freshener',  'Atir',                         'variable', false, false, 160, true),
  ('cleaning',       'Tozalik',                      'variable', false, false, 170, true),
  ('svc_fuel',       'Mashina gazi',                 'variable', true,  false, 200, true),
  ('svc_oil',        'Avtol va moy',                 'variable', true,  false, 210, true),
  ('svc_misc',       'Mayda-chuda',                  'variable', true,  false, 220, true),
  ('svc_material',   'Boshqa o''rnatish materiali',  'variable', true,  false, 230, true),
  ('other',          'Boshqa xarajatlar',            'variable', false, true,  900, true),
  -- Eskirganlar: tanlanmaydi, eski xarajatlarda nomi ko'rinadi
  ('svc_screws',     'Shurup',                       'variable', true,  false, 950, false),
  ('svc_dowel',      'Samarez',                      'variable', true,  false, 960, false)
) as v(key, label, grp, service, note_required, sort, is_active)
on conflict (company_id, key) do nothing;

commit;

notify pgrst, 'reload schema';
