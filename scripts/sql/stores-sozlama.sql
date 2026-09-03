-- ══════════════════════════════════════════════════════════════
-- DO'KON SOZLAMASI — kod, tur, Billz nomlari (2026-09-03)
-- ══════════════════════════════════════════════════════════════
--   node scripts/sql.mjs -f scripts/sql/stores-sozlama.sql
--
-- Do'kon NOMI to'rt joyda kalit edi: `storesData` (demo → baza
-- bog'lash), `kassaNomlari` (Billz kassa nomi → do'kon), `billzMap.
-- matchStores` (Billz do'koni → do'kon), `kassaData.isKassaStore`
-- (regex). Rahbar nomni o'zgartirsa do'konlar ikkilanar, kassalar
-- yo'qolardi. Endi:
--   code        — barqaror kalit (s1/s2/s3), kod shunga qaraydi
--   kind        — shop | warehouse (Sklad = warehouse; `skladId()`)
--   billz_names — Billz do'kon/kassa nomlaridagi kalit so'zlar
--                 ("namangan"; "optim","nskamera"; "sklad","склад")
-- Nom endi faqat ko'rsatish uchun — Sozlamalarda o'zgartiriladi.
begin;

alter table stores add column if not exists code text;
alter table stores add column if not exists billz_names text[] not null default '{}';
create unique index if not exists stores_code_uniq on stores (company_id, code) where code is not null;

-- Seed: mavjud uch do'kon (nom bo'yicha, bir marta)
update stores set code = 's1', billz_names = array['nscamera optim','optim','nskamera','nscamera']
  where code is null and lower(name) like '%optim%';
update stores set code = 's2', billz_names = array['nscamera namangan','namangan']
  where code is null and lower(name) like '%namangan%';
update stores set code = 's3', kind = 'warehouse', billz_names = array['sklad','склад','ombor']
  where code is null and (lower(name) like '%sklad%' or lower(name) like '%склад%' or kind = 'warehouse');

-- Rahbar nom/tur/Billz nomlarini o'zgartiradi (faqat owner)
drop policy if exists "store_update" on stores;
create policy "store_update" on stores
  for update to public
  using (company_id = auth_company_id() and auth_role() = 'owner')
  with check (company_id = auth_company_id() and auth_role() = 'owner');

commit;

notify pgrst, 'reload schema';
