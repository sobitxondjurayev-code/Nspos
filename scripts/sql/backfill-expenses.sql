-- ══════════════════════════════════════════════════════════════
-- Eski uchta xarajatni to'ldirish
-- ══════════════════════════════════════════════════════════════
-- 2026-08-05 da created_by va amount_som ustunlari qo'shilgunga qadar
-- kiritilgan yozuvlar. Kim kiritgani taxmin qilinmaydi — audit_log
-- da aniq yozilgan (actor_id), o'shandan olinadi.
--
-- rate_used ham to'ldiriladi: o'sha paytda kompaniya kursi 11 942.21
-- edi (companies.usd_rate 11:55 da qo'yilgan, yozuvlar 11:59 dan
-- keyin kiritilgan). Shu bilan bu xarajatlar so'mda ko'rsatilganda
-- bugungi kursga bog'lanib qolmaydi.

update expenses e
   set created_by = a.actor_id
  from (
    select distinct on (row_id) row_id, actor_id
      from audit_log
     where table_name = 'expenses' and action = 'insert'
     order by row_id, at
  ) a
 where a.row_id = e.id and e.created_by is null;

update expenses
   set rate_used = 11942.21
 where rate_used is null and amount_som is null;

-- Kiritilgan so'm summasi hech qayerda saqlanmagan (ustun keyin
-- qo'shilgan), dollaridan tiklab ham bo'lmaydi: 70 000 ham, 69 950 ham
-- bir xil 5.86 beradi. Shuning uchun raqamlar rahbardan so'ralib,
-- 2026-08-05 da tasdiqlangan holda yozildi.
update expenses set amount_som = 70000  where category='dinner'       and amount_som is null;
update expenses set amount_som = 100000 where category='lunch'        and amount_som is null;
update expenses set amount_som = 60000  where category='staff_travel' and amount_som is null;
