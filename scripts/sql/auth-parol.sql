-- ══════════════════════════════════════════════════════════════
-- PAROL ALMASHTIRISH — auth.parol_almashtir(id, parol)
-- ══════════════════════════════════════════════════════════════
-- NEGA BU FAYL (2026-09-02):
-- Funksiya VPS'da 2026-08-24 da qo'lda yaratilgan, lekin repoga
-- tushmagan edi. `app/api/parol/route.js` va `app/api/staff/route.js`
-- uni chaqiradi, `auth-xodim.sql` esa "u `00-shim.sql` da bor" deb
-- yozadi — holbuki `00-shim.sql` da faqat `auth.kirish` bor. Ya'ni
-- server noldan ko'tarilsa parol berish ham, tiklash ham ishlamasdi
-- va buni hech qanday xato ko'rsatmasdi.
--
-- Bu matn serverdagi haqiqiy ta'rifdan olingan
-- (`pg_get_functiondef('auth.parol_almashtir'::regproc)`), o'zgartirilmagan.
--
-- Qo'llash: node scripts/sql.mjs -f scripts/sql/auth-parol.sql
-- Tekshirish: select auth.kirish('<email>', '<parol>') — id qaytsa ishlaydi.
--
-- Parol xeshi bcrypt (`gen_salt('bf')`) — `auth.kirish()` aynan shu
-- xeshni `crypt()` bilan tekshiradi. 6 belgidan qisqa parol rad etiladi
-- (false qaytadi, xato tashlanmaydi — chaqiruvchi o'zi aytadi).
create or replace function auth.parol_almashtir(p_id uuid, p_parol text)
returns boolean
language plpgsql
security definer
set search_path to 'auth', 'public', 'pg_temp'
as $$
begin
  if p_parol is null or length(p_parol) < 6 then
    return false;
  end if;
  update auth.users
     set encrypted_password = crypt(p_parol, gen_salt('bf')),
         updated_at = now()
   where id = p_id and deleted_at is null;
  return found;
end;
$$;

-- Ilova roli faqat chaqira oladi — `auth.users` ga o'zi tegolmaydi.
grant execute on function auth.parol_almashtir(uuid, text) to nspos_app;
