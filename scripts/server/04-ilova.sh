#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# 4-QADAM: ILOVA (Next.js) VA NGINX
# ══════════════════════════════════════════════════════════════
set -euo pipefail

DOMEN="${1:-}"          # bo'sh bo'lsa faqat IP bilan ishlaydi

source /etc/nspos/sirlar.env

echo "── Nginx"
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nginx

echo "── Ilova sozlamalari"
# Manzil: brauzer PostgREST'ga TO'G'RIDAN-TO'G'RI bormaydi — Nginx
# `/rest/v1/` ni unga uzatadi. Shu tufayli PostgREST tashqariga
# umuman ochilmaydi va HTTPS bitta joyda hal bo'ladi.
ASOS="${DOMEN:+https://$DOMEN}"
ASOS="${ASOS:-http://$(hostname -I | awk '{print $1}')}"

cat > /opt/nspos/app/.env.production <<ENV
NEXT_PUBLIC_SUPABASE_URL=${ASOS}
DATABASE_URL=postgres://nspos_app@localhost:5432/nspos
JWT_SECRET=${JWT_SECRET}
NODE_ENV=production
ENV
chown nspos:nspos /opt/nspos/app/.env.production
chmod 600 /opt/nspos/app/.env.production

echo "── Yig'ilmoqda"
cd /opt/nspos/app
# `--omit=dev` ISHLATILMAYDI. Tailwind, PostCSS va Autoprefixer
# `devDependencies` da turadi, lekin ular YIG'ISH paytida kerak —
# `next build` ularsiz "Cannot find module 'tailwindcss'" bilan
# yiqiladi. "dev" degani "faqat ishlab chiqishda" degani emas,
# "tayyor mahsulot ichida bo'lmaydi" degani.
npm ci --silent 2>&1 | tail -2 || npm install --silent 2>&1 | tail -2
npm run build 2>&1 | tail -3

# Yig'ilgandan keyin yig'ish vositalari kerak emas — o'chiramiz,
# server diskida ~200 MB joy bo'shaydi.
npm prune --omit=dev --silent 2>&1 | tail -1 || true
chown -R nspos:nspos /opt/nspos/app

echo "── Xizmat"
cat > /etc/systemd/system/nspos.service <<'UNIT'
[Unit]
Description=NSPOS — Next.js ilovasi
After=network.target postgrest.service
Wants=postgrest.service

[Service]
Type=simple
User=nspos
Group=nspos
WorkingDirectory=/opt/nspos/app
EnvironmentFile=/opt/nspos/app/.env.production
ExecStart=/usr/bin/npm run start -- -p 3000
Restart=always
RestartSec=5
# Ilova faqat o'z papkasiga yoza olsin
ProtectSystem=strict
ReadWritePaths=/opt/nspos/app/.next
PrivateTmp=true
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable -q nspos
systemctl restart nspos
sleep 5

echo "── Nginx sozlamasi"
cat > /etc/nginx/sites-available/nspos <<NGINX
server {
    listen 80;
    server_name ${DOMEN:-_};

    # Yuklamalar katta bo'lishi mumkin (Excel fayllar)
    client_max_body_size 25m;

    # Ilova
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Baza — Supabase bilan bir xil manzil ko'rinishida.
    # Ilovaning 50 dan ortiq moduli aynan shu yo'lni kutadi.
    location /rest/v1/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        # PostgREST sahifalash uchun shu sarlavhani beradi
        proxy_pass_header Content-Range;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/nspos /etc/nginx/sites-enabled/nspos
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo
echo "✓ 4-qadam tugadi"
echo "  Ilova:     $(systemctl is-active nspos)"
echo "  Nginx:     $(systemctl is-active nginx)"
echo "  Manzil:    ${ASOS}"
KOD=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://127.0.0.1/login || echo 000)
echo "  /login:    HTTP ${KOD}"
if [ "$KOD" != "200" ]; then
  echo "!! Ilova javob bermayapti. Jurnal:"
  journalctl -u nspos -n 15 --no-pager | sed 's/^/   /'
  exit 1
fi
