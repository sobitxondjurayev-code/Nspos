-- NSPOS — BAZA SXEMASI (avtomatik olingan)
-- Manba: Supabase, public sxemasi. Qayta yaratish:
--   node scripts/sxema-olish.mjs
-- QO'LDA TAHRIRLAMANG — o'zgarish bazada qilinadi, keyin qayta olinadi.
--
-- Ishlatish (VPS'da):
--   psql -d nspos -f scripts/sql/vps/00-shim.sql
--   psql -d nspos -f scripts/sql/vps/01-sxema.sql
--
-- 00-shim.sql BIRINCHI yuriladi: u `auth.uid()` va `auth.role()`
-- o'rnini bosadi. Busiz RLS siyosatlari yaratilmaydi.

-- Funksiya jadvalga, jadval funksiyaga murojaat qilishi mumkin —
-- tartibdan qat'i nazar ishlashi uchun tana tekshiruvi o'chiriladi.
set check_function_bodies = off;


-- ══════════════════════════════════════════════════════════════
-- KENGAYTMALAR
-- ══════════════════════════════════════════════════════════════

create extension if not exists "pg_stat_statements";
create extension if not exists "pg_trgm";
create extension if not exists "pgcrypto";
-- plpgsql — Supabase'ga xos, VPS'da kerak emas
-- supabase_vault — Supabase'ga xos, VPS'da kerak emas
create extension if not exists "uuid-ossp";

-- ══════════════════════════════════════════════════════════════
-- MAXSUS TURLAR (3 ta)
-- ══════════════════════════════════════════════════════════════

do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                  where n.nspname = 'public' and t.typname = 'sale_type') then
    create type "sale_type" as enum ('sale', 'return', 'exchange');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                  where n.nspname = 'public' and t.typname = 'user_role') then
    create type "user_role" as enum ('owner', 'manager', 'cashier', 'storekeeper', 'installer');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                  where n.nspname = 'public' and t.typname = 'warehouse_op') then
    create type "warehouse_op" as enum ('receipt', 'transfer', 'writeoff', 'inventory');
  end if;
end $$;

-- ══════════════════════════════════════════════════════════════
-- KETMA-KETLIKLAR (2 ta)
-- ══════════════════════════════════════════════════════════════

create sequence if not exists "audit_log_id_seq" as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1 cache 1;
create sequence if not exists "dataset_chunks_id_seq" as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1 cache 1;

-- ══════════════════════════════════════════════════════════════
-- FUNKSIYALAR (13 ta)
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.apply_stock(p_product uuid, p_store uuid, p_delta numeric, p_allow_negative boolean DEFAULT false)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  new_qty numeric;
begin
  insert into stock (product_id, store_id, qty)
  values (p_product, p_store, 0)
  on conflict (product_id, store_id) do nothing;

  -- FOR UPDATE: shu qatorni band qilamiz, boshqa tranzaksiya kutadi
  select qty into new_qty from stock
   where product_id = p_product and store_id = p_store
   for update;

  new_qty := new_qty + p_delta;

  if new_qty < 0 and not p_allow_negative then
    raise exception 'Qoldiq yetarli emas: % dona kerak, % bor',
      abs(p_delta), new_qty - p_delta
      using errcode = 'check_violation';
  end if;

  update stock set qty = new_qty, updated_at = now()
   where product_id = p_product and store_id = p_store;

  return new_qty;
end $function$
;

CREATE OR REPLACE FUNCTION public.audit_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  cid uuid;
begin
  cid := coalesce(
    (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end ->> 'company_id')::uuid,
    auth_company_id()
  );
  insert into audit_log (company_id, actor_id, table_name, row_id, action, before, after)
  values (
    cid, auth.uid(), tg_table_name,
    (case when tg_op = 'DELETE' then old.id else new.id end),
    lower(tg_op),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return case when tg_op = 'DELETE' then old else new end;
end $function$
;

CREATE OR REPLACE FUNCTION public.auth_company_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select company_id from profiles where id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public.auth_role()
 RETURNS user_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select role from profiles where id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public.auth_store_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select store_id from profiles where id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public.can_see_store(target uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select auth_store_id() is null or auth_store_id() = target
$function$
;

CREATE OR REPLACE FUNCTION public.create_sale(p_store uuid, p_items jsonb, p_payment jsonb, p_customer uuid DEFAULT NULL::uuid, p_discount numeric DEFAULT 0, p_shift uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  cid uuid := auth_company_id();
  sale_id uuid;
  item jsonb;
  sub numeric := 0;
  debt_amt numeric := coalesce((p_payment->>'debt')::numeric, 0);
  bal_amt  numeric := coalesce((p_payment->>'from_balance')::numeric, 0);
begin
  if not can_see_store(p_store) then
    raise exception 'Bu do''konda ishlash huquqingiz yo''q';
  end if;

  for item in select * from jsonb_array_elements(p_items) loop
    sub := sub + (item->>'qty')::numeric * (item->>'price')::numeric;
  end loop;

  insert into sales (
    company_id, store_id, shift_id, no, type, customer_id, cashier_id,
    subtotal, discount, total,
    cash, card, payme, from_balance, debt
  ) values (
    cid, p_store, p_shift, next_doc_no(p_store, 'sale'), 'sale', p_customer, auth.uid(),
    sub, p_discount, sub - p_discount,
    coalesce((p_payment->>'cash')::numeric, 0),
    coalesce((p_payment->>'card')::numeric, 0),
    coalesce((p_payment->>'payme')::numeric, 0),
    bal_amt, debt_amt
  ) returning id into sale_id;

  for item in select * from jsonb_array_elements(p_items) loop
    insert into sale_items (sale_id, product_id, name, qty, price, cost_price, total)
    select sale_id, p.id, p.name,
           (item->>'qty')::numeric, (item->>'price')::numeric, p.cost_price,
           (item->>'qty')::numeric * (item->>'price')::numeric
      from products p where p.id = (item->>'product_id')::uuid;

    -- Xizmat (montaj) uchun qoldiq yuritilmaydi
    perform apply_stock(
      (item->>'product_id')::uuid, p_store, -(item->>'qty')::numeric,
      (select is_service from products where id = (item->>'product_id')::uuid)
    );
  end loop;

  if debt_amt > 0 then
    if p_customer is null then
      raise exception 'Qarzga sotish uchun mijoz tanlanishi shart';
    end if;
    insert into debts (company_id, customer_id, sale_id, store_id, amount, due_date)
    values (cid, p_customer, sale_id, p_store, debt_amt, current_date + 30);
  end if;

  if bal_amt > 0 then
    update customers set balance = balance - bal_amt
     where id = p_customer and balance >= bal_amt;
    if not found then
      raise exception 'Mijoz balansida yetarli mablag'' yo''q';
    end if;
  end if;

  return sale_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.is_manager()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce((select role in ('owner','manager') from public.profiles where id = auth.uid()), false) $function$
;

CREATE OR REPLACE FUNCTION public.is_owner()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce((select role = 'owner' from public.profiles where id = auth.uid()), false) $function$
;

CREATE OR REPLACE FUNCTION public.next_doc_no(p_store uuid, p_kind text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  cid uuid := auth_company_id();
  n bigint;
begin
  insert into doc_counters (company_id, store_id, kind)
  values (cid, p_store, p_kind)
  on conflict do nothing;

  update doc_counters set next_no = next_no + 1
   where company_id = cid and store_id = p_store and kind = p_kind
   returning next_no - 1 into n;

  return upper(left(p_kind, 2)) || '-' || lpad(n::text, 6, '0');
end $function$
;

CREATE OR REPLACE FUNCTION public.refresh_customer_stats()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  n int;
begin
  with agg as (
    select s.customer_id,
           sum(s.total)                       as purchases,
           count(*) filter (where s.type = 'sale') as cnt,
           coalesce(sum((select sum(i.qty) from sale_items i where i.sale_id = s.id)), 0) as items,
           max(s.sold_at)                     as last_at,
           min(s.sold_at)                     as first_at
    from sales s
    where s.customer_id is not null
    group by s.customer_id
  )
  update customers c
     set purchases_total = round(a.purchases, 2),
         sales_count     = a.cnt,
         items_bought    = round(a.items, 3),
         -- "Qaytuvchi mijoz" — bittadan ko'p marta xarid qilgan
         is_returning    = a.cnt > 1,
         last_purchase_at  = greatest(coalesce(c.last_purchase_at, a.last_at), a.last_at),
         first_purchase_at = least(coalesce(c.first_purchase_at, a.first_at), a.first_at)
    from agg a
   where a.customer_id = c.id;

  get diagnostics n = row_count;
  return n;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_usd_rate(p_rate numeric, p_source text DEFAULT 'manual'::text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare cid uuid;
begin
  if not is_manager() then
    raise exception 'Kursni faqat menejer yoki rahbar o''zgartira oladi';
  end if;

  cid := auth_company_id();
  if cid is null then
    raise exception 'Kompaniya topilmadi';
  end if;

  if p_rate is null or p_rate <= 0 then
    raise exception 'Kurs 0 dan katta bo''lishi kerak';
  end if;

  update companies
     set usd_rate = p_rate,
         -- Qo'lda yozilgan kurs o'zgartirilgunga qadar turadi
         usd_rate_auto = (p_source = 'cbu'),
         usd_rate_at = now()
   where id = cid;

  insert into usd_rates (company_id, rate, source, created_by)
  values (cid, p_rate, coalesce(p_source, 'manual'), auth.uid());

  return p_rate;
end $function$
;

CREATE OR REPLACE FUNCTION public.staff_company_id(p uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select company_id from profiles where id = p
$function$
;


-- ══════════════════════════════════════════════════════════════
-- JADVALLAR (39 ta)
-- ══════════════════════════════════════════════════════════════

create table if not exists "audit_log" (
  "id" bigint default nextval('audit_log_id_seq'::regclass) not null,
  "company_id" uuid default auth_company_id() not null,
  "actor_id" uuid,
  "table_name" text not null,
  "row_id" uuid,
  "action" text not null,
  "before" jsonb,
  "after" jsonb,
  "at" timestamp with time zone default now() not null
);

create table if not exists "billz_sync_log" (
  "id" uuid default gen_random_uuid() not null,
  "company_id" uuid default auth_company_id() not null,
  "entity" text not null,
  "mode" text default 'incremental'::text not null,
  "started_at" timestamp with time zone default now() not null,
  "finished_at" timestamp with time zone,
  "cursor_at" timestamp with time zone,
  "fetched" integer default 0 not null,
  "inserted" integer default 0 not null,
  "updated" integer default 0 not null,
  "skipped" integer default 0 not null,
  "error" text
);

create table if not exists "cash_operations" (
  "id" uuid default uuid_generate_v4() not null,
  "company_id" uuid default auth_company_id() not null,
  "store_id" uuid,
  "shift_id" uuid,
  "direction" text not null,
  "category" text not null,
  "amount" numeric(12,2) not null,
  "method" text default 'cash'::text not null,
  "note" text,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null
);

create table if not exists "categories" (
  "id" uuid default uuid_generate_v4() not null,
  "company_id" uuid default auth_company_id() not null,
  "name" text not null,
  "billz_id" uuid
);

create table if not exists "companies" (
  "id" uuid default uuid_generate_v4() not null,
  "name" text not null,
  "currency" text default 'USD'::text not null,
  "created_at" timestamp with time zone default now() not null,
  "usd_rate" numeric,
  "usd_rate_auto" boolean default true not null,
  "usd_rate_at" timestamp with time zone,
  "service_names" text default 'montaj'::text,
  "ledger_start" date default (date_trunc('month'::text, now()))::date not null
);

create table if not exists "customers" (
  "id" uuid default uuid_generate_v4() not null,
  "company_id" uuid default auth_company_id() not null,
  "name" text not null,
  "phone" text,
  "store_id" uuid,
  "balance" numeric(12,2) default 0 not null,
  "cashback" numeric(12,2) default 0 not null,
  "note" text,
  "created_at" timestamp with time zone default now() not null,
  "billz_id" uuid,
  "billz_external_id" text,
  "first_purchase_at" timestamp with time zone,
  "last_purchase_at" timestamp with time zone,
  "purchases_total" numeric(14,2) default 0 not null,
  "sales_count" integer default 0 not null,
  "items_bought" numeric(14,3) default 0 not null,
  "is_returning" boolean default false not null
);

create table if not exists "dataset_chunks" (
  "id" bigint default nextval('dataset_chunks_id_seq'::regclass) not null,
  "dataset_id" uuid not null,
  "seq" integer not null,
  "rows" jsonb not null
);

create table if not exists "datasets" (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "report_id" text,
  "report_label" text,
  "file_name" text,
  "sheet_name" text,
  "header" jsonb default '[]'::jsonb not null,
  "profile" jsonb,
  "row_count" integer default 0 not null,
  "created_at" timestamp with time zone default now() not null,
  "company_id" uuid default auth_company_id() not null
);

create table if not exists "debt_payments" (
  "id" uuid default uuid_generate_v4() not null,
  "debt_id" uuid not null,
  "amount" numeric(14,4) not null,
  "paid_at" timestamp with time zone default now() not null,
  "method" text default 'cash'::text not null,
  "kind" text default 'payment'::text not null,
  "received_by" uuid,
  "billz_key" text
);

create table if not exists "debts" (
  "id" uuid default uuid_generate_v4() not null,
  "company_id" uuid default auth_company_id() not null,
  "customer_id" uuid not null,
  "sale_id" uuid,
  "store_id" uuid,
  "amount" numeric(14,4) not null,
  "issued_at" timestamp with time zone default now() not null,
  "due_date" date,
  "closed_at" timestamp with time zone,
  "billz_id" uuid,
  "status" text,
  "paid_amount" numeric(14,4) default 0 not null,
  "comment" text,
  "source" text default 'nspos'::text not null
);

create table if not exists "doc_counters" (
  "company_id" uuid default auth_company_id() not null,
  "store_id" uuid not null,
  "kind" text not null,
  "next_no" bigint default 1 not null
);

create table if not exists "expenses" (
  "id" uuid default uuid_generate_v4() not null,
  "company_id" uuid default auth_company_id() not null,
  "store_id" uuid,
  "category" text not null,
  "amount" numeric(12,2) not null,
  "method" text default 'cash'::text not null,
  "note" text,
  "spent_on" date,
  "is_recurring" boolean default false not null,
  "day_of_month" smallint,
  "active_from" date,
  "active_to" date,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "kassa" text default 'company'::text not null,
  "amount_som" numeric,
  "rate_used" numeric,
  "staff_id" uuid,
  "paid_to" text
);

create table if not exists "invites" (
  "id" uuid default gen_random_uuid() not null,
  "email" text not null,
  "full_name" text,
  "phone" text,
  "role" user_role default 'cashier'::user_role not null,
  "store_id" uuid,
  "fixed_salary" numeric(14,2) default 0,
  "sales_pct" numeric(6,2) default 0,
  "service_pct" numeric(6,2) default 0,
  "created_at" timestamp with time zone default now() not null,
  "company_id" uuid default auth_company_id()
);

create table if not exists "kassa_ops" (
  "id" uuid default gen_random_uuid() not null,
  "kassa" text not null,
  "wallet" text not null,
  "kind" text not null,
  "amount" numeric(14,2) not null,
  "op_date" date default CURRENT_DATE not null,
  "category" text,
  "note" text,
  "staff_id" uuid,
  "status" text,
  "decided_by" uuid,
  "decided_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "company_id" uuid default auth_company_id() not null,
  "amount_som" numeric(16,2),
  "rate_used" numeric(14,2)
);

create table if not exists "kpi_assign" (
  "staff_id" uuid not null,
  "kpi_type" text default 'b2b'::text not null,
  "updated_at" timestamp with time zone default now()
);

create table if not exists "kpi_day" (
  "id" text not null,
  "staff_id" uuid not null,
  "date" text not null,
  "data" jsonb default '{}'::jsonb not null,
  "updated_at" timestamp with time zone default now()
);

create table if not exists "kpi_plan" (
  "id" text not null,
  "staff_id" uuid not null,
  "month" text not null,
  "data" jsonb default '{}'::jsonb not null,
  "updated_at" timestamp with time zone default now()
);

create table if not exists "nps_records" (
  "id" text not null,
  "company_id" uuid default auth_company_id() not null,
  "installer_id" uuid,
  "customer_name" text,
  "phone" text,
  "score" integer,
  "comment" text,
  "month" text not null,
  "created_by" uuid,
  "created_at" timestamp with time zone default now(),
  "installed_date" date,
  "product_score" integer,
  "product_comment" text
);

create table if not exists "payouts" (
  "id" uuid default gen_random_uuid() not null,
  "company_id" uuid default auth_company_id() not null,
  "title" text not null,
  "amount" numeric(14,2) not null,
  "amount_som" numeric(16,2),
  "rate_used" numeric(14,2),
  "due_date" date not null,
  "kassa" text default 'company'::text not null,
  "wallet" text default 'cash'::text not null,
  "category" text default 'other_out'::text not null,
  "note" text,
  "status" text default 'planned'::text not null,
  "paid_at" timestamp with time zone,
  "op_id" uuid,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null
);

create table if not exists "payroll_payments" (
  "id" uuid default uuid_generate_v4() not null,
  "company_id" uuid default auth_company_id() not null,
  "staff_id" uuid not null,
  "amount" numeric(12,2) not null,
  "period_from" date not null,
  "period_to" date not null,
  "method" text default 'cash'::text not null,
  "note" text,
  "paid_at" timestamp with time zone default now() not null,
  "paid_by" uuid
);

create table if not exists "products" (
  "id" uuid default uuid_generate_v4() not null,
  "company_id" uuid default auth_company_id() not null,
  "name" text not null,
  "sku" text,
  "barcode" text,
  "category_id" uuid,
  "brand" text,
  "supplier" text,
  "sale_price" numeric(12,2) default 0 not null,
  "cost_price" numeric(12,2) default 0 not null,
  "is_service" boolean default false not null,
  "is_active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "billz_id" uuid,
  "unit" text,
  "description" text,
  "is_variative" boolean default false not null
);

create table if not exists "profiles" (
  "id" uuid not null,
  "company_id" uuid not null,
  "full_name" text not null,
  "phone" text,
  "role" user_role default 'cashier'::user_role not null,
  "store_id" uuid,
  "is_active" boolean default true not null,
  "fixed_salary" numeric(12,2) default 0 not null,
  "sales_pct" numeric(5,2) default 0 not null,
  "service_pct" numeric(5,2) default 0 not null,
  "created_at" timestamp with time zone default now() not null,
  "perms" jsonb
);

create table if not exists "sale_items" (
  "id" uuid default uuid_generate_v4() not null,
  "sale_id" uuid not null,
  "product_id" uuid not null,
  "name" text not null,
  "qty" numeric(12,3) not null,
  "price" numeric(12,2) not null,
  "cost_price" numeric(12,2) default 0 not null,
  "total" numeric(12,2) not null,
  "billz_product_id" uuid,
  "billz_id" uuid
);

create table if not exists "sales" (
  "id" uuid default uuid_generate_v4() not null,
  "company_id" uuid default auth_company_id() not null,
  "store_id" uuid not null,
  "shift_id" uuid,
  "no" text not null,
  "type" sale_type default 'sale'::sale_type not null,
  "original_id" uuid,
  "customer_id" uuid,
  "cashier_id" uuid,
  "sold_at" timestamp with time zone default now() not null,
  "subtotal" numeric(12,2) default 0 not null,
  "discount" numeric(12,2) default 0 not null,
  "total" numeric(12,2) default 0 not null,
  "cash" numeric(12,2) default 0 not null,
  "card" numeric(12,2) default 0 not null,
  "payme" numeric(12,2) default 0 not null,
  "from_balance" numeric(12,2) default 0 not null,
  "debt" numeric(12,2) default 0 not null,
  "imported" boolean default false not null,
  "created_at" timestamp with time zone default now() not null,
  "billz_id" uuid,
  "billz_user_id" uuid,
  "billz_user_name" text
);

create table if not exists "service_items" (
  "id" uuid default uuid_generate_v4() not null,
  "order_id" uuid not null,
  "kind" text not null,
  "product_id" uuid,
  "name" text not null,
  "qty" numeric(12,3) default 1 not null,
  "price" numeric(12,2) default 0 not null,
  "cost" numeric(12,2) default 0 not null
);

create table if not exists "service_orders" (
  "id" uuid default uuid_generate_v4() not null,
  "company_id" uuid default auth_company_id() not null,
  "no" text not null,
  "customer_id" uuid,
  "store_id" uuid,
  "installer_id" uuid,
  "status" text default 'yangi'::text not null,
  "address" text,
  "note" text,
  "scheduled_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists "shifts" (
  "id" uuid default uuid_generate_v4() not null,
  "company_id" uuid default auth_company_id() not null,
  "store_id" uuid not null,
  "cashier_id" uuid not null,
  "opened_at" timestamp with time zone default now() not null,
  "closed_at" timestamp with time zone,
  "opening_cash" numeric(12,2) default 0 not null,
  "counted_cash" numeric(12,2),
  "note" text
);

create table if not exists "shipment_costs" (
  "id" uuid default uuid_generate_v4() not null,
  "shipment_id" uuid not null,
  "type" text not null,
  "amount" numeric(12,2) not null,
  "note" text
);

create table if not exists "shipment_items" (
  "id" uuid default uuid_generate_v4() not null,
  "shipment_id" uuid not null,
  "product_id" uuid not null,
  "qty" numeric(12,3) not null,
  "unit_price" numeric(12,2) not null
);

create table if not exists "shipments" (
  "id" uuid default uuid_generate_v4() not null,
  "company_id" uuid default auth_company_id() not null,
  "no" text not null,
  "supplier" text,
  "store_id" uuid,
  "shipped_at" date not null,
  "status" text default 'draft'::text not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists "stock" (
  "product_id" uuid not null,
  "store_id" uuid not null,
  "qty" numeric(12,3) default 0 not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "store_plans" (
  "store_id" uuid not null,
  "monthly" numeric(12,2) default 0 not null,
  "updated_at" timestamp with time zone default now() not null
);

create table if not exists "stores" (
  "id" uuid default uuid_generate_v4() not null,
  "company_id" uuid default auth_company_id() not null,
  "name" text not null,
  "kind" text default 'shop'::text not null,
  "is_active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists "supplier_invoices" (
  "id" uuid default uuid_generate_v4() not null,
  "company_id" uuid default auth_company_id() not null,
  "supplier_id" uuid not null,
  "shipment_id" uuid,
  "amount" numeric(12,2) not null,
  "invoice_date" date not null,
  "due_date" date,
  "note" text
);

create table if not exists "supplier_payments" (
  "id" uuid default uuid_generate_v4() not null,
  "invoice_id" uuid not null,
  "amount" numeric(12,2) not null,
  "paid_at" timestamp with time zone default now() not null,
  "method" text default 'cash'::text not null,
  "paid_by" uuid
);

create table if not exists "suppliers" (
  "id" uuid default uuid_generate_v4() not null,
  "company_id" uuid default auth_company_id() not null,
  "name" text not null,
  "phone" text,
  "note" text,
  "billz_id" uuid
);

create table if not exists "usd_rates" (
  "id" uuid default gen_random_uuid() not null,
  "company_id" uuid default auth_company_id() not null,
  "rate" numeric(14,2) not null,
  "source" text default 'manual'::text not null,
  "note" text,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null
);

create table if not exists "warehouse_items" (
  "id" uuid default uuid_generate_v4() not null,
  "operation_id" uuid not null,
  "product_id" uuid not null,
  "qty" numeric(12,3) not null,
  "counted_qty" numeric(12,3),
  "unit_cost" numeric(12,2) default 0 not null
);

create table if not exists "warehouse_operations" (
  "id" uuid default uuid_generate_v4() not null,
  "company_id" uuid default auth_company_id() not null,
  "no" text not null,
  "type" warehouse_op not null,
  "from_store_id" uuid,
  "to_store_id" uuid,
  "status" text default 'draft'::text not null,
  "reason" text,
  "created_by" uuid default auth.uid(),
  "applied_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "applied_at" timestamp with time zone
);


-- ══════════════════════════════════════════════════════════════
-- KETMA-KETLIK EGALIGI (2 ta)
-- ══════════════════════════════════════════════════════════════

alter sequence "audit_log_id_seq" owned by "audit_log"."id";
alter sequence "dataset_chunks_id_seq" owned by "dataset_chunks"."id";

-- ══════════════════════════════════════════════════════════════
-- CHEKLOVLAR (154 ta)
-- ══════════════════════════════════════════════════════════════


-- —— birlamchi kalit ——
alter table "audit_log" drop constraint if exists "audit_log_pkey";
alter table "audit_log" add constraint "audit_log_pkey" PRIMARY KEY (id);
alter table "billz_sync_log" drop constraint if exists "billz_sync_log_pkey";
alter table "billz_sync_log" add constraint "billz_sync_log_pkey" PRIMARY KEY (id);
alter table "cash_operations" drop constraint if exists "cash_operations_pkey";
alter table "cash_operations" add constraint "cash_operations_pkey" PRIMARY KEY (id);
alter table "categories" drop constraint if exists "categories_pkey";
alter table "categories" add constraint "categories_pkey" PRIMARY KEY (id);
alter table "companies" drop constraint if exists "companies_pkey";
alter table "companies" add constraint "companies_pkey" PRIMARY KEY (id);
alter table "customers" drop constraint if exists "customers_pkey";
alter table "customers" add constraint "customers_pkey" PRIMARY KEY (id);
alter table "dataset_chunks" drop constraint if exists "dataset_chunks_pkey";
alter table "dataset_chunks" add constraint "dataset_chunks_pkey" PRIMARY KEY (id);
alter table "datasets" drop constraint if exists "datasets_pkey";
alter table "datasets" add constraint "datasets_pkey" PRIMARY KEY (id);
alter table "debt_payments" drop constraint if exists "debt_payments_pkey";
alter table "debt_payments" add constraint "debt_payments_pkey" PRIMARY KEY (id);
alter table "debts" drop constraint if exists "debts_pkey";
alter table "debts" add constraint "debts_pkey" PRIMARY KEY (id);
alter table "doc_counters" drop constraint if exists "doc_counters_pkey";
alter table "doc_counters" add constraint "doc_counters_pkey" PRIMARY KEY (company_id, store_id, kind);
alter table "expenses" drop constraint if exists "expenses_pkey";
alter table "expenses" add constraint "expenses_pkey" PRIMARY KEY (id);
alter table "invites" drop constraint if exists "invites_pkey";
alter table "invites" add constraint "invites_pkey" PRIMARY KEY (id);
alter table "kassa_ops" drop constraint if exists "kassa_ops_pkey";
alter table "kassa_ops" add constraint "kassa_ops_pkey" PRIMARY KEY (id);
alter table "kpi_assign" drop constraint if exists "kpi_assign_pkey";
alter table "kpi_assign" add constraint "kpi_assign_pkey" PRIMARY KEY (staff_id);
alter table "kpi_day" drop constraint if exists "kpi_day_pkey";
alter table "kpi_day" add constraint "kpi_day_pkey" PRIMARY KEY (id);
alter table "kpi_plan" drop constraint if exists "kpi_plan_pkey";
alter table "kpi_plan" add constraint "kpi_plan_pkey" PRIMARY KEY (id);
alter table "nps_records" drop constraint if exists "nps_records_pkey";
alter table "nps_records" add constraint "nps_records_pkey" PRIMARY KEY (id);
alter table "payouts" drop constraint if exists "payouts_pkey";
alter table "payouts" add constraint "payouts_pkey" PRIMARY KEY (id);
alter table "payroll_payments" drop constraint if exists "payroll_payments_pkey";
alter table "payroll_payments" add constraint "payroll_payments_pkey" PRIMARY KEY (id);
alter table "products" drop constraint if exists "products_pkey";
alter table "products" add constraint "products_pkey" PRIMARY KEY (id);
alter table "profiles" drop constraint if exists "profiles_pkey";
alter table "profiles" add constraint "profiles_pkey" PRIMARY KEY (id);
alter table "sale_items" drop constraint if exists "sale_items_pkey";
alter table "sale_items" add constraint "sale_items_pkey" PRIMARY KEY (id);
alter table "sales" drop constraint if exists "sales_pkey";
alter table "sales" add constraint "sales_pkey" PRIMARY KEY (id);
alter table "service_items" drop constraint if exists "service_items_pkey";
alter table "service_items" add constraint "service_items_pkey" PRIMARY KEY (id);
alter table "service_orders" drop constraint if exists "service_orders_pkey";
alter table "service_orders" add constraint "service_orders_pkey" PRIMARY KEY (id);
alter table "shifts" drop constraint if exists "shifts_pkey";
alter table "shifts" add constraint "shifts_pkey" PRIMARY KEY (id);
alter table "shipment_costs" drop constraint if exists "shipment_costs_pkey";
alter table "shipment_costs" add constraint "shipment_costs_pkey" PRIMARY KEY (id);
alter table "shipment_items" drop constraint if exists "shipment_items_pkey";
alter table "shipment_items" add constraint "shipment_items_pkey" PRIMARY KEY (id);
alter table "shipments" drop constraint if exists "shipments_pkey";
alter table "shipments" add constraint "shipments_pkey" PRIMARY KEY (id);
alter table "stock" drop constraint if exists "stock_pkey";
alter table "stock" add constraint "stock_pkey" PRIMARY KEY (product_id, store_id);
alter table "store_plans" drop constraint if exists "store_plans_pkey";
alter table "store_plans" add constraint "store_plans_pkey" PRIMARY KEY (store_id);
alter table "stores" drop constraint if exists "stores_pkey";
alter table "stores" add constraint "stores_pkey" PRIMARY KEY (id);
alter table "supplier_invoices" drop constraint if exists "supplier_invoices_pkey";
alter table "supplier_invoices" add constraint "supplier_invoices_pkey" PRIMARY KEY (id);
alter table "supplier_payments" drop constraint if exists "supplier_payments_pkey";
alter table "supplier_payments" add constraint "supplier_payments_pkey" PRIMARY KEY (id);
alter table "suppliers" drop constraint if exists "suppliers_pkey";
alter table "suppliers" add constraint "suppliers_pkey" PRIMARY KEY (id);
alter table "usd_rates" drop constraint if exists "usd_rates_pkey";
alter table "usd_rates" add constraint "usd_rates_pkey" PRIMARY KEY (id);
alter table "warehouse_items" drop constraint if exists "warehouse_items_pkey";
alter table "warehouse_items" add constraint "warehouse_items_pkey" PRIMARY KEY (id);
alter table "warehouse_operations" drop constraint if exists "warehouse_operations_pkey";
alter table "warehouse_operations" add constraint "warehouse_operations_pkey" PRIMARY KEY (id);

-- —— noyob ——
alter table "categories" drop constraint if exists "categories_company_id_name_key";
alter table "categories" add constraint "categories_company_id_name_key" UNIQUE (company_id, name);
alter table "dataset_chunks" drop constraint if exists "dataset_chunks_dataset_id_seq_key";
alter table "dataset_chunks" add constraint "dataset_chunks_dataset_id_seq_key" UNIQUE (dataset_id, seq);
alter table "invites" drop constraint if exists "invites_email_key";
alter table "invites" add constraint "invites_email_key" UNIQUE (email);
alter table "kpi_day" drop constraint if exists "kpi_day_staff_id_date_key";
alter table "kpi_day" add constraint "kpi_day_staff_id_date_key" UNIQUE (staff_id, date);
alter table "kpi_plan" drop constraint if exists "kpi_plan_staff_id_month_key";
alter table "kpi_plan" add constraint "kpi_plan_staff_id_month_key" UNIQUE (staff_id, month);
alter table "products" drop constraint if exists "products_company_id_barcode_key";
alter table "products" add constraint "products_company_id_barcode_key" UNIQUE (company_id, barcode);
alter table "service_orders" drop constraint if exists "service_orders_company_id_no_key";
alter table "service_orders" add constraint "service_orders_company_id_no_key" UNIQUE (company_id, no);
alter table "shipments" drop constraint if exists "shipments_company_id_no_key";
alter table "shipments" add constraint "shipments_company_id_no_key" UNIQUE (company_id, no);
alter table "warehouse_operations" drop constraint if exists "warehouse_operations_company_id_no_key";
alter table "warehouse_operations" add constraint "warehouse_operations_company_id_no_key" UNIQUE (company_id, no);

-- —— tekshiruv ——
alter table "audit_log" drop constraint if exists "audit_log_action_check";
alter table "audit_log" add constraint "audit_log_action_check" CHECK ((action = ANY (ARRAY['insert'::text, 'update'::text, 'delete'::text])));
alter table "cash_operations" drop constraint if exists "cash_operations_direction_check";
alter table "cash_operations" add constraint "cash_operations_direction_check" CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text])));
alter table "debt_payments" drop constraint if exists "debt_payments_kind_check";
alter table "debt_payments" add constraint "debt_payments_kind_check" CHECK ((kind = ANY (ARRAY['payment'::text, 'return'::text])));
alter table "expenses" drop constraint if exists "expense_kind";
alter table "expenses" add constraint "expense_kind" CHECK (((is_recurring AND (day_of_month IS NOT NULL) AND (active_from IS NOT NULL)) OR ((NOT is_recurring) AND (spent_on IS NOT NULL))));
alter table "expenses" drop constraint if exists "expenses_day_of_month_check";
alter table "expenses" add constraint "expenses_day_of_month_check" CHECK (((day_of_month >= 1) AND (day_of_month <= 28)));
alter table "expenses" drop constraint if exists "expenses_kassa_check";
alter table "expenses" add constraint "expenses_kassa_check" CHECK (((kassa = 'company'::text) OR (kassa ~ '^[0-9a-f-]{36}$'::text) OR (kassa ~ '^s[0-9]+$'::text)));
alter table "kassa_ops" drop constraint if exists "kassa_ops_amount_check";
alter table "kassa_ops" add constraint "kassa_ops_amount_check" CHECK ((amount >= (0)::numeric));
alter table "kassa_ops" drop constraint if exists "kassa_ops_kassa_check";
alter table "kassa_ops" add constraint "kassa_ops_kassa_check" CHECK (((kassa = 'company'::text) OR (kassa ~ '^[0-9a-f-]{36}$'::text) OR (kassa ~ '^s[0-9]+$'::text)));
alter table "kassa_ops" drop constraint if exists "kassa_ops_kind_check";
alter table "kassa_ops" add constraint "kassa_ops_kind_check" CHECK ((kind = ANY (ARRAY['in'::text, 'out'::text, 'transfer'::text])));
alter table "kassa_ops" drop constraint if exists "kassa_ops_status_check";
alter table "kassa_ops" add constraint "kassa_ops_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
alter table "kassa_ops" drop constraint if exists "kassa_ops_status_kind";
alter table "kassa_ops" add constraint "kassa_ops_status_kind" CHECK ((((kind = 'transfer'::text) AND (status IS NOT NULL)) OR ((kind <> 'transfer'::text) AND (status IS NULL))));
alter table "kassa_ops" drop constraint if exists "kassa_ops_wallet_check";
alter table "kassa_ops" add constraint "kassa_ops_wallet_check" CHECK ((wallet = ANY (ARRAY['cash'::text, 'payme'::text, 'service'::text])));
alter table "payouts" drop constraint if exists "payouts_amount_check";
alter table "payouts" add constraint "payouts_amount_check" CHECK ((amount > (0)::numeric));
alter table "payouts" drop constraint if exists "payouts_kassa_check";
alter table "payouts" add constraint "payouts_kassa_check" CHECK (((kassa = 'company'::text) OR (kassa ~ '^[0-9a-f-]{36}$'::text) OR (kassa ~ '^s[0-9]+$'::text)));
alter table "payouts" drop constraint if exists "payouts_paid_at_check";
alter table "payouts" add constraint "payouts_paid_at_check" CHECK ((((status = 'paid'::text) AND (paid_at IS NOT NULL)) OR ((status <> 'paid'::text) AND (paid_at IS NULL))));
alter table "payouts" drop constraint if exists "payouts_status_check";
alter table "payouts" add constraint "payouts_status_check" CHECK ((status = ANY (ARRAY['planned'::text, 'paid'::text])));
alter table "payouts" drop constraint if exists "payouts_wallet_check";
alter table "payouts" add constraint "payouts_wallet_check" CHECK ((wallet = ANY (ARRAY['cash'::text, 'payme'::text, 'service'::text])));
alter table "service_items" drop constraint if exists "service_items_kind_check";
alter table "service_items" add constraint "service_items_kind_check" CHECK ((kind = ANY (ARRAY['work'::text, 'material'::text])));
alter table "service_orders" drop constraint if exists "service_orders_status_check";
alter table "service_orders" add constraint "service_orders_status_check" CHECK ((status = ANY (ARRAY['yangi'::text, 'jarayonda'::text, 'bajarildi'::text, 'bekor'::text])));
alter table "shipments" drop constraint if exists "shipments_status_check";
alter table "shipments" add constraint "shipments_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'applied'::text])));
alter table "stores" drop constraint if exists "stores_kind_check";
alter table "stores" add constraint "stores_kind_check" CHECK ((kind = ANY (ARRAY['shop'::text, 'warehouse'::text])));
alter table "usd_rates" drop constraint if exists "usd_rates_rate_check";
alter table "usd_rates" add constraint "usd_rates_rate_check" CHECK ((rate > (0)::numeric));
alter table "usd_rates" drop constraint if exists "usd_rates_source_check";
alter table "usd_rates" add constraint "usd_rates_source_check" CHECK ((source = ANY (ARRAY['manual'::text, 'cbu'::text])));
alter table "warehouse_operations" drop constraint if exists "warehouse_operations_status_check";
alter table "warehouse_operations" add constraint "warehouse_operations_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'applied'::text, 'cancelled'::text])));

-- —— tashqi kalit ——
alter table "billz_sync_log" drop constraint if exists "billz_sync_log_company_id_fkey";
alter table "billz_sync_log" add constraint "billz_sync_log_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table "cash_operations" drop constraint if exists "cash_operations_company_id_fkey";
alter table "cash_operations" add constraint "cash_operations_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table "cash_operations" drop constraint if exists "cash_operations_created_by_fkey";
alter table "cash_operations" add constraint "cash_operations_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);
alter table "cash_operations" drop constraint if exists "cash_operations_shift_id_fkey";
alter table "cash_operations" add constraint "cash_operations_shift_id_fkey" FOREIGN KEY (shift_id) REFERENCES shifts(id);
alter table "cash_operations" drop constraint if exists "cash_operations_store_id_fkey";
alter table "cash_operations" add constraint "cash_operations_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id);
alter table "categories" drop constraint if exists "categories_company_id_fkey";
alter table "categories" add constraint "categories_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table "customers" drop constraint if exists "customers_company_id_fkey";
alter table "customers" add constraint "customers_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table "customers" drop constraint if exists "customers_store_id_fkey";
alter table "customers" add constraint "customers_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL;
alter table "dataset_chunks" drop constraint if exists "dataset_chunks_dataset_id_fkey";
alter table "dataset_chunks" add constraint "dataset_chunks_dataset_id_fkey" FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE;
alter table "datasets" drop constraint if exists "datasets_company_id_fkey";
alter table "datasets" add constraint "datasets_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table "debt_payments" drop constraint if exists "debt_payments_debt_id_fkey";
alter table "debt_payments" add constraint "debt_payments_debt_id_fkey" FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE;
alter table "debt_payments" drop constraint if exists "debt_payments_received_by_fkey";
alter table "debt_payments" add constraint "debt_payments_received_by_fkey" FOREIGN KEY (received_by) REFERENCES profiles(id);
alter table "debts" drop constraint if exists "debts_company_id_fkey";
alter table "debts" add constraint "debts_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table "debts" drop constraint if exists "debts_customer_id_fkey";
alter table "debts" add constraint "debts_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
alter table "debts" drop constraint if exists "debts_sale_id_fkey";
alter table "debts" add constraint "debts_sale_id_fkey" FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL;
alter table "debts" drop constraint if exists "debts_store_id_fkey";
alter table "debts" add constraint "debts_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id);
alter table "doc_counters" drop constraint if exists "doc_counters_company_id_fkey";
alter table "doc_counters" add constraint "doc_counters_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table "doc_counters" drop constraint if exists "doc_counters_store_id_fkey";
alter table "doc_counters" add constraint "doc_counters_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
alter table "expenses" drop constraint if exists "expenses_company_id_fkey";
alter table "expenses" add constraint "expenses_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table "expenses" drop constraint if exists "expenses_created_by_fkey";
alter table "expenses" add constraint "expenses_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);
alter table "expenses" drop constraint if exists "expenses_staff_id_fkey";
alter table "expenses" add constraint "expenses_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table "expenses" drop constraint if exists "expenses_store_id_fkey";
alter table "expenses" add constraint "expenses_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id);
alter table "invites" drop constraint if exists "invites_company_id_fkey";
alter table "invites" add constraint "invites_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table "invites" drop constraint if exists "invites_store_id_fkey";
alter table "invites" add constraint "invites_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL;
alter table "kassa_ops" drop constraint if exists "kassa_ops_company_id_fkey";
alter table "kassa_ops" add constraint "kassa_ops_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table "kassa_ops" drop constraint if exists "kassa_ops_decided_by_fkey";
alter table "kassa_ops" add constraint "kassa_ops_decided_by_fkey" FOREIGN KEY (decided_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table "kassa_ops" drop constraint if exists "kassa_ops_staff_id_fkey";
alter table "kassa_ops" add constraint "kassa_ops_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table "kpi_assign" drop constraint if exists "kpi_assign_staff_id_fkey";
alter table "kpi_assign" add constraint "kpi_assign_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table "kpi_day" drop constraint if exists "kpi_day_staff_id_fkey";
alter table "kpi_day" add constraint "kpi_day_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table "kpi_plan" drop constraint if exists "kpi_plan_staff_id_fkey";
alter table "kpi_plan" add constraint "kpi_plan_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table "payouts" drop constraint if exists "payouts_company_id_fkey";
alter table "payouts" add constraint "payouts_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table "payouts" drop constraint if exists "payouts_created_by_fkey";
alter table "payouts" add constraint "payouts_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table "payouts" drop constraint if exists "payouts_op_id_fkey";
alter table "payouts" add constraint "payouts_op_id_fkey" FOREIGN KEY (op_id) REFERENCES kassa_ops(id) ON DELETE SET NULL;
alter table "payroll_payments" drop constraint if exists "payroll_payments_company_id_fkey";
alter table "payroll_payments" add constraint "payroll_payments_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table "payroll_payments" drop constraint if exists "payroll_payments_paid_by_fkey";
alter table "payroll_payments" add constraint "payroll_payments_paid_by_fkey" FOREIGN KEY (paid_by) REFERENCES profiles(id);
alter table "payroll_payments" drop constraint if exists "payroll_payments_staff_id_fkey";
alter table "payroll_payments" add constraint "payroll_payments_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES profiles(id);
alter table "products" drop constraint if exists "products_category_id_fkey";
alter table "products" add constraint "products_category_id_fkey" FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
alter table "products" drop constraint if exists "products_company_id_fkey";
alter table "products" add constraint "products_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table "profiles" drop constraint if exists "profiles_company_id_fkey";
alter table "profiles" add constraint "profiles_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table "profiles" drop constraint if exists "profiles_id_fkey";
alter table "profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table "profiles" drop constraint if exists "profiles_store_id_fkey";
alter table "profiles" add constraint "profiles_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL;
alter table "sale_items" drop constraint if exists "sale_items_product_id_fkey";
alter table "sale_items" add constraint "sale_items_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id);
alter table "sale_items" drop constraint if exists "sale_items_sale_id_fkey";
alter table "sale_items" add constraint "sale_items_sale_id_fkey" FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;
alter table "sales" drop constraint if exists "sales_cashier_id_fkey";
alter table "sales" add constraint "sales_cashier_id_fkey" FOREIGN KEY (cashier_id) REFERENCES profiles(id);
alter table "sales" drop constraint if exists "sales_company_id_fkey";
alter table "sales" add constraint "sales_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table "sales" drop constraint if exists "sales_customer_id_fkey";
alter table "sales" add constraint "sales_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
alter table "sales" drop constraint if exists "sales_original_id_fkey";
alter table "sales" add constraint "sales_original_id_fkey" FOREIGN KEY (original_id) REFERENCES sales(id);
alter table "sales" drop constraint if exists "sales_shift_id_fkey";
alter table "sales" add constraint "sales_shift_id_fkey" FOREIGN KEY (shift_id) REFERENCES shifts(id);
alter table "sales" drop constraint if exists "sales_store_id_fkey";
alter table "sales" add constraint "sales_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id);
alter table "service_items" drop constraint if exists "service_items_order_id_fkey";
alter table "service_items" add constraint "service_items_order_id_fkey" FOREIGN KEY (order_id) REFERENCES service_orders(id) ON DELETE CASCADE;
alter table "service_items" drop constraint if exists "service_items_product_id_fkey";
alter table "service_items" add constraint "service_items_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id);
alter table "service_orders" drop constraint if exists "service_orders_company_id_fkey";
alter table "service_orders" add constraint "service_orders_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table "service_orders" drop constraint if exists "service_orders_customer_id_fkey";
alter table "service_orders" add constraint "service_orders_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
alter table "service_orders" drop constraint if exists "service_orders_installer_id_fkey";
alter table "service_orders" add constraint "service_orders_installer_id_fkey" FOREIGN KEY (installer_id) REFERENCES profiles(id);
alter table "service_orders" drop constraint if exists "service_orders_store_id_fkey";
alter table "service_orders" add constraint "service_orders_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id);
alter table "shifts" drop constraint if exists "shifts_cashier_id_fkey";
alter table "shifts" add constraint "shifts_cashier_id_fkey" FOREIGN KEY (cashier_id) REFERENCES profiles(id);
alter table "shifts" drop constraint if exists "shifts_company_id_fkey";
alter table "shifts" add constraint "shifts_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table "shifts" drop constraint if exists "shifts_store_id_fkey";
alter table "shifts" add constraint "shifts_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id);
alter table "shipment_costs" drop constraint if exists "shipment_costs_shipment_id_fkey";
alter table "shipment_costs" add constraint "shipment_costs_shipment_id_fkey" FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE;
alter table "shipment_items" drop constraint if exists "shipment_items_product_id_fkey";
alter table "shipment_items" add constraint "shipment_items_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id);
alter table "shipment_items" drop constraint if exists "shipment_items_shipment_id_fkey";
alter table "shipment_items" add constraint "shipment_items_shipment_id_fkey" FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE;
alter table "shipments" drop constraint if exists "shipments_company_id_fkey";
alter table "shipments" add constraint "shipments_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table "shipments" drop constraint if exists "shipments_store_id_fkey";
alter table "shipments" add constraint "shipments_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id);
alter table "stock" drop constraint if exists "stock_product_id_fkey";
alter table "stock" add constraint "stock_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
alter table "stock" drop constraint if exists "stock_store_id_fkey";
alter table "stock" add constraint "stock_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
alter table "store_plans" drop constraint if exists "store_plans_store_id_fkey";
alter table "store_plans" add constraint "store_plans_store_id_fkey" FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
alter table "stores" drop constraint if exists "stores_company_id_fkey";
alter table "stores" add constraint "stores_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table "supplier_invoices" drop constraint if exists "supplier_invoices_company_id_fkey";
alter table "supplier_invoices" add constraint "supplier_invoices_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table "supplier_invoices" drop constraint if exists "supplier_invoices_shipment_id_fkey";
alter table "supplier_invoices" add constraint "supplier_invoices_shipment_id_fkey" FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE SET NULL;
alter table "supplier_invoices" drop constraint if exists "supplier_invoices_supplier_id_fkey";
alter table "supplier_invoices" add constraint "supplier_invoices_supplier_id_fkey" FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE;
alter table "supplier_payments" drop constraint if exists "supplier_payments_invoice_id_fkey";
alter table "supplier_payments" add constraint "supplier_payments_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES supplier_invoices(id) ON DELETE CASCADE;
alter table "supplier_payments" drop constraint if exists "supplier_payments_paid_by_fkey";
alter table "supplier_payments" add constraint "supplier_payments_paid_by_fkey" FOREIGN KEY (paid_by) REFERENCES profiles(id);
alter table "suppliers" drop constraint if exists "suppliers_company_id_fkey";
alter table "suppliers" add constraint "suppliers_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table "usd_rates" drop constraint if exists "usd_rates_company_id_fkey";
alter table "usd_rates" add constraint "usd_rates_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table "usd_rates" drop constraint if exists "usd_rates_created_by_fkey";
alter table "usd_rates" add constraint "usd_rates_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table "warehouse_items" drop constraint if exists "warehouse_items_operation_id_fkey";
alter table "warehouse_items" add constraint "warehouse_items_operation_id_fkey" FOREIGN KEY (operation_id) REFERENCES warehouse_operations(id) ON DELETE CASCADE;
alter table "warehouse_items" drop constraint if exists "warehouse_items_product_id_fkey";
alter table "warehouse_items" add constraint "warehouse_items_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id);
alter table "warehouse_operations" drop constraint if exists "warehouse_operations_applied_by_fkey";
alter table "warehouse_operations" add constraint "warehouse_operations_applied_by_fkey" FOREIGN KEY (applied_by) REFERENCES profiles(id);
alter table "warehouse_operations" drop constraint if exists "warehouse_operations_company_id_fkey";
alter table "warehouse_operations" add constraint "warehouse_operations_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table "warehouse_operations" drop constraint if exists "warehouse_operations_created_by_fkey";
alter table "warehouse_operations" add constraint "warehouse_operations_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id);
alter table "warehouse_operations" drop constraint if exists "warehouse_operations_from_store_id_fkey";
alter table "warehouse_operations" add constraint "warehouse_operations_from_store_id_fkey" FOREIGN KEY (from_store_id) REFERENCES stores(id);
alter table "warehouse_operations" drop constraint if exists "warehouse_operations_to_store_id_fkey";
alter table "warehouse_operations" add constraint "warehouse_operations_to_store_id_fkey" FOREIGN KEY (to_store_id) REFERENCES stores(id);

-- ══════════════════════════════════════════════════════════════
-- INDEKSLAR (50 ta)
-- ══════════════════════════════════════════════════════════════

CREATE INDEX audit_log_company_id_at_idx ON public.audit_log USING btree (company_id, at DESC);
CREATE INDEX audit_log_table_name_row_id_idx ON public.audit_log USING btree (table_name, row_id);
CREATE INDEX billz_sync_log_entity_idx ON public.billz_sync_log USING btree (company_id, entity, started_at DESC);
CREATE INDEX cash_operations_company_id_created_at_idx ON public.cash_operations USING btree (company_id, created_at DESC);
CREATE UNIQUE INDEX categories_billz_uniq ON public.categories USING btree (company_id, billz_id);
CREATE UNIQUE INDEX customers_billz_uniq ON public.customers USING btree (company_id, billz_id);
CREATE INDEX customers_company_id_idx ON public.customers USING btree (company_id);
CREATE INDEX customers_company_id_phone_idx ON public.customers USING btree (company_id, phone);
CREATE INDEX customers_last_purchase_idx ON public.customers USING btree (company_id, last_purchase_at DESC NULLS LAST);
CREATE INDEX customers_name_trgm ON public.customers USING gin (name gin_trgm_ops);
CREATE INDEX customers_phone_idx ON public.customers USING btree (company_id, phone);
CREATE INDEX dataset_chunks_ds_idx ON public.dataset_chunks USING btree (dataset_id, seq);
CREATE INDEX datasets_report_idx ON public.datasets USING btree (report_id, created_at DESC);
CREATE UNIQUE INDEX debt_payments_billz_uniq ON public.debt_payments USING btree (debt_id, billz_key);
CREATE INDEX debt_payments_debt_id_idx ON public.debt_payments USING btree (debt_id);
CREATE UNIQUE INDEX debts_billz_uniq ON public.debts USING btree (company_id, billz_id);
CREATE INDEX debts_company_id_closed_at_idx ON public.debts USING btree (company_id, closed_at);
CREATE INDEX debts_customer_id_issued_at_idx ON public.debts USING btree (customer_id, issued_at);
CREATE INDEX debts_source_idx ON public.debts USING btree (company_id, source);
CREATE INDEX debts_status_idx ON public.debts USING btree (company_id, status);
CREATE INDEX expenses_company_id_spent_on_idx ON public.expenses USING btree (company_id, spent_on);
CREATE INDEX expenses_kassa_idx ON public.expenses USING btree (kassa);
CREATE INDEX expenses_staff_idx ON public.expenses USING btree (staff_id) WHERE (staff_id IS NOT NULL);
CREATE UNIQUE INDEX kassa_ops_close_once ON public.kassa_ops USING btree (company_id, kassa, wallet, op_date) WHERE ((kind = 'transfer'::text) AND (category = 'close'::text) AND (status <> 'rejected'::text));
CREATE INDEX kassa_ops_date_idx ON public.kassa_ops USING btree (op_date DESC);
CREATE INDEX kassa_ops_kassa_idx ON public.kassa_ops USING btree (kassa, wallet);
CREATE INDEX kassa_ops_pending_idx ON public.kassa_ops USING btree (status) WHERE (status = 'pending'::text);
CREATE UNIQUE INDEX one_open_shift_per_store ON public.shifts USING btree (store_id) WHERE (closed_at IS NULL);
CREATE INDEX payouts_due_idx ON public.payouts USING btree (due_date);
CREATE INDEX payouts_open_idx ON public.payouts USING btree (status, due_date) WHERE (status = 'planned'::text);
CREATE INDEX products_barcode_idx ON public.products USING btree (company_id, barcode);
CREATE UNIQUE INDEX products_billz_uniq ON public.products USING btree (company_id, billz_id);
CREATE INDEX products_company_id_is_active_idx ON public.products USING btree (company_id, is_active);
CREATE INDEX products_name_trgm ON public.products USING gin (name gin_trgm_ops);
CREATE INDEX profiles_company_id_role_idx ON public.profiles USING btree (company_id, role);
CREATE UNIQUE INDEX sale_items_billz_uniq ON public.sale_items USING btree (sale_id, billz_id);
CREATE INDEX sale_items_product_id_idx ON public.sale_items USING btree (product_id);
CREATE INDEX sale_items_sale_id_idx ON public.sale_items USING btree (sale_id);
CREATE UNIQUE INDEX sales_billz_uniq ON public.sales USING btree (company_id, billz_id);
CREATE INDEX sales_cashier_id_sold_at_idx ON public.sales USING btree (cashier_id, sold_at DESC);
CREATE INDEX sales_company_id_sold_at_idx ON public.sales USING btree (company_id, sold_at DESC);
CREATE INDEX sales_customer_id_idx ON public.sales USING btree (customer_id) WHERE (customer_id IS NOT NULL);
CREATE UNIQUE INDEX sales_no_unique ON public.sales USING btree (company_id, no) WHERE (NOT imported);
CREATE INDEX sales_store_id_sold_at_idx ON public.sales USING btree (store_id, sold_at DESC);
CREATE INDEX service_orders_installer_id_status_idx ON public.service_orders USING btree (installer_id, status);
CREATE INDEX stock_store_id_idx ON public.stock USING btree (store_id);
CREATE INDEX stores_company_id_idx ON public.stores USING btree (company_id);
CREATE UNIQUE INDEX suppliers_billz_uniq ON public.suppliers USING btree (company_id, billz_id);
CREATE INDEX usd_rates_at_idx ON public.usd_rates USING btree (created_at DESC);
CREATE INDEX warehouse_items_operation_id_idx ON public.warehouse_items USING btree (operation_id);

-- ══════════════════════════════════════════════════════════════
-- KO'RINISHLAR (6 ta)
-- ══════════════════════════════════════════════════════════════

create or replace view "products_public" with (security_invoker=true) as
 SELECT id,
    company_id,
    name,
    sku,
    barcode,
    category_id,
    brand,
    sale_price,
    is_service,
    is_active
   FROM products;

create or replace view "staff_directory" with (security_invoker=false) as
 SELECT id,
    company_id,
    full_name,
    phone,
    role,
    store_id,
    is_active,
    perms,
    created_at,
        CASE
            WHEN auth_role() = 'owner'::user_role THEN fixed_salary
            ELSE NULL::numeric
        END AS fixed_salary,
        CASE
            WHEN auth_role() = 'owner'::user_role THEN sales_pct
            ELSE NULL::numeric
        END AS sales_pct,
        CASE
            WHEN auth_role() = 'owner'::user_role THEN service_pct
            ELSE NULL::numeric
        END AS service_pct
   FROM profiles p
  WHERE company_id = auth_company_id();

create or replace view "v_billz_unlinked" as
 SELECT 'products'::text AS entity,
    count(*) AS n
   FROM products
  WHERE products.billz_id IS NULL
UNION ALL
 SELECT 'customers'::text AS entity,
    count(*) AS n
   FROM customers
  WHERE customers.billz_id IS NULL
UNION ALL
 SELECT 'sales'::text AS entity,
    count(*) AS n
   FROM sales
  WHERE sales.billz_id IS NULL AND sales.imported
UNION ALL
 SELECT 'sales_no_items'::text AS entity,
    count(*) AS n
   FROM sales s
  WHERE NOT (EXISTS ( SELECT 1
           FROM sale_items i
          WHERE i.sale_id = s.id));

create or replace view "v_daily_sales" with (security_invoker=true) as
 SELECT company_id,
    store_id,
    date_trunc('day'::text, sold_at)::date AS day,
    sum(total) AS revenue,
    sum(discount) AS discount,
    sum(cash + card + payme) AS collected,
    sum(debt) AS on_credit,
    count(*) FILTER (WHERE type = 'sale'::sale_type) AS sale_count,
    count(*) FILTER (WHERE type = 'return'::sale_type) AS return_count
   FROM sales s
  GROUP BY company_id, store_id, (date_trunc('day'::text, sold_at)::date);

create or replace view "v_open_debts" with (security_invoker=true) as
 SELECT d.company_id,
    d.customer_id,
    d.id AS debt_id,
    d.amount,
    d.issued_at,
    d.due_date,
    COALESCE(sum(pm.amount), 0::numeric) AS paid,
    d.amount - COALESCE(sum(pm.amount), 0::numeric) AS remaining,
    CURRENT_DATE - d.due_date AS overdue_days
   FROM debts d
     LEFT JOIN debt_payments pm ON pm.debt_id = d.id
  WHERE d.closed_at IS NULL
  GROUP BY d.id
 HAVING (d.amount - COALESCE(sum(pm.amount), 0::numeric)) > 0.01;

create or replace view "v_product_margin" with (security_invoker=true) as
 SELECT p.company_id,
    p.id AS product_id,
    p.name,
    sum(i.total) AS revenue,
    sum(i.qty * i.cost_price) AS cogs,
    sum(i.total - i.qty * i.cost_price) AS profit,
    sum(i.qty) AS qty
   FROM sale_items i
     JOIN sales s ON s.id = i.sale_id AND s.type = 'sale'::sale_type
     JOIN products p ON p.id = i.product_id
  GROUP BY p.company_id, p.id, p.name;


-- ══════════════════════════════════════════════════════════════
-- TETIKLAR (5 ta)
-- ══════════════════════════════════════════════════════════════

drop trigger if exists "audit_debts" on "debts";
CREATE TRIGGER audit_debts AFTER INSERT OR DELETE OR UPDATE ON public.debts FOR EACH ROW EXECUTE FUNCTION audit_trigger();
drop trigger if exists "audit_expenses" on "expenses";
CREATE TRIGGER audit_expenses AFTER INSERT OR DELETE OR UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION audit_trigger();
drop trigger if exists "audit_products" on "products";
CREATE TRIGGER audit_products AFTER INSERT OR DELETE OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION audit_trigger();
drop trigger if exists "audit_profiles" on "profiles";
CREATE TRIGGER audit_profiles AFTER INSERT OR DELETE OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION audit_trigger();
drop trigger if exists "audit_sales" on "sales";
CREATE TRIGGER audit_sales AFTER INSERT OR DELETE OR UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ══════════════════════════════════════════════════════════════
-- RLS — QATOR DARAJASIDAGI HIMOYA (39 jadval, 56 siyosat)
-- ══════════════════════════════════════════════════════════════

-- Siyosatlar `auth.uid()` / `auth.role()` ga murojaat qiladi.
-- VPS'da ular 00-shim.sql dagi funksiyalar bo'ladi — ya'ni siyosatlar
-- BIR HARF ham o'zgarmaydi. Himoya mantiqini qayta yozish eng katta
-- xavf edi (56 ta siyosat), shu yo'l bilan chetlab o'tildi.

alter table "audit_log" enable row level security;
alter table "billz_sync_log" enable row level security;
alter table "cash_operations" enable row level security;
alter table "categories" enable row level security;
alter table "companies" enable row level security;
alter table "customers" enable row level security;
alter table "dataset_chunks" enable row level security;
alter table "datasets" enable row level security;
alter table "debt_payments" enable row level security;
alter table "debts" enable row level security;
alter table "doc_counters" enable row level security;
alter table "expenses" enable row level security;
alter table "invites" enable row level security;
alter table "kassa_ops" enable row level security;
alter table "kpi_assign" enable row level security;
alter table "kpi_day" enable row level security;
alter table "kpi_plan" enable row level security;
alter table "nps_records" enable row level security;
alter table "payouts" enable row level security;
alter table "payroll_payments" enable row level security;
alter table "products" enable row level security;
alter table "profiles" enable row level security;
alter table "sale_items" enable row level security;
alter table "sales" enable row level security;
alter table "service_items" enable row level security;
alter table "service_orders" enable row level security;
alter table "shifts" enable row level security;
alter table "shipment_costs" enable row level security;
alter table "shipment_items" enable row level security;
alter table "shipments" enable row level security;
alter table "stock" enable row level security;
alter table "store_plans" enable row level security;
alter table "stores" enable row level security;
alter table "supplier_invoices" enable row level security;
alter table "supplier_payments" enable row level security;
alter table "suppliers" enable row level security;
alter table "usd_rates" enable row level security;
alter table "warehouse_items" enable row level security;
alter table "warehouse_operations" enable row level security;

drop policy if exists "audit_owner" on "audit_log";
create policy "audit_owner" on "audit_log"
  for select
  to public
  using (((company_id = auth_company_id()) AND (auth_role() = 'owner'::user_role)));

drop policy if exists "billz_sync_log_read" on "billz_sync_log";
create policy "billz_sync_log_read" on "billz_sync_log"
  for select
  to public
  using ((is_manager() AND (company_id = auth_company_id())));

drop policy if exists "cash_rw" on "cash_operations";
create policy "cash_rw" on "cash_operations"
  for all
  to public
  using (((company_id = auth_company_id()) AND can_see_store(store_id)))
  with check (((company_id = auth_company_id()) AND can_see_store(store_id)));

drop policy if exists "company_read" on "categories";
create policy "company_read" on "categories"
  for select
  to public
  using ((company_id = auth_company_id()));

drop policy if exists "company_self" on "companies";
create policy "company_self" on "companies"
  for select
  to public
  using ((id = auth_company_id()));

drop policy if exists "company_update" on "companies";
create policy "company_update" on "companies"
  for update
  to public
  using (((id = auth_company_id()) AND (auth_role() = 'owner'::user_role)))
  with check (((id = auth_company_id()) AND (auth_role() = 'owner'::user_role)));

drop policy if exists "company_read" on "customers";
create policy "company_read" on "customers"
  for select
  to public
  using ((company_id = auth_company_id()));

drop policy if exists "dataset_chunks_rw" on "dataset_chunks";
create policy "dataset_chunks_rw" on "dataset_chunks"
  for all
  to public
  using ((EXISTS ( SELECT 1
   FROM datasets d
  WHERE (d.id = dataset_chunks.dataset_id))))
  with check ((EXISTS ( SELECT 1
   FROM datasets d
  WHERE (d.id = dataset_chunks.dataset_id))));

drop policy if exists "datasets_rw" on "datasets";
create policy "datasets_rw" on "datasets"
  for all
  to public
  using ((is_manager() AND (company_id = auth_company_id())))
  with check ((is_manager() AND (company_id = auth_company_id())));

drop policy if exists "debt_pay" on "debt_payments";
create policy "debt_pay" on "debt_payments"
  for insert
  to public
  with check ((EXISTS ( SELECT 1
   FROM debts d
  WHERE ((d.id = debt_payments.debt_id) AND (d.company_id = auth_company_id())))));

drop policy if exists "debt_payment_read" on "debt_payments";
create policy "debt_payment_read" on "debt_payments"
  for select
  to public
  using ((EXISTS ( SELECT 1
   FROM debts d
  WHERE ((d.id = debt_payments.debt_id) AND (d.company_id = auth_company_id())))));

drop policy if exists "debt_read" on "debts";
create policy "debt_read" on "debts"
  for select
  to public
  using ((company_id = auth_company_id()));

drop policy if exists "expense_delete" on "expenses";
create policy "expense_delete" on "expenses"
  for delete
  to public
  using (((company_id = auth_company_id()) AND (is_owner() OR (is_manager() AND (kassa = (auth_store_id())::text) AND (spent_on = ((now() AT TIME ZONE 'Asia/Tashkent'::text))::date)))));

drop policy if exists "expense_insert" on "expenses";
create policy "expense_insert" on "expenses"
  for insert
  to public
  with check (((company_id = auth_company_id()) AND (is_owner() OR (is_manager() AND (kassa = (auth_store_id())::text)))));

drop policy if exists "expense_read" on "expenses";
create policy "expense_read" on "expenses"
  for select
  to public
  using (((company_id = auth_company_id()) AND (is_owner() OR (is_manager() AND (kassa = (auth_store_id())::text)))));

drop policy if exists "expense_update" on "expenses";
create policy "expense_update" on "expenses"
  for update
  to public
  using (((company_id = auth_company_id()) AND (is_owner() OR (is_manager() AND (kassa = (auth_store_id())::text) AND (spent_on = ((now() AT TIME ZONE 'Asia/Tashkent'::text))::date)))))
  with check (((company_id = auth_company_id()) AND (is_owner() OR (is_manager() AND (kassa = (auth_store_id())::text) AND (spent_on = ((now() AT TIME ZONE 'Asia/Tashkent'::text))::date)))));

drop policy if exists "invites_rw" on "invites";
create policy "invites_rw" on "invites"
  for all
  to public
  using ((is_owner() AND (company_id = auth_company_id())))
  with check ((is_owner() AND (company_id = auth_company_id())));

drop policy if exists "kassa_ops_delete" on "kassa_ops";
create policy "kassa_ops_delete" on "kassa_ops"
  for delete
  to public
  using (((company_id = auth_company_id()) AND (is_owner() OR (is_manager() AND (kassa <> 'company'::text))) AND (COALESCE(status, 'x'::text) <> 'approved'::text)));

drop policy if exists "kassa_ops_insert" on "kassa_ops";
create policy "kassa_ops_insert" on "kassa_ops"
  for insert
  to public
  with check (((company_id = auth_company_id()) AND (is_owner() OR (is_manager() AND (kassa <> 'company'::text)))));

drop policy if exists "kassa_ops_read" on "kassa_ops";
create policy "kassa_ops_read" on "kassa_ops"
  for select
  to public
  using ((is_manager() AND (company_id = auth_company_id())));

drop policy if exists "kassa_ops_update" on "kassa_ops";
create policy "kassa_ops_update" on "kassa_ops"
  for update
  to public
  using (((company_id = auth_company_id()) AND (is_owner() OR (is_manager() AND (kassa <> 'company'::text) AND (COALESCE(status, 'x'::text) <> 'approved'::text)))))
  with check (((company_id = auth_company_id()) AND (is_owner() OR (is_manager() AND (kassa <> 'company'::text) AND (COALESCE(status, 'x'::text) <> 'approved'::text)))));

drop policy if exists "kpi_assign_rw" on "kpi_assign";
create policy "kpi_assign_rw" on "kpi_assign"
  for all
  to public
  using (((staff_company_id(staff_id) = auth_company_id()) AND (is_manager() OR (staff_id = auth.uid()))))
  with check (((staff_company_id(staff_id) = auth_company_id()) AND (is_manager() OR (staff_id = auth.uid()))));

drop policy if exists "kpi_day_rw" on "kpi_day";
create policy "kpi_day_rw" on "kpi_day"
  for all
  to public
  using (((staff_company_id(staff_id) = auth_company_id()) AND (is_manager() OR (staff_id = auth.uid()))))
  with check (((staff_company_id(staff_id) = auth_company_id()) AND (is_manager() OR (staff_id = auth.uid()))));

drop policy if exists "kpi_plan_rw" on "kpi_plan";
create policy "kpi_plan_rw" on "kpi_plan"
  for all
  to public
  using (((staff_company_id(staff_id) = auth_company_id()) AND (is_manager() OR (staff_id = auth.uid()))))
  with check (((staff_company_id(staff_id) = auth_company_id()) AND (is_manager() OR (staff_id = auth.uid()))));

drop policy if exists "nps_records_read" on "nps_records";
create policy "nps_records_read" on "nps_records"
  for select
  to public
  using (((company_id = auth_company_id()) AND (is_manager() OR (installer_id = auth.uid()))));

drop policy if exists "nps_records_write" on "nps_records";
create policy "nps_records_write" on "nps_records"
  for all
  to public
  using ((is_manager() AND (company_id = auth_company_id())))
  with check ((is_manager() AND (company_id = auth_company_id())));

drop policy if exists "payouts_rw" on "payouts";
create policy "payouts_rw" on "payouts"
  for all
  to public
  using ((is_owner() AND (company_id = auth_company_id())))
  with check ((is_owner() AND (company_id = auth_company_id())));

drop policy if exists "payroll_owner" on "payroll_payments";
create policy "payroll_owner" on "payroll_payments"
  for all
  to public
  using (((company_id = auth_company_id()) AND (auth_role() = 'owner'::user_role)))
  with check (((company_id = auth_company_id()) AND (auth_role() = 'owner'::user_role)));

drop policy if exists "company_read" on "products";
create policy "company_read" on "products"
  for select
  to public
  using ((company_id = auth_company_id()));

drop policy if exists "product_update" on "products";
create policy "product_update" on "products"
  for update
  to public
  using (((company_id = auth_company_id()) AND (auth_role() = ANY (ARRAY['owner'::user_role, 'manager'::user_role]))));

drop policy if exists "product_write" on "products";
create policy "product_write" on "products"
  for insert
  to public
  with check (((company_id = auth_company_id()) AND (auth_role() = ANY (ARRAY['owner'::user_role, 'manager'::user_role]))));

drop policy if exists "profile_admin" on "profiles";
create policy "profile_admin" on "profiles"
  for all
  to public
  using (((company_id = auth_company_id()) AND (auth_role() = 'owner'::user_role)))
  with check (((company_id = auth_company_id()) AND (auth_role() = 'owner'::user_role)));

drop policy if exists "profile_self" on "profiles";
create policy "profile_self" on "profiles"
  for select
  to public
  using (((id = auth.uid()) OR ((auth_role() = 'owner'::user_role) AND (company_id = auth_company_id()))));

drop policy if exists "profiles_owner_update" on "profiles";
create policy "profiles_owner_update" on "profiles"
  for update
  to public
  using (((auth_role() = 'owner'::user_role) AND (company_id = auth_company_id())))
  with check (((auth_role() = 'owner'::user_role) AND (company_id = auth_company_id())));

drop policy if exists "sale_item_read" on "sale_items";
create policy "sale_item_read" on "sale_items"
  for select
  to public
  using ((EXISTS ( SELECT 1
   FROM sales s
  WHERE (s.id = sale_items.sale_id))));

drop policy if exists "sale_item_write" on "sale_items";
create policy "sale_item_write" on "sale_items"
  for insert
  to public
  with check ((EXISTS ( SELECT 1
   FROM sales s
  WHERE ((s.id = sale_items.sale_id) AND (s.company_id = auth_company_id())))));

drop policy if exists "sale_insert" on "sales";
create policy "sale_insert" on "sales"
  for insert
  to public
  with check (((company_id = auth_company_id()) AND can_see_store(store_id)));

drop policy if exists "sale_read" on "sales";
create policy "sale_read" on "sales"
  for select
  to public
  using (((company_id = auth_company_id()) AND ((auth_role() = ANY (ARRAY['owner'::user_role, 'manager'::user_role])) OR can_see_store(store_id))));

drop policy if exists "service_item_rw" on "service_items";
create policy "service_item_rw" on "service_items"
  for all
  to public
  using ((EXISTS ( SELECT 1
   FROM service_orders o
  WHERE ((o.id = service_items.order_id) AND (o.company_id = auth_company_id())))))
  with check ((EXISTS ( SELECT 1
   FROM service_orders o
  WHERE ((o.id = service_items.order_id) AND (o.company_id = auth_company_id())))));

drop policy if exists "service_read" on "service_orders";
create policy "service_read" on "service_orders"
  for select
  to public
  using (((company_id = auth_company_id()) AND ((auth_role() = ANY (ARRAY['owner'::user_role, 'manager'::user_role, 'cashier'::user_role])) OR (installer_id = auth.uid()))));

drop policy if exists "service_write" on "service_orders";
create policy "service_write" on "service_orders"
  for all
  to public
  using (((company_id = auth_company_id()) AND (auth_role() = ANY (ARRAY['owner'::user_role, 'manager'::user_role]))))
  with check (((company_id = auth_company_id()) AND (auth_role() = ANY (ARRAY['owner'::user_role, 'manager'::user_role]))));

drop policy if exists "shift_rw" on "shifts";
create policy "shift_rw" on "shifts"
  for all
  to public
  using (((company_id = auth_company_id()) AND can_see_store(store_id)))
  with check (((company_id = auth_company_id()) AND can_see_store(store_id)));

drop policy if exists "shipment_cost_rw" on "shipment_costs";
create policy "shipment_cost_rw" on "shipment_costs"
  for all
  to public
  using ((EXISTS ( SELECT 1
   FROM shipments s
  WHERE ((s.id = shipment_costs.shipment_id) AND (s.company_id = auth_company_id())))))
  with check ((EXISTS ( SELECT 1
   FROM shipments s
  WHERE ((s.id = shipment_costs.shipment_id) AND (s.company_id = auth_company_id())))));

drop policy if exists "shipment_item_rw" on "shipment_items";
create policy "shipment_item_rw" on "shipment_items"
  for all
  to public
  using ((EXISTS ( SELECT 1
   FROM shipments s
  WHERE ((s.id = shipment_items.shipment_id) AND (s.company_id = auth_company_id())))))
  with check ((EXISTS ( SELECT 1
   FROM shipments s
  WHERE ((s.id = shipment_items.shipment_id) AND (s.company_id = auth_company_id())))));

drop policy if exists "shipment_rw" on "shipments";
create policy "shipment_rw" on "shipments"
  for all
  to public
  using (((company_id = auth_company_id()) AND (auth_role() = ANY (ARRAY['owner'::user_role, 'manager'::user_role]))))
  with check (((company_id = auth_company_id()) AND (auth_role() = ANY (ARRAY['owner'::user_role, 'manager'::user_role]))));

drop policy if exists "stock_read" on "stock";
create policy "stock_read" on "stock"
  for select
  to public
  using ((EXISTS ( SELECT 1
   FROM products p
  WHERE ((p.id = stock.product_id) AND (p.company_id = auth_company_id())))));

drop policy if exists "plan_owner" on "store_plans";
create policy "plan_owner" on "store_plans"
  for all
  to public
  using (((auth_role() = 'owner'::user_role) AND (EXISTS ( SELECT 1
   FROM stores s
  WHERE ((s.id = store_plans.store_id) AND (s.company_id = auth_company_id()))))))
  with check (((auth_role() = 'owner'::user_role) AND (EXISTS ( SELECT 1
   FROM stores s
  WHERE ((s.id = store_plans.store_id) AND (s.company_id = auth_company_id()))))));

drop policy if exists "company_read" on "stores";
create policy "company_read" on "stores"
  for select
  to public
  using ((company_id = auth_company_id()));

drop policy if exists "invoice_rw" on "supplier_invoices";
create policy "invoice_rw" on "supplier_invoices"
  for all
  to public
  using (((company_id = auth_company_id()) AND (auth_role() = ANY (ARRAY['owner'::user_role, 'manager'::user_role]))))
  with check (((company_id = auth_company_id()) AND (auth_role() = ANY (ARRAY['owner'::user_role, 'manager'::user_role]))));

drop policy if exists "invoice_pay_rw" on "supplier_payments";
create policy "invoice_pay_rw" on "supplier_payments"
  for all
  to public
  using ((EXISTS ( SELECT 1
   FROM supplier_invoices i
  WHERE ((i.id = supplier_payments.invoice_id) AND (i.company_id = auth_company_id())))))
  with check ((EXISTS ( SELECT 1
   FROM supplier_invoices i
  WHERE ((i.id = supplier_payments.invoice_id) AND (i.company_id = auth_company_id())))));

drop policy if exists "company_read" on "suppliers";
create policy "company_read" on "suppliers"
  for select
  to public
  using ((company_id = auth_company_id()));

drop policy if exists "supplier_write" on "suppliers";
create policy "supplier_write" on "suppliers"
  for all
  to public
  using (((company_id = auth_company_id()) AND (auth_role() = ANY (ARRAY['owner'::user_role, 'manager'::user_role]))))
  with check (((company_id = auth_company_id()) AND (auth_role() = ANY (ARRAY['owner'::user_role, 'manager'::user_role]))));

drop policy if exists "usd_rates_insert" on "usd_rates";
create policy "usd_rates_insert" on "usd_rates"
  for insert
  to public
  with check ((is_manager() AND (company_id = auth_company_id())));

drop policy if exists "usd_rates_read" on "usd_rates";
create policy "usd_rates_read" on "usd_rates"
  for select
  to public
  using ((is_manager() AND (company_id = auth_company_id())));

drop policy if exists "warehouse_item_rw" on "warehouse_items";
create policy "warehouse_item_rw" on "warehouse_items"
  for all
  to public
  using ((EXISTS ( SELECT 1
   FROM warehouse_operations o
  WHERE ((o.id = warehouse_items.operation_id) AND (o.company_id = auth_company_id())))))
  with check ((EXISTS ( SELECT 1
   FROM warehouse_operations o
  WHERE ((o.id = warehouse_items.operation_id) AND (o.company_id = auth_company_id())))));

drop policy if exists "warehouse_rw" on "warehouse_operations";
create policy "warehouse_rw" on "warehouse_operations"
  for all
  to public
  using (((company_id = auth_company_id()) AND (auth_role() = ANY (ARRAY['owner'::user_role, 'manager'::user_role, 'storekeeper'::user_role]))))
  with check (((company_id = auth_company_id()) AND (auth_role() = ANY (ARRAY['owner'::user_role, 'manager'::user_role, 'storekeeper'::user_role]))));


-- —— Tugadi ——
