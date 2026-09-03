// ══════════════════════════════════════════════════════════════
// HUQUQ MATRITSASI — SQL GENERATORI (2026-09-03)
// ══════════════════════════════════════════════════════════════
//   node --import ./scripts/lib/register.mjs scripts/huquq-seed.mjs
//     → scripts/sql/role-permissions.sql   (keyin: node scripts/sql.mjs -f …)
//
// Rahbar: "xodim huquqlari sozlanadigan bo'lsin — interfeys va baza bir
// xil". Bitta manba: `role_permissions` jadvali (rol × kalit → ruxsat).
//   • baza: `has_perm('kalit')` — RLS siyosatlari shundan o'qiydi
//   • interfeys: `auth.can()` — `lib/permsData.js` orqali o'sha jadvaldan
//   • seed: `lib/auth.js` PERMISSIONS (standart) — QO'LDA ko'chirilmaydi,
//     shu skript yozadi; PERMISSIONS o'zgarsa qayta yurgiziladi
// Rahbar (`owner`) doim hamma narsaga ruxsatli — jadvalga yozilmaydi.
import { writeFileSync } from "node:fs";
import { PERMISSIONS } from "../lib/auth.js";

const ROLLAR = ["manager", "cashier", "storekeeper", "installer"];
const seed = [];
for (const [key, roles] of Object.entries(PERMISSIONS)) {
  for (const r of ROLLAR) seed.push(`  ('${r}', '${key}', ${roles.includes(r) ? "true" : "false"})`);
}

const sql = `-- ══════════════════════════════════════════════════════════════
-- HUQUQ MATRITSASI — role_permissions + has_perm() + RLS ko'chishi
-- ══════════════════════════════════════════════════════════════
-- AVTOMATIK: node --import ./scripts/lib/register.mjs scripts/huquq-seed.mjs
-- QO'LDA TAHRIRLAMANG — seed lib/auth.js PERMISSIONS dan.
--   node scripts/sql.mjs -f scripts/sql/role-permissions.sql
--   npm run huquq
--
-- Bitta manba: rol × kalit. Rahbar Sozlamalar → "Rollar va huquqlar"da
-- belgini o'zgartirsa interfeys tugmasi ham, bazadagi RLS ham o'sha
-- zahoti o'zgaradi. Owner doim ruxsatli (jadvalda yo'q).
-- TEGILMAGAN siyosatlar: profiles (rekursiya xavfi), companies, payouts,
-- payroll_payments, store_plans, invites, audit_log, stores, va
-- role_permissions ning o'zi — hammasi owner-only qoladi.
begin;

create table if not exists role_permissions (
  company_id  uuid not null default auth_company_id() references companies(id) on delete cascade,
  role        user_role not null,
  key         text not null,
  allowed     boolean not null default false,
  updated_at  timestamptz not null default now(),
  primary key (company_id, role, key)
);
alter table role_permissions enable row level security;
drop policy if exists "rp_read" on role_permissions;
create policy "rp_read" on role_permissions for select to public using (company_id = auth_company_id());
-- Yozish faqat owner va auth_role() bilan (has_perm EMAS — o'zini qulflab qo'ymasin)
drop policy if exists "rp_write" on role_permissions;
create policy "rp_write" on role_permissions for all to public
  using (company_id = auth_company_id() and auth_role() = 'owner')
  with check (company_id = auth_company_id() and auth_role() = 'owner');
grant select, insert, update, delete on role_permissions to nspos_app;
grant select on role_permissions to nspos_sync;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'nspos') then grant select on role_permissions to nspos; end if;
end $$;

-- Rol × kalit → ruxsat. Owner doim true; qator yo'q → false (seed to'liq).
create or replace function public.has_perm(p_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when auth_role() = 'owner' then true
    else coalesce((select rp.allowed from role_permissions rp
                   where rp.company_id = auth_company_id() and rp.role = auth_role() and rp.key = p_key), false)
  end
$$;
grant execute on function public.has_perm(text) to nspos_app, nspos_sync;

-- Seed — har kompaniyaga, lib/auth.js PERMISSIONS (${Object.keys(PERMISSIONS).length} kalit × ${ROLLAR.length} rol)
insert into role_permissions (company_id, role, key, allowed)
select c.id, v.role::user_role, v.key, v.allowed
from companies c cross join (values
${seed.join(",\n")}
) as v(role, key, allowed)
on conflict (company_id, role, key) do nothing;

-- ── RLS → has_perm ──────────────────────────────────────────
-- products (product.edit)
drop policy if exists "product_write" on products;
create policy "product_write" on products for insert to public
  with check (company_id = auth_company_id() and has_perm('product.edit'));
drop policy if exists "product_update" on products;
create policy "product_update" on products for update to public
  using (company_id = auth_company_id() and has_perm('product.edit'))
  with check (company_id = auth_company_id() and has_perm('product.edit'));
-- stock (product.edit)
drop policy if exists "stock_write" on stock;
create policy "stock_write" on stock for insert to public
  with check (exists (select 1 from products p where p.id = stock.product_id and p.company_id = auth_company_id()) and has_perm('product.edit'));
drop policy if exists "stock_update" on stock;
create policy "stock_update" on stock for update to public
  using (exists (select 1 from products p where p.id = stock.product_id and p.company_id = auth_company_id()) and has_perm('product.edit'))
  with check (exists (select 1 from products p where p.id = stock.product_id and p.company_id = auth_company_id()) and has_perm('product.edit'));
-- customers (customer.edit)
drop policy if exists "customer_write" on customers;
create policy "customer_write" on customers for insert to public
  with check (company_id = auth_company_id() and has_perm('customer.edit'));
drop policy if exists "customer_update" on customers;
create policy "customer_update" on customers for update to public
  using (company_id = auth_company_id() and has_perm('customer.edit'))
  with check (company_id = auth_company_id() and has_perm('customer.edit'));
-- debt_payments (customer.debt)
drop policy if exists "debt_pay" on debt_payments;
create policy "debt_pay" on debt_payments for insert to public
  with check (exists (select 1 from debts d where d.id = debt_payments.debt_id and d.company_id = auth_company_id()) and has_perm('customer.debt'));
-- cash_operations (finance.cash) + do'kon
drop policy if exists "cash_rw" on cash_operations;
create policy "cash_rw" on cash_operations for all to public
  using (company_id = auth_company_id() and can_see_store(store_id) and has_perm('finance.cash'))
  with check (company_id = auth_company_id() and can_see_store(store_id) and has_perm('finance.cash'));
-- kassa_ops (kassa.view / kassa.operate / kassa.company / kassa.approve)
drop policy if exists "kassa_ops_read" on kassa_ops;
create policy "kassa_ops_read" on kassa_ops for select to public
  using (company_id = auth_company_id() and has_perm('kassa.view'));
drop policy if exists "kassa_ops_insert" on kassa_ops;
create policy "kassa_ops_insert" on kassa_ops for insert to public
  with check (company_id = auth_company_id() and (has_perm('kassa.company') or (has_perm('kassa.operate') and kassa <> 'company')));
drop policy if exists "kassa_ops_update" on kassa_ops;
create policy "kassa_ops_update" on kassa_ops for update to public
  using (company_id = auth_company_id() and (has_perm('kassa.company') or (has_perm('kassa.operate') and kassa <> 'company' and coalesce(status,'x') <> 'approved')))
  with check (company_id = auth_company_id() and (has_perm('kassa.company') or (has_perm('kassa.operate') and kassa <> 'company' and coalesce(status,'x') <> 'approved')));
drop policy if exists "kassa_ops_delete" on kassa_ops;
create policy "kassa_ops_delete" on kassa_ops for delete to public
  using (company_id = auth_company_id() and (has_perm('kassa.company') or (has_perm('kassa.operate') and kassa <> 'company')) and coalesce(status,'x') <> 'approved');
-- expenses (finance.expenses): owner hamma kassa/sana; boshqasi o'z kassasi, bugun
drop policy if exists "expense_read" on expenses;
create policy "expense_read" on expenses for select to public
  using (company_id = auth_company_id() and has_perm('finance.expenses') and (auth_role() = 'owner' or kassa = auth_store_id()::text));
drop policy if exists "expense_insert" on expenses;
create policy "expense_insert" on expenses for insert to public
  with check (company_id = auth_company_id() and has_perm('finance.expenses') and (auth_role() = 'owner' or kassa = auth_store_id()::text));
drop policy if exists "expense_update" on expenses;
create policy "expense_update" on expenses for update to public
  using (company_id = auth_company_id() and has_perm('finance.expenses') and (auth_role() = 'owner' or (kassa = auth_store_id()::text and spent_on = (now() at time zone 'Asia/Tashkent')::date)))
  with check (company_id = auth_company_id() and has_perm('finance.expenses') and (auth_role() = 'owner' or (kassa = auth_store_id()::text and spent_on = (now() at time zone 'Asia/Tashkent')::date)));
drop policy if exists "expense_delete" on expenses;
create policy "expense_delete" on expenses for delete to public
  using (company_id = auth_company_id() and has_perm('finance.expenses') and (auth_role() = 'owner' or (kassa = auth_store_id()::text and spent_on = (now() at time zone 'Asia/Tashkent')::date)));
-- nps_records (nps.edit)
drop policy if exists "nps_records_write" on nps_records;
create policy "nps_records_write" on nps_records for all to public
  using (company_id = auth_company_id() and has_perm('nps.edit'))
  with check (company_id = auth_company_id() and has_perm('nps.edit'));
-- service_orders (service.view / service.edit; usta o'zinikini ko'radi)
drop policy if exists "service_read" on service_orders;
create policy "service_read" on service_orders for select to public
  using (company_id = auth_company_id() and (has_perm('service.view') or installer_id = auth.uid()));
drop policy if exists "service_write" on service_orders;
create policy "service_write" on service_orders for all to public
  using (company_id = auth_company_id() and has_perm('service.edit'))
  with check (company_id = auth_company_id() and has_perm('service.edit'));
-- warehouse_operations (warehouse.operate)
drop policy if exists "warehouse_rw" on warehouse_operations;
create policy "warehouse_rw" on warehouse_operations for all to public
  using (company_id = auth_company_id() and has_perm('warehouse.operate'))
  with check (company_id = auth_company_id() and has_perm('warehouse.operate'));
-- shipments / suppliers / supplier_invoices (finance.suppliers)
drop policy if exists "shipment_rw" on shipments;
create policy "shipment_rw" on shipments for all to public
  using (company_id = auth_company_id() and has_perm('finance.suppliers'))
  with check (company_id = auth_company_id() and has_perm('finance.suppliers'));
drop policy if exists "supplier_write" on suppliers;
create policy "supplier_write" on suppliers for all to public
  using (company_id = auth_company_id() and has_perm('finance.suppliers'))
  with check (company_id = auth_company_id() and has_perm('finance.suppliers'));
drop policy if exists "invoice_rw" on supplier_invoices;
create policy "invoice_rw" on supplier_invoices for all to public
  using (company_id = auth_company_id() and has_perm('finance.suppliers'))
  with check (company_id = auth_company_id() and has_perm('finance.suppliers'));
-- datasets / billz_sync_log (report.view)
drop policy if exists "datasets_rw" on datasets;
create policy "datasets_rw" on datasets for all to public
  using (company_id = auth_company_id() and has_perm('report.view'))
  with check (company_id = auth_company_id() and has_perm('report.view'));
drop policy if exists "billz_sync_log_read" on billz_sync_log;
create policy "billz_sync_log_read" on billz_sync_log for select to public
  using (company_id = auth_company_id() and has_perm('report.view'));
-- usd_rates (finance.rate)
drop policy if exists "usd_rates_insert" on usd_rates;
create policy "usd_rates_insert" on usd_rates for insert to public
  with check (company_id = auth_company_id() and has_perm('finance.rate'));
drop policy if exists "usd_rates_read" on usd_rates;
create policy "usd_rates_read" on usd_rates for select to public
  using (company_id = auth_company_id() and has_perm('finance.rate'));
-- sales (sale.create / sale.viewAll + do'kon)
drop policy if exists "sale_insert" on sales;
create policy "sale_insert" on sales for insert to public
  with check (company_id = auth_company_id() and can_see_store(store_id) and has_perm('sale.create'));
drop policy if exists "sale_read" on sales;
create policy "sale_read" on sales for select to public
  using (company_id = auth_company_id() and (has_perm('sale.viewAll') or can_see_store(store_id)));
-- kpi_* (kpi.manage yoki o'zi)
drop policy if exists "kpi_assign_rw" on kpi_assign;
create policy "kpi_assign_rw" on kpi_assign for all to public
  using (staff_company_id(staff_id) = auth_company_id() and (has_perm('kpi.manage') or staff_id = auth.uid()))
  with check (staff_company_id(staff_id) = auth_company_id() and (has_perm('kpi.manage') or staff_id = auth.uid()));
drop policy if exists "kpi_plan_rw" on kpi_plan;
create policy "kpi_plan_rw" on kpi_plan for all to public
  using (staff_company_id(staff_id) = auth_company_id() and (has_perm('kpi.manage') or staff_id = auth.uid()))
  with check (staff_company_id(staff_id) = auth_company_id() and (has_perm('kpi.manage') or staff_id = auth.uid()));
drop policy if exists "kpi_day_rw" on kpi_day;
create policy "kpi_day_rw" on kpi_day for all to public
  using (staff_company_id(staff_id) = auth_company_id() and (has_perm('kpi.manage') or staff_id = auth.uid()))
  with check (staff_company_id(staff_id) = auth_company_id() and (has_perm('kpi.manage') or staff_id = auth.uid()));
-- expense_categories (settings.edit)
drop policy if exists "expcat_insert" on expense_categories;
create policy "expcat_insert" on expense_categories for insert to public
  with check (company_id = auth_company_id() and has_perm('settings.edit'));
drop policy if exists "expcat_update" on expense_categories;
create policy "expcat_update" on expense_categories for update to public
  using (company_id = auth_company_id() and has_perm('settings.edit'))
  with check (company_id = auth_company_id() and has_perm('settings.edit'));
drop policy if exists "expcat_delete" on expense_categories;
create policy "expcat_delete" on expense_categories for delete to public
  using (company_id = auth_company_id() and has_perm('settings.edit')
         and not exists (select 1 from expenses e where e.company_id = expense_categories.company_id and e.category = expense_categories.key));

commit;

notify pgrst, 'reload schema';
`;
writeFileSync("scripts/sql/role-permissions.sql", sql);
console.log(`✓ scripts/sql/role-permissions.sql — ${seed.length} qator seed`);
