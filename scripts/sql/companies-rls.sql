-- ══════════════════════════════════════════════════════════════
-- companies — RLS siyosatlari
-- ══════════════════════════════════════════════════════════════
-- Muammo: "Kurs yo'q — Sozlamalarda kursni yoqing" yozuvi hech qachon
-- yo'qolmasdi, usd_rate bazada null bo'lib turaverdi (usd_rate_auto
-- true bo'lsa ham). Natijada xarajat oynasida "Summa (so'm)" deb
-- kiritilgan raqam dollarga o'girilmay, o'zi dollar bo'lib saqlanardi.
--
-- Sabab: companies jadvalida RLS yoqilgan, lekin birorta siyosat yo'q
-- edi — ya'ni qator na o'qiladi, na yoziladi. Shuning uchun:
--   1) registerModule("companies") restore'i bo'sh qaytardi →
--      xotiradagi usdRate null qoldi;
--   2) CBU'dan kurs olinsa ham, uni companies'ga yozib bo'lmasdi.
--
-- schema.sql da company_self (select) bor, lekin jonli bazaga
-- tushmagan ekan; update siyosati esa umuman yozilmagan.

-- O'z kompaniyangizni ko'rasiz (schema.sql, 816-qator bilan bir xil)
drop policy if exists company_self on companies;
create policy company_self on companies for select
  using (id = auth_company_id());

-- Sozlamalarni faqat rahbar o'zgartiradi: kurs, servis nomlari,
-- hisob boshlanish sanasi. Menejer brauzeri kursni o'zi uchun
-- CBU'dan olib turaveradi, bazaga esa rahbar sessiyasi yozadi.
drop policy if exists company_update on companies;
create policy company_update on companies for update
  using (id = auth_company_id() and auth_role() = 'owner')
  with check (id = auth_company_id() and auth_role() = 'owner');
