-- ══════════════════════════════════════════════════════════════
-- XARAJAT KIMGA — xodim bo'lmaganlar uchun
-- ══════════════════════════════════════════════════════════════
-- `staff_id` faqat ro'yxatdagi xodimga ishora qiladi. Ko'chadan
-- chaqirilgan usta esa tizimda yo'q — unga to'langan pul "umumiy"
-- bo'lib qolib ketardi. Endi bunday holatda ism matn bilan yoziladi.
alter table expenses add column if not exists paid_to text;
