#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# TASHQI ZAXIRA — Telegram va Google Drive
# ══════════════════════════════════════════════════════════════
#   bash scripts/server/12-zaxira-tashqi.sh
#
# NEGA KERAK — bu yerda jimgina ochilib qolgan teshik bor edi:
#
#   `05-zaxira.sh`  har kecha 03:00 da `pg_dump` qiladi, lekin nusxa
#                   SERVERNING O'ZIDA qoladi (/opt/nspos/zaxira).
#   `/api/backup`   nusxani Telegram va Drive'ga — ya'ni serverdan
#                   TASHQARIGA — yuboradi.
#
# Ikkinchisini faqat Vercel Cron chaqirardi (vercel.json). Vercel
# o'chirilishi bilan tashqi nusxa jimgina to'xtagan bo'lardi: disk
# yonsa yoki server yo'qolsa hamma zaxira ham u bilan ketardi.
# Xato hech qanday belgi bermasdi — zaxira "bor" edi, faqat hammasi
# bitta joyda.
#
# Shuning uchun chaqiruv serverning o'z croniga ko'chiriladi.
#
# `flock` — ikki nusxa bir vaqtda ishlamasin (06-billz-cron.sh bilan
# bir xil mulohaza).
set -euo pipefail

cat > /usr/local/bin/nspos-zaxira-tashqi <<'ICHI'
#!/usr/bin/env bash
set -uo pipefail
SIR=$(grep '^CRON_SECRET=' /opt/nspos/app/.env.production | cut -d= -f2-)
JURNAL=/opt/nspos/zaxira/tashqi.log
javob=$(curl -s --max-time 290 -X POST "http://127.0.0.1:3000/api/backup" \
        -H "authorization: Bearer $SIR" || echo '{"ok":false,"error":"curl xatosi"}')
ok=$(printf '%s' "$javob" | grep -c '"ok":true' || true)
if [ "$ok" -gt 0 ]; then
  qisqa=$(printf '%s' "$javob" | grep -oE '"(rows|tables|bytes|telegram|drive)":[^,}]+' | tr '\n' ' ')
  echo "$(date '+%F %T') OK $qisqa" >> "$JURNAL"
else
  echo "$(date '+%F %T') XATO $(printf '%s' "$javob" | head -c 300)" >> "$JURNAL"
fi
tail -5000 "$JURNAL" > "$JURNAL.tmp" 2>/dev/null && mv "$JURNAL.tmp" "$JURNAL"
ICHI
chmod 700 /usr/local/bin/nspos-zaxira-tashqi

# 03:15 — mahalliy `pg_dump` (03:00) tugagandan keyin, Billz
# sinxronizatsiyasi (har :00 va :30) oralig'ida.
cat > /etc/cron.d/nspos-zaxira-tashqi <<'ICHI'
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin
CRON_TZ=Asia/Tashkent
15 3 * * * root /usr/bin/flock -n /tmp/nspos-zaxira-tashqi.lock /usr/local/bin/nspos-zaxira-tashqi
ICHI
chmod 644 /etc/cron.d/nspos-zaxira-tashqi
touch /opt/nspos/zaxira/tashqi.log

# ── HAQIQIY TEKSHIRUV ─────────────────────────────────────────
# Cron faylini yozib qo'yish "ishlaydi" degani emas: token noto'g'ri
# bo'lsa yoki Telegram sozlanmagan bo'lsa, xato faqat bir kundan
# keyin, kechasi bilinardi. Shuning uchun HOZIR bir marta chaqiramiz.
echo "── Bir marta sinab ko'rilmoqda (fayl Telegram'ga kelishi kerak)…"
/usr/bin/flock -n /tmp/nspos-zaxira-tashqi.lock /usr/local/bin/nspos-zaxira-tashqi
oxirgi=$(tail -1 /opt/nspos/zaxira/tashqi.log)
echo "   $oxirgi"
case "$oxirgi" in
  *OK*) echo "✓ Tashqi zaxira har kecha 03:15 da" ;;
  *)    echo "✗ Ishlamadi. TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID / DRIVE_BACKUP_URL"
        echo "  .env.production da bor-yo'qligini tekshiring."; exit 1 ;;
esac
echo "  jurnal: /opt/nspos/zaxira/tashqi.log"
