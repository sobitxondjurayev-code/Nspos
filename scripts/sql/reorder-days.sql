-- ══════════════════════════════════════════════════════════════
-- BUYURTMA MUDDATI — rahbar o'zi belgilaydi (14 + 30 kun avtomat emas)
-- ══════════════════════════════════════════════════════════════
--   node scripts/sql.mjs -f scripts/sql/reorder-days.sql
--
-- "Qoldiq salomatligi" buyurtma miqdorini `kunlik sotuv × (yetkazish +
-- zaxira) − qoldiq` bilan hisoblaydi. Yetkazish muddati Billz'da
-- yozilmaydi; ilgari 14 va 30 kun kodda qattiq turardi. Rahbar
-- qarori (2026-09-02): muddatni o'zi kiritadi. Ustun `companies` da —
-- ekran, API va Telegram bot bir xil muddat bilan hisoblaydi
-- (`ledger_start` / `service_names` bilan bir naqsh).
alter table companies
  add column if not exists reorder_lead_days  integer not null default 14,
  add column if not exists reorder_cover_days integer not null default 30;

notify pgrst, 'reload schema';

select reorder_lead_days, reorder_cover_days from companies;
