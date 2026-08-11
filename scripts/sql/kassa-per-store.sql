-- ══════════════════════════════════════════════════════════════
-- KASSALAR DO'KON BO'YICHA (Billz'dagidek)
-- ══════════════════════════════════════════════════════════════
-- Avval kassa uch qiymat bilan cheklangandi: b2b / b2c / company.
-- Rahbar Billz modelini tanladi: har do'konning o'z kassasi bor
-- ("Касса NSkamera", "Cashbox nskamera namangan"), ustiga kompaniyaning
-- asosiy balansi. Demak kassa endi DO'KON ID'si yoki 'company'.
--
-- Ro'yxatli check o'rniga bog'liqlik: do'kon o'chirilsa yozuv qolmasin
-- degan qat'iy talab yo'q (tarix saqlanishi kerak), shuning uchun
-- foreign key emas, faqat formatga tekshiruv qo'yiladi.

alter table kassa_ops drop constraint if exists kassa_ops_kassa_check;
alter table kassa_ops add constraint kassa_ops_kassa_check check (
  kassa = 'company' or kassa ~ '^[0-9a-f-]{36}$' or kassa ~ '^s[0-9]+$'
);

alter table expenses drop constraint if exists expenses_kassa_check;
alter table expenses add constraint expenses_kassa_check check (
  kassa = 'company' or kassa ~ '^[0-9a-f-]{36}$' or kassa ~ '^s[0-9]+$'
);

-- Kassa bo'yicha balans tez hisoblanishi uchun
create index if not exists expenses_kassa_idx on expenses (kassa);
