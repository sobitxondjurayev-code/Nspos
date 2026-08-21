#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# HAQIQIY BRAUZER TEKSHIRUVI
# ══════════════════════════════════════════════════════════════
#   bash scripts/server/brauzer-tekshir.sh [manzil]
#
# NEGA KERAK (2026-08-22):
# `curl` hamma sahifaga 200 qaytardi va men "hammasi joyida" deb
# hisobot berdim. Aslida sayt brauzerda UMUMAN ochilmasdi:
# "Application error: a client-side exception has occurred".
# Sabab — AuthProvider'da import qilinmagan `sessiyaOl`.
#
# Next.js server HTML QOBIQNI beradi, ya'ni 200 qaytadi. Ishdan
# chiqish brauzerda, hidratsiya paytida bo'ladi — javob kodi buni
# ko'rsata olmaydi.
#
# ── BU SKRIPTNING O'ZI HAM BIR MARTA YOLG'ON O'TGAN ──
# Birinchi variantida `timeout 60 chrome …` yozilgandi. macOS'da
# `timeout` BUYRUG'I YO'Q (u GNU coreutils'dan). Ya'ni Chrome
# umuman ishga tushmagan, jurnal fayllari bo'sh qolgan, `grep`
# hech narsa topmagan va 14 ta sahifa "toza" deb chiqqan.
#
# Shundan ikki xulosa kodga aylantirildi:
#   1. Muddat cheklovi shu yerda yozilgan (`muddat`), tashqi
#      buyruqqa tayanilmaydi.
#   2. Tekshiruv "xato TOPILMADI" ga emas, "sahifa CHIZILDI" ga
#      asoslanadi: har sahifadan skrinshot olinadi va u yetarlicha
#      katta bo'lishi SHART. Bo'sh natija endi o'tmaydi.
#
# ── CHEKLOV ──
# Kirish qilinmaydi, ya'ni /dashboard kabi sahifalar /login ga
# yo'naltiriladi. Bu asosiy xatoni tutish uchun yetarli edi
# (AuthProvider ildiz layoutida), lekin kirgan holatdagi
# komponentning ichki xatosini bu tekshiruv KO'RMAYDI.
# Ular uchun `npm run nomlar` va `npm run tekshir` ishlaydi.
set -uo pipefail

MANZIL="${1:-http://169.58.216.246}"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
ISH="$(mktemp -d)"
trap 'rm -rf "$ISH"; pkill -9 -f "Google Chrome.*--headless.*nspos-brauzer" 2>/dev/null || true' EXIT

# macOS'da `timeout` yo'q — o'zimiznikini yozamiz.
muddat() {
  local sek="$1"; shift
  "$@" & local pid=$!
  ( sleep "$sek"; kill -9 "$pid" 2>/dev/null ) & local qorovul=$!
  wait "$pid" 2>/dev/null
  kill -9 "$qorovul" 2>/dev/null
  wait "$qorovul" 2>/dev/null
}

if [ ! -x "$CHROME" ]; then
  echo "   ⚠ Chrome topilmadi ($CHROME) — brauzer tekshiruvi O'TKAZILMADI"
  echo "     (bu 'toza' degani EMAS)"
  exit 0
fi

YOLLAR=(/login /dashboard /finance/pnl /finance/kassa /products /clients /sales
        /reports /reports/product_profit /reports/stock_health /reports/rfm
        /reports/ar_aging /management /settings)

# Sahifa chizilgani dalili: skrinshot shu hajmdan katta bo'lsin.
# Butunlay oq/qora ekran ~3-8 KB chiqadi, chizilgan sahifa 20 KB dan
# oshadi. Chegara ataylab past — maqsad "umuman chizilmadi" ni tutish.
ENG_KAM_PNG=12000

# Chrome o'zi chiqaradigan, sayt bilan bog'liq bo'lmagan ogohlantirishlar
SHOVQIN='Cross-Origin-Opener-Policy|fonts.googleapis|Password field is not contained|DevTools|Autofill'

# Sahifalar PARALLEL tekshiriladi. Ketma-ket qilinganda 14 sahifa
# 10 daqiqadan oshib ketdi: Chrome `--virtual-time-budget` tugagach
# ham o'zi chiqmaydi, ya'ni har sahifa muddat cheklovini to'liq
# kutadi. Bir vaqtda 5 tadan ishga tushiriladi.
BIRVAQT=5
MUDDAT=20

bitta() {
  local yol="$1"
  local nom; nom="$(echo "$yol" | tr '/' '_')"
  local png="$ISH/s$nom.png"
  local jurnal="$ISH/l$nom.txt"

  muddat "$MUDDAT" "$CHROME" --headless --disable-gpu --no-sandbox \
    --no-first-run --no-default-browser-check --disable-extensions \
    --user-data-dir="$ISH/nspos-brauzer$nom" --window-size=1400,900 \
    --enable-logging=stderr --v=0 --virtual-time-budget=6000 \
    --screenshot="$png" "$MANZIL$yol" 2>"$jurnal"

  local olcham konsol
  olcham=$(wc -c < "$png" 2>/dev/null || echo 0)
  konsol=$(grep -oE "(Uncaught [A-Za-z]*Error|ReferenceError|TypeError|SyntaxError): [^\"]{0,90}" "$jurnal" 2>/dev/null \
           | grep -vE "$SHOVQIN" | head -1 || true)

  if [ -n "$konsol" ]; then
    printf "✗|%s|%s\n" "$yol" "$konsol" >> "$ISH/natija.txt"
  elif [ "${olcham:-0}" -lt "$ENG_KAM_PNG" ]; then
    printf "✗|%s|sahifa chizilmadi (skrinshot %s bayt)\n" "$yol" "${olcham:-0}" >> "$ISH/natija.txt"
  else
    printf "✓|%s|%s KB\n" "$yol" "$((olcham / 1024))" >> "$ISH/natija.txt"
  fi
}

: > "$ISH/natija.txt"
n=0
for yol in "${YOLLAR[@]}"; do
  bitta "$yol" &
  n=$((n + 1))
  [ $((n % BIRVAQT)) -eq 0 ] && wait
done
wait

xato=0
# Natija ro'yxat tartibida chiqariladi — parallel yozuv tartibi tasodifiy.
for yol in "${YOLLAR[@]}"; do
  qator=$(grep -F "|$yol|" "$ISH/natija.txt" | head -1)
  if [ -z "$qator" ]; then
    printf "   ✗ %-28s natija yo'q (Chrome ishga tushmadi)\n" "$yol"; xato=$((xato + 1)); continue
  fi
  belgi="${qator%%|*}"; qolgan="${qator#*|}"; izoh="${qolgan#*|}"
  printf "   %s %-28s %s\n" "$belgi" "$yol" "$izoh"
  [ "$belgi" = "✗" ] && xato=$((xato + 1))
done

if [ "$xato" -gt 0 ]; then
  echo "   ── $xato ta sahifa brauzerda ishdan chiqdi"
  exit 1
fi
echo "   ── ${#YOLLAR[@]} ta sahifa brauzerda chizildi"
