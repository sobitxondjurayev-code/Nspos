-- ══════════════════════════════════════════════════════════════
-- BIZNES QOIDALARI — rahbar sozlaydigan raqamlar (2026-09-03)
-- ══════════════════════════════════════════════════════════════
--   node scripts/sql.mjs -f scripts/sql/companies-sozlamalar.sql
--
-- Rahbar: "hamma narsa sozlanadigan bo'lsin". Kodda qotgan raqamlar
-- (usta pul kunlari, kam qoldiq chegarasi, qarz guruhlari, AR yosh
-- guruhlari, sotuv oynasi) endi `companies.sozlamalar` (jsonb) da.
-- Bitta ustun, kalitlar nom bilan (`kpi.payDays`, `stock.lowThreshold`…):
-- yangi sozlama uchun sxema o'zgarmaydi. Koddagi qiymat STANDART bo'lib
-- qoladi — jsonb'da yo'q kalit o'sha bilan ishlaydi.
-- Yozish: `company_update` (faqat rahbar) — o'zgarmaydi.
alter table companies add column if not exists sozlamalar jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
