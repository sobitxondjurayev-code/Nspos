-- ══════════════════════════════════════════════════════════════
-- BILLZ API SINXRONIZATSIYASI — jadval tayyorgarligi
-- ══════════════════════════════════════════════════════════════
-- Bugungacha Billz ma'lumoti QO'LDA Excel orqali kelardi va har
-- yuklashda yozuvlar nom/shtrix-kod bo'yicha taxminan solishtirilardi.
-- API bilan har yozuvning O'ZINING id'si bor — shuni saqlaymiz.
-- Busiz har sinxronizatsiya dublikat yasaydi: 652 tovar 1304 bo'lib
-- ketadi, chunki `sales_no_unique` cheklovi `where not imported`, ya'ni
-- Billz'dan kelgan cheklarga umuman qo'llanmaydi (schema.sql:205).
--
-- Ishga tushirish:
--   node scripts/sql.mjs -f scripts/sql/billz-sync.sql

-- ─────────────────────────────────────────────────────────────
-- 1. Tashqi id ustunlari
-- ─────────────────────────────────────────────────────────────
alter table products   add column if not exists billz_id uuid;
alter table customers  add column if not exists billz_id uuid;
alter table sales      add column if not exists billz_id uuid;
alter table categories add column if not exists billz_id uuid;
alter table suppliers  add column if not exists billz_id uuid;

-- Chek qatorida tovar topilmay qolishi mumkin (o'chirilgan tovar).
-- Shunda `product_id` bo'sh qolmaydi — Billz id'si yozib qo'yiladi va
-- keyingi sinxronizatsiyada bog'lanadi.
alter table sale_items add column if not exists billz_product_id uuid;

-- Chek qatori ham idempotent bo'lishi kerak: bitta chek ikki marta
-- tortilsa qatorlar ikkilanmasin.
alter table sale_items add column if not exists billz_id uuid;

-- Qaysi kassir sotgani Billz'da o'z foydalanuvchisi bilan keladi.
-- `profiles` bilan bog'lanmagunicha shu ustunda turadi.
alter table sales add column if not exists billz_user_id uuid;
alter table sales add column if not exists billz_user_name text;

-- ─────────────────────────────────────────────────────────────
-- 2. Takrorlanmaslik
-- ─────────────────────────────────────────────────────────────
-- Indeks SHARTSIZ (`where ...` YO'Q) — ataylab. Ikki sabab:
--   1. Postgres'da NULL'lar bir-biriga teng emas, ya'ni billz_id'siz
--      (NSPOS'ning o'zida yaratilgan) yozuvlar xohlagancha bo'lishi
--      mumkin — cheklov ularga baribir tegmaydi.
--   2. Shartli indeksga `on conflict (a, b)` ILINMAYDI: Postgres bir xil
--      shartni so'raydi, PostgREST esa uni yubora olmaydi. Sinxronizatsiya
--      to'liq `upsert` ga qurilgan, shuning uchun indeks shartsiz bo'lishi
--      SHART — aks holda har yozuvda
--      "no unique or exclusion constraint matching the ON CONFLICT" chiqadi.
create unique index if not exists products_billz_uniq   on products   (company_id, billz_id);
create unique index if not exists customers_billz_uniq  on customers  (company_id, billz_id);
create unique index if not exists sales_billz_uniq      on sales      (company_id, billz_id);
create unique index if not exists categories_billz_uniq on categories (company_id, billz_id);
create unique index if not exists suppliers_billz_uniq  on suppliers  (company_id, billz_id);
create unique index if not exists sale_items_billz_uniq on sale_items (sale_id, billz_id);

-- Bog'lash bosqichi shtrix-kod va telefon bo'yicha qidiradi
create index if not exists products_barcode_idx  on products (company_id, barcode);
create index if not exists customers_phone_idx   on customers (company_id, phone);

-- ─────────────────────────────────────────────────────────────
-- 3. Sinxronizatsiya jurnali
-- ─────────────────────────────────────────────────────────────
-- Ikki vazifasi bor:
--   • KURSOR — keyingi safar qayerdan davom etishni bilish uchun
--     (`cursor_at` -> Billz `last_updated_date`). Busiz har safar
--     652 tovar va 7 779 chek qaytadan tortilardi.
--   • JURNAL — "oxirgi marta qachon yangilandi, nechta keldi, xato
--     bormi". Sozlamalar sahifasida shu ko'rsatiladi.
create table if not exists billz_sync_log (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade default auth_company_id(),
  entity       text not null,          -- categories | suppliers | products | customers | orders | sale_items
  mode         text not null default 'incremental',   -- incremental | full | link
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  -- Muvaffaqiyatli tugagandagina yoziladi: xato bo'lsa kursor
  -- surilmaydi va keyingi urinish o'sha joydan qayta boshlaydi.
  cursor_at    timestamptz,
  fetched      int not null default 0,
  inserted     int not null default 0,
  updated      int not null default 0,
  skipped      int not null default 0,
  error        text
);

create index if not exists billz_sync_log_entity_idx
  on billz_sync_log (company_id, entity, started_at desc);

alter table billz_sync_log enable row level security;

-- O'qish: rahbar va menejer (Sozlamalarda "oxirgi yangilanish" ko'rinadi).
-- Yozish siyosati YO'Q — jurnalni faqat server (service key) yozadi,
-- u RLS ni chetlab o'tadi. Brauzerdan soxta yozuv kiritib bo'lmaydi.
drop policy if exists billz_sync_log_read on billz_sync_log;
create policy billz_sync_log_read on billz_sync_log for select
  using (is_manager() and company_id = auth_company_id());

-- ─────────────────────────────────────────────────────────────
-- 4. Mavjud yozuvlarni Billz id'siga bog'lash uchun ko'rinish
-- ─────────────────────────────────────────────────────────────
-- Excel'dan kelgan 407 tovar va 6 800 mijozda billz_id yo'q. Ular
-- bog'lanmasa birinchi sinxronizatsiya ularni YANGI deb qo'shadi va
-- katalog ikkilanadi. Bog'lash skriptda (shtrix-kod / telefon bo'yicha)
-- bajariladi; bu ko'rinish esa "nechtasi bog'lanmay qoldi" degan
-- savolga javob beradi va `lib/audit.js` shundan o'qiydi.
create or replace view v_billz_unlinked as
  select 'products'::text  as entity, count(*)::bigint as n from products  where billz_id is null
  union all
  select 'customers',       count(*) from customers where billz_id is null
  union all
  select 'sales',           count(*) from sales     where billz_id is null and imported
  union all
  -- Chek bor, lekin ichida tovar yo'q — asosiy teshik shu edi
  select 'sales_no_items',  count(*) from sales s
    where not exists (select 1 from sale_items i where i.sale_id = s.id);

-- ─────────────────────────────────────────────────────────────
-- 5. Billz beradigan, lekin NSPOS'da joyi yo'q maydonlar
-- ─────────────────────────────────────────────────────────────
-- Maqsad — Billz'dagi HAMMA narsa NSPOS'da ham tursin. Quyidagilar
-- API javobida bor edi-yu, hech qayerga yozilmasdan tashlanardi.

-- O'lchov birligi. NScamera kabelni METRLAB sotadi, kamerani DONALAB —
-- birliksiz "2 790" raqami nimani bildirishi noma'lum bo'lib qoladi.
alter table products add column if not exists unit text;
-- Billz kartochkasidagi tavsif
alter table products add column if not exists description text;
-- Variantli tovar (rang/o'lcham) — NSPOS hozir ishlatmaydi, lekin
-- yo'qolib ketmasin
alter table products add column if not exists is_variative boolean not null default false;

-- Mijozning Billz'dagi raqami: Billz UI'da odam aynan shu raqam bilan
-- qidiriladi, ya'ni "bu kim?" degan savolga javob shu yerda.
alter table customers add column if not exists billz_external_id text;
-- Birinchi va oxirgi xarid sanasi. "Qaytib kelmagan mijozlar" tahlili
-- (Billz'da 2 353 ta) aynan shu ikki sanadan chiqadi.
alter table customers add column if not exists first_purchase_at timestamptz;
alter table customers add column if not exists last_purchase_at timestamptz;

create index if not exists customers_last_purchase_idx
  on customers (company_id, last_purchase_at desc nulls last);
