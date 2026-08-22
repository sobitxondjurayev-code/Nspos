#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# DOMEN VA SERTIFIKAT — tizim.enes.uz
# ══════════════════════════════════════════════════════════════
#   bash scripts/server/09-domen.sh [domen]
#
# NEGA HTTPS SHUNCHAKI CHIROY EMAS:
# `app/api/kirish/route.js` kirish cookie'siga `Secure` bayrog'ini
# qo'yadi (`NODE_ENV=production` bo'lgani uchun). Brauzer esa
# `http://` da `Secure` cookie'ni SAQLAMAYDI — jimgina tashlab
# yuboradi. Ya'ni HTTPS'siz kirish formasi orqali tizimga umuman
# kirib bo'lmaydi: parol to'g'ri bo'lsa ham sahifa /login ga
# qaytaraveradi, va hech qanday xato ko'rinmaydi.
#
# `enes.uz` va `www` GA TEGILMAYDI — ular kompaniya sayti uchun.
# Biz faqat `tizim.enes.uz` bilan ishlaymiz.
set -euo pipefail

DOMEN="${1:-tizim.enes.uz}"
KONF=/etc/nginx/sites-available/nspos
NUSXA="/etc/nginx/sites-available/nspos.oldin-$(date +%Y%m%d-%H%M%S)"

echo "── 1/6 DNS tekshirilmoqda"
IP=$(dig +short A "$DOMEN" @8.8.8.8 | tail -1)
MENING=$(curl -s --max-time 10 https://api.ipify.org || echo "")
if [ -z "$IP" ]; then
  echo "   ✗ $DOMEN hali tarqalmagan (A yozuvi topilmadi)."
  echo "     aHOST → DNS xosting → A   tizim   169.58.216.246"
  exit 1
fi
echo "   ✓ $DOMEN → $IP"

# Certbot HTTP-01 sinovi uchun domen SHU serverga ko'rsatishi shart.
# Aks holda u tushunarsiz xato bilan yiqiladi.
BU_SERVER=$(hostname -I | tr ' ' '\n' | grep -v '^$' | head -1)
if ! hostname -I | tr ' ' '\n' | grep -qx "$IP"; then
  echo "   ⚠ $DOMEN → $IP, bu server esa $BU_SERVER"
  echo "     Sertifikat olinmaydi. DNS tarqalishini kuting."
  exit 1
fi

echo "── 2/6 Nginx sozlamasining nusxasi"
cp "$KONF" "$NUSXA"
echo "   ✓ $NUSXA"

# Xato bo'lsa sozlama QAYTARILADI — buzuq fayl qolib ketmasin,
# aks holda nginx keyingi qayta ishga tushishda umuman ko'tarilmaydi.
qaytar() {
  echo "   ✗ xato — sozlama qaytarilmoqda"
  cp "$NUSXA" "$KONF"
  nginx -t >/dev/null 2>&1 && systemctl reload nginx || true
}
trap qaytar ERR

echo "── 3/6 server_name qo'yilmoqda"
sed -i "s/^\( *\)server_name _;/\1server_name $DOMEN;/" "$KONF"
grep -q "server_name $DOMEN;" "$KONF" || { echo "   ✗ server_name almashmadi"; exit 1; }
nginx -t >/dev/null
systemctl reload nginx
echo "   ✓ server_name $DOMEN"

echo "── 4/6 certbot"
if ! command -v certbot >/dev/null; then
  apt-get update -qq
  apt-get install -y -qq certbot python3-certbot-nginx
fi
# `--redirect` — HTTP so'rovlari HTTPS'ga yo'naltiriladi.
# `--no-eff-email` — ro'yxatga yozilmaymiz.
certbot --nginx -d "$DOMEN" \
  --non-interactive --agree-tos --redirect --no-eff-email \
  -m "${CERTBOT_EMAIL:-nskamera2@gmail.com}"
echo "   ✓ sertifikat olindi"

echo "── 5/6 Avtomatik yangilash sinovi"
# Bu qadam TASHLAB KETILMAYDI. Sertifikat 90 kunda tugaydi; yangilash
# ishlamasa sayt bir kuni to'satdan ochilmay qoladi va sababi darrov
# tushunarli bo'lmaydi.
certbot renew --dry-run 2>&1 | tail -3
systemctl list-timers 2>/dev/null | grep -q certbot && echo "   ✓ taymer o'rnatilgan" || echo "   ⚠ taymer topilmadi"

echo "── 6/6 IP orqali kirish domenga yo'naltiriladi"
# Nomsiz so'rov (to'g'ridan-to'g'ri IP bilan) endi domenga o'tadi.
# Busiz sayt IP orqali HTTPSsiz ochilaverardi — u yerda esa kirish
# baribir ishlamaydi (Secure cookie), ya'ni odam chalg'iydi.
cat > /etc/nginx/sites-available/nspos-ip <<ICHI
server {
    listen 80 default_server;
    server_name _;
    return 301 https://$DOMEN\$request_uri;
}
ICHI
ln -sf /etc/nginx/sites-available/nspos-ip /etc/nginx/sites-enabled/nspos-ip
# `default_server` ikki joyda bo'lmasin
sed -i 's/listen 80 default_server;/listen 80;/' "$KONF" 2>/dev/null || true
nginx -t >/dev/null
systemctl reload nginx

trap - ERR
echo
echo "✓ Tayyor: https://$DOMEN"
echo "  Eski sozlama: $NUSXA"
