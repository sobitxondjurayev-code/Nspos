#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# 3-QADAM: NODE 20 VA POSTGREST
# ══════════════════════════════════════════════════════════════
# PostgREST — Supabase'ning O'ZI ichida ishlatadigan dastur. Bazani
# HTTP orqali ochadi va so'rov yozuvi Supabase bilan AYNAN bir xil:
#
#   /rest/v1/debts?select=*,debt_payments(id,amount)
#
# Shu sababli tanlandi: ilovaning 50 dan ortiq moduli shu yozuvda
# so'rov yozadi. O'z API'mizni yozsak, ularning hammasi qayta
# yozilishi kerak bo'lardi — va aynan o'sha yerda "raqam jimgina
# noto'g'ri" xatosi tug'iladi.
set -euo pipefail

# ── Node 20 ───────────────────────────────────────────────────
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -c2-3)" -lt 20 ]; then
  echo "── Node 20 o'rnatilmoqda"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs
else
  echo "── Node allaqachon bor: $(node -v)"
fi

# ── PostgREST rollari ─────────────────────────────────────────
# PostgREST `authenticator` bo'lib ulanadi, so'ng so'rovga qarab
# boshqa rolga O'TADI (SET ROLE). Shuning uchun u NOINHERIT:
# o'zida hech qanday huquq bo'lmasin, faqat o'tish huquqi bo'lsin.
#
# Kirmagan foydalanuvchi ham `nspos_app` roliga tushadi — lekin
# `auth.uid()` NULL bo'lgani uchun RLS unga hech narsa ko'rsatmaydi
# (sinaldi: 0 sotuv, 0 xarajat, 0 xodim). Ya'ni alohida "anon" roli
# kerak emas, himoya bitta joyda — siyosatlarda.
PGRST_PASS=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -hex 32)

su - postgres -c "psql -d nspos -v ON_ERROR_STOP=1 -q" <<SQL
do \$\$ begin
  if not exists (select 1 from pg_roles where rolname='authenticator') then
    create role authenticator login noinherit;
  end if;
end \$\$;
alter role authenticator with password '${PGRST_PASS}';
grant nspos_app to authenticator;
SQL

# ── PostgREST ─────────────────────────────────────────────────
if [ ! -x /usr/local/bin/postgrest ]; then
  echo "── PostgREST yuklanmoqda"
  URL=$(curl -s https://api.github.com/repos/PostgREST/postgrest/releases/latest \
    | grep -o 'https://[^"]*linux-static-x86-64\.tar\.xz' | head -1)
  curl -fsSL "$URL" -o /tmp/pgrst.tar.xz
  tar -xJf /tmp/pgrst.tar.xz -C /usr/local/bin postgrest
  chmod +x /usr/local/bin/postgrest
  rm -f /tmp/pgrst.tar.xz
fi
echo "── PostgREST: $(/usr/local/bin/postgrest --version 2>&1 | head -1)"

# ── Xizmat foydalanuvchisi ────────────────────────────────────
# PostgREST va ilova ALOHIDA tizim foydalanuvchisi ostida ishlaydi.
#
# Ilgari xizmat postgres foydalanuvchisi ostida yozilgan edi va
# ishga tushmadi:
# sozlama fayli root'niki va `600` bo'lgani uchun postgres uni
# o'qiy olmadi. Lekin haqiqiy sabab chuqurroq — PostgREST'ni baza
# superfoydalanuvchisi ostida yurgizish umuman to'g'ri emas: agar u
# buzilsa, hujumchi darrov butun bazaga ega bo'ladi.
id -u nspos >/dev/null 2>&1 || useradd --system --home /opt/nspos --shell /usr/sbin/nologin nspos

mkdir -p /etc/nspos
cat > /etc/nspos/postgrest.conf <<CONF
db-uri = "postgres://authenticator:${PGRST_PASS}@localhost:5432/nspos"
db-schemas = "public"
db-anon-role = "nspos_app"

# Faqat SHU SERVERDAN. Tashqariga Nginx chiqaradi — u yerda
# HTTPS va cheklovlar bor.
server-host = "127.0.0.1"
server-port = 3001

jwt-secret = "${JWT_SECRET}"
# Sir qisqa bo'lsa PostgREST ishga tushmaydi (32 belgidan kam)
jwt-aud = "authenticated"

# Bir so'rovda qaytadigan eng ko'p qator. Chegara bo'lmasa bitta
# so'rov 34 000 qator tortib, xotirani yeb qo'yishi mumkin.
max-rows = 10000
db-pool = 10
CONF
chown nspos:nspos /etc/nspos/postgrest.conf
chmod 600 /etc/nspos/postgrest.conf

# Sirlarni ilova ham o'qiy olsin (faqat root)
cat > /etc/nspos/sirlar.env <<ENV
JWT_SECRET=${JWT_SECRET}
DATABASE_URL=postgres://nspos_app@localhost:5432/nspos
ENV
chown nspos:nspos /etc/nspos/sirlar.env
chmod 600 /etc/nspos/sirlar.env

cat > /etc/systemd/system/postgrest.service <<'UNIT'
[Unit]
Description=PostgREST — bazani HTTP orqali ochadi
After=postgresql.service
Requires=postgresql.service

[Service]
ExecStart=/usr/local/bin/postgrest /etc/nspos/postgrest.conf
Restart=always
RestartSec=3
User=nspos
Group=nspos

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable -q postgrest
systemctl restart postgrest
sleep 3

echo
echo "✓ 3-qadam tugadi"
echo "  Node:      $(node -v)"
KOD=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:3001/ || echo 000)
echo "  PostgREST: $(systemctl is-active postgrest) · javob HTTP $KOD"
# `systemctl is-active` "activating (auto-restart)" holatida ham
# "active" deydi — ya'ni xizmat qayta-qayta yiqilayotgan bo'lsa ham
# yashil ko'rinadi. Shuning uchun HAQIQIY javob tekshiriladi.
if [ "$KOD" = "000" ]; then
  echo "!! PostgREST javob bermayapti. Jurnal:"
  journalctl -u postgrest -n 5 --no-pager | sed "s/^/   /"
  exit 1
fi
