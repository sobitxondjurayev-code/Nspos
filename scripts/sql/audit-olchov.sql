-- ══════════════════════════════════════════════════════════════
-- AUDITOR O'LCHOVI — faqat o'qiydi, hech narsa yozmaydi
-- ══════════════════════════════════════════════════════════════
--   npm run audit:olchov            (o'tgan oy)
--   node scripts/sql.mjs -f scripts/sql/audit-olchov.sql
--
-- 2026-09-04 auditida (DAFTAR 20) ishlatilgan so'rovlar. Har bosqichdan
-- OLDIN va KEYIN yuritiladi — "kod o'zgardi" degan gap raqam bilan
-- tasdiqlanadi, aks holda tuzatish ta'siri ko'rinmaydi (DAFTAR 14.9).
--
-- Bu skript ILOVA FORMULASINI takrorlamaydi — u xom bazani o'lchaydi.
-- Ekrandagi raqam uchun `npm run olchov:server` (ilovaning o'z
-- funksiyalari bilan). Ikkalasi bir-birini tekshiradi.
\set QUIET on
select to_char(date_trunc('month', (now() at time zone 'Asia/Tashkent') - interval '1 month'), 'YYYY-MM-DD') as oy_a,
       to_char(date_trunc('month', (now() at time zone 'Asia/Tashkent')), 'YYYY-MM-DD') as oy_b,
       to_char(date_trunc('month', (now() at time zone 'Asia/Tashkent') - interval '1 month'), 'YYYY-MM') as oy
\gset
\set QUIET off
\echo '════ O''LCHOV OYI:' :oy '(' :oy_a '..' :oy_b ')'

\echo '=== 1. Do''kon × tur: chek, savdo, nasiya, tannarx, marja, servis'
with hs as (
  select s.id, s.store_id, s.type, s.total, s.debt
  from sales s where s.sold_at >= :'oy_a' and s.sold_at < :'oy_b' and s.superseded_by is null
), it as (
  select i.sale_id, sum(i.total) items_total,
         sum(i.qty*coalesce(i.cost_price,0)) filter (where not coalesce(p.is_service,false)) cogs_tovar,
         sum(i.qty*coalesce(i.cost_price,0)) filter (where coalesce(p.is_service,false)) cogs_servis,
         sum(i.total) filter (where coalesce(p.is_service,false)) service,
         count(*) filter (where (i.cost_price is null or i.cost_price=0) and not coalesce(p.is_service,false)) tannarxsiz_qator,
         sum(i.total) filter (where (i.cost_price is null or i.cost_price=0) and not coalesce(p.is_service,false)) tannarxsiz_summa
  from sale_items i left join products p on p.id=i.product_id group by i.sale_id
)
select st.name, hs.type, count(*) n, round(sum(hs.total),2) total, round(sum(hs.debt),2) nasiya,
  round(sum(it.cogs_tovar),2) tannarx_tovar, round(sum(it.cogs_servis),2) tannarx_servis_billz,
  round(100*(sum(it.items_total)-sum(it.cogs_tovar))/nullif(sum(it.items_total),0),1) marja_pct,
  round(sum(it.service),2) servis, sum(it.tannarxsiz_qator) tannarxsiz_qator, round(sum(it.tannarxsiz_summa),2) tannarxsiz_summa
from hs join stores st on st.id=hs.store_id left join it on it.sale_id=hs.id
group by 1,2 order by 1,2;

\echo '=== 2. Oy yakuni: yalpi savdo, qaytarish, sof savdo, tannarx (servissiz), yalpi foyda'
-- ALMASHUV CHEKI ISHORASI (DAFTAR 20.6 "N", 2026-09-05 da o'lchandi)
-- Billz almashuv chekida `total` ishorasini TESKARI berishi mumkin:
-- avgustda 28 chekdan 8 tasi shunday (113.18 $ ikki barobar bo'lib
-- 226.36 $ farq beradi). Ilova buni `salesData.ishorali()` bilan
-- o'qiydi: ishora `subtotal` dan olinadi, chunki `subtotal` chek
-- qatorlari yig'indisiga AYNAN teng (28/28, farq 0.00).
--
-- Bu yerda formula ILOVANIKIGA ALMASHTIRILMAYDI — bu fayl ataylab
-- xom bazani o'lchaydi va ikkalasi bir-birini tekshiradi. Lekin
-- xom raqam yolg'iz tursa har safar "ekranda boshqacha" degan
-- yolg'on shubha tug'diradi, shuning uchun ikkala qiymat ham
-- chiqariladi: `sof_savdo` (xom `total`) va `sof_savdo_ishorali`
-- (ekrandagi raqam). Ular orasidagi farq = `almashuv_ishora_farqi`;
-- u NOLDAN farq qilsa sabab shu, boshqa narsa emas.
with hs as (
  select s.id, s.type, s.total, s.subtotal,
         case when s.total = 0 or s.subtotal = 0 then s.total
              when sign(s.total) = sign(s.subtotal) then s.total
              else -s.total end as total_ishorali
  from sales s where s.sold_at >= :'oy_a' and s.sold_at < :'oy_b' and s.superseded_by is null
), it as (
  select i.sale_id,
         sum(i.qty*coalesce(i.cost_price,0)) filter (where not coalesce(p.is_service,false)) cogs
  from sale_items i left join products p on p.id=i.product_id group by i.sale_id
)
select round(sum(total) filter (where type='sale'),2) yalpi_savdo,
       round(sum(total) filter (where type='return'),2) qaytarish,
       round(sum(total) filter (where type='exchange'),2) almashuv,
       round(sum(total),2) sof_savdo,
       round(sum(total_ishorali),2) sof_savdo_ishorali,
       round(sum(total)-sum(total_ishorali),2) almashuv_ishora_farqi,
       round(100*abs(sum(total) filter (where type='return'))/nullif(sum(total) filter (where type='sale'),0),1) qaytarish_pct,
       round(sum(it.cogs),2) tannarx,
       round(sum(total)-sum(it.cogs),2) yalpi_foyda,
       round(100*(sum(total)-sum(it.cogs))/nullif(sum(total),0),1) marja_pct
from hs left join it on it.sale_id=hs.id;

\echo '  ── almashuv cheklari: ishorasi teskari bo''lganlari'
select count(*) filter (where total <> 0 and subtotal <> 0 and sign(total) <> sign(subtotal)) as ishora_teskari,
       count(*) as almashuv_cheki,
       round(sum(case when total <> 0 and subtotal <> 0 and sign(total) <> sign(subtotal)
                      then 2*total else 0 end),2) as farq_summa
from sales where type='exchange' and sold_at >= :'oy_a' and sold_at < :'oy_b' and superseded_by is null;

\echo '=== 3. Pul tushumi (kassa nuqtai nazaridan)'
select 'chek naqd' k, round(sum(cash),2) v from sales where type='sale' and sold_at>=:'oy_a' and sold_at<:'oy_b'
union all select 'chek payme', round(sum(payme),2) from sales where type='sale' and sold_at>=:'oy_a' and sold_at<:'oy_b'
union all select 'chek karta', round(sum(card),2) from sales where type='sale' and sold_at>=:'oy_a' and sold_at<:'oy_b'
union all select 'chek nomalum', round(sum(coalesce(unknown_paid,0)),2) from sales where type='sale' and sold_at>=:'oy_a' and sold_at<:'oy_b'
union all select 'qarz tolov naqd', round(sum(amount),2) from debt_payments where kind='payment' and method='cash' and paid_at>=:'oy_a' and paid_at<:'oy_b'
union all select 'qarz tolov payme', round(sum(amount),2) from debt_payments where kind='payment' and method='payme' and paid_at>=:'oy_a' and paid_at<:'oy_b'
union all select 'qarz tolov karta/boshqa', round(sum(amount),2) from debt_payments where kind='payment' and method not in ('cash','payme') and paid_at>=:'oy_a' and paid_at<:'oy_b'
union all select 'qarzga qaytarish (pul emas)', round(sum(amount),2) from debt_payments where kind='return' and paid_at>=:'oy_a' and paid_at<:'oy_b'
union all select 'qaytarish naqd (minus)', round(-sum(cash),2) from sales where type='return' and sold_at>=:'oy_a' and sold_at<:'oy_b'
union all select 'qaytarish payme (minus)', round(-sum(payme),2) from sales where type='return' and sold_at>=:'oy_a' and sold_at<:'oy_b';

\echo '=== 4. Nasiya: berilgan, shu kuni yopilgan, to''lash muddati'
select count(*) berilgan, round(sum(amount),2) summa,
  count(*) filter (where closed_at::date = (issued_at at time zone 'Asia/Tashkent')::date) shu_kuni_yopilgan,
  round(sum(amount) filter (where closed_at::date = (issued_at at time zone 'Asia/Tashkent')::date),2) shu_kuni_summa,
  round(sum(amount-paid_amount),2) hali_ochiq
from debts where source='billz' and issued_at>=:'oy_a' and issued_at<:'oy_b';

\echo '=== 5. Ochiq qarz — Billz yorlig''i va HAQIQIY yoshi (berilgan sanadan)'
select status billz_yorligi, count(*) n, round(sum(amount-paid_amount),2) qoldiq from debts
 where source='billz' and status<>'fully_paid' and amount-paid_amount>0.00005 group by 1 order by 1;
select case when current_date - (issued_at at time zone 'Asia/Tashkent')::date <= 30 then '0-30 kun'
            when current_date - (issued_at at time zone 'Asia/Tashkent')::date <= 60 then '31-60 kun'
            when current_date - (issued_at at time zone 'Asia/Tashkent')::date <= 90 then '61-90 kun'
            else '90+ kun' end yosh, count(*) n, round(sum(amount-paid_amount),2) qoldiq, count(distinct customer_id) mijoz
from debts where source='billz' and status<>'fully_paid' and amount-paid_amount>0.00005 group by 1 order by 1;
select (due_date - (issued_at at time zone 'Asia/Tashkent')::date) billz_muddati_kun, count(*) n
from debts where source='billz' and issued_at>=:'oy_a' group by 1 order by 2 desc limit 3;

\echo '=== 6. Top-10 qarzdor (konsentratsiya)'
with o as (select customer_id, sum(amount-paid_amount) q from debts where source='billz' and status<>'fully_paid' and amount-paid_amount>0.00005 group by 1)
select count(*) mijozlar, round(sum(q),2) jami,
  round((select sum(q) from (select q from o order by q desc limit 10) x),2) top10,
  round(100*(select sum(q) from (select q from o order by q desc limit 10) x)/sum(q),1) top10_pct from o;

\echo '=== 7. Xarajat (qo''lda) — kategoriya bo''yicha, USD va so''m'
select category, count(*) n, round(sum(amount),2) usd, round(sum(amount_som),0) som
from expenses where spent_on>=:'oy_a' and spent_on<:'oy_b' and not is_recurring group by 1 order by 3 desc;
select round(sum(amount),2) jami_usd, round(sum(amount_som),0) jami_som, count(*) n
from expenses where spent_on>=:'oy_a' and spent_on<:'oy_b' and not is_recurring;

\echo '=== 8. Usta puli (kpi_day.olgan) va kameralar'
select round(sum((data->>'olgan')::numeric),0) olgan_som, count(distinct staff_id) ustalar, sum((data->>'cameras')::numeric) kameralar
from kpi_day where date >= :'oy_a' and date < :'oy_b' and coalesce(data->>'olgan','') <> '';

\echo '=== 9. Kassa harakati (kassa_ops) va Pul rejasi to''lovlari'
select kassa, wallet, kind, coalesce(category,'') category, status, count(*) n, round(sum(amount),2) usd
from kassa_ops where op_date >= :'oy_a' and op_date < :'oy_b' group by 1,2,3,4,5 order by 1,2,3,4,5;
select status, category, count(*) n, round(sum(amount),2) usd from payouts group by 1,2 order by 1,2;

\echo '=== 10. Ombor: tannarxda qiymat, tannarxsiz qoldiq'
select st.name, round(sum(k.qty*coalesce(p.cost_price,0)) filter (where k.qty>0 and not coalesce(p.is_service,false)),2) tannarxda,
  round(sum(k.qty*coalesce(p.sale_price,0)) filter (where k.qty>0 and not coalesce(p.is_service,false)),2) sotuv_narxida,
  count(*) filter (where k.qty>0 and (p.cost_price is null or p.cost_price=0) and not coalesce(p.is_service,false)) tannarxsiz_tovar,
  count(*) filter (where k.qty<0 and not coalesce(p.is_service,false)) manfiy_qoldiq
from stock k join products p on p.id=k.product_id join stores st on st.id=k.store_id group by 1 order by 1;

\echo '=== 11. Kurs va bo''sh moliya jadvallari'
select count(*) n, min(rate) min, max(rate) max, max(created_at) oxirgi from usd_rates where created_at>=:'oy_a' and created_at<:'oy_b';
select 'service_orders' t, count(*) from service_orders
union all select 'warehouse_operations', count(*) from warehouse_operations
union all select 'supplier_invoices', count(*) from supplier_invoices
union all select 'supplier_payments', count(*) from supplier_payments
union all select 'payroll_payments', count(*) from payroll_payments
union all select 'cash_operations', count(*) from cash_operations;

\echo '=== 12. Billz ko''zgu — oxirgi moslik'
select started_at, warnings->'olchov' olchov, warnings->'farq' farq from billz_sync_log where entity='moslik' order by started_at desc limit 1;
