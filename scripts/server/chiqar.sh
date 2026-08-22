#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# SAYTGA CHIQARISH — lokal papkadan serverga
# ══════════════════════════════════════════════════════════════
#   bash scripts/server/chiqar.sh
#
# Kalit: ~/.ssh/nspos (server uchun alohida yaratilgan).
# ~/.ssh/id_ed25519 — GitHub kaliti, u serverda ISHLAMAYDI. Shuning
# uchun kalit shu yerda ANIQ ko'rsatilgan: `ssh root@...` desangiz
# "Permission denied (publickey)" chiqadi va sabab ko'rinmaydi.
#
# Nima YUBORILMAYDI:
#   node_modules, .next  — serverda o'zi quriladi
#   .env*                — serverdagi sozlama lokal fayl bilan
#                          ALMASHTIRILMASIN (baza paroli o'sha yerda)
#   .git, .tmp           — keraksiz
#
# `npm prune --omit=dev` QILINMAYDI: 2026-08-21 da shu sabab keyingi
# build umuman CSS yasamadi va sayt bezaksiz ochildi (next build xato
# ham bermadi). tailwind/postcss devDependencies da, lekin build
# paytida KERAK.
set -euo pipefail

SERVER="${NSPOS_SERVER:-root@169.58.216.246}"
# Saytning OMMAVIY manzili. SSH manzilidan farq qiladi: SSH IP bilan
# boradi, brauzer esa domen bilan — sertifikat aynan domenga berilgan
# va IP bilan ochilsa brauzer ogohlantirish beradi.
MANZIL="${NSPOS_MANZIL:-https://tizim.enes.uz}"
KALIT="${NSPOS_KEY:-$HOME/.ssh/nspos}"
YOL="/opt/nspos/app"

echo "── 1/5 Import qilinmagan nomlar tekshirilmoqda"
# `next build` bu xatoni KO'RMAYDI: webpack import qilinmagan nomni
# global deb hisoblaydi. Sayt esa brauzerda ochilmay qoladi.
npm run --silent nomlar || { echo "   ✗ import xatosi — chiqarilmadi"; exit 1; }
echo "   ✓ toza"

echo "── 2/5 Fayllar ko'chirilmoqda → $SERVER:$YOL"
rsync -az --delete -e "ssh -i $KALIT" \
  --exclude node_modules --exclude .next --exclude .git \
  --exclude .tmp --exclude '.env*' \
  ./ "$SERVER:$YOL/"

echo "── 3/5 Qurilmoqda (npm ci + next build)"
ssh -i "$KALIT" "$SERVER" "cd $YOL && npm ci --silent && npm run build" 2>&1 | tail -25

echo "── 4/5 Qayta ishga tushirilmoqda"
ssh -i "$KALIT" "$SERVER" "systemctl restart nspos && sleep 3 && systemctl is-active nspos"

echo "── 5/5 Sahifalar tekshirilmoqda"
# `systemctl is-active` qayta-qayta o'chib yonayotgan xizmatni ham
# "active" deb ko'rsatadi — shuning uchun HAQIQIY so'rov yuboriladi.
ssh -i "$KALIT" "$SERVER" 'bash -s' <<'UZOQ'
xato=0
for yol in / /login /dashboard /finance/pnl /finance/kassa /products /clients /reports /management; do
  kod=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "http://127.0.0.1:3000$yol")
  case "$kod" in
    200|307|308) belgi="✓" ;;
    *) belgi="✗"; xato=$((xato+1)) ;;
  esac
  printf "   %s %-18s %s\n" "$belgi" "$yol" "$kod"
done
# CSS bormi — bezaksiz sayt "200" qaytaradi, ya'ni kod yetarli emas
css=$(ls -1 /opt/nspos/app/.next/static/css/*.css 2>/dev/null | wc -l)
olcham=$(cat /opt/nspos/app/.next/static/css/*.css 2>/dev/null | wc -c)
if [ "$css" -gt 0 ] && [ "$olcham" -gt 10000 ]; then
  printf "   ✓ CSS: %d fayl, %d bayt\n" "$css" "$olcham"
else
  printf "   ✗ CSS YO'Q (%d fayl, %d bayt) — sayt bezaksiz ochiladi\n" "$css" "$olcham"; xato=$((xato+1))
fi
[ "$xato" -eq 0 ] && echo "   ── hammasi joyida" || { echo "   ── $xato ta muammo"; exit 1; }
UZOQ
# HAQIQIY brauzer. Javob kodi hech narsani isbotlamaydi — 2026-08-22
# da hamma sahifa 200 qaytarib turgan holda sayt brauzerda umuman
# ochilmasdi.
echo "── Brauzerda ochilmoqda"
bash "$(dirname "$0")/brauzer-tekshir.sh" "$MANZIL" || exit 1

# Kirgan holat — kirmasdan tekshirilganda hamma sahifa /login ga
# yo'naltiriladi va ichkaridagi xato ko'rinmaydi.
echo "── Kirgan holatda"
node "$(dirname "$0")/brauzer-kirgan.mjs" "$MANZIL" || exit 1

echo "✓ Tayyor: $MANZIL"
