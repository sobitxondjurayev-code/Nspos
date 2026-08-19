-- ══════════════════════════════════════════════════════════════
-- NSPOS — Supabase (PostgreSQL) sxemasi
-- ══════════════════════════════════════════════════════════════
-- Bir vaqtda 5–10, keyinchalik undan ko'p xodim ishlashiga mo'ljallangan.
-- Uchta narsa arxitekturaning tayanchi:
--
--   1. RLS (Row Level Security) — har jadval o'zini himoya qiladi.
--      Brauzerdagi tekshiruvni chetlab o'tish mumkin, bunisini yo'q.
--   2. Atomik funksiyalar — qoldiq va chek raqami kabi poyga
--      (race condition) bo'ladigan joylar SQL ichida bajariladi.
--   3. Audit — kim, qachon, nimani o'zgartirgani yozib boriladi.
--
-- Ishga tushirish: Supabase SQL Editor'ga to'liq nusxalab qo'yiladi.

-- ─────────────────────────────────────────────────────────────
-- 0. Kengaytmalar
-- ─────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists pg_trgm;      -- nom bo'yicha tez qidiruv

-- ─────────────────────────────────────────────────────────────
-- 1. Tashkilot va do'konlar
-- ─────────────────────────────────────────────────────────────
-- Bitta bazada bir nechta kompaniya ishlashi mumkin (kelajakda NSPOS'ni
-- boshqa do'konlarga ham sotsangiz). Hamma jadvalda company_id bor va
-- RLS aynan shu ustunga tayanadi.
create table companies (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  currency    text not null default 'USD',
  created_at  timestamptz not null default now()
);

create table stores (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid not null references companies(id) on delete cascade,
  name        text not null,
  kind        text not null default 'shop' check (kind in ('shop', 'warehouse')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index on stores (company_id);

-- ─────────────────────────────────────────────────────────────
-- 2. Foydalanuvchilar va rollar
-- ─────────────────────────────────────────────────────────────
-- auth.users — Supabase'ning o'z jadvali (parol, email, sessiya).
-- profiles — bizning qo'shimchamiz: rol, do'kon, ish haqi shartlari.
create type user_role as enum ('owner', 'manager', 'cashier', 'storekeeper', 'installer');

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  company_id    uuid not null references companies(id) on delete cascade,
  full_name     text not null,
  phone         text,
  role          user_role not null default 'cashier',
  -- null bo'lsa barcha do'kon; aks holda faqat shu do'konni ko'radi
  store_id      uuid references stores(id) on delete set null,
  is_active     boolean not null default true,
  -- Ish haqi shartlari (Fix + Flex)
  fixed_salary  numeric(12,2) not null default 0,
  sales_pct     numeric(5,2)  not null default 0,   -- shaxsiy sotuvdan %
  service_pct   numeric(5,2)  not null default 0,   -- xizmat ulushi %
  created_at    timestamptz not null default now()
);
create index on profiles (company_id, role);

-- Joriy foydalanuvchi ma'lumotini olish — RLS siyosatlarida ishlatiladi.
-- stable + security definer: har qatorga qayta so'rov ketmasin.
create or replace function auth_company_id() returns uuid
language sql stable security definer set search_path = public as $$
  select company_id from profiles where id = auth.uid()
$$;

create or replace function auth_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function auth_store_id() returns uuid
language sql stable security definer set search_path = public as $$
  select store_id from profiles where id = auth.uid()
$$;

-- Do'kon ko'rish huquqi: store_id null bo'lgan xodim hammasini ko'radi
create or replace function can_see_store(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth_store_id() is null or auth_store_id() = target
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. Katalog
-- ─────────────────────────────────────────────────────────────
create table categories (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid not null references companies(id) on delete cascade,
  name        text not null,
  unique (company_id, name)
);

create table products (
  id           uuid primary key default uuid_generate_v4(),
  company_id   uuid not null references companies(id) on delete cascade,
  name         text not null,
  sku          text,
  barcode      text,
  category_id  uuid references categories(id) on delete set null,
  brand        text,
  supplier     text,
  -- Narxlar. cost_price faqat egasi ko'radi (RLS emas, ustun darajasida
  -- ruxsat: pastdagi "column privileges" bo'limiga qarang).
  sale_price   numeric(12,2) not null default 0,
  cost_price   numeric(12,2) not null default 0,
  is_service   boolean not null default false,  -- montaj kabi: qoldiq yuritilmaydi
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (company_id, barcode)
);
create index on products (company_id, is_active);
create index products_name_trgm on products using gin (name gin_trgm_ops);

-- Qoldiq alohida jadvalda: do'kon × tovar.
-- Bitta qator = bitta hujayra, shuning uchun ikki kassir bir vaqtda
-- turli tovar sotsa bir-birini kutmaydi.
create table stock (
  product_id  uuid not null references products(id) on delete cascade,
  store_id    uuid not null references stores(id) on delete cascade,
  qty         numeric(12,3) not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (product_id, store_id)
);
create index on stock (store_id);

-- ─────────────────────────────────────────────────────────────
-- 4. Mijozlar
-- ─────────────────────────────────────────────────────────────
create table customers (
  id            uuid primary key default uuid_generate_v4(),
  company_id    uuid not null references companies(id) on delete cascade,
  name          text not null,
  phone         text,
  store_id      uuid references stores(id) on delete set null,  -- ro'yxatdan o'tgan joyi
  balance       numeric(12,2) not null default 0,   -- oldindan to'lov
  cashback      numeric(12,2) not null default 0,
  note          text,
  created_at    timestamptz not null default now()
);
create index on customers (company_id);
create index customers_name_trgm on customers using gin (name gin_trgm_ops);
create index on customers (company_id, phone);

-- ─────────────────────────────────────────────────────────────
-- 5. Smenalar
-- ─────────────────────────────────────────────────────────────
create table shifts (
  id            uuid primary key default uuid_generate_v4(),
  company_id    uuid not null references companies(id) on delete cascade,
  store_id      uuid not null references stores(id),
  cashier_id    uuid not null references profiles(id),
  opened_at     timestamptz not null default now(),
  closed_at     timestamptz,
  opening_cash  numeric(12,2) not null default 0,
  counted_cash  numeric(12,2),
  note          text
);
-- Bitta do'konda bir vaqtda faqat bitta ochiq smena bo'lishi mumkin
create unique index one_open_shift_per_store
  on shifts (store_id) where closed_at is null;

-- ─────────────────────────────────────────────────────────────
-- 6. Sotuvlar
-- ─────────────────────────────────────────────────────────────
create type sale_type as enum ('sale', 'return', 'exchange');

create table sales (
  id            uuid primary key default uuid_generate_v4(),
  company_id    uuid not null references companies(id) on delete cascade,
  store_id      uuid not null references stores(id),
  shift_id      uuid references shifts(id),
  no            text not null,                    -- chek raqami
  type          sale_type not null default 'sale',
  original_id   uuid references sales(id),        -- qaytarish uchun asl chek
  customer_id   uuid references customers(id) on delete set null,
  cashier_id    uuid references profiles(id),
  sold_at       timestamptz not null default now(),
  subtotal      numeric(12,2) not null default 0,
  discount      numeric(12,2) not null default 0,
  total         numeric(12,2) not null default 0,
  -- To'lov taqsimoti
  cash          numeric(12,2) not null default 0,
  card          numeric(12,2) not null default 0,
  payme         numeric(12,2) not null default 0,
  from_balance  numeric(12,2) not null default 0,
  debt          numeric(12,2) not null default 0,
  -- Billz'dan yuklangan tarixiy chek: qoldiqqa ta'sir qilmaydi
  imported      boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Chek raqami NSPOS yozgan cheklar orasida takrorlanmaydi.
-- Billz'dan yuklanganlarda esa takrorlanadi va bu TO'G'RI: Billz
-- qaytarish chekiga asl chekning raqamini beradi (840 ta juftlik).
-- Shuning uchun cheklov faqat imported = false qatorlarga qo'llanadi.
create unique index sales_no_unique on sales (company_id, no) where not imported;
create index on sales (company_id, sold_at desc);
create index on sales (store_id, sold_at desc);
create index on sales (customer_id) where customer_id is not null;
create index on sales (cashier_id, sold_at desc);

create table sale_items (
  id          uuid primary key default uuid_generate_v4(),
  sale_id     uuid not null references sales(id) on delete cascade,
  product_id  uuid not null references products(id),
  name        text not null,        -- o'sha paytdagi nom (keyin o'zgarsa ham chek o'zgarmasin)
  qty         numeric(12,3) not null,
  price       numeric(12,2) not null,
  cost_price  numeric(12,2) not null default 0,   -- sotilgan paytdagi tannarx
  total       numeric(12,2) not null
);
create index on sale_items (sale_id);
create index on sale_items (product_id);

-- ─────────────────────────────────────────────────────────────
-- 7. Qarzdorlik (hodisalar ko'rinishida)
-- ─────────────────────────────────────────────────────────────
-- Qarz "balans" emas, HODISA sifatida saqlanadi: berilgani va har
-- to'lovi alohida yozuv. Faqat shunda "o'rtacha necha kunda qaytadi"
-- ni hisoblab bo'ladi.
create table debts (
  id           uuid primary key default uuid_generate_v4(),
  company_id   uuid not null references companies(id) on delete cascade,
  customer_id  uuid not null references customers(id) on delete cascade,
  sale_id      uuid references sales(id) on delete set null,
  store_id     uuid references stores(id),
  amount       numeric(12,2) not null,
  issued_at    timestamptz not null default now(),
  due_date     date,
  closed_at    timestamptz
);
create index on debts (company_id, closed_at);
create index on debts (customer_id, issued_at);

create table debt_payments (
  id          uuid primary key default uuid_generate_v4(),
  debt_id     uuid not null references debts(id) on delete cascade,
  amount      numeric(12,2) not null,
  paid_at     timestamptz not null default now(),
  method      text not null default 'cash',
  -- 'payment' — pul keldi; 'return' — tovar qaytdi, qarz kamaydi
  kind        text not null default 'payment' check (kind in ('payment', 'return')),
  received_by uuid references profiles(id)
);
create index on debt_payments (debt_id);

-- ─────────────────────────────────────────────────────────────
-- 8. Ombor operatsiyalari
-- ─────────────────────────────────────────────────────────────
create type warehouse_op as enum ('receipt', 'transfer', 'writeoff', 'inventory');

create table warehouse_operations (
  id            uuid primary key default uuid_generate_v4(),
  company_id    uuid not null references companies(id) on delete cascade,
  no            text not null,
  type          warehouse_op not null,
  from_store_id uuid references stores(id),
  to_store_id   uuid references stores(id),
  status        text not null default 'draft' check (status in ('draft', 'applied', 'cancelled')),
  reason        text,
  created_by    uuid references profiles(id),
  applied_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  applied_at    timestamptz,
  unique (company_id, no)
);

create table warehouse_items (
  id            uuid primary key default uuid_generate_v4(),
  operation_id  uuid not null references warehouse_operations(id) on delete cascade,
  product_id    uuid not null references products(id),
  qty           numeric(12,3) not null,
  counted_qty   numeric(12,3),        -- inventarizatsiyada sanalgani
  unit_cost     numeric(12,2) not null default 0
);
create index on warehouse_items (operation_id);

-- ─────────────────────────────────────────────────────────────
-- 9. Import partiyalari va tannarx
-- ─────────────────────────────────────────────────────────────
create table shipments (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid not null references companies(id) on delete cascade,
  no          text not null,
  supplier    text,
  store_id    uuid references stores(id),
  shipped_at  date not null,
  status      text not null default 'draft' check (status in ('draft', 'applied')),
  created_at  timestamptz not null default now(),
  unique (company_id, no)
);

create table shipment_items (
  id           uuid primary key default uuid_generate_v4(),
  shipment_id  uuid not null references shipments(id) on delete cascade,
  product_id   uuid not null references products(id),
  qty          numeric(12,3) not null,
  unit_price   numeric(12,2) not null
);

-- Bojxona, yetkazish, broker — tovarlarga qiymati bo'yicha taqsimlanadi
create table shipment_costs (
  id           uuid primary key default uuid_generate_v4(),
  shipment_id  uuid not null references shipments(id) on delete cascade,
  type         text not null,
  amount       numeric(12,2) not null,
  note         text
);

-- ─────────────────────────────────────────────────────────────
-- 10. Xizmatlar (o'rnatish)
-- ─────────────────────────────────────────────────────────────
create table service_orders (
  id            uuid primary key default uuid_generate_v4(),
  company_id    uuid not null references companies(id) on delete cascade,
  no            text not null,
  customer_id   uuid references customers(id) on delete set null,
  store_id      uuid references stores(id),
  installer_id  uuid references profiles(id),
  status        text not null default 'yangi'
                check (status in ('yangi', 'jarayonda', 'bajarildi', 'bekor')),
  address       text,
  note          text,
  scheduled_at  timestamptz,
  finished_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (company_id, no)
);
create index on service_orders (installer_id, status);

create table service_items (
  id          uuid primary key default uuid_generate_v4(),
  order_id    uuid not null references service_orders(id) on delete cascade,
  kind        text not null check (kind in ('work', 'material')),
  product_id  uuid references products(id),
  name        text not null,
  qty         numeric(12,3) not null default 1,
  price       numeric(12,2) not null default 0,
  cost        numeric(12,2) not null default 0
);

-- ─────────────────────────────────────────────────────────────
-- 11. Moliya
-- ─────────────────────────────────────────────────────────────
create table cash_operations (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid not null references companies(id) on delete cascade,
  store_id    uuid references stores(id),
  shift_id    uuid references shifts(id),
  direction   text not null check (direction in ('in', 'out')),
  category    text not null,
  amount      numeric(12,2) not null,
  method      text not null default 'cash',
  note        text,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now()
);
create index on cash_operations (company_id, created_at desc);

-- Xarajatlar. Takrorlanuvchisi shu jadvalda shablon sifatida turadi
-- (is_recurring = true) va hisobotda har oyga yoyiladi.
create table expenses (
  id            uuid primary key default uuid_generate_v4(),
  company_id    uuid not null references companies(id) on delete cascade,
  store_id      uuid references stores(id),   -- null = umumkorxona
  category      text not null,
  amount        numeric(12,2) not null,
  method        text not null default 'cash',
  note          text,
  -- Bir martalik
  spent_on      date,
  -- Takrorlanuvchi
  is_recurring  boolean not null default false,
  day_of_month  smallint check (day_of_month between 1 and 28),
  active_from   date,
  active_to     date,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  constraint expense_kind check (
    (is_recurring and day_of_month is not null and active_from is not null)
    or (not is_recurring and spent_on is not null)
  )
);
create index on expenses (company_id, spent_on);

create table suppliers (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid not null references companies(id) on delete cascade,
  name        text not null,
  phone       text,
  note        text
);

create table supplier_invoices (
  id           uuid primary key default uuid_generate_v4(),
  company_id   uuid not null references companies(id) on delete cascade,
  supplier_id  uuid not null references suppliers(id) on delete cascade,
  shipment_id  uuid references shipments(id) on delete set null,
  amount       numeric(12,2) not null,
  invoice_date date not null,
  due_date     date,
  note         text
);

create table supplier_payments (
  id          uuid primary key default uuid_generate_v4(),
  invoice_id  uuid not null references supplier_invoices(id) on delete cascade,
  amount      numeric(12,2) not null,
  paid_at     timestamptz not null default now(),
  method      text not null default 'cash',
  paid_by     uuid references profiles(id)
);

create table payroll_payments (
  id           uuid primary key default uuid_generate_v4(),
  company_id   uuid not null references companies(id) on delete cascade,
  staff_id     uuid not null references profiles(id),
  amount       numeric(12,2) not null,
  period_from  date not null,
  period_to    date not null,
  method       text not null default 'cash',
  note         text,
  paid_at      timestamptz not null default now(),
  paid_by      uuid references profiles(id)
);

create table store_plans (
  store_id    uuid primary key references stores(id) on delete cascade,
  monthly     numeric(12,2) not null default 0,
  updated_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- 12. Audit jurnali
-- ─────────────────────────────────────────────────────────────
-- 10 kishi ishlaganda "buni kim o'chirdi?" degan savol muqarrar.
create table audit_log (
  id          bigserial primary key,
  company_id  uuid not null,
  actor_id    uuid,
  table_name  text not null,
  row_id      uuid,
  action      text not null check (action in ('insert', 'update', 'delete')),
  before      jsonb,
  after       jsonb,
  at          timestamptz not null default now()
);
create index on audit_log (company_id, at desc);
create index on audit_log (table_name, row_id);

create or replace function audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
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
end $$;

-- Eng muhim jadvallarga o'rnatamiz (hammasiga emas — jurnal shishmasin)
create trigger audit_products    after insert or update or delete on products
  for each row execute function audit_trigger();
create trigger audit_sales       after insert or update or delete on sales
  for each row execute function audit_trigger();
create trigger audit_expenses    after insert or update or delete on expenses
  for each row execute function audit_trigger();
create trigger audit_debts       after insert or update or delete on debts
  for each row execute function audit_trigger();
create trigger audit_profiles    after insert or update or delete on profiles
  for each row execute function audit_trigger();

-- ─────────────────────────────────────────────────────────────
-- 13. Atomik amallar
-- ─────────────────────────────────────────────────────────────
-- POYGA MUAMMOSI: ikki kassir bir vaqtda oxirgi 1 dona tovarni sotsa,
-- ikkalasi ham "qoldiq bor" deb ko'radi va minus qoldiq chiqadi.
-- Yechim: qoldiqni tekshirish va kamaytirish BITTA SQL amalida.
create or replace function apply_stock(
  p_product uuid, p_store uuid, p_delta numeric, p_allow_negative boolean default false
) returns numeric
language plpgsql security definer set search_path = public as $$
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
end $$;

-- Chek raqami: ketma-ket va takrorlanmas bo'lishi shart.
-- Sanoq alohida jadvalda, shuning uchun ikki kassir bir raqam ololmaydi.
create table doc_counters (
  company_id  uuid not null references companies(id) on delete cascade,
  store_id    uuid not null references stores(id) on delete cascade,
  kind        text not null,                -- 'sale' | 'return' | 'warehouse' ...
  next_no     bigint not null default 1,
  primary key (company_id, store_id, kind)
);

-- Sanoqqa brauzerdan umuman tegib bo'lmaydi: siyosat berilmagan, ya'ni
-- klient uchun jadval yopiq. next_doc_no() esa security definer bo'lgani
-- uchun ishlayveradi — chek raqami faqat tizim ichida beriladi.
alter table doc_counters enable row level security;

create or replace function next_doc_no(p_store uuid, p_kind text)
returns text language plpgsql security definer set search_path = public as $$
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
end $$;

-- Sotuvni bitta tranzaksiyada yozish: chek + qatorlar + qoldiq + qarz.
-- Biror qadam xato bersa hammasi bekor bo'ladi — yarim yozilgan chek qolmaydi.
create or replace function create_sale(
  p_store uuid,
  p_items jsonb,        -- [{product_id, qty, price}]
  p_payment jsonb,      -- {cash, card, payme, from_balance, debt}
  p_customer uuid default null,
  p_discount numeric default 0,
  p_shift uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
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
end $$;

-- ─────────────────────────────────────────────────────────────
-- 14. RLS — asosiy himoya
-- ─────────────────────────────────────────────────────────────
alter table companies            enable row level security;
alter table stores               enable row level security;
alter table profiles             enable row level security;
alter table categories           enable row level security;
alter table products             enable row level security;
alter table stock                enable row level security;
alter table customers            enable row level security;
alter table shifts               enable row level security;
alter table sales                enable row level security;
alter table sale_items           enable row level security;
alter table debts                enable row level security;
alter table debt_payments        enable row level security;
alter table warehouse_operations enable row level security;
alter table warehouse_items      enable row level security;
alter table shipments            enable row level security;
alter table shipment_items       enable row level security;
alter table shipment_costs       enable row level security;
alter table service_orders       enable row level security;
alter table service_items        enable row level security;
alter table cash_operations      enable row level security;
alter table expenses             enable row level security;
alter table suppliers            enable row level security;
alter table supplier_invoices    enable row level security;
alter table supplier_payments    enable row level security;
alter table payroll_payments     enable row level security;
alter table store_plans          enable row level security;
alter table audit_log            enable row level security;

-- Umumiy qoida: o'z kompaniyangiz ma'lumotini ko'rasiz.
create policy company_read on products for select
  using (company_id = auth_company_id());
create policy company_read on customers for select
  using (company_id = auth_company_id());
create policy company_read on categories for select
  using (company_id = auth_company_id());
create policy company_read on stores for select
  using (company_id = auth_company_id());
create policy company_read on suppliers for select
  using (company_id = auth_company_id());

-- Tovar tahriri — faqat egasi va menejer
create policy product_write on products for insert
  with check (company_id = auth_company_id() and auth_role() in ('owner', 'manager'));
create policy product_update on products for update
  using (company_id = auth_company_id() and auth_role() in ('owner', 'manager'));

-- Sotuv: kassir o'z do'konining cheklarini ko'radi, egasi/menejer hammasini
create policy sale_read on sales for select
  using (company_id = auth_company_id() and (
    auth_role() in ('owner', 'manager') or can_see_store(store_id)
  ));
create policy sale_insert on sales for insert
  with check (company_id = auth_company_id() and can_see_store(store_id));
-- Chek o'chirilmaydi va tahrirlanmaydi: qaytarish alohida yozuv bo'ladi.
-- Shuning uchun update/delete siyosati umuman berilmagan.

create policy sale_item_read on sale_items for select
  using (exists (select 1 from sales s where s.id = sale_id));

-- Qoldiq: hamma ko'radi, lekin faqat funksiya orqali o'zgaradi
create policy stock_read on stock for select
  using (exists (select 1 from products p
                  where p.id = product_id and p.company_id = auth_company_id()));

-- Moliya: xarajat, ish haqi, do'kon rejasi — faqat egasi
create policy expense_owner on expenses for all
  using (company_id = auth_company_id() and auth_role() = 'owner')
  with check (company_id = auth_company_id() and auth_role() = 'owner');

create policy payroll_owner on payroll_payments for all
  using (company_id = auth_company_id() and auth_role() = 'owner')
  with check (company_id = auth_company_id() and auth_role() = 'owner');

create policy plan_owner on store_plans for all
  using (auth_role() = 'owner') with check (auth_role() = 'owner');

-- Kassa operatsiyalari: o'z do'koni bo'yicha
create policy cash_rw on cash_operations for all
  using (company_id = auth_company_id() and can_see_store(store_id))
  with check (company_id = auth_company_id() and can_see_store(store_id));

-- Qarz: kassir ham ko'radi va to'lov qabul qiladi
create policy debt_read on debts for select
  using (company_id = auth_company_id());
create policy debt_pay on debt_payments for insert
  with check (exists (select 1 from debts d
                       where d.id = debt_id and d.company_id = auth_company_id()));

-- Xizmat: usta faqat o'ziga biriktirilganini ko'radi
create policy service_read on service_orders for select
  using (company_id = auth_company_id() and (
    auth_role() in ('owner', 'manager', 'cashier') or installer_id = auth.uid()
  ));
create policy service_write on service_orders for all
  using (company_id = auth_company_id() and auth_role() in ('owner', 'manager'))
  with check (company_id = auth_company_id() and auth_role() in ('owner', 'manager'));

-- Ombor
create policy warehouse_rw on warehouse_operations for all
  using (company_id = auth_company_id()
         and auth_role() in ('owner', 'manager', 'storekeeper'))
  with check (company_id = auth_company_id()
              and auth_role() in ('owner', 'manager', 'storekeeper'));

-- Profil: o'zingizni ko'rasiz; egasi hammani boshqaradi
create policy profile_self on profiles for select
  using (id = auth.uid() or company_id = auth_company_id());
create policy profile_admin on profiles for all
  using (company_id = auth_company_id() and auth_role() = 'owner')
  with check (company_id = auth_company_id() and auth_role() = 'owner');

-- Audit jurnalini faqat egasi o'qiydi, hech kim o'zgartira olmaydi
create policy audit_owner on audit_log for select
  using (company_id = auth_company_id() and auth_role() = 'owner');

-- ─────────────────────────────────────────────────────────────
-- 15. Ustun darajasidagi ruxsat: tannarx
-- ─────────────────────────────────────────────────────────────
-- Kassir tovar ro'yxatini ko'rishi kerak, lekin TANNARXNI ko'rmasligi
-- kerak. RLS qatorni yashiradi, ustunni yashira olmaydi — buning uchun
-- alohida ko'rinish (view) beriladi.
create view products_public with (security_invoker = true) as
  select id, company_id, name, sku, barcode, category_id, brand,
         sale_price, is_service, is_active
    from products;

-- ─────────────────────────────────────────────────────────────
-- 16. Hisobot ko'rinishlari
-- ─────────────────────────────────────────────────────────────
-- 7 779 chekni brauzerga tashib hisoblash 10 foydalanuvchida
-- og'irlik qiladi. Yig'indilar bazada hisoblanadi.
create view v_daily_sales with (security_invoker = true) as
  select s.company_id, s.store_id, date_trunc('day', s.sold_at)::date as day,
         sum(s.total)                          as revenue,
         sum(s.discount)                       as discount,
         sum(s.cash + s.card + s.payme)        as collected,
         sum(s.debt)                           as on_credit,
         count(*) filter (where s.type = 'sale')   as sale_count,
         count(*) filter (where s.type = 'return') as return_count
    from sales s
   group by 1, 2, 3;

create view v_product_margin with (security_invoker = true) as
  select p.company_id, p.id as product_id, p.name,
         sum(i.total)                          as revenue,
         sum(i.qty * i.cost_price)             as cogs,
         sum(i.total - i.qty * i.cost_price)   as profit,
         sum(i.qty)                            as qty
    from sale_items i
    join sales s   on s.id = i.sale_id and s.type = 'sale'
    join products p on p.id = i.product_id
   group by 1, 2, 3;

create view v_open_debts with (security_invoker = true) as
  select d.company_id, d.customer_id, d.id as debt_id, d.amount, d.issued_at, d.due_date,
         coalesce(sum(pm.amount), 0)                as paid,
         d.amount - coalesce(sum(pm.amount), 0)     as remaining,
         (current_date - d.due_date)                as overdue_days
    from debts d
    left join debt_payments pm on pm.debt_id = d.id
   where d.closed_at is null
   group by d.id
  having d.amount - coalesce(sum(pm.amount), 0) > 0.01;

-- ─────────────────────────────────────────────────────────────
-- 17. Realtime
-- ─────────────────────────────────────────────────────────────
-- Ikki kassir bir do'konda ishlaganda qoldiq va cheklar jonli yangilansin
alter publication supabase_realtime add table stock;
alter publication supabase_realtime add table sales;
alter publication supabase_realtime add table shifts;
alter publication supabase_realtime add table debts;
-- ══════════════════════════════════════════════════════════════
-- Yetishmayotgan RLS siyosatlari
-- ══════════════════════════════════════════════════════════════
-- Bu jadvallarda himoya yoqilgan, lekin birorta ruxsat berilmagan
-- edi — ya'ni ular EGASIGA ham ko'rinmaydi. Quyida har biriga
-- kerakli ruxsat beriladi.
-- (doc_counters ataylab tashqarida: unga faqat tizim tegadi.)

create policy company_self on companies for select
  using (id = auth_company_id());

-- Smena: o'z do'koni bo'yicha ochiladi va yopiladi
create policy shift_rw on shifts for all
  using (company_id = auth_company_id() and can_see_store(store_id))
  with check (company_id = auth_company_id() and can_see_store(store_id));

-- Yetkazib beruvchi hisob-fakturalari va to'lovlari — egasi va menejer
create policy invoice_rw on supplier_invoices for all
  using (company_id = auth_company_id() and auth_role() in ('owner', 'manager'))
  with check (company_id = auth_company_id() and auth_role() in ('owner', 'manager'));

create policy invoice_pay_rw on supplier_payments for all
  using (exists (select 1 from supplier_invoices i
                  where i.id = invoice_id and i.company_id = auth_company_id()))
  with check (exists (select 1 from supplier_invoices i
                       where i.id = invoice_id and i.company_id = auth_company_id()));

-- Import partiyalari
create policy shipment_rw on shipments for all
  using (company_id = auth_company_id() and auth_role() in ('owner', 'manager'))
  with check (company_id = auth_company_id() and auth_role() in ('owner', 'manager'));

create policy shipment_item_rw on shipment_items for all
  using (exists (select 1 from shipments s
                  where s.id = shipment_id and s.company_id = auth_company_id()))
  with check (exists (select 1 from shipments s
                       where s.id = shipment_id and s.company_id = auth_company_id()));

create policy shipment_cost_rw on shipment_costs for all
  using (exists (select 1 from shipments s
                  where s.id = shipment_id and s.company_id = auth_company_id()))
  with check (exists (select 1 from shipments s
                       where s.id = shipment_id and s.company_id = auth_company_id()));

-- Bola jadvallar otasidan meros oladi
create policy warehouse_item_rw on warehouse_items for all
  using (exists (select 1 from warehouse_operations o
                  where o.id = operation_id and o.company_id = auth_company_id()))
  with check (exists (select 1 from warehouse_operations o
                       where o.id = operation_id and o.company_id = auth_company_id()));

create policy service_item_rw on service_items for all
  using (exists (select 1 from service_orders o
                  where o.id = order_id and o.company_id = auth_company_id()))
  with check (exists (select 1 from service_orders o
                       where o.id = order_id and o.company_id = auth_company_id()));

-- Chek qatorlari: o'qish siyosati bor edi, yozish yo'q edi.
-- create_sale() security definer bo'lgani uchun ishlayveradi, lekin
-- qaytarish chekining qatorlari to'g'ridan-to'g'ri yoziladi.
create policy sale_item_write on sale_items for insert
  with check (exists (select 1 from sales s
                       where s.id = sale_id and s.company_id = auth_company_id()));
-- ══════════════════════════════════════════════════════════════
-- BILLZ HISOBOTLARI UCHUN JADVALLAR
-- ══════════════════════════════════════════════════════════════
-- Bular NSPOS ishlab chiqaradigan ma'lumot emas — Billz'dan olingan
-- TARIXIY yig'ma hisobotlar. Ular o'zgarmaydi, faqat o'qiladi va
-- solishtirish uchun ishlatiladi (masalan tovar tannarxi Billz
-- kunlik yalpi foydasidan chiqariladi).
--
-- Nega alohida jadval: bu raqamlarni cheklardan qayta hisoblab
-- bo'lmaydi — Billz chek ichidagi tovar tarkibini bermaydi.

-- Kunlik yakun: dashboard grafigi va haqiqiy yalpi foyda shundan
create table billz_daily (
  id           bigserial primary key,
  company_id   uuid not null references companies(id) on delete cascade,
  store_id     uuid references stores(id) on delete cascade,
  day          date not null,
  revenue      numeric(14,2) not null default 0,
  net_revenue  numeric(14,2) not null default 0,
  gross_profit numeric(14,2) not null default 0,
  unique (company_id, store_id, day)
);
create index on billz_daily (company_id, day);

-- Oylik foyda va zarar
create table billz_pnl (
  id             bigserial primary key,
  company_id     uuid not null references companies(id) on delete cascade,
  store_id       uuid references stores(id) on delete cascade,
  month          text not null,               -- "07.2026"
  revenue        numeric(14,2) not null default 0,
  discounts      numeric(14,2) not null default 0,
  returns        numeric(14,2) not null default 0,
  net_revenue    numeric(14,2) not null default 0,
  cogs           numeric(14,2) not null default 0,
  gross_profit   numeric(14,2) not null default 0,
  writeoff_cost  numeric(14,2) not null default 0,
  unique (company_id, store_id, month)
);

-- Sotuvchi kesimida kunlik tushum
create table billz_sellers (
  id         bigserial primary key,
  company_id uuid not null references companies(id) on delete cascade,
  store_id   uuid references stores(id) on delete cascade,
  day        date not null,
  seller     text not null,
  revenue    numeric(14,2) not null default 0,
  discount   numeric(14,2) not null default 0
);
create index on billz_sellers (company_id, day);

-- Tovar kesimida sotuv va marja (butun davr bo'yicha)
create table billz_product_stats (
  id            bigserial primary key,
  company_id    uuid not null references companies(id) on delete cascade,
  barcode       text,
  name          text not null,
  sku           text,
  category      text,
  sold_qty      numeric(14,3) not null default 0,
  returned_qty  numeric(14,3) not null default 0,
  revenue       numeric(14,2) not null default 0,
  profit        numeric(14,2) not null default 0,
  margin_pct    numeric(6,2)  not null default 0,
  active_days   integer not null default 0,
  -- Aylanish: tovar sotuvda bo'lgan kunlarga nisbatan tezlik
  sales_speed   numeric(12,4) not null default 0,
  turnover_days numeric(12,2) not null default 0,
  open_qty      numeric(14,3) not null default 0,
  import_qty    numeric(14,3) not null default 0,
  close_qty     numeric(14,3) not null default 0,
  unique (company_id, barcode)
);

-- Kunlik pul oqimi (to'lov turi bo'yicha)
create table billz_cashflow (
  id         bigserial primary key,
  company_id uuid not null references companies(id) on delete cascade,
  day        date not null,
  method     text not null,
  amount_in  numeric(14,2) not null default 0,
  amount_out numeric(14,2) not null default 0,
  op_count   integer not null default 0,
  unique (company_id, day, method)
);

-- Himoya: hammasi faqat o'z kompaniyasi ichida ko'rinadi.
-- Yozish yo'q — bu tarixiy ma'lumot, faqat yuklash skripti orqali
-- (u service key bilan ishlaydi va RLS'dan o'tadi).
alter table billz_daily          enable row level security;
alter table billz_pnl            enable row level security;
alter table billz_sellers        enable row level security;
alter table billz_product_stats  enable row level security;
alter table billz_cashflow       enable row level security;

create policy billz_read on billz_daily for select
  using (company_id = auth_company_id());
create policy billz_read on billz_pnl for select
  using (company_id = auth_company_id());
create policy billz_read on billz_sellers for select
  using (company_id = auth_company_id() and auth_role() in ('owner', 'manager'));
create policy billz_read on billz_product_stats for select
  using (company_id = auth_company_id());
create policy billz_read on billz_cashflow for select
  using (company_id = auth_company_id() and auth_role() in ('owner', 'manager'));
-- ══════════════════════════════════════════════════════════════
-- YUKLANGAN HISOBOTLAR (DATASET)
-- ══════════════════════════════════════════════════════════════
-- Billz'dan yuklangan Excel shu yerda saqlanadi. Har hisobot uchun
-- alohida jadval yasalmaydi: Billz 15 dan ortiq hisobot beradi va
-- ular vaqti-vaqti bilan o'zgaradi — har o'zgarishda baza
-- migratsiyasi kerak bo'lardi. Shuning uchun qatorlar JSONB.

create table datasets (
  id            uuid primary key default uuid_generate_v4(),
  company_id    uuid not null references companies(id) on delete cascade,
  name          text not null,
  report_id     text,                    -- tanilgan hisobot turi
  report_label  text,
  file_name     text,
  sheet_name    text,
  header        jsonb not null,          -- ustun nomlari
  profile       jsonb not null,          -- ustun turlari tahlili
  row_count     integer not null default 0,
  period_from   date,
  period_to     date,
  uploaded_by   uuid references profiles(id),
  created_at    timestamptz not null default now()
);
create index on datasets (company_id, created_at desc);
create index on datasets (company_id, report_id);

-- QATORLAR BO'LAK-BO'LAK SAQLANADI.
-- Nega: bitta hisobotda 17 000 qator bo'ladi. Har qatorni alohida
-- yozsak, brauzerdan 17 000 ta insert ketadi va yuklash bir daqiqa
-- davom etadi. 1 000 tadan bo'lib yuborsak — 18 ta so'rov, bir necha
-- soniya. O'qishda ham bitta select yetadi.
create table dataset_chunks (
  id          bigserial primary key,
  dataset_id  uuid not null references datasets(id) on delete cascade,
  seq         integer not null,
  rows        jsonb not null,            -- qatorlar massivi
  unique (dataset_id, seq)
);
create index on dataset_chunks (dataset_id, seq);

alter table datasets       enable row level security;
alter table dataset_chunks enable row level security;

-- Hisobotlarni ko'rish huquqi bor xodimlar o'qiydi va yuklaydi
create policy dataset_rw on datasets for all
  using (company_id = auth_company_id() and auth_role() in ('owner', 'manager'))
  with check (company_id = auth_company_id() and auth_role() in ('owner', 'manager'));

create policy dataset_chunk_rw on dataset_chunks for all
  using (exists (select 1 from datasets d
                  where d.id = dataset_id and d.company_id = auth_company_id()))
  with check (exists (select 1 from datasets d
                       where d.id = dataset_id and d.company_id = auth_company_id()));
-- ══════════════════════════════════════════════════════════════
-- XODIM KPI VA OYLIK
-- ══════════════════════════════════════════════════════════════
-- Manba: "Kunlik raqamlar b2b" va "B2B menejer KPI v2" jadvallari.
-- Ilgari Google Sheets'da yuritilardi.

-- Oylik reja va bonus qoidalari. Qoidalar JSONB: ular tez-tez
-- o'zgaradi (bosqich qo'shiladi, foiz to'g'irlanadi) va har
-- o'zgarishda baza migratsiyasi kerak bo'lmasin.
create table kpi_plans (
  id            uuid primary key default uuid_generate_v4(),
  company_id    uuid not null references companies(id) on delete cascade,
  staff_id      uuid not null references profiles(id) on delete cascade,
  month         text not null,                -- "2026-07"
  sales_plan    numeric(14,2) not null default 0,
  akb_plan      integer not null default 0,
  akb_fact      integer not null default 0,
  collection_pct numeric(6,4),                -- bo'sh bo'lsa kunlikdan hisoblanadi
  client_calls_plan integer not null default 0,
  new_groups_plan   integer not null default 0,
  rules         jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now(),
  unique (staff_id, month)
);
create index on kpi_plans (company_id, month);

-- Kunlik raqamlar. Faqat KIRITILADIGANLARI saqlanadi — jami tushum,
-- farq, jami savdo va plan % o'qishda hisoblanadi. Hisoblangan
-- qiymatni saqlash keraksiz takror va nomuvofiqlik manbai bo'lardi.
create table kpi_days (
  id            uuid primary key default uuid_generate_v4(),
  company_id    uuid not null references companies(id) on delete cascade,
  staff_id      uuid not null references profiles(id) on delete cascade,
  day           date not null,
  late          boolean not null default false,
  day_off       boolean not null default false,
  payme         numeric(14,2),
  cash          numeric(14,2),
  sales         numeric(14,2),
  client_calls  integer,
  new_groups    integer,
  revision      numeric(14,2),
  updated_at    timestamptz not null default now(),
  unique (staff_id, day)
);
create index on kpi_days (company_id, day);

alter table kpi_plans enable row level security;
alter table kpi_days  enable row level security;

-- Xodim O'ZINIKINI ko'radi va kiritadi; egasi va menejer hammani.
-- Oylik boshqa xodimlarga ko'rinmasligi kerak.
create policy kpi_plan_read on kpi_plans for select
  using (company_id = auth_company_id()
         and (staff_id = auth.uid() or auth_role() in ('owner', 'manager')));
create policy kpi_plan_write on kpi_plans for all
  using (company_id = auth_company_id() and auth_role() in ('owner', 'manager'))
  with check (company_id = auth_company_id() and auth_role() in ('owner', 'manager'));

create policy kpi_day_read on kpi_days for select
  using (company_id = auth_company_id()
         and (staff_id = auth.uid() or auth_role() in ('owner', 'manager')));
-- Xodim o'z kunini o'zi kiritadi
create policy kpi_day_own on kpi_days for all
  using (company_id = auth_company_id() and staff_id = auth.uid())
  with check (company_id = auth_company_id() and staff_id = auth.uid());
create policy kpi_day_admin on kpi_days for all
  using (company_id = auth_company_id() and auth_role() in ('owner', 'manager'))
  with check (company_id = auth_company_id() and auth_role() in ('owner', 'manager'));
-- ══════════════════════════════════════════════════════════════
-- XODIM TAKLIFLARI (INVITE)
-- ══════════════════════════════════════════════════════════════
-- Egasi yangi xodimni EMAIL va ROL bilan oldindan qayd qiladi.
-- Xodim o'sha email bilan ro'yxatdan o'tganda profili avtomatik
-- yaratiladi va taklif o'chiriladi.
--
-- Nega shunday: brauzerdan boshqa odamga hisob ochish uchun service
-- kalit kerak bo'lardi — u esa hech qachon brauzerga tushmasligi shart.
-- Bu usulda egasi faqat "kim va qanday rol bilan kira oladi" ni
-- belgilaydi, hisobni xodimning o'zi ochadi.
create table invites (
  id            uuid primary key default uuid_generate_v4(),
  company_id    uuid not null references companies(id) on delete cascade,
  email         text not null,
  full_name     text not null,
  phone         text,
  role          user_role not null default 'cashier',
  store_id      uuid references stores(id) on delete set null,
  fixed_salary  numeric(12,2) not null default 0,
  sales_pct     numeric(5,2)  not null default 0,
  service_pct   numeric(5,2)  not null default 0,
  created_at    timestamptz not null default now(),
  unique (company_id, email)
);
alter table invites enable row level security;

-- Taklifni faqat egasi boshqaradi
create policy invite_owner on invites for all
  using (company_id = auth_company_id() and auth_role() = 'owner')
  with check (company_id = auth_company_id() and auth_role() = 'owner');

-- Yangi foydalanuvchi ro'yxatdan o'tganda profil yaratish.
-- Email bo'yicha taklif topilsa — o'sha rol va do'kon bilan;
-- topilmasa profil yaratilmaydi (begona odam kira olmaydi).
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  inv invites%rowtype;
begin
  select * into inv from invites where lower(email) = lower(new.email) limit 1;
  if not found then
    return new;   -- taklif yo'q: profil yaratilmaydi, kirsa ham bo'sh ko'radi
  end if;

  insert into profiles (
    id, company_id, full_name, phone, role, store_id,
    fixed_salary, sales_pct, service_pct
  ) values (
    new.id, inv.company_id, inv.full_name, inv.phone, inv.role, inv.store_id,
    inv.fixed_salary, inv.sales_pct, inv.service_pct
  );

  delete from invites where id = inv.id;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
