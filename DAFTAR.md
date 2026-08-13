# NSPOS daftari — fidbek, xatolar va yechimlar

> **Bu faylni ISHNI BOSHLASHDAN OLDIN o'qish shart.**
> Yangi savol yoki topshiriq kelganda avval shu yerdan qidiring: bu narsa
> allaqachon hal qilinganmi, qanday qaror qabul qilingan, qanday xato
> bo'lgan. Faylda javob bo'lsa — o'shani oling, qaytadan o'ylab
> topmang. Faqat bu yerda yo'q bo'lsa yangidan mulohaza qiling.
>
> Har yangi qaror, xato yoki fidbekdan keyin shu faylga qator qo'shiladi.
> Qisqa qoidalar `CLAUDE.md` da, sabab va tafsilot shu yerda.

---

## 1. Loyiha nima va nima emas

**NSPOS** — NScamera uchun boshqaruv platformasi. Billz o'rnini bosmaydi,
uning ustiga qo'yiladi: Billz bermaydigan narsalar uchun — tahlil, KPI va
oylik, ustalar reytingi, moliya, nazorat.

- Sayt: https://nspos.vercel.app · chiqarish: `npx vercel --prod --yes`
- Baza: Supabase (Postgres + RLS). Migratsiya: `node scripts/sql.mjs "..."`
- Kod: Next.js 14 App Router, JSX (TypeScript emas), Tailwind, Recharts
- Interfeys o'zbekcha (ruscha tarjima `lib/i18n.js` da)
- Do'konlar: NScamera Optim, NScamera Namangan, Sklad
- Hisob **2026-yil 1-avgustdan** boshlanadi. Undan oldingi pul harakati
  sanalmaydi (eski oylardagi tushum allaqachon sarflangan).

**Ma'lumot qayerdan keladi:** Billz'dan Excel yuklab olinadi va NSPOS'ga
tashlanadi (`/data`). Billz API bermayapti. Kunlik naqd/payme/savdo esa
hozircha menejerlar qo'lda kiritadi — bu xato manbai (5-bo'limga qarang).

---

## 2. Asosiy qarorlar (sababi bilan)

| Qaror | Sabab |
|---|---|
| Billz kassa/katalog/ombor uchun qoladi | Fiskal chek sertifikat talab qiladi; kassada tizim to'xtasa savdo to'xtaydi |
| Savdo/moliya dollarda, oylik va xarajat so'mda | Ish shunday yuritiladi. Kurs `companies.usd_rate`, tarixi `usd_rates` |
| So'mda kiritilgan summaning ASL raqami saqlanadi | Dollardan qaytarib hisoblansa 10 000 → 9 985 bo'lib ketadi |
| Servis puli "Jami tushum"ga kiradi | Billz'da montaj oddiy tovar kabi sotiladi, ya'ni "Savdo" ichida. Chiqarilsa nasiya aynan servis summasiga oshadi |
| Servis naqddan ayriladi | Menejer avval kun naqdini yozadi (731), keyin servisni (31) → naqd 700 bo'ladi. Jami baribir 731 |
| Rahbarlar (owner) oylik olmaydi | Ular pulni NS (kassadan shaxsiy pul) orqali oladi. KPI, ish haqi, maosh hisoblarida ko'rinmaydi |
| Menejer kursni o'zgartira oladi | Xarajat so'mda kiritiladi, kurssiz saqlab bo'lmaydi. Bazada `set_usd_rate()` SECURITY DEFINER + `is_manager()` |
| Kassa: 3 ta (b2b, b2c, kompaniya), har birida naqd/payme/servis | B2B kassada servis YO'Q |
| Menejer 2 kundan oldingi kunlik raqamni tahrirlay olmaydi | Rahbar tahrirlay oladi |
| Davomat bonuslari oy oxirida qo'shiladi | Aks holda 1-avgustda xodim 1 500 000 "ishlab topgan" bo'lib ko'rinadi va oy davomida faqat kamayadi |
| Smenalar Billz'da yuritiladi | Menyudan olingan, sahifa kodda qolgan |
| Yetkazib beruvchilar hozircha yuritilmaydi | Menyudan olingan; kartochka yozuv paydo bo'lganda o'zi qaytadi |

---

## 3. Interfeys qoidalari (qisqasi CLAUDE.md da)

- Interfeys **90%** o'lchamda (`html { font-size: 90% }`).
- Har jadvalda: **sarlavha pin**, **sana/ism ustuni chapda pin**, **filtr**,
  **Jami**. Bularni har safar aytish shart emas.
- **"Jami" qatori jadval TEPASIDA** va sarlavha bilan BIRGA pin bo'ladi:
  `<thead>` ichiga, sarlavha qatoridan keyin. `thead` ga `sticky top-0`,
  o'ramiga `overflow-auto max-h-[70vh]`.
  Qator foni **shaffofmas** (`bg-panel`/`bg-surface`) bo'lishi shart —
  shaffof bo'lsa tagidagi qatorlar ko'rinib, raqamlar ustma-ust tushadi.
- **Ustunlar** tugmasi (Meta Ads Manager naqshi): tartibni surish va
  yashirish. Sozlama `localStorage` da, jadval id bo'yicha.
  Xuddi shu mexanizm **kartochkalar** uchun ham ishlaydi (Moliya bosh
  sahifasidagi ko'rsatkichlar — "Ko'rsatkichlar" tugmasi). `ColumnSettings`
  ga `title/countLabel/hint` beriladi, `useColumns` ga esa `defaultHidden`
  — qo'shimcha variant qo'shilganda sahifaning boshlang'ich ko'rinishi
  o'zgarmasligi uchun.
- Yangi ustun qo'shilsa — **jamisi, filtri va hisobotdagi o'rni** ham o'sha
  zahoti. Iloji bo'lsa umumiy yoziladi (jami qatori ustun ro'yxatidan
  avtomat yig'sin).
- Davr tanlansa jadvaldagi **hamma ustun** o'sha davr bo'yicha hisoblanadi.
  Bir ustun davr, ikkinchisi oylik bo'lmasin.
- Yig'ma raqam **bosiladigan** bo'ladi: bosilganda o'sha summa qaysi
  yozuvlardan yig'ilgani ochiladi (`components/finance/CellSources.jsx`).
  Kamomad jadvalidagi "Farq" ham shunday — qaysi kunlarda farq chiqqani
  kunma-kun ochiladi (`components/finance/ControlDays.jsx`). Ochilgan
  oynaning ko'rinishi bir xil: sarlavha, nechta yozuv, tepada Jami,
  keyin qatorlar. Oyna keng (`max-w-5xl`) — raqamlar siqilib qolmasin.
  Bosiladigan joylar: Pul rejasidagi har katak va Jami, Moliya bosh
  sahifasidagi "Shu oyda kirgan/chiqqan/xarajat", Kassalar sahifasidagi
  har kassa summasi, Kamomad "Farq".
- To'lov muddati kelgan kun jadvalda DOIM qator bo'ladi — tanlangan
  davrdan tashqarida bo'lsa ham ("reja" deb belgilanadi). Aks holda
  summa faqat "Jami"da qolib ketadi va rahbar uni qaysi kunga
  qo'yganini ko'rmaydi.
- Rang mantiqi pul nuqtai nazaridan: qarz/pul kelmagani — **qizil**, pul
  tushgani yoki qarz yopilgani — **yashil**.
- Bo'sh yoki ishlatilmaydigan bo'lim menyuda turmaydi.
- Xarajat turida "qat'iy" emas — **"doimiy"**. ("Qat'iy maosh" — ish haqi
  atamasi, u o'zgarmaydi.)

---

## 4. Xatolar daftari

Har biri bir marta bo'lgan. Ikkinchi marta takrorlanmasin.

### Sana solishtiruvi (2026-08-07) — eng qimmatga tushgani
`periodRange()` **Date** qaytaradi, jadvaldagi sana esa `"2026-08-01"` satri.
Kod `String(Date).slice(0,10)` qilgan → `"Sat Aug 0"` → hamma kun chetlab
o'tilgan → **Ustalar reytingida hamma raqam 0** chiqqan.
**Qoida:** sanani solishtirishdan oldin ikkalasini `YYYY-MM-DD` ga keltiring
(`ymd()` / `dayKey()` yordamchilari bor).
Shu xato tegib o'tgan joylar: `installerRange`, `fullMonth`, `fmtDay`.

### Bir jadval — ikki manba (2026-08-07)
Reyting qatorlari oylik raqamni (`m.total`), "Jami" qatori esa davr
raqamini ko'rsatgan. Natija: qatorlarda 320 000, Jami 0.
**Qoida:** qator ham, jami ham BITTA manbadan.

### Servis "Jami tushum"dan chiqarilgan (2026-08-07)
Men servisni tushumdan chiqarib tashlagandim ("u do'kon savdosi emas" deb).
Xato: Billz'da montaj tovar kabi sotiladi va **Savdo ichida** turadi —
shuning uchun nasiya aynan servis summasiga oshib ketardi.

### 10 000 so'm → 9 985 (2026-08-06)
So'm summasi dollarga o'girilib, keyin dollardan qaytarib hisoblangan.
**Yechim:** `companyData.fromSom()` — bitta yo'l, `amount_som` va
`rate_used` doim saqlanadi.

### Menejer kursni o'zgartira olmadi
`companies` jadvalida faqat owner uchun RLS bor edi → "Cannot coerce the
result to a single JSON object". **Yechim:** `set_usd_rate()` SECURITY
DEFINER funksiyasi + `is_manager()` tekshiruvi.

### RLS rekursiyasi
`profiles` siyosatida `is_owner()` / `is_manager()` ishlatilmaydi — ular
SECURITY DEFINER emas, cheksiz rekursiya beradi.

### Sticky "Jami" qatori shaffof qolgan (2026-08-06)
`bg-*/20` shaffof rang bilan sticky qilingan → tagidagi kunlar ko'rinib,
raqamlar ustma-ust tushgan. **Yechim:** qatorga `bg-panel`, ustun ranglari
uning ustiga qo'yiladi.

### Yangi ustun oxiriga tushib qolgan
`localStorage` dagi eski tartibda yangi ustun yo'q edi → oxiriga qo'shilardi.
**Yechim:** `applyPrefs()` yangi ustunni standart ro'yxatdagi qo'shnisidan
keyin qo'yadi.

### "Doimiy xarajat yo'qolib qoldi"
Yozuv bazada bor edi, faqat bo'lim nomi **"Takrorlanuvchi to'lovlar"**
edi — foydalanuvchi "doimiy" deb qidirgan. **Yechim:** nom "Doimiy
xarajatlar" ga o'zgardi va saqlangandan keyin tizim o'sha bo'limga o'zi
o'tkazadi.

### Billz raqami 20 $ ko'p chiqqan (2026-08-13)
Kamomad nazoratida Billz tomoni faqat KIRIMni qo'shardi. Billz'da to'lov
turi almashtirilsa uchta qator yoziladi: naqd chiqim 20, naqd kirim 20,
Payme kirim 20. Faqat kirim olinsa naqd 20 ga ko'p chiqadi — menejer esa
kassada qolgan haqiqiy pulni yozadi.
**Yechim:** Billz tomoni ham **kirim − chiqim** (sof harakat).
Tekshirildi: 01.08 da 2 886.11 → 2 866.11, menejer yozgan raqam bilan
tiyinigacha teng. (P&L allaqachon shunday hisoblardi.)

### Yuklama qatorlari tortilmay qolgan (2026-08-13)
Yuklama (ДДС, Эффективность) QATORLARI ro'yxat bilan birga kelmaydi —
sahifa ochilganda alohida tortiladi (`loadRows`). O'sha effekt `[]`
bog'lami bilan faqat BIR MARTA ishlardi. Ilgari `key={version}` remount
uni qayta ishga tushirar edi; remount olib tashlangach, ilova ochilganda
yuklamalar ro'yxati hali kelmagan bo'lsa qatorlar hech qachon
tortilmasdi — kassa "ДДС yuklang" deb turardi va kamomad yo'qolardi.
**Yechim:** effekt `[live]` ga bog'landi (kassa va P&L sahifalarida).
**Qoida:** remountga tayangan har qanday effektni tekshirish kerak —
u endi o'zi qayta ishga tushishi shart.

### Xato ekrani (2026-08-13)
`app/(app)/error.jsx` qo'shildi: xato chiqsa Next.js'ning quruq
"Application error" ekrani emas, xatoning MATNI ko'rinadi (rasmga olib
yuborish mumkin) va "Qayta urinish" tugmasi turadi.

### Sahifa o'z-o'zidan oldingi ekranga tashlardi (2026-08-13)
`DataProvider` da `<div key={version}>{children}</div>` turgan edi.
`version` har realtime o'zgarishda o'sardi — ya'ni kimdir bir raqam
yozsa, kalit almashib **butun sahifa o'chib-yoqilardi**. Natijada
ochilgan xodim, filtr, oyna, hatto yozilayotgan matn yo'qolardi va
foydalanuvchi oldingi ekranga qaytib qolardi. Bu hamma bo'limda bo'lgan.
**Yechim:** kalit endi faqat ikki holatda almashadi — birinchi yuklash
tugaganda va foydalanuvchi almashganda. Jonli yangilanish uchun
`useLive()` (DataProvider) qo'shildi: sahifa qayta CHIZILADI, lekin
o'chirib-yoqilmaydi. U KPI, kassa, pul rejasi, xarajat va operatsiyalar
sahifalarining memo bog'lamlariga qo'shilgan.
**Qoida:** ma'lumot yangilanishi uchun `key` ni o'zgartirmang — bu
foydalanuvchining ish holatini o'chiradi.

### KPI: ochilgan xodim o'z-o'zidan yopilardi (2026-08-13)
`useEffect(() => setOpenId(null), [view])` har chizilganda ham ishlab
ketardi. Endi `useRef` bilan bo'lim HAQIQATDA almashgani tekshiriladi.

### Netto farq ikki muammoni yashiradi (2026-08-13)
Kamomad jadvali faqat NETTO farqni ko'rsatardi. Bir kuni +1 000, boshqa
kuni −1 000 bo'lsa yig'indi nol chiqadi va ikkala kun ham tekshiruvsiz
qoladi. **Yechim:** kam topshirilgani va ko'p topshirilgani ALOHIDA
yig'iladi va netto ostida ko'rsatiladi (necha kunligi bilan).
**Qoida:** nazorat raqamlarida musbat va manfiy farqlarni bir-biriga
qo'shib yubormaslik kerak.

### Servis puli kamomad bo'lib ko'ringan (2026-08-13)
Menejer servisni naqddan ayirib yozadi (731 → 700 naqd + 31 servis),
Billz esa montajni oddiy sotuv deb naqdga qo'shadi. Solishtiruvda servis
qaytarilmagani uchun har kuni aynan servis summasicha "kamomad" chiqqan.
**Yechim:** KPI tomoni = naqd + Payme + **servis**. Namangan bo'yicha
farq −4 938 dan −464 ga tushdi, 6 kun aniq nolga keldi.

### Ombor qoplamasi tugagan tovarni ko'rsatmagan
`.filter(x => x.stock > 0)` — qoldig'i 0 bo'lgan pozitsiya butunlay
tashlangan. Aslida aynan ular muhim (sotuv yo'qotilyapti). Haqiqiy
yuklamada **163 ta** pozitsiya shu sababdan ko'rinmagan.
**Yechim:** `stock > 0 || moved > 0` + alohida **"Tugagan"** holati.

### Menejer Xarajatlarga kira olmagan
Ruxsatda `"/finance": false`, `"/finance/expenses": true`. Menyu Moliyani
bosganda birinchi ochiq sahifaga tashlagan (Kassalar) va Xarajatlarga yo'l
qolmagan. **Yechim:** bo'lim bosh sahifasi (`HUB_PAGES`) ichidagi biror
sahifa ochiq bo'lsa ochiladi; u yerda faqat ruxsat etilgan kartochkalar
chiqadi. Menejerga kompaniya bo'yicha umumiy raqamlar ko'rsatilmaydi.

### Boshqa mayda, lekin takrorlanadiganlar
- **Gidratsiya xatosi:** brauzer xotirasidan keladigan raqam serverda yo'q →
  `mounted` bayrog'i bilan himoyalanadi.
- **`.next` eskirishi:** `npm run build` dan keyin dev server buzilib
  ko'rinadi (stilsiz sahifa, 404 chunk). Bu kod xatosi emas — qattiq
  yangilash yoki `.next` ni o'chirish kifoya.
- **Magic link:** har yangi link oldingisini bekor qiladi.
- **O'lik jadval:** `cash_operations` bo'sh edi, sahifa o'shandan o'qirdi.
  Yangi sahifa yozishdan oldin jadvalda yozuv bor-yo'qligini SQL bilan
  tekshiring.
- **P&L maydoni:** `pnl.expenses.payroll` (`wages` emas).

---

## 5. Aniqlangan faktlar (o'lchangan, taxmin emas)

- **Qo'lda kiritish xatosi (1–4 avgust):** payme har kuni tiyinigacha
  to'g'ri, **naqd har kuni 260–500 $ farq qiladi**, 4 kunda sof −612 $.
  Farq bir kun musbat, bir kun manfiy — ya'ni kun chegarasi/sanash masalasi
  ham bor, faqat xato emas. Shuning uchun qo'lda kiritishni butunlay olib
  tashlash mumkin emas: u **kamomad nazorati** vazifasini bajaradi.
- **Supabase bepul tarifda:** `pitr_enabled: false`, zaxira ro'yxati bo'sh.
  Ya'ni o'chirilgan yozuvni tiklab bo'lmaydi. Shuning uchun kunlik zaxira
  yozildi (`/api/backup`, Vercel Cron 02:00 UTC = 07:00 Toshkent).
  Telegram va Google Drive uchun kalitlar hali qo'yilmagan.
- **Faqat NSPOS'da yashaydigan ma'lumot:** KPI kunlari, xarajatlar, kassa
  yozuvlari, to'lov rejasi, NPS. Mijozlar va qarzlar Billz'dan qayta
  yuklanadi.
- **Moliya raqamlari avgustdan ekani tasdiqlangan (2026-08-09):** ekrandagi
  "Shu oyda kirgan 49 389.40" = bazadagi avgust KPI yig'indisi (naqd
  34 660 + payme 10 255 + servis 4 474). Avgustdan oldingi 338 kunlik KPI
  yozuvi (60 264 $) hisobga kirmaydi. KPI jadvallarida esa u ko'rinadi —
  shunday kelishilgan.
- **ДДС yuklamasi qisqartirildi (2026-08-09):** fayl 01.01–05.08 ni
  qamragan edi (8 923 qator). Avgustdan oldingi 8 724 qator o'chirildi,
  199 qator qoldi (01.08–05.08, kirim 17 179 $). Sabab: eski oy ma'lumoti
  umuman turmasin. Asl fayl `~/Downloads` da va Billz'da bor.
  **Qolgan yuklamalar tekshirildi** — `summary`, `transactions`, `pnl`
  allaqachon faqat avgustdan; `clients` va `client_debts` — hozirgi holat
  (davr emas); `efficiency` 20.06 dan boshlanadi va faqat ombor
  tahlilida ishlatiladi (moliyaga tegmaydi).

---

## 6. Foydali usullar

- **Hisobotni haqiqiy ma'lumot bilan tekshirish:** Billz eksportini
  `public/` ga vaqtincha qo'yib, brauzerda `fetch` bilan olib, `<input
  type=file>` ga `DataTransfer` orqali berish mumkin — demo rejimda
  hisobot chinakam ma'lumot bilan chiziladi. Tekshirgach faylni o'chiring.
- **Bazani ko'rish:** `node scripts/sql.mjs "select ..."` — dashboardga
  kirish shart emas.
- **Sahifa buzilmaganini tez tekshirish:** `curl -s -o /dev/null -w "%{http_code}"
  http://localhost:3000/<yo'l>` — 500 bo'lsa kompilyatsiya xatosi bor.
- **Excel o'qish (Node):** `XLSX.readFile` ishlamaydi; `fs.readFileSync` +
  `XLSX.read(buf, {type:"buffer"})` kerak.

---

## 7. Ochiq ishlar

- [ ] Kunlik raqamlarni ДДС faylidan avtomat to'ldirish (terishni yo'qotadi)
- [ ] Zaxira uchun Telegram bot tokeni va Google Drive havolasi
- [ ] Oflayn rejim: PWA + yozuvlar navbati (foydalanuvchi "yozish ham
      kerak" dedi)
- [ ] Tezlik: ilova ochilganda hamma jadvalni yuklamasin
- [ ] "Ustunlar" sozlamasi qolgan hisobotlarga (Hisobdan chiqarishlar,
      Ombor qiymati, Import partiyalari). Tayyor: Ombor qoplamasi,
      Buyurtma taklifi, Servis foydasi, ABC tahlil.
      Qarzdorlar ataylab tegilmagan — undagi ustunlar foydalanuvchining
      o'z 15/20/30 kunlik guruhlari.
- [ ] Billz'ga qo'ng'iroq: API narxi va hisobotni pochtaga avtomat
      yuborish imkoniyati

---

## 8. Muloqot uslubi

- Javob **qisqa** — bir necha qator. Uzun xususiyat tavsiflari yozilmaydi.
- Ish oxirigacha o'zim bajaraman: migratsiya, tekshiruv, saytga chiqarish.
  Foydalanuvchiga faqat jismonan qila olmaydigan qadam qoldiriladi.
- Har o'zgarishdan keyin saytga chiqariladi — u lokal serverda emas,
  saytda ishlaydi.
- Xato qilsam — bahona emas, sababini aytaman va tuzataman.
