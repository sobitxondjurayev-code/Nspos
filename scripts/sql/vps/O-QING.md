# VPS'ga ko'chirish — qadamma-qadam

Bu papkadagi uch fayl toza PostgreSQL'da NSPOS bazasini noldan quradi.
Mahalliy Postgres 17 da sinalgan: manba bilan **aynan mos** chiqdi —
39 jadval · 6 ko'rinish · 418 ustun · 98 indeks · 154 cheklov ·
56 siyosat · 5 tetik.

## Nima uchun `supabase db dump` emas

Supabase'ning tayyor dumpi oddiy Postgres'ga **tushmaydi**: unda
`auth`, `storage`, `realtime`, `graphql` sxemalari, `supabase_admin`
va `authenticator` rollari, `supabase_vault` kengaytmasi bor. Toza
serverda bularning hech biri yo'q va tiklash birinchi qatordayoq
to'xtaydi. Shuning uchun sxema bazaning o'zidan, tozalab olinadi:

```bash
node scripts/sxema-olish.mjs      # → 01-sxema.sql ni qayta yozadi
```

Skript faqat **o'qiydi** — manbaga tegmaydi.

## Fayllar tartibi

| Fayl | Nima qiladi | Qo'lda yozilganmi |
|---|---|---|
| `00-shim.sql` | `auth` sxemasi: `uid()`, `role()`, `users` jadvali, `kirish()`; rollar | ha |
| `01-sxema.sql` | turlar, ketma-ketliklar, funksiyalar, jadvallar, cheklovlar, indekslar, ko'rinishlar, tetiklar, RLS | yo'q — avtomat |
| `99-huquq.sql` | mavjud jadvallarga huquq, egalikni `nspos_owner` ga o'tkazish | ha |

Tartib **majburiy**: `01` dagi to'rtta tashqi kalit `auth.users` ga
tayanadi, RLS siyosatlari esa `auth.uid()` ga.

## Ikki qaror, sababi bilan

**1. RLS siyosatlari qayta yozilmadi.** 56 ta siyosat `auth.uid()` ga
murojaat qiladi. Ularni qo'lda ko'chirish o'rniga `auth.uid()` ning
o'zi yozildi — u ulanish sozlamasidan o'qiydi:

```sql
select set_config('app.user_id', '<foydalanuvchi id>', true);
```

`true` — faqat shu tranzaksiya uchun. Ulanish havzasida bu muhim:
aks holda oldingi foydalanuvchi keyingi so'rovga qolib ketardi.

Siyosatlar bir harf ham o'zgarmadi. Pul va maosh ko'rinishini
boshqaradigan 56 ta qoidani qo'lda ko'chirish eng katta xavf edi.

**2. Parollar o'z holicha ko'chadi.** Supabase ularni bcrypt (`$2a$`)
bilan saqlaydi, `pgcrypto` esa uni tushunadi. 16 ta xodim **hozirgi
paroli bilan** kiraveradi. Xesh ilovaga berilmaydi: ilova
`auth.kirish(email, parol)` ni chaqiradi, u faqat `id` qaytaradi.

## Uch rol — nega

RLS jadval **egasiga qo'llanmaydi**. Ilova jadval egasi bo'lib ulansa
butun himoya jimgina o'chadi va buni hech qanday xato ko'rsatmaydi.

| Rol | Kim ishlatadi | RLS |
|---|---|---|
| `nspos_owner` | migratsiya | ega (RLS tegmaydi) |
| `nspos_app` | ilova | **ishlaydi** |
| `nspos_sync` | Billz sinxronizatsiyasi, zaxira | `bypassrls` |

Parollar bu fayllarda yo'q — serverda qo'yiladi:

```sql
alter role nspos_app  with password '…';
alter role nspos_sync with password '…';
```

## Bajarish

```bash
# 1. Baza
createdb nspos

# 2. Sxema
psql -d nspos -v ON_ERROR_STOP=1 -f scripts/sql/vps/00-shim.sql
psql -d nspos -v ON_ERROR_STOP=1 -f scripts/sql/vps/01-sxema.sql
psql -d nspos -v ON_ERROR_STOP=1 -f scripts/sql/vps/99-huquq.sql

# 3. Ma'lumot (manbaga tegmaydi, faqat o'qiydi)
node scripts/kochirish.mjs --target "postgres://nspos_owner@SERVER/nspos"
```

Oxirgi buyruq ko'chirgach **o'zi solishtiradi**: har jadval bo'yicha
qator soni va pul yig'indisi ikki tomonda teng chiqishi kerak. Farq
bo'lsa `1` qaytaradi.

## Eski baza o'chirilmaydi

Supabase o'z holicha qoladi — yangi tizim to'liq ishlaganiga ishonch
hosil bo'lgunicha qaytish yo'li bo'lib turadi. Bu
[[nspos-hech-narsa-ochirilmasin]] qoidasining davomi.

## Keyin nima qoladi

Sxema va ma'lumot ko'chdi, lekin ilova hali Supabase'ga qaraydi.
Qolgan uchta bo'lak:

1. **Kirish** — `lib/db.js` va `lib/auth.js` Supabase Auth o'rniga
   `auth.kirish()` ga o'tadi (sessiya, cookie, chiqish).
2. **Jonli yangilanish** — Supabase Realtime o'rniga `LISTEN/NOTIFY`.
   `useLive()` naqshi o'zgarmaydi, faqat manbasi almashadi.
3. **So'rovlar** — `syncTable` PostgREST yozuvida so'raydi
   (`select "*, debt_payments(...)"`). Bu qatlam SQL ga o'giriladi.
