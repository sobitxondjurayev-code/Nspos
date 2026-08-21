-- ══════════════════════════════════════════════════════════════
-- updated_at USTUNI VA TRIGGERI
-- ══════════════════════════════════════════════════════════════
-- Nega kerak (2026-08-22 da aniqlandi):
--
-- Supabase Realtime (WebSocket) o'rniga davriy so'rov yozilgan edi:
-- har 20 soniyada `select updated_at ... order by updated_at desc
-- limit 1`. Lekin 39 jadvaldan 33 tasida bunday USTUN YO'Q — sxema
-- Supabase'dan ko'chirilgan, u yerda ham yo'q edi.
--
-- Natijada PostgREST har so'rovga 400 qaytarardi va `lib/db.js`
-- dagi `catch {}` uni JIM YUTARDI ("tarmoq uzilsa jim o'tamiz").
-- Ya'ni jonli yangilanish umuman ishlamagan va buni hech narsa
-- bildirmagan: bir xodim yozgan yozuvni ikkinchisi sahifani qo'lda
-- yangilamaguncha ko'rmasdi.
--
-- Ustun BARCHA jadvalga qo'shiladi (faqat so'raladigan 20 tasiga
-- emas): keyin yangi jadval qo'shilganda yana esdan chiqmasin.
--
-- Qo'shish XAVFSIZ: mavjud ma'lumot o'zgarmaydi, eski qatorlarda
-- ustun `now()` bilan to'ladi.

create or replace function public.set_updated_at()
returns trigger language plpgsql as $fn$
begin
  new.updated_at = now();
  return new;
end
$fn$;

do $mig$
declare t record; bor boolean;
begin
  for t in
    select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
     order by table_name
  loop
    select exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = t.table_name
         and column_name = 'updated_at'
    ) into bor;

    if not bor then
      execute format(
        'alter table public.%I add column updated_at timestamptz not null default now()',
        t.table_name);
      raise notice 'ustun qo''shildi: %', t.table_name;
    end if;

    -- Trigger har doim qayta yaratiladi — mavjud bo'lsa ham, chunki
    -- funksiya nomi o'zgargan bo'lishi mumkin.
    execute format('drop trigger if exists trg_updated_at on public.%I', t.table_name);
    execute format(
      'create trigger trg_updated_at before update on public.%I
       for each row execute function public.set_updated_at()',
      t.table_name);
  end loop;
end
$mig$;

-- Tez topish uchun: so'rov `order by updated_at desc limit 1` qiladi.
do $idx$
declare t record;
begin
  for t in
    select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
  loop
    execute format(
      'create index if not exists %I on public.%I (updated_at desc)',
      'idx_' || t.table_name || '_updated_at', t.table_name);
  end loop;
end
$idx$;
