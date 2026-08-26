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
- [2026-08-06] Ish oxirigacha o'zim bajarilsin: baza migratsiyasi `scripts/sql.mjs` orqali, tekshiruv brauzerda, so'ng `bash scripts/server/chiqar.sh` bilan saytga chiqariladi. Foydalanuvchiga faqat parol/kirish kabi jismonan qila olmaydigan qadam qoldiriladi.
- [2026-08-06] Har o'zgarishdan keyin saytga chiqarilsin (tizim.enes.uz) — foydalanuvchi lokal serverda emas, saytda ishlaydi.
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
- [2026-08-13] Bir papkada bir necha suhbat ishlashi mumkin — ishlar ARALASHIB KETMASIN. `git add -A`, `git add .` va `git commit -a` ISHLATILMAYDI: faqat o'zim o'zgartirgan fayllar nomma-nom qo'shiladi. Vaqtinchalik fayl loyiha ildiziga yozilmaydi — `.tmp/` ichiga (u gitignore'da). Kommit oldidan `git status` ko'riladi: begona fayl ko'rinsa unga tegilmaydi. **Saytga chiqarishdan oldin ham** `git status` ALOHIDA qadam bo'lib tekshiriladi (`chiqar.sh` bilan bitta qatorda emas — aks holda natijani ko'rib to'xtab bo'lmaydi): toza bo'lmasa chiqarilmaydi, chunki `chiqar.sh` papkani `rsync` bilan HOLICHA yuboradi va begona suhbatning yarim ishi ham saytga chiqib ketadi.
- [2026-08-14] "Bu raqam ana u raqamga teng bo'lishi kerak" degan har qanday fidbek KODGA aylantirilsin: `lib/moslik.js` dagi `CHECKS` ro'yxatiga qo'shiladi. "Bunday ma'lumot xato" degani esa `lib/audit.js` ga. Shunda qoida ikkinchi marta aytilmaydi — u `npm run tekshir` da ham, ilova ichidagi "Tekshirib ko'ring" kartochkasida ham o'zi tekshiriladi. Fidbekni faqat DAFTAR'ga yozib qo'yish YETARLI EMAS.
- [2026-08-14] Tekshiruv skriptida formula QAYTA YOZILMAYDI — u ilovaning o'z funksiyalarini chaqiradi (`scripts/lib/yuk.mjs`). Aks holda skript "hammasi joyida" deb turadi-yu, ekranda boshqa raqam turadi.
- [2026-08-14] Bir tushuncha — bitta funksiya. Ish haqi uchun `payrollData.payrollCost()`, kassa qoldig'i uchun `kassaBalances()`. Yangi sahifada "shu yerda boshqacharoq kerak" bo'lsa, o'sha funksiyaga parametr qo'shiladi, yangi hisob yozilmaydi.
- [2026-08-13] Pulga tegadigan har o'zgarishdan keyin **`npm run tekshir:server`** ishga tushirilsin — u HAQIQIY baza bo'yicha hamyon balansi, ikkilangan to'lov, bog'lanmagan yozuv va kassaga tushmagan kirimni tekshiradi. Xato chiqsa saytga CHIQARILMAYDI. [2026-08-23 dan] `:server` qo'shimchasi MAJBURIY: baza endi serverda, kompyuterda esa ulanish yo'q. Oddiy `npm run tekshir` lokal sozlama qayerga qarasa o'shani tekshiradi — u bir necha kun eski, muzlab qolgan Supabase nusxasini tekshirib "hammasi joyida" deb turgan. Tekshiruv bosh qatorida MANBA yozilib turadi (`yuk.mjs` `manbaNomi()`) — u `Postgres: mahalliy soket` bo'lishi kerak.
- [2026-08-13] Bir qoida aytilsa u TEGISHLI HAMMA JOYGA qo'llansin: bir bo'limda tushuntirilgan narsani foydalanuvchi boshqa bo'lim uchun qaytadan tushuntirmasin. O'zgartirishdan oldin o'sha ma'lumot qayerlarda ishlatilishini (grep bilan) tekshirib chiqing — Xarajatlar, Pul rejasi, Kassa, P&L, Ish haqi, hisobotlar.
- [2026-08-21] `npm run tekshir` "toza" degani BRAUZERDA ham toza degani emas: tekshiruv qatorlarni SQL orqali o'qiydi va RLS chetlab o'tiladi. Ya'ni u hisob xatosini tutadi, HUQUQ xatosini tutmaydi. Yangi jadval yoki yangi `select` qo'shilganda RLS siyosati ALOHIDA tekshirilsin (`begin; set_config('request.jwt.claims', …); set local role authenticated; select count(*) …; rollback;`). PostgREST ruxsat yo'qligini xato bilan emas, BO'SH RO'YXAT bilan bildiradi — `debt_payments` da aynan shu sabab 16 000 to'lov ko'rinmay, qarz 16 931.79 $ ko'p turgan edi.
- [2026-08-24] AVTOMAT kelmaydigan har ma'lumot uchun "eskirgan" tekshiruvi bo'lsin (`lib/audit.js` → `MANBALAR`). Sotuv Billz'dan kelgani uchun "Sotuv ma'lumoti yangi" doim yashil turardi — xarajat, kassa va KPI esa 4 kun kiritilmay, hech qayerda bildirilmadi. Eng ishonchli manba eng ko'r joyni yaratadi.
- [2026-08-24] Tekshiruvda ODAM kiritmagani bilan MASHINA ishlamay qolgani ajratilsin: birinchisi `bloklamaydi: true` (ekranda qizil, chiqarishni to'xtatmaydi), ikkinchisi darvozani yopadi. Xodim ma'lumot kiritmaguncha qizil turadigan darvoza — bir haftada e'tibordan qoladigan darvoza.
- [2026-08-24] Ogohlantirishlar `id` bo'yicha guruhlansa ENG UZUN moslik olinsin (`scripts/tekshir.mjs` → `turi()`). `id.split("-")[0]` bilan `stale-expenses` ham "Sotuv ma'lumoti yangi" bo'lib chiqardi — ya'ni xato boshqa nom ostida "✓" bo'lib turardi.
- [2026-08-24] Platformadan ko'chgandan keyin KAM ISHLATILADIGAN yo'llar alohida sinalsin: ular jimgina sinadi va boshqa narsa ishlayotgani buni yashiradi. `/api/staff`, `/api/backup`, `/api/billz/sync` uchtasi ham Supabase Auth'da qolib ketgan edi (500 qaytarardi), `scripts/sql.mjs` esa yopilgan Supabase'ga borardi. Server tekshiruvi (`kimChaqirdi`) BITTA joyda — `lib/apiAuth.js`.
- [2026-08-13] Modul xotirasidan o'qiydigan har `useMemo` bog'lamiga `useLive()` qo'shilsin. Demo qiymatdan boshlanadigan modulda (masalan `staffData`) busiz ekranda soxta ro'yxat qotib qoladi — xato bo'sh ekran emas, ishonarli yolg'on bo'lib chiqadi.
- [2026-08-24] Tashqi tizimdan kelgan ma'lumotning TANILMAGAN qismi jimgina tashlanmasin — o'z ustuniga yozilsin va yig'indi tekshiruvi qo'yilsin. Billz to'lov turini erkin nomlaydi; tanilmagani `unknown` ro'yxatiga tushib bazaga umuman yozilmasdi (`sales.unknown_paid` yo'q edi), chek summasi joyida turgani holda hamyonlar yig'indisi kam bo'lardi. Qarz to'lovida esa u jimgina "naqd" bo'lib yozilardi — noto'g'ri hamyonga tushgan pul yo'qolgan puldan yomonroq: kamomad menejer zimmasiga o'tadi.
- [2026-08-24] Sinxronizatsiya NIMANI TASHLAB KETGANI ham jurnalga yozilsin (`billz_sync_log.no_store`, `exhausted`, `warnings`) va cron jurnalidagi grep'ga qo'shilsin. Jurnal ortiqcha aytmasligi kerak edi, lekin KAM aytishi ham xuddi shunday xavfli: do'kon Billz'da qayta nomlansa o'sha do'konning HAMMA cheki tashlanardi va jurnalda baribir "OK" turardi.
- [2026-08-24] Yangi tekshiruv `scripts/tekshir.mjs` → `KINDS` ro'yxatiga ham qo'shilsin — sog'lom holatda "✓" bo'lib ko'rinsin. Ro'yxatda turmagan tekshiruv faqat qizarganda ko'rinadi, ya'ni u ishlayotganini bilib bo'lmaydi (borligi ham bilinmaydi).
- [2026-08-24] Ma'lumotga tayanadigan tekshiruv qo'yishdan OLDIN u haqiqiy bazada nechta qator ustida qizarishini o'lchang. "To'lovlar yig'indisi = chek summasi" qoidasi qaytarish va almashuv cheklarida 827 marta qizarardi — Billz u yerda to'lov qatorini umuman bermaydi. Faqat `sale` turida qoldirildi: u yerda 8 011 chekdan 0 tasi farq qiladi, ya'ni birinchi qizarish HAQIQIY nosozlik bo'ladi. Abadiy qizil darvoza bir haftada e'tibordan qoladi.
- [2026-08-24] `.env.local` KO'CHISHDAN keyin eski manzilda qolib ketishi mumkin — shuning uchun bazaga boradigan har skript QAYSI bazaga borayotganini bosh qatorda aytsin (`scripts/billz-sync.mjs` → `manba:`). Aks holda xato "Could not find the 'unknown_paid' column in the schema cache" bo'lib chiqadi va migratsiya yoki kod ayblanadi — sabab esa "butunlay boshqa baza" edi.
- [2026-08-26] KPI kunlik jadvalidagi **Savdo, Naqd, Payme va Servis** Billz'dan avtomat keladi (`kassaIncome.kunlikKirim` — kassa ham AYNAN shundan o'qiydi). Servis = montaj qatorlari, naqd esa Billz naqdidan montaj AYRILGANI: menejer shunday yozardi (731 → 700 + 31), Billz esa montajni oddiy naqd sotuv qilib yuboradi — ayirilmasa "Jami tushum" ikki marta sanaladi. Qo'lda yozilgan eski qatorlar bazadan o'chirilmaydi. Ikki tomon bir manba bo'lgani uchun kamomad solishtiruvi (`kassaControlDays`) ATAYLAB xom `listAllDays()` ni o'qiydi va to'ldirilmagan kunga `diff: null` beradi — nol qaytarilsa "kamomad yo'q" degan yolg'on bo'lardi.
- [2026-08-26] `npm run tekshir:server` **serverdagi joylashgan kodni** yurgizadi (`tekshir-uzoq.sh` → `/opt/nspos/app`), lokal o'zgarishni EMAS. Chiqarishdan oldin o'z kodini haqiqiy baza ustida sinash uchun ishchi nusxa serverga vaqtinchalik papkaga `rsync` qilinadi va o'sha yerda yurgiziladi — aks holda natija chiqarishdan oldin ham, keyin ham bir xil chiqib, "hech narsa o'zgarmadi" degan yolg'on xulosa beradi.

## Loyiha haqida

NSPOS — NScamera uchun boshqaruv platformasi. Billz bermaydigan narsalar
uchun: tahlil, KPI va oylik, ustalar reytingi, moliya.

- Baza: **o'z serverimizdagi PostgreSQL 17** (Contabo VPS). Ilova unga
  PostgREST orqali boradi (`/rest/v1/`), `@supabase/supabase-js` esa
  faqat so'rov yozish uslubi bo'lib qoldi — Supabase'ning o'zi yo'q.
  Kirish o'z JWT'imiz bilan (`lib/jwt.js`, `auth.kirish()`), Supabase
  Auth ishlatilmaydi — server marshrutlarida ham
  (`lib/apiAuth.js` → `kimChaqirdi()`). Migratsiya:
  `node scripts/sql.mjs -f <fayl>.sql` — u SSH orqali serverdagi
  `psql` ga boradi (2026-08-24 dan; ilgari Supabase API'ga borardi
  va umuman ishlamasdi).
- Sayt: **https://tizim.enes.uz** (`bash scripts/server/chiqar.sh`)
  Server sozlanishi `scripts/server/00…12-*.sh` da, tartib bilan.
  Xizmatlar: `nspos` (sayt), `nspos-api` (o'qish API), `nspos-bot`
  (Telegram). Eski Vercel manzillari (`nspos.vercel.app`,
  `nspos-psi.vercel.app`) va eski Supabase 2026-08-23 da yopilgan —
  qaytarilmaydi (DAFTAR 12-bo'lim).
- Rahbar uchun Telegram boti: `/xulosa`, `/savdo`, `/kassa`, `/qarz`…
  Bot bazaga ulanmaydi — faqat `/api/v1` dan GET qiladi
  (`scripts/bot/`, `scripts/server/11-bot.sh`).
- Ikki valyuta: savdo/moliya dollarda, oylik va xarajat so'mda — kurs
  `companies.usd_rate` da, tarixi `usd_rates` jadvalida
- Ma'lumot Billz'dan **API orqali** keladi (2026-08-19 dan):
  `npm run billz -- --probe` / `-- --only=products` / `-- --full`,
  serverda `/api/billz/sync`. Yadro `lib/billzSync.js` — server ham,
  skript ham AYNAN o'shani chaqiradi.

## Billz qoidalari
<!-- Sabab va tafsilot: DAFTAR.md → "Billz API'ga o'tish (2026-08-19)" -->

- [2026-08-19] Billz narxi **dollarda** o'qiladi: `retail_currency` yorlig'i
  do'konga qarab USD/UZS bo'lib chiqadi, RAQAM esa bir xil. Yorliq
  O'QILMAYDI — aks holda 260 $ tovar 0.02 $ bo'lib ketadi.
- [2026-08-19] Tannarx `product_supplier_stock[].min_supply_price` dan
  (yuqoridagi `supply_price` doim 0). **Nol ustiga yozilmaydi** — qoldig'i
  tugagan tovarga Billz 0 qaytaradi va u haqiqiy tannarxni o'chirib,
  foydani 100% qilib ko'rsatardi.
- [2026-08-19] Sinxronizatsiya faqat QO'SHADI va YANGILAYDI. Yozuv
  **o'chirilmaydi va birlashtirilmaydi** — dublikat ko'ringanda ham.
  Billz'dagi hamma narsa NSPOS'da ham tursin.
- [2026-08-19] `/v3/order-search` huquq bo'lmasa 403 emas, **bo'sh ro'yxat**
  qaytaradi. Ya'ni "ruxsat yo'q" xatosi "sotuv yo'q" bo'lib ko'rinadi —
  bo'shlik alohida tekshiriladi (`probe()`), jimgina 0 deb qabul qilinmaydi.
- [2026-08-19] Billz sekundiga **2 so'rov** beradi va shubhali IP'ni
  bloklaydi. So'rovlar `lib/billzApi.js` da navbatga solingan — parallel
  yuborilmaydi, `Promise.all` bilan aylantirilmaydi.
- [2026-08-19] Chek ichidagi tovarlar `/v3/order-search` javobining
  O'ZIDA keladi (`order_detail.order_items`). Har chek uchun alohida
  `/v2/order/:id` chaqirilmaydi — 82 daqiqa va 173 soniya farqi.
- [2026-08-19] Sana parametri **`start_date`** (hujjat jadvalidagi
  `start` XATO — u jimgina faqat bugungi cheklarni qaytaradi).
- [2026-08-19] Eski chek Billz chekiga **raqam + tur + summa** bo'yicha
  bog'lanadi. Faqat raqam yetmaydi: Billz qaytarish chekiga asl chekning
  raqamini beradi (7 779 qatorda 6 855 noyob raqam).
- [2026-08-19] Chekdagi tovar katalogda topilmasa qator TASHLANMAYDI —
  chek qatoridagi `product` obyektidan kartochka yaratiladi
  (`is_active = false`). Aks holda chek summasi qatorlar yig'indisiga
  teng bo'lmay qoladi.
