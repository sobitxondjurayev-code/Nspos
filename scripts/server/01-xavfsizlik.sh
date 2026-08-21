#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# 1-QADAM: XAVFSIZLIK
# ══════════════════════════════════════════════════════════════
# Yangi Contabo serveri internetga OCHIQ holda keladi: root paroli
# bilan kirish yoqilgan va uni butun dunyo sinab ko'radi. Birinchi
# soatdayoq minglab urinish bo'ladi.
#
# Shuning uchun eng birinchi ish — eshikni yopish. Baza va ilova
# keyin.
#
# Bu skript QAYTA ishga tushirilsa xato bermaydi (idempotent).
set -euo pipefail

echo "── Tizim yangilanmoqda"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

echo "── Kerakli vositalar"
apt-get install -y -qq ufw fail2ban curl ca-certificates gnupg lsb-release rsync

# ── Parol bilan kirish YOPILADI ────────────────────────────────
# DIQQAT: bu qadamdan oldin SSH kalit ISHLAYOTGANIGA ishonch hosil
# qiling. Aks holda serverga kirish yo'li yopiladi va faqat Contabo
# panelidagi VNC orqali qutqarish mumkin bo'ladi.
if [ ! -s /root/.ssh/authorized_keys ]; then
  echo "!! /root/.ssh/authorized_keys BO'SH — parol yopilmaydi."
  echo '!! Avval ssh-copy-id bilan kalit qoshing, keyin qayta yuriting.'
  exit 1
fi

echo "── SSH: parol bilan kirish yopilmoqda"
# FAYL NOMI "00-" BILAN BOSHLANADI — bu MUHIM.
#
# sshd_config da BIRINCHI topilgan qoida g'olib bo'ladi (oxirgisi emas).
# Contabo obrazida `50-cloud-init.conf` bor va unda
# `PasswordAuthentication yes` yozilgan. Agar bizning faylimiz `99-`
# bo'lsa, u kechroq o'qiladi va cloud-init g'olib chiqadi — parol
# OCHIQ qoladi.
#
# Bu aynan shunday bo'ldi (2026-08-22): skript "parol yopildi" deb
# xabar berdi, `sshd -T` esa `passwordauthentication yes` ko'rsatdi.
# Xato faqat TEKSHIRUV tufayli topildi — shuning uchun har o'rnatishdan
# keyin `sshd -T` bilan AMALDAGI holat o'qiladi, skriptning xabariga
# ishonilmaydi.
mkdir -p /etc/ssh/sshd_config.d
cat > /etc/ssh/sshd_config.d/00-nspos.conf <<'SSHCONF'
# Faqat kalit bilan kirish. Parol butunlay o'chiriladi.
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
# Bo'sh parolli hisob bo'lsa ham kirolmaydi
PermitEmptyPasswords no
# Kirish urinishi cheklanadi
MaxAuthTries 3
SSHCONF
# cloud-init qatorini ham izohga aylantiramiz — ikki qavat himoya
if [ -f /etc/ssh/sshd_config.d/50-cloud-init.conf ]; then
  sed -i 's/^PasswordAuthentication yes/#PasswordAuthentication yes  # NSPOS: 00-nspos.conf da yopildi/' \
    /etc/ssh/sshd_config.d/50-cloud-init.conf
fi
sshd -t && systemctl reload ssh

# Skriptning xabariga emas, AMALDAGI holatga ishonamiz
if sshd -T | grep -q '^passwordauthentication yes'; then
  echo '!! DIQQAT: parol bilan kirish HALI OCHIQ — sozlama qollanmadi.'
  echo '!! /etc/ssh/sshd_config.d/ ichini tekshiring.' 
  exit 1
fi

echo "── Devor (ufw)"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment "SSH"
ufw allow 80/tcp   comment "HTTP"
ufw allow 443/tcp  comment "HTTPS"
# PostgreSQL (5432) va PostgREST (3001) ATAYLAB OCHILMAYDI —
# ular faqat serverning ichida ishlaydi. Bazani internetga ochish
# eng ko'p uchraydigan xato.
ufw --force enable

echo "── fail2ban (parol tanlashga qarshi)"
cat > /etc/fail2ban/jail.local <<'F2B'
[sshd]
enabled = true
maxretry = 3
findtime = 10m
bantime = 1h
F2B
systemctl enable --now fail2ban
systemctl restart fail2ban

echo "── Vaqt mintaqasi: Toshkent"
timedatectl set-timezone Asia/Tashkent

echo
echo "✓ 1-qadam tugadi"
echo "  SSH:      faqat kalit bilan"
echo "  Devor:    22, 80, 443 (baza tashqaridan YOPIQ)"
echo "  fail2ban: 3 urinishdan keyin 1 soat blok"
echo "  Vaqt:     $(date '+%d.%m.%Y %H:%M %Z')"
