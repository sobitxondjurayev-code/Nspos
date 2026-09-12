-- ══════════════════════════════════════════════════════════════
-- JONLI YANGILANISH: 30 SO'ROV → 1 TA (2026-09-12)
-- ══════════════════════════════════════════════════════════════
--   node scripts/sql.mjs -f scripts/sql/jadval-yangilanish.sql
--
-- Ilova ochiq turganda har 20 soniyada "qaysi jadval o'zgardi" deb
-- so'raladi (`lib/db.js` → `subscribeAll`). Ilgari bu HAR JADVAL
-- uchun alohida so'rov edi va ular KETMA-KET ketardi:
-- 21 ta jadval × ~250 ms = har aylanish ~5 soniya uzluksiz so'rov,
-- kun bo'yi, har ochiq oynadan.
--
-- Yomoni — birinchi aylanish ILOVA OCHILAYOTGANDA boshlanardi va
-- brauzerning bitta manzilga ochadigan 6 ta ulanishini og'ir
-- jadvallar (chek, qarz, mijoz) bilan bo'lishib olardi. Ya'ni
-- "jonli yangilanish" aynan yuklanishni sekinlashtirardi.
--
-- Endi bitta chaqiriq hammasini qaytaradi.
--
-- ── NEGA `security invoker` ──
-- `definer` bo'lsa funksiya RLS'ni chetlab o'tardi va usta o'zi
-- ko'ra olmaydigan jadvalning o'zgarish vaqtini bilib olardi.
-- `invoker` da esa javob xodim KO'RA OLADIGAN qatorlar bo'yicha —
-- ko'ra olmaydigan qator uni bezovta ham qilmaydi.
--
-- ── NEGA INDEKS ──
-- `max(updated_at)` indekssiz butun jadvalni o'qiydi. Eski yo'l ham
-- (`order by updated_at desc limit 1`) xuddi shunday edi, ya'ni bu
-- xarajat ilgari ham bor edi — endi ko'rinib turibdi va yopiladi.
-- Bola jadvallar (chek qatorlari, qoldiq, to'lovlar) ro'yxatda yo'q:
-- ular so'ralmaydi, lekin sinxron ularga minglab qator yozadi —
-- keraksiz indeks har yozuvni sekinlashtirardi.

begin;

create or replace function public.jadval_yangilanish(jadvallar text[])
returns table (jadval text, ozgargan timestamptz)
language plpgsql
stable
security invoker
set search_path = public
as $fn$
declare
  t       text;
  qiymat  timestamptz;
begin
  foreach t in array jadvallar loop
    -- Nom faqat oddiy identifikator bo'lsin. `format('%I')` o'zi ham
    -- qo'shtirnoqlaydi, lekin bu yerda kutilmagan nom umuman
    -- bajarilmagani ma'qul.
    if t !~ '^[a-z_][a-z0-9_]*$' then
      continue;
    end if;
    -- `updated_at` ustuni bo'lmagan jadval jimgina tashlab ketiladi:
    -- so'rovchi ro'yxatni moduldan oladi, jadval esa hali
    -- qo'shilmagan bo'lishi mumkin (`ctx.pending`).
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = t and column_name = 'updated_at'
    ) then
      continue;
    end if;

    execute format('select max(updated_at) from public.%I', t) into qiymat;
    jadval := t;
    ozgargan := qiymat;
    return next;
  end loop;
end
$fn$;

grant execute on function public.jadval_yangilanish(text[]) to nspos_app;
do $g$ begin
  if exists (select 1 from pg_roles where rolname = 'nspos') then
    grant execute on function public.jadval_yangilanish(text[]) to nspos;
  end if;
end $g$;

-- Kuzatiladigan jadvallarga `updated_at` indeksi. Ro'yxat AYNAN
-- kuzatiladiganlar: `syncTable` bilan qayd etilgan va `realtime`
-- o'chirilmagan modullar (`lib/*Data.js`). Bola jadvallar (chek
-- qatorlari, qoldiq, to'lovlar) va `registerModule` bilan
-- to'g'ridan-to'g'ri qayd etilganlar (xarajat, KPI, huquq —
-- ular umuman so'ralmaydi) ataylab yo'q.
do $ix$
declare
  t     text;
  nomlar text[] := array[
    'sales', 'products', 'customers', 'debts', 'expense_categories',
    'cash_operations', 'kassa_ops', 'payouts', 'payroll_payments', 'profiles',
    'suppliers', 'supplier_invoices', 'service_orders', 'shifts', 'shipments',
    'warehouse_operations', 'invites', 'usd_rates', 'stock_transfers',
    'stocktakings', 'oy_muhri'
  ];
begin
  foreach t in array nomlar loop
    if exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = t and column_name = 'updated_at'
    ) then
      execute format('create index if not exists %I on public.%I (updated_at desc)',
                     t || '_updated_idx', t);
    end if;
  end loop;
end $ix$;

commit;

notify pgrst, 'reload schema';
