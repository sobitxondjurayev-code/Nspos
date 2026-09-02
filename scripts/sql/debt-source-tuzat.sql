-- ══════════════════════════════════════════════════════════════
-- QARZ YORLIG'I: Billz'dan kelgan har qator `source = 'billz'`
-- ══════════════════════════════════════════════════════════════
--   node scripts/sql.mjs -f scripts/sql/debt-source-tuzat.sql
--
-- 2026-09-02 auditi: `billzMap.debtRow` `source` ustunini YOZMASDI,
-- baza uni default 'nspos' qilardi. `listDebts()` faqat 'billz' ni
-- sanagani uchun 20.08 dan keyin kelgan 150 qarz (20 180.48 $) ekranda
-- ko'rinmadi — Billz "Jami qarz" 47 634 $, NSPOS 30 639 $.
-- `billz-debts.sql:57` dagi backfill bir marta (22.08) yurgan edi.
--
-- Endi sinxron yorliqni o'zi yozadi (`debtRow` → source: 'billz'); bu
-- fayl faqat oradagi qatorlarni tuzatadi. Hech narsa o'chirilmaydi.
select source, count(*) as n, round(sum(amount - paid_amount), 2) as qoldiq
  from debts where billz_id is not null and closed_at is null
 group by source order by source;

update debts set source = 'billz'
 where billz_id is not null and source <> 'billz';

select source, count(*) as n, round(sum(amount - paid_amount), 2) as qoldiq
  from debts where billz_id is not null and closed_at is null
 group by source order by source;
