-- ══════════════════════════════════════════════════════════════
-- BILLZ QARZLARI
-- ══════════════════════════════════════════════════════════════
-- Bazadagi 659 qarz Excel'dan kelgan va ularda QAYTISH SANALARI
-- MODELLASHTIRILGAN edi (lib/debtsData.js izohiga qarang) — shuning
-- uchun ilova bazani emas, yuklamani o'qirdi. Billz API esa haqiqiy
-- raqamni beradi: 10 844 yozuv, har birida qancha to'langani, qachon
-- va qanday usulda to'langani bor.
--
--   node scripts/sql.mjs -f scripts/sql/billz-debts.sql
--   yoki: supabase db query --linked -f scripts/sql/billz-debts.sql

alter table debts add column if not exists billz_id uuid;
-- Billz statusi: unpaid | fully_paid | overdue (va ehtimol partially_paid).
-- `closed_at` dan farqi bor: muddati o'tgan, lekin ochiq qarz ham bor.
alter table debts add column if not exists status text;
-- Qancha qaytgani. `debt_payments` yig'indisi bilan bir xil bo'lishi
-- kerak — moslik tekshiruvi shuni qo'riqlaydi.
alter table debts add column if not exists paid_amount numeric(12,2) not null default 0;
alter table debts add column if not exists comment text;

create unique index if not exists debts_billz_uniq on debts (company_id, billz_id);
create index if not exists debts_status_idx on debts (company_id, status);

-- To'lovlarni takrorlamaslik uchun kalit.
-- Billz to'lovga ID BERMAYDI — u faqat tayyor satr qaytaradi:
--   "19-08-2026 18:38:31 Наличные: 2.500000"
-- Shu satrning o'zi kalit bo'ladi: bir qarz ichida u takrorlanmaydi
-- va sinxronizatsiya necha marta ishlasa ham to'lov ikkilanmaydi.
alter table debt_payments add column if not exists billz_key text;
create unique index if not exists debt_payments_billz_uniq
  on debt_payments (debt_id, billz_key);

-- Billz'dagi "Системная оплата" — tovar qaytarilgani uchun qarz
-- kamaygani, ya'ni pul kelmagan. Sxemada bu `kind = 'return'`.
comment on column debt_payments.billz_key is
  'Billz to''lov satri — takrorlanmaslik kaliti. Billz to''lovga id bermaydi.';

-- ─────────────────────────────────────────────────────────────
-- Manba belgisi: eski Excel qarzi va Billz qarzi
-- ─────────────────────────────────────────────────────────────
-- Bazada Excel'dan kelgan 659 qarz bor (07.06–22.07.2026, jami
-- 103 380 $) va ularning HAMMASI "ochiq" deb turibdi. Billz'da esa
-- o'shalarning ko'pi allaqachon to'langan — haqiqiy ochiq qarz
-- 52 502 $. Ikkalasi birga sanalsa ochiq qarz uch barobar ko'p
-- ko'rinadi.
--
-- Ular BOG'LAB bo'lmaydi: eski qarzlarda `sale_id` yo'q (Excel
-- importi chekka bog'lamagan), mijoz esa eski, Billz'ga ulanmagan
-- qatorga ishora qiladi — 659 tadan atigi 76 tasi mos keladi.
--
-- O'CHIRILMAYDI (foydalanuvchi qarori, 2026-08-19). O'rniga manba
-- belgilanadi va ilova Billz qarzi bor paytda faqat o'shani sanaydi.
-- Eski yozuv bazada tekshiruv uchun qolaveradi.
alter table debts add column if not exists source text not null default 'nspos';

update debts set source = 'billz' where billz_id is not null and source <> 'billz';
update debts set source = 'excel' where billz_id is null and source = 'nspos'
  and issued_at < '2026-07-23';

create index if not exists debts_source_idx on debts (company_id, source);
