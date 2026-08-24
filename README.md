# NSPOS — NScamera boshqaruv platformasi

Billz bermaydigan narsalar uchun: moliya, tahlil, KPI va oylik, ustalar
reytingi, hisobotlar. Savdo ma'lumoti Billz'dan API orqali keladi,
xarajat va boshqaruv NSPOS'da yuritiladi.

**Ishlab turgan sayt: https://tizim.enes.uz**

## Qanday qurilgan

- **Frontend** — Next.js 14 (App Router), React 18, Tailwind, Recharts
- **Baza** — o'z serverimizdagi PostgreSQL 17, RLS bilan
- **Bazaga murojaat** — PostgREST (`/rest/v1/`). `@supabase/supabase-js`
  paketi qolgan, lekin u endi shunchaki PostgREST mijozi: Supabase'ning
  o'zi ishlatilmaydi
- **Kirish** — o'z JWT'imiz (`lib/jwt.js`), parol bazadan chiqmaydi
  (`auth.kirish()`). Supabase Auth ishlatilmaydi
- **Server** — Contabo VPS, nginx + systemd: `nspos` (sayt),
  `nspos-api` (o'qish API), `nspos-bot` (Telegram)

Loyiha 2026-08-22/23 da Vercel + Supabase'dan o'z serveriga ko'chdi.
Sabablari va yo'l xaritasi — [DAFTAR.md](DAFTAR.md) 9–12-bo'limlar,
texnik tafsiloti — [scripts/sql/vps/O-QING.md](scripts/sql/vps/O-QING.md).

## Ishga tushirish

```bash
npm install
npm run dev        # http://localhost:3000
```

Baza kaliti berilmasa DEMO ma'lumot bilan ishlaydi. Bu ataylab —
kompyuterdagi ish produksiya bazasiga yozib qo'ymasligi kerak.

## Asosiy buyruqlar

```bash
npm run tekshir:server   # pul hisoblarini haqiqiy baza ustida tekshirish
npm run nomlar           # import qilinmagan nomlar (next build ko'rmaydi)
npm run billz -- --probe # Billz ulanishini sinash
bash scripts/server/chiqar.sh   # saytga chiqarish
```

## Tashqi API va bot

- `https://tizim.enes.uz/api/v1` — **faqat o'qish**, biznes tilida JSON
  (`Authorization: Bearer <token>`). Excel, tashqi vosita va AI agent
  uchun. Kod: `scripts/api/server.mjs`.
- Telegram boti — rahbar telefondan `/xulosa`, `/savdo`, `/kassa`,
  `/qarz` deb so'raydi. Bot bazaga ULANMAYDI, faqat yuqoridagi API'dan
  GET qiladi. Kod: `scripts/bot/`.

Ikkalasi ham raqamni o'zi hisoblamaydi — ekrandagi raqamni chiqaradigan
AYNAN o'sha funksiyalarni chaqiradi. Aks holda bir kun saytda bir raqam,
API'da boshqa raqam bo'lib qolardi.

## Avval o'qing

- **[DAFTAR.md](DAFTAR.md)** — loyiha boshidan beri barcha qarorlar,
  xatolar va yechimlar
- **[CLAUDE.md](CLAUDE.md)** — ish qoidalari
- **[TOPSHIRISH.md](TOPSHIRISH.md)** — yangi dasturchi uchun topshiruv
