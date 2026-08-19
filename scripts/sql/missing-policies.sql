-- ══════════════════════════════════════════════════════════════
-- Jonli bazaga tushmagan RLS qoidalari
-- ══════════════════════════════════════════════════════════════
-- 2026-08-05 da aniqlandi: sakkizta jadvalda RLS yoqilgan, lekin
-- birorta qoida yo'q edi. Postgres'da bu "hammaga taqiq" degani —
-- jadval na o'qiladi, na yoziladi, xato esa interfeysda indamay
-- yutiladi. Aynan shu sabab bilan Xarajatlar ham ishlamayotgan edi
-- (companies-rls.sql ga qarang).
--
-- Ta'sirlangan bo'limlar: Smenalar, Yetkazib beruvchilar, Partiyalar,
-- Servis buyurtmasi tarkibi, Ombor operatsiyasi tarkibi.
--
-- Qoidalarning o'zi schema.sql da allaqachon yozilgan — ular shu
-- yerga aynan ko'chirildi, hech narsa o'ylab topilmadi.

-- —— Smena: o'z do'koni bo'yicha ochiladi va yopiladi ————————
drop policy if exists shift_rw on shifts;
create policy shift_rw on shifts for all
  using (company_id = auth_company_id() and can_see_store(store_id))
  with check (company_id = auth_company_id() and can_see_store(store_id));

-- —— Partiyalar (import) — egasi va menejer ————————————————
drop policy if exists shipment_rw on shipments;
create policy shipment_rw on shipments for all
  using (company_id = auth_company_id() and auth_role() in ('owner', 'manager'))
  with check (company_id = auth_company_id() and auth_role() in ('owner', 'manager'));

drop policy if exists shipment_item_rw on shipment_items;
create policy shipment_item_rw on shipment_items for all
  using (exists (select 1 from shipments s
                  where s.id = shipment_id and s.company_id = auth_company_id()))
  with check (exists (select 1 from shipments s
                       where s.id = shipment_id and s.company_id = auth_company_id()));

drop policy if exists shipment_cost_rw on shipment_costs;
create policy shipment_cost_rw on shipment_costs for all
  using (exists (select 1 from shipments s
                  where s.id = shipment_id and s.company_id = auth_company_id()))
  with check (exists (select 1 from shipments s
                       where s.id = shipment_id and s.company_id = auth_company_id()));

-- —— Yetkazib beruvchilar: hisob-faktura va to'lovlar ————————
drop policy if exists invoice_rw on supplier_invoices;
create policy invoice_rw on supplier_invoices for all
  using (company_id = auth_company_id() and auth_role() in ('owner', 'manager'))
  with check (company_id = auth_company_id() and auth_role() in ('owner', 'manager'));

drop policy if exists invoice_pay_rw on supplier_payments;
create policy invoice_pay_rw on supplier_payments for all
  using (exists (select 1 from supplier_invoices i
                  where i.id = invoice_id and i.company_id = auth_company_id()))
  with check (exists (select 1 from supplier_invoices i
                       where i.id = invoice_id and i.company_id = auth_company_id()));

-- Ta'minotchining o'zi: schema.sql da faqat o'qish bor edi, lekin
-- suppliersData.addSupplier/updateSupplier/removeSupplier yozadi ham —
-- shuning uchun yozish huquqi ham beriladi (hisob-faktura bilan bir xil).
drop policy if exists supplier_write on suppliers;
create policy supplier_write on suppliers for all
  using (company_id = auth_company_id() and auth_role() in ('owner', 'manager'))
  with check (company_id = auth_company_id() and auth_role() in ('owner', 'manager'));

-- —— Buyurtma va operatsiya tarkibi ————————————————————————
drop policy if exists service_item_rw on service_items;
create policy service_item_rw on service_items for all
  using (exists (select 1 from service_orders o
                  where o.id = order_id and o.company_id = auth_company_id()))
  with check (exists (select 1 from service_orders o
                       where o.id = order_id and o.company_id = auth_company_id()));

drop policy if exists warehouse_item_rw on warehouse_items;
create policy warehouse_item_rw on warehouse_items for all
  using (exists (select 1 from warehouse_operations o
                  where o.id = operation_id and o.company_id = auth_company_id()))
  with check (exists (select 1 from warehouse_operations o
                       where o.id = operation_id and o.company_id = auth_company_id()));

-- —— Chek tarkibi: yozish qoidasi tushmay qolgan ————————————
drop policy if exists sale_item_write on sale_items;
create policy sale_item_write on sale_items for insert
  with check (exists (select 1 from sales s
                       where s.id = sale_id and s.company_id = auth_company_id()));

-- doc_counters ataylab tashqarida qoldirilgan: unga faqat tizim
-- funksiyalari tegadi (schema.sql, 814-qator).
