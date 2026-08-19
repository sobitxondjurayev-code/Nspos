-- ══════════════════════════════════════════════════════════════
-- XARAJAT KIMGA TEGISHLI — usta biriktirish
-- ══════════════════════════════════════════════════════════════
-- Mashina gazi, avtol, shurup, samarez kabi xarajatlar aslida
-- ma'lum bir ustaga ketadi. Ilgari ular faqat kategoriya bo'yicha
-- yig'ilardi — "shu oyda benzinga 2 mln ketdi" degan raqam chiqardi-yu,
-- kimga ekani noma'lum qolardi. Endi har xarajatga usta biriktiriladi
-- va usta kesimida hisob chiqadi.
--
-- Majburiy emas: ijara, internet kabi umumiy xarajatlarda bo'sh qoladi.
alter table expenses add column if not exists staff_id uuid references profiles(id) on delete set null;

create index if not exists expenses_staff_idx on expenses (staff_id) where staff_id is not null;
