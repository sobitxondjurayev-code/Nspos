#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# BILLZ SINXRONIZATSIYASI — JADVAL BO'YICHA
# ══════════════════════════════════════════════════════════════
# Ilgari buni Vercel Cron bajarardi (vercel.json), kuniga BIR marta —
# Hobby tarifi undan tez-tez ruxsat bermasdi. Keyin 30 daqiqa. Endi
# HAR 5 DAQIQADA (2026-09-03, DAFTAR 17): bir inkremental aylanish
# 8–9 s va ~25 so'rov, Billz sekundiga 2 so'rov beradi. To'liq qarz
# ro'yxati (60 s) har 2 soatda, katalog kuniga bir — buni route o'zi
# hal qiladi. "Real vaqt" = 5 daqiqalik ko'zgu + muhr + farq detektori.
#
# `flock` — ikkita nusxa bir vaqtda ishlamasin: oldingisi cho'zilib
# ketsa yangisi tashlab yuboriladi, navbatga turmaydi.
set -euo pipefail

cat > /usr/local/bin/nspos-billz <<'ICHI'
#!/usr/bin/env bash
set -uo pipefail
SIR=$(grep '^CRON_SECRET=' /opt/nspos/app/.env.production | cut -d= -f2-)
JURNAL=/opt/nspos/zaxira/billz.log
javob=$(curl -s --max-time 290 -X POST "http://127.0.0.1:3000/api/billz/sync" \
        -H "authorization: Bearer $SIR" || echo '{"ok":false,"error":"curl xatosi"}')
ok=$(printf '%s' "$javob" | grep -c '"ok":true' || true)
if [ "$ok" -gt 0 ]; then
  # Faqat muhim raqamlar — jurnal shishib ketmasin.
  #
  # `noStore` va `exhausted` ATAYLAB shu ro'yxatda: ilgari faqat
  # "nechta qo'shildi" yozilardi va TASHLAB KETILGANI jurnalda
  # umuman ko'rinmasdi. Ya'ni do'koni tanilmagani uchun butun bir
  # do'konning savdosi yozilmay qolsa ham, jurnalda "OK" turardi
  # (DAFTAR 10.4: jurnal kam aytsa nosozlikni yashiradi).
  qisqa=$(printf '%s' "$javob" | grep -oE '"(inserted|items|payments|noStore|farqSoni|deactivated)":[0-9]+' | tr '\n' ' ')
  chala=$(printf '%s' "$javob" | grep -c '"exhausted":false' || true)
  [ "$chala" -gt 0 ] && qisqa="$qisqa CHALA(yana qoldi)"
  # Ko'zgu Billz bilan mos emas — sinxron "OK" bo'lsa ham
  farq=$(printf '%s' "$javob" | grep -oE '"farqSoni":[1-9][0-9]*' || true)
  [ -n "$farq" ] && qisqa="$qisqa FARQ($farq)"
  echo "$(date '+%F %T') OK $qisqa" >> "$JURNAL"
else
  echo "$(date '+%F %T') XATO $(printf '%s' "$javob" | head -c 300)" >> "$JURNAL"
fi
# Jurnal 5000 qatordan oshmasin
tail -5000 "$JURNAL" > "$JURNAL.tmp" 2>/dev/null && mv "$JURNAL.tmp" "$JURNAL"
ICHI
chmod 700 /usr/local/bin/nspos-billz

cat > /etc/cron.d/nspos-billz <<'ICHI'
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin
CRON_TZ=Asia/Tashkent
*/5 * * * * root /usr/bin/flock -n /tmp/nspos-billz.lock /usr/local/bin/nspos-billz
ICHI
chmod 644 /etc/cron.d/nspos-billz
touch /opt/nspos/zaxira/billz.log

echo "✓ Billz sinxronizatsiyasi har 5 daqiqada"
echo "  jurnal: /opt/nspos/zaxira/billz.log"
