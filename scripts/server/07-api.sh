#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# NSPOS API — FAQAT O'QISH
# ══════════════════════════════════════════════════════════════
# Alohida Node xizmati (port 3002), Nginx uni /api/v1/ da chiqaradi.
#
# NEGA NEXT.JS ICHIDA EMAS:
# API ekrandagi raqamni chiqaradigan AYNAN o'sha funksiyalarni
# chaqirishi shart (`profitAndLoss`, `arAging`, `rfm`…). Ular esa
# "use client" modullari — Next server marshrutidan ularni chaqirib
# bo'lmaydi, u ularni mijoz komponenti deb qaraydi.
#
# Node uchun "use client" — oddiy satr. Shuning uchun API alohida
# jarayon bo'lib, tekshiruv skripti (`npm run tekshir`) bilan AYNAN
# bir xil yo'ldan modullarni to'ldiradi. Ya'ni sayt, tekshiruv va
# API — uchtasi bitta formulaga tayanadi.
set -euo pipefail

YOL=/opt/nspos/app
ENVF=/opt/nspos/api.env

# Token bo'lmasa yaratamiz (bir marta)
if [ ! -f "$ENVF" ]; then
  echo "NSPOS_API_TOKEN=$(openssl rand -hex 24)" > "$ENVF"
  echo "NSPOS_PG=postgres:///nspos" >> "$ENVF"
  echo "NSPOS_API_PORT=3002" >> "$ENVF"
  echo "NSPOS_API_TTL=300000" >> "$ENVF"
  chmod 600 "$ENVF"
  chown nspos:nspos "$ENVF"
fi

cat > /etc/systemd/system/nspos-api.service <<'ICHI'
[Unit]
Description=NSPOS API (faqat o'qish)
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=nspos
WorkingDirectory=/opt/nspos/app
EnvironmentFile=/opt/nspos/api.env
ExecStart=/usr/bin/node --import ./scripts/lib/register.mjs --no-warnings scripts/api/server.mjs
Restart=always
RestartSec=5
# API hech narsa yozmaydi — fayl tizimi ham faqat o'qish uchun
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
ICHI

# ── BAZA FOYDALANUVCHISI ──────────────────────────────────────
# API `nspos` sifatida ulanadi. Ikki qat'iy chegara:
#
#   FAQAT SELECT — insert/update/delete umuman berilmaydi. Token
#   o'g'irlansa ham bazaga hech narsa yozib bo'lmaydi.
#
#   BYPASSRLS — API RAHBAR darajasida o'qiydi. Bu ataylab: API
#   "shu oyda qancha foyda" degan savolga javob beradi, ya'ni butun
#   kompaniyani ko'rishi kerak. RLS ostida qolsa u 0 sotuv ko'radi
#   (sinaldi) — chunki `auth.uid()` yo'q, hech kim kirmagan.
#
# Ya'ni API tokeni = rahbarning O'QISH huquqi. Uni xodimga bermang.
# Token faqat serverda: /opt/nspos/api.env, 600, nspos:nspos.
sudo -u postgres psql -q -d nspos <<'ICHI'
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'nspos') then
    create role nspos login;
  end if;
end $$;
alter role nspos bypassrls;
grant connect on database nspos to nspos;
grant usage on schema public to nspos;
grant usage on schema auth to nspos;
grant select on all tables in schema public to nspos;
alter default privileges in schema public grant select on tables to nspos;
revoke insert, update, delete, truncate on all tables in schema public from nspos;
ICHI

systemctl daemon-reload
systemctl enable --now nspos-api
sleep 3
systemctl is-active nspos-api

# HAQIQIY so'rov — `is-active` qayta-qayta o'chib yonayotgan xizmatni
# ham "active" deb ko'rsatadi.
kod=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "http://127.0.0.1:3002/api/v1")
echo "katalog: $kod"
[ "$kod" = "200" ] || { journalctl -u nspos-api -n 20 --no-pager; exit 1; }

# Nginx
if ! grep -q "location /api/v1" /etc/nginx/sites-available/nspos; then
  sed -i 's#location /rest/v1/ {#location ^~ /api/v1 {\n        proxy_pass http://127.0.0.1:3002;\n        proxy_set_header Host $host;\n        proxy_set_header Authorization $http_authorization;\n        proxy_read_timeout 120s;\n    }\n\n    location /rest/v1/ {#' /etc/nginx/sites-available/nspos
  nginx -t && systemctl reload nginx
fi

echo "✓ API tayyor"
echo "  token: $(grep NSPOS_API_TOKEN "$ENVF" | cut -d= -f2)"
