-- ══════════════════════════════════════════════════════════════
-- company_id — o'zi to'ladigan bo'lsin
-- ══════════════════════════════════════════════════════════════
-- Muammo: xarajat kiritilganda baza "null value in column
-- company_id of relation expenses violates not-null constraint"
-- deb rad etardi. Interfeys xarajatni xotiraga qo'shib ko'rsatardi,
-- lekin bazaga tushmasdi — brauzer yangilansa yo'qolardi.
--
-- Sabab: lib/ dagi hech bir modul company_id yubormaydi (grep bilan
-- tekshirilgan), jadvalda esa u NOT NULL va default'siz edi.
--
-- Yechim: default sifatida auth_company_id() qo'yiladi — u allaqachon
-- RLS siyosatlarida ishlatiladigan, profiles'dan joriy foydalanuvchi
-- kompaniyasini oladigan stable + security definer funksiya
-- (schema.sql, 70-qator). Ochiq yuborilgan company_id o'z kuchida
-- qoladi: default faqat ustun umuman berilmaganda ishlaydi.
--
-- profiles bu ro'yxatda yo'q: xodim hisobi service-role bilan yoki
-- taklif orqali ochiladi, u yerda auth.uid() boshqa odamniki bo'lishi
-- mumkin — company_id ochiq berilgani ma'qul.

alter table audit_log            alter column company_id set default auth_company_id();
alter table cash_operations      alter column company_id set default auth_company_id();
alter table categories           alter column company_id set default auth_company_id();
alter table customers            alter column company_id set default auth_company_id();
alter table debts                alter column company_id set default auth_company_id();
alter table doc_counters         alter column company_id set default auth_company_id();
alter table expenses             alter column company_id set default auth_company_id();
alter table payroll_payments     alter column company_id set default auth_company_id();
alter table products             alter column company_id set default auth_company_id();
alter table sales                alter column company_id set default auth_company_id();
alter table service_orders       alter column company_id set default auth_company_id();
alter table shifts               alter column company_id set default auth_company_id();
alter table shipments            alter column company_id set default auth_company_id();
alter table stores               alter column company_id set default auth_company_id();
alter table supplier_invoices    alter column company_id set default auth_company_id();
alter table suppliers            alter column company_id set default auth_company_id();
alter table warehouse_operations alter column company_id set default auth_company_id();
