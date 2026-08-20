-- ══════════════════════════════════════════════════════════════
-- QARZ TO'LOVLARI EKRANGA KELMAYAPTI
-- ══════════════════════════════════════════════════════════════
-- `debt_payments` da RLS yoqilgan, lekin FAQAT insert siyosati bor
-- (`debt_pay`, schema.sql:720). SELECT siyosati yo'q — ya'ni brauzer
-- bu jadvaldan BIRORTA qator ololmaydi.
--
-- Oqibati jimgina va qimmat:
--   • `lib/debtsData.js:154` qarzni `select "*, debt_payments(...)"`
--     bilan o'qiydi → to'lovlar massivi DOIM bo'sh keladi
--   • demak har qarz "to'liq ochiq" bo'lib ko'rinadi
--   • Balans hisobotidagi "Mijozlardan olinadigan qarz" haqiqiydan
--     katta chiqadi
--   • `v_open_debts` ko'rinishi ham (security_invoker) doim paid = 0
--
-- O'lchandi (2026-08-21): bazada 16 000 ta to'lov yozuvi bor,
-- ekranda ulardan BITTASI ham ko'rinmaydi.
--
-- Yechim `sale_items` dagi bilan bir xil naqsh: to'lov qarzga
-- bog'langan, qarz esa kompaniyaga — shuni tekshiramiz.
-- Hech narsa o'chirilmaydi, hech kimga yangi YOZISH huquqi
-- berilmaydi: bu faqat O'QISH.

create policy debt_payment_read on debt_payments for select
  using (exists (select 1 from debts d
                  where d.id = debt_id and d.company_id = auth_company_id()));
