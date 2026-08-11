-- ══════════════════════════════════════════════════════════════
-- XARAJATNI MENEJER HAM KIRITADI
-- ══════════════════════════════════════════════════════════════
-- Ilgari `expenses` jadvali faqat rahbarga ochiq edi. Endi do'kon
-- menejeri ham xarajat kiritadi — lekin faqat O'Z KASSASIDAN.
-- Kompaniya balansi (kassa = 'company') rahbarnikiligicha qoladi.
--
-- Qaysi kategoriyani kirita olishi interfeys darajasida cheklanadi
-- (profiles.perms.expenseCategories) — bu ro'yxat rahbar tomonidan
-- qo'yiladi va bazada tekshirilmaydi: u ruxsat emas, ish taqsimoti.
-- Pulga tegadigan chegara esa shu yerda: begona kassaga yozib bo'lmaydi.

-- Menejerning do'koni
create or replace function auth_store_id() returns uuid
  language sql stable security definer set search_path to 'public' as $$
  select store_id from profiles where id = auth.uid()
$$;

drop policy if exists expense_owner on expenses;

create policy expense_read on expenses for select
  using (is_owner() or (is_manager() and kassa = auth_store_id()::text));

create policy expense_write on expenses for all
  using (is_owner() or (is_manager() and kassa = auth_store_id()::text))
  with check (is_owner() or (is_manager() and kassa = auth_store_id()::text));
