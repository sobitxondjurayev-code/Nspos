# NSPOS — Billz uslubidagi do'kon boshqaruv tizimi

Retail do'konlar uchun POS, ombor, mijozlar, marketing, hisobotlar va moliya — barchasi bitta tizimda. **1-bosqich (poydevor)** tayyor.

## Hozir nima bor (1-bosqich)

- Billz uslubidagi interfeys: chap sidebar (Tovarlar, Sotuvlar, Mijozlar, Marketing, Hisobotlar, Moliya, Boshqaruv, Sozlamalar)
- Dashboard: davr tanlash (Kecha/Bugun/Hafta/Oy/Yil), do'konlar kesimida sotuvlar grafigi, hover tooltip, do'konlar summasi, umumiy summa
- Login sahifasi (Supabase auth bilan)
- Multi-tenant baza sxemasi: kompaniyalar, do'konlar, xodimlar (owner/manager/cashier rollari), mahsulotlar, qoldiqlar, sotuvlar — Row Level Security bilan
- **Demo rejim**: Supabase sozlanmagan bo'lsa ham tizim demo ma'lumotlar bilan ishlaydi

## Ishga tushirish

```bash
npm install
npm run dev
```

Brauzerda http://localhost:3000 oching. Supabase sozlanmaguncha demo rejimda ishlaydi.

## Supabase ulash (bepul)

1. https://supabase.com da bepul akkaunt oching, yangi loyiha yarating
2. SQL Editor'ga `supabase/schema.sql` faylini nusxalab ishga tushiring
3. Loyiha ildizida `.env.local` yarating:

```
NEXT_PUBLIC_SUPABASE_URL=https://SIZNING-LOYIHA.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SIZNING-ANON-KALIT
```

4. Serverni qayta ishga tushiring — endi haqiqiy autentifikatsiya ishlaydi

## Deploy (bepul)

Netlify yoki Vercel'ga ulang, env o'zgaruvchilarni qo'shing — tayyor.

## Keyingi bosqichlar

2. Tovarlar moduli (katalog, kategoriyalar, shtrix-kod, kirim, Excel import)
3. POS kassa (savat, to'lovlar, chek, qaytarish, smena)
4. Dashboard'ni real ma'lumotlarga ulash
5. Mijozlar + Marketing (cashback, chegirmalar)
6. Hisobotlar + Moliya
7. Sozlamalar, transfer, inventarizatsiya
