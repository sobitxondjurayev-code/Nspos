#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# 2-QADAM: POSTGRESQL 17
# ══════════════════════════════════════════════════════════════
# Ubuntu 24.04 ning o'z omborida PostgreSQL 16 bor. Bizga 17 kerak:
# manba baza (Supabase) 17.6 da, sxema mahalliy 17.10 da sinaldi.
# Katta versiya farqi bilan `pg_dump` va sxema mos kelmasligi mumkin.
#
# Baza TASHQARIGA CHIQARILMAYDI: faqat `localhost` da tinglaydi va
# devor ham 5432 ni yopiq tutadi. Ilova va PostgREST shu serverning
# o'zida ishlaydi, ya'ni tashqi ulanish umuman kerak emas.
set -euo pipefail

# ── Swap ──────────────────────────────────────────────────────
# Serverda swap YO'Q edi (7.8 GB RAM, 0 B swap). Baza xotira
# so'raganda swap bo'lmasa, Linux OOM-killer jarayonni o'ldiradi —
# odatda eng ko'p xotira ishlatganini, ya'ni Postgres'ning o'zini.
# 2 GB swap "sekinlashadi, lekin o'lmaydi" degani.
if ! swapon --show | grep -q .; then
  echo "── Swap yaratilmoqda (2 GB)"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap -q /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  # Swap FAQAT chorasizlikda ishlatilsin — baza uchun disk sekin
  sysctl -qw vm.swappiness=10
  grep -q '^vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
else
  echo "── Swap allaqachon bor"
fi

# ── PostgreSQL 17 (PGDG ombori) ───────────────────────────────
if ! command -v psql >/dev/null 2>&1 || ! psql --version | grep -q " 17"; then
  echo "── PGDG ombori qo'shilmoqda"
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
  apt-get update -qq
  echo "── PostgreSQL 17 o'rnatilmoqda"
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql-17 postgresql-client-17
else
  echo "── PostgreSQL 17 allaqachon o'rnatilgan"
fi

PGCONF=/etc/postgresql/17/main/conf.d/nspos.conf
mkdir -p "$(dirname "$PGCONF")"

# ── Sozlash ───────────────────────────────────────────────────
# 4 yadro, 7.8 GB RAM, SSD. Raqamlar shu serverga moslangan —
# boshqa serverda qayta hisoblanadi.
cat > "$PGCONF" <<'PGC'
# NSPOS sozlamalari. Standart qiymatlar 1990-yillardagi kichik
# serverlar uchun tanlangan va ular hech qachon o'zgartirilmagan —
# shuning uchun har o'rnatishda qo'lda moslash kerak.

# Faqat shu serverdan ulanish. Tashqi ulanish KERAK EMAS: ilova ham,
# PostgREST ham shu yerda ishlaydi.
listen_addresses = 'localhost'

# RAM ning ~25 % i. Postgres o'z keshini shu yerda tutadi.
shared_buffers = 2GB
# Tizim keshini ham hisobga olib, rejalashtiruvchi qaror qiladi
effective_cache_size = 5GB
# Bitta saralash/xesh amali uchun. Ko'p ulanish bo'lsa RAM ko'payadi,
# shuning uchun ehtiyot bilan.
work_mem = 16MB
# VACUUM, indeks qurish, ALTER — kamdan-kam, lekin katta amallar
maintenance_work_mem = 512MB

# SSD: tasodifiy o'qish deyarli ketma-ket o'qish kabi arzon.
# Standart 4.0 aylanma disk uchun — u indeksdan voz kechtiradi.
random_page_cost = 1.1
effective_io_concurrency = 200

max_connections = 100

# Jurnal: sekin so'rovlar ko'rinib tursin
log_min_duration_statement = 1000
log_line_prefix = '%m [%p] %u@%d '
PGC

systemctl restart postgresql@17-main
systemctl enable -q postgresql@17-main

# ── Baza ──────────────────────────────────────────────────────
# Kodlash UTF-8 va solishtirish tartibi — o'zbekcha matn to'g'ri
# saralanishi uchun. Standart "C" bo'lsa "Ў" va "ў" turli joyga
# tushadi.
if ! su - postgres -c "psql -tAc \"select 1 from pg_database where datname='nspos'\"" | grep -q 1; then
  echo "── nspos bazasi yaratilmoqda"
  su - postgres -c "createdb --encoding=UTF8 --lc-collate=C.UTF-8 --lc-ctype=C.UTF-8 --template=template0 nspos"
else
  echo "── nspos bazasi allaqachon bor"
fi

echo
echo "✓ 2-qadam tugadi"
su - postgres -c "psql -tAc 'select version()'" | sed 's/^/  /'
echo "  Tinglayapti: $(su - postgres -c "psql -tAc 'show listen_addresses'")"
echo "  Swap:        $(free -h | awk '/^Swap:/{print $2}')"
