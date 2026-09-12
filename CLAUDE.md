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
- [2026-08-28] Uchinchi marta takrorlangan xato uchun OGOHLANTIRISH emas, TO'SIQ qo'yilsin. `.env.local` eski Supabase'da qolib ketgani 11.2 va 14.7 da ikki marta "ogohlantirish qo'shildi" bilan yopilgan edi — u 24-avgustdan 28-avgustgacha har yurishda chiqdi va hech kim to'xtamadi (eski nusxada 9 032 sotuv, haqiqiysida 9 357). Endi `scripts/lib/baza.mjs` skriptni umuman ishga tushirmaydi (`--boshqa-baza` bilan ataylab chetlanadi). Manba tekshiruvi ENG BIRINCHI bajarilsin — hatto `--probe` kabi bazaga tegmaydigan yo'llarda ham, aks holda tashxis "Billz ochiq" deb chiqadi va odam sababni boshqa yoqdan qidiradi.
- [2026-08-28] "Hech narsa yozilmaydi" degan rejimda bitta ham teshik qolmasin: `dryClient` `insert/upsert/update/delete` ni to'sardi-yu, `rpc` ni o'tkazib yuborardi va `--dry` aslida `refresh_customer_stats()` bilan `customers` ni qayta yozardi. Yozuv yo'llari ro'yxat bilan to'silsa, ro'yxatdan tashqarida qolgan yo'l bormi — alohida qaralsin.
- [2026-08-28] Sanoq (`inserted`/`updated`) UMUMIY yordamchining ichida hisoblansin (`onlyChanged()` → `yangi`/`ozgargan`), har bosqichda qaytadan emas. `syncOrders` da 24-avgustda tuzatilgan "hamma upsert = inserted" xatosi qolgan to'rt bosqichda qolib ketgandi: jurnal har yarim soatda "2 ta ta'minotchi qo'shildi" derdi va bu 48 yurishning hammasida yolg'on edi.
- [2026-08-28] Ikki bazani solishtirganda "qator yo'q" bilan "qatorni ko'rishga huquqim yo'q" farqlansin. VPS'da parolli yagona rol `nspos_app` RLS ni chetlab o'tmaydi — u bilan ulansa `sales`/`customers` bo'sh ko'rinadi va solishtiruv mavjud ma'lumot ustiga ko'chirishni taklif qilardi. Shuning uchun `solishtir.mjs --ssh root@…` so'rovni serverda, `postgres` roli bilan bajaradi.
- [2026-08-24] Yangi tekshiruv `scripts/tekshir.mjs` → `KINDS` ro'yxatiga ham qo'shilsin — sog'lom holatda "✓" bo'lib ko'rinsin. Ro'yxatda turmagan tekshiruv faqat qizarganda ko'rinadi, ya'ni u ishlayotganini bilib bo'lmaydi (borligi ham bilinmaydi).
- [2026-08-24] Ma'lumotga tayanadigan tekshiruv qo'yishdan OLDIN u haqiqiy bazada nechta qator ustida qizarishini o'lchang. "To'lovlar yig'indisi = chek summasi" qoidasi qaytarish va almashuv cheklarida 827 marta qizarardi — Billz u yerda to'lov qatorini umuman bermaydi. Faqat `sale` turida qoldirildi: u yerda 8 011 chekdan 0 tasi farq qiladi, ya'ni birinchi qizarish HAQIQIY nosozlik bo'ladi. Abadiy qizil darvoza bir haftada e'tibordan qoladi.
- [2026-08-24] `.env.local` KO'CHISHDAN keyin eski manzilda qolib ketishi mumkin — shuning uchun bazaga boradigan har skript QAYSI bazaga borayotganini bosh qatorda aytsin (`scripts/billz-sync.mjs` → `manba:`). Aks holda xato "Could not find the 'unknown_paid' column in the schema cache" bo'lib chiqadi va migratsiya yoki kod ayblanadi — sabab esa "butunlay boshqa baza" edi.
- [2026-08-26] KPI kunlik jadvalidagi **Savdo, Naqd, Payme va Servis** Billz'dan avtomat keladi (`kassaIncome.kunlikKirim` — kassa ham AYNAN shundan o'qiydi). Servis = montaj qatorlari, naqd esa Billz naqdidan montaj AYRILGANI: menejer shunday yozardi (731 → 700 + 31), Billz esa montajni oddiy naqd sotuv qilib yuboradi — ayirilmasa "Jami tushum" ikki marta sanaladi. Qo'lda yozilgan eski qatorlar bazadan o'chirilmaydi. Ikki tomon bir manba bo'lgani uchun kamomad solishtiruvi (`kassaControlDays`) ATAYLAB xom `listAllDays()` ni o'qiydi va to'ldirilmagan kunga `diff: null` beradi — nol qaytarilsa "kamomad yo'q" degan yolg'on bo'lardi.
- [2026-08-26] `npm run tekshir:server` **serverdagi joylashgan kodni** yurgizadi (`tekshir-uzoq.sh` → `/opt/nspos/app`), lokal o'zgarishni EMAS. Chiqarishdan oldin o'z kodini haqiqiy baza ustida sinash uchun ishchi nusxa serverga vaqtinchalik papkaga `rsync` qilinadi va o'sha yerda yurgiziladi — aks holda natija chiqarishdan oldin ham, keyin ham bir xil chiqib, "hech narsa o'zgarmadi" degan yolg'on xulosa beradi.
- [2026-09-02] Hujjatda "yopildi", "bor", "ishlaydi" deyilgan har tashqi narsa (eski sayt, xizmat, cron) o'lchab tasdiqlansin — `curl`, `systemctl`, `ls /etc/cron.d`. "Eski Vercel/Supabase yopilgan" deb yozilgan-u, ikkalasi ham tirik edi va xodimlar ikki hafta o'sha yerga yozdi; `nspos-bot` "bor" deb yozilgan-u, serverda xizmat yo'q. Ko'chish "yangi sayt ishlayapti" bilan emas, "eski manzilga KIRIB BO'LMAYDI" bilan tugaydi (DAFTAR 16).
- [2026-09-02] Bir nechta qiymat tanlanadigan filtr uchun `components/ui/MultiSelect.jsx` ishlatilsin: `null` = hammasi, aks holda kalitlar massivi. Popover `left-0` ga yopishadi (375px da `right-0` chiqib ketardi), `useOyna` ishlatilmaydi (fon skrollini qulflaydi). Tanlangan qiymat ro'yxatdan yo'qolsa filtr o'zi tozalansin — bo'sh jadval jimgina qolmasin.
- [2026-09-02] `npm run nomlar` konfiguratsiyasida yo'q qoida uchun `eslint-disable` yozilmasin (`react-hooks/exhaustive-deps` — "Definition for rule not found" bilan lint yiqiladi). Bog'lamni to'liq yozib hal qilinadi.
- [2026-09-02] Supabase CLI (`supabase db query --linked`) skriptlari PARALLEL yurgizilmasin — CLI har so'rovda vaqtinchalik rol yaratadi va ikkinchisi "failed to connect as temp role" bilan yiqiladi. `eski-muzlat.mjs`, `login-kochir.mjs`, `solishtir.mjs`, `kochirish.mjs` — ketma-ket.
- [2026-09-03] **Billz — yagona manba.** Billz'da bor raqam (tovar, qoldiq, chek, mijoz, qarz, qarz to'lovi) NSPOS'da QAYTA HISOBLANMAYDI va ikkinchi ta'rifga ega bo'lmaydi: ko'zgu har 5 daqiqada, har Billz sahifasida `BillzMuhr` ("Billz: HH:MM · mos ✓"), har yurish oxirida farq detektori (`billzSync.moslikTekshir` → `audit` `billz-farq`). Excel/demo zaxira yo'llari Billz ma'lumoti uchun YO'Q. Qo'lda kiritiladiganlar (xarajat, kassa, KPI qo'lda maydonlari, oylik, kurs, buyurtma muddati) — NSPOS manbasi. Chiqarishdan oldin `npm run billz:solishtir` (id bo'yicha). DAFTAR 17.
- [2026-09-03] Sinxron yozgan har qator o'z yorlig'ini (`source`) O'ZI yozsin — bir martalik backfill'ga ishonilmasin. `debts.source` 20.08 dan keyingi 150 qarzda 'nspos' bo'lib qolgan, `listDebts()` esa faqat 'billz' ni sanagan — 20 180 $ ekrandan yo'qolgan, Billz 47 634 $, ekran 30 639 $. Audit: `qarz-manba` (error).
- [2026-09-03] Tashqi API filtri TO'LIQ RO'YXAT EMAS: Billz `status=unpaid` qisman to'langan `overdue` qarzni bermaydi (289 ↔ 387), `partial_paid`/`fully_paid` filtr sifatida yo'q, `/v1/debt/{id}` 403. Ochiq to'plam bir necha oqimdan yig'iladi, bazada ochiq-u oqimda kelmagani mijoz bo'yicha (`customer_id`) so'raladi. Har yurish Billz `count` bilan solishtiriladi.
- [2026-09-03] **Yuklanish banneri BITTA — ilova qobig'ida** (`components/YuklanmoqdaBanner.jsx`, `useToliq()`). Yangi sahifaga alohida "yuklanmoqda" banneri yozilmaydi. Og'ir jadvaldan hisoblangan OGOHLANTIRISH/AUDIT bloki (kassa "Tekshirib ko'ring" kabi) `toliq` bo'lmaguncha ko'rsatilmaydi — yuklanish paytida "Optim naqd minusda −61 367 $" chiqqan edi, haqiqati 14 452 $. DAFTAR 18.10.
- [2026-09-03] **Xodim hisobi bilan sinov:** `npm run xodim -- --rol=manager` / `--rol=installer` (rahbar uchun faqat `--faqat-sahifa`). Rol/RLS/sahifa o'zgarganda `npm run huquq` bilan birga yuriladi: birinchisi bazani, ikkinchisi tokenli PostgREST + brauzerni sinaydi. Yozuvlar darrov o'chiriladi.
- [2026-09-03] Zaxira oyna (90 kun) yoki noma'lum tannarx bilan chiqqan raqam ALOHIDA belgilanadi (`oyna`, `sokin`, `tannarx: null`) va pul yig'indisiga KIRMAYDI. 0 yozilmaydi — 0 "yo'qotish yo'q" degan yolg'on. Qoldiq salomatligida 43 "tugagan"dan 25 tasi 30 kundan beri sotilmagan, 20 tasi tannarxsiz edi — 178 $/kun "yo'qotish" 70 $ bo'ldi.
- [2026-09-03] Billz summani kasr tiyin bilan beradi (188.035; "Jami qarz" 47 634.4218) — qarz ustunlari `numeric(14,4)`, `remainingOf` 4 xona, yig'indi OXIRIDA bir marta yaxlitlanadi. Har qatorni alohida yaxlitlash 387 qarzda 7 tiyin, 125 mijozda 3 tiyin farq berdi.
- [2026-09-03] `chiqar.sh` `nspos-api` ni ham qayta ishga tushiradi — u `lib/` ni o'z jarayonida yuklaydi, aks holda eski formulalar bilan javob beraveradi (`jami_qarzdorlik` maydoni shu sabab ko'rinmagan).

- [2026-09-03] Xodim yozuvi JIM yo'qolmasin: `lib/db.js` `remove()` o'chirilgan qatorni so'raydi (nol = xato), `silent=true` faqat AVTOMAT yozuvga (kurs); rad bo'lsa `lib/sync.js` xotirani baza tasdiqlagan holatga qaytaradi (`tasdiq`), localStorage faqat tasdiqdan keyin. Bola qatorlar `bolaQatorlar` bilan: avval insert, keyin delete.
- [2026-09-03] **Huquq — bitta manba: `role_permissions` jadvali.** RLS `has_perm('kalit')` bilan (rol ro'yxati siyosatga QOTIRILMAYDI), interfeys `auth.can()` o'sha jadvaldan; standart `lib/auth.js` PERMISSIONS, seed `scripts/huquq-seed.mjs` → `scripts/sql/role-permissions.sql` (qo'lda yozilmaydi). Yangi kalit: PERMISSIONS + PERMISSION_LABELS → seed → `sql.mjs` → `npm run huquq`. `perms.sections` faqat toraytiradi. Tugma bor-u baza rad etadigan holat bo'lmasin (`canTouchExpense`, `ownerOnly`).
- [2026-09-03] Kodda qotgan biznes raqami (kun, chegara, guruh) — `companies.sozlamalar` orqali: `sozlama("kalit", standart)`, o'qish CHAQIRUV vaqtida (modul darajasida muzlatilmaydi), Sozlamalar → Biznes qoidalari. Do'kon KOD bilan bog'lanadi (`stores.code`), nom faqat ko'rsatish; `demoStores[0]` emas — `asosiyDokonId()/skladId()`.
- [2026-09-03] Snapshot ustun sarlavhasida "hozir" belgisi bo'lsin (Qarzdorlik: "Hozirgi qarzi · hozir"); davr faqat oqim ustunlariga. `DataTable` ustuniga `hint` — nima va qanday hisoblangani.
- [2026-09-03] Manfiy raqam sababi bilan: `components/ui/Manfiy.jsx` + `format.MANFIY_SABAB` (bir sabab — bitta matn). Ko'rsatish uchun `−` (xarajat, chiqim) ma'lumot musbat — u sabab emas.
- [2026-09-03] Tovar O'CHIRILMAYDI — arxivlanadi (`archived_at` NSPOS'niki, `is_active` Billz'niki). `listProducts()` faol; id bo'yicha qidiruv `allProducts()`.
- [2026-09-03] Xarajat turlari `expense_categories` jadvalida (Sozlamalar). `EXPENSE_CATEGORIES` obyekti JONLI — o'rni almashtirilmaydi, ichi jadvaldan to'ldiriladi.
- [2026-09-03] Billz `/v2/transfer` — sarlavha bor, tovar qatorlari yo'q (DAFTAR 18.4). Ko'zgu `stock_transfers`, bosqich `transfers`.
- [2026-09-03] Ish papkasi — repo: Desktop yopilib qolsa klon (`git clone … master`) dan `chiqar.sh`/`sql.mjs` ishlayveradi (`~/.ssh/nspos`); oxirida Desktop `git pull`.
- [2026-09-04] **Xodim boshqa xodimning bir ustunini ko'rishi kerak bo'lsa — RLS kengaytirilmaydi, `security definer` KO'RINISH yasaladi** (`staff_directory`, `installer_cameras`, `installer_nps`). RLS ustunni yashira olmaydi: `kpi_day` qatori ochilsa `data.olgan` ham, `nps_records` ochilsa mijoz telefoni ham ochiladi. Ko'rinish faqat zararsiz maydonni beradi, ya'ni cheklov interfeysda emas BAZADA — usta konsoldan so'rov yozsa ham oylikni ko'rmaydi. Ko'rinish `realtime: false` (publication ko'rinishni qabul qilmaydi) va `nspos_app` ga `grant` + `notify pgrst`. DAFTAR 19.1.
- [2026-09-04] Ikki xil ma'noli ko'rinish bayrog'i BIRLASHTIRILMAYDI: `showSalary` (pul) va `showAttendance` (davomat) alohida. Bittasiga yopishtirilsa keyingi fidbekda ajratib bo'lmaydi — "faqat shtuk va NPS" aynan shuni talab qildi.
- [2026-09-04] Hisoblagichi bazadan ishlaydigan tahlil `bazadan: true` bo'lmasa Hisobotlar ro'yxatida UMUMAN ko'rinmaydi (`reports/page.jsx` shuni filtrlaydi) — va bu jim bo'ladi. "Ombor qoplamasi" 24.08 dan beri shunday yo'qolib turgan, `analytics.stockCoverage` esa o'sha kundan beri ishlayotgandi. Yangi tahlil qo'shilganda yoki Excel'dan bazaga o'tkazilganda `bazadan` bayrog'i VA `reports/[id]` dagi shox birga o'zgartiriladi. DAFTAR 19.2.
- [2026-09-04] Bir xil ro'yxatga ikkinchi karta/sahifa YASALMAYDI (masalan "Buyurtma taklifi" allaqachon "Qoldiq salomatligi" ichida). Ikki joyda bir raqam ertami-kechmi bir-biriga qarshi chiqadi — kirish nuqtasi ko'paytirilsa ham hisob bitta qoladi.
- [2026-09-04] Inkremental Billz sinxroni `lastCursor` dan boshlanadi, ya'ni **Billz'da KEYIN tuzatilgan eski chek qayta o'qilmaydi** — NSPOS bir kungacha eski summani ko'rsatib turishi mumkin. Shuning uchun `moslikTekshir` id bo'yicha "bor/yo'q" bilan cheklanmaydi: do'kon × kun kesimida SAVDO SUMMASI ham solishtiriladi (0.02 $ chegara, o'sha aylanish ichida — Billz sekundiga 2 so'rov). DAFTAR 19.3.
- [2026-09-04] Usta olgan puli KOMPANIYA balansidagi servis hamyonidan chiqadi (`sozlama("kpi.ustaKassa", "company")`), do'kon kassasidan EMAS: do'kon servis kassasi har kuni nol qilib topshiriladi, undan xarajat qilinsa hamyon minusga tushadi va tizim yangi xarajatni umuman rad etadi. Faqat `kassa` o'zgaradi — `storeId`, do'kon kesimi va "Oylik maoshlar" ustuni avvalgidek. DAFTAR 19.4.
- [2026-09-04] Hamyon/kassa o'zgarishi OLDIN o'lchanadi: minus bir kassadan boshqasiga ko'chib o'tmayotganini raqam bilan ko'rsating (kirim − topshirilgan − chiqim, ikki tomon uchun ham). "Mantiqan to'g'ri" yetarli emas.
- [2026-09-04] Bir o'lchov — bitta boshqaruv: holat TAB bo'lsa panelda o'sha "Holat" select bo'lmaydi (ikkisi bir-biriga qarshi turib jadval bo'sh qoladi). HISOB PARAMETRI (do'kon — qoldiq/sotuv shundan yig'iladi) kartochkalar tepasida, qator FILTRI panelda. Ko'p tanlov `FilterBar` `type: "multi"` orqali — sahifada `MultiSelect` qo'lda chizilmaydi; ro'yxatdan yo'qolgan tanlovni `FilterBar` o'zi tozalaydi (sahifaga `useEffect` yozilmaydi). Filtr `get` USTUN ko'rsatgan formulani qaytaradi, boshqasini emas. DAFTAR 19.7.

- [2026-09-05] **Moliya falsafasi (DAFTAR 20):** uch qatlam — KO'ZGU (Billz aynan, qayta hisob yo'q), DAFTAR (faqat NSPOS'dagi pul harakati: xarajat, kassa, NS, tovar uchun to'lov, usta puli, kurs), HISOBOT (P&L, Pul oqimi, Balans, Qarz yoshi). Har raqamning uch xossasi ekranda: manba, ta'rif (`hint`), vaqt ("hozir"/davr). **Billz yorlig'i ≠ moliyaviy ma'no**: Billz "overdue" (muddat deyarli har doim 1 kun) va montaj 5 $ tannarxi ko'zguda qoladi, hisobotga rahbar qoidasi (`sozlama`) orqali kiradi. Foyda ≠ pul — ko'prik (`pnlData.foydaPulKoprigi`) va "izohlanmagan" qator YASHIRILMAYDI.
- [2026-09-05] Chek qatori tannarxi — BITTA qoida `salesData.qatorTannarx`: xizmat (montaj) → 0 (usta puli ish haqida, ikki marta chegirilmasin), qator → katalog → **null** (noma'lum, 0 emas — 0 "bepul" degani). P&L, rahbariyat paneli, tovar foydasi shuni chaqiradi; `|| 0` kaskadi qayta yozilmaydi.
- [2026-09-05] Qarz yoshi — BERILGAN sanadan (`debtsData.qarzYoshiKun`), "muddati o'tgan" — rahbar muddati (`debts.termDays`: standart + do'kon), yosh guruhlari `debtsData.arBuckets` (Qarzdorlik, AR aging, API, bot bitta ro'yxat). Billz `due_date`/`status=overdue` hisobotda ishlatilmaydi. KPI "Nasiya" ustuni = "Savdo − tushum" (qarz emas); shu kuni yopilgan nasiya alohida (`shuKuniYopilgan`).
- [2026-09-05] So'mdagi oylik va usta puli O'SHA OYNING kursi bilan (`ratesData.oyKursi`, `kurs.oyQoidasi`), `kpi_day.olganKurs` kiritishda muhrlanadi — yopilgan oy bugungi kurs bilan suzmaydi. `payrollCost` xodim bo'yicha YIG'INDI (KPI yoki qat'iy), "yoki-yoki" emas; berilgan oylik `berilganOylik` (xarajat + usta + kassa_ops; jurnal sanalmaydi — ikki marta bo'ladi).
- [2026-09-05] Balans kapitali TIQIN EMAS: `balanceData.kapital` = `kapital.boshlangich` + yig'ilgan foyda (P&L hisob boshidan) − NS; aktiv − majburiyat − kapital = "izohlanmagan" — ochiq ko'rsatiladi. Oy yopish: `oy_muhri` (`lib/oyMuhri.js`, Balans → "Oy muhri"); muhr ekran raqamini almashtirmaydi, farqni ko'rsatadi (`audit` `oy-muhri`). Tannarxsiz qoldiq aktivga 0 deb kirmaydi — alohida.
- [2026-09-05] Pulga tegadigan o'zgarish OLDIN va KEYIN o'lchanadi: `npm run audit:olchov` (xom baza, faqat select) va `npm run olchov:server -- --oy=YYYY-MM` (ekran raqami — ilovaning o'z funksiyalari; `tekshir-uzoq.sh <skript>`). Kutilgan farq raqam bilan aytiladi (A: +5 065.00 aynan chiqdi).
- [2026-09-05] Billz xarid hujjati (`/v2/supplier-order`) ko'zgusi `supplier_invoices` da (`source='billz'`, to'langani Billz'niki); kompaniya modulni hali ishlatmaydi (1 hujjat) — audit `xarid-yozilmagan` 30 kun tannarx ↔ yozilgan xarid (< 1/2 → sariq). `/v2/write-off`, `/v1/order/cash-shifts` API kalit roliga huquq berilmagan (403) — Sozlamalar tashxisida ko'rinadi.
- [2026-09-05] `upsert … on conflict (a, b)` QISMAN unique indeks bilan ishlamaydi — to'liq `unique (a, b)` cheklov (NULL bir-biriga teng emas). `yuk.mjs` ichma-ich jadval tekshiruvi: bola jadvalda qator BOR-u hech biriga yopishmasa xato; jadvalning o'zi bo'sh bo'lsa — haqiqatan bo'sh. Yangi modul (`oyMuhri`) skript yuklovchisi ro'yxatiga ham qo'shilsin — aks holda uning tekshiruvi skriptda doim qizil turadi.

- [2026-09-05] **"Billz sahifasi" — SARLAVHA raqami bilan aniqlanadi.** Sahifaning bosh raqami Billz ko'zgusidan kelsa, `BillzMuhr` MAJBURIY. Bosh sahifa 9 ta muhr qo'yilgani holda muhrsiz qolgan edi — ya'ni eng ko'p ochiladigan ekranda ma'lumot qachonligi va ko'zgu mosligi ko'rinmasdi. Endi `dashboard`, `finance/pnl`, `finance/payables` da ham bor. Muhr ATAYLAB qo'yilmaydigan sahifalar: `finance/cost`, `finance/expenses`, `finance/payroll`, `products/operations`, `services` — ularning sarlavha raqami NSPOS'niki, Billz moduli faqat yon ma'lumot uchun chaqiriladi.
- [2026-09-05] Xom SQL o'lchovi (`scripts/sql/audit-olchov.sql`) ekran raqamidan farq qilsa, **formulasi ilovanikiga ALMASHTIRILMAYDI** — bu fayl ataylab xom bazani o'lchaydi va ikkalasi bir-birini tekshiradi. O'rniga IKKALA qiymat ham, farqi ham chiqariladi (`sof_savdo` ↔ `sof_savdo_ishorali` ↔ `almashuv_ishora_farqi`). Aks holda tushuntirilgan farq har safar "ekranda boshqacha" degan yolg'on shubha tug'diradi va haqiqiy farq shu shovqinda ko'rinmay ketadi.

- [2026-09-05] **Xarajat turining uch xossasi: `group`, `service`, `cogs`.** `cogs = true` (Sozlamalar → "Tannarxga") — tovar kelish xarajati (yo'lkira, dostavka): u OPEX dan CHIQADI va P&L da tannarx ostida alohida qator bo'ladi. Sof foyda O'ZGARMAYDI (pul bir qatordan ikkinchisiga ko'chadi), yalpi marja haqiqiy bo'ladi. Filtr AYNAN ikki joyda — `expensesPnl` dagi `opex` ro'yxati va `opexTotal`; bittasida unutilsa yo'lkira ikki marta ayiriladi. `expensesPnl` `total` FORMULASIGA `+ kelish` QO'SHILMAYDI. `foydaPulKoprigi` da tannarx `p.cogs.total − p.cogs.kelish` (yo'lkira pulni shu davrda oladi, o'zini o'zi yopadi — aks holda "izohlanmagan" o'sha summaga sakraydi). Yagona ta'rif — `expensesData.kelishXarajati()`. `cogs` va `service` bir vaqtda bo'lmaydi (baza `check` + audit `kelish-service`). DAFTAR 22.
- [2026-09-05] Xarajat turi bilan bog'liq YANGI USTUN `syncTable` `select` ro'yxatiga ham qo'shilsin — `scripts/lib/yuk.mjs` aynan shu ustunlar bo'yicha o'qiydi. Tushib qolsa skript bayroqni doim `false` deb ko'radi va tekshiruv jimgina "hammasi joyida" deydi.
- [2026-09-05] Tahlil Excel yuklamasidan bazaga ko'chirilganda UCH joy birga o'zgaradi: `lib/analyses.js` (`source` → `bazadan: true`), `reports/[id]/page.jsx` dagi shox `bazadan` blokiga ko'chadi, komponent ma'lumotni ilovaning O'Z funksiyasidan oladi. "Servis foydasi" 2026-09-05 gacha aynan shu sababdan Hisobotlar ro'yxatida umuman ko'rinmasdi (19.2 kasali) va kirimni iyuldagi Excel'dan o'qirdi.
- [2026-09-05] Billz ko'zgusi maydoniga (`products.cost_price`, `stock`) NSPOS tomonidan yozadigan yo'l QOLDIRILMASIN: `mergeProduct` eski qiymatni faqat Billz 0 qaytarganda saqlaydi, ya'ni yozilgan raqam keyingi sinxronda (5 daqiqa) jimgina o'chadi va ekran "qo'llandi" deb turaveradi. "Import va tannarx" moduli shu sababdan uzildi (sahifa va jadvallar o'chirilmadi).

- [2026-09-12] Ilova ochilganda cheklar IKKI TO'LQINDA keladi
  (`lib/db.js` → modul `oyna`, hozircha faqat `sales`, 120 kun): avval
  oxirgi kunlar, keyin qolgan tarix. Shuning uchun DAVR bo'yicha
  hisoblaydigan sahifa `useDavrToliq(range.from)` ishlatsin (bosh
  sahifa shunday) — u davri kesim sanasidan keyin boshlansa darrov
  chizadi. Snapshot ("hozirgi qarz") yoki butun tarix ko'rsatadigan
  sahifa avvalgidek `useToliq()` bilan kutadi. Yangi jadvalga `oyna`
  qo'yilsa, uni O'QIYDIGAN sahifalar ham qayta ko'riladi — aks holda
  oraliqdagi kam raqam "ishonarli yolg'on" bo'lib chiqadi.
- [2026-09-12] Jonli yangilanish BITTA chaqiriqda
  (`jadval_yangilanish` RPC, `scripts/sql/jadval-yangilanish.sql`) —
  ilgari har 20 soniyada 21 ta jadval uchun alohida, ketma-ket so'rov
  ketardi. Yangi jadval qo'shilganda o'sha migratsiyadagi
  `updated_at` indeks ro'yxatiga ham qo'shilsin. Funksiya bazada
  bo'lmasa ilova eski yo'lga tushadi va buni konsolda AYTADI —
  jimgina sekinlashmaydi.
- [2026-09-12] Tezlik ustida ishlashdan OLDIN o'lchanadi: saytda
  konsolda `__nsposYuklash()` — har jadval uchun qator, so'rov, bayt
  va soniya. "Sekin" degan gapdan kelib chiqib kod o'zgartirilmaydi.

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
  serverda `/api/billz/sync` — cron **har 5 daqiqada** (qarz to'liq
  2 soatda, katalog to'liq kuniga bir; route o'zi hal qiladi). Yadro
  `lib/billzSync.js` — server ham, skript ham AYNAN o'shani chaqiradi.
  Id bo'yicha solishtiruv: `npm run billz:solishtir` (faqat o'qiydi).

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
- [2026-09-03] "Ochiq qarz" = Billz **"Jami qarz"**: to'liq to'lanmagan
  qarzlar qoldig'i (`debtsData.jamiQarz`, bo'linishi `overdue` /
  `unpaid` / `partial_paid`). Balans, Qarzdorlar, Hisobotlar, API, bot —
  hammasi shu funksiyadan; qoldiq = Billz `paid_amount` dan.
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
