-- ══════════════════════════════════════════════════════════════
-- RLS qoidalariga KOMPANIYA shartini qo'shish
-- ══════════════════════════════════════════════════════════════
-- 2026-08-05 auditida aniqlandi: o'nga yaqin qoida foydalanuvchining
-- ROLINI tekshirardi, lekin QAYSI KOMPANIYAdan ekanini tekshirmasdi.
-- Masalan `datasets` uchun shart butunlay "is_manager()" edi — ya'ni
-- istalgan kompaniyaning menejeri barcha moliyaviy eksportlarni o'qiy
-- olardi.
--
-- Bugun kompaniya bitta, shuning uchun amaliy zarar yo'q edi. Lekin
-- sxema ochiq-oydin ko'p-kompaniyali qilib yozilgan va ikkinchi mijoz
-- qo'shilgan kunning o'zida bularning hammasi bir vaqtda oqardi.
--
-- Uch xil yo'l ishlatiladi:
--   1) o'z ustuni yo'q va otasi ham yo'q  → company_id ustuni qo'shiladi
--   2) otasi bor (dataset_chunks, store_plans) → ota orqali tekshiriladi
--   3) xodimga bog'langan (kpi_*) → security definer yordamchi orqali

-- ─── Yordamchi: xodim qaysi kompaniyaniki ──────────────────────
-- Nega security definer: profiles jadvalining o'z RLS'i bor va u
-- keyinroq qattiqlashtiriladi. Qoida ichidagi oddiy so'rov o'shanga
-- bog'lanib qolmasin — auth_company_id() bilan bir xil uslub.
create or replace function staff_company_id(p uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select company_id from profiles where id = p
$$;

-- ─── 1-yo'l: company_id ustunini qo'shamiz ─────────────────────
alter table datasets  add column if not exists company_id uuid references companies(id) on delete cascade;
alter table kassa_ops add column if not exists company_id uuid references companies(id) on delete cascade;
alter table invites   add column if not exists company_id uuid references companies(id) on delete cascade;

-- Mavjud qatorlar bitta kompaniyaniki — to'ldiramiz
update datasets    set company_id = (select id from companies order by created_at limit 1) where company_id is null;
update kassa_ops   set company_id = (select id from companies order by created_at limit 1) where company_id is null;
update invites     set company_id = (select id from companies order by created_at limit 1) where company_id is null;
update nps_records set company_id = (select id from companies order by created_at limit 1) where company_id is null;

-- Bundan keyin o'zi to'ladi (expenses bilan bir xil uslub)
alter table datasets    alter column company_id set default auth_company_id();
alter table kassa_ops   alter column company_id set default auth_company_id();
alter table invites     alter column company_id set default auth_company_id();
alter table nps_records alter column company_id set default auth_company_id();

-- NOT NULL: default ishlamay qolsa yozuv KO'RINMAY qolgandan ko'ra,
-- ochiq xato bergani yaxshi
alter table datasets    alter column company_id set not null;
alter table kassa_ops   alter column company_id set not null;
alter table nps_records alter column company_id set not null;

-- ─── Qoidalar: datasets ────────────────────────────────────────
drop policy if exists datasets_rw on datasets;
create policy datasets_rw on datasets for all
  using (is_manager() and company_id = auth_company_id())
  with check (is_manager() and company_id = auth_company_id());

-- 2-yo'l: bo'laklar o'z datasetidan meros oladi
drop policy if exists dataset_chunks_rw on dataset_chunks;
create policy dataset_chunks_rw on dataset_chunks for all
  using (exists (select 1 from datasets d where d.id = dataset_id))
  with check (exists (select 1 from datasets d where d.id = dataset_id));

-- ─── Qoidalar: kassa_ops ───────────────────────────────────────
-- Rol shartlari o'zgarmaydi, ustiga kompaniya qo'shiladi
drop policy if exists kassa_ops_read on kassa_ops;
create policy kassa_ops_read on kassa_ops for select
  using (is_manager() and company_id = auth_company_id());

drop policy if exists kassa_ops_insert on kassa_ops;
create policy kassa_ops_insert on kassa_ops for insert
  with check (company_id = auth_company_id()
              and (is_owner() or (is_manager() and kassa <> 'company')));

drop policy if exists kassa_ops_update on kassa_ops;
create policy kassa_ops_update on kassa_ops for update
  using (company_id = auth_company_id() and (is_owner() or (is_manager()
         and kassa <> 'company' and coalesce(status,'x') <> 'approved')))
  with check (company_id = auth_company_id() and (is_owner() or (is_manager()
         and kassa <> 'company' and coalesce(status,'x') <> 'approved')));

drop policy if exists kassa_ops_delete on kassa_ops;
create policy kassa_ops_delete on kassa_ops for delete
  using (company_id = auth_company_id()
         and (is_owner() or (is_manager() and kassa <> 'company'))
         and coalesce(status,'x') <> 'approved');

-- ─── Qoidalar: KPI (3-yo'l, xodim orqali) ──────────────────────
drop policy if exists kpi_day_rw on kpi_day;
create policy kpi_day_rw on kpi_day for all
  using (staff_company_id(staff_id) = auth_company_id()
         and (is_manager() or staff_id = auth.uid()))
  with check (staff_company_id(staff_id) = auth_company_id()
         and (is_manager() or staff_id = auth.uid()));

drop policy if exists kpi_plan_rw on kpi_plan;
create policy kpi_plan_rw on kpi_plan for all
  using (staff_company_id(staff_id) = auth_company_id()
         and (is_manager() or staff_id = auth.uid()))
  with check (staff_company_id(staff_id) = auth_company_id()
         and (is_manager() or staff_id = auth.uid()));

drop policy if exists kpi_assign_rw on kpi_assign;
create policy kpi_assign_rw on kpi_assign for all
  using (staff_company_id(staff_id) = auth_company_id()
         and (is_manager() or staff_id = auth.uid()))
  with check (staff_company_id(staff_id) = auth_company_id()
         and (is_manager() or staff_id = auth.uid()));

-- ─── Qoidalar: NPS ─────────────────────────────────────────────
drop policy if exists nps_records_read on nps_records;
create policy nps_records_read on nps_records for select
  using (company_id = auth_company_id()
         and (is_manager() or installer_id = auth.uid()));

drop policy if exists nps_records_write on nps_records;
create policy nps_records_write on nps_records for all
  using (is_manager() and company_id = auth_company_id())
  with check (is_manager() and company_id = auth_company_id());

-- ─── Qoidalar: taklif va do'kon rejasi ─────────────────────────
drop policy if exists invites_rw on invites;
create policy invites_rw on invites for all
  using (is_owner() and company_id = auth_company_id())
  with check (is_owner() and company_id = auth_company_id());

-- 2-yo'l: do'kon rejasi o'z do'konidan meros oladi
drop policy if exists plan_owner on store_plans;
create policy plan_owner on store_plans for all
  using (auth_role() = 'owner'
         and exists (select 1 from stores s where s.id = store_id and s.company_id = auth_company_id()))
  with check (auth_role() = 'owner'
         and exists (select 1 from stores s where s.id = store_id and s.company_id = auth_company_id()));

-- ─── Profil: ega BEGONA kompaniya profilini tahrirlay olmasin ──
drop policy if exists profiles_owner_update on profiles;
create policy profiles_owner_update on profiles for update
  using (is_owner() and company_id = auth_company_id())
  with check (is_owner() and company_id = auth_company_id());

-- ─── Xarajat: "ega" shoxida ham kompaniya sharti bo'lsin ───────
-- Menejer shoxi kassa=auth_store_id() orqali allaqachon o'z
-- kompaniyasi bilan cheklangan, ega shoxi esa ochiq edi.
drop policy if exists expense_read on expenses;
create policy expense_read on expenses for select
  using (company_id = auth_company_id()
         and (is_owner() or (is_manager() and kassa = auth_store_id()::text)));

drop policy if exists expense_write on expenses;
create policy expense_write on expenses for all
  using (company_id = auth_company_id()
         and (is_owner() or (is_manager() and kassa = auth_store_id()::text)))
  with check (company_id = auth_company_id()
         and (is_owner() or (is_manager() and kassa = auth_store_id()::text)));
