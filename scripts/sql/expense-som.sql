-- ══════════════════════════════════════════════════════════════
-- Xarajatda kiritilgan so'm summasi ham saqlansin
-- ══════════════════════════════════════════════════════════════
-- Xarajat so'mda kiritiladi, bazada esa dollarda saqlanardi. Tahrirlashga
-- ochilganda so'm dollardan qaytarib hisoblanardi va yaxlitlash farqi
-- ko'rinardi: 350 000 kiritilgan, 350 026 chiqardi.
--
-- Endi kiritilgan so'm va o'sha kundagi kurs ham yoziladi. Dollar
-- summasi avvalgidek asosiy qiymat bo'lib qoladi — hisobotlar
-- o'zgarmaydi. Eski qatorlarda bu ustunlar bo'sh: ular uchun eski
-- yo'l (dollar × kurs) ishlaydi.

alter table expenses add column if not exists amount_som numeric;
alter table expenses add column if not exists rate_used  numeric;
