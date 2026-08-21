#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# 0-QADAM: SERVER BO'SHMI? — HECH NARSAGA TEGMAYDI
# ══════════════════════════════════════════════════════════════
# Bu skript FAQAT O'QIYDI. Hech narsa o'rnatmaydi, o'chirmaydi,
# sozlamani almashtirmaydi.
#
# Nega kerak: foydalanuvchida ikkita server bor va ikkinchisida
# BOSHQA LOYIHA ishlayapti (tekshirildi: 80 va 443 portlari ochiq,
# HTTPS'ga yo'naltiryapti). Agar o'rnatish skripti adashib o'sha
# serverda yurgizilsa, `ufw --force reset` va SSH sozlamasi
# o'sha loyihani uzib qo'yadi.
#
# Shuning uchun tartib: AVVAL shu skript, natijani ODAM ko'radi,
# keyingina o'rnatish.
set -uo pipefail

ogoh=0
belgi() { echo "  ⚠ $*"; ogoh=$((ogoh+1)); }
toza()  { echo "  ✓ $*"; }

echo "══ SERVER: $(hostname) · $(hostname -I | awk '{print $1}')"
echo "   $(lsb_release -ds 2>/dev/null || cat /etc/os-release | grep PRETTY | cut -d'"' -f2)"
echo "   Ishlayapti: $(uptime -p)"
echo

echo "── Veb-server"
for s in nginx apache2 caddy httpd; do
  systemctl is-active --quiet "$s" 2>/dev/null && belgi "$s ISHLAYAPTI" || true
done
[ $ogoh -eq 0 ] && toza "veb-server yo'q"

echo
echo "── Baza"
oldin=$ogoh
for s in postgresql mysql mariadb mongod redis-server; do
  systemctl is-active --quiet "$s" 2>/dev/null && belgi "$s ISHLAYAPTI" || true
done
if systemctl is-active --quiet postgresql 2>/dev/null; then
  echo "     mavjud bazalar:"
  su - postgres -c "psql -tAc \"select datname from pg_database where datistemplate=false\"" 2>/dev/null | sed 's/^/       /'
fi
[ $ogoh -eq $oldin ] && toza "baza xizmati yo'q"

echo
echo "── Ilova jarayonlari"
oldin=$ogoh
pgrep -a -f "node|python3 .*app|java -jar|gunicorn|php-fpm" 2>/dev/null | head -5 | while read -r l; do echo "  ⚠ $l"; done
pgrep -f "node|gunicorn|php-fpm" >/dev/null 2>&1 && ogoh=$((ogoh+1))
[ $ogoh -eq $oldin ] && toza "begona ilova jarayoni yo'q"

echo
echo "── Docker"
if command -v docker >/dev/null 2>&1; then
  n=$(docker ps -q 2>/dev/null | wc -l)
  [ "$n" -gt 0 ] && belgi "$n ta konteyner ishlayapti" || toza "docker bor, konteyner yo'q"
else
  toza "docker o'rnatilmagan"
fi

echo
echo "── Tinglanayotgan portlar (localhost'dan tashqari)"
ss -tlnp 2>/dev/null | awk 'NR>1 && $4 !~ /127\.0\.0\.1|::1/ {print "  " $4 "  " $6}' | sort -u

echo
echo "── Boshqa foydalanuvchilar (UID >= 1000)"
oldin=$ogoh
# `ubuntu` — Contabo obrazidagi standart hisob, begona emas
awk -F: '$3>=1000 && $3<65534 && $1!="ubuntu" {print "  ⚠ " $1 " (" $6 ")"}' /etc/passwd | tee /tmp/_u | head -5
[ -s /tmp/_u ] && ogoh=$((ogoh+1)) || toza "faqat root"
rm -f /tmp/_u

echo
echo "── Cron vazifalari"
oldin=$ogoh
for u in $(cut -d: -f1 /etc/passwd); do
  c=$(crontab -u "$u" -l 2>/dev/null | grep -v '^#' | grep -v '^$' | head -3)
  [ -n "$c" ] && { belgi "cron ($u):"; echo "$c" | sed 's/^/       /'; }
done
ls -A /etc/cron.d 2>/dev/null | grep -v '^\.' | head -5 | sed 's/^/  ⚠ \/etc\/cron.d\//'
[ $ogoh -eq $oldin ] && toza "begona cron yo'q"

echo
echo "── Veb papkalari"
oldin=$ogoh
for d in /var/www /srv /opt/app /home/*/public_html; do
  [ -d "$d" ] && [ -n "$(ls -A "$d" 2>/dev/null)" ] && belgi "$d bo'sh emas: $(ls -A "$d" | head -3 | tr '\n' ' ')"
done
[ $ogoh -eq $oldin ] && toza "veb papkalari bo'sh"

echo
echo "── Disk"
df -h / | awk 'NR==2 {print "  ishlatilgan: " $3 " / " $2 " (" $5 ")"}'

echo
echo "════════════════════════════════════════"
if [ $ogoh -eq 0 ]; then
  echo "  ✓ SERVER BO'SH — o'rnatishni boshlash mumkin"
else
  echo "  ⚠ $ogoh ta belgi topildi — YUQORIDAGINI O'QING"
  echo "    Bu serverda boshqa narsa bo'lsa, o'rnatish uni buzishi mumkin."
  echo "    Davom etishdan oldin odam qaror qilsin."
fi
echo "════════════════════════════════════════"
