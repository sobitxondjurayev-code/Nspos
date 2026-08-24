-- ══════════════════════════════════════════════════════════════
-- ALMASHTIRILGAN CHEK — `sales.superseded_by`
-- ══════════════════════════════════════════════════════════════
-- Excel importidan 7 779 chek qolgan edi va ularda `billz_id` yo'q.
-- `linkSales()` ularni Billz chekiga bog'ladi (raqam + tur + summa),
-- lekin 39 tasi bog'lanmay qoldi — chunki kalitda summa AYNAN mos
-- kelishi talab qilinardi, Billz va Excel esa bir tiyinga farq qiladi:
--
--   000500084216 → Excel 1030.53 · Billz 1030.54
--   000301099246 → Excel  395.93 · Billz  395.94
--
-- Natijada o'sha 39 chek IKKI marta turibdi: bir marta Excel qatori
-- (tovar tarkibisiz), bir marta Billz qatori (tarkibi bilan). Jami
-- 17 052.90 $ ikki marta sanalgan. Moliyaga tegmaydi (hisob 01.08 dan,
-- bular esa fevral–iyul), lekin tarixiy tushum va "tovar tarkibi yo'q"
-- ogohlantirishi shundan chiqib turardi.
--
-- ── NEGA O'CHIRILMAYDI ──
-- Loyiha qoidasi: hech narsa o'chirilmaydi va birlashtirilmaydi.
-- Shuning uchun eski qator JOYIDA qoladi, faqat "meni kim almashtirdi"
-- degan havola oladi. Hisob-kitobga kirmaydi, tekshirish uchun turadi.
-- Xuddi `debts.source = 'excel'` bilan bir xil yondashuv.

alter table sales add column if not exists superseded_by uuid references sales(id);

create index if not exists sales_superseded_by_idx
  on sales(superseded_by) where superseded_by is not null;

comment on column sales.superseded_by is
  'Shu chekni almashtirgan chek. To''lgan bo''lsa — bu qator Excel importidan qolgan dublikat: bazada turadi, lekin hech qanday hisobga kirmaydi.';

-- ── Juftlash ──────────────────────────────────────────────────
-- Uchta shart, uchalasi ham zarur:
--   raqam + tur   — qaytarish cheki ASL chekning raqamini oladi,
--                   shuning uchun raqamning o'zi yetarli emas
--   ±0.02         — bir tiyinlik yaxlitlash farqi
--   ±2 kun        — Billz vaqti UTC, Excel mahalliy: chek yarim
--                   tunda bo'lsa sana bir kunga suriladi
-- Juftlik BITTA bo'lsagina yoziladi: ikkitasi topilsa taxmin
-- qilmaymiz, qator tegilmagan holda qoladi va tekshiruvda ko'rinadi.
with juft as (
  select a.id as eski,
         min(b.id::text)::uuid as yangi,
         count(*) as soni
  from sales a
  join sales b
    on  b.no = a.no
    and b.type = a.type
    and b.billz_id is not null
    and abs(b.total - a.total) <= 0.02
    and abs(extract(epoch from (b.sold_at - a.sold_at))) <= 172800
  where a.billz_id is null
    and a.superseded_by is null
  group by a.id
)
update sales s
   set superseded_by = j.yangi
  from juft j
 where j.eski = s.id and j.soni = 1;

-- PostgREST yangi ustunni ko'rishi uchun
notify pgrst, 'reload schema';
