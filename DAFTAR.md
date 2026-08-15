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
| Rahbarga o'tkazma Xarajatlar ro'yxatida KO'RINADI, lekin "Jami"ga qo'shilmaydi | Rahbar so'radi (2026-08-15): "u ham kassadan olingan pulku". To'g'ri — pul KASSADAN chiqadi, lekin KOMPANIYADAN chiqmaydi, u kompaniya balansiga ko'chadi. Shuning uchun ro'yxatda alohida qator bo'lib turadi (`kassaData.ownerTransferRows`), jami ostida esa "+ Rahbarga o'tkazma: …" bo'lib ko'rsatiladi. `expensesInRange` ga QO'SHILMAYDI — aks holda P&L sof foydani, kassa balansi esa pulni ikki marta kamaytirardi. Haqiqiy xarajat — **NS** (rahbar o'ziga olgan pul), u boshqa yozuv |
| Menejer kursni o'zgartira oladi | Xarajat so'mda kiritiladi, kurssiz saqlab bo'lmaydi. Bazada `set_usd_rate()` SECURITY DEFINER + `is_manager()` |
| Kassa: 3 ta (b2b, b2c, kompaniya), har birida naqd/payme/servis | B2B kassada servis YO'Q |
| Kassa **kunlik** yopiladi, butunlay emas | Ilgari bir bosishda hisob boshidan yig'ilgan hamma pul ketardi: qaysi kunniki ekani yo'qolar, yopilmay qolgan kun esa umuman ko'rinmasdi. Endi har kunning o'z qoldig'i topshiriladi va yopilmagan kun qizarib turadi (`kassaDailyRows`, `closeDay`) |
| Yopilgan kun `kassa_ops` da `kind='transfer', category='close'` bilan belgilanadi | Pul harakati bitta jadvalda qoladi. Topshiriladigan pul bo'lmasa 0 summali yozuv yoziladi — "bu kun tekshirildi" degani (shu sabab `amount > 0` cheklovi `>= 0` ga o'zgardi, `scripts/sql/kassa-close-day.sql`) |
| Kun yopilganda har hamyon O'Z kirim−chiqimi bilan topshiriladi | Servis ham hamyon: servis materiallari servis pulidan chiqadi, shuning uchun topshiriladigan servis = servis kirimi − servis chiqimi. Yopish oynasida har hamyon uchun kirim/chiqim/qoldiq qatori turadi, jadvalda esa "Naqd/Payme/Servis kirim" va "... chiqim" ustunlari (Ustunlar dan yoqiladi) |
| Kunlik jadvaldagi har ustun KUNLIK bo'ladi, jamlanma emas | "Kassada qoldi" avval yugurib boradigan (jamlanma) raqam edi — hamma kunda BIR XIL turardi va foydalanuvchi ikki marta "tushunmadim" dedi (2026-08-13). Endi u o'sha kundan qolgani: `kirim − chiqim − topshirilgan`. Kun to'liq topshirilsa NOL — jadvalda faqat muammoli kun ko'zga tashlanadi. Jami esa yig'indi bo'lib, kassaning hozirgi qoldig'iga teng chiqadi. **Qoida:** kunlik jadvalda jamlanma raqam ko'rsatilmaydi — jamlanmaning joyi kartochka yoki "Jami" |
| Manfiy "Kassada qoldi" — ortiqcha topshirilgan | O'sha kuni kassada bo'lganidan ko'p pul berilgan. Deyarli har doim sababi: xarajat kun yopilgandan KEYIN kiritilgan. Jadval ostida qizil izoh chiqadi — qaysi kun, qancha qolgan edi, qancha topshirilgan |
| Kunlik jadvaldagi "Kassada qoldi" tasdiqlanmagan pulni ham sanaydi | Kartochkadagi raqam ham shunday. Ikki joyda ikki xil qoldiq chiqmasligi uchun — yo'ldagi pul alohida ko'rsatiladi |
| "Berishim kerak" — alohida oyna, uch ko'rinishli | Sahifadagi "Berishim kerak" tugmasi (Yangi to'lov yonida) ochadi. **Kunlar bo'yicha**: sana, naqd, Payme, kassalardagi balans, o'sha kuni kimga/nima uchun berish kerakligi va kimga berilgani. **Rejada** va **To'langan** — ro'yxatlar. Ism ustiga bosilsa o'sha odam bo'yicha BUTUN tarix ochiladi (avval qancha berilgan, yana qancha berish kerak) |
| Pulni qaytaradigan har tugma tasdiq so'raydi | "Rejaga qaytarish" ham pul harakati: bosilsa kassa raqami o'zgaradi. Tasodifan bosilib ketmasin |
| To'langan to'lov "Berishim kerak" ustunida yashil qator bo'lib turadi | Rahbar "To'ladim" bosgach uni jadvalda topolmadi (2026-08-13): pul xarajat ustuniga tushardi, lekin u ustun o'ngda, ba'zan yashirin. Endi reja ostida "✓ 766.00 to'langan" turadi — bosilsa "To'langan" ro'yxati ochiladi (`focusTab`) |
| Xarajat ustunlari QOP bo'yicha bo'linadi, tur bo'yicha emas | Pul qaysi hamyondan chiqqan bo'lsa o'sha ustunga tushadi (`potCol`): servis pulidan chiqqani — "Servis xarajatlar", do'kon kassasidan — "Do'kon xarajatlari". Shunda kirim − xarajat = o'sha qopdagi pul. Ilgari oylik birinchi tekshirilardi va usta oyligi servis pulidan berilsa "Servis xarajatlar"dan tushib qolardi — kartochkadagi servis balansi jadvalga to'g'ri kelmasdi (2026-08-13 fidbegi) |
| Usta olgan puli — "Oylik" turidagi XARAJAT (bitta manba) | KPI jadvalidagi "olgan pul" `expensesData.expensesInRange()` ichida virtual xarajat yozuvi bo'lib qo'shiladi: `category='salary'`, `method='service'`, kassa — ustaning do'koni yoki kompaniya. Shu sababli u Xarajatlar bo'limida ham, kassa balansida ham, Pul rejasida ham BIR XIL sanaladi va qo'lda uch joyda takrorlanmaydi. Tahrirlanmaydi — KPI jadvalida yuritiladi (`source: "installer"`). **P&L da esa oylik OPEX dan chiqarilgan**: ish haqi payroll modulidan hisoblangani bo'yicha olinadi, aks holda ikki marta chegirilardi |
| Usta olgan puli SERVIS balansidan ayriladi va "Oylik maoshlar" ustunida turadi | Ustalar reytingidagi "olgan pul" — oylik, u montaj (servis) pulidan beriladi (rahbar, 2026-08-13). Ilgari balansdan chiqmasdi: kassada allaqachon berib yuborilgan pul turgandek edi. Endi `kassaBalances` uni servis hamyonidan ayiradi, jadvalda esa avvalgi joyida — "Oylik maoshlar" ustunida |
| "Oylik maoshlar" = FAQAT ustalarniki; menejer oyligi o'z qopida | Rahbar qoidasi (2026-08-13, uzoq muhokamadan keyin): usta oyligi servis pulidan beriladi (reytingdagi "olgan pul" + servis qopidan berilgan oylik) va "Oylik maoshlar" ustunida turadi. Menejer/kassir o'z oyligini xarajat qilib kiritadi — u qop ustuniga tushadi (B2B/Do'kon/Kompaniya xarajatlari). "Servis xarajatlar" esa material, gaz, avtol. **Formula: servis kirimi − ("Servis xarajatlar" + "Oylik maoshlar") = kassadagi servis puli** |
| "Kimga" va "nima uchun" — BITTA maydon | Rahbar "Hiside China" deb o'ylaydi, "Tovar keltirish" deb emas. Ro'yxat `PAYOUT_PAYEES` da nom + tur bo'lib turadi (`payeeCategory()`), tur alohida so'ralmaydi. Ilgari to'langan nomlar ham ro'yxatga qo'shiladi (`payeeNames()`). Qo'lda yozilsa "Ravshan EZVIZ" va "Ravshan ezviz" ikki xil odam bo'lib, tarix bo'linib ketardi. "Boshqa" tanlansa — ism qo'lda, tur so'raladi va izoh MAJBURIY |
| Yangi to'lov oynasida ikki tugma: "Saqlash" va "To'lash" | Har xarajat rejalashtirilmaydi — ba'zisi hozir to'lanadi. "To'lash" bir bosishda yozadi ham, to'laydi ham: pul o'sha zahoti kassadan chiqadi va "To'langan" ro'yxatiga tushadi |
| Kompaniya balansidan chiqim Pul rejasida rejalashtiriladi | Asosiy ish shu — shuning uchun "Yangi to'lov" tugmasi sahifaning O'ZIDA turadi ("Berishim kerak" kartochkasi ichida yashirin emas). To'langach pul kassadan chiqadi va jadvalda "Kompaniya xarajatlari" ustuniga tushadi |
| Menejer ustaga login/parol o'zi ochadi | B2C do'kon menejeri (Abdulahad) kundalik ishni ustalar bilan yuritadi — yangi usta kelganda yoki parol unutilganda rahbarni kutib turmaydi. Sozlamalarda unga "Ustalar — login va parol" kartochkasi chiqadi. FAQAT usta roli: boshqa rol ocha olmaydi, rahbar/menejer parolini almashtira olmaydi. Cheklov serverda (`app/api/staff/route.js`, `canTouch`) — interfeysdagi emas |
| Menejer 2 kundan oldingi kunlik raqamni tahrirlay olmaydi | Rahbar tahrirlay oladi |
| Xarajat oynasida so'm/USD tanlanadi va o'chirish tugmasi bor | Odatda xarajat so'mda, lekin import/tovar dollarda o'ylanadi. Tur almashganda maydon TOZALANADI (ilgari "100 000" bir bosishda 100 000 dollar bo'lib ketgan). Tahrirlashda aynan kiritilgan raqam ko'rsatiladi. O'chirish tugmasi huquqi borgagina chiqadi |
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
- Ochilgan ro'yxatdagi yozuv **bosiladigan**: xarajat bo'lsa
  `/finance/expenses?edit=<id>` ga o'tadi va o'sha yozuv tahrirlash
  oynasida ochiladi (doimiy xarajatning kunlik nusxasi emas, QOIDASI
  ochiladi: `?tab=doimiy&edit=<recurringId>`). Reja to'lovi bo'lsa —
  Pul rejasiga. Qatorda "ochish ›" belgisi turadi. Sabab: "bu xarajat
  qayerdan chiqdi?" degan savoldan keyin doim "uni qanday tuzataman?"
  keladi (2026-08-13).
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
- To'lov rejasi kunlik jadvalda EMAS, "Berishim kerak" oynasida
  (2026-08-13 dan). Kunlik jadval faqat pul harakatini ko'rsatadi;
  reja, muddatlar va to'langanlar alohida oynada, kunlar bo'yicha
  jadval bilan. Kelasi muddat ham o'sha jadvalda qator bo'lib turadi —
  summa faqat "Jami"da qolib ketmasligi uchun.
- Rang mantiqi pul nuqtai nazaridan: qarz/pul kelmagani — **qizil**, pul
  tushgani yoki qarz yopilgani — **yashil**.
- Bo'sh yoki ishlatilmaydigan bo'lim menyuda turmaydi.
- Xarajat turida "qat'iy" emas — **"doimiy"**. ("Qat'iy maosh" — ish haqi
  atamasi, u o'zgarmaydi.)

---

## 3-A. Aytilgan gap qayerga yoziladi (takrorlamaslik tizimi)

Bir marta aytilgan narsa ikkinchi marta aytilmasligi uchun har fidbek
o'z JOYIGA yoziladi. Joyi to'rtta, aralashtirilmaydi:

| Fidbek turi | Qayerga | Qachon ishlaydi |
|---|---|---|
| Uslub, ko'rinish, ish tartibi ("javob qisqa bo'lsin", "jadvalda Jami tepada") | `CLAUDE.md` → Fidbek qoidalari | Har sessiya boshida o'qiladi |
| Qaror va uning SABABI ("servis tushumga kiradi, chunki…") | `DAFTAR.md` | Ish boshlashdan oldin o'qiladi |
| **"Bu raqam ana u raqamga teng bo'lishi kerak"** | `lib/moslik.js` → `CHECKS` | **Kodga aylanadi**: har `npm run tekshir` da va ilova ichida o'zi tekshiriladi |
| **"Bunday ma'lumot xato"** (minus hamyon, ikkilangan to'lov) | `lib/audit.js` → `moneyWarnings` | Xuddi shunday: terminalda ham, ekranda ham |

Pastdagi ikkitasi eng muhimi: **qoida kodga aylansa, uni eslash shart
emas.** Men unutsam ham, `npm run tekshir` eslatadi; rahbar ekranni
ochsa "Tekshirib ko'ring" kartochkasida ko'radi. Yangi qoida qo'shish —
bitta funksiya va ro'yxatga bitta qator.

**Tekshiruv ilovaning O'Z kodini ishlatadi** (`scripts/lib/yuk.mjs`
modullarni haqiqiy baza qatorlari bilan to'ldiradi). Formulani
tekshiruvda qayta yozish taqiqlanadi — sabab pastda, "Tekshiruv
o'zi yolg'on aytdi" bandida.

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

### To'langan reja jadvalda ko'rinmasdi (2026-08-13)
Pul rejasida "To'ladim" bosilganda `payPayout()` kassa chiqimi yozadi —
pul kassadan (odatda **kompaniya balansidan**) chiqib ketardi. Lekin
kunlik jadvalning `fillDays()` funksiyasi kassa chiqimlaridan faqat
**maosh va NS** ni olardi: "Tovar keltirish", "Import xarajati" kabi
to'lovlar hech qaysi ustunga tushmasdi. Natijada balans kamayardi-yu,
jadval "qayerga ketdi?" degan savolga javob bermasdi (tepadagi "Chiqqan
pul" kartochkasi esa uni sanardi — ikki raqam bir-biriga qarshi edi).
**Yechim:** `opCol()` — kassa chiqimi ham xarajatlar bilan bir xil
qoidada ustunga ajratiladi (maosh → Oylik, NS → NS, servis hamyoni →
Servis xarajatlar, do'kon kassasi → Do'kon/B2B xarajatlari, qolgani →
Kompaniya xarajatlari). `flowSources()` ham shu qoidada — ochilgan
ro'yxat katakdagi raqamga teng chiqishi uchun.
**Qoida:** pul kassadan chiqsa, u ALBATTA biror ustunda ko'rinishi kerak.

### Sozlamalardagi xodimlar ro'yxati DEMO bo'lib qolgan (2026-08-13)
Sozlamalar → "Xodimlar va vakolatlar" jadvalida bazadagi 17 ta xodim
o'rniga demo ro'yxat (Bahodir Qosimov, Sanjar Umarov, Ulug'bek Rasulov)
turardi — rahbarga ham, menejerga ham. Sabab: `useMemo(() => listStaff(),
[tick])` ro'yxatni sahifa ochilishida — ma'lumot bazadan KELISHIDAN
oldin — bir marta hisoblardi va boshqa qayta yurmasdi. `staff` ning
boshlang'ich qiymati esa `BILLZ_STAFF` (demo), shuning uchun ekranda
soxta odamlar qotib qolardi. KPI sahifasi to'g'ri ishlagani chalg'itdi —
u `useLive()` ni bog'lamiga qo'shgan edi.
**Yechim:** `useLive()` shu yerga ham qo'shildi.
**Qoida:** modul xotirasidan o'qiydigan HAR useMemo bog'lamiga `useLive()`
kerak. Demo qiymat bilan boshlanadigan modulda bu ayniqsa muhim: xato
"bo'sh ekran" bo'lib emas, **ishonarli, lekin soxta ro'yxat** bo'lib
chiqadi va darrov ko'zga tashlanmaydi.

### Menejerning yozuvi RLS'ga urilmasin — server yo'lidan (2026-08-13)
Menejerga ustaga login ochish berilganda birinchi o'y `profiles` ga
menejer uchun UPDATE siyosati qo'shish edi. Qilinmadi: RLS **ustun
darajasida** cheklay olmaydi, ya'ni siyosat menejerga usta qatorini
ochsa, u o'sha qator ichidagi `perms` va `fixed_salary` ni ham
o'zgartira olardi. Shuning uchun menejerning har yozuvi
`/api/staff` orqali ketadi — u yerda qaysi maydon o'zgarishi aniq
sanab qo'yilgan (parol, telefon, ism), qolganiga umuman tegilmaydi.
Natijada `profiles` RLS'i avvalgidek qoldi: yozish faqat rahbarda.
**Qoida:** "shu rolga ham ruxsat beray" deganda avval so'rang — cheklov
QATOR bo'yichami yoki USTUN bo'yicha. Ustun bo'yicha bo'lsa RLS emas,
server yo'li kerak.

### Ikki suhbat ishi bir kommitga aralashib ketdi (2026-08-13)
Bir papkada ikki Claude suhbati baravar ishlagan. Biri "To'lov rejasi"
ustida, ikkinchisi "Menejer ustaga login ochadi" ustida. Birinchisi
`git add -A` bilan kommit qilganda ikkinchisining hali TUGALLANMAGAN
fayllari ham (`api/staff/route.js`, `staffData.js`, `StaffModal.jsx`,
`auth.js`, `settings/page.jsx`) o'sha kommitga tushib ketdi — kommit
xabari esa faqat to'lov rejasi haqida. Ustiga sinov uchun yozilgan
vaqtinchalik `.tmp-mgr.mjs` skripti ham repoga kirdi.

Nima yomon: kommit endi "bitta ish" emas, kommit xabari yolg'on,
orqaga qaytarish (revert) esa ikkinchi ishni ham o'chiradi.

**Yechim ikki qavat:**
1. `.gitignore` ga `.tmp`, `.tmp/`, `.tmp-*` qo'shildi — vaqtinchalik
   fayl endi `git add -A` ga ham ilinmaydi.
2. **Qoida:** `git add -A` / `git add .` / `git commit -a` ishlatilmaydi.
   Faqat o'zim tekkan fayllar nomma-nom qo'shiladi. Kommit oldidan
   `git status` ko'riladi; begona o'zgargan fayl bo'lsa unga tegilmaydi.
   Vaqtinchalik fayl loyiha ildiziga emas, `.tmp/` ga yoziladi.

**Eslatma:** `npx vercel --prod` ish papkasidagi HOLICHA yuboradi —
ya'ni boshqa suhbatning yarim ishi ham saytga chiqib ketishi mumkin.
Chiqarishdan oldin `git status` toza ekaniga ishonch hosil qiling.

### "Servis balansi xato" — aslida usta oyligi (2026-08-13)
Kartochkada Servis 3 535.99, jadvalda esa Servis 4 473.90 va Servis
xarajatlar −503.07 (ya'ni 3 970.83 kutilardi). Farq **434.84**.
Bazadan tekshirildi: `expenses` da `method='service'` va
`category='salary'` bo'lgan 12 ta yozuv — **usta oyligi servis pulidan
to'langan**. Jadvalda u "Oylik maoshlar" ustuniga tushadi (tur bo'yicha),
balansda esa servis hamyonidan chiqadi (hamyon bo'yicha). Ikkalasi ham
to'g'ri — ustunlar TUR bo'yicha, hamyon esa PUL bo'yicha bo'lingan.
Uchala hamyon tekshirildi va tiyinigacha to'g'ri:
naqd 38 452.44 − 1 603.31 − 10 591.00 = **26 258.13**;
Payme 10 492.26 − 1 400.00 = **9 092.26**;
servis 4 473.90 − 937.91 = **3 535.99**.
**Yechim:** "Hozir kassalarda" kartochkasidagi har hamyon endi bosiladi —
`walletSources()` o'sha hamyonga tushgan va undan chiqqan hamma yozuvni
beradi (kassadan kassaga ko'chish sanalmaydi, aks holda ikki marta
qo'shilardi). Turi bo'yicha yig'ilgan holda ochiladi, ya'ni "oylik
−434.84" darrov ko'rinadi.
**Qoida:** ustun va hamyon boshqa-boshqa kesim — biri mos kelmasa,
avval "bu pul qaysi hamyondan chiqqan?" deb so'ralsin.

### Pul ikki marta chiqib ketdi — vaqtinchalik id (2026-08-13)
"Yangi to'lov" oynasidagi "To'lash" bosilganda yozuv bazaga tushib
ulgurmasdan turib to'lanardi: `sync.changed()` HALI ALMASHMAGAN
vaqtinchalik id bilan (`p-3-msrisgre`) UPDATE qilardi va baza
`invalid input syntax for type uuid` deb rad etardi. Natijada:
kassa chiqimi bazaga tushgan, to'lov esa "rejada" bo'lib qolgan.
Sahifa yangilangach reja yana ko'rinib, foydalanuvchi uni ikkinchi
marta to'lagan — **pul ikki marta kassadan chiqqan** (3 647 $ payme).
**Yechim (ikki qavat):**
1. `syncTable` endi hali yozilayotgan yozuvni kuzatadi (`creating`
   map): shu paytda kelgan `changed`/`deleted` insert tugab, haqiqiy
   id kelgach bajariladi. Bu butun ilova uchun ishlaydi.
2. `addPayout()` haqiqiy id va'dasini qaytaradi (`p.saved`), sahifa
   esa "To'lash" da o'shani KUTADI.
Ikkilangan uchta yozuv bazadan o'chirildi (531ff6f7, 908ad5df,
dc251892). Payme qoldig'i 1 798.26 dan 5 445.26 ga qaytdi.
**Qoida:** yangi yozuv yaratilgan zahoti uni o'zgartirmang — avval
`saved` (haqiqiy id) kutilsin.

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

### Tekshiruv o'zi yolg'on aytdi (2026-08-14) — eng qimmatlisi
`npm run tekshir` "naqd 26 786.89 · hammasi joyida" deb turgan paytda
ekranda 25 286.89 turgan edi. Sabab: skript formulalarni SQL da QAYTA
yozgan va doimiy xarajatni (`is_recurring = true` — 1 500 $ ijara)
umuman olmagan. Ya'ni nazorat vositasining o'zi nazoratdan chiqqan.

**Yechim:** skript endi hech narsa hisoblamaydi — ilovaning o'z
funksiyalarini chaqiradi. `scripts/lib/yuk.mjs` har modulni haqiqiy
baza qatorlari bilan to'ldiradi (modul qaysi ustunlarni so'rasa,
o'shani — pastdagi `ledger_start` xatosi shundan topildi), keyin
`kassaBalances()`, `moneyFlow()`, `profitAndLoss()` — ekrandagi
raqamni chiqaradigan aynan o'sha kod ishlaydi.
**Qoida:** tekshiruvda formula qayta yozilmaydi. Yozilsa, u ertami-kech
ilovadan uzoqlashadi va "hammasi joyida" degan yolg'on chiqaradi.

### Hisob boshi 1-sentabrda yo'qolib ketardi (2026-08-14)
`companies` moduli bazadan `ledger_start` ustunini SO'RAMAGAN edi
(`select` ro'yxatida yo'q). `fromRow` esa uni topmasa joriy oy boshini
qo'yardi. 14-avgustda ikkalasi ham "2026-08-01" bo'lgani uchun xato
ko'rinmasdi — 1-sentabrda esa hisob boshi o'zi "2026-09-01" ga
sakrardi va **butun avgust kassa balansidan, P&L dan, balansdan
yo'qolardi**.
**Qoida:** modulning `select` ro'yxatiga ustun qo'shishni unutmang;
tekshiruv ham aynan o'sha ro'yxat bo'yicha o'qiydi, shuning uchun
bunday xato endi topiladi.

### Ish haqi uch sahifada uch xil edi (2026-08-14)
Bitta oy uchun: P&L 2 881.25 (KPI bo'yicha), rahbariyat paneli 0
(profildagi qat'iy maosh, u bazada 0), balansdagi "to'lanmagan ish
haqi" ham 0. Natijada sof foyda ham ikki xil chiqdi — P&L da 628.33,
panelda 1 000.24.
**Yechim:** `payrollData.payrollCost(from, to)` — ish haqi uchun
YAGONA funksiya (KPI bo'yicha hisoblangani ustun, bo'lmasa qat'iy +
bonus). P&L, panel va balans shundan o'qiydi. Panel endi tushum va
yalpi foydani ham P&L dan oladi: kartochkalar bir qatorda turgani
uchun ular o'zaro ham qo'shilishi kerak
(yalpi foyda − xarajat = sof foyda).
**Qoida:** bir tushuncha — bitta funksiya. "Shu yerda boshqacharoq
kerak" degan joyda avval o'sha funksiyaga parametr qo'shing.

### Tekshiruv omborni ko'rmasdi (2026-08-14)
`productsData` bazadan `select: "*, stock(store_id, qty)"` bilan
o'qiydi — bu PostgREST'ning ichma-ich so'rovi. Tekshiruv skripti uni
SQL ga o'gira olmay `select *` qilardi, ya'ni `stock` kelmasdi va
"Ombordagi tovar" 0 chiqardi (haqiqatda **276 384.78 $**, 188 311 dona).
Ya'ni tekshiruv soxta "hammasi bo'sh" holatini ko'rsatardi.
**Yechim:** `scripts/lib/yuk.mjs` endi bola jadvalni alohida oladi va
ota qatorga biriktiradi; bog'lovchi ustun bazaning o'zidan (FK)
topiladi. Xuddi shu yo'l `sale_items`, `debt_payments`,
`service_items` uchun ham ishlaydi.

### "Pul oqimi" kassadan 47 000 $ farq qilardi (2026-08-14)
P&L bo'limidagi "Pul oqimi" tabi eski sotuv modulidan hisoblardi:
`sales` jadvalidagi chek bo'yicha naqd/karta/Payme ulushi. Billz
cheklari NSPOS'ga to'lov turi bilan tushmaydi, shuning uchun o'sha
ustunlar 0 edi va tabda faqat "qaytgan qarz puli" ko'rinardi:
**kirim 11 826.19**, Pul rejasi sahifasida esa o'sha davr uchun
**59 237.65**.
**Yechim:** `cashFlow()` endi kassa jurnalidan o'qiydi — jami
`moneyFlow()` dan, hamyon kesimi `walletSources()` dan. Natijada
"Turlar bo'yicha sof" qatori kassalardagi haqiqiy qoldiqqa teng
chiqadi (naqd 29 025.74 · Payme 5 731.90 · servis 2 830.81).
Qaytgan qarz puli alohida qator bo'lib turmaydi — u menejer yozgan
kunlik naqd ichida allaqachon bor.

### Usta puli ikki marta chiqib ketgan (2026-08-14)
KPI jadvalidagi "olgan" ustuni avtomat ravishda "Oylik" xarajatiga
aylanadi (`installerPayouts`). Menejer o'sha pulni Xarajatlar bo'limiga
QO'LDA ham kiritgan: 6 ta yozuv, 205.00 $ ikki marta chiqqan. Shu sabab
Namangan servis hamyoni minusga tushgan.
**Yechim:** `lib/audit.js` ga tekshiruv qo'shildi — bir xil usta, bir
xil kun, bir xil summa bo'lsa ogohlantiradi va to'g'ri yozuvga havola
beradi.

### "Yo'ldagi" pul soxta 100 $ farq chiqargan (2026-08-15)
Menejer 100 $ o'tkazma yubordi, rahbar hali tasdiqlamadi. Shu zahoti
`npm run tekshir` "Kassa: kartochka = kunlik jadval" xatosini berdi:
kartochkada −1 522.98, jadvalda −1 622.98, farq aynan 100.00.
**Sabab:** tekshiruv `total + pending` deb hisoblardi. Lekin
`kassaBalances` tasdiq kutayotgan pulni hamyondan AYIRMAYDI (rahbar
rad etsa qaytadi) — ya'ni u `total` ichida allaqachon bor. Kunlik
jadval ham `wait` ni qoldiqdan chegirmaydi. Ikkalasi bir xil edi,
faqat tekshiruv o'sha pulni ikki marta sanardi.
**Yechim:** `moslik.js` da `card = bal[k].total` — `pending` ustiga
qo'shilmaydi. Qoida: tasdiq kutayotgan pul QAYSI YERDA turgani bitta
javobga ega bo'lishi kerak (kassada), tekshiruv uni "yana bir joyda
ham bor" deb o'ylamasin.

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
- **Vercel "Not authorized":** `.vercel/project.json` dagi `orgId` eskirgan.
  Chiqarish buyrug'i: `npx vercel --prod --scope urinboevmirjalol-8358s-projects`.

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

- **`npm run tekshir`** (`scripts/tekshir.mjs`) — **saytga chiqarishdan
  oldin majburiy.** Ilovaning modullarini haqiqiy baza bilan to'ldirib,
  ekrandagi raqamni chiqaradigan AYNAN o'sha funksiyalarni chaqiradi va
  ikki xil savol beradi:
  1. **Sahifalararo moslik** (`lib/moslik.js`) — bir xil ma'nodagi raqam
     ikki sahifada teng chiqyaptimi: Pul rejasidagi kartochka = jadval,
     kassa kartochkasi = kunlik jadval, bosilgan raqam = ochilgan
     ro'yxat, balans = kassalar, ish haqi hamma joyda bitta, sof foyda
     P&L da ham panelda ham bir xil.
  2. **Ma'lumot xatosi** (`lib/audit.js`) — minusdagi hamyon, yopilmagan
     kun, ikkilangan chiqim, kurssiz xarajat, kassaga tushmagan kirim,
     usta puli ikki marta.

  Xato topilsa 1 qaytaradi. Aynan shu ro'yxat ilova ichida ham
  ko'rinadi ("Tekshirib ko'ring" kartochkasi), ya'ni rahbar va menejer
  xatoni men aytishimni kutmaydi.

  Yangi qoida qo'shish: `lib/moslik.js` (yoki `audit.js`) ichida bitta
  funksiya yozib, `CHECKS` ro'yxatiga bitta qator qo'shiladi — boshqa
  hech qayerga tegilmaydi.

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
