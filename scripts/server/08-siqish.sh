#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# JAVOBLARNI SIQISH (gzip)
# ══════════════════════════════════════════════════════════════
# Nginx'da `gzip on;` yozilgan edi, lekin `gzip_types` va
# `gzip_proxied` izohda qolgan — ya'ni JSON UMUMAN siqilmasdi.
# Standart holatda nginx faqat `text/html` ni va faqat o'zi
# beradigan faylni siqadi; PostgREST'dan kelgan javob esa
# "proxied" hisoblanadi.
#
# Bu bizda eng katta trafik: 9 032 chek + 34 489 qatori, 11 530
# qarz, 9 097 mijoz — hammasi JSON. JSON 8-10 barobar siqiladi.
#
# Server Yevropada, foydalanuvchi O'zbekistonda: har ortiqcha
# megabayt to'g'ridan-to'g'ri kutish vaqti.
set -euo pipefail

# `gzip on;` BU YERDA YOZILMAYDI — u nginx.conf da allaqachon bor va
# takrorlansa nginx umuman ishga tushmaydi ("gzip directive is
# duplicate"). Faqat yetishmaydigan sozlamalar qo'shiladi.
cat > /etc/nginx/conf.d/nspos-gzip.conf <<'ICHI'
# Proksidan kelgan javob ham siqilsin (PostgREST va Next.js)
gzip_proxied any;
gzip_vary on;
# 5 — tezlik va siqilish orasidagi muvozanat (9 protsessorni yeydi)
gzip_comp_level 5;
# Kichik javobni siqish foyda bermaydi
gzip_min_length 1024;
gzip_types
  application/json
  application/javascript
  application/x-javascript
  text/javascript
  text/css
  text/plain
  application/xml
  image/svg+xml;
ICHI

# `nginx -t && reload` yetarli emas: xato bo'lsa ham skript "✓" deb
# tugardi. Endi ochiq tekshiriladi va sozlama OLIB TASHLANADI —
# buzuq fayl qolib, keyingi nginx qayta ishga tushishida sayt
# umuman ko'tarilmay qolmasin.
if ! nginx -t 2>&1; then
  rm -f /etc/nginx/conf.d/nspos-gzip.conf
  echo "✗ nginx sozlamasi qabul qilmadi — o'zgarish bekor qilindi"
  exit 1
fi
systemctl reload nginx
echo "✓ gzip yoqildi"
