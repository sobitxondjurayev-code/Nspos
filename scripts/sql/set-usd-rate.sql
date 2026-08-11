-- ══════════════════════════════════════════════════════════════
-- KURSNI MENEJER HAM YOZA OLSIN
-- ══════════════════════════════════════════════════════════════
-- `companies` jadvalini faqat rahbar o'zgartira oladi (company_update
-- siyosati). Lekin kurs kun davomida o'zgaradi va xarajat kiritayotgan
-- menejer uni darrov to'g'irlashi kerak — aks holda "Bazaga yozilmadi"
-- chiqib, hisob eski kurs bilan qolib ketadi.
--
-- Butun jadvalni menejerga ochish noto'g'ri bo'lardi (u yerda nom,
-- hisob boshlanish sanasi ham bor). Shuning uchun FAQAT kursni
-- yozadigan funksiya: ichida huquq tekshiriladi, tashqarida esa
-- boshqa ustunga tegib bo'lmaydi.
create or replace function set_usd_rate(p_rate numeric, p_source text default 'manual')
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare cid uuid;
begin
  if not is_manager() then
    raise exception 'Kursni faqat menejer yoki rahbar o''zgartira oladi';
  end if;

  cid := auth_company_id();
  if cid is null then
    raise exception 'Kompaniya topilmadi';
  end if;

  if p_rate is null or p_rate <= 0 then
    raise exception 'Kurs 0 dan katta bo''lishi kerak';
  end if;

  update companies
     set usd_rate = p_rate,
         -- Qo'lda yozilgan kurs o'zgartirilgunga qadar turadi
         usd_rate_auto = (p_source = 'cbu'),
         usd_rate_at = now()
   where id = cid;

  insert into usd_rates (company_id, rate, source, created_by)
  values (cid, p_rate, coalesce(p_source, 'manual'), auth.uid());

  return p_rate;
end $$;

grant execute on function set_usd_rate(numeric, text) to authenticated;
