-- ══════════════════════════════════════════════════════════════
-- KASSA YOZUVLARIDA KIRITILGAN SO'M
-- ══════════════════════════════════════════════════════════════
-- Kassadan chiqim SO'Mda kiritiladi, bazada esa dollarda saqlanardi.
-- Keyin so'm kerak bo'lganda u dollardan qaytarib hisoblanardi va
-- kiritilgan raqamdan farq qilardi (10 000 → 9 985). Xarajatlarda bu
-- allaqachon hal qilingan (amount_som/rate_used) — endi kassa
-- yozuvlari ham xuddi shunday.
alter table kassa_ops add column if not exists amount_som numeric(16,2);
alter table kassa_ops add column if not exists rate_used numeric(14,2);
