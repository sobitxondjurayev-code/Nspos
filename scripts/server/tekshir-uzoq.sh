#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# PUL TEKSHIRUVI — SERVERDAGI HAQIQIY BAZA USTIDA
# ══════════════════════════════════════════════════════════════
#   npm run tekshir:server
#
# NEGA KERAK — 2026-08-23 da aniqlangan xato:
# VPS'ga ko'chgandan keyin ham kompyuterdagi `.env.local` eski
# Supabase'ga qarab turdi va `npm run tekshir` MUZLAB QOLGAN nusxani
# tekshirdi. Ikki baza butunlay boshqa raqam berardi:
#
#   eski Supabase → kirim 93 460.03 · kassada 58 277.43
#   VPS (haqiqiy) → kirim 82 308.87 · kassada 47 344.28
#
# Ya'ni saytga chiqarishdan oldingi MAJBURIY tekshiruv (CLAUDE.md,
# 2026-08-13) bir necha kun noto'g'ri baza ustida "hammasi joyida"
# deb turgan. Endi tekshiruv BAZA QAYERDA BO'LSA O'SHA YERDA
# ishlaydi — noto'g'ri manbaga ulanish imkoni yo'q.
#
# Baza roli — `nspos`: faqat SELECT, lekin BYPASSRLS (07-api.sh).
# Ya'ni tekshiruv rahbar ko'radigan to'liq ma'lumotni ko'radi va
# hech narsa yoza olmaydi.
set -euo pipefail

SERVER="${NSPOS_SERVER:-root@169.58.216.246}"
KALIT="${NSPOS_KEY:-$HOME/.ssh/nspos}"
YOL="/opt/nspos/app"

[ -f "$KALIT" ] || { echo "SSH kaliti topilmadi: $KALIT"; exit 1; }

# `NSPOS_PG` serverdagi `api.env` dan olinadi — bitta joyda tursin.
# Parol bu yerda ko'rinmaydi: buyruq serverning o'zida ochiladi.
ssh -i "$KALIT" "$SERVER" "bash -s" <<UZOQ
set -euo pipefail
cd "$YOL"
PG=\$(grep '^NSPOS_PG=' /opt/nspos/api.env | cut -d= -f2-)
[ -n "\$PG" ] || { echo "NSPOS_PG topilmadi (/opt/nspos/api.env)"; exit 1; }
sudo -u nspos env NSPOS_PG="\$PG" npm run --silent tekshir
UZOQ
