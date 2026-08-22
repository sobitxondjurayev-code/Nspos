#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# ICHKI MANZIL — server o'zi uchun (127.0.0.1:8081)
# ══════════════════════════════════════════════════════════════
# Uchta server marshruti (`/api/staff`, `/api/backup`,
# `/api/billz/sync`) bazaga PostgREST orqali boradi. Ular
# serverning O'ZIDA ishlaydi, ya'ni tashqi domen va TLS orqali
# aylanib borishi keraksiz — sekin, va DNS yoki sertifikat buzilsa
# Billz sinxronizatsiyasi ham to'xtaydi.
#
# NEGA TO'G'RIDAN-TO'G'RI :3001 BO'LMAYDI:
# `@supabase/supabase-js` manzilga har doim `/rest/v1/` qo'shadi,
# PostgREST esa jadvallarni ILDIZDA beradi (`/companies`). Ochiq
# yo'lda bu farqni nginx yopadi (`location /rest/v1/` →
# `proxy_pass .../`). Ichki manzil uchun ham AYNAN o'sha xarita
# kerak — busiz "Invalid path specified in request URL" chiqadi
# (2026-08-22 da shunday bo'ldi).
#
# Bu tinglovchi FAQAT loopback'da: tashqaridan unga ulanib
# bo'lmaydi, ufw'da port ochilmaydi.
set -euo pipefail

cat > /etc/nginx/sites-available/nspos-ichki <<'ICHI'
server {
    # Faqat serverning o'zi uchun — tashqaridan ko'rinmaydi
    listen 127.0.0.1:8081;
    server_name _;

    location /rest/v1/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_pass_header Content-Range;
    }
}
ICHI
ln -sf /etc/nginx/sites-available/nspos-ichki /etc/nginx/sites-enabled/nspos-ichki

if ! nginx -t 2>&1; then
  rm -f /etc/nginx/sites-enabled/nspos-ichki
  echo "✗ nginx qabul qilmadi — o'zgarish bekor qilindi"
  exit 1
fi
systemctl reload nginx

# Ilova sozlamasi
sed -i "s#^NSPOS_REST_INTERNAL=.*#NSPOS_REST_INTERNAL=http://127.0.0.1:8081#" /opt/nspos/app/.env.production
grep -q "^NSPOS_REST_INTERNAL=" /opt/nspos/app/.env.production \
  || echo "NSPOS_REST_INTERNAL=http://127.0.0.1:8081" >> /opt/nspos/app/.env.production

echo "✓ ichki manzil: http://127.0.0.1:8081"
grep "^NSPOS_REST_INTERNAL=" /opt/nspos/app/.env.production
