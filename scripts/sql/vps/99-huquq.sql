-- ══════════════════════════════════════════════════════════════
-- HUQUQLAR — sxema qurilgandan KEYIN yuriladi
-- ══════════════════════════════════════════════════════════════
-- 00-shim.sql dagi `alter default privileges` faqat KEYIN
-- yaratiladigan jadvallarga tegishli. Sxema o'sha faylda hali
-- qurilmagan edi, shuning uchun mavjud jadvallarga huquq shu yerda
-- beriladi.
grant select, insert, update, delete on all tables in schema public to nspos_app;
grant select, insert, update, delete on all tables in schema public to nspos_sync;
grant usage, select on all sequences in schema public to nspos_app, nspos_sync;
grant execute on all functions in schema public to nspos_app, nspos_sync;

-- Ilova jadval egasi BO'LMASLIGI kerak — aks holda RLS unga
-- qo'llanmaydi va butun himoya jimgina o'chadi.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I owner to nspos_owner', t.tablename);
  end loop;
end $$;
