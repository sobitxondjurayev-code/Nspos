-- ═══════════════════════════════════════════════════════════════
-- NSPOS — KPI jadvallari (qurilmalar orasida realtime sinxron)
-- Supabase → SQL Editor → shu blokni to'liq yopishtirib "Run"
-- Qayta ishga tushirilsa ham xato bermaydi (idempotent).
-- ═══════════════════════════════════════════════════════════════

-- 1) Xodimga biriktirilgan KPI turi (b2b / b2c_store / b2c_retention)
create table if not exists public.kpi_assign (
  staff_id   uuid primary key references auth.users(id) on delete cascade,
  kpi_type   text not null default 'b2b',
  updated_at timestamptz default now()
);

-- 2) Oylik reja va qoidalar — data JSONB (har tur uchun moslashuvchan)
create table if not exists public.kpi_plan (
  id         text primary key,
  staff_id   uuid not null references auth.users(id) on delete cascade,
  month      text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now(),
  unique (staff_id, month)
);

-- 3) Kunlik ko'rsatkichlar
create table if not exists public.kpi_day (
  id         text primary key,
  staff_id   uuid not null references auth.users(id) on delete cascade,
  date       text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now(),
  unique (staff_id, date)
);

-- ── RLS: egasi hammani ko'radi/yozadi, xodim faqat o'zinikini ──
alter table public.kpi_assign enable row level security;
alter table public.kpi_plan   enable row level security;
alter table public.kpi_day    enable row level security;

create or replace function public.is_owner()
returns boolean language sql stable as $$
  select coalesce((select role = 'owner' from public.profiles where id = auth.uid()), false)
$$;

drop policy if exists kpi_assign_rw on public.kpi_assign;
create policy kpi_assign_rw on public.kpi_assign for all
  using (public.is_owner() or staff_id = auth.uid())
  with check (public.is_owner() or staff_id = auth.uid());

drop policy if exists kpi_plan_rw on public.kpi_plan;
create policy kpi_plan_rw on public.kpi_plan for all
  using (public.is_owner() or staff_id = auth.uid())
  with check (public.is_owner() or staff_id = auth.uid());

drop policy if exists kpi_day_rw on public.kpi_day;
create policy kpi_day_rw on public.kpi_day for all
  using (public.is_owner() or staff_id = auth.uid())
  with check (public.is_owner() or staff_id = auth.uid());

-- ── Realtime: o'zgarishlar darrov boshqa qurilmaga uzatilsin ──
do $$ begin alter publication supabase_realtime add table public.kpi_assign; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.kpi_plan;   exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.kpi_day;    exception when duplicate_object then null; end $$;
