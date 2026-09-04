-- ══════════════════════════════════════════════════════════════
-- USTALAR REYTINGI — usta boshqa ustani ko'rishi uchun (2026-09-03)
-- ══════════════════════════════════════════════════════════════
--   node scripts/sql.mjs -f scripts/sql/usta-reyting.sql
--
-- MUAMMO. Rahbar fidbegi: "ustlar bir-birlarini nechta dona
-- o'rnatganini ko'rishi kerak, va NPS ko'rinishi kerak; qolgan
-- davomat va oyliklar ko'rinmasin". Hozir usta ekranida boshqa
-- ustaning kamerasi 0 turadi. Sabab siyosatda:
--
--   kpi_day_rw          using (… has_perm('kpi.manage') OR staff_id = auth.uid())
--   nps_records_read    using (… is_manager()          OR installer_id = auth.uid())
--
-- `installer` da `kpi.manage = false`, ya'ni RLS unga faqat O'Z
-- qatorini beradi. PostgREST buni XATO bilan emas, BO'SH RO'YXAT
-- bilan bildiradi (CLAUDE.md 2026-08-21) — ekranda ishonarli 0.
--
-- NEGA SIYOSATNI KENGAYTIRMAYMIZ. RLS ustunni yashira olmaydi:
-- `kpi_day` qatori ochilsa `data` ichidagi `olgan` (usta olgan pul)
-- ham ochiladi, `nps_records` ochilsa mijoz ismi va telefoni
-- ochiladi. Shuning uchun `staff_directory` naqshi takrorlanadi
-- (scripts/sql/staff-directory.sql): `security definer` ko'rinish
-- RLS ni chetlab o'tadi, lekin O'ZI kompaniya bo'yicha filtrlaydi va
-- ortiqcha ustunni umuman bermaydi.
--
-- Ya'ni "faqat shtuk va NPS" cheklovi interfeysda emas, BAZADA:
-- usta brauzer konsolidan so'rov yozsa ham oylikni ko'rmaydi.
--
-- Idempotent: `create or replace`.

begin;

-- ── Kamera soni — KUNMA-KUN ────────────────────────────────────
-- Kunma-kun, chunki reytingda davr tanlagichi bor va CLAUDE.md
-- (2026-08-06) hamma ustun tanlangan davr bo'yicha hisoblanishini
-- talab qiladi. Oylik yig'indi ham shu qatorlardan chiqadi —
-- alohida oylik ko'rinish yasalmaydi (bir tushuncha, bitta manba).
--
-- `olgan`, `late`, `dayOff`, `rate` bu yerda YO'Q va bo'lmaydi.
create or replace view installer_cameras
with (security_invoker = false) as
select
  p.id                                        as staff_id,
  p.company_id,
  p.full_name,
  k.date,
  coalesce((k.data->>'cameras')::numeric, 0)  as cameras
from profiles p
join kpi_day k on k.staff_id = p.id
where p.company_id = auth_company_id()
  and p.role = 'installer';

-- ── NPS — faqat O'RTACHA va SONI ───────────────────────────────
-- Mijoz ismi, telefoni, izohi va kim yozgani BERILMAYDI: reytingda
-- ular ko'rinmaydi, ya'ni ko'rinishga ham chiqmasligi kerak.
create or replace view installer_nps
with (security_invoker = false) as
select
  n.installer_id      as staff_id,
  n.company_id,
  n.month,
  avg(n.score)::numeric as nps_avg,
  count(*)              as nps_count
from nps_records n
where n.company_id = auth_company_id()
  and n.score is not null
  and n.installer_id is not null
group by 1, 2, 3;

-- PostgREST `authenticator` dan `nspos_app` ga o'tadi — grant aynan
-- shunga. `authenticated` roli bu bazada YO'Q (Supabase Auth
-- ishlatilmaydi, 2026-08-23 dan).
grant select on installer_cameras, installer_nps to nspos_app;

commit;

-- Yangi ko'rinishlar PostgREST sxemasida ko'rinsin — busiz so'rov
-- 404 qaytaradi va sabab kodda qidiriladi
notify pgrst, 'reload schema';
