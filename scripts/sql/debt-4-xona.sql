-- ══════════════════════════════════════════════════════════════
-- QARZ SUMMASI 4 XONA BILAN — Billz qanday yuritsa, shunday
-- ══════════════════════════════════════════════════════════════
--   node scripts/sql.mjs -f scripts/sql/debt-4-xona.sql
--
-- Billz qarz summasini kasr tiyin bilan yuritadi (188.035; "Jami
-- qarz" ekranda 47 634.4218). Bazada ustun numeric(12,2) edi — har
-- qarz alohida yaxlitlanib, 387 qarz yig'indisi 7 tiyin farq qilardi
-- (47 634.35 ↔ 47 634.42). Rahbar tamoyili (DAFTAR 17): Billz bergan
-- raqam qo'shib-ayirmasdan ko'rsatilsin. Ustun kengaytiriladi —
-- ma'lumot yo'qolmaydi, eski qiymatlar joyida qoladi; keyingi to'liq
-- sinxron ularni Billz'dagi aniq qiymat bilan qayta yozadi.
--
-- `v_open_debts` va `v_debts_faol` ustun turiga bog'liq — Postgres
-- ularsiz turini o'zgartirmaydi; shu tranzaksiyada qayta yaratiladi.
begin;

drop view if exists v_open_debts;
drop view if exists v_debts_faol;

alter table debts
  alter column amount      type numeric(14,4),
  alter column paid_amount type numeric(14,4);
alter table debt_payments
  alter column amount type numeric(14,4);

create or replace view v_open_debts with (security_invoker = true) as
 select d.company_id,
        d.customer_id,
        d.id as debt_id,
        d.amount,
        d.issued_at,
        d.due_date,
        coalesce(sum(pm.amount), 0::numeric) as paid,
        d.amount - coalesce(sum(pm.amount), 0::numeric) as remaining,
        current_date - d.due_date as overdue_days
   from debts d
   left join debt_payments pm on pm.debt_id = d.id
  where d.closed_at is null
  group by d.id
 having (d.amount - coalesce(sum(pm.amount), 0::numeric)) > 0.01;

create or replace view v_debts_faol
with (security_invoker = true) as
select d.*
  from debts d
 where d.status is distinct from 'fully_paid'
    or exists (
         select 1 from debt_payments p
          where p.debt_id = d.id
            and p.paid_at >= (select coalesce(ledger_start, '2026-08-01'::date)
                                from companies order by created_at limit 1));

grant select on v_open_debts to nspos_app, nspos;
grant select on v_debts_faol to nspos_app, nspos;

commit;

notify pgrst, 'reload schema';

select column_name, data_type, numeric_precision, numeric_scale
  from information_schema.columns
 where table_name in ('debts', 'debt_payments') and column_name in ('amount', 'paid_amount')
 order by table_name, column_name;
