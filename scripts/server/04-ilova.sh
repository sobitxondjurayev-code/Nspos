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

PROD=/opt/nspos/app/.env.production

# ══════════════════════════════════════════════════════════════
# ESKI SIRLAR SAQLANADI — FAYL USTIDAN YOZILMAYDI
# ══════════════════════════════════════════════════════════════
# Ilgari bu yer `.env.production` ni shunchaki USTIDAN yozardi va
# ichida atigi to'rtta qator qolardi. Ishlayotgan serverda esa
# to'qqizta bor:
#
#   SUPABASE_SERVICE_ROLE_KEY  — qo'lda yasalgan JWT, hech qayerda
#                                saqlanmagan; yo'qolsa sayt bazani
#                                umuman o'qiy olmaydi
#   BILLZ_SECRET_TOKEN         — Billz integratsiya kaliti
#   CRON_SECRET                — cron shu bilan kiradi
#   NSPOS_REST_INTERNAL        — 10-ichki.sh qo'yadi
#   BILLZ_API_URL              — qo'lda
#
# Ya'ni shu qadamni IKKINCHI marta yurgizish Billz sinxronizatsiyasini
# va cron'ni JIMGINA o'ldirardi: `npm ci`, `next build`, sayt ochiladi,
# hamma sahifa 200 — faqat raqam yangilanmay qotib qoladi. Ekranda
# hech qanday belgi yo'q; xato faqat `/opt/nspos/zaxira/billz.log`
# ichida ko'rinadi (2026-09-06 da topildi, DAFTAR 23.3).
#
# Endi FAQAT o'zimiz boshqaradigan to'rt qator yoziladi, qolgan hamma
# qator eski fayldan ko'chiriladi. Saqlanadiganlar ro'yxati NOMMA-NOM
# EMAS — aks holda ertaga qo'shilgan yangi kalit o'sha ro'yxatga
# tushmay yana jimgina yo'qolardi.
BIZNIKI='^(NEXT_PUBLIC_SUPABASE_URL|DATABASE_URL|JWT_SECRET|NODE_ENV)='
QOLGANI=""
if [ -f "$PROD" ]; then
  # Faqat haqiqiy sozlama qatorlari (izoh va bo'sh qator tashlanadi)
  QOLGANI=$(grep -E '^[A-Z0-9_]+=' "$PROD" | grep -Ev "$BIZNIKI" || true)
fi

# Cron siri bo'lmasa — yasaymiz (07-api.sh dagi kabi, bir marta).
# Bo'lmasa `/api/billz/sync` cron chaqirig'iga 401 beradi va
# sinxronizatsiya butunlay to'xtaydi.
NL=$'\n'
if ! grep -q '^CRON_SECRET=' <<<"$QOLGANI"; then
  QOLGANI="${QOLGANI}${QOLGANI:+$NL}CRON_SECRET=$(openssl rand -hex 24)"
fi

# Eski nusxa — qaytarish kerak bo'lsa. `/etc/nspos` da turadi:
# ilova papkasida qolsa `chiqar.sh` dagi rsync uni bir kun tashlab
# yuborishi mumkin, u yerda esa faqat root ko'radi.
if [ -f "$PROD" ]; then
  cp -p "$PROD" /etc/nspos/env.production.oldingi
  chmod 600 /etc/nspos/env.production.oldingi
fi

{
  echo "NEXT_PUBLIC_SUPABASE_URL=${ASOS}"
  echo "DATABASE_URL=postgres://nspos_app@localhost:5432/nspos"
  echo "JWT_SECRET=${JWT_SECRET}"
  echo "NODE_ENV=production"
  if [ -n "$QOLGANI" ]; then printf '%s\n' "$QOLGANI"; fi
} > "$PROD"
chown nspos:nspos "$PROD"
chmod 600 "$PROD"

# ── Yetishmayotgani AYTILADI ────────────────────────────────
# Birinchi o'rnatishda bu ikkisi hali yo'q — bu xato emas. Lekin
# jim ham qolmasin: ularsiz sayt (service kalit) yoki Billz
# sinxronizatsiyasi ishlamaydi va sababi ko'rinmaydi.
for sir in SUPABASE_SERVICE_ROLE_KEY BILLZ_SECRET_TOKEN; do
  grep -q "^$sir=" "$PROD" || {
    echo "   ⚠ $sir YO'Q — qo'shilmaguncha ishlamaydi:"
    echo "       echo '$sir=<qiymat>' >> $PROD && systemctl restart nspos"
  }
done
echo "   ✓ sozlama: $(grep -cE '^[A-Z0-9_]+=' "$PROD") ta qator ($PROD)"

echo "── Yig'ilmoqda"
cd /opt/nspos/app
# `--omit=dev` ISHLATILMAYDI. Tailwind, PostCSS va Autoprefixer
# `devDependencies` da turadi, lekin ular YIG'ISH paytida kerak —
# `next build` ularsiz "Cannot find module 'tailwindcss'" bilan
# yiqiladi. "dev" degani "faqat ishlab chiqishda" degani emas,
# "tayyor mahsulot ichida bo'lmaydi" degani.
npm ci --silent 2>&1 | tail -2 || npm install --silent 2>&1 | tail -2
npm run build 2>&1 | tail -3

# `npm prune --omit=dev` QILINMAYDI.
#
# Bir marta qilingan va sayt STILSIZ chiqqan edi. Sabab: prune
# Tailwind'ni o'chiradi, keyingi safar kod yangilanib QAYTA
# yig'ilganda esa u yo'q — `next build` xato BERMAYDI, shunchaki
# CSS yasamaydi. Sahifa ochiladi, lekin butunlay bezaksiz.
#
# Disk 96 GB, node_modules ~300 MB. Tejash arzimaydi.
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
