#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# HAQIQIY BRAUZER TEKSHIRUVI
# ══════════════════════════════════════════════════════════════
#   bash scripts/server/brauzer-tekshir.sh [manzil]
#
# NEGA KERAK (2026-08-22):
# `curl` 200 qaytardi va men "hammasi joyida" deb hisobot berdim.
# Aslida sayt brauzerda UMUMAN ochilmasdi: "Application error: a
# client-side exception has occurred". Sabab — AuthProvider'da import
# qilinmagan `sessiyaOl`.
#
# Next.js server HTML QOBIQNI beradi, ya'ni 200 qaytadi. Ishdan
# chiqish esa brauzerda, hidratsiya paytida bo'ladi. Shuning uchun
# javob kodi hech narsani isbotlamaydi — sahifa HAQIQIY brauzerda
# ochilishi kerak.
#
# Kirish talab qilinmaydi: AuthProvider ildiz layoutida, ya'ni
# xato /login da ham chiqadi.
set -uo pipefail

MANZIL="${1:-http://169.58.216.246}"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
ISH="$(mktemp -d)"
trap 'rm -rf "$ISH"' EXIT

if [ ! -x "$CHROME" ]; then
  echo "   ⚠ Chrome topilmadi ($CHROME) — brauzer tekshiruvi o'tkazib yuborildi"
  exit 0
fi

YOLLAR=(/login /dashboard /finance/pnl /finance/kassa /products /clients /sales
        /reports /reports/product_profit /reports/stock_health /reports/rfm
        /reports/ar_aging /management /settings)

xato=0
for yol in "${YOLLAR[@]}"; do
  jurnal="$ISH/log.txt"
  dom="$ISH/dom.html"
  # `--virtual-time-budget` — brauzer shuncha "virtual millisekund"
  # kutadi va chiqadi. Busiz Chrome ochiq qolib ketadi.
  timeout 60 "$CHROME" --headless --disable-gpu --no-sandbox \
    --no-first-run --no-default-browser-check --disable-extensions \
    --user-data-dir="$ISH/profil" \
    --enable-logging=stderr --v=0 --virtual-time-budget=9000 \
    --dump-dom "$MANZIL$yol" >"$dom" 2>"$jurnal"

  # Ikki xil dalil qidiriladi: DOM'dagi xato matni va konsoldagi
  # istisno. Bittasi bo'lsa ham sahifa singan hisoblanadi.
  domXato=$(grep -c "Application error" "$dom" 2>/dev/null || true)
  konsol=$(grep -oE "(Uncaught [A-Za-z]*Error|ReferenceError|TypeError): [^\"]{0,90}" "$jurnal" 2>/dev/null | head -1 || true)

  if [ "${domXato:-0}" -gt 0 ] || [ -n "$konsol" ]; then
    printf "   ✗ %-28s %s\n" "$yol" "${konsol:-Application error (DOM)}"
    xato=$((xato + 1))
  else
    printf "   ✓ %-28s\n" "$yol"
  fi
done

if [ "$xato" -gt 0 ]; then
  echo "   ── $xato ta sahifa brauzerda ishdan chiqdi"
  exit 1
fi
echo "   ── ${#YOLLAR[@]} ta sahifa brauzerda toza"
