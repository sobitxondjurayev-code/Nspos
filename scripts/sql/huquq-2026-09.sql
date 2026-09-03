-- ══════════════════════════════════════════════════════════════
-- HUQUQ BO'SHLIQLARI — RLS `lib/auth.js` PERMISSIONS KO'ZGUSI (2026-09-03)
-- ══════════════════════════════════════════════════════════════
--   node scripts/sql.mjs -f scripts/sql/huquq-2026-09.sql
--   npm run huquq            -- keyin matritsa sinovi
--
-- Nega: xodim hisobida "saqlash ishlamayapti" deganda sabab ko'pincha
-- siyosatning YO'QLIGI edi — PostgREST rad etganini xato bilan emas,
-- 0 qator bilan bildiradi (CLAUDE.md 2026-08-21). Topilganlar:
--   • customers — insert/update siyosati umuman yo'q (rahbar ham yozolmasdi)
--   • stock     — insert/update yo'q (yangi tovar qoldig'i rad)
--   • products  — update `with check` siz; is_active/archived_at uchun
--   • nps_records — faqat owner/manager; retention xodimi kassir bo'lsa rad
--   • service_orders — usta o'z buyurtmasining holatini o'zgartirolmasdi
-- Har siyosatdagi rol ro'yxati `lib/auth.js` PERMISSIONS dagi kalit
-- bilan BIR XIL (izohda kalit yozilgan). O'zgartirilsa ikkalasi birga.
-- Idempotent: `drop policy if exists` bilan.

begin;

-- ── customers: `customer.edit` = owner, manager, cashier ──────
-- O'chirish YO'Q — Billz'dan kelgan yozuv o'chirilmaydi (xotira qoidasi).
drop policy if exists "customer_write" on "customers";
create policy "customer_write" on "customers"
  for insert to public
  with check (company_id = auth_company_id()
              and auth_role() = any (array['owner','manager','cashier']::user_role[]));

drop policy if exists "customer_update" on "customers";
create policy "customer_update" on "customers"
  for update to public
  using (company_id = auth_company_id()
         and auth_role() = any (array['owner','manager','cashier']::user_role[]))
  with check (company_id = auth_company_id()
              and auth_role() = any (array['owner','manager','cashier']::user_role[]));

-- ── stock: `product.edit` = owner, manager ─────────────────────
-- Qator kompaniyaniki ekani tovar orqali tekshiriladi (stock'da
-- company_id yo'q).
drop policy if exists "stock_write" on "stock";
create policy "stock_write" on "stock"
  for insert to public
  with check (exists (select 1 from products p
                      where p.id = stock.product_id and p.company_id = auth_company_id())
              and auth_role() = any (array['owner','manager']::user_role[]));

drop policy if exists "stock_update" on "stock";
create policy "stock_update" on "stock"
  for update to public
  using (exists (select 1 from products p
                 where p.id = stock.product_id and p.company_id = auth_company_id())
         and auth_role() = any (array['owner','manager']::user_role[]))
  with check (exists (select 1 from products p
                      where p.id = stock.product_id and p.company_id = auth_company_id())
              and auth_role() = any (array['owner','manager']::user_role[]));

-- ── products: `product.edit` — update'ga `with check` ──────────
-- Ilgari `with check` yo'q edi: qator boshqa kompaniyaga ko'chirib
-- yuborilishi mumkin edi.
drop policy if exists "product_update" on "products";
create policy "product_update" on "products"
  for update to public
  using (company_id = auth_company_id()
         and auth_role() = any (array['owner','manager']::user_role[]))
  with check (company_id = auth_company_id()
              and auth_role() = any (array['owner','manager']::user_role[]));

-- ── nps_records: `nps.edit` = owner, manager, cashier ──────────
-- Retention xodimi (NPS uchun qo'ng'iroq qiladigan) ko'pincha
-- `cashier` rolida — ilgari uning har bahosi rad bo'lib, faqat
-- brauzerida qolardi. O'qish o'zgarmaydi (usta o'zinikini ko'radi).
drop policy if exists "nps_records_write" on "nps_records";
create policy "nps_records_write" on "nps_records"
  for all to public
  using (company_id = auth_company_id()
         and auth_role() = any (array['owner','manager','cashier']::user_role[]))
  with check (company_id = auth_company_id()
              and auth_role() = any (array['owner','manager','cashier']::user_role[]));

-- ── debt_payments: `customer.debt` = owner, manager, cashier ─────
-- Ilgari kompaniyaning HAR a'zosi (usta, omborchi ham) qarz to'lovi
-- yoza olardi — interfeysda bunday tugma yo'q, ya'ni yashirin teshik.
drop policy if exists "debt_pay" on "debt_payments";
create policy "debt_pay" on "debt_payments"
  for insert to public
  with check (exists (select 1 from debts d
                      where d.id = debt_payments.debt_id and d.company_id = auth_company_id())
              and auth_role() = any (array['owner','manager','cashier']::user_role[]));

-- ── cash_operations: `finance.cash` = owner, manager, cashier ────
-- `for all` edi va rol tekshirilmasdi. Do'kon sharti (`can_see_store`)
-- o'z joyida qoladi; klient endi do'konni doim yozadi
-- (`financeData.addOperation`), rahbarda null — `can_see_store` o'tkazadi.
drop policy if exists "cash_rw" on "cash_operations";
create policy "cash_rw" on "cash_operations"
  for all to public
  using (company_id = auth_company_id() and can_see_store(store_id)
         and auth_role() = any (array['owner','manager','cashier']::user_role[]))
  with check (company_id = auth_company_id() and can_see_store(store_id)
              and auth_role() = any (array['owner','manager','cashier']::user_role[]));

-- ── service_orders: usta o'z buyurtmasining HOLATINI o'zgartiradi ──
-- `service.own` = installer. RLS ustunni cheklay olmaydi (qator
-- ochilsa narx ham ochiladi), shuning uchun alohida funksiya: faqat
-- `status` va `finished_at`, faqat o'z buyurtmasi.
create or replace function public.service_status_set(p_id uuid, p_status text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if p_status is null or p_status not in ('yangi','jarayonda','bajarildi','bekor') then
    raise exception 'Holat noto''g''ri: %', p_status using errcode = '22023';
  end if;
  update service_orders
     set status = p_status,
         finished_at = case when p_status = 'bajarildi' then coalesce(finished_at, now()) else finished_at end
   where id = p_id
     and company_id = auth_company_id()
     and (installer_id = auth.uid()
          or auth_role() = any (array['owner','manager']::user_role[]));
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'Ruxsat yo''q yoki buyurtma topilmadi' using errcode = '42501';
  end if;
  return true;
end;
$$;
grant execute on function public.service_status_set(uuid, text) to nspos_app;

commit;

-- Yangi funksiya (`service_status_set`) PostgREST'da ko'rinsin
notify pgrst, 'reload schema';
