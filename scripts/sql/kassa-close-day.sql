-- ══════════════════════════════════════════════════════════════
-- KASSA KUNLIK YOPILADI
-- ══════════════════════════════════════════════════════════════
-- Ilgari "Kassani yopish" hisob boshidan yig'ilgan hamma pulni bir
-- bosishda uzatardi. Endi har kun alohida yopiladi va yopilgan kun
-- `kind='transfer', category='close'` yozuvi bilan belgilanadi.

-- 1) Topshiriladigan pul bo'lmagan kun ham yopilishi kerak: 0 summali
--    yozuv "bu kun tekshirildi, pul qolmadi" degani. Busiz o'sha kun
--    abadiy "yopilmagan" bo'lib qizarib turardi.
alter table kassa_ops drop constraint if exists kassa_ops_amount_check;
alter table kassa_ops add constraint kassa_ops_amount_check check (amount >= 0);

-- 2) Bir kun ikki marta yopilmasin. Rad etilgan yopilish indeksdan
--    chiqib ketadi — o'sha kunni qaytadan yopish mumkin bo'ladi.
create unique index if not exists kassa_ops_close_once
  on kassa_ops (company_id, kassa, wallet, op_date)
  where kind = 'transfer' and category = 'close' and status <> 'rejected';
