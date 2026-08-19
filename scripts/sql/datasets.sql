-- ══════════════════════════════════════════════════════════════
-- YUKLANGAN HISOBOTLAR (Billz eksportlari)
-- ══════════════════════════════════════════════════════════════
-- Bu ikki jadval yo'q edi: shu sabab yuklangan fayl faqat yuklagan
-- odamning brauzerida (IndexedDB) qolib ketardi. Boshqa xodim o'z
-- qurilmasida ochsa — hisobot bo'sh ko'rinardi.
--
-- Qatorlar alohida jadvalda, 1000 tadan bo'lib saqlanadi: bitta ДДС
-- eksportida 8000 dan ortiq qator bo'ladi va ular bitta yozuvga
-- sig'masligi mumkin. Ro'yxat esa qatorlarsiz o'qiladi — ilova tez
-- ochilsin, qatorlar faqat hisobot ochilganda tortilsin.
create table if not exists datasets (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  report_id     text,
  report_label  text,
  file_name     text,
  sheet_name    text,
  header        jsonb not null default '[]'::jsonb,
  profile       jsonb,
  row_count     integer not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists dataset_chunks (
  id          bigserial primary key,
  dataset_id  uuid not null references datasets(id) on delete cascade,
  seq         integer not null,
  rows        jsonb not null,
  unique (dataset_id, seq)
);

create index if not exists datasets_report_idx on datasets (report_id, created_at desc);
create index if not exists dataset_chunks_ds_idx on dataset_chunks (dataset_id, seq);

alter table datasets enable row level security;
alter table dataset_chunks enable row level security;

-- Hisobotlarni rahbar va menejerlar ko'radi va yuklaydi.
-- Kassir/omborchi/usta uchun yopiq: bu butun kompaniyaning savdo va
-- pul ma'lumoti.
drop policy if exists datasets_rw on datasets;
create policy datasets_rw on datasets for all
  using (is_manager()) with check (is_manager());

drop policy if exists dataset_chunks_rw on dataset_chunks;
create policy dataset_chunks_rw on dataset_chunks for all
  using (is_manager()) with check (is_manager());
