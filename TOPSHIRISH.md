# NSPOS — dasturchiga topshiruv

NScamera uchun boshqaruv platformasi: Billz bermaydigan tahlil, KPI va
oylik, ustalar reytingi, moliya. Ishlab turgan sayt —
https://tizim.enes.uz

## Texnologiya

| Qatlam | Nima ishlatilgan |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS |
| Grafiklar | Recharts · Excel: SheetJS (`xlsx`) |
| Baza | O'z serverimizdagi PostgreSQL 17 + RLS |
| Bazaga murojaat | PostgREST (`/rest/v1/`). `@supabase/supabase-js` — faqat so'rov yozish uslubi, Supabase'ning o'zi YO'Q |
| Kirish | O'z JWT'imiz (`lib/jwt.js`, in-DB `auth.kirish()`). Supabase Auth ishlatilmaydi |
| Server | Contabo VPS · nginx · systemd (`nspos`, `nspos-api`, `nspos-bot`) |
| Cron | Billz sinxroni 30 daqiqada · `pg_dump` 03:00 · tashqi zaxira 03:15 |

2026-08-22/23 da loyiha Vercel + Supabase'dan o'z serveriga ko'chdi.
Eski manzillar (`nspos.vercel.app`, `nspos-psi.vercel.app`) va eski
Supabase yopilgan — qaytarilmaydi. Sabablari DAFTAR 9–12-bo'limlarda.

## Papkalar

```
app/            — sahifalar (App Router) va API yo'llari (app/api)
components/     — interfeys bo'laklari
lib/            — biznes-mantiq: hisob-kitob, baza, yuklamalarni o'qish
scripts/        — migratsiya va tekshiruv skriptlari
scripts/server/ — serverni sozlash, tartib bilan: 00…12
scripts/api/    — tashqi o'qish API (port 3002)
scripts/bot/    — Telegram boti
```

Muhim: **bir tushuncha — bitta funksiya**. Ish haqi `payrollData.payrollCost()`,
kassa qoldig'i `kassaBalances()`. Yangi sahifada boshqacha hisob yozilmaydi,
o'sha funksiyaga parametr qo'shiladi. Sayt, tekshiruv skripti, API va bot —
to'rttasi ham AYNAN shu funksiyalarni chaqiradi.

## Ishga tushirish (kompyuterda)

```bash
npm install
npm run dev                  # http://localhost:3000
```

Baza kaliti berilmasa ilova DEMO ma'lumot bilan ishlaydi — bu ataylab:
lokal ish produksiya bazasiga yozmasligi kerak.

## Kerakli kalitlar

Kompyuterda kalit shart emas. Serverda ular uch faylda turadi (600,
`nspos:nspos`) va repoga hech qachon tushmaydi:

```
/opt/nspos/app/.env.production   DATABASE_URL · JWT_SECRET · CRON_SECRET
                                 BILLZ_SECRET_TOKEN · TELEGRAM_* · DRIVE_BACKUP_URL
/opt/nspos/api.env               NSPOS_API_TOKEN · NSPOS_PG · NSPOS_API_PORT
/opt/nspos/bot.env               TELEGRAM_BOT_TOKEN · TELEGRAM_RUXSAT · NSPOS_API_TOKEN
```

`NSPOS_API_TOKEN` = rahbarning O'QISH huquqi (butun moliya). Xodimga berilmaydi.

## Kundalik buyruqlar

```bash
node scripts/sql.mjs -f scripts/sql/fayl.sql   # baza migratsiyasi
npm run nomlar                                 # import qilinmagan nomlar
npm run tekshir:server                         # pul hisoblarini tekshirish
bash scripts/server/chiqar.sh                  # saytga chiqarish
```

`npm run tekshir:server` haqiqiy baza bo'yicha hamyon balansi, ikkilangan
to'lov, bog'lanmagan yozuv va kassaga tushmagan kirimni tekshiradi.
**Xato chiqsa saytga chiqarilmaydi.**

Nega `:server` — baza serverda, kompyuterda ulanish yo'q. Oddiy
`npm run tekshir` lokal sozlama qayerga qarasa o'shani tekshiradi va
2026-08-23 gacha bir necha kun MUZLAB QOLGAN nusxani tekshirib
"hammasi joyida" deb turgan edi.

## Avval o'qing

- **[DAFTAR.md](DAFTAR.md)** — loyiha boshidan beri barcha qarorlar, xatolar
  va yechimlar. Yangi ish oldidan javob shu yerda bor-yo'qligi qaraladi.
- **[CLAUDE.md](CLAUDE.md)** — ish qoidalari (ikki valyuta, jadval
  qoidalari, rang mantiqi, xarajat turlari va h.k.).
- **[scripts/sql/vps/O-QING.md](scripts/sql/vps/O-QING.md)** — serverga
  ko'chirish qanday qilingani va nima uchun.

## Alohida topshiriladi (repoda yo'q)

1. Serverga SSH kaliti (`~/.ssh/nspos`)
2. `.env.production` dagi kalitlar — xavfsiz kanal orqali
3. GitHub repoga taklifnoma
