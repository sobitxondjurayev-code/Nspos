#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# 5-QADAM: KUNLIK ZAXIRA
# ══════════════════════════════════════════════════════════════
# Supabase'da bepul tarifda zaxira YO'Q edi va shuning uchun
# `/api/backup` yozilgan edi. Endi baza o'zimizda — ya'ni zaxira
# ham butunlay bizning zimmamizda.
#
# Bu qadam serverni ko'chirganda O'TKAZIB YUBORILGAN edi: ma'lumot
# ko'chdi, lekin cron sozlanmadi. Ya'ni bir necha soat davomida
# yagona nusxa shu serverda turdi.
set -euo pipefail

install -d -o postgres -g postgres -m 750 /opt/nspos/zaxira

cat > /usr/local/bin/nspos-zaxira <<'SKRIPT'
#!/usr/bin/env bash
# Kunlik zaxira. Cron chaqiradi.
set -euo pipefail
JOY=/opt/nspos/zaxira
SANA=$(date +%Y-%m-%d)
FAYL="$JOY/nspos-$SANA.dump"

# `-Fc` — siqilgan va TANLAB tiklash mumkin bo'lgan format.
# Oddiy SQL faylda bitta jadvalni ajratib tiklash qiyin.
pg_dump -Fc -d nspos -f "$FAYL.yangi"

# ZAXIRA TEKSHIRILADI. Tekshirilmagan zaxira — zaxira emas:
# u faqat kerak bo'lgan kuni buzuq ekani ma'lum bo'ladi.
# `--list` fayl ichidagi ro'yxatni o'qiydi — buzuq bo'lsa yiqiladi.
if ! pg_restore --list "$FAYL.yangi" > /dev/null 2>&1; then
  echo "$(date '+%F %T') XATO: zaxira buzuq, saqlanmadi" >> "$JOY/jurnal.txt"
  rm -f "$FAYL.yangi"
  exit 1
fi

# Faqat tekshiruvdan o'tgach o'z nomini oladi — yarim yozilgan
# fayl hech qachon "tayyor zaxira" bo'lib ko'rinmaydi
mv "$FAYL.yangi" "$FAYL"

# Jadval sonini ham yozib qo'yamiz — keyin "o'sha kuni nechta
# yozuv bor edi?" degan savolga javob bo'ladi
QATOR=$(psql -d nspos -tAc "select sum(n_live_tup)::bigint from pg_stat_user_tables")
echo "$(date '+%F %T') OK $(du -h "$FAYL" | cut -f1) · ~$QATOR qator" >> "$JOY/jurnal.txt"

# ── Saqlash muddati ──────────────────────────────────────────
# 14 kunlik kundalik + har oyning 1-sanasidagisi abadiy.
# Xato bir necha kun sezilmasligi mumkin, shuning uchun 14 kun.
find "$JOY" -name 'nspos-*.dump' -mtime +14 ! -name 'nspos-*-01.dump' -delete
SKRIPT
chmod +x /usr/local/bin/nspos-zaxira

# Cron: har kecha 03:00 (Toshkent). Billz sinxronizatsiyasi 03:00 UTC
# da edi — ular bir-biriga xalaqit bermasin.
cat > /etc/cron.d/nspos-zaxira <<'CRON'
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin
0 3 * * * postgres /usr/local/bin/nspos-zaxira
CRON
chmod 644 /etc/cron.d/nspos-zaxira

echo "── Birinchi zaxira olinmoqda"
su - postgres -c /usr/local/bin/nspos-zaxira

echo
echo "✓ 5-qadam tugadi"
ls -lh /opt/nspos/zaxira/*.dump | awk '{print "  " $9 " · " $5}'
tail -1 /opt/nspos/zaxira/jurnal.txt | sed 's/^/  /'
echo "  Cron: har kecha 03:00 (Toshkent)"
