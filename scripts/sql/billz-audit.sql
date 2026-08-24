-- ══════════════════════════════════════════════════════════════
-- BILLZ SINXRONIZATSIYASI — JIM YO'QOLAYOTGANINI YOZIB BORISH
-- ══════════════════════════════════════════════════════════════
-- Moliyaviy audit natijasi (2026-08-24). Sinxronizatsiya to'g'ri
-- ishlayotgan edi, lekin TO'RT joyda ma'lumot XATO BERMASDAN
-- yo'qolardi — ya'ni jurnalda "OK", ekranda esa kam raqam. Bu aynan
-- `end_date` tuzog'i bilan bir xil kasal (DAFTAR 10.3): so'rov
-- muvaffaqiyatli, javob to'g'ri ko'rinadi, ma'lumot esa kam.
--
--   1. TANILMAGAN TO'LOV TURI. `billzMap.splitPayments()` "Наличные",
--      "Payme", "карта", "долг" ni taniydi. Billz'da yangi tur
--      ochilsa (masalan "Перечисление") u `unknown` ga tushadi va
--      `saleRow` uni HECH QAYERGA yozmasdi: chek summasi joyida,
--      to'lovlar yig'indisi esa kam. Farqni ko'rsatadigan ustun ham,
--      tekshiruv ham yo'q edi.
--   2. DO'KONI TANILMAGAN CHEK. Billz'da do'kon qayta nomlansa
--      `matchStores()` uni topolmaydi va o'sha do'konning HAMMA cheki
--      jimgina tashlanadi (`stat.noStore`). Jurnalda ko'rinmasdi.
--   3. CHALA TORTISH. Bir chaqiriqda 300 chek chegarasi yoki 280 s
--      muddat tugasa `exhausted:false` bo'ladi — "yana qoldi" degani.
--      Bu ham jurnalga yozilmasdi: har yurish chala tugayversa
--      orqada qolish o'sib boraverardi va hech kim bilmasdi.
--   4. NASIYA TO'LOVINING USULI. Tanilmagani `cash` bo'lib yozilardi
--      (kod tomonida tuzatildi) — endi `unknown` bo'ladi va shu
--      migratsiyadan keyin ogohlantirishda sanaladi.
--
-- Hech narsa o'chirilmaydi va qayta yozilmaydi — faqat yangi ustun,
-- yangi ko'rinish va bir martalik `is_service` belgisi.
--
-- Ishga tushirish:
--   node scripts/sql.mjs -f scripts/sql/billz-audit.sql

-- ─────────────────────────────────────────────────────────────
-- 1. Chekdagi tanilmagan to'lov summasi
-- ─────────────────────────────────────────────────────────────
-- Nega alohida ustun, nega `cash` ga qo'shilmaydi: noto'g'ri hamyonga
-- yozilgan pul — yo'qolgan puldan YOMONROQ. Kassa solishtiruvida u
-- "menejer naqdni kam yozibdi" bo'lib chiqadi va aybi odamga tushadi.
-- Alohida ustunda esa u ko'rinib turadi va yig'indi tekshiruvi
-- (`moslik.js` → `tolov-taqsimot`) chek summasiga TENG chiqadi.
alter table sales add column if not exists unknown_paid numeric(12,2) not null default 0;

-- ─────────────────────────────────────────────────────────────
-- 2. Jurnal: nima tashlab ketilgani
-- ─────────────────────────────────────────────────────────────
-- Jurnal ORTIQCHA aytmasligi kerak (DAFTAR 10.4), lekin KAM aytishi
-- ham shunday xavfli: "34 ta chek qo'shildi" degan qator 101 ta chek
-- tashlanганини yashirgan edi.
alter table billz_sync_log add column if not exists no_store  int not null default 0;
alter table billz_sync_log add column if not exists exhausted boolean;
-- Tafsilot JSONB da: { unknownPayments: {"Перечисление": 120.5},
--                      unmatchedShops: ["NScamera Chilonzor"] }
-- Ustun emas, chunki tur oldindan noma'lum — Billz nima nom qo'ysa
-- o'sha keladi va uni saqlash uchun sxema o'zgartirib o'tirilmaydi.
alter table billz_sync_log add column if not exists warnings  jsonb;

-- ─────────────────────────────────────────────────────────────
-- 3. Brauzer uchun ko'rinish: har bosqichning OXIRGI yurishi
-- ─────────────────────────────────────────────────────────────
-- Ogohlantirishlar (`lib/audit.js`) faqat oxirgi holatni so'raydi.
-- Butun jurnalni brauzerga tashish shart emas — u har 30 daqiqada
-- 6 qatordan o'sib boradi.
--
-- ── security_invoker MAJBURIY ──
-- Ko'rinish egasi superuser. Busiz `billz_sync_log` ustidagi RLS
-- umuman ishlamaydi va jurnal har kimga ochilib ketardi
-- (`debts-faol-view.sql` dagi bilan bir xil sabab).
create or replace view v_billz_sync_oxirgi
with (security_invoker = true) as
select distinct on (entity) *
  from billz_sync_log
 order by entity, started_at desc;

grant select on v_billz_sync_oxirgi to nspos_app;
grant select on v_billz_sync_oxirgi to nspos;

-- ─────────────────────────────────────────────────────────────
-- 4. Montaj — servis tovari belgisi
-- ─────────────────────────────────────────────────────────────
-- `products.is_service` ustuni bor edi (schema.sql), lekin Billz
-- sinxronizatsiyasi uni HECH QACHON yozmagan. Oqibati: montaj oddiy
-- tovar bo'lib kirdi va qoldig'i −18 567 donaga tushdi. Hisobotlar uni
-- "manfiy qoldiq" evristikasi bilan chetlab o'tardi — ya'ni aynan shu
-- ustun uchun yaratilgan holat qo'lda, to'rt joyda qayta yozilgan.
--
-- Bundan keyin sinxronizatsiya o'zi yozadi (`billzMap.productRow`).
-- Bu yerda esa MAVJUD tovarlar bir marta belgilanadi.
--
-- Faqat UPDATE — hech narsa o'chirilmaydi, qoldiq qatorlariga
-- tegilmaydi (Billz'da nima bo'lsa NSPOS'da ham o'sha tursin).
-- `and not is_service` bo'lgani uchun qayta-qayta yurgizsa bo'ladi.
update products p
   set is_service = true
  from companies c
 where c.id = p.company_id
   and not p.is_service
   and exists (
     select 1
       from unnest(string_to_array(lower(coalesce(nullif(trim(c.service_names), ''), 'montaj')), ',')) as k
      where trim(k) <> ''
        and lower(p.name) like '%' || trim(k) || '%'
   );

notify pgrst, 'reload schema';
