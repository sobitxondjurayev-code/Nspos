-- ══════════════════════════════════════════════════════════════
-- created_by — kim kiritganini o'zi yozib qo'ysin
-- ══════════════════════════════════════════════════════════════
-- Jadvalda ustun bor edi, lekin lib/ dagi hech bir modul uni
-- to'ldirmasdi — natijada xarajatlarda "kim kiritdi" doim bo'sh
-- qolardi (2026-08-05 da tekshirilgan: uchala yozuvda ham null).
-- Rahbar menejerlarning kiritganini tekshirishi uchun bu kerak.
--
-- company_id bilan bir xil yo'l: default auth.uid(). Ochiq
-- yuborilgan qiymat o'z kuchida qoladi.

alter table expenses             alter column created_by set default auth.uid();
alter table cash_operations      alter column created_by set default auth.uid();
alter table warehouse_operations alter column created_by set default auth.uid();
