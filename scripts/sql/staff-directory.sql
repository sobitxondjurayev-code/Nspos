-- ══════════════════════════════════════════════════════════════
-- Oylik maxfiyligi
-- ══════════════════════════════════════════════════════════════
-- Muammo: profiles ni kompaniyaning HAR BIR xodimi to'liq o'qiy olardi
-- (profile_self: company_id = auth_company_id()). Jadvalda esa
-- fixed_salary, sales_pct, service_pct bor — ya'ni o'rnatuvchi usta ham,
-- kassir ham brauzer konsolidan bitta so'rov bilan hammaning maoshini
-- ko'ra olardi.
--
-- RLS ustun darajasida cheklay olmaydi, shuning uchun ikki qadam:
--   1) staff_directory ko'rinishi — ism/rol/do'kon hammaga, pul
--      ustunlari faqat rahbarga (qolganlarga null qaytadi)
--   2) profiles ning o'zi yopiladi: o'z qatoring yoki rahbar bo'lsang
--
-- Ko'rinish security definer (security_invoker o'chirilgan) — u
-- profiles RLS'ini chetlab o'tadi, lekin o'zi kompaniya bo'yicha
-- filtrlaydi va ortiqcha ustunni ko'rsatmaydi.
create or replace view staff_directory
with (security_invoker = false) as
select
  p.id, p.company_id, p.full_name, p.phone, p.role, p.store_id,
  p.is_active, p.perms, p.created_at,
  case when auth_role() = 'owner' then p.fixed_salary end as fixed_salary,
  case when auth_role() = 'owner' then p.sales_pct    end as sales_pct,
  case when auth_role() = 'owner' then p.service_pct  end as service_pct
from profiles p
where p.company_id = auth_company_id();

grant select on staff_directory to authenticated;

-- profiles endi yopiq: o'zingnikini ko'rasan, rahbar hammani ko'radi
drop policy if exists profile_self on profiles;
create policy profile_self on profiles for select
  using (id = auth.uid() or (is_owner() and company_id = auth_company_id()));
