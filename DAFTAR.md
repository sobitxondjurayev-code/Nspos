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
| Kassa **kunlik** yopiladi, butunlay emas | Ilgari bir bosishda hisob boshidan yig'ilgan hamma pul ketardi: qaysi kunniki ekani yo'qolar, yopilmay qolgan kun esa umuman ko'rinmasdi. Endi har kunning o'z qoldig'i topshiriladi va yopilmagan kun qizarib turadi (`kassaDailyRows`, `closeDay`) |
| Yopilgan kun `kassa_ops` da `kind='transfer', category='close'` bilan belgilanadi | Pul harakati bitta jadvalda qoladi. Topshiriladigan pul bo'lmasa 0 summali yozuv yoziladi — "bu kun tekshirildi" degani (shu sabab `amount > 0` cheklovi `>= 0` ga o'zgardi, `scripts/sql/kassa-close-day.sql`) |
| Kun yopilganda har hamyon O'Z kirim−chiqimi bilan topshiriladi | Servis ham hamyon: servis materiallari servis pulidan chiqadi, shuning uchun topshiriladigan servis = servis kirimi − servis chiqimi. Yopish oynasida har hamyon uchun kirim/chiqim/qoldiq qatori turadi, jadvalda esa "Naqd/Payme/Servis kirim" va "... chiqim" ustunlari (Ustunlar dan yoqiladi) |
| Kunlik jadvaldagi har ustun KUNLIK bo'ladi, jamlanma emas | "Kassada qoldi" avval yugurib boradigan (jamlanma) raqam edi — hamma kunda BIR XIL turardi va foydalanuvchi ikki marta "tushunmadim" dedi (2026-08-13). Endi u o'sha kundan qolgani: `kirim − chiqim − topshirilgan`. Kun to'liq topshirilsa NOL — jadvalda faqat muammoli kun ko'zga tashlanadi. Jami esa yig'indi bo'lib, kassaning hozirgi qoldig'iga teng chiqadi. **Qoida:** kunlik jadvalda jamlanma raqam ko'rsatilmaydi — jamlanmaning joyi kartochka yoki "Jami" |
| Manfiy "Kassada qoldi" — ortiqcha topshirilgan | O'sha kuni kassada bo'lganidan ko'p pul berilgan. Deyarli har doim sababi: xarajat kun yopilgandan KEYIN kiritilgan. Jadval ostida qizil izoh chiqadi — qaysi kun, qancha qolgan edi, qancha topshirilgan |
| Kunlik jadvaldagi "Kassada qoldi" tasdiqlanmagan pulni ham sanaydi | Kartochkadagi raqam ham shunday. Ikki joyda ikki xil qoldiq chiqmasligi uchun — yo'ldagi pul alohida ko'rsatiladi |
| Menejer 2 kundan oldingi kunlik raqamni tahrirlay olmaydi | Rahbar tahrirlay oladi |
| Menejer faqat BUGUNGI xarajatni tuzata/o'chira oladi | Eski yozuvni o'zgartirish — hisobni orqadan tahrirlash. Doimiy xarajat esa umuman faqat rahbarniki. Himoya ikki qavat: interfeysda tugma chiqmaydi, bazada esa `expense_update`/`expense_delete` siyosati (sana Toshkent vaqti bo'yicha) |
| Ustaga pul 1, 5, 10, 15, 20, 25-kunlari beriladi | Oylik 1-sanada, keyin har 5 kunda. Menejer faqat shu kunlarga yoza oladi (`payDayCol`), rahbar esa istalgan kunga — favqulodda holat bo'lib turadi |
| Ustalar reytingidagi ustun "Balans" — o'tgan oy qarzi ham ichida | Faqat shu oy hisoblansa "1,5 mln berishimiz kerak" degan yolg'on chiqadi, aslida usta iyulda oldindan olib bo'lgan. Formula: `carryIn + ishlab topgan − olgan` |
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
  har kassa summasi, Kamomad "Farq", kassaning kunlik jadvalidagi har
  katak va Jami (`kassaSources`).
- Ochilgan ro'yxatda ikki ko'rinish bor: **"Turi bo'yicha"** (tushlik,
  yo'lkira, mashina gazi — har biri yig'ilgan, nechtaligi bilan) va
  **"Ro'yxat"** (har yozuv alohida, sanasi bilan). Yozuv turlardan ko'p
  bo'lsa yig'ilgani o'zi ochiladi. Kassaning kunlik jadvalidan
  ochilganda **"Qayerdan"** ustuni ham bo'ladi: pul qaysi qopdan chiqqan
  — `B2C · Naqd`, `B2B · Payme`, `Servis` (rahbar shu tilda o'ylaydi).
- Bosiladigan raqam **ko'rinib tursin**: ostida nuqtali chiziq bo'ladi,
  hover'da esa yorug'lik. Faqat hover'da bilinsa foydalanuvchi ustiga
  bosish mumkinligini umuman bilmaydi — shu sabab "bosilmayapti" degan
  fidbek keldi (2026-08-13).
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

### "Foyda va zarar" bo'm-bo'sh: tushum 0 (2026-08-13)
P&L sahifasida jami tushum 0.00, "0 ta sotuv" turardi, sof foyda esa
faqat xarajatdan iborat edi. Ikkita mustaqil sabab bir joyda uchrashgan:

1. **Sahifa "Сводный" qatorlarini umuman so'ramagan.** `loadRows` faqat
   "Pul oqimi" tabidagi `efficiency` uchun chaqirilardi, holbuki tushum
   va tannarx `summary` yuklamasidan keladi. Qator yo'q → `uploadedDaily`
   `ready:false` → tushum 0. Ustiga useMemo bog'lami `[range]` edi,
   ya'ni qatorlar kelganda ham hisob qayta yurilmasdi.
2. **Sana taqqoslashda yana o'sha Date/String xatosi.**
   `dailyTotals` da `String(from).slice(0,10)` → `"Sat Aug 01"`, va
   `"2026-08-02" >= "Sat Aug 01"` yolg'on chiqadi ("2" < "S") — bitta
   ham kun tanlanmasdi. Bir xil xato `pnlData` va `kassaIncome` da ham
   bor edi (kassada `to` filtri tasodifan zararsiz ishlagan).

**Yechim:** `lib/dates.js` ga umumiy `ymd()` qo'shildi (Date, "YYYY-MM-DD"
va "01.08.2026" — hammasi bir ko'rinishga) va hamma taqqoslash o'shanga
o'tkazildi. Yuklama qatorlarini tortish esa `components/useUploadRows.js`
hookiga chiqarildi: kerakli hisobot ro'yxati beriladi, u `[live]` ga
bog'lanadi va qaytargan belgisi useMemo bog'lamiga qo'shiladi.
Moliya bosh sahifasi ham shu hookka o'tdi — u ham 0 tushum bilan
hisoblab, "shu oyda zarar" ko'rsatib turgan edi.

**Qoida:** yuklamaga tayanadigan yangi sahifa yozilsa — `useUploadRows`
chaqirilsin va qaytgan qiymati BARCHA useMemo bog'lamlariga qo'shilsin;
sana taqqoslansa — `ymd()` ishlatilsin, `String(sana).slice()` emas.

**Eslatma:** yuklangan "Сводный" 01–05 avgustni qamraydi, shuning uchun
tuzatishdan keyin ham 06-avgustdan keyingi kunlar tushumsiz turadi —
Billz'dan yangi "Сводный отчет" chiqarib yuklash kerak.

### Balansdagi mijoz qarzi ikki barobar katta chiqqan (2026-08-13)
Balansda "Mijozlardan olinadigan qarz" 103 379.68 USD (659 ta qarz)
turardi. Billz'ning "Долги клиентов" yuklamasida esa haqiqiy raqam:
**366 ta ochiq qarz, 58 933.97 USD**.

Sabab — yuqoridagi bilan bir xil: balans sahifasi yuklama qatorlarini
tortmasdi, `uploadedDebts()` "ready emas" deb qaytarardi va hisob
bazadagi ESKI, qisman modellashtirilgan qarzlarga tushib ketardi
(`debts` jadvalida 659 qator, `debt_payments` da esa BITTA ham to'lov
yo'q — shuning uchun hamma qarz "to'liq ochiq" bo'lib ko'ringan).

**Yechim:** balans, qarzlar, yetkazib beruvchilar va rahbariyat
sahifalari `useUploadRows(["client_debts", …])` ga o'tkazildi.
**Qoida:** yuklama bor joyda baza nusxasi zaxira sifatida qoladi —
zaxira ishlab ketgani bilinmaydi, chunki raqam "bor". Shuning uchun
yuklamaga tayanadigan sahifa ro'yxatini kengaytirganda qatorlarni
tortishni ham birga qo'shish shart.

### Minusdagi kun kassada qotib qolardi (2026-08-13)
Kassa kartochkasida "Naqd −28.69" turardi, lekin sababi ko'rinmasdi.
Tekshiruv: 9-avgustda Optim kassasiga naqd 98.30 tushgan, xarajat esa
126.98 qilingan. Kun yopilganda faqat MUSBAT qoldiq topshiriladi
(o'sha kuni Payme 100.00 ketgan), minus esa kassada qolib ketadi va
keyingi kunlarga ergashadi.

**Yechim:** `negativeDays()` qo'shildi — o'tgan kunlar ichida qaysi
hamyon minusga tushgani topiladi va kartochkada sariq ogohlantirish
chiqadi ("9-avgust — Naqd 28.68 minusda · kirim to'liq yozilganini
tekshiring"). BUGUN sanalmaydi: kirim odatda kechqurun yoziladi, aks
holda har ertalab soxta ogohlantirish chiqardi. Xuddi shu holat
rahbariyat dashboardidagi `alerts()` ga ham "danger" bo'lib chiqadi —
menejer o'z kartochkasida ko'radi, rahbar esa ogohlantirishlar
ro'yxatida.

### Kassa butunlay yopilardi (2026-08-13)
"Kassani yopish" bosilganda hisob boshidan yig'ilgan HAMMA pul bitta
o'tkazma bo'lib ketardi. Natijada: qaysi kunning puli ekani yo'qolardi,
bir kun unutilsa u hech qayerda ko'rinmasdi, rahbar esa "13-avgustda
qancha topshirilgan edi?" degan savolga javob topolmasdi.
**Yechim:** kun bo'yicha yopish. Har kassaning o'z sahifasi bor
(`/finance/kassa/<id>`): kunma-kun kirim, chiqim, kun qoldig'i,
topshirilgan va kassada qolgan pul; har kunning o'z "Yopish" tugmasi va
holati (yopilgan — qancha bilan, yoki yopilmagan). Kartochkada esa
"N kun yopilmagan" ogohlantirishi turadi.
**Qoida:** yopilishning belgisi — `category='close'` bo'lgan transfer
yozuvi. Tasdiq kutayotganlar rahbarga KUN bo'yicha guruhlanib ko'rinadi
(bir kun yopilganda uchtagacha hamyon yozuvi tug'iladi, ular uchta qator
bo'lib chiqmasligi kerak).

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
