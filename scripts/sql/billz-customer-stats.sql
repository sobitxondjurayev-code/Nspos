-- ══════════════════════════════════════════════════════════════
-- MIJOZ STATISTIKASI — cheklardan hisoblanadi
-- ══════════════════════════════════════════════════════════════
-- Mijozlar sahifasi shu paytgacha Excel yuklamasidan o'qirdi, chunki
-- Excel bazada yo'q to'rtta ustunni berardi: jami xarid, savdo soni,
-- olingan tovar soni va "qaytuvchi mijoz". Endi `sale_items` to'lgan
-- (34 489 qator), ya'ni ularning hammasi CHEKLARDAN hisoblanadi va
-- yuklama kerak emas.
--
-- Nega ustun, nega ko'rinish (view) emas: `lib/db.js` jadvallarni
-- butunlay o'qib xotiraga soladi va PostgREST ko'rinishni bola jadval
-- sifatida ulay olmaydi (view'da tashqi kalit bo'lmaydi). Ustun bo'lsa
-- mijoz qatori bilan birga keladi va ilova kodi umuman o'zgarmaydi.
alter table customers add column if not exists purchases_total numeric(14,2) not null default 0;
alter table customers add column if not exists sales_count     int not null default 0;
alter table customers add column if not exists items_bought    numeric(14,3) not null default 0;
alter table customers add column if not exists is_returning    boolean not null default false;

-- Bir marta hisoblab, ustunlarga yozadi. Sinxronizatsiya oxirida
-- chaqiriladi — 9 000 chek uchun bitta so'rov, bir necha yuz millisekund.
--
-- `security definer`: funksiya service key bilan ham, rahbar sessiyasi
-- bilan ham bir xil ishlashi kerak; RLS ostida `sales` ni to'liq
-- ko'rmasa statistika kam chiqadi.
create or replace function refresh_customer_stats()
returns int
language plpgsql
security definer
set search_path = public
as $$
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
$$;

revoke all on function refresh_customer_stats() from public;
grant execute on function refresh_customer_stats() to authenticated, service_role;
