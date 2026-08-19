-- ══════════════════════════════════════════════════════════════
-- TO'LOV REJASI — rahbar o'zi belgilaydigan kelgusi to'lovlar
-- ══════════════════════════════════════════════════════════════
-- Rahbarning daftaridagi ro'yxatning bazadagi ko'rinishi: kimga,
-- qancha va qachon berish kerak. Bu hali PUL HARAKATI EMAS — reja.
-- Shuning uchun balansdan hech narsa ayirmaydi.
--
-- "To'landi" bosilganda kassa_ops ga chiqim yoziladi va uning id'si
-- shu yerga qaytib tushadi (op_id). Balans faqat o'shanda kamayadi —
-- ya'ni pul bir marta, faqat haqiqatda chiqqanda hisoblanadi.
--
-- Summa dollarda saqlanadi (butun hisob shunda), lekin kiritilgan
-- so'm va o'sha kundagi kurs ham yoziladi — xarajatlar bilan bir xil
-- uslub: keyin kurs o'zgarsa ham eski yozuv o'zgarmaydi.
create table if not exists payouts (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade default auth_company_id(),
  -- Kimga: odam, yetkazib beruvchi, bank yoki shunchaki maqsad
  title       text not null,
  amount      numeric(14,2) not null check (amount > 0),
  amount_som  numeric(16,2),
  rate_used   numeric(14,2),
  due_date    date not null,
  -- Qaysi kassadan va qaysi hamyondan chiqishi rejalashtirilgan
  kassa       text not null default 'company',
  wallet      text not null default 'cash' check (wallet in ('cash', 'payme', 'service')),
  category    text not null default 'other_out',
  note        text,
  status      text not null default 'planned' check (status in ('planned', 'paid')),
  paid_at     timestamptz,
  -- To'langanda yaratilgan kassa yozuvi. Reja bekor qilinsa yoki
  -- yozuv o'chirilsa, o'sha chiqimni topib o'chirish uchun kerak.
  op_id       uuid references kassa_ops(id) on delete set null,
  created_by  uuid references profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

alter table payouts drop constraint if exists payouts_kassa_check;
alter table payouts add constraint payouts_kassa_check check (
  kassa = 'company' or kassa ~ '^[0-9a-f-]{36}$' or kassa ~ '^s[0-9]+$'
);

-- To'langan yozuvda sana bo'lishi shart: "to'landi, lekin qachonligi
-- noma'lum" degan holat hisobotni buzadi.
alter table payouts drop constraint if exists payouts_paid_at_check;
alter table payouts add constraint payouts_paid_at_check check (
  (status = 'paid' and paid_at is not null) or (status <> 'paid' and paid_at is null)
);

create index if not exists payouts_due_idx on payouts (due_date);
create index if not exists payouts_open_idx on payouts (status, due_date) where status = 'planned';

alter table payouts enable row level security;

-- Faqat rahbar. Bu uning shaxsiy to'lov rejasi — kimga qancha berishini
-- menejer ham, kassir ham ko'rmasligi kerak.
drop policy if exists payouts_rw on payouts;
create policy payouts_rw on payouts for all
  using (is_owner() and company_id = auth_company_id())
  with check (is_owner() and company_id = auth_company_id());
