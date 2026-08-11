-- ============================================================
-- NSPOS — Multi-tenant retail boshqaruv tizimi sxemasi (1-bosqich)
-- Supabase SQL Editor'da ishga tushiring.
-- ============================================================

-- KOMPANIYALAR (har bir tenant)
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'USD',
  created_at timestamptz not null default now()
);

-- DO'KONLAR / FILIALLAR
create table stores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  color text not null default '#6b8afd',
  is_warehouse boolean not null default false,
  created_at timestamptz not null default now()
);

-- XODIMLAR (Supabase auth.users bilan bog'lanadi)
create type user_role as enum ('owner', 'manager', 'cashier');

create table employees (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  store_id uuid references stores(id) on delete set null,
  full_name text not null,
  role user_role not null default 'cashier',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- KATEGORIYALAR
create table categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  parent_id uuid references categories(id) on delete set null,
  name text not null
);

-- MAHSULOTLAR
create table products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  name text not null,
  sku text,
  barcode text,
  cost_price numeric(14,2) not null default 0,
  sale_price numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

-- QOLDIQLAR (do'kon kesimida)
create table stock (
  product_id uuid not null references products(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  qty numeric(14,3) not null default 0,
  primary key (product_id, store_id)
);

-- SOTUVLAR (cheklar)
create table sales (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  store_id uuid not null references stores(id),
  cashier_id uuid references employees(id),
  total numeric(14,2) not null default 0,
  paid_cash numeric(14,2) not null default 0,
  paid_card numeric(14,2) not null default 0,
  status text not null default 'completed', -- completed | returned
  created_at timestamptz not null default now()
);

create table sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid not null references products(id),
  qty numeric(14,3) not null,
  price numeric(14,2) not null,
  discount numeric(14,2) not null default 0
);

-- ============================================================
-- ROW LEVEL SECURITY: har kim faqat o'z kompaniyasini ko'radi
-- ============================================================
create or replace function my_company_id() returns uuid
language sql stable security definer as $$
  select company_id from employees where id = auth.uid()
$$;

alter table companies  enable row level security;
alter table stores     enable row level security;
alter table employees  enable row level security;
alter table categories enable row level security;
alter table products   enable row level security;
alter table stock      enable row level security;
alter table sales      enable row level security;
alter table sale_items enable row level security;

create policy "own company" on companies for all
  using (id = my_company_id());
create policy "own stores" on stores for all
  using (company_id = my_company_id());
create policy "own employees" on employees for all
  using (company_id = my_company_id());
create policy "own categories" on categories for all
  using (company_id = my_company_id());
create policy "own products" on products for all
  using (company_id = my_company_id());
create policy "own stock" on stock for all
  using (exists (select 1 from stores s where s.id = stock.store_id and s.company_id = my_company_id()));
create policy "own sales" on sales for all
  using (company_id = my_company_id());
create policy "own sale_items" on sale_items for all
  using (exists (select 1 from sales s where s.id = sale_items.sale_id and s.company_id = my_company_id()));

-- Dashboard uchun kunlik sotuvlar ko'rinishi
create or replace view daily_sales as
select company_id, store_id, date_trunc('day', created_at) as day, sum(total) as total
from sales where status = 'completed'
group by 1, 2, 3;
