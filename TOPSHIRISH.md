# NSPOS — dasturchiga topshiruv

NScamera uchun boshqaruv platformasi: Billz bermaydigan tahlil, KPI va
oylik, ustalar reytingi, moliya. Ishlab turgan sayt —
https://nspos.vercel.app

## Texnologiya

| Qatlam | Nima ishlatilgan |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS |
| Grafiklar | Recharts · Excel: SheetJS (`xlsx`) |
| Baza / Auth | Supabase (Postgres + Auth + RLS + Realtime) |
| Hosting | Vercel (loyiha nomi `nspos`), kunlik cron `/api/backup` 02:00 UTC |

## Papkalar

```
app/          — sahifalar (App Router) va API yo'llari (app/api)
components/   — interfeys bo'laklari
lib/          — biznes-mantiq: hisob-kitob, baza, yuklamalarni o'qish
scripts/      — baza migratsiyasi va tekshiruv skriptlari
```

Muhim: **bir tushuncha — bitta funksiya**. Ish haqi `payrollData.payrollCost()`,
kassa qoldig'i `kassaBalances()`. Yangi sahifada boshqacha hisob yozilmaydi,
o'sha funksiyaga parametr qo'shiladi.

## Ishga tushirish

```bash
npm install
cp .env.example .env.local   # kalitlarni to'ldiring (pastga qarang)
npm run dev                  # http://localhost:3000
```

Supabase sozlanmasa tizim demo ma'lumot bilan ishlaydi.

## Kerakli kalitlar (`.env.local` — repoda YO'Q, alohida beriladi)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY     # faqat serverda: /api/staff, /api/backup
SUPABASE_ACCESS_TOKEN         # scripts/sql.mjs migratsiyalari uchun
```

## Kundalik buyruqlar

```bash
node scripts/sql.mjs "alter table ..."          # baza migratsiyasi
node scripts/sql.mjs -f scripts/sql/fayl.sql
npm run tekshir                                 # pul hisoblarini tekshirish
npx vercel --prod --yes --scope urinboevmirjalol-8358s-projects
```

`npm run tekshir` haqiqiy baza bo'yicha hamyon balansi, ikkilangan to'lov,
bog'lanmagan yozuv va kassaga tushmagan kirimni tekshiradi. **Xato chiqsa
saytga chiqarilmaydi.**

## Avval o'qing

- **[DAFTAR.md](DAFTAR.md)** — loyiha boshidan beri barcha qarorlar, xatolar
  va yechimlar. Yangi ish oldidan javob shu yerda bor-yo'qligi qaraladi.
- **[CLAUDE.md](CLAUDE.md)** — ish qoidalari (ikki valyuta, jadval
  qoidalari, rang mantiqi, xarajat turlari va h.k.).

## Alohida topshiriladi (repoda yo'q)

1. `.env.local` kalitlari — xavfsiz kanal orqali
2. Supabase loyihasiga taklifnoma
3. Vercel loyihasiga taklifnoma (`nspos`)
