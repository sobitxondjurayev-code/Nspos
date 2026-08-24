-- ══════════════════════════════════════════════════════════════
-- ISH DAVRIDAGI QARZLAR — `v_debts_faol`
-- ══════════════════════════════════════════════════════════════
-- Ilova ochilganda 11 553 qarz va 16 081 to'lov brauzerga tashilardi —
-- 8.6 MB. Aslida ish davri uchun kerakligi 1 449 qarz va 798 to'lov,
-- ya'ni 873 kB.
--
-- ── NEGA "OCHIQ QARZ" YETARLI EMAS ──
-- Faqat `status <> 'fully_paid'` olinса kassa puli buzilardi. Avgustda
-- to'langan qarz endi YOPIQ, lekin uning to'lovi avgust kassasiga
-- tushgan naqd. `lib/kassaIncome.js` da yozilgani: "kassadagi naqdning
-- yarmidan ko'pi qarz puli". Ya'ni yopiq qarzni tashlab yuborish
-- tushumni emas, KASSANI kamaytirardi va bu jimgina bo'lardi.
--
-- Shuning uchun shart ikkita:
--   1) hali yopilmagan qarz            → ro'yxat va yosh guruhlari uchun
--   2) hisob boshidan keyin to'lov bo'lgan qarz → kassa uchun
--
-- Qolgan 10 100 ta yopiq qarz bazada joyida turadi — hech narsa
-- o'chirilmaydi, faqat brauzerga tashilmaydi. Tarix kerak bo'lganda
-- `debts` jadvalining o'zidan olinadi.
--
-- ── security_invoker MAJBURIY ──
-- Ko'rinish egasi `postgres` (superuser). `security_invoker` bo'lmasa
-- ko'rinish EGASINING huquqi bilan o'qiladi va `debts` ustidagi RLS
-- umuman ishlamaydi — har qanday kirgan xodim hamma qarzni ko'rardi.
-- PG 17 da bu parametr bor va SHART.
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

grant select on v_debts_faol to nspos_app;
grant select on v_debts_faol to nspos;

notify pgrst, 'reload schema';
