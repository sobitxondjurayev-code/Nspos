-- ══════════════════════════════════════════════════════════════
-- XARAJAT TURI "TANNARXGA KIRADI" (`cogs`) + ikki yangi tur (2026-09-05)
-- ══════════════════════════════════════════════════════════════
--   node scripts/sql.mjs -f scripts/sql/expense-cogs.sql
--
-- Menejerlar so'radi: "tovar keldi — yo'lkira, dostavka" xarajati
-- Xarajatlarda bo'lsin, LEKIN u tovar TANNARXIGA qo'shilsin. Mantiq:
-- mahsulot 25 $ ga olinadi, kelib qo'yilganda 30 $ turadi — ya'ni bu
-- pul "ijara" kabi umumiy xarajat emas, o'sha tovarning narxi.
--
-- Yechim: xarajat TURIGA uchinchi bayroq. Ilgari ikkitasi bor edi —
-- `group` (doimiy/o'zgaruvchan) va `service` (servis xarajatimi).
-- `cogs = true` bo'lgan tur P&L da OPEX dan CHIQADI va tannarx ostida
-- alohida qator bo'ladi. Sof foyda O'ZGARMAYDI (pul bir qatordan
-- ikkinchisiga ko'chadi), yalpi marja esa haqiqiy bo'ladi.
--
-- Nega tur darajasida, xarajat QATORI darajasida emas: tur allaqachon
-- rahbar Sozlamalardan yuritadigan yagona manba. Qatorga qo'yilsa
-- menejer har safar belgilashni unutadi va bir xil xarajat ikki xil
-- joyga tushadi.
--
-- `cogs` va `service` BIR VAQTDA bo'la olmaydi: `service` turlarini
-- `components/ServiceReport.jsx` servis materiali deb yig'adi, P&L esa
-- tannarx deb ayiradi — bir pul ikki marta sanalardi. Cheklov bazada,
-- ikkinchi qulf `lib/audit.js` → `kelish-service`.
begin;

alter table expense_categories
  add column if not exists cogs boolean not null default false;

comment on column expense_categories.cogs is
  'Tovar kelish xarajati: OPEX emas, tannarxga qo''shiladi (P&L: tannarx ostida alohida qator)';

-- `add constraint` uchun `if not exists` yo'q — mavjudligini o'zimiz tekshiramiz
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'expcat_cogs_service') then
    alter table expense_categories
      add constraint expcat_cogs_service check (not (cogs and service));
  end if;
end $$;

-- ── Mavjud "Dastavka yo'lkira" — aslida tovar kelish xarajati ──
-- 2026-09-05 da o'lchandi: avgustda 62 yozuv / 228.70 $, izohlari
-- "tavar keldi", "kelgan tovarga", "labo ga yul kira", "quqondan",
-- "vint toshkent" — hammasi tovar kelishi. Kalit O'ZGARMAYDI
-- (`delivery`), aks holda eski 62 yozuv nomsiz qolardi.
--
-- `staff_travel` ("Xodimlarga yo'lkira") ATAYLAB tegilmadi: uning
-- izohlari "uyiga yul kira", "ishka bordi" — xodim qatnovi, tovarga
-- aloqasi yo'q. Tannarxga qo'shilsa marja soxta pasayardi.
update expense_categories
   set cogs = true,
       label = 'Dastavka — tovar kelishi (yo''lkira)',
       updated_at = now()
 where key = 'delivery';

-- ── Yangi turlar ──────────────────────────────────────────────
-- `import_freight` — chegara/Xitoy yo'lkirasi (rahbar misolidagi
--   "25 $ olinadi, 30 $ bo'lib keladi" qismi).
-- `svc_installer*` — ko'chadan yollanadigan usta. Ikki tur, chunki
--   rahbar ikki holatni ajratdi: mijoz montaj puli to'lagan yoki
--   montaj bepul berilgan. Ikkalasi ham `service` — puli servis
--   hamyonidan chiqadi va "Servis foydasi"da ko'rinadi.
--   Izoh majburiy: qaysi ish uchun ekani yozilsin.
insert into expense_categories (company_id, key, label, "group", service, cogs, note_required, sort, is_active)
select c.id, v.key, v.label, v.grp, v.service, v.cogs, v.note_required, v.sort, true
from companies c
cross join (values
  ('import_freight',     'Import yo''lkira (chegara, Xitoy)',            'variable', false, true,  true,  105),
  ('svc_installer',      'Ko''cha ustasi — o''rnatish (mijoz to''lagan)', 'variable', true,  false, true,  240),
  ('svc_installer_free', 'Ko''cha ustasi — o''rnatish (bepul montaj)',    'variable', true,  false, true,  250)
) as v(key, label, grp, service, cogs, note_required, sort)
on conflict (company_id, key) do nothing;

commit;

-- Busiz PostgREST yangi ustunni ko'rmaydi va ilova `cogs` ni o'qiy olmaydi
notify pgrst, 'reload schema';
