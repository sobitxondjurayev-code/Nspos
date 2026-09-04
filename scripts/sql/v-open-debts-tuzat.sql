-- ══════════════════════════════════════════════════════════════
-- ESKI SQL KO'RINISHLAR — ilova ta'rifi bilan bir xil bo'lsin
-- ══════════════════════════════════════════════════════════════
--   node scripts/sql.mjs -f scripts/sql/v-open-debts-tuzat.sql
--
-- DAFTAR 20 (M): `v_open_debts` ochiq qarzni Σ debt_payments bilan,
-- `> 0.01` chegara bilan hisoblardi; ilova esa (`debtsData.ochiqQoldiq`)
-- Billz qarzida `paid_amount` dan, `> 0.009` bilan, `source='excel'`
-- chetlanib. `v_product_margin` faqat `sale` cheklarini olardi —
-- qaytarishsiz marja; xizmat qatoriga Billz'ning 5 $ tannarxi kirardi.
-- Ikkala ko'rinish kodda ISHLATILMAYDI (grep bilan tasdiqlangan), lekin
-- psql'dan so'ralsa ekrandan boshqa raqam berardi — ikki ta'rif bitta
-- tushunchaga. Endi ta'rif ilovanikiga tenglashtirildi.
begin;

-- Ustunlar qo'shilgani uchun `create or replace` o'tmaydi (Postgres
-- ko'rinish ustunini qayta nomlamaydi) — avval o'chirib, keyin yaratiladi.
-- Ikkalasi ham kodda ishlatilmaydi, ma'lumot yo'qolmaydi (ko'rinish).
drop view if exists v_open_debts;
drop view if exists v_product_margin;

create view v_open_debts with (security_invoker = true) as
 select d.company_id,
        d.customer_id,
        d.id as debt_id,
        d.source,
        d.status,
        d.amount,
        d.issued_at,
        d.due_date,
        -- Billz qarzida to'langan summa Billz'ning o'zidan (`paid_amount`,
        -- "Системная оплата" ham ichida); NSPOS qarzida to'lov yozuvlaridan.
        case when d.source = 'billz' then d.paid_amount
             else coalesce((select sum(pm.amount) from debt_payments pm where pm.debt_id = d.id), 0) end as paid,
        d.amount - case when d.source = 'billz' then d.paid_amount
             else coalesce((select sum(pm.amount) from debt_payments pm where pm.debt_id = d.id), 0) end as remaining,
        -- HAQIQIY yoshi — berilgan sanadan. Billz `due_date` deyarli har
        -- doim issued+1 kun (1 621/1 643), shuning uchun "muddati o'tgan"
        -- ma'nosiz; yosh `issued_at` dan hisoblanadi (DAFTAR 20 B).
        current_date - (d.issued_at at time zone 'Asia/Tashkent')::date as yosh_kun,
        current_date - d.due_date as overdue_days
   from debts d
  where d.closed_at is null
    and d.source is distinct from 'excel'
    and d.amount - case when d.source = 'billz' then d.paid_amount
             else coalesce((select sum(pm.amount) from debt_payments pm where pm.debt_id = d.id), 0) end > 0.009;

create view v_product_margin with (security_invoker = true) as
 select p.company_id,
        p.id as product_id,
        p.name,
        p.is_service,
        sum(i.total) as revenue,
        -- Xizmat qatorining tannarxi 0 — usta puli ish haqida (DAFTAR 20 A).
        -- Qaytarish qatorlari ham ichida (qty manfiy) — sof marja.
        sum(case when coalesce(p.is_service, false) then 0 else i.qty * coalesce(i.cost_price, 0) end) as cogs,
        sum(i.total - case when coalesce(p.is_service, false) then 0 else i.qty * coalesce(i.cost_price, 0) end) as profit,
        sum(i.qty) as qty,
        -- Tannarxsiz qatorlar — ALOHIDA (0 "bepul" degani emas)
        sum(i.total) filter (where not coalesce(p.is_service, false) and coalesce(i.cost_price, 0) = 0) as tannarxsiz
   from sale_items i
   join sales s on s.id = i.sale_id and s.superseded_by is null
   join products p on p.id = i.product_id
  group by p.company_id, p.id, p.name, p.is_service;

grant select on v_open_debts to nspos_app, nspos;
grant select on v_product_margin to nspos_app, nspos;

commit;

notify pgrst, 'reload schema';

-- Tekshiruv: ochiq qarz jami = Billz "Jami qarz" (ilova `jamiQarz` bilan bir xil)
select count(*) n, round(sum(remaining), 2) jami from v_open_debts;
select name, round(revenue) revenue, round(cogs) cogs, round(profit) profit from v_product_margin where is_service;
