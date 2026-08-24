#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# NSPOS TELEGRAM BOTI
# ══════════════════════════════════════════════════════════════
#   bash scripts/server/11-bot.sh [chat_id,chat_id,…]
#
# Chat raqami berilmasa — `.env.production` dagi TELEGRAM_CHAT_ID
# (zaxira yuboriladigan chat, ya'ni rahbarning o'zi).
#
# NEGA ALOHIDA XIZMAT:
# Bot uzluksiz Telegram'ni tinglab turadi (long-polling). Uni sayt
# ichiga qo'yib bo'lmaydi — Next.js jarayoni har chiqarishda qayta
# ishga tushadi va o'sha payt xabarlar yo'qolardi.
#
# NEGA WEBHOOK EMAS:
# Webhook uchun tashqaridan kiradigan yo'l ochish kerak. Long-polling
# da bog'lanishni bot O'ZI boshlaydi — nginx'ga bitta ham yangi yo'l
# qo'shilmaydi, ya'ni tashqi hujum yuzasi kengaymaydi.
#
# BOT BAZAGA ULANMAYDI:
# U faqat `http://127.0.0.1:3002` (nspos-api) ga GET qiladi. Baza
# paroli botda umuman yo'q — token o'g'irlansa ham yozib bo'lmaydi.
set -euo pipefail

YOL=/opt/nspos/app
ENVF=/opt/nspos/bot.env
PROD=$YOL/.env.production
APIENV=/opt/nspos/api.env

[ -f "$PROD" ]   || { echo "topilmadi: $PROD"; exit 1; }
[ -f "$APIENV" ] || { echo "topilmadi: $APIENV — avval 07-api.sh ni ishlating"; exit 1; }

BOT_TOKEN=$(grep '^TELEGRAM_BOT_TOKEN=' "$PROD" | cut -d= -f2- || true)
API_TOKEN=$(grep '^NSPOS_API_TOKEN=' "$APIENV" | cut -d= -f2- || true)
RUXSAT=${1:-$(grep '^TELEGRAM_CHAT_ID=' "$PROD" | cut -d= -f2- || true)}

[ -n "$BOT_TOKEN" ] || { echo "TELEGRAM_BOT_TOKEN yo'q ($PROD)"; exit 1; }
[ -n "$API_TOKEN" ] || { echo "NSPOS_API_TOKEN yo'q ($APIENV)"; exit 1; }
[ -n "$RUXSAT" ]    || { echo "Chat raqami yo'q. Bering: bash $0 123456789"; exit 1; }

# ── Sozlama fayli ─────────────────────────────────────────────
# 600 va nspos:nspos — ichida IKKI sir bor: bot tokeni va API
# tokeni. API tokeni rahbarning butun moliyasini ochadi.
cat > "$ENVF" <<ICHI
TELEGRAM_BOT_TOKEN=$BOT_TOKEN
TELEGRAM_RUXSAT=$RUXSAT
NSPOS_API_URL=http://127.0.0.1:3002
NSPOS_API_TOKEN=$API_TOKEN
ICHI
chmod 600 "$ENVF"
chown nspos:nspos "$ENVF"

cat > /etc/systemd/system/nspos-bot.service <<'ICHI'
[Unit]
Description=NSPOS Telegram boti (faqat o'qish)
After=network-online.target nspos-api.service
Wants=network-online.target
Requires=nspos-api.service

[Service]
Type=simple
User=nspos
WorkingDirectory=/opt/nspos/app
EnvironmentFile=/opt/nspos/bot.env
ExecStart=/usr/bin/node scripts/bot/bot.mjs
Restart=always
RestartSec=10
# Bot hech narsa yozmaydi — fayl tizimi faqat o'qish uchun
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
ICHI

systemctl daemon-reload
systemctl enable --now nspos-bot
sleep 5

# ── HAQIQIY TEKSHIRUV ─────────────────────────────────────────
# `is-active` yetarli emas: qayta-qayta o'chib yonayotgan xizmat ham
# o'sha lahzada "active" ko'rinadi (07-api.sh dagi bilan bir xil
# mulohaza). Shuning uchun Telegram'ning O'ZIDAN so'raymiz.
systemctl is-active nspos-bot >/dev/null || { journalctl -u nspos-bot -n 30 --no-pager; exit 1; }

nom=$(curl -s --max-time 15 "https://api.telegram.org/bot$BOT_TOKEN/getMe" \
      | grep -oE '"username":"[^"]+"' | cut -d'"' -f4 || true)
[ -n "$nom" ] || { echo "Telegram javob bermadi — token noto'g'ri bo'lishi mumkin"; journalctl -u nspos-bot -n 30 --no-pager; exit 1; }

# Birinchi ruxsatli chatga xabar: bot ishga tushgani ko'rinsin
bosh=$(printf '%s' "$RUXSAT" | cut -d, -f1)
curl -s -o /dev/null --max-time 15 -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
  -H 'content-type: application/json' \
  -d "{\"chat_id\":\"$bosh\",\"text\":\"NSPOS boti ishga tushdi. /yordam\"}"

echo "✓ Bot tayyor: @$nom"
echo "  ruxsat: $RUXSAT"
echo "  jurnal: journalctl -u nspos-bot -f"
echo
echo "  Chat raqamini bilmasangiz: botga /start yozing, keyin"
echo "  journalctl -u nspos-bot -n 20 — u yerda [ruxsatsiz] chat=… ko'rinadi."
