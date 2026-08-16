# NSPOS — loyiha qoidalari

Bu fayl har sessiyada avtomatik o'qiladi. Ishni boshlashdan oldin
quyidagi fidbek qoidalarini o'qing va so'ralmasdan qo'llang.

> ## MAJBURIY BIRINCHI QADAM
> Har yangi sessiyada, birinchi topshiriqqa kirishishdan OLDIN
> **[DAFTAR.md](DAFTAR.md)** ni o'qing. U yerda loyiha boshidan beri
> yig'ilgan qarorlar, xatolar va yechimlar bor.
>
> Savol yoki topshiriq kelganda avval o'sha faylda javob bor-yo'qligini
> qarang: bo'lsa — o'shani oling, qaytadan o'ylab topmang. Faqat
> topilmasa yangidan mulohaza qiling.
>
> Har yangi qaror, xato yoki fidbekdan keyin DAFTAR.md ga qator qo'shing:
> qisqa qoida shu faylga, sabab va tafsilot DAFTAR.md ga.

## Fidbek qoidalari
<!-- Bu bo'limni fidbek-xotira skilli yuritadi. Har ish oldidan o'qilsin. -->

- [2026-08-06] Javoblar qisqa bo'lsin — bir necha qator. Uzun xususiyat tavsiflari, ortiqcha izoh va takror yozilmasin.
- [2026-08-06] Ish oxirigacha o'zim bajarilsin: baza migratsiyasi `scripts/sql.mjs` orqali, tekshiruv brauzerda, so'ng `npx vercel --prod` bilan saytga chiqariladi. Foydalanuvchiga faqat parol/kirish kabi jismonan qila olmaydigan qadam qoldiriladi.
- [2026-08-06] Har o'zgarishdan keyin saytga chiqarilsin (nspos.vercel.app) — foydalanuvchi lokal serverda emas, saytda ishlaydi.
- [2026-08-06] So'mda kiritilgan har qanday summaning ASL raqami saqlansin (`companyData.fromSom`): dollardan qaytarib hisoblab ko'rsatilmasin, aks holda 10 000 → 9 985 bo'lib ketadi.
- [2026-08-06] Xarajat turlari haqida gapirilganda "qat'iy" emas, **"doimiy"** deyilsin. ("Qat'iy maosh" — ish haqi atamasi, u o'zgarmaydi.)
- [2026-08-15] "Shu oyga faqat" deb aytilgan cheklov O'CHIRILMASIN — istisno oy ro'yxatiga qo'shilsin (masalan `kpiData.PAY_ANY_DAY_MONTHS`). Keyingi oyda qoida o'zi qaytadi, foydalanuvchi buni eslatib o'tirmaydi.
- [2026-08-15] Rahbarga pul o'tkazmasi Xarajatlar ro'yxatida ham ko'rinsin, lekin "Jami xarajat"ga QO'SHILMASIN: pul kassadan chiqadi-yu, kompaniyadan chiqmaydi (kompaniya balansiga ko'chadi). Jami ostida alohida qator bo'lib turadi. Haqiqiy xarajat — NS (rahbar o'ziga olgan pul).
- [2026-08-06] Rahbarlar (owner) oylik olmaydi — KPI, ish haqi va maosh hisoblarida ko'rinmasin. Ular pulni NS (kassadan olingan shaxsiy pul) orqali oladi.
- [2026-08-06] Bo'sh yoki ishlatilmaydigan bo'limlar menyuda turmasin (masalan Smenalar — u Billz'da yuritiladi). Sahifa kodda qolsin, faqat menyudan olinsin.
- [2026-08-06] Interfeys 90% o'lchamda chizilsin — brauzer 100% zoomda ham ixcham ko'rinsin.
- [2026-08-06] Jadvallarda ustun tartibini foydalanuvchi o'zi sozlaydi ("Ustunlar" tugmasi, Meta Ads Manager naqshi), "Jami" qatori jadval TEPASIDA turadi, pastda takrorlanmaydi.
- [2026-08-06] "Jami" qatori sarlavha bilan BIRGA pin bo'ladi: `<thead>` ichiga, sarlavha qatoridan keyin qo'yiladi, `thead` ga `sticky top-0`, o'rami esa `overflow-auto max-h-[70vh]` bo'ladi. Qator foni SHAFFOFMAS (`bg-panel`/`bg-surface`) — shaffof bo'lsa tagidagi qatorlar ko'rinib, raqamlar ustma-ust tushadi.
- [2026-08-06] Har jadvalda: sarlavha pin, sana/ism ustuni chapda pin, filtr va Jami bo'ladi — bularni har safar aytish shart emas.
- [2026-08-06] Davr (sana oralig'i) tanlansa jadvaldagi HAMMA ustun o'sha davr bo'yicha hisoblansin. Bir ustun davr bo'yicha, ikkinchisi oylik bo'lib qolmasin ("0 kamera, lekin 320 000 ishlab topgan" chiqadi) — aks holda sanani tanlashning ma'nosi yo'q.
- [2026-08-06] Jadvaldagi yig'ma raqam bosiladigan bo'lsin: ustiga bosilganda o'sha summa qaysi yozuvlardan yig'ilgani (sana, kim/nima uchun, qancha) ro'yxat bo'lib ochilsin.
- [2026-08-07] Servis puli "Jami tushum"ga KIRADI: Billz'da montaj oddiy tovar kabi sotiladi, ya'ni u "Savdo" ustuni ichida. Chiqarib tashlansa nasiya aynan servis summasiga oshib ketadi.
- [2026-08-07] Sana solishtirilganda Date'ni String() qilmang — "Sat Aug 01 2026..." chiqadi va taqqoslash buziladi (jadval bo'sh ko'rinadi). Davr tanlagichi (`periodRange`) Date qaytaradi, jadvaldagi sana esa "YYYY-MM-DD".
- [2026-08-06] Rang mantiqi pul nuqtai nazaridan bo'lsin: pul kelmagani/qarz (nasiya musbat) — QIZIL, pul tushgani yoki qarz yopilgani — YASHIL.
- [2026-08-06] Rejadagi to'lov to'liq to'lanmasligi mumkin. "To'ladim" bosilganda qancha berilgani so'raladi, qolgani esa yangi muddat bilan rejada turaveradi.
- [2026-08-06] Yangi bo'lim/jadval qo'shilganda: davr tanlash (Kecha/Bugun/Hafta/Oy/Yil), filtr va Jami bo'lishi kutiladi.
- [2026-08-13] Kassa KUNLIK yopiladi: har kun uchun alohida sana, o'sha kunning kirimi/chiqimi/qoldig'i va "qancha bilan yopilgan yoki yopilmagan" holati. Kassa ichiga kirilganda kunma-kun jadval turadi.
- [2026-08-06] Yangi ustun/maydon qo'shilsa, uning JAMISI, filtri va hisobotdagi o'rni ham o'sha zahoti qo'shilsin — foydalanuvchi buni alohida aytib o'tirmasligi kerak. Iloji bo'lsa umumiy qilib yozilsin (masalan jami qatori ustun ro'yxatidan avtomat yig'sin), toki keyingi ustunda takrorlanmasin.

- [2026-08-13] Yuklamaga (Billz eksporti) tayanadigan sahifa qatorlarni `useUploadRows` bilan tortsin va qaytgan belgini BARCHA useMemo bog'lamlariga qo'shsin — aks holda ekranda 0 turadi. Sana taqqoslansa `ymd()` ishlatilsin, `String(sana).slice()` emas.
- [2026-08-13] Moliya bo'limlari nomi yonida rasmiy buxgalteriya termini tursin (P&L, Cash flow, Balance sheet, OPEX, Payroll, AR/AP) — hisobchi bilan gaplashganda qaysi hisobot ekani aniq bo'lsin.
- [2026-08-13] Menejer ustaga login/parolni Sozlamalardan o'zi ochadi va tiklaydi (faqat USTA roli). Xodimga rol berish kengaytirilsa cheklov ALBATTA serverda (`/api/staff`) bo'lsin — RLS ustunni yashira olmaydi, ya'ni qator ochilsa oylik va ruxsatlar ham ochilib ketadi.
- [2026-08-13] Bir papkada bir necha suhbat ishlashi mumkin — ishlar ARALASHIB KETMASIN. `git add -A`, `git add .` va `git commit -a` ISHLATILMAYDI: faqat o'zim o'zgartirgan fayllar nomma-nom qo'shiladi. Vaqtinchalik fayl loyiha ildiziga yozilmaydi — `.tmp/` ichiga (u gitignore'da). Kommit oldidan `git status` ko'riladi: begona fayl ko'rinsa unga tegilmaydi. **Saytga chiqarishdan oldin ham** `git status` ALOHIDA qadam bo'lib tekshiriladi (`vercel` bilan bitta qatorda emas — aks holda natijani ko'rib to'xtab bo'lmaydi): toza bo'lmasa chiqarilmaydi, chunki `vercel` papkadagi holicha yuboradi va begona suhbatning yarim ishi ham saytga chiqib ketadi.
- [2026-08-14] "Bu raqam ana u raqamga teng bo'lishi kerak" degan har qanday fidbek KODGA aylantirilsin: `lib/moslik.js` dagi `CHECKS` ro'yxatiga qo'shiladi. "Bunday ma'lumot xato" degani esa `lib/audit.js` ga. Shunda qoida ikkinchi marta aytilmaydi — u `npm run tekshir` da ham, ilova ichidagi "Tekshirib ko'ring" kartochkasida ham o'zi tekshiriladi. Fidbekni faqat DAFTAR'ga yozib qo'yish YETARLI EMAS.
- [2026-08-14] Tekshiruv skriptida formula QAYTA YOZILMAYDI — u ilovaning o'z funksiyalarini chaqiradi (`scripts/lib/yuk.mjs`). Aks holda skript "hammasi joyida" deb turadi-yu, ekranda boshqa raqam turadi.
- [2026-08-14] Bir tushuncha — bitta funksiya. Ish haqi uchun `payrollData.payrollCost()`, kassa qoldig'i uchun `kassaBalances()`. Yangi sahifada "shu yerda boshqacharoq kerak" bo'lsa, o'sha funksiyaga parametr qo'shiladi, yangi hisob yozilmaydi.
- [2026-08-13] Pulga tegadigan har o'zgarishdan keyin `npm run tekshir` ishga tushirilsin — u HAQIQIY baza bo'yicha hamyon balansi, ikkilangan to'lov, bog'lanmagan yozuv va kassaga tushmagan kirimni tekshiradi. Xato chiqsa saytga CHIQARILMAYDI.
- [2026-08-13] Bir qoida aytilsa u TEGISHLI HAMMA JOYGA qo'llansin: bir bo'limda tushuntirilgan narsani foydalanuvchi boshqa bo'lim uchun qaytadan tushuntirmasin. O'zgartirishdan oldin o'sha ma'lumot qayerlarda ishlatilishini (grep bilan) tekshirib chiqing — Xarajatlar, Pul rejasi, Kassa, P&L, Ish haqi, hisobotlar.
- [2026-08-13] Modul xotirasidan o'qiydigan har `useMemo` bog'lamiga `useLive()` qo'shilsin. Demo qiymatdan boshlanadigan modulda (masalan `staffData`) busiz ekranda soxta ro'yxat qotib qoladi — xato bo'sh ekran emas, ishonarli yolg'on bo'lib chiqadi.

## Loyiha haqida

NSPOS — NScamera uchun boshqaruv platformasi. Billz bermaydigan narsalar
uchun: tahlil, KPI va oylik, ustalar reytingi, moliya.

- Baza: Supabase (`scripts/sql.mjs` orqali migratsiya)
- Sayt: https://nspos.vercel.app (`npx vercel --prod`)
- Ikki valyuta: savdo/moliya dollarda, oylik va xarajat so'mda — kurs
  `companies.usd_rate` da, tarixi `usd_rates` jadvalida
