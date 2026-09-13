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
- Repo: https://github.com/urinboevmirjalol-commits/nspos — **yopiq (private)**
  repo, 2026-08-19 da yaratildi. Dasturchi `techjadid2-debug` shu kuni
  **write** huquqi bilan hamkor qilib chaqirildi. Kalitlar repoda YO'Q
  (`.env*` gitignore'da) — alohida beriladi, [TOPSHIRISH.md](TOPSHIRISH.md) ga qarang.
- Baza: Supabase (Postgres + RLS). Migratsiya: `node scripts/sql.mjs "..."`
- Kod: Next.js 14 App Router, JSX (TypeScript emas), Tailwind, Recharts
- Interfeys o'zbekcha (ruscha tarjima `lib/i18n.js` da)
- Do'konlar: NScamera Optim, NScamera Namangan, Sklad
- Hisob **2026-yil 1-avgustdan** boshlanadi. Undan oldingi pul harakati
  sanalmaydi (eski oylardagi tushum allaqachon sarflangan).

**Ma'lumot qayerdan keladi:** 2026-08-19 dan boshlab **Billz API orqali
avtomatik** (`lib/billzSync.js`, Sozlamalardagi tugma, kunlik cron).
Excel yuklash (`/data`) o'chirilmagan — tarixiy hisobotlar uchun qoladi.
Kunlik naqd/payme/savdo esa hozircha menejerlar qo'lda kiritadi — bu xato
manbai (5-bo'limga qarang).

> Eski holat (2026-08-19 gacha): "Billz API bermayapti" deb yozilgan edi.
> Endi kalit bor va tekshirilgan — 4-bo'limdagi "Billz API'ga o'tish"ga qarang.

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
| Cheklov vaqtincha ochilsa — qoida O'CHIRILMAYDI, oy ro'yxatiga qo'shiladi | Rahbar so'radi (2026-08-15): "shu oyga faqat" ustaning olgan puli istalgan kunga yozilsin. `PAY_DAYS` o'chirilmadi — `kpiData.PAY_ANY_DAY_MONTHS = ["2026-08"]` qo'shildi va `isPayDay(kun, oy)` shuni tekshiradi. Sentabrda jadval o'zi 1/5/10/15/20/25 ga qaytadi, hech kim eslatib o'tirmaydi. Jadval ustidagi izoh ham o'zgaradi: "shu oyga cheklov vaqtincha ochilgan". **Kun cheklovi (menejer faqat bugun/kechagi kunni tahrirlaydi) o'z joyida qoldi** — u boshqa qoida |
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

### Billz API'ga o'tish (2026-08-19)

Billz kaliti olindi va API ulandi. Uch narsa taxmin qilingan edi,
uchtasi ham noto'g'ri chiqdi — shuning uchun yozib qo'yiladi.

**1. Manzil `billz.uz` emas, `billz.io`.** `api.billz.uz` — bu BILLZ 1
(eski tizim, JSON-RPC). NScamera BILLZ 2 da: `https://api-admin.billz.io`
(`api-admin.billz.ai` ham shu joy). Ikkalasi bir-biriga bog'liq EMAS.
`POST /v1/auth/login` + `{"secret_token": ...}` → JWT, 15 kun yashaydi.

**2. Metod nomlari bir xil emas.** Taxmin qilib bo'lmaydi, sinab
ko'rilgan: tovar `/v2/products` (ko'plik), do'kon `/v1/shop` (birlik),
kategoriya `/v2/category`, brend `/v2/brand`, mijoz `/v1/client`,
sotuv `/v3/order-search` + `/v2/order/:id`.

**3. Kalit chiqarilishi huquq bermaydi.** Sotuvlar `403 access denied`
qaytardi, `/v3/order-search` esa 403 emas, **bo'sh ro'yxat** (`count: 0`)
qaytaradi — ya'ni "huquq yo'q" degani xato o'rniga "sotuv yo'q" bo'lib
ko'rinadi. Shuning uchun `probe()` bo'shlikni alohida belgilaydi.
Yechim BILLZ UI da: Integratsiya kalitlari → kalitga Rol → Продажи.

**Valyuta tuzog'i.** Bir tovarning `retail_currency` si do'konga qarab
USD yoki UZS bo'lib chiqadi, RAQAM esa bir xil (DS-KIS902-S → 260/260/260,
oxirgisi "UZS"). Yorliqqa ishonib kursga bo'linsa 260 $ tovar 0.02 $
bo'lardi. Qoida: **raqam dollar, yorliq o'qilmaydi**
(`lib/audit.js` → `billz-price-som` buni qo'riqlaydi).

**Tannarx tuzog'i.** Yuqoridagi `supply_price` DOIM 0. Haqiqiy raqam
`product_supplier_stock[].min_supply_price` da. Qoldig'i tugagan tovarda
esa u massiv bo'sh bo'lib qoladi va tannarx 0 chiqadi — shuning uchun
**nol hech qachon ustiga yozilmaydi** (`mergeProduct`). Aks holda o'sha
tovar bo'yicha butun tarixdagi foyda 100% bo'lib ko'rinardi.

**Nega cron kuniga bir marta.** Vercel Hobby tarifida `*/30 * * * *`
yozilsa **deploy xato beradi**. Kun davomida yangilanish ilova
ochilganda tortiladi (`components/BillzAutoSync.jsx`, 30 daqiqadan
eskirgan bo'lsa, faqat rahbar, oynalar orasida qulf bilan).

**Nega `--dry` mijozni o'rab qo'yadi.** Avval har bosqichga
`if (dry) return` qo'yilgan edi va birinchi sinovdayoq 4 ta kategoriya
bazaga yozilib ketdi. Endi `dryClient()` Supabase mijozining o'zini
o'raydi — yangi bosqich qo'shilganda "dry ni unutish" mumkin emas.

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

### Saytga chiqarildi — yangi manzil (2026-08-20)

`nspos.vercel.app` **boshqa Vercel hisobida** ekan: CLI `techjadid2-debug`
sifatida kirgan va o'sha hisobda nspos loyihasi yo'q. Shuning uchun yangi
loyiha ochildi — **https://nspos-psi.vercel.app**.

**Diqqat: ikki sayt, bitta baza.** Eski manzil hali ishlayotgan bo'lsa,
u eski kod bilan AYNAN SHU Supabase bazasiga yozadi va Mijozlar/Qarzlar
sahifalarini hamon Excel yuklamasidan o'qiydi. Chalkashmaslik uchun
bittasi tanlanishi kerak.

**Deploy tafsilotlari.** Vercel'ning "Deployment Protection"i yangi
loyihada yoqiq bo'ladi: `nspos-<hash>-...vercel.app` ko'rinishidagi
manzillar Vercel loginini so'raydi (302 → vercel.com/sso-api), lekin
DOIMIY ishlab chiqarish manzili (`nspos-psi.vercel.app`) ochiq. Ya'ni
foydalanuvchiga o'shani berish kerak, deploy chiqargan uzun havolani emas.

Env kalitlari (production + preview + development): `BILLZ_SECRET_TOKEN`,
`BILLZ_API_URL`, `CRON_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

Saytda sinaldi: ruxsatsiz `/api/billz/sync` → 401, sir bilan → tashxis
va inkremental sinxronizatsiya 30 soniyada (23 tovar, 3 mijoz).

---

### Cheklarni tortish: sakkizta tuzoq (2026-08-19)

Sotuvlar huquqi ochilgach 8 993 chek va 34 489 chek qatori tortildi
(173 soniya). Yo'lda sakkizta narsa taxmindan boshqacha chiqdi — har
biri XATO BERMASDAN, jimgina noto'g'ri raqam yozardi.

**1. `start_date`, `start` emas.** Hujjatning jadvalida `start` deb
yozilgan — u XATO. `start=2026-01-01` bilan javob 34 ta chek, aynan
o'sha oraliq `start_date` bilan 8 993 ta. Ya'ni noto'g'ri parametr xato
qaytarmaydi, faqat kam ma'lumot beradi.

**2. Chek ichidagi tovarlar RO'YXATNING O'ZIDA keladi.**
`/v3/order-search` javobida `order_detail.order_items` va
`order_payments` to'liq bor. Boshida har chek uchun alohida
`/v2/order/:id` chaqirilgan edi: 8 993 × 0.55 s = **82 daqiqa**.
Ro'yxatdan olinganda — **173 soniya**. 28 barobar tez.

**3. `deleted_at` — RAQAM 0, satr emas.** `String(0)` → "0", u esa
JavaScript'da rost. Oddiy `!!deleted_at` tekshiruvi birinchi sinovda
85 chekdan 85 tasini "o'chirilgan" deb tashlab yubordi.

**4. Mijoz id'si `order_detail.customer_id` da.**
`order_detail.customer` obyektida faqat ism va telefon bor, id YO'Q;
`order.customer_id` esa bo'sh satr. Buni bilmasak hamma chek mijozsiz
yoziladi va qarzdorlik hisoboti bo'sh chiqadi (85 tadan 85 tasi shunday
bo'ldi).

**5. `debt` — OBYEKT, raqam emas.** `{ amount, paid_amount, status }`.
800 chekdan 328 tasida shunday. `Number(obyekt)` → NaN → qarz jimgina
0 bo'lib ketardi.

**6. Qaytarishda `measurement_value` NOL.** Haqiqiy dona
`returned_measurement_value` da, narx va summa esa manfiy. Ishora bitta
joyda (miqdorda) bo'lishi kerak, narx doim musbat birlik narxi — aks
holda qty × price ijobiy chiqadi.

**7. ALMASHUV chekida ishora QATOR darajasida.** Almashuvda bir vaqtda
ham qaytarilgan, ham yangi tovar bor; chek summasi — ayirma. Butun
chekka bitta ishora qo'yilsa qatorlar 30 / 148 / 45.82, chek esa
18 / 16 / 4.18 bo'lib chiqdi.

**8. Yaxlitlash qator darajasida.** Avval yig'ib, keyin yaxlitlansa
9 032 chekdan 5 tasida bir-ikki tiyin farq chiqadi. Qatorlar AYNAN
`saleItemRows` dagidek yaxlitlanadi.

**Ikkilanishning oldi qanday olindi.** Bazada Excel'dan kelgan 7 779
chek bor edi. Bog'lanmasa API o'sha davrni qayta tortib, har chekni
ikki marta yozardi — tushum ham, foyda ham ikki barobar. Kalit uchta
bo'lakdan: **raqam + tur + summa**. Faqat raqam yetmaydi: Billz
qaytarish chekiga ASL chekning raqamini beradi, shuning uchun 7 779
qatorda atigi 6 855 noyob raqam bor. Natija: 7 740 tasi bog'landi,
39 tasi Billz'da topilmadi (o'chirilgan yoki tahrirlangan) va ular
qatorsiz qoldi — bu 0.4%, ataylab tegilmadi.

**Katalogda yo'q tovar.** Eski chekda Billz'dan o'chirilgan tovar
uchraydi, `/v2/products` esa uni bermaydi. Qator tashlab yuborilsa chek
summasi qatorlar yig'indisiga teng bo'lmay qoladi (2 chekda 186 $
yo'qolgan edi). Yechim: chek qatoridagi `product` obyektidan
(id, nom, shtrix-kod) kartochka yaratiladi, `is_active = false` —
katalogda ko'rinmaydi, tarixdagi foyda to'g'ri hisoblanadi.

**Natija:** 9 032 chek · 34 489 qator · 1 066 092 $ savdo ·
349 191 $ yalpi foyda · oxirgi chek bugungi kun.

---

### Qarz to'lovlari ko'rinmasdi — o'qish huquqi (2026-08-21)

Balansdagi "Mijozlardan olinadigan qarz" haqiqiydan **16 931.79 $ katta**
turgan edi. Sabab hisobda emas, HUQUQDA: `debt_payments` jadvalida RLS
yoqilgan, lekin faqat `debt_pay` (INSERT) siyosati bor edi — SELECT yo'q.

Ya'ni bazada **16 000 ta to'lov yozuvi** (jami 1 613 523 $) turgan holda
brauzer ularning BITTASINI ham ololmasdi. `lib/debtsData.js` qarzni
`select "*, debt_payments(...)"` bilan o'qiydi, massiv esa doim bo'sh
kelardi — demak har qarz "to'liq ochiq" bo'lib ko'rinardi.

**Nima uchun sezilmagan:** xato chiqmaydi. PostgREST ruxsat yo'q deb
xato bermaydi, shunchaki bo'sh massiv qaytaradi. Bu Billz'ning
`/v3/order-search` tuzog'i bilan bir xil naqsh: "huquq yo'q" degani
"ma'lumot yo'q" bo'lib ko'rinadi.

Tuzatilgach (`scripts/sql/debt-payments-read.sql`), Billz qarzlari
bo'yicha ochiq summa 67 862.11 → **50 930.32** bo'ldi (362 ta qarz).

**Tekshiruvning ko'r nuqtasi.** Yangi `moslik.js` qoidasi qo'shildi —
"Qarz: to'langan summa = to'lov yozuvlari". Lekin u terminalda bu
xatoni TUTA OLMAYDI: `scripts/lib/yuk.mjs` qatorlarni SQL orqali
o'qiydi, ya'ni RLS chetlab o'tiladi va terminalda hamma to'lov
ko'rinadi. Huquq muammosi faqat ILOVA ICHIDA bilinadi.

> **Qoida:** `npm run tekshir` "toza" degani "brauzerda ham toza"
> degani EMAS. Tekshiruv hisob xatosini tutadi, huquq xatosini
> tutmaydi. Yangi jadval qo'shilganda RLS siyosati ALOHIDA
> tekshiriladi — buni SQL bilan qilish mumkin, brauzer shart emas:
>
> ```sql
> begin;
>   select set_config('request.jwt.claims',
>     json_build_object('sub', (select id from profiles where role='owner' limit 1),
>                       'role', 'authenticated')::text, true);
>   set local role authenticated;
>   select count(*) from <jadval>;
> rollback;
> ```

**Shu naqsh bo'yicha qolgan bo'shliqlar** (hali tekshirilmagan):
`customers`, `debts`, `usd_rates` da yozish siyosati yo'q, brauzer esa
yozadi — yozuv jimgina rad etilishi mumkin.

---

### Excel yuklamasi bazadan USTUN turadi (2026-08-19 da aniqlandi)

To'rt modulda bir xil qator bor:

```js
// lib/customersData.js:133
export const listCustomers = () => {
  const up = uploadedCustomers();
  return up.ready ? [...up.rows] : [...customers];   // ← yuklama g'olib
};
```

`customersData`, `debtsData`, `managementData`, `pnlData` — hammasi
shunday. Ya'ni `/data` ga bir marta Excel tashlansa, o'sha modul
**bazani umuman o'qimay qo'yadi**.

Nega muhim: Billz API'dan 9 084 mijoz bazaga tushdi, lekin `/clients`
sahifasi hamon 05.08.2026 dagi Excel'ning 6 997 qatorini ko'rsatib turdi.
Baza to'g'ri, ekran eski — va bu hech qanday xato bermaydi.

Tovar, qoldiq va cheklar bunday emas (`productsData`, `salesData`
to'g'ridan-to'g'ri bazadan o'qiydi) — shuning uchun 652 tovar va yangi
qoldiq ekranda darrov ko'rindi.

**Nega darrov almashtirilmadi:** Excel mijoz uchun bazada yo'q to'rtta
ustun beradi — `Продажи (всего)`, `Кол-во купленных товаров`,
`Возвращающийся клиент` va jami xarid summasi. Ularni cheklardan
hisoblash mumkin, lekin buning uchun `sale_items` kerak, u esa Billz
huquqi ochilmaguncha bo'sh. Hozir almashtirilsa mijozlar sahifasidagi
statistika nolga tushib qolardi.

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
- [x] ~~Tezlik: ilova ochilganda hamma jadvalni yuklamasin~~ — cheklar
      ikki to'lqinda, kuzatuv 30+ so'rovdan bittaga tushdi, sahifalar
      barobar olinadi (26-bo'lim). **Saytda o'lchanmagan** — migratsiya
      (`scripts/sql/jadval-yangilanish.sql`) va chiqarish qoldi.
- [ ] Jonli yangilanish o'zgargan qatorni XOTIRAGA ham olsin
      (`updated_at` bo'yicha inkremental) — hozir faqat ekran qayta
      chiziladi, shuning uchun "Yangilash" sahifani qayta yuklaydi
      (26.5).
- [ ] "Ustunlar" sozlamasi qolgan hisobotlarga (Hisobdan chiqarishlar,
      Ombor qiymati, Import partiyalari). Tayyor: Ombor qoplamasi,
      Buyurtma taklifi, Servis foydasi, ABC tahlil.
      Qarzdorlar ataylab tegilmagan — undagi ustunlar foydalanuvchining
      o'z 15/20/30 kunlik guruhlari.
- [x] ~~Billz'ga qo'ng'iroq: API narxi~~ — kalit olindi, API ulandi
      (2026-08-19). Qolgani: kalitga **sotuvlar huquqi** berilishi
      (BILLZ UI → Integratsiya kalitlari → Rol). Ungacha `sale_items`
      bo'sh, ya'ni tovar kesimidagi foyda hisoblanmaydi.
- [x] ~~Sotuv huquqi ochilgach cheklarni tortish~~ — bajarildi
      (2026-08-19): 8 993 chek, 34 489 qator, 173 soniya.
- [ ] **Undan KEYIN** mijozlarni Excel'dan bazaga o'tkazish
      (`lib/customersData.js:133` dagi `up.ready ?` olib tashlanadi).
      Shart: xarid statistikasi (`billzPurchases`, `salesCount`,
      `itemsBought`, `returning`) cheklardan hisoblanadigan bo'lsin —
      aks holda `/clients` sahifasidagi ustunlar nolga tushadi.
      Foydalanuvchi qarori (2026-08-19): huquq ochilgunicha TEGILMAYDI.
- [ ] Saytga chiqarish kutib turibdi (2026-08-19 qarori): hammasi
      to'liq ishlaganidan keyin bir yo'la. Vercel'ga qo'shiladigan
      kalitlar: `BILLZ_SECRET_TOKEN`, `CRON_SECRET`.
- [x] ~~Papka git repo emas~~ — `git init` qilindi, boshlang'ich kommit bor.
- [x] ~~GitHub'ga ulash~~ — ulandi. 2026-08-23 da remote SSH'ga
      o'tkazildi: ilgari `.git/config` da HTTPS manzil ichida shaxsiy
      token OCHIQ MATNDA turgan edi (12.1-bo'lim).
- [x] ~~Eski `nspos.vercel.app` bilan nima qilish~~ — qaror
      (2026-08-23): avval eskidagi ma'lumot olinadi, keyin ikkala
      Vercel loyihasi ham yopiladi, Supabase esa dump olinib pauza
      qilinadi. Tafsiloti 12-bo'limda.
- [ ] Zaxira: `12-zaxira-tashqi.sh` SERVERDA ishga tushirilishi kerak.
      Ungacha tashqi (Telegram/Drive) zaxira YO'Q — uni ilgari faqat
      Vercel Cron chaqirardi.
- [ ] Mijozlar ro'yxatida 4 183 ta dublikat bor (Excel importidan qolgan).
      **O'chirilmaydi** — foydalanuvchi qarori. Kerak bo'lsa ro'yxatda
      birlashtirib ko'rsatiladi, bazada ikkalasi ham qoladi.
- [ ] `nspos-bot` xizmati SERVERDA YO'Q (`scripts/server/11-bot.sh`
      ishga tushirilmagan) — CLAUDE.md "bor" deb yozgan edi (16-bo'lim).
- [ ] `scripts/list-logins.mjs` Supabase Admin API'ga qaraydi — VPS'da
      ishlamaydi; `sql.mjs` orqali qayta yoziladi.
- [ ] `auth.kirish()` ga `is_active` sharti; `/api/kirish` ga urinish
      cheklovi (nginx `limit_req`).
- [ ] Eski Supabase/Vercel'ni YOPISH (12.4 ning 4–5 qadami) — 02.09 da
      faqat muzlatiladi (`eski-muzlat.mjs`); yopish alohida kunda,
      uch joyga arxiv dump'dan keyin.

---

## 8. Muloqot uslubi

- **Ish topshirish (2026-09-13 dan):** deployni asosiy dasturchi qiladi.
  Men kod yozaman → kommit → push (`claude/…` branchiga) → Gmail orqali
  `techjadid2@gmail.com` ga xabar + nusxasi Drive'dagi "NSPOS —
  o'zgarishlar" papkasiga. Sabab: bu muhitdan serverga SSH ham,
  `tizim.enes.uz` ga chiqish ham yopiq (o'lchandi, 12–13.09), ya'ni
  "ish oxirigacha o'zim bajaraman" qoidasi endi CHIQARISHDA to'xtaydi.
  Xabarda migratsiya qadami ALOHIDA aytiladi — u chiqarishdan oldin.
- Javob **qisqa** — bir necha qator. Uzun xususiyat tavsiflari yozilmaydi.
- Ish oxirigacha o'zim bajaraman: migratsiya, tekshiruv, saytga chiqarish.
  Foydalanuvchiga faqat jismonan qila olmaydigan qadam qoldiriladi.
- Har o'zgarishdan keyin saytga chiqariladi — u lokal serverda emas,
  saytda ishlaydi.
- Xato qilsam — bahona emas, sababini aytaman va tuzataman.

---

## 9. 2026-08-22 — VPS'dagi birinchi kun: nima buzilgan edi

Sayt VPS'ga ko'chirilgandan keyin **brauzerda umuman ochilmasdi**, lekin
buni hech bir tekshiruv ko'rmadi. Kunning asosiy saboqlari.

### 9.1. `curl` 200 hech narsani isbotlamaydi

`components/AuthProvider.jsx` da `sessiyaOl()` chaqirilardi, import esa
yo'q edi. AuthProvider ildiz layoutida — butun sayt o'lgan edi
("ReferenceError: sessiyaOl is not defined").

O'tib ketgan tekshiruvlar: `next build`, `node --check`,
`npm run tekshir`, `curl` 200. Next.js HTML **qobiqni** beradi, ishdan
chiqish esa brauzerda — hidratsiyada.

**Qoida:** sayt HAQIQIY brauzerda ochilishi tekshiriladi.
`scripts/server/brauzer-kirgan.mjs` (kirgan holatda, 22 sahifa).

### 9.2. Tekshiruvning o'zi yolg'on o'tishi mumkin

Birinchi brauzer skriptida `timeout 60 chrome …` yozilgandi. macOS'da
`timeout` YO'Q — Chrome ishga tushmagan, jurnal bo'sh, 14 sahifa "toza".

**Qoida:** tekshiruv "xato topilmadi" ga emas, **"ish bajarildi"** ga
asoslansin. Endi har sahifadan skrinshot olinadi va u kamida 12 KB
bo'lishi shart.

### 9.3. `catch {}` — eng qimmat qator

`lib/db.js` da jonli yangilanish so'rovi `catch {}` bilan o'ralgandi
("tarmoq uzilsa jim o'tamiz"). 39 jadvaldan 33 tasida `updated_at`
ustuni yo'q edi va PostgREST har 20 soniyada 400 qaytarardi. Jonli
yangilanish HECH QACHON ishlamagan, hech kim bilmagan.

**Qoida:** xato yutilmaydi. Ketma-ket uchta xatodan keyin rahbarga
aytiladi.

### 9.4. `information_schema` jadval egasiga bog'liq

REST API serverda tushumni 17 188 deb ko'rsatdi (aslida 76 723).
`yuk.mjs` tashqi kalitni `information_schema.constraint_column_usage`
dan o'qirdi — u faqat jadval EGASIGA ko'rinadi. API `nspos` roli bilan
ulanadi va ko'rinish bo'sh qaytardi: 9 032 chekning birortasida tovar
tarkibi yo'q.

**Qoida:** sxema `pg_catalog` dan o'qiladi. Bo'sh ichma-ich natija
XATO deb to'xtatiladi ("N qatorning birortasida ham yo'q").

### 9.5. Almashtirish chekida ishora yo'qoladi

Billz `exchange` chekida `total` ga farqning ABSOLYUT qiymatini yozadi.
Do'kon 4.18 $ qaytargan — u 4.18 $ tushum bo'lib yozilgan, xato ikki
barobar. 79 chek, tushum 3 127.24 $ ortiq edi.

`subtotal` to'g'ri ishorada va chek qatorlari yig'indisiga aynan teng.
Endi ishora o'shandan olinadi (`lib/salesData.js`, `ishorali`).
Bazadagi qator o'zgartirilmaydi.

### 9.6. Bo'sh raqam — ishonarli yolg'on

Og'ir jadvallar ~25 soniya yuklanadi. Shu davrda bosh sahifa ishonch
bilan "0.00 USD" ko'rsatardi. Rahbar "savdo yo'q" deb o'ylaydi.

**Qoida:** ma'lumot kelmaguncha raqam O'RNIGA joy egallagich turadi
(`useToliq()`).

### 9.7. Tezlik: 26.9 → 9.3 soniya

- Sahifa o'lchami 1000 → 5000 qator. Server Yevropada, foydalanuvchi
  O'zbekistonda: har so'rov ~250 ms, 40 dan ortiq borib-kelish bor edi.
- Nginx'da `gzip on;` yozilgan, lekin `gzip_types` va `gzip_proxied`
  izohda — JSON umuman siqilmasdi.

### 9.8. Serverdagi sozlama unutildi

`/api/billz/sync` har chaqiriqda 500 qaytarardi: serverda
`BILLZ_SECRET_TOKEN`, `CRON_SECRET` va service kaliti yo'q edi. Ya'ni
ko'chishdan beri Billz'dan yangi ma'lumot tortilmagan.

Endi har 30 daqiqada (`scripts/server/06-billz-cron.sh`). PostgREST
`authenticator` sifatida ulanadi va JWT dagi rolga O'TADI — o'tish
uchun o'sha rolning a'zosi bo'lishi shart edi.

---

## 10. 2026-08-22 (kechqurun) — domen va yashiringan sotuv yo'qotishi

### 10.1. HTTPS'siz kirish ISHLAMAYDI

`app/api/kirish/route.js` cookie'ga `Secure` qo'yadi
(`NODE_ENV=production`). Brauzer `http://` da bunday cookie'ni
saqlamaydi — jimgina tashlaydi. Parol to'g'ri bo'lsa ham sahifa
`/login` ga qaytaraveradi.

Bu uzoq bilinmadi, chunki tekshiruvlarda cookie brauzerga
to'g'ridan-to'g'ri qo'yilardi (DevTools protokoli) — kirish
formasining o'zi hech qachon sinalmagan.

**Qoida:** yangi muhitda kirish FORMASI sinaladi, tokenni qo'lda
qo'yish bilan emas.

### 10.2. Manzil: `tizim.enes.uz`

`enes.uz` kompaniya sayti uchun (aHOST xostingi, 185.196.212.52).
NSPOS quyi domenda. `@`, `www`, MX, SPF, DKIM ga tegilmaydi.

Cloudflare olinmadi: ichki tizim uchun uning foydasi (DDoS, CDN)
ishlamaydi — og'ir narsa baza so'rovlari, ular keshlanmaydi.

Certbot avtomatik yangilashi `--dry-run` bilan SINALDI. Bu qadam
tashlab ketilmaydi: sertifikat 90 kunda tugaydi.

### 10.3. Billz `end_date` siz faqat BIR KUNNI qaytaradi

Eng qimmat topilma. O'lchov:

```
start_date=2026-08-19              →  34 ta (faqat 19.08)
start_date=2026-08-19 + end_date   → 135 ta (22.08 gacha)
```

Sinxronizatsiya har 30 daqiqada o'sha 34 ta chekni qayta tortardi,
kursor 19.08 da qotgandi, 101 ta chek (9 061.63 $) bazaga umuman
tushmagandi. Xato ko'rinmadi: so'rov muvaffaqiyatli, jurnal "OK".

`start_date` ham berilmasa Billz BO'SH qaytaradi — ya'ni "hammasini
ber" degan ma'no yo'q. Endi ikkala sana ham doim yuboriladi.

### 10.4. Yolg'on jurnal haqiqiy nosozlikni yashirdi

`stat.inserted += rows.length` — upsert'ga ketgan hamma qator
"qo'shildi" deb sanalardi. Jurnal har 30 daqiqada "34 ta chek
qo'shildi" deb yozardi, bazada esa yangi qator yo'q edi.

**Qoida:** jurnal ORTIQCHA aytmasin. Ishonchsiz jurnal — jurnal
yo'qligidan yomonroq: u nosozlikni yashiradi.

### 10.5. Yangi tekshiruv: sotuv eskirgani

`lib/audit.js` → "Sotuv ma'lumoti N kundan beri yangilanmagan".
Bu turdagi nosozlikni xato xabari tuta olmaydi (so'rov
muvaffaqiyatli, ma'lumot kam). Uni faqat "eng yangi chek qachon
edi?" degan savol tutadi. 2 kunda ogohlantirish, 4 kunda xato.

---

## 11. 2026-08-23 — ikki marta yozilgan chek va noto'g'ri baza

### 11.1. "Tovar tarkibi yo'q" — aslida dublikat edi

Ogohlantirish oyiga yaqin turdi: *"39 ta chekda tovar tarkibi yo'q —
17 052.90 $"*. Uning ostidagi maslahat ham noto'g'ri edi: "Billz'dan
qayta torting".

Tekshirilganda chiqdi: o'sha 39 chekning **`billz_id` si yo'q**. Ular
Billz'dan emas, Excel importidan qolgan. Va har birining **aynan bitta
Billz jufti bor** — bir xil raqam, bir xil tur, tarkibi joyida:

```
000500084216 → Excel 1030.53 · Billz 1030.54  (12 qator)
000301099246 → Excel  395.93 · Billz  395.94  (16 qator)
000302044266 → Excel 6650.12 · Billz 6650.12  ( 5 qator)
```

Ya'ni Billz'dan tortish hech narsa bermasdi — chek allaqachon bazada,
ikkinchi nusxa bo'lib. 17 052.88 $ ikki marta sanalgan (fevral–iyul,
shuning uchun moliyaga tegmagan: hisob 01.08 dan).

**Sabab:** `linkSales()` eski qatorni Billz chekiga `raqam|tur|summa`
kaliti bilan bog'laydi va summa AYNAN mos kelishini talab qilardi.
Billz yaxlitlashi bir tiyinga farq qiladi — 7 779 chekdan 7 740 tasi
bog'landi, 39 tasi qoldi.

**Yechim (uch qism):**
1. `sales.superseded_by` ustuni — dublikat qator O'CHIRILMAYDI, faqat
   "meni kim almashtirdi" havolasini oladi (`scripts/sql/sales-superseded.sql`,
   39 qator yangilandi). Xuddi `debts.source='excel'` dagidek yondashuv.
2. `lib/salesData.js` → `set()` da almashtirilgan chek xotiraga umuman
   kiritilmaydi. Bitta joyda to'silsa yetadi: `salesInRange`, P&L, ABC —
   hammasi to'g'ridan-to'g'ri `sales` massividan o'qiydi.
3. `linkSales()` da summa endi kalitda emas, TEKSHIRUV: juftlik
   `raqam|tur` bo'yicha topiladi, keyin farq 0.02 dan oshmasligi
   ko'riladi. Yaxlitlash o'tadi, boshqa chek o'tmaydi.

**Yangi tekshiruv** `lib/audit.js` → `billz-unlinked-duplicate`. Belgisi:
`billzId` bo'sh chek, lekin bazada aynan o'sha raqam va turdagi boshqa
chek bor. Faqat raqam takrorlanishi YETARLI EMAS — Billz qaytarish
chekiga asl chekning raqamini beradi va bir chekka ikki marta qaytarish
bo'lishi mumkin (000800069246, 06 va 07-avgust — ikkalasi ham haqiqiy).

**Sabog'i:** ogohlantirish matnidagi maslahat ham xato bo'lishi mumkin.
"Tovar tarkibi yo'q" degani "Billz bermadi" degani emas edi.

### 11.2. Tekshiruv ESKI bazani o'qib turgan

Eng qimmat topilma. `npm run tekshir` — saytga chiqarishdan oldingi
majburiy darvoza — kompyuterda **eski Supabase nusxasini** o'qirdi.
`.env.local` da VPS'ga ko'chishdan oldingi manzil qolib ketgan.

Ikki baza butunlay boshqa raqam beradi:

| | eski Supabase | VPS (haqiqiy) |
|---|---|---|
| Kurs | 11 900 | 11 880 |
| Kirim | 93 460.03 $ | 82 308.87 $ |
| Kassada | 58 277.43 $ | 47 344.28 $ |
| Optim kassasi | 15 815.82 $ | 7 730.69 $ |
| Vaqt | 332.1 s | 5.5 s |

Ya'ni ko'chishdan beri har "✓ hammasi joyida" muzlab qolgan nusxa
haqidagi gap edi. Bitta ishora bor edi va u ISHLADI — "Sotuv ma'lumoti
4 kundan beri yangilanmagan" (10.5-bo'limda qo'shilgan tekshiruv).
Lekin uni tushunish uchun qaysi baza o'qilgani bilinishi kerak edi,
u esa hech qayerda yozilmasdi.

**Qoida:** tekshiruv QAYSI bazani o'qiganini har safar aytadi.
`scripts/lib/yuk.mjs` → `manbaNomi()`, bosh qatorda:

```
Manba: Postgres: mahalliy soket
Hisob boshi: 2026-08-01 · kurs 11 880 so'm
```

**Serverda tekshirish** (haqiqiy baza shu yerda):

```bash
ssh -i ~/.ssh/nspos root@169.58.216.246 \
  "cd /opt/nspos/app && sudo -u nspos env NSPOS_PG=\$(grep '^NSPOS_PG=' /opt/nspos/api.env | cut -d= -f2-) npm run tekshir"
```

`sudo -u nspos` SHART: `NSPOS_PG` mahalliy soketga boradi va Postgres
peer autentifikatsiyasi foydalanuvchi nomiga qaraydi. `root` bilan
ishga tushirilsa "Baza to'liq o'qilmadi" deb to'xtaydi.

---

## 12. 2026-08-23 — Vercel/Supabase'dan butunlay chiqish va Telegram boti

VPS ishlab turibdi, lekin eski tizim ham tirik edi. Shu bo'lim eskisini
YOPISH tartibini va yo'l-yo'lakay topilgan uchta teshikni yozadi.

### 12.1. GitHub tokeni ochiq matnda turgan

`.git/config` dagi `origin` manzili shunday edi:

```
https://x-access-token:ghp_…@github.com/urinboevmirjalol-commits/nspos.git
```

Ya'ni shaxsiy token papkani o'qiy olgan HAR KIMGA ko'rinardi — zaxira
nusxaga ham, ekran ulashuvga ham tushardi. Token repo fayllarida yoki
kommit tarixida YO'Q edi (grep bilan tekshirildi), faqat shu yerda.

Tuzatildi: token bekor qilinadi (foydalanuvchi GitHub'da), manzil esa
SSH'ga o'tkazildi:

```bash
git remote set-url origin git@github.com:urinboevmirjalol-commits/nspos.git
```

`~/.ssh/id_ed25519` kaliti allaqachon shu repoga ruxsatli edi
(`git ls-remote` bilan tekshirildi). Serverga bu ta'sir qilmaydi:
`chiqar.sh` `.git` ni umuman yubormaydi.

**Qoida:** GitHub manzili HTTPS+token bo'lib qolmasin. Token vaqtinchalik
kerak bo'lsa `git credential` orqali, `.git/config` ga yozib emas.

### 12.2. Tashqi zaxira jimgina to'xtash arafasida edi

Ikki xil zaxira bor va ular BOSHQA-BOSHQA narsa:

| Nima | Qayerda | Kim chaqiradi |
|---|---|---|
| `pg_dump` | serverning O'ZIDA (`/opt/nspos/zaxira`) | `05-zaxira.sh`, cron 03:00 |
| `/api/backup` | Telegram + Google Drive (TASHQARIGA) | **faqat Vercel Cron edi** |

Vercel o'chirilsa ikkinchisi to'xtardi va buni HECH NARSA bildirmasdi:
zaxira "bor" bo'lib qolaverardi, faqat hammasi bitta diskda. Server
yonsa yoki yo'qolsa — hammasi bilan ketardi.

Yechim: `scripts/server/12-zaxira-tashqi.sh` — cron 03:15 da
`/api/backup` ni chaqiradi (mahalliy `pg_dump` tugagandan keyin, Billz
sinxroni oralig'ida). Skript o'rnatilgan zahoti BIR MARTA sinab
ko'radi — xato ertasi kechasi emas, hoziroq bilinsin.

### 12.3. Valyuta qo'riqchisi cheklarni ko'rmasdi

`lib/audit.js` dagi `billz-price-som` Billz raqami so'mga aylanib
qolganini ushlaydi. Lekin u faqat KATALOG narxini qaraydi
(`products.sale_price`). Ekrandagi tushum esa katalogdan emas, CHEK
QATORLARIDAN yig'iladi. Ya'ni Billz valyuta qoidasini o'zgartirsa,
katalog toza turgani holda tushum va P&L ~12 000 barobar oshib ketardi
va hech qayerda ushlanmasdi.

Qo'shildi: `savdo-narx-som` — `sale_items.price` va `cost_price` ni
tekshiradi. Chegara CHEK JAMISIGA emas, DONA NARXIGA qo'yilgan.

**O'lchandi** (9 032 chek · 34 489 qator):

| nima | qiymat |
|---|---|
| eng qimmat dona narxi | 1 100 |
| eng qimmat dona tannarxi | 400 |
| eng qimmat katalog narxi | 700 |
| eng katta chek jamisi | 6 650.12 |
| eng arzon so'm narxi | ~11 880 |

Chegara 5 000 — haqiqiy narxdan 4.5 barobar yuqori, eng arzon so'm
narxidan 2.4 barobar past. Ikki oraliq kesishmaydi, ya'ni yolg'on
trevoga bo'lishi mumkin emas.

Chek jamisiga 5 000 qo'yib bo'lmaydi: 6 650.12 lik HAQIQIY chek bor.
Tarkibi yo'q 39 ta chek uchun alohida, keng chegara — 50 000.

**Qoida:** ma'lumot xatosini ushlaydigan tekshiruv qo'yilganda, u
raqam EKRANGA QAYSI YO'L bilan chiqishini kuzatib qo'yilsin. Katalogni
qo'riqlash yetarli emas edi, chunki pul boshqa jadvaldan kelardi.

### 12.4. Eskisini yopish tartibi (tartib MUHIM)

1. **Muzlatish.** Eski Supabase'da JWT secret yangilanadi. Bitta amal
   bilan ikkala Vercel sayti ham o'ladi (anon va service_role kalitlar
   bekor bo'ladi) — eski Vercel hisobiga kirish shart emas. Bizning
   o'qish yo'limiz tegilmaydi: `yuk.mjs` Management API bilan,
   `pg_dump` esa to'g'ridan-to'g'ri ulanish satri bilan boradi.
2. **Solishtirish.** `node scripts/solishtir.mjs --target "…"` — ikki
   bazaning BIRLAMCHI KALITLARINI solishtiradi va uch xil farqni
   ajratadi: `faqat_eski` (ko'chiriladi), `faqat_vps` (normal, Billz
   sinxroni), `ozgargan` (ikkalasida bor, eskisi yangiroq — qo'lda).
   Yonida eski `audit_log` xulosasi chiqadi: kalit solishtiruvi faqat
   QO'SHILGAN qatorni ko'radi, tahrirlangan va o'chirilganini esa
   ko'rmaydi — audit jurnali ko'rsatadi.
3. **Ko'chirish.** `kochirish.mjs --only=<ro'yxat>` — `on conflict do
   nothing`, ya'ni FAQAT QO'SHADI. Oldin serverda `pg_dump` olinadi.
4. **Yakuniy nusxa.** `pg_dump -Fc` → uch joyga (Mac, Telegram, Drive).
   PAUZADAN OLDIN: pauza ulanishlarni butunlay yopadi.
5. **Yopish.** Supabase pauza, Vercel loyihalari o'chiriladi.

**Nega muzlatish birinchi:** qimirlab turgan bazani solishtirib bo'lmaydi.
Solishtirish bilan ko'chirish orasida xodim eski saytga bitta yozuv
kiritsa, u yozuv butunlay yo'qolardi.

**Nega Supabase o'chirilmaydi, pauza qilinadi:** qaytish yo'li ochiq
qolsin. Lekin ASL ARXIV — 4-qadamdagi dump, pauzadagi loyiha emas:
bepul tarifda uzoq turgan loyihani Supabase o'zi o'chirib yuborishi
mumkin.

### 12.5. Telegram boti — rahbar uchun o'qish oynasi

Rahbar telefondan `/xulosa`, `/savdo bugun`, `/kassa`, `/qarz` deb
so'raydi. Kod: `scripts/bot/`, o'rnatish: `11-bot.sh`.

Uchta qaror va sabablari:

- **Long-polling, webhook emas.** Webhook uchun tashqaridan kiradigan
  yo'l ochish kerak. Long-polling'da bog'lanishni bot O'ZI boshlaydi —
  nginx'ga bitta ham yangi yo'l qo'shilmaydi.
- **Bot bazaga ULANMAYDI.** U faqat `127.0.0.1:3002` (nspos-api) ga GET
  qiladi. Himoya uch qavat: API faqat GET qabul qiladi · API roli
  faqat SELECT · botda baza paroli umuman yo'q.
- **Formula yozilmaydi.** `format.mjs` faqat API bergan raqamni matnga
  o'giradi. Bir dona qo'shish ham yozilmaydi — aks holda Telegram'dagi
  raqam bir kun saytdagidan farq qilib qolardi.

Ishga tushganda turib qolgan xabarlar TASHLANADI (`getUpdates` offseti
oldinga suriladi): Telegram javobsiz xabarni 24 soat saqlaydi va busiz
server bir kun o'chib tursa, yoqilgan zahoti bot kechagi savollarga
birdaniga javob yozib tashlardi.

Ruxsat — chat raqamlari ro'yxati (`TELEGRAM_RUXSAT`). Sabab: API tokeni
rahbarning O'QISH huquqi, u bilan butun moliya ko'rinadi. Begona chatga
javob BIR MARTA yoziladi — har xabarga javob qaytarilsa bot begona odam
bilan cheksiz yozishib ketardi.

Keyingi bosqich (ixtiyoriy): buyruq bo'lmagan matnni Claude API'ga
berish, tool'lar sifatida o'sha 8 ta GET yo'lini ko'rsatish. Buyruqlar
o'z holicha qoladi — LLM yiqilsa ham bot ishlayveradi.

### 12.6. Toza chiqarish oxirida osilib qolardi (topildi 2026-08-23)

Birinchi chiqarish `chiqar.sh` ning 5-qadamida 40 daqiqa turib qoldi.
Tashqaridan "chiqarish yiqildi" bo'lib ko'rinardi. Aslida hamma ish
ALLAQACHON tugagan edi: rsync o'tgan, `next build` bo'lgan, `nspos`
qayta ishga tushgan, 9 ta sahifa 200 qaytargan, CSS 42 905 bayt,
brauzerda 2 + 22 sahifa toza. Faqat jarayon CHIQMAGAN.

Sabab `brauzer-kirgan.mjs` da:

```
process.on("exit", tozala);          // Chrome'ni o'ldiradi
…
if (xato) { …; process.exit(1); }    // xato yo'li — MAJBURAN chiqadi
console.log("… toza");               // toza yo'l — shu yerda tugaydi
```

Chrome `spawn` bilan ochilgan va tirik turgani uchun Node hodisa
halqasi yopilmaydi. Uni o'ldiradigan `tozala()` esa `exit` hodisasiga
bog'langan: chiqish uchun Chrome o'lishi kerak, Chrome o'lishi uchun
esa chiqish kerak.

Ya'ni xato bo'lganda skript CHIQADI, toza bo'lganda OSILIB QOLADI —
teskarisi. Shuning uchun buzuq chiqarishda bilinmagan, aynan
muvaffaqiyatli chiqarishda chiqqan.

Tuzatildi ikki joyda:
- oxirida ochiq `process.exit(0)`
- `yubor()` ga 60 soniyalik muddat — javobsiz CDP buyrug'i ham
  butun chiqarishni osib qo'ymasin

Sinaldi: 3 sahifa · 21.8 soniya · Chrome qoldig'i yo'q.

**Qoida:** tashqi jarayon (`spawn`) ochadigan skript oxirida ALBATTA
`process.exit()` bo'lsin. "Ish tugadi" bilan "jarayon tugadi" bir
narsa emas — va farqi faqat hammasi joyida bo'lganda ko'rinadi.

---

## 13. 2026-08-24 — "19-dan beri data yo'q": bir savol, oltita nosozlik

Rahbar ekran suratini yubordi: sanalar bor, raqamlar yo'q. Savol
oddiy edi — "u qayerdan olinishi kerak edi, nimaga yo'q?". Javob
bitta emas, OLTITA alohida sabab bo'lib chiqdi va ularning hech
biri xato bermasdi.

### 13.1. Nima ishlab turgan, nima to'xtagan

Birinchi qadam — taxmin qilmasdan o'lchash. Bazadagi HAR jadval
bo'yicha "oxirgi sana" so'raldi:

| Manba | Oxirgi | Holat |
|---|---|---|
| Sotuv, chek, qarz, to'lov, tovar, qoldiq, mijoz | 23–24 avg | Billz API, har 30 daq — **sog'lom** |
| Xarajat (`expenses`) | **20 avg** | qo'lda kiritiladi — to'xtagan |
| Kassa (`kassa_ops`) | **20 avg** | qo'lda kiritiladi — to'xtagan |
| KPI kunligi (`kpi_day`) | **20 avg** | qo'lda kiritiladi — to'xtagan |
| Dollar kursi (`usd_rates`) | **20 avg** | qo'lda kiritiladi — to'xtagan |
| Excel yuklamalari | **5–16 avg** | qo'lda yuklanadi — eskirgan |

Kunma-kun kesim yanada aniq ko'rsatdi: 21, 22, 23-avgustda chek 42 / 29 / 31
ta, xarajat esa 0 / 0 / 0.

**Ko'chishda yo'qolmagan.** Eski Supabase eksporti (`.tmp/malumot.sql`,
22-avgust 00:25) tekshirildi: unda ham AYNAN 338 ta xarajat va oxirgi
sana 20-avgust. Ya'ni bu ma'lumot hech qayerda kiritilmagan —
migratsiyani ayblash noto'g'ri bo'lardi.

Nginx jurnali tasdiqladi: 22-avgustdan beri `expenses`, `kassa_ops`,
`kpi_day` ga BIRORTA `POST`/`PATCH` kelmagan. Sahifalar esa ochilgan
(`/dashboard`, `/kpi`, `/finance`) — ya'ni odamlar kirgan, kiritmagan.

### 13.2. Nega tekshiruv jim turdi — eng muhim saboq

`npm run tekshir:server` da eskirish tekshiruvi BOR edi:
"Sotuv ma'lumoti yangi". U doim yashil turardi — chunki sotuv
Billz'dan avtomat kelib turadi.

**Eng ishonchli manba eng ko'r joyni yaratdi.** Avtomat kelmaydigan
to'rt manba (xarajat, kassa, KPI, kurs) uchun tekshiruv umuman
yo'q edi va to'rt kun jimgina o'tdi.

Endi har manba uchun alohida tekshiruv bor (`lib/audit.js`,
`MANBALAR` ro'yxati) — yangi manba qo'shish bitta qator.

**Ikkinchi tuzoq shu yerda chiqdi:** `scripts/tekshir.mjs` ogohlantirishlarni
`id.split("-")[0]` bo'yicha guruhlardi, ya'ni yangi `stale-expenses`,
`stale-kassa`, `stale-kpi` ning HAMMASI "Sotuv ma'lumoti yangi"
sarlavhasi ostiga tushdi. Ekranda "xarajat 4 kundan beri yo'q" degan
xato aynan "Sotuv ma'lumoti yangi" bo'lib turardi. Endi kalit eng
UZUN moslik bo'yicha olinadi.

**Uchinchisi — darvoza mantig'i.** Yangi tekshiruvlar `error` bo'lgani
uchun saytga chiqarishni BUTUNLAY bloklab qo'ydi. Bu noto'g'ri: xodim
xarajat kiritmagani KOD xatosi emas, uni hech qanday tuzatish bilan
yopib bo'lmaydi — darvoza esa abadiy qizil turib, tez orada e'tibordan
qolardi (10.4-bo'limdagi bilan bir xil kasal). Shuning uchun
`bloklamaydi: true` bayrog'i kiritildi:

- **MASHINA ishlamay qolgan** (sinxron to'xtagan) → darvozani yopadi
- **ODAM kiritmagan** (xarajat, kassa, KPI, Billz eksporti) → ekranda
  qizil, jurnalda `‼ KUTIL.`, lekin chiqarishni to'xtatmaydi

### 13.3. Supabase Auth uchta marshrutda qolib ketgan

Jurnalda `43 × GET /api/billz/sync → 500` ko'rindi. Sabab:

```js
const { data: { user } } = await admin.auth.getUser(auth);   // ← yo'q
```

Supabase Auth 23-avgustda olib tashlangan, PostgREST'da `/auth/v1/user`
degan yo'l yo'q. `data` null qaytardi va destrukturizatsiya TypeError
berdi — ya'ni javob "401 Ruxsat yo'q" emas, **500** edi.

Uchta marshrutda bir xil qator turgan edi:

| Marshrut | Oqibati |
|---|---|
| `/api/billz/sync` | "Billz'dan yangilash" tugmasi server xatosi berardi |
| `/api/backup` | rahbar qo'lda zaxira ololmasdi (cron ishlagani buni yashirgan) |
| `/api/staff` | **menejer ustaga login ocholmasdi** — CLAUDE.md dagi talab ishlamay turgan |

`/api/staff` eng chuqur buzilgani: u `admin.auth.admin.createUser()`,
`updateUserById()`, `deleteUser()` ga tayanardi. Ularning o'rniga baza
funksiyalari yozildi (`scripts/sql/auth-xodim.sql`):
`auth.foydalanuvchi_ochish`, `auth.email_almashtir`,
`auth.foydalanuvchi_ochirish`. Parol xeshi baza ichida yaraladi —
`nspos_app` roli `auth.users` ga umuman tegolmaydi.

`foydalanuvchi_ochirish` faqat PROFILI YO'Q qatorni oladi (yarim
ochilgan hisobni orqaga qaytarish uchun) — profili bor hisobga
tegmaydi, sinaldi.

Tekshiruv BITTA joyga yig'ildi: `lib/apiAuth.js` → `kimChaqirdi()`.

**Yo'l-yo'lakay to'rtinchi qoldiq:** Sozlamalar sahifasi tokenni
`sess.session?.access_token` deb o'qirdi. Bu Supabase sessiyasining
maydoni; bizniki `token`. Ya'ni sarlavha doim `Bearer undefined`
ketardi — marshrut tuzatilgan taqdirda ham ishlamay turardi.

### 13.4. Sessiya tugagani — ekrandagi "yo'q ma'lumot"ning bir sababi

Token 12 soat yashaydi, `lib/db.js` esa uni modul yuklanganda BIR
MARTA o'qiydi. Ochiq turgan oynada muddat tugasa:

- ilova buni sezmasdi
- har so'rov 401 olardi
- xato yutilardi
- ekranda **eski raqamlar turaverardi**

Jurnalda bu kuniga o'nlab `401 GET /rest/v1/…` bo'lib ko'rinardi
(`billz_sync_log` da 232 ta). Ya'ni "ma'lumot yo'q" shikoyatining bir
qismi aslida "sessiya tugagan" edi.

Uch joyda tuzatildi:
1. `AuthProvider` — muddat tugaganda O'ZI login sahifasiga chiqaradi
2. `lib/db.js` — 401/`PGRST301` alohida tanilib, "Sessiya muddati
   tugagan — qaytadan kiring" deyiladi (bir marta, takrorlanmaydi)
3. Kuzatuv halqasi to'xtaydi — ilgari har 20 soniyada 39 ta befoyda
   so'rov ketardi

### 13.5. KPI yozuv sikli va ortiqcha yozuvlar

22-avgustda `kpi_plan` ga **5 530**, `kpi_assign` ga **5 184** ta POST
ketgan — jadvallarda esa 17 va 16 qator bor.

Sabab `kpiData.syncUp()`: u bazadan ENDIGINA kelgan hamma rejani
qaytarib yozardi. Kunlar uchun `seenDayId` qo'riqchisi bor edi,
rejalar va turlar uchun yo'q.

Xavflisi ortiqcha so'rov emas: `bootstrap()` uchala jadvalni
`Promise.all` bilan o'qiydi, ya'ni TARTIB KAFOLATLANMAGAN. `kpi_day`
birinchi tugasa, `syncUp()` hali bazadan kelmagan — localStorage'dagi
ESKI rejani bazaga yozib yuborardi. **Boshqa menejer o'zgartirgan reja
shu bilan jimgina orqaga qaytardi.**

Endi: har jadval bazadan kelganini belgilaydi, `syncUp()` uchalasi
kelgandan keyin va faqat bazada YO'Q yozuvni yuboradi.

Yonida: Billz sinxroni har yurishda 35 ta kategoriyaning hammasini
qaytadan yozardi (kuniga ~1 500 PATCH) — endi `billz_id` haqiqatan
o'zgargandagina.

Natija: chiqarishdan keyin 24 sahifa ochildi — birorta KPI yozuvi
ketmadi (avval har ochilishda 33 ta).

### 13.6. `scripts/sql.mjs` o'lik yo'lga olib borardi

CLAUDE.md migratsiyani AYNAN shu skript orqali qilishni aytadi. Skript
esa Supabase Management API'ga borardi va loyiha ref'ini
`NEXT_PUBLIC_SUPABASE_URL` dan olardi. Manzil endi `tizim.enes.uz` —
ya'ni skript birinchi qatorida "Loyiha ref'i aniqlanmadi" deb
to'xtardi. Har migratsiya qo'lda `ssh` bilan qilinardi va buni hech
kim yozib qo'ymagandi.

Endi u serverga SSH bilan boradi va `psql -v ON_ERROR_STOP=1` ni
superuser sifatida ishga tushiradi. SQL argument emas, **stdin**
orqali beriladi — qo'shtirnoq va `$$` buzilmasin.

**Umumiy saboq:** platformadan ko'chganda "ishlayotgan" narsa emas,
KAM ISHLATILADIGAN yo'llar sinadi va ular jimgina sinadi. Cron
ishlagani `/api/backup` buzilganini, sotuv kelayotgani xarajat
to'xtaganini, sayt ochilayotgani sessiya tugaganini yashirdi.

---

## 14. 2026-08-24 — moliyaviy audit: to'rt teshik, hammasi jim

Savol oddiy edi: "Billz'dan naqd, Payme va savdo to'liq tortilyaptimi?"
Javob — HA, tortilyapti. Lekin tekshirish jarayonida to'rtta joy
topildiki, ular ma'lumotni XATO BERMASDAN yo'qotardi. Har biri
`end_date` tuzog'i (10.3) bilan bir xil kasal: so'rov muvaffaqiyatli,
javob to'g'ri ko'rinadi, ma'lumot esa kam.

### 14.1. Tanilmagan to'lov turi hech qayerga yozilmasdi

`billzMap.splitPayments()` to'rt turni taniydi (naqd, karta, Payme,
nasiya). Billz'da to'lov turini KOMPANIYA O'ZI nomlaydi, ya'ni ertaga
"Перечисление" ochilsa kod uni tanimaydi va `unknown` ro'yxatiga
qo'yadi. O'sha ro'yxat esa `saleRow` da tashlab yuborilardi — bazada
uni saqlaydigan ustun yo'q edi.

Natijasi: chek summasi joyida turadi, hamyonlar yig'indisi esa undan
kam bo'ladi. Farqni ko'rsatadigan hech narsa yo'q — na ustun, na
tekshiruv. Bugun bunday to'lov yo'q, lekin uni ushlaydigan hech narsa
ham yo'q edi.

Endi: `sales.unknown_paid` ustuni + `moslik.js` → `tolov-taqsimot`.

**Nega naqdga qo'shilmadi:** noto'g'ri hamyonga yozilgan pul yo'qolgan
puldan YOMONROQ. Kassa solishtiruvida u "menejer naqdni kam yozibdi"
bo'lib chiqadi va aybi odamga tushadi.

**Chegara qayerga qo'yildi va nega.** Qoida avval butun bazada
o'lchandi (9 153 Billz cheki):

| tur | cheklar | farqli |
|---|---|---|
| sale | 8 011 | **0** (eng katta farq 0.01 — yaxlitlash) |
| return | 938 | 769 |
| exchange | 204 | 58 |

Qaytarish va almashuvda Billz to'lov qatorini UMUMAN bermaydi
(`order_payments` bo'sh) — pul qaysi hamyondan qaytarilgani noma'lum.
Bu Billz tomonidagi cheklov, uni kod tuzata olmaydi. Shuning uchun
tekshiruv faqat `sale` turida ishlaydi: u yerda bugun farq NOL, ya'ni
birinchi qizarish HAQIQIY nosozlik bo'ladi.

> **Qoida:** ma'lumotga tayanadigan tekshiruv qo'yishdan oldin u
> haqiqiy bazada NECHTA qator ustida qizarishini o'lchang. 827 ta
> abadiy qizil qator — bir haftada e'tibordan qoladigan darvoza
> (13.2 dagi bilan bir xil kasal).

### 14.2. Nasiya to'lovining tanilmagan usuli "naqd" bo'lardi

`debtPaymentRows` da `paymentKind(...) ?? "cash"` turgan edi. Ya'ni
Billz'da yangi usul chiqsa, qarz to'lovi jimgina NAQD bo'lib yozilardi.
`kassaIncome.flowFromDb` esa faqat naqd va Payme'ni sanaydi — pul
kassaga tushmagan bo'lsa ham tushgan bo'lib ko'rinardi.

Endi `unknown` bo'ladi va `audit.js` → `qarz-nomalum-usul` uni
ekranga chiqaradi.

**Eski qatorlar QAYTA YOZILMAYDI.** `syncDebts` mavjud `billz_key` ni
umuman qayta ko'rmaydi va aynan shu idempotentlik qarz to'lovlari
ikkilanmasligining kafolati. Tarixdagi `cash` yozuvlari joyida qoladi.

### 14.3. Do'koni tanilmagan chek va chala tortish jurnalda yo'q edi

Ikkita raqam bosqich ichida hisoblanardi-yu, javob JSON'ida qolib
ketardi:

- `noStore` — Billz do'koni `stores` bilan nom bo'yicha mos kelmasa
  o'sha do'konning HAMMA cheki tashlanadi. Billz'da do'kon qayta
  nomlansa butun bir do'konning savdosi jimgina yo'qolardi.
- `exhausted:false` — "yana qoldi" (300 chek yoki 280 s chegarasi).
  Har yurish chala tugayversa orqada qolish o'sib boradi, eng yangi
  chek esa baribir bugungi bo'lib turadi — ya'ni "Sotuv ma'lumoti
  eskirgan" tekshiruvi buni KO'RMAYDI.

Ustiga cron jurnali javobdan faqat `inserted|items|payments` ni grep
qilardi. Endi `billz_sync_log` da uchala ustun bor (`no_store`,
`exhausted`, `warnings` jsonb), cron grep'i kengaytirildi, Sozlamalar
jadvalida "Tashlandi" ustuni va "· chala" belgisi turadi.

### 14.4. Sotuvchi bazada yozilgan, lekin hech narsa o'qimasdi

`sales.billz_user_id` / `billz_user_name` har sinxronizatsiyada
to'ldirilardi, `salesData.fromRow` esa ularni tashlab yuborardi.
Cheklar jadvalidagi "Kassir" ustuni `cashier_id` ni ko'rsatardi — u
esa Billz cheklarida DOIM bo'sh (chek NSPOS kassasidan o'tmagan).

Ya'ni "Abduvohid Kassa" bazada 4 103 chekda turgani holda ekranda
ustun butun tarix bo'yicha bo'm-bo'sh edi.

Endi `salesData.sotuvchiNomi()` — bitta funksiya, ikki joyda
(cheklar jadvali va chek oynasi).

**Yo'l-yo'lakay:** `/sales` sahifasi `useState(listSales)` bilan
ro'yxatni BIR MARTA olardi. `sales` og'ir jadval bo'lib fonda
yuklanadi, ya'ni sahifa ochilganda xotira hali bo'sh — jadval "Hali
cheklar yo'q" deb turardi va bu hech qanday xato bermasdi.
`useLive()` ga bog'landi (CLAUDE.md 2026-08-13 qoidasi).

### 14.5. B2B/B2C — do'kon bo'yicha, va ma'lumot buni tasdiqladi

Taxmin: "biri B2B sklad bilan, biri B2C bilan ishlaydi". Bazadan
o'lchandi:

| oy | Optim | Namangan |
|---|---|---|
| iyun | Abdulahad 796 · Abduvohid 245 | — |
| iyul | Abduvohid 775 · Abdulahad 89 | Abdulahad 410 |
| avgust | Abduvohid 586 · Abdulahad 1 | Abdulahad 388 |

Ya'ni **Abdulahad iyul oyida Optim'dan Namangan'ga o'tgan**. Butun
tarix bo'yicha u Optim'da ko'proq sotgan (3 790 chek), hozir esa
to'liq Namangan'da.

Shuning uchun ajratish SOTUVCHI bo'yicha emas, DO'KON bo'yicha
to'g'ri: odam ko'chadi, do'kon ko'chmaydi. Bu allaqachon shunday
ishlangan (`kassaData.b2bStoreIds()` — do'konga "B2B menejer" turidagi
xodim biriktirilgan bo'lsa o'sha do'kon B2B) va sozlama ham to'g'ri
turgan ekan: Abduvahid → Optim → `b2b`, Abdulahad → Namangan →
`b2c_store`.

Tasdig'i: avgustdagi montaj savdosining 100% i Namangan'da (7 533.83 $,
Optim'da 0) — optomda o'rnatish xizmati sotilmaydi degan qoida
ma'lumotda ham ko'rinib turibdi.

Qo'shildi: `b2b-belgilanmagan` ogohlantirishi. Belgi KPI turidan
olinadi, ya'ni menejer o'chirilsa yoki turi olib tashlansa do'kon
JIMGINA B2B'likdan chiqadi va servis hamyoni optom kassada paydo
bo'ladi.

### 14.6. Montaj: servis kirimi endi jonli cheklardan

Ilgari servis kirimi "Эффективность товаров" Excel yuklamasidan
olinardi. Ikki muammo:

1. Hisobotda KUNLIK taqsimot yo'q — 46 kunlik raqam so'ralgan davrga
   kunlar nisbatida bo'linardi. "5-avgustdagi servis" aslida o'rtacha
   edi.
2. Fayl QO'LDA yuklanadi. 24-avgustda eng yangisi 15-avgustniki edi —
   9 kunlik servis kirimi yo'q, lekin ekranda raqam turgani uchun
   buni hech kim sezmasdi.

Endi `serviceIncome.servisKirim()` — yagona kirish nuqtasi: davrda
chek bo'lsa `sale_items` dan (kunma-kun aniq, o'zi yangilanadi),
bo'lmasa Excel (API'dan oldingi tarix va demo uchun). `kassaData`
ikkala joyda shuni chaqiradi.

**"Servis foydasi" hisoboti ATAYLAB Excel'da qoldirildi.** Yarim
ko'chirilsa bitta ekranda ikki manba bo'lardi — bu 4-bo'limdagi
"Bir jadval — ikki manba" xatosining aynan o'zi. Uning o'rniga
`moslik.js` → `servis-manba` qo'shildi: ikki manba bir davrda 10% dan
ko'p farq qilsa ogohlantiradi (aniq tenglik kutilmaydi — Excel
proratsiya qilinadi).

Yonida: `productRow` endi `is_service` yozadi (nom bo'yicha,
`companies.service_names`). Ilgari bu ustun sinxronizatsiyada umuman
to'ldirilmasdi va montaj oddiy tovar bo'lib kirardi — qoldig'i
minusga tushar, hisobotlar esa uni "manfiy qoldiq" evristikasi bilan
to'rt joyda qo'lda chetlab o'tardi.

### 14.7. `.env.local` yana eski bazaga qarab turgan edi

11.2 bo'limi takrorlandi. `npm run billz` kompyuterda ishga
tushirilganda xato shunday chiqdi:

```
sales yozilmadi: Could not find the 'unknown_paid' column
of 'sales' in the schema cache
```

Ya'ni xato MIGRATSIYA yoki KOD ustiga ko'rsatardi. Tekshirilganda
ustun bazada bor edi, serverdagi PostgREST uni ko'rardi
(`curl` bilan sinaldi), huquqlar ham joyida. Sabab boshqa edi:
`.env.local` dagi manzil hamon **yopilgan Supabase loyihasi**
(`vysygcnsjqedwqaymxsd.supabase.co`).

Endi `scripts/billz-sync.mjs` bosh qatorda manbani AYTADI va
`tizim.enes.uz` bo'lmasa ogohlantiradi. Kalit chiqarilmaydi — faqat
host.

> **Qoida:** bazaga boradigan har skript qaysi bazaga borayotganini
> aytsin. Buni `tekshir` uchun 11.2 da qilgan edik — `billz` unutilgan
> ekan. "Bir joyda qilingan tuzatish qolgan yo'llarga ham qo'llansin."

### 14.8. Yangilash tugmasi — har xodimga

Ilgari Billz'dan tortishni faqat rahbar boshlay olardi (server ham
`owner` talab qilardi). Menejer ekranidagi raqam cron kelguncha
30 daqiqagacha eski turardi va u buni bilmasdi ham.

Endi yon panelda, til va tema yonida "Yangilash" tugmasi turadi va
u HAR XODIMDA ochiq. Xavfli parametrlar (`--full`, `probe`, `from/to`,
`max`, `dry`) rahbarda qoldi: xodim ularni yuborsa jim e'tiborsiz
qoldiriladi va javobdagi `rejim` amalda nima bajarilganini aytadi.

Uch qavat himoya (Billz sekundiga 2 so'rov beradi):
1. tugmaning o'zi — bosilib turganda ikkinchi bosish yo'q
2. oynalar orasida — `localStorage` qulfi, `BillzAutoSync` bilan
   AYNAN bir xil kalit (satr takrorlanmasin deb eksport qilindi)
3. serverda — oxirgi yangilanish 1 daqiqadan yangi bo'lsa Billz
   umuman urilmaydi, va modul darajasidagi `ayniPaytda` qulfi

**Nega darvoza atigi 1 daqiqa.** Uzunroq bo'lsa u asl maqsadga
QARSHI ishlaydi: kassir hozir chek kesadi, menejer Yangilashni
bosadi, sahifa qayta yuklanadi va yangi chek YO'Q — chunki server
"yaqinda tortilgan" deb Billz'ga bormagan. Ekranda esa hech qanday
belgi yo'q. Bir daqiqa faqat ketma-ket bosishni to'xtatadi.

Tugma bosilgach sahifa QAYTA YUKLANADI. Sabab: ma'lumot modul
xotirasida yashaydi (`lib/db.js` → `bootstrap()` ikkinchi chaqiriqda
darrov qaytadi), "bazadan qayta o'qi" degan yo'l umuman yo'q.

### 14.9. Nima o'zgarmadi — va bu ham natija

Tekshiruv o'zgarishlardan oldin ham, keyin ham AYNAN bir xil raqam
berdi: kirim 82 308.87 · kassada 47 344.28 · naqd 35 949.01 ·
Payme 8 347.65 · servis 3 047.62. Ya'ni audit tuzatishlari hisobga
tegmadi — ular kelajakdagi jim yo'qotishni ushlash uchun.

Chiqarishni bloklab turgan yagona xato (`Namangan · Servis
−1 416.44`) o'zgarishlardan OLDIN ham bor edi — `git stash` bilan
alohida tekshirildi. Sababi ma'lumotda: avgustda Billz montaj
bo'yicha 7 533.83 $ ko'rsatadi, menejer esa KPI ga 6 623.50 $
yozgan — **910.33 $ kam**, ustiga 20-avgustdan beri umuman
kiritilmagan.

### 14.10. Excel yuklashdan voz kechish (2026-08-24)

Qaror: foydalanuvchi endi Billz eksport faylini yuklamaydi. Tovar,
qoldiq, mijoz, chek, chek qatori va qarzlar Billz API'dan bazaga
avtomatik keladi; tahlillar faqat shu jonli ma'lumotdan quriladi.

`/data` va `/finance/import` yuklash sahifalari, menyu bandlari,
P&L/Kassa ichidagi Excel solishtiruvi hamda "yuklama eskirgan"
ogohlantirishi olib tashlandi. API bilan hali qurilmagan eski
hisobotlar ko'rsatilmaydi — foydalanuvchini "fayl tashlang" degan
yo'lga qaytarish mumkin emas. Ular faqat kerakli Billz endpointi
aniqlanib, bazadan qayta yozilgach ochiladi.

### 14.11. Yangilash natijasi ko'rinishi kerak (2026-08-24)

Billz'dan qo'lda tortish yon panelning yuqori qismida alohida
**Yangilash** tugmasi bo'lib turadi — til/tema tugmalari orasida
yo'qolmaydi. So'rov ishlayotganida tugma aylanish animatsiyasi va
haqiqiy soniya hisoblagichini ko'rsatadi. Server javobi kelgach sahifa
to'liq yangilanadi: sinxronizatsiya katta hajmda bo'lgani uchun faqat
realtime hodisalarga tayanib "hammasi yangilandi" deb aytish mumkin
emas.

### 14.12. KPI savdosi Billz chekidan avtomatik keladi (2026-08-24)

20–24-avgustda Billz sinxroni sog'lom edi (kuniga 26–42 chek), ammo
KPI jadvalidagi `Savdo` qo'lda kiritiladigan maydon bo'lgani uchun
20-sanadan keyin nol ko'rindi. Endi do'konga biriktirilgan menejerning
kunlik savdosi `sales` jadvalidagi Billz cheklaridan avtomatik
yig'iladi. Tarixiy qo'lda yozilgan sonlar O'ZGARMAYDI; faqat bo'sh
kunlarga avtomat raqam qo'yiladi va ular tahrir qilinmaydi.

### 14.13. Naqd, Payme va Servis ham Billz'dan (2026-08-26)

14.12 da `Savdo` ustuni Billz cheklariga ulandi. Qolgan uchta pul
ustuni — **Naqd**, **Payme**, **Servis** — qo'lda qoldi va aynan
o'sha sabab yana bo'sh qoldi: **20-avgustdan 26-igacha hech kim
yozmagan**, cheklar esa har 30 daqiqada kelib turgan. Bo'sh ustun
jimgina tarqaladi — kassa kirimi, inkassatsiya bonusi va hamyon
balansi ham o'sha kunlar uchun nolga tushdi.

**Qo'l mehnati ma'lumot qo'shmasdi.** Haqiqiy bazada o'lchandi
(1–19 avgust, 37 kun-do'kon):

| ustun | menejer yozgani ↔ Billz |
|---|---|
| Servis | 19 kundan 18 tasi **tiyinigacha teng** (07-avgust: 263.50 ↔ 253.50, terish xatosi) |
| Naqd/Payme | kunlarning ko'pi aynan teng; farq chiqqan 4 kun — qarz to'lovi qaysi do'konda olingani noma'lumligidan (14.x, `debt_payments.received_by` bo'sh), ikki do'kon orasida oyna aksi bo'lib chiqadi |

Ya'ni menejer Billz raqamini QO'LDA KO'CHIRIB yozar ekan. Jarayon
ma'lumot emas, faqat kechikish va terish xatosi qo'shardi.

**Formula** (`kassaIncome.kunlikKirim`):

```
servis = montaj qatorlari (sale_items, companies.service_names)
naqd   = Billz naqd (chek + qarz to'lovi, qaytarish ayrilgan) − montaj
payme  = Billz payme (chek + qarz to'lovi, qaytarish ayrilgan)
```

Montaj naqddan ayriladi, chunki menejer shunday yozardi (731 → 700
naqd + 31 servis), Billz esa montajni oddiy naqd sotuv qilib
yuboradi. Ayirilmasa "Jami tushum" aynan servis summasicha ikki
marta sanaladi. O'lchandi: **238 ta montajli kun-do'kondan
birortasida ham montaj o'sha kunlik naqddan katta emas** (eng kam
qoldiq 69.91 $), ya'ni ayirish naqdni manfiyga tushirmaydi.

**Natija (chiqarishdan oldin, haqiqiy baza ustida):**

```
             oldin              keyin
Kirim        82 308.87 $        105 801.82 $   (+23 492.95)
Naqd         35 949.01 $         54 248.61 $
Payme         8 347.65 $         11 683.77 $
Servis        3 047.62 $          4 904.85 $
```

Va **chiqarishni bloklab turgan xato o'zi yo'qoldi**: "NScamera
Namangan · Servis −1 416.44" 14.9 dan beri qizil turgan edi. Sabab
kodda emas edi — kirim yozilmagan kunlar. Kirim joyiga tushishi bilan
hamyon musbatga chiqdi.

#### Kamomad nazorati nima bo'ldi

`kassaIncome.js` va `kassaData.js` da ATAYLAB yozilgan qoida bor edi:
"bu raqamdan bonus hisoblanadi, shuning uchun uni oshirish foydali;
Billz bilan solishtirilsa kamomad ko'rinadi". Endi ikkala tomon bir
manba bo'lgani uchun farq har doim 0 chiqadi — ya'ni jadval "kamomad
yo'q" deb ishontirib turardi (10.4: yolg'on jurnal haqiqiy nosozlikni
yashiradi).

Shuning uchun `kassaControl()`/`kassaControlDays()` **xom, qo'lda
yozilgan qatorni** o'qiydi (`listAllDays`, `listDays` EMAS): 1–19
avgust tarixi hamon solishtiriladi, qo'lda to'ldirilmagan kun esa
`diff: null` — ekranda "—" va "solishtirilmagan", NOL emas.

> Eslatma: bu jadvalning ekrani hozir menyuda yo'q — u Excel
> yuklamasi bilan birga olib tashlangan (14.10). Kod halol turadi,
> qaytarilsa ishlaydi.

Rahbar tanlovi (2026-08-26): qo'lda kiritish butunlay olib tashlansin,
kamomad nazorati bo'yicha alohida ish hozircha qilinmasin.

#### Nimalar tegib ketdi

- Bazadagi eski qo'lda yozilgan qatorlar **O'CHIRILMADI** —
  `kpi_day.data` da joyida turadi, ekran ularni o'qimay qo'ydi.
- `moslik.js` → yangi `kpi-tushum` tekshiruvi: Naqd+Payme+Servis =
  Billz kunlik kirimi. Takrorlanuvchi emas — u montaj bir marta
  ayrilishini ushlaydi.
- `audit.js` → `stale-kpi` endi faqat QO'LDA qoladigan maydonlarni
  o'lchaydi (kech, dam, reviziya, kamera, olgan…). Aks holda u
  avtomat to'lgan qator tufayli doim yashil turardi — 2026-08-24 dagi
  "eng ishonchli manba eng ko'r joyni yaratadi" xatosining aynan o'zi.
- `audit.js` → "kassaga tushmagan kirim" tekshiruvi XODIM ustidan
  DO'KON ustiga ko'chdi: kirim endi do'kon bilan keladi va bo'shliq
  ham o'sha yerda (kassa ro'yxatida turmagan do'kon jimgina tashlanadi).
- `kpiData` → `b2c_retention` jadvaliga `Servis` ustuni qo'shildi.
  Ilgari u yerda yo'q edi va zarari ham yo'q edi (raqam qo'lda
  yozilardi). Endi ustunsiz montaj puli "Jami tushum" ichida
  KO'RINMASDAN turardi.
- `db.js` → `dataVersion()`/`bumpData()`, `sync.js` esa har qator
  almashganda uni oshiradi. `kunlikKirim` natijani keshlaydi (9 263
  chek + 35 312 qator + 16 123 to'lov, har xodim-oy uchun chaqiriladi).
  Kesh uzunlik bo'yicha emas, VERSIYA bo'yicha eskiradi: Billz
  sinxroni qo'shibgina qolmay, YANGILAYDI ham — uzunlikka tayangan
  kesh jimgina eski raqamni ko'rsatib turardi.

#### `npm run tekshir:server` o'zgarishni KO'RMAYDI

Chiqarishdan oldingi majburiy tekshiruv (CLAUDE.md 2026-08-13)
`scripts/server/tekshir-uzoq.sh` orqali boradi, u esa serverdagi
`/opt/nspos/app` — ya'ni **allaqachon joylashgan** kodni yurgizadi.
Lokal o'zgarish undan ko'rinmaydi: baseline ham, o'zgarishdan keyingi
natija ham AYNAN bir xil chiqdi (82 308.87) va bu "hech narsa
o'zgarmadi" degan yolg'on xulosaga olib borardi.

Shuning uchun bu safar ishchi nusxa serverdagi `/tmp/nspos-sinov` ga
`rsync` qilinib, `node_modules` ilova papkasidan symlink qilinib,
o'sha yerda tekshirildi. Aynan shunda yangi raqamlar va yangi
tekshiruv ko'rindi.

> **Ochiq ish:** `tekshir:server` chiqarishdan OLDIN lokal kodni
> tekshiradigan qilib tuzatilsin — hozir uni faqat chiqargandan
> keyin yurgizish mumkin, ya'ni "xato chiqsa chiqarilmaydi" qoidasi
> amalda ishlamaydi.

#### Yon tomondan ko'ringan narsa (bu ishga kirmadi)

`listDebts()` Billz qarzi bo'lsa `source='nspos'` qarzlarni butunlay
chetlab o'tadi. Avgustda o'sha 102 qarzga 4 196.53 $ to'lov tushgan
va u hech qaysi hisobda ko'rinmaydi. Bu 2026-08-26 dan oldin ham
shunday edi — alohida ko'rilsin.

---

## 15. 2026-08-28 — "Billz'dan tortyaptimi?": javob ha, lekin o'lchov noto'g'ri joydan olingandi

Savol oddiy edi: sinxron ishlayaptimi. Birinchi o'lchov dahshatli
ko'rindi — sotuv 19-avgustda muzlagan, har kuni bir xil 34 ta chek,
9 kunlik ma'lumot yo'q. Aslida **sinxron benuqson ishlayotgan edi**.
O'lchov o'lik bazadan olingandi.

### 15.1. Uch soatlik chalg'ish qayerdan boshlandi

`.env.local` hamon yopilishi kerak bo'lgan Supabase'ga
(`vysygcnsjqedwqaymxsd`) qarab turardi. Ya'ni:

| | eski Supabase | VPS (haqiqiy) |
|---|---|---|
| sotuv | 9 032 | 9 357 |
| oxirgi sotuv | 19.08 | 28.08 20:06 |
| 19.08→28.08 cheklari | 34 | 359 |

Billz'ning o'zida o'sha oraliqda 359 ta chek bor — ya'ni VPS roppa-rosa
to'g'ri, eski nusxa esa 325 ta chekni boy bergan.

Bu **uchinchi marta** shu tuzoqqa tushish edi (11.2 — tekshiruv,
14.7 — billz skripti). Ikkalasida ham yechim "ogohlantirish qo'shildi"
bo'lgan. Ogohlantirish 24-avgustdan 28-avgustgacha HAR YURISHDA
chiqdi va hech kim to'xtamadi.

> **Qoida:** ogohlantirish uchinchi marta ishlamasa — u ogohlantirish
> emas, TO'SIQ bo'lishi kerak. `scripts/lib/baza.mjs` endi noto'g'ri
> bazada skriptni umuman ishga tushirmaydi (`--boshqa-baza` bilan
> ataylab chetlab o'tiladi). `billz-sync` va `tekshir` — ikkalasi ham
> shu bitta faylni ishlatadi.

### 15.2. `--probe` to'siqdan OLDIN turgan edi

Tashxis buyrug'i (`--probe`) bazaga tegmaydi, shuning uchun manba
tekshiruvi undan keyin turardi. Lekin odam aynan "nega ma'lumot
kelmayapti?" deb o'shani chaqiradi: probe "Billz'ning 9 ta yo'li ham
ochiq" deb chiqadi, odam Billz'ni aybsiz deb biladi va sababni
butunlay boshqa yoqdan qidiradi — holbuki sabab birinchi qatorda
aytilishi mumkin edi.

> **Qoida:** manba tekshiruvi eng birinchi bajarilsin, hatto bazaga
> tegmaydigan yo'llarda ham. Tashxis buyrug'i qaysi tizim haqida
> gapirayotganini AYTMASA, u tashxis emas.

### 15.3. Eski Vercel hamon tirik edi

`vercel.json` 24-avgustda o'chirilgan — lekin faqat PAPKADA. Vercel
croni deploy ichida qoladi, ya'ni eski sayt har kuni 03:13 da eski
Supabase'ga yozishda davom etardi (bugun 28.08 da ham). Undagi kod
tuzatishlardan oldingi kod: `end_date` xatosi ham, "yangi" sanog'i
xatosi ham joyida.

> **Qoida:** platformadan chiqish "konfiguratsiya faylini o'chirdim"
> bilan tugamaydi. Jonli deploy o'z nusxasi bilan yashaydi —
> §12.4 dagi yopish tartibi oxirigacha bajarilsin.

### 15.4. Jurnal yolg'oni beshta bosqichning to'rttasida qolgan edi

24-avgustda `syncOrders` da tuzatilgan xato — "upsert'ga ketgan hamma
qator `inserted` deb sanaladi" — qolgan bosqichlarda qolib ketgan edi.
Eng ko'rinadigani `syncSuppliers`: `inserted: rows.length` qattiq
yozilgan, ya'ni jurnal har yarim soatda "2 ta ta'minotchi qo'shildi"
derdi. Haqiqiy bazadagi 48 ta yozuvning HAMMASI shunday edi.

Ikki zarari:
* jurnalga ishonib bo'lmasdi — "qo'shildi" hech narsa demasdi;
* har yozuv `audit_log` ga tetik qo'yadi: kuniga 96 ta bekorga yozuv.

Endi farq `onlyChanged()` ning O'ZIDA hisoblanadi (`yangi` /
`ozgargan`), ya'ni yangi bosqich qo'shilganda ham to'g'ri sanaydi.
Tovarda `updated` "bog'landi" degani edi — u endi o'z nomi bilan
(`relinked`) qaytadi.

> **Qoida:** bir joyda qilingan tuzatish qolgan yo'llarga ham
> qo'llansin (14.7 ning takrori) — va iloji bo'lsa UMUMIY
> yordamchining ichiga qo'yilsin, toki keyingi chaqiruvchi uni
> unutmasin.

### 15.5. `--dry` yozardi

`dryClient` yozuvni Proxy bilan JISMONAN to'sadi — `insert`, `upsert`,
`update`, `delete`. Lekin `rpc` to'g'ridan-to'g'ri o'tkazilardi, va
`syncOrders` oxirida `refresh_customer_stats()` chaqiriladi. U
`customers` ning to'rt ustunini qayta yozadi. Ya'ni "hech narsa
yozilmaydi" deb ishga tushirilgan sinov aslida yozardi.

O'lchandi: tuzatishdan keyin `--only=orders --dry --max=5` dan so'ng
`customers.max(updated_at)`, `billz_sync_log` qator soni va mijoz
statistikasining md5 yig'indisi — uchalasi ham o'zgarmadi.

> **Qoida:** "hech narsa yozilmaydi" degan rejim bitta ham teshik
> qoldirmasin. Yozuv yo'llari ro'yxat bilan to'silsa (`WRITES`),
> ro'yxatdan tashqarida qolgan yo'l bormi — ALOHIDA qaralsin.

### 15.6. Solishtirish uchun SSH yo'li

VPS Postgres'i tashqariga port ochmaydi (`listen_addresses = localhost`).
Parol qo'yilgan yagona rol — `nspos_app`, u esa RLS ni chetlab
o'tmaydi: uning ko'zi bilan `sales` va `customers` BO'SH ko'rinadi va
`solishtir.mjs` "eskisida 9 032 qator bor, VPS'da yo'q" deb chiqarardi.
Javob xato emas, JIMGINA TESKARI bo'lardi — va mavjud ma'lumot ustiga
ko'chirish taklif qilinardi.

Shuning uchun `solishtir.mjs --ssh root@…` qo'shildi: so'rov
serverning o'zida, `postgres` roli bilan bajariladi.

> **Qoida:** solishtirishda "qator topilmadi" bilan "qatorni ko'rishga
> huquqim yo'q" farqlansin. RLS ostidagi bo'sh javob — eng ishonarli
> yolg'on (21-avgustdagi `debt_payments` holatining takrori).

---

## 16. 2026-09-02 — ko'chish oxirigacha bajarilmagani: ikki hafta ikki bazaga yozilgan

VPS'ga 22–23.08 da ko'childi, CLAUDE.md da "eski Vercel manzillari va
Supabase yopilgan" deb yozildi. Lekin o'lchov (02.09, 01:30):
`nspos.vercel.app/login` → 200, eski Supabase REST → 401 (tirik, kalit
so'raydi), eski bazada 44 faol sessiya, oxirgi qo'lda yozuv **01.09 21:05**,
27.08–01.09 orasida 13 kishi kirgan. VPS'da esa `expenses`, `kassa_ops`,
`payouts`, `kpi_day`, `usd_rates` **20.08 da muzlagan**, Billz'dan
keladigan `sales` esa yangi (01.09 20:43).

| Jadval | Eski | VPS | Faqat eskida |
|---|---:|---:|---:|
| `expenses` | 549 | 338 | 211 |
| `kassa_ops` | 190 | 109 | 81 (74 664 $) |
| `payouts` | 17 | 12 | 5 (7 232 $) |
| `kpi_day` | 703 | 566 | 137 |
| `kpi_plan` | 26 | 17 | 9 |
| `usd_rates` | 27 | 17 | 10 (kurs 11 850 ↔ 11 880) |

### 16.1. Nega ikki hafta sezilmadi

Uchta sabab, uchalasi ham 13-bo'limdagi "jim nosozlik" naqshi:

1. **Eng ishonchli manba eng ko'r joyni yaratdi (yana).** VPS'dagi
   savdo Billz'dan har 30 daqiqada kelib turgani uchun VPS "tirik"
   ko'rinardi. `lib/audit.js` `MANBALAR` tekshiruvlari (24.08 da aynan
   shu holat uchun qo'yilgan) VPS saytida qizil turgan — lekin VPS
   saytini hech kim ochmagan. Tekshiruv odam ko'radigan joyda bo'lishi
   kerak: rahbar Telegram'da kunlik xulosa olsa, `stale-*` qizil
   bo'lganda o'sha xabarda chiqishi kerak (bot serverda O'RNATILMAGAN
   ekan — pastda).
2. **Hujjatdagi "yopildi" o'lchanmagan edi.** §15.3 da `vercel.json`
   faqat papkadan o'chirilgani aniqlangan, lekin CLAUDE.md da "yopilgan"
   yozuvi qolaverdi. `nspos-bot.service` ham xuddi shunday: CLAUDE.md
   "xizmatlar: nspos, nspos-api, nspos-bot" deydi, serverda
   `systemctl list-units | grep nspos` faqat ikkitasini ko'rsatadi.
3. **Saytni ko'chirish — odamni ko'chirish emas.** Brauzerdagi saqlangan
   parol xodimni har kuni eski manzilga qaytardi. Yangi manzil
   aytilgan bo'lsa ham, eski manzil ISHLAYOTGAN ekan, odam o'sha yerda
   qoladi — u uchun hech narsa buzilmagan.

> **Qoida:** hujjatda "yopildi", "bor", "ishlaydi" deyilgan har tashqi
> narsa (eski sayt, xizmat, cron) `curl`/`systemctl`/`ls /etc/cron.d`
> bilan o'lchab tasdiqlansin, yozuvga ishonilmasin. Ko'chish "yangi
> sayt ishlayapti" bilan emas, "eski manzilga KIRIB BO'LMAYDI" bilan
> tugaydi.

### 16.2. Loginlar ikki bazada farq qiladi

VPS `auth.users` — 23.08 nusxasi. Undan keyin menejer ESKI saytda
ustalarning haqiqiy raqamini kiritgan (`/api/staff` PATCH →
`email_almashtir`), ya'ni xodim biladigan login eski bazada, VPS'da esa
o'rinbosar `9989010000NN`. Ikki Akramjon (usta va retention menejer)
raqamlari eski bazada o'zaro ALMASHGAN — bitta `update` bilan
ko'chirilsa `auth.users.email` unique indeksiga uriladi.

Kunning boshidagi reja (01:09) eski va VPS jadvallarini chalkashtirib,
"profiles.phone login emas" degan xulosa chiqargan edi — aslida ikkala
bazada ham `profiles.phone` `email` ga mos, faqat bazalar bir-biriga
mos emas. Ikki bazani solishtirganda har ustun QAYSI bazadan olingani
yozib qo'yilishi kerak.

> **Qoida:** login haqiqati — `auth.users.email`. Ikki baza bo'lsa
> ikkalasidan ham o'qilib, id bo'yicha solishtiriladi. Email
> almashtirishda avval vaqtinchalik qiymat, keyin haqiqiysi (bitta
> tranzaksiyada) — almashgan juftlik unique'ga urilmasin.

### 16.3. Vositalar (bu kecha yozildi, `--dry` da sinaldi)

- `scripts/eski-muzlat.mjs` — eski hisoblarni ban qiladi
  (`banned_until = 2126`), sessiyalarni bekor qiladi
  (`refresh_tokens.revoked = true`). Faqat `supabase db query --linked`
  — service kalit ham, Supabase paneli ham kerak emas. `--qaytar`
  bilan ochiladi. Hech narsa o'chirilmaydi.
- `scripts/login-kochir.mjs` — login eskidan, parol hammaga yangi
  (rahbar qarori). Bitta tranzaksiya, oxirida `auth.kirish()` bilan
  har hisob tekshiriladi — bittasi kirmasa ROLLBACK. Parollar
  `.tmp/loginlar-<sana>.json` da bir marta yaratiladi.
- `scripts/sql/auth-parol.sql` — serverda bor-u repoda yo'q bo'lgan
  `auth.parol_almashtir` (24.08 da qo'lda yaratilgan edi; server
  noldan ko'tarilsa parol berish jimgina ishlamasdi).
- **Tuzoq:** Supabase CLI har so'rovda vaqtinchalik rol yaratadi. Ikki
  CLI skript parallel yurganda (`solishtir.mjs` + `login-kochir.mjs`)
  `failed to connect as temp role` chiqdi. Endi 3 urinish bor, lekin
  qoida — CLI skriptlar KETMA-KET yurgiziladi.

### 16.4. Xarajatlar filtri — bir nechta kategoriya

`components/ui/MultiSelect.jsx`: `null` = "Barchasi", aks holda kalitlar
massivi (`ExpenseModal` dagi `!list || list.includes(k)` qoidasi). Jami
qatori o'zgarmadi — "Rahbarga o'tkazma" ajratmasi `source` ga
bog'langan. Davr almashib tanlangan kategoriya yo'qolsa filtr o'zi
tozalanadi (eski `<select>` da jadval jimgina bo'sh qolardi).

**Tuzoq:** `// eslint-disable-line react-hooks/exhaustive-deps`
yozilgan edi — `npm run nomlar` konfiguratsiyasida bu qoida YO'Q va
lint "Definition for rule not found" bilan yiqildi. Bog'lamga `fCat`
qo'shib hal qilindi (effekt idempotent, halqa bo'lmaydi).

### 16.5. Ijro — 02.09, 02:40–03:15 (rahbar "hozir qilamiz" dedi)

| Qadam | Natija |
|---|---|
| Muzlatish | 16 hisob `banned_until = 2126`, 44 sessiya bekor; muzlatishgacha oxirgi yozuv 01.09 21:05, keyin kirish/yozuv YO'Q |
| Zaxira | VPS `nspos-2026-09-02.dump` (10.5 MB); eski `auth.users`/`profiles`/`kpi_assign` → `.tmp/eski-zaxira/` |
| Solishtiruv (muzlatilgan) | 468 qator faqat eskida, 86 422 $ — 02:20 dagi bilan bir xil |
| Ko'chirish | `kpi_day` 703, `kpi_plan` 26, `expenses` 549→550, `kassa_ops` 190, `payouts` 17, `usd_rates` 27, `datasets` 9, `dataset_chunks` 25. Qayta solishtiruv: **faqat eskida 0** |
| Kurs | `companies.usd_rate` 11 880 → **11 850** (`usd_rates` dagi oxirgisi) |
| `kpi_assign` | "o'zgargan" 1 qator — qiymat bir xil (`b2c_store`), faqat `updated_at` farq qilgan; tegilmadi |
| Login/parol | 17 hisob bitta tranzaksiyada: 11 login eskidagi haqiqiy raqamga, hammaga yangi parol; `auth.kirish()` 17/17 |
| Haqiqiy forma | usta hisobi yangi parol bilan `/login` → `/dashboard`, cookie qo'yildi |
| `tekshir:server` | manba `Postgres: /nspos`; `stale-*` to'rttasi ham YASHIL; bitta ✗ — hamyon minusda (Optim naqd −3 509 $, Namangan naqd −5 257 $, servis −3 803 $) — bu eski saytda ham shunday edi, ma'lumot ko'chishi emas, kassa yuritish masalasi |
| Billz | 03:00 yurishi `OK`, `error` bo'sh; oxirgi `debts full` 01.09 08:30 |
| Brauzer | `brauzer-kirgan.mjs`: 2 + 22 sahifa toza (ko'chirilgan ma'lumot bilan) |
| Tarqatish | rahbar qarori (03:30): parolni biz beramiz, xodim keyin o'zi o'zgartiradi — `Sozlamalar → Parolni yangilash` hamma rolga ochiq (`PasswordCard`, `settings/page.jsx:779`, `/api/parol` faqat o'z hisobini o'zgartiradi). `scripts/login-xabar.mjs` → `.tmp/xabarlar-<sana>.md`: 17 ta alohida Telegram xabari, login/parol 17/17 mos; ikkinchi usta hisobi bilan ham haqiqiy formadan kirildi |

**Birinchi ko'chirish yiqilgan edi** — `updated_at` (16.3 ga qo'shimcha):
VPS'da `updated_at not null` + tetik, eski bazada ustun yo'q.
`jsonb_populate_record` uni NULL qildi, `replica` rejimida tetik
o'chiq — 6 jadval "null value in column updated_at" bilan qoldi,
`kpi_day`/`kpi_plan` esa o'tdi (ularda ustun eskida ham bor). Ya'ni
xato QISMAN ko'rindi: 2 ta ✓ va 6 ta ✗ — "yarim ko'chgan" holat.
`kochirish.mjs` endi nishonda ustun bo'lsa `updated_at` →
`created_at` → `now()` qo'yadi. Oxiridagi sanoq solishtiruvi shu
holatni tutdi — u bo'lmasa "6 ta jadval XATO" satri jurnalda qolib,
skript baribir "ketma-ketliklar tekislandi" deb davom etardi.

> **Qoida:** ko'chirishda "qator soni teng" tekshiruvi SKRIPTNING
> O'ZIDA bo'lsin va u yiqilganda `exit 1` bersin (bor edi — shuning
> uchun tutildi). Yangi `not null` ustun qo'shilganda eski manbadan
> ko'chirish yo'li ham qayta sinalsin.

**Eski saytda o'chirilgan, VPS'da qolgan yozuv.** Menejer 31.08 da eski
saytda 20.08 dagi 25.30 $ lik "ABDUVAHID" oylik xarajatini o'chirgan;
VPS'da (22.08 nusxasi) u turibdi — `expenses` 550 ≠ 549 shundan. Qoida
bo'yicha o'chirilmadi, rahbarga aytildi — qaror uniki. Qolgan 19 ta
o'chirish 22.08 dan keyin yaratilgan qatorlar (VPS'da hech qachon
bo'lmagan) yoki 05–15.08 dagi sinov yozuvlari.


---

## 17. 2026-09-02/03 — "Billz bilan solishtir": ko'zgu, qarz va Qoldiq salomatligi

Savol uch bosqichda keldi: "ma'lumot aniqmi, Billz bilan solishtir" →
"aynan Qoldiq salomatligi nega farq qiladi" → "auditor sifatida:
nima qo'shiladi, nima ayriladi, Billz'da ham shundaymi; qarz ikki xil".
Oxirida rahbar tamoyil aytdi: **tizim Billz'da bor narsani Billz'dan
olib, real vaqtda, qo'shib-ayirmasdan ko'rsatsin; faqat qo'lda
kiritiladiganlar tizimning o'zida.**

### 17.1. O'lchov (02.09, 22:50–23:40, VPS + Billz API, faqat o'qish)

| Nima | Billz | NSPOS | Xulosa |
|---|---:|---:|---|
| Qoldiq (656 tovar, id bo'yicha) | — | — | **656/656 mos, farq 0** |
| Oxirgi 30 kun cheklari (id bo'yicha) | 1 312 | 1 312 | mos |
| Mijoz soni | 5 009 | 5 009 | mos |
| Jami qarz (ochiq) | **47 634.42** (387) | ekranda **30 639** (249) | farq 16 995 $ |

Qoldiq to'g'ri edi — "Qoldiq salomatligi" farqi FORMULADA (17.3).
Qarz farqi esa tiyinigacha tushuntirildi:

```
30 639.06  ekran (source='billz')
+20 180.48 150 qarz `source='nspos'` — 20.08 dan keyin kelganlar
− 1 621.03 12 qarz Billz'da bugun yopilgan, NSPOS ochiq
− 1 564.16  4 qarz qisman to'langan, NSPOS ko'rmagan
= 47 634.35 ≈ Billz 47 634.42 (7 tiyin — yaxlitlash, 17.4)
```

### 17.2. Qarz — uch ko'r nuqta

1. **Yorliq.** `billzMap.debtRow` `source` ni yozmasdi, baza default
   `'nspos'` qo'yardi; `listDebts()` faqat `'billz'` ni sanardi.
   Backfill (`billz-debts.sql:57`) bir marta 22.08 da yurgan. 14-bo'lim
   oxirida "alohida ko'rilsin" deb qolgan edi — ko'rilmagan.
   > **Qoida:** sinxron yozgan har qator yorlig'ini O'ZI yozsin;
   > backfill — bir martalik, kelajakni qamramaydi. Audit `qarz-manba`.
2. **Filtr to'liq ro'yxat emas.** Billz `status=unpaid` 289 qarz beradi
   (unpaid 12 + overdue-to'lovsiz 277); haqiqiy ochiq 387 — qisman
   to'langan 96 overdue va 1 partial_paid tashqarida. Yopilgan qarz esa
   hech qaysi oqimda kelmaydi. Yengil sinxron shuni olardi, to'liq esa
   20 soatda bir. Sinov: `partial_paid`, `fully_paid` filtr sifatida
   400 ("status is not valid"); `/v1/debt/{id}` 403; `customer_id`
   filtri ISHLAYDI.
   > **Qoida:** ochiq to'plam bir necha oqimdan yig'iladi (unpaid +
   > overdue + kursordan keyingilar), bazada ochiq-u oqimda kelmagani
   > mijoz bo'yicha so'raladi (4-oqim). Sinov (`--dry`): 387 /
   > 47 634.42 — Billz ekrani bilan bir xil, 12 yopilgan 6 mijoz
   > oqimidan topildi, 24 s.
3. **Uch ta'rif.** `balanceData.receivables()` `closedAt` ni
   tekshirmasdan `> 0.001`; `statsFrom` `> 0`; `arAging` `> 0.009` —
   ular bir-biriga tekshirilmasdi. Qarzdorlar/Mijozlar sahifasi mijoz
   bo'yicha aylanib, mijozsiz qarzni tashlardi. Hisobotlar → Qarzdorlar
   olib tashlangan Excel'dan o'qib BO'SH turardi — rahbar "jami
   qarzdorlik ko'rsatilmayapti" degani shu.
   > **Qoida:** `debtsData.ochiqQoldiq()` — yagona ta'rif;
   > `jamiQarz()` — Billz "Jami qarz" bilan bir xil bo'linish
   > (overdue / unpaid / partial_paid) va sinxron vaqti. Balans,
   > Qarzdorlar, Hisobotlar, `/api/v1/qarz`, bot — shundan.
   > `moslik`: `balans-ar`, `qarz-jami`, `qarz-chek`.

Bitta qarz formulasi (summa − to'lovlar, "Системная оплата" ham
ayriladi) Billz bilan mos edi: 30 639.06 ↔ 30 639.08.

### 17.3. Qoldiq salomatligi — formula Billz'da yo'q narsani aytardi

43 "tugagan, lekin sotilyapti" qatori: 18 tasi oxirgi 30 kunda
sotilgan, 15 tasi 31–60 kun oldin, 10 tasi 60–90 kun oldin. 25 tasi
90 kunlik ZAXIRA oyna orqali "sotilyapti" bo'lib chiqqan (iyun–iyulda
tugagan, qayta kelmagan) va 178 $/kun "yo'qotish"ning 103 $ ini bergan.
20 tasida tannarx 0 (Billz qoldig'i 0 tovarga tannarx bermaydi, bular
birinchi sinxrondayoq tugagan edi) — "yo'qotish" = narxning to'lig'i
(98.77 $/kun). Audit `billz-cost-zero` faqat qoldig'i borni ko'rardi.

> **Qoida:** zaxira oyna yoki noma'lum tannarx bilan chiqqan raqam
> ALOHIDA belgilanadi (`oyna`, `sokin`, `tannarx: null`, "Oxirgi
> sotuv" ustuni) va pul yig'indisiga kirmaydi; 0 yozilmaydi.
> `reorderSummary()` — ekran, API, bot bitta yig'indi. Natija:
> 17 tugagan (+26 sokin), yo'qotish 69.64 $/kun.
> **Muddat rahbarniki:** `companies.reorder_lead_days` (14) /
> `reorder_cover_days` (30), sahifada ikki maydon (`can("staff.manage")`).

### 17.4. Tiyin — Billz 4 xona bilan yuritadi

Farq detektori birinchi yurishda "ochiq qarz summasi: Billz 47 634.42,
bu yerda 47 634.35" dedi. Billz qarz summasini kasr tiyin bilan
yuritadi (188.035; ekranda 47 634.4218), ustun `numeric(12,2)` edi.
`debts.amount`/`paid_amount`, `debt_payments.amount` → `numeric(14,4)`
(views qayta yaratildi), `sameValue` chegarasi 0.005 → 0.00005,
`remainingOf` 4 xona. Keyin `arAging.open` mijoz qatorlaridan (har
biri yaxlitlangan) yig'ilgani uchun 3 tiyin kam chiqdi — xom
yig'indidan olindi. Natija: baza 47 634.4218 = Billz.

> **Qoida:** har qatorni alohida yaxlitlab qo'shish — yig'indini
> buzadi; yaxlitlash OXIRIDA, bir marta.

### 17.5. "Real vaqt" nima va nega jonli so'rov emas

Billz sekundiga 2 so'rov, 11 079 qarz = 111 sahifa (60–160 s),
shubhali IP'ni bloklaydi. Sahifa ochilganda Billz'ga borish — 1–2
daqiqa kutish. O'lchandi: bir inkremental aylanish 8–9 s, ~25 so'rov.
Shuning uchun:

- cron `*/30` → `*/5`; `BillzAutoSync` 30 → 5 daqiqa; qarz to'liq
  20 soat → 2 soat; katalog to'liq kuniga bir (20.08 dan beri
  bo'lmagan edi).
- **Farq detektori** `billzSync.moslikTekshir()` — har yurish oxirida:
  Billz `count` (tovar, mijoz), ochiq qarz soni va summasi (oqimlardan),
  7 kunlik cheklar id bo'yicha. `billz_sync_log` `entity='moslik'`,
  cron jurnalida `FARQ(n)`, audit `billz-farq` (error, darvozani
  yopadi). Chek sanog'i emas — id: Billz `count` UTC kun chegarasi
  bilan 1 312 ↔ 1 271 soxta farq bergan edi.
- **Muhr** `components/BillzMuhr.jsx` — 8 sahifada "Billz: 23:30 ·
  mos ✓"; 15 daqiqa sariq, 60 daqiqa yoki farq qizil; jurnal bo'sh
  (huquq yo'q) bo'lsa hech narsa — soxta yashil yo'q.
- `npm run billz:solishtir` — id bo'yicha to'liq solishtiruv (tovar,
  qarz, chek), faqat o'qiydi, chiqarishdan oldin.

### 17.6. Olib tashlanganlar va qolganlar

Olib tashlandi: `lib/debtsUpload.js`, `lib/customersUpload.js`,
`client_debts` yuklama yo'llari (5 sahifa), `managementData.
billzInRange` Excel zaxirasi (tannarx endi qator → katalog).
Bazada hech narsa o'chirilmadi: 659 excel qarz qatori `source='excel'`
bilan turibdi va chetlanadi.

Qoldi (alohida qaror): `pnlData.salesPnl` / `serviceIncome` Excel
zaxirasi (14.6 qarori bilan ataylab); KPI "Nasiya" ustuni nomi
(Savdo − Kirim, qarz emas); "Savdo (sotilgan)" / "Kirim (tushgan
pul)" yorliqlari — rahbar tasdiqlasa. Auditda: karta / mijoz
balansidan / noma'lum to'lov kassaga kirmaydi — hozir 0.00, audit
`kirim-hamyonsiz` birinchi tiyinda aytadi.

### 17.7. Ijro — 03.09, 00:30–01:40

| Qadam | Natija |
|---|---|
| `debt-source-tuzat.sql` | 235 qator `'billz'`, o'chirilmadi |
| Chiqarish 1 (qarz) | API `jami_qarzdorlik` 50 819.54 (399) — `nspos-api` qayta ishga tushirilmagach eski javob; `chiqar.sh` tuzatildi |
| Chiqarish 2 (ko'zgu) | cron 5 daqiqa; to'liq qarz 78 s; detektor: tovar 656=656, mijoz 5 009=5 009, chek 355/355, qarz 387=387, summa 7 tiyin farq |
| `debt-4-xona.sql` + chiqarish 3 | baza **47 634.4218** = Billz; API 47 634.42; `farqSoni:0` |
| Chiqarish 4 (qoldiq) | tugagan 17 (+26), yo'qotish 69.64 $/kun, muddat bazadan |
| `tekshir` (server, ishchi nusxa) | yangi 6 tekshiruv ✓; bitta ✗ — hamyon minusda (16.5 dagi holat, kassa masalasi) |
| Billz 500 | 01:07 da `/v1/debt` va `/v2/products` bir marta "server error" — keyingi yurishda o'tdi; jurnalga tushdi |

---

## 18. 2026-09-03 — Rahbarning 7 bandi: xodim saqlashi, qarz davri, qoldiq, arxiv, xarajat turlari, minus

Rahbar yetti band berdi: (1) Qarzdorlikda davr bo'yicha hamma ustun;
(2) Qoldiq salomatligi ustunlari tushunarsiz, skladdan transfer
ko'rinmaydi, "Barcha filiallar"da yig'indi; (3) eski tovarni o'chirish;
(4) xarajat turini qo'shish/o'chirish; (5) "−" ishorali sonlar nega;
(6) rahbar hisobida hamma narsa sozlanadigan bo'lsin; (7) xodim
hisobida bir nechta joyda saqlash ishlamaydi. Reja
`~/.claude/plans/1-qarzdorlik-…md` da; ijro 6 chiqarishda.

### 18.1. Muhit: Desktop yopilib qoldi, ish klondan ketdi

Sessiya o'rtasida macOS `~/Desktop` ga o'qish ruxsatini qaytarib oldi
(`ls ~/Desktop` → Operation not permitted; Documents/Downloads ochiq).
Repo GitHub'dan (`master` = Desktop nusxasi, `6fad52b`) scratchpad'ga
klon qilindi va hamma ish o'sha yerdan: `chiqar.sh`, `sql.mjs`,
`tekshir-uzoq.sh` — uchalasi ham `~/.ssh/nspos` orqali serverga boradi,
`.env` yuborilmaydi. **Desktop nusxasi `git pull` bilan tenglashtiriladi.**

> Qoida: ish papkasi bitta emas — repo. Lokal `.env.local` faqat
> `npm run billz` va `tekshir` (lokal) uchun; serverda `.env.production`.

### 18.2. Xodim hisobida "saqlash ishlamayapti" — 14 jim nosozlik

O'lchov (agent, RLS matritsasi + yozuv yo'llari):

| Sabab | Qayerda |
|---|---|
| `remove()` `.select()` siz → RLS rad etgan o'chirish 204, `ok:true` | tovar, menejerning kechagi/doimiy xarajati, NPS, approved kassa yozuvi — ekrandan yo'qolib F5 da qaytardi |
| `silent=true` + localStorage | KPI kun/reja/tur, NPS, kompaniya sozlamasi — rad bo'lsa ham "saqlangan" |
| Siyosat YO'Q | `customers` insert/update (rahbar ham!), `stock` insert |
| `cash_operations.store_id = null` → `can_see_store(NULL)` false | qarz to'lovi, balans, ta'minotchi to'lovi — do'koni bor xodimga rad |
| Bola jadval `delete` keyin `insert`, xato tekshirilmaydi | xizmat ishlari, ombor qatorlari, partiya — rad bo'lsa eski qatorlar YO'QOLADI |
| Vaqtinchalik id bilan bola qatorlar | yangi buyurtma/partiya qatorlari uuid emas → jim rad |
| Menejer `store_id=NULL` | xarajat siyosati `kassa = auth_store_id()` — hech narsa yozolmaydi |
| Usta o'z buyurtma holatini o'zgartira olmasdi | `service_write` faqat owner/manager |
| `perms.sections` rolni KENGAYTIRARDI | owner-only bo'lim menejerga ochilsa sahifa ochiladi, yozuv rad |
| Token modul yuklanganda bir marta | sessiya yangilansa eski token bilan (13.4 qoldig'i) |

Yechim (kommitlar `bd3cb4f`, `fb60d80`):
- `lib/db.js`: `remove()` `.select("id")`, nol qator = xato; xato matni
  xodim tiliga (`xatoMatni`); token har so'rovda; `onXotira` —
  orqaga qaytganda ekran qayta chiziladi.
- `lib/sync.js`: baza tasdiqlagan holat (`tasdiq`) — rad bo'lsa xotira
  o'shanga qaytadi; `bolaQatorlar` — avval insert, keyin delete.
- KPI/NPS/kompaniya: `silent` yo'q, localStorage faqat tasdiqdan keyin.
- `scripts/sql/huquq-2026-09.sql`: customers/stock/products with check/
  nps (kassir ham)/debt_payments va cash_operations rol bilan/
  `service_status_set()` RPC.
- **`npm run huquq`** (`scripts/huquq-sinov.mjs`): har rol uchun serverda
  `app.user_id` + `set local role nspos_app` bilan 27 amal, rollback;
  natija `lib/auth.js` PERMISSIONS bilan solishtiriladi. Migratsiyadan
  oldin 10 farq (customers/stock YOPIQ, cash/debt ustaga OCHIQ), keyin 0.

> Qoida: RLS = PERMISSIONS. Siyosat o'zgarsa `npm run huquq`. Bazada
> `cashier`/`storekeeper` rolida xodim yo'q — matritsa ularni sinamaydi
> (ochiq ish: sinov uchun vaqtinchalik profil).

### 18.3. Qarzdorlik — davr va snapshot bir jadvalda

"Jami qarzdorlik" Billz "Jami qarz" (17-bo'lim) — hozirgi holat, davr
unga tegmaydi. Shuning uchun jadvalda ikki tur ustun ALOHIDA
nomlanadi: oqim (Davrda berilgan / to'langan / ochilgan / yopilgan) va
snapshot ("Hozirgi qarzi · hozir", "Eng eski"). `debtsData.debtorRowsDavr`,
`paymentsInRange` — `debtCollections` bilan bitta filtr. `moslik`
`qarz-jadval`: jadval jamisi (xom yig'indi) = kartochka. Menyu:
"Qarz to'lovlari" → "Qarzdorlik". Hisobotlar → Qarzdorlar ham davr.

### 18.4. Qoldiq salomatligi va Billz transferlari

- "Barcha do'konlar" allaqachon yig'indi edi (`totalQty`, Sklad ham) —
  ko'rinmasdi. Endi katak ostida bo'linma (Optim 3 · Namangan 0 · Sklad 12).
- Filial tanlanganda "Skladda" ustuni; tugagan-u Skladda bor tovar —
  "ko'chirish N (+ buyurtma M)"; kartochka "Skladdan ko'chirish kerak".
- Har ustunda ⓘ izoh (`DataTable` `hint`).
- **Billz transfer API:** `--probe --transfer` (12 nomzod): `/v2/transfer`
  BOR (2 063 yozuv), sarlavha: kimdan-kimga, dona (yuborilgan/qabul),
  tannarx/sotuv summasi, kim, qachon. Sana filtri yo'q (`start_date`
  400), `/v2/transfer/{id}` sarlavhani qaytaradi, `transfer_items` doim
  null; `transfer-item`, `/items`, `/products` — 404. Yangi
  `stock_transfers` jadvali, `billzSync.syncTransfers` (inkremental:
  sahifa eskicha bo'lsa to'xtaydi), hisobotda "Transferlar — oxirgi 30
  kun" yo'nalish bo'yicha.

### 18.5. Tovar arxivi — o'chirish emas

`products.archived_at/archived_by` (NSPOS'niki) va `is_active`
(Billz'niki: to'liq katalogda Billz ro'yxatida yo'q tovar `false`,
qo'riqchi — kelgan soni bazadagining yarmidan kam bo'lsa tegilmaydi).
`listProducts()` faqat faol, `allProducts()` id bo'yicha qidiruv (chek
qatori, balans qoldiq qiymati — arxivlangan tovarning puli yotibdi).
`removeProduct` olib tashlandi. Tovarlar → "Arxiv" tabi.

### 18.6. Xarajat turlari jadvaldan

`expense_categories` (seed = kodda turgan 20 + 2 eskirgan). RLS: yozish
rahbar, o'chirish faqat ishlatilmagan tur. `EXPENSE_CATEGORIES` obyekti
JONLI — o'rni almashmaydi, jadval kelganda ichi to'ldiriladi
(`demoCategories` naqshi), 6 iste'molchi o'zgarmadi. `db.js` CRITICAL.
Sozlamalar → "Xarajat turlari".

### 18.7. "−" ishora — javob

Minus haqiqiy holatni bildiradi: kassa hamyoni minusda (16.5: Optim
naqd −3 509 $, Namangan −5 257 $, servis −3 803 $ — xarajat kun
yopilgandan keyin kiritilgan, kassa yuritish masalasi), KPI qoldiq
(avans), sof foyda (zarar), pul oqimi, reja qoldig'i, tovar foydasi
(zarar bilan sotilgan/qaytarish), xizmat qoldig'i, inventarizatsiya
kamomadi. Endi manfiy katak sababi bilan (`ui/Manfiy`, matnlar
`format.MANFIY_SABAB` da — bir sabab, bitta matn). Nomuvofiqliklar:
ombor operatsiyasida ASCII "-" (→ `foiz/son`), Balans strukturasida
`Math.abs` (manfiy aktiv musbat chiqardi), Qoldiq salomatligi Excelida
−1 (`value ?? -1`).

### 18.8. Ijro (03.09, 15:00–17:30)

| Guruh | Kommit | Natija |
|---|---|---|
| 1 Xodim saqlash (db/sync/silent/store_id) | `bd3cb4f` | 24 sahifa toza; `tekshir:server` — faqat avvalgi hamyon ✗ |
| 2 RLS + `npm run huquq` | `fb60d80` | migratsiya serverda; matritsa 0 farq |
| 3 Qarz davr + minus | `9376012` | `qarz-jadval` ✓ |
| 4 Arxiv + xizmat holati | `f437b63` | `products-arxiv.sql` serverda |
| 5 Qoldiq + transferlar | `147c11c` | `stock-transfers.sql` serverda; probe 12 nomzod |
| 6 Xarajat turlari | `b0369d9` | `expense-categories.sql` serverda; huquq ✓ |

### 18.9. Sozlamalar — rahbar hamma narsani sozlaydi (6-band, 17:30–19:00)

| Guruh | Kommit | Nima |
|---|---|---|
| 7.1 Biznes qoidalari | `f8e45ce` | `companies.sozlamalar` jsonb; `companyData.sozlama(yol, standart)` — o'qish chaqiruv vaqtida, kodda turgani standart. Usta pul kunlari, "shu oyga cheklovni ochish" (endi kodda emas), kam qoldiq chegarasi, sotuv oynasi, qarz/AR guruhlari, buyurtma muddati |
| 7.3 Do'konlar | `f2c1ab9` | `stores.code/billz_names`; bog'lash nom emas KOD bo'yicha — nom to'rt joyda kalit edi (storesData, kassaNomlari, billzMap, kassaData regex); `demoStores[0]/[2]` → `asosiyDokonId()/skladId()` |
| 7.4 Rollar va huquqlar | `f7bc64c` | `role_permissions` + `has_perm()` — `scripts/huquq-seed.mjs` PERMISSIONS dan SQL yozadi (qo'lda ko'chirilmaydi); 20 siyosat `has_perm('<kalit>')` ga; `auth.can()` bazadan (fallback PERMISSIONS); `perms.sections` faqat toraytiradi; `npm run huquq` kutilganini bazadan oladi — 0 farq |

Tegilmaganlar: profiles (rekursiya), companies, payouts, payroll,
store_plans, invites, audit_log, stores — owner-only.

**7.5 KPI qoidalari va keshbek (19:30).** `kpi.rules.<tur>` — Sozlamalar
→ "KPI qoidalari": qat'iy maosh, savdo pog'onalari, inkassatsiya/AKB/
NPS/reviziya/kech/dam/kombo bonuslari; `typeOf()` standart ustiga
sozlamani qo'yadi. Reja qatoriga muhrlangan qoida (`kpi_plan.data.
rules`) endi faqat STANDARTDAN FARQ QILGAN qismi bilan hisobga olinadi
(`tozaRules`) — aks holda sozlama eski oydan meros bo'lib kelaverardi.
`loyalty.tiers` — "Keshbek darajalari" (min $, foiz); `tierOf/nextTier/
cashbackPctFor` shundan.

`01-sxema.sql` ko'zgusi yangilandi — `sxema-olish.mjs` serverda,
`nspos` roli bilan, `/tmp/sxema` ga (`/opt/nspos/app` ga yozolmaydi,
`root` da esa psql roli yo'q); `pg` `name[]` ni massiv qilib beradi —
skript tuzatildi.

> Qoida: RLS siyosatida rol ro'yxati qotirilmaydi — `has_perm('kalit')`;
> kalit `lib/auth.js` PERMISSIONS da, matritsa `role_permissions` da,
> seed `npm run`… `scripts/huquq-seed.mjs`. PERMISSIONS o'zgarsa: seed
> → `sql.mjs` → `npm run huquq`.

### 18.10. Saytda xodim hisobi bilan sinov (03.09, 22:30–00:30)

Rahbar: "saytda xodim hisobi bilan tekshirib ko'r". Parol so'ralmadi —
`scripts/server/xodim-sinov.mjs` (`npm run xodim -- --rol=manager`)
JWT'ni serverdagi sir bilan imzolab, menejer (Abduvahid, Optim) va usta
(Tohir aka) sifatida ikki qism sinaydi: (1) o'sha token bilan PostgREST
orqali HAQIQIY yozuv → darrov o'chirish, ruxsatsiz yozuv 42501 bilan rad;
(2) sahifalar Chrome'da — konsol xatosi, 4xx/5xx, /login, banner,
skrinshot. Qo'shimcha `NSPOS_UI_KPI=1`: /kpi da bugungi "Dam"
katakchasini bosib → F5 → turibdi → qaytarish (UI yozuv yo'li).

| Kim | Natija |
|---|---|
| Menejer | 28/28 ✓ — KPI kuni (o'ziga, rahbarga), xarajat (o'z kassasi, bugun), kassa kirimi, NPS, qarz to'lovi jurnali yozildi va o'chirildi; kompaniya balansi xarajati, payouts, xarajat turi — 42501 rad; mijoz/tovar yangilash 1 qator. 14 sahifa xatosiz. UI: "Dam" false→true F5 dan keyin turdi, qaytarildi |
| Usta | 17/17 ✓ — faqat o'z KPI kuni yoziladi, qolgan 8 yozuv rad; mijoz/tovar yangilash 0 qator (RLS jim toraytiradi, xato emas) |

Topilgani (hammasi tuzatildi, kommit shu bo'limdan keyin):

1. **Kassa sahifasi yuklanish paytida yolg'on.** Og'ir jadvallar
   (chek 9 637, qarz 11 752, mijoz 9 196) tarmoqqa qarab 15–60 s keladi.
   Shu paytda rahbar ham, menejer ham "Optim naqd minusda −61 367 $,
   Payme −15 358 $" va 6 ta "nomuvofiqlik" ko'radi; to'liq kelgach
   Optim 14 452.45 $ (serverdagi `tekshir:server` bilan tiyinigacha
   teng). Banner faqat KPI va bosh sahifada edi. Endi
   `components/YuklanmoqdaBanner.jsx` ilova qobig'ida (`app/(app)/
   layout.jsx`) — har sahifada bitta; kassa `Warnings` `useToliq()`
   bilan to'liq kelguncha ko'rsatilmaydi. KPI'dagi alohida banner olib
   tashlandi.
2. **/finance → "Billz'dan yuklash" kartasi** `/finance/import` ga
   olib borardi — sahifa `151a7e1` da o'chirilgan, katalog bo'sh, 404.
   Karta olib tashlandi.
3. **"−0 so'm"** — menejerning Xarajatlar jadvalida Jami "−0 so'm"
   (−0.004 yaxlitlanib 0, `v < 0` hamon rost). `format.belgi` endi
   ko'rinadigan raqamda 1–9 bo'lmasa minus qo'ymaydi.

O'lchov usuli (keyingi safar): `NSPOS_REST=1` har PostgREST so'rovini
range/hajm/vaqt bilan yozadi — rahbarda `sales` 2 sahifa (1 327 KB +
1 306 KB, 17–25 s), `debts` 3 sahifa; `[db] yuklandi:` konsoli qatorlar
sonini beradi. Tarmoq almashsa (`ERR_NETWORK_CHANGED`) o'lchov yaroqsiz.

Kutilgan, xato emas: menejer Abduvahid `/products`, `/clients`,
`/services`, `/nps`, `/finance/debts` ga kirolmaydi — rahbar
`perms.sections` da yopgan (`/kpi` ga qaytaradi); usta `/services` ni
ko'rmaydi (`service.view` yo'q, o'z ishini KPI'da ko'radi); Sozlamalardagi
"Standartga qaytarish" faqat ko'rinish (tema) — biznes sozlamasi emas.


## 19. 2026-09-03/04 — `feedbacklar/` papkasi: to'rt masala, to'rttasi ham jim

Rahbar Desktop'ga `feedbacklar/` papkasini tashladi: 7 skrinshot va
7 ovozli xabar. Ovozli xabarlar o'zbekcha, transkripsiya Whisper
large-v3 bilan qilindi (sifat past — 74 soniyalik xabar birinchi
urinishda butunlay takrorlanish halqasiga tushdi: `Қазыр, Қазыр…`.
`condition_on_previous_text=False` + `repetition_penalty` + 15
soniyalik bo'laklar bilan o'qildi. **Fayl jim emas edi** — u hatto
yaxshi o'qilganidan balandroq: −17.8 dB ↔ −28.4 dB. Ya'ni "eshitilmadi"
degan xulosa noto'g'ri bo'lardi.)

Papkada **bitta emas, to'rtta** alohida masala chiqdi. Umumiy ip:
**hech biri xato bermaydi.**

### 19.1 Usta boshqa ustaning kamerasini ko'rmaydi

Fidbek (Mirjalol, 16:38): "ustlar bir-birlarini nechta dona
o'rnatganini ko'rishi kerak / va nps ko'rinishi kerak / qolgan davomat
va oyliklar ko'rinmasin". Sobitxon aka (18:21): "Faqat shu
ko'rsatgichlar korinsin shtuk va NPS".

Sabab siyosatda: `kpi_day_rw` → `has_perm('kpi.manage') OR staff_id =
auth.uid()`, `installer` da `kpi.manage = false`. PostgREST ruxsat
yo'qligini xato bilan emas **bo'sh ro'yxat** bilan bildiradi, ya'ni
ekranda ishonarli **0** turadi.

O'lchandi (usta Abbosxon hisobi bilan, `set local role nspos_app`):

| So'rov | Usta | Kamera |
|---|---|---|
| xom `kpi_day` (RLS orqali) | 1 | 12 |
| yangi `installer_cameras` | 9 | 88 |

**Nega siyosat kengaytirilmadi:** RLS USTUNNI yashira olmaydi. `kpi_day`
qatori ochilsa `data.olgan` (usta olgan pul) ham ochiladi, `nps_records`
ochilsa mijoz ismi va telefoni ochiladi. Shuning uchun `staff_directory`
naqshi takrorlandi — `security definer` ko'rinish RLS ni chetlab
o'tadi, lekin o'zi kompaniya bo'yicha filtrlaydi va ortiqcha ustunni
umuman bermaydi (`scripts/sql/usta-reyting.sql`). **Ya'ni "faqat shtuk
va NPS" cheklovi interfeysda emas, bazada:** usta brauzer konsolidan
so'rov yozsa ham oylikni ko'rmaydi.

Interfeysda `showAttendance` — `showSalary` dan ALOHIDA bayroq. Davomat
va pul ikki xil ma'no; birini ikkinchisiga yopishtirsak keyingi safar
ajratib bo'lmasdi.

Yon topilma: NPS ustuni **rahbarda ham** "—" turardi. Kod xatosi emas —
butun bazada 1 ta baho bor edi, u ham iyulniki. `audit.js` → `MANBALAR`
ga `nps` qo'shildi (ODAM kiritmagani, `bloklamaydi: true`).

### 19.2 "Ombor analizi" Hisobotlardan yo'qolgan

Fidbek: "Ombor analizi degan bo'lim bor edi-ku, ko'rolmadim… o'rniga
Qoldiq salomatligi chiqib qopti… iloji bo'lsa bugun-ertaga ishlab
bering" (zakaz juma kuni berilishi kerak edi).

`reports/page.jsx` faqat `bazadan: true` ni chizadi. `lib/analyses.js`
da 15 ta tahlil, `bazadan` esa 5 tasida — qolgani 24.08 da Excel
yuklash bilan birga oqimdan chiqib ketgan. **Hisoblagichning O'ZI esa
o'sha kundan beri bazadan ishlaydi** (`analytics.stockCoverage`, 43-qator).
Ya'ni ma'lumot bor edi, unga eshik yo'q edi.

`stock_coverage` → `bazadan: true`, `components/StockReport.jsx` Excel
tahlilidan `stockCoverage()` ga o'tkazildi (`DataTable` ustida: sarlavha
pin, chap ustun pin, Jami, Ustunlar, Excel — hammasi o'zi).

`reorder` ("Buyurtma taklifi") ATAYLAB alohida karta qilinmadi: uning
ro'yxati "Qoldiq salomatligi" ichida allaqachon bor (`StockHealthReport`
→ `reorderList`). Ikkinchi karta bir xil raqamni ikki joyda ko'rsatib,
ular ertami-kechmi bir-biriga qarshi chiqardi.

### 19.3 Billz ↔ NSPOS savdo farqi — sinxron kechikishi

Fidbek: "Namanganda 2 099.64 turibdi, bunda 2 067 turibdi, bu ham
noto'g'ri" va naqd 675 ↔ Billz 665.

Skrinshot 03.09 soat 09:27–09:28 da olingan. O'lchandi:

| Namangan cheklari | birinchi yozilgan | oxirgi yangilangan |
|---|---|---|
| 01.09 sotilgan | 01.09 11:30 | 02.09 11:30 |
| 02.09 sotilgan | 02.09 11:30 | **03.09 10:00** |

Ya'ni skrinshot olingan payt 02.09 ma'lumoti hali yangilanmagan edi.
Sabab: inkremental sinxron `lastCursor` dan boshlanadi
(`billzSync.js:1245`), ya'ni **Billz'da keyin tuzatilgan eski chek
qayta o'qilmaydi** — u faqat to'liq yurishda tuzatiladi.

Buni o'lchaydigan tekshiruv YO'Q edi: `moslikTekshir` tovar sonini,
mijoz sonini, ochiq qarzni va oxirgi 7 kun cheklarini **id bo'yicha
(bor/yo'q)** solishtirardi. Chek bazada bor-u noto'g'ri summa bilan
yozilgan bo'lsa — jim o'tardi.

Qo'shildi: **do'kon × kun kesimida savdo summasi** (oxirgi 7 kun,
chegara 0.02 $, o'sha aylanishning ichida — Billz sekundiga 2 so'rov
beradi). Har farqli kun `billz-farq` auditiga alohida qator bo'lib
tushadi. Sinxron oynasini kengaytirish TASHXISDAN KEYIN — avval
tekshiruv qanchalik tez-tez qizarishini o'lchasin.

### 19.4 Usta puli noto'g'ri kassadan chiqardi — xarajat bloklangan

74 soniyalik xabar (mazmuni rahbar bilan tasdiqlangan): ustalarga
berilgan pul Ustalar reytingida yoziladi, xarajatga tushmaydi. Tizim
uni do'kon kassasidan hisoblaydi. Aslida u kompaniya balansidagi servis
kassasidan chiqishi kerak. **Servis kassada pul qolmaydi — har kuni nol
qilib topshiriladi. Nol kassadan xarajat qilinsa minusga tushadi va
tizim "kassa minusda" deb yangi xarajatni umuman rad etadi.**

Skrinshot tasdiqladi: Namangan kassasi −5 735.63 $, shundan Servis
−3 387.29 $, va 6 kun "Servis … minusda".

Kodda: `expensesData.installerPayouts()` → `kassa: st.storeId ||
svcStore || "company"`. Ustaning `store_id` i NULL (11 tasida ham),
shuning uchun `serviceStore()` — servis kirimi bor do'kon — olinardi.

O'lchandi (01.08 dan):

| | $ |
|---|---|
| Servis kirimi (Namangan) | 10 165.50 |
| Kompaniyaga topshirilgani (approved transfer) | 7 082.76 |
| Usta puli (63 551 500 so'm ÷ 11 840) | 5 367.53 |

Do'kon hamyoni −2 284.79 → **+3 082.74**, kompaniya +7 082.76 →
**+1 715.23**. Ikkalasi ham musbat: minus boshqa kassaga KO'CHMAYDI.
Buni oldindan o'lchamasdan o'zgartirish xavfli edi.

**FAQAT HAMYON o'zgardi.** `storeId` o'z joyida qoldi, ya'ni do'kon
kesimi (`expensesByStore`) va "Oylik maoshlar" ustuni (18-bo'lim, DAFTAR
68: `category === "salary" && method === "service"` → `r.salary`)
avvalgidek. Qiymat `companies.sozlamalar` orqali
(`sozlama("kpi.ustaKassa", "company")`) — kodda qotirilmagan.

### Qo'shilgan tekshiruvlar

| id | nima |
|---|---|
| `usta-puli` (moslik) | usta puli bitta hamyondan chiqadimi va "Oylik maoshlar"ga tengmi |
| `usta-kamera` (moslik) | `installer_cameras` ko'rinishi = `computeMonth().cameras` |
| `stale-nps` (audit) | NPS baholari kiritilib turibdimi (7/14 kun) |
| `billz-farq` (audit) | endi do'kon × kun savdo summasini ham qamraydi |

### 19.5 Yangi tekshiruvlarning birinchi yurishi — ikkalasi ham o'zini tuzatdi

Tekshiruvlar chiqarilgandan keyingi BIRINCHI yurishda ikkitasi qizardi.
Ikkalasi ham kod xatosi emas, **tekshiruvning o'zidagi xato** edi —
shuning uchun ular shu yerda yozib qo'yiladi:

1. **`usta-puli`:** "yozuvlarda 5 367.54 $, Oylik maoshlar ustunida
   5 880.20 $". Farq 512.66 $ — bu qo'lda kiritilgan **14 ta servis
   oyligi** (`expenses`, `category='salary'`, `method='service'`,
   Namangan kassasi). `kassaData` ustunga `category === "salary" &&
   method === "service"` shartidagi HAR yozuvni qo'shadi, faqat usta
   pulini emas. Tekshiruv shu shartga tenglashtirildi.

2. **`billz-farq` → savdo:** "27.08: Billz 3 256.18, bu yerda 0" (ikkala
   do'kon uchun ham). 27.08 — 7 kunlik oynaning CHEGARA kuni: Billz KUN
   bo'yicha filtrlaydi (`fmtBillzDay`), baza esa aniq VAQT bo'yicha
   (`gte sold_at`). Bir tomonda kun to'liq, ikkinchisida yarim. Chegara
   bir kun ichkariga surildi.

**Qoida:** yangi tekshiruv qo'yishdan oldin uning HAQIQIY bazada nechta
qator ustida qizarishini o'lchang (CLAUDE.md 2026-08-24) — bu safar
o'lchov chiqarishdan keyin bo'ldi va ikkala qizarish ham soxta chiqdi.

Tuzatilgandan keyingi holat: "Hech bir hamyon manfiy emas" da **Servis
minusda yo'q** (avval −3 246.61 $), `usta-kamera` va `usta-puli` yashil,
`stale-nps` esa haqiqiy narsani aytmoqda: "NPS baholari 35 kundan beri
kiritilmagan, oxirgi yozuv 2026-07-31".

### 19.6 "Buyurtma taklifi" alohida karta bo'ldi (rahbar qarori, 2026-09-04)

19.2 da bu ATAYLAB qilinmagan edi: ro'yxat "Qoldiq salomatligi" ichida
allaqachon bor edi va ikkinchi karta bir xil raqamni ikki joyda
ko'rsatib, ular ertami-kechmi bir-biriga qarshi chiqishi mumkin edi.
Rahbar qarori boshqacha: zakaz juma kuni beriladi, uni bo'lim ichidan
qidirib o'tirmaslik kerak.

Xavf boshqa yo'l bilan yopildi: ro'yxat NUSXALANMADI, balki
`components/ReorderPanel.jsx` ga ajratildi. Endi ikkala joy ham AYNAN
o'sha komponentni va `analytics.reorderList()` ni chaqiradi —
"bir tushuncha, bitta funksiya" buzilmaydi, faqat KIRISH nuqtasi
ikkita bo'ldi.

Yo'l-yo'lakay: `StockHealthReport` da ajratishdan keyin `reorderList()`
va `transferSummary()` chaqiruvlari qolib ketgan edi (endi ular
`ReorderPanel` ichida ham bor) — ya'ni og'ir hisob sahifada IKKI marta
yurardi. Ishlatilmay qolgan holat va importlar tozalandi. `npm run
nomlar` bunday "ishlatilmayotgan, lekin aniqlangan" o'zgaruvchini
ushlamaydi: u faqat aniqlanmagan nomni tekshiradi.

### 19.7 Ombor qoplamasi filtrlari (2026-09-04)

Foydalanuvchi so'rovi: "Ombor qoplamasiga filtr qo'shish". Panel
allaqachon bor edi (Kategoriya, Holat, Qoldiq, Necha kunga yetadi) —
to'rt yo'nalishda kengaytirildi. Bazada o'lchandi: 656 faol tovardan
538 tasida brend (34 xil), 114 tasida ta'minotchi (2 xil).

**Ikki xil narsa ikki joyda.** Do'kon — HISOB PARAMETRI: qoldiq va
sotuv shu do'konlar bo'yicha yig'iladi (`stockCoverage`). U kartochkalar
tepasida turadi, endi bir nechta tanlanadi (`MultiSelect`, `storeIds`).
Panel ichidagilar — tayyor qatorlarni saralaydigan FILTR. Holat esa
sanoqli tab bo'ldi va paneldagi "Holat" select OLINDI: bir o'lchov uchun
ikki boshqaruv bo'lsa, biri "Kritik", ikkinchisi "Kam" turib jadval bo'sh
qoladi va sababi ko'rinmaydi.

**`stockCoverage({ storeIds })`** — `storeId` bilan yonma-yon, orqaga
mos: `tanlangan = storeIds ?? (storeId === "all" ? null : [storeId])`.
`reorderList`, o'lik qoldiq, `managementData` o'z holicha. Qoldiq —
tanlangan do'konlar yig'indisi; "Skladda" ustuni tanlovda Sklad
BO'LMAGANDAGINA (bo'lsa u allaqachon yig'indida). Komponentdagi
`filial` bayrog'i endi qatorlardan (`skladda != null`) — Sklad qoidasi
ikki joyda takrorlanmaydi.

**`FilterBar` `type: "multi"`** — umumiy: `MultiSelect` `<label>`
O'RAMASIZ chiziladi (aks holda sarlavha bosilganda popover ochiladi va
checkbox label'lari ichma-ich bo'ladi). `applyFilters` `v.some(...)`.
CLAUDE.md 2026-09-02 qoidasi ("yo'qolgan tanlov o'zi tozalanadi")
Xarajatlar sahifasidagi lokal `useEffect` dan `FilterBar` ichiga
ko'chdi — `select` va `multi` uchun, `String()` bilan solishtirib
(boshqa hisobotlarda variant qiymati aralash turda). O'zgarish bo'lsa
`setDraft` + `onChange` BIRGA: `draft` faqat panel ochilganda
sinxronlanadi, busiz ochiq panel eskisini ko'rsatib turardi. Hech narsa
o'zgarmasa `onChange` chaqirilmaydi — halqa yo'q. Ombor qoplamasida bu
effekt asosan arxivlash uchun: variantlar `listProducts()` dan, do'konga
bog'liq emas.

**Ma'no qarorlari.** `idleDays` filtri: hech sotilmagan tovar
`Infinity` — "90 dan" ichiga TUSHADI (u eng o'lik qoldiq), "10 gacha"
ga tushmaydi. `oyna` filtri: sotuvsiz qatorda `oyna` uzun oyna bo'lib
turadi (analytics), u "zaxira" EMAS — `null` qaytariladi, ikkala
variantga ham tushmaydi. "Qoldiq qiymati" filtri USTUN formulasida
(tannarx: katalog → chek → noma'lum), `stockCoverage.stockValue` (faqat
katalog) emas — aks holda filtr bir raqamni, ustun boshqasini ko'rsatardi.
Bo'sh brend/ta'minotchi "Brendsiz" / "Yetkazib beruvchisiz" variant —
aks holda 118 brendsiz tovarni ajratib bo'lmasdi. Tab sanoqlari qidiruv
+ panel filtridan KEYIN (tab o'lchovidan tashqari) — har sanoq o'sha tab
bosilganda ko'rinadigan songa teng, kartochka va Jami bilan mos.

**Tekshiruv kodda:** `lib/moslik.js` → `ombor-dokon` — hamma do'kon
tanlanganda yig'indi har do'konning alohida raqamiga va "Barchasi"ga
teng; ikki filial tanlanganda "Skladda" = Sklad qoldig'i, Sklad
tanlovda bo'lsa ustun yo'q. Ilovaning o'z `stockCoverage` funksiyasi
bilan (formula qayta yozilmaydi), `npm run tekshir:server` da va
"Tekshirib ko'ring" kartochkasida. Kompyuterda baza yo'q — shuning
uchun sinov chiqarishdan KEYIN serverda yurdi, brauzer sinovi
`npm run xodim -- --rol=owner --faqat-sahifa` bilan.

**O'lchov (2026-09-04, saytda, rahbar hisobi):** `xodim-sinov` ga
`NSPOS_BOS="Filtrlar;;Tugagan;;NScamera Optim"` nuqtasi qo'shildi —
matni shu bilan boshlanadigan tugma/yorliqni ketma-ket bosadi, so'ng
`NSPOS_MATN` o'lchanadi (ilgari faqat ochilgan sahifa o'lchanardi,
panel/tab/ko'p tanlov sinalmasdi). Natija:
- Optim + Namangan: JAMI 33 329 = 13 539 + 19 790 (SQL `stock`), "Skladda"
  ustuni chiqdi, jamisi 254 270 = Sklad qoldig'i; tablar 47+17+52+244+295 = 655.
- "Tugagan" tabi: kartochka 45 = tab 45 = JAMI 45 ta.
- Kategoriya = Camera: Filtrlar 1, Tovar 201 = SQL 201; tablar 18+6+9+86+82 = 201.
- Barcha do'konlar: JAMI 287 599 = 13 539 + 19 790 + 254 270.
Konsol xatosi yo'q; `tekshir:server` → `ombor-dokon` ✓.

---

## 20. 2026-09-04/05 — Moliya auditi: "Billz'da boshqacha, tizimda boshqacha"

Rahbar: "doimiy bir muammo — Billz'da boshqacha, tizimda boshqacha; bu safar
dasturchi emas, auditor/moliyachi sifatida tahlil qil". Tahlil VPS bazasidan
faqat o'qib olingan ~60 SQL o'lchovi (endi `scripts/sql/audit-olchov.sql`,
`npm run audit:olchov`) va ekran raqamini ilovaning O'Z funksiyalari bilan
o'lchaydigan `scripts/olchov.mjs` (`npm run olchov:server`) bilan qilindi.
Reja: `~/.claude/plans/doimiy-bir-muammo-bo-lmoqda-velvet-torvalds.md`.

### 20.1 Xulosa — sodda tilda

Ko'zgu MOS edi (04.09 23:05: tovar 656=656, mijoz 5 021=5 021, qarz
53 292.41 $ = Billz, 7 kun chek 356/356, do'kon×kun savdo farqi 0). Muammo
"Billz'dan noto'g'ri olish" emas — **Billz raqamiga tizim qo'ygan ma'no**
va **Billz'da umuman yo'q oqimlar**. Uch ildiz:

1. Bitta tushuncha bir necha joyda bir necha xil hisoblanardi (savdo 8,
   tannarx 3, qarz yoshi 2, servis puli 4 ta'rif).
2. Billz'dagi ba'zi yorliqlar moliyaviy ma'nosiz, tizim ularni haqiqat deb
   ko'rsatardi: qarz muddati deyarli har doim **1 kun** (1 621/1 643) →
   "muddati o'tgan" 393/410; montaj tovarining tannarxi **5 $** — usta puli
   emas, taxmin.
3. Billz'da bo'lmagan oqimlar tizimda ham yo'q: tovar xaridi, spisanie,
   inventarizatsiya, ta'minotchi qarzi, rahbar kapitali.

**Falsafa (CLAUDE.md ga kirdi):** uch qatlam — KO'ZGU (Billz aynan),
DAFTAR (faqat NSPOS'dagi pul harakati), HISOBOT (P&L, Pul oqimi, Balans,
Qarz yoshi — har qatorda manba yorlig'i); har raqamning uch xossasi
(manba, ta'rif, vaqt); Billz yorlig'i ≠ moliyaviy ma'no; oy yopish
marosimi; foyda ≠ pul — ko'prik ko'rsatiladi, farq yashirilmaydi.

### 20.2 Biznes profili — avgust 2026 (bazadan)

| | Optim (B2B) | Namangan (B2C+montaj) | Jami |
|---|---:|---:|---:|
| Savdo | 88 071 $ | 59 018 $ | 147 089 $ |
| Nasiya ulushi | **88.5 %** | 14.5 % | 58.8 % |
| Qaytarish | −12 888 $ (**14.6 %**) | −2 712 $ (4.6 %) | −15 600 $ (10.6 %) |
| Marja (tannarx to'g'rilangach) | 18.6 % | 46.6 % | 31.0 % |

Pul tushumi 144 609 $; ochiq qarz 53 292 $ (124 mijoz, top‑10 = 43.6 %,
DSO 18 kun); OPEX ≈ 14 400 $; tovar uchun to'lov 37 594 $ (tannarx ~91 000 $);
ombor tannarxda 260 535 $; `service_orders`, `warehouse_operations`,
`supplier_invoices`, `payroll_payments`, `cash_operations` — BO'SH edi.

### 20.3 Topilmalar va nima qilindi (bosqichma-bosqich, har biri chiqarilgan va o'lchangan)

| # | Topilma | Dalil | Qilindi |
|---|---|---|---|
| A | Montaj tannarxi IKKI marta chegirilar edi | Billz montaj `cost_price` 5 $ → avgust 1 013 × 5 = **5 065 $** COGS'da; usta puli (52.8 mln so'm) ish haqida yana | `salesData.qatorTannarx` — bitta qoida (xizmat 0, qator, katalog, noma'lum **null**); P&L, rahbariyat, tovar foydasi shundan. Sof foyda 22 178.57 → **27 243.57** (+5 065.00, aynan) |
| B | "Muddati o'tgan" Billz'da ma'nosiz | muddat 1 kun; overdue 393 / unpaid 17 | Yosh **berilgan sanadan** (`qarzYoshiKun`), muddat rahbarniki (`debts.termDays`, standart + do'kon); `jamiQarz` → yosh guruhlari, shubhali (90+: 5 174 $/61), top‑10, DSO; Billz yorlig'i alohida. Natija: o'tgan 17 418 $ (158), kelmagan 35 874 $ (252) |
| C | "Nasiya" ikki ma'noda | 545 qarzdan 72 tasi (12 272 $) shu kuni yopilgan | KPI ustuni "Savdo − tushum"; `shuKuniYopilgan`, "Haqiqiy nasiya" kartasi |
| D | Qaytarish faqat izoh qatori | 10.6 % (Optim 14.6 %) | P&L: Yalpi savdo → Qaytarilgan (%) → Tovar sotuvi (sof) |
| E | Tovar xaridi tizimda yo'q | COGS ~91 000 $/oy, yozilgan to'lov 37 594 $; AP = 0 | Probe (05.09): `/v2/supplier-order` OCHIQ — kompaniyada **1 hujjat** (14.10.2025, 21 $): modul ishlatilmaydi. Ko'zgu `syncSupplierOrders` → `supplier_invoices` (AP Billz'dan, hozir 21 $). Audit `xarid-yozilmagan` (30 kun: 91 051 ↔ 37 594) |
| F | Spisanie/inventarizatsiya olinmaydi | `warehouse_operations` bo'sh | `/v2/write-off`, `/v1/order/cash-shifts` BOR, lekin API kalit roli huquqsiz (**403**) — Sozlamalar tashxisida ko'rinadi; inventarizatsiya/qayta narxlash endpointi topilmadi (45 nomzod, `scripts/billz-probe-xarid.mjs`) |
| G | Oylik/usta puli bugungi kursda suzardi | `getUsdRate()` har render'da | `ratesData.oyKursi` (oy oxirgi/o'rtacha, `kurs.oyQoidasi`); `kpi_day.olganKurs` kiritishda muhrlanadi |
| H | Ish haqi "yoki‑yoki"; berilgan bilan solishtirilmasdi | `kpiUsd > 0 ? kpiUsd : profil` | `payrollCost` — yig'indi; `berilganOylik` (xarajat + usta + kassa_ops); Ish haqi sahifasida Hisoblangan/Berilgan/Qoldiq; balans "to'lanmagan oylik" shundan |
| I | Karta/Click puli hech qaysi hamyonga tushmasdi | `card` → kassa yo'q | `card` → bank hamyoni ("Payme / karta") |
| K | Balans kapitali tiqin; NS hech qayerda | `equity = A − P` | `kapital` = boshlang'ich (`kapital.boshlangich`) + yig'ilgan foyda − NS; **izohlanmagan** qatori ochiq (hozir 386 096 $ — boshlang'ich kapital kiritilmagan); `oy_muhri` — oy yopish |
| L | Tannarx 0 → 100 % foyda | `\|\| 0` | null → "tannarxsiz" alohida (P&L qatori, balans ombor) |
| M | Ikki ta'rif | `v_open_debts`, `v_product_margin` eski formula | ilova ta'rifi bilan qayta yaratildi |
| O | Soliq zaxirasi yo'q | — | `soliq.foiz` (standart 0) → P&L qatori |
| R | "Foyda bor, pul yo'q" javobsiz | — | `foydaPulKoprigi`: avgust sof foyda 27 244 → nasiya −13 094 (qaytarish qarzdan ayrilgani hisobga olib) + tannarx 91 162 − tovar 37 594 − oylik farqi 910 = 92 996.05; haqiqiy 92 996.18; **izohlanmagan 0.13 $** |

### 20.4 O'lchov — avgust 2026, oldin ↔ keyin (`olchov:server`)

| | Oldin | Keyin |
|---|---:|---:|
| Tannarx | 96 227.21 | 91 162.21 |
| Yalpi foyda (marja) | 35 630.62 (27 %) | 40 695.62 (30.9 %) |
| Sof foyda | 22 178.57 | 27 243.57 |
| Qarz: muddati o'tgan | 48 917.69 (393, Billz) | 17 418.42 (158, 30 kun) |
| Balans passiv | 0 | 21 (Billz xarid) |
| Kapital | 414 665 (tiqin) | 28 549 + izohlanmagan 386 096 |

Tekshiruvlar: 30 moslik ✓, yangi 7 tasi (servis-tannarx, qarz-yosh,
koprik, balans-kapital, sale-sign xom, tannarxsiz-sotuv, xarid-yozilmagan,
oy-yopilmagan/oy-muhri) — birinchi yurishda haqiqiy narsa aytadi.

### 20.5 Rahbar qiladigan ishlar (tizim tayyor, ma'lumot kutilmoqda)

1. **Boshlang'ich kapital** — Sozlamalar → Biznes qoidalari → "Boshlang'ich
   kapital ($)": 01.08.2026 dagi kassa + tovar + qarz − majburiyat.
   Kiritilmaguncha balansda "izohlanmagan" ~386 000 $ turadi (bu xato emas,
   kiritilmagan raqam).
2. **Avgustni yopish** — Balans → "Oy muhri" → "2026-08 oyini yopish".
   Keyin `audit` `oy-yopilmagan` o'chadi; hisob o'zgarsa `oy-muhri` aytadi.
3. **Billz'da xaridni yuritish** — «Заказ поставщику / Приход». Ko'zgu
   tayyor: hujjat kirgan zahoti balansda ta'minotchi qarzi va ombor kirimi
   ko'rinadi. Ungacha `xarid-yozilmagan` sariq turadi.
4. ~~**Billz API kalitiga huquq**~~ — **BEKOR (24-bo'lim, 2026-09-06).**
   O'lchov ko'rsatdi: rol katakchalari integratsiya kalitiga umuman ta'sir
   qilmaydi (huquqi o'chiq «Поставщики» ochiq, huquqi yoqilgan «Списание»
   403). Rahbar kabinetda hech narsa qilmasligi kerak; yopiq metodlarni
   Billz'ning o'zidan so'rash kerak.
5. **Qarz muddati** — standart 30 kun; Optim/Namangan uchun alohida
   qo'yish mumkin (Sozlamalar).
6. **Soliq zaxirasi foizi** — hohlasa; 0 bo'lsa ko'rinmaydi.

### 20.6 Nima o'zgarmadi va nega

- Sof savdo `131 857.83` (ilova) ↔ SQL `132 084.19`: farq 226.36 $ —
  almashuv cheklarida Billz "discount" manfiy; ilova `ishorali` bilan
  o'qiydi. Kichik, alohida (N).
- Qarz to'lovi qaysi do'konda olingani (J) — Billz `debt.payments` matn
  qatori, do'kon yo'q; `cash-shifts` 403. Yorliq bilan qoldi.
- Ombor harakati tenglamasi (boshi + kirim − sotilgan − spisanie = oxiri) —
  xarid va spisanie kelguncha imkonsiz.

### 20.7 Yo'l-yo'lakay

- `v_open_debts` ustun qo'shilgani uchun `create or replace` o'tmadi —
  `drop view` + `create`.
- `supplier_invoices` upsert `on conflict (company_id, billz_id)` qisman
  unique indeksni ko'rmaydi — to'liq unique cheklov kerak (birinchi yurish
  yiqildi, jurnalda ko'rindi).
- `yuk.mjs` "ichma-ich jadval birortasida ham yo'q" tekshiruvi 1 ta xarid
  hujjati + 0 to'lovda soxta qizardi — endi bola jadvalda qator BOR-u
  yopishmasa xato. `oyMuhri` moduli skript yuklovchisiga qo'shildi (aks
  holda `oy-yopilmagan` doim qizil turardi — 13.2 kasali).
- Tekshiruvlar chiqarishdan keyin serverda yurgizildi (`tekshir:server`
  joylashgan kodni yurgizadi) — har bosqich: kommit → push → chiqar →
  tekshir → olchov.

## 21. 2026-09-05 — "Billz'dan nima noto'g'ri kelyapti?": javob — hech narsa

Rahbar: *"Billzdagi qaysi ma'lumotlar bilan ishlamoqchi edik, nimalar
qilishimiz kerak edi? Tizim ma'lumotni to'g'ri ko'rsatmoqdami, Billz'dan
olinganda nima noto'g'ri ko'rsatilmoqda?"*

Javob taxmin bilan emas, o'sha kuni haqiqiy VPS bazasi va Billz API'sidan
o'lchab berildi (`scripts/sql.mjs` faqat `select`, `npm run audit:olchov`,
`billz-sync.mjs --probe`, `npm run olchov:server -- --oy=2026-08`).

### 21.1 O'lchov: ko'zgu tiyinigacha mos

16:20 dagi farq detektori (`billz_sync_log`, `entity='moslik'`):

| | Billz | NSPOS |
|---|---:|---:|
| Tovar | 657 | 657 |
| Mijoz | 5 024 | 5 024 |
| Ochiq qarz (soni) | 407 | 407 |
| Ochiq qarz (summa) | 53 252.94 $ | 53 252.94 $ |
| 7 kun chek | 336 | yo'q: 0 |
| 7 kun savdo (do'kon × kun) | — | farqli: 0 (16 kun) |

Qo'shimcha: sentabrda tannarxsiz sotilgan qator 0, tannarxi 0 bo'lgan
qoldiqli tovar 0, `debts.source` da bitta ham `'nspos'` qolmagan
(11 122 `billz` + 659 `excel`; `excel` — iyuldagi surat, `listDebts()`
uni ataylab sanamaydi). Ya'ni **"Billz'dan noto'g'ri olinyapti" degan
muammo yo'q.** Muammo — Billz'da UMUMAN yo'q oqimlar, va ular rahbar
qadamini kutadi (20.5 dagi 4 band; hammasi 05.09 da ham ochiq edi:
kapital yo'q, `oy_muhri` bo'sh, xarid 1 hujjat, write-off/cash-shifts 403).

### 21.2 Topilgan uchta jim bo'shliq

| Nima | Dalil | Qilindi |
|---|---|---|
| **Bosh sahifada `BillzMuhr` yo'q edi** | muhr 9 sahifada bor, `dashboard` da yo'q — eng ko'p ochiladigan ekranda ma'lumot qachonligi ko'rinmasdi | `dashboard` (`entity="orders"`), `finance/pnl`, `finance/payables` (`entity="supplierOrders"`) ga qo'yildi |
| **O'lik `BillzCompare`** | `finance/pnl/page.jsx` da Excel eksportiga tayanadigan komponent; `tabs` da chaqirilmasdi | Olib tashlandi (sabab fayl ichida yozildi). `billzPnl`/`billzPnlTotals`/`billzCashflow` endi hech kim chaqirmaydi — keyingi tozalash |
| **NPS 36 kundan beri kiritilmagan** | oxirgi 2026-07-31 → `stale-nps` **error** | Kod ishi yo'q, tekshiruv allaqachon aytyapti; rahbarga bildirildi |

`BillzMuhr` ATAYLAB qo'yilmagan sahifalar: `finance/cost`,
`finance/expenses`, `finance/payroll`, `products/operations`, `services` —
ularning sarlavha raqami NSPOS'niki, Billz moduli faqat yon ma'lumot uchun.

### 21.3 Almashuv cheki (20.6 "N") — yopildi, lekin kod tegilmadi

O'lchov: avgustda 28 almashuv cheki, **28/28 da qatorlar yig'indisi
`subtotal` ga AYNAN teng** (farq 0.00); 8 tasida Billz `total` ishorasini
teskari beradi → 2 × 113.18 = **226.36 $**. Ya'ni `salesData.ishorali()`
bilan o'qilgan ekran raqami (131 857.83) TO'G'RI, xom SQL (132 084.19)
noto'g'ri.

Shuning uchun pul yo'liga tegilmadi. O'rniga `scripts/sql/audit-olchov.sql`
2-bo'limi ikkala qiymatni ham chiqaradi — `sof_savdo` (xom) va
`sof_savdo_ishorali` (ekran), farq `almashuv_ishora_farqi` — hamda
ishorasi teskari cheklar sanog'i. Xom SQL formulasi ILOVANIKIGA
ALMASHTIRILMADI: bu fayl ataylab xom bazani o'lchaydi va ikkalasi
bir-birini tekshiradi; endi farq har safar sababi bilan ko'rinadi va
"ekranda boshqacha" degan yolg'on shubha tug'dirmaydi.

### 21.4 Bot `/xulosa` to'ldirildi

Yetishmayotgani qo'shildi: **yalpi savdo**, **qaytarilgan (%)** va
**o'tgan oy yopilganmi**. Ikkalasi ham allaqachon hisoblangan raqam —
`pnlData` `revenue.gross`/`revenue.returnsPct` va `lib/oyMuhri.js`
(`otganOy`, `muhr`); API ularni chiqarmayotgan edi. `oyMuhri` moduli
`scripts/api/server.mjs` modullar ro'yxatiga qo'shildi.

`scripts/bot/format.mjs` da HISOB YOZILMADI (faylning bosh qoidasi) —
faqat matnga o'girish. "Oy yopilmagan" XATO ro'yxatiga qo'shilmadi: u
xato emas, bajarilmagan ish — alohida qatorda turadi va yopilgan
holatda ham ko'rinadi, aks holda "qator yo'q" bilan "tekshirilmadi"
bir xil bo'lib qolardi.

`/api/v1/savdo` ham `yalpi` va `qaytarish_foiz` oladi — `format.savdo()`
qaytarilgan summani foizi bilan ko'rsatadi.

### 21.5 O'lchov (avgust) — oldin ↔ keyin

Kutilgan farq **0.00**: hech bir pul formulasi o'zgarmadi (UI muhri,
o'lik kod, API'ga yangi maydon, o'lchov SQL'iga yangi ustun).

## 22. 2026-09-05 — Menejerlar so'rovi: yo'lkira tannarxga, ko'cha ustasi servisga

Rahbar orqali menejerlar ikki narsani so'rashdi:

1. **"Tovar keldi — yo'lkira, dostavka"** Xarajatlarga qo'shilsin. Mantiq:
   mahsulot 25 $ ga olinadi, Xitoydan kelishi bilan ~30 $ bo'ladi, shahar
   atrofida yetkazib berish yana +3 $.
2. **"Ko'cha ustasi — ustanovka"** qo'shilsin va **servisga** kirsin. Ikki
   holat: mijoz montaj puli to'lagan yoki montaj bepul berilgan.

Rahbar qarori: yo'lkira **tannarxga** qo'shilsin (oddiy xarajat qatori
bo'lib qolmasin); Pul rejasidagi `import` puliga **tegilmasin**.

### 22.1 Yechim: xarajat turining uchinchi xossasi

Ilgari tur ikki narsani aytardi — `group` (doimiy/o'zgaruvchan) va `service`.
Uchinchisi qo'shildi: **`cogs`** (`scripts/sql/expense-cogs.sql`).

`cogs = true` bo'lgan tur P&L da **OPEX dan chiqadi va tannarx ostida
alohida qator bo'ladi**. Sof foyda o'zgarmaydi — pul bir qatordan
ikkinchisiga ko'chadi, xolos; yalpi marja esa haqiqiy bo'ladi.

Nega tur darajasida, xarajat QATORI darajasida emas: tur allaqachon rahbar
Sozlamalardan yuritadigan yagona manba. Qatorga qo'yilsa menejer har safar
belgilashni unutadi va bir xil xarajat ikki xil joyga tushadi.

`cogs` va `service` **bir vaqtda bo'la olmaydi**: servis turini
`ServiceReport` xizmat tannarxiga, `cogs` ni P&L tovar tannarxiga qo'shadi —
ikkalasi yoqilsa bir pul ikki marta sanalardi. Cheklov bazada
(`expcat_cogs_service`), ikkinchi qulf `audit` → `kelish-service` (error),
interfeysda checkbox'lar o'zaro o'chadi.

**Turlar:** mavjud `delivery` → `cogs=true` (nomi "Dastavka — tovar
kelishi (yo'lkira)"); yangi `import_freight` ("Import yo'lkira (chegara,
Xitoy)"). `staff_travel` ATAYLAB tegilmadi — uning izohlari "uyiga yul
kira", "ishka bordi", ya'ni xodim qatnovi; tannarxga qo'shilsa marja soxta
pasayardi.

### 22.2 O'lchov — avgust 2026, oldin ↔ keyin

| | Oldin | Keyin |
|---|---:|---:|
| Sotilgan tovar tannarxi | 91 162.21 | 91 162.21 |
| ↳ tovar kelish xarajati | — | **228.70** |
| Yalpi foyda | 40 695.62 | **40 466.92** |
| marja | 30.9 % | **30.7 %** |
| OPEX | 6 092.67 | **5 863.97** |
| Jami xarajat | 13 452.05 | **13 223.35** |
| **SOF FOYDA** | 27 243.57 | **27 243.57 — ±0.00** |
| Ko'prik "izohlanmagan" | 0.13 | **0.13** |

Yangi ko'rsatkich: **kelish ulushi 0.25 %** — "25 $ tovar aslida 25.06 $".

### 22.3 Eng nozik joy: Foyda → Pul ko'prigi

`foydaPulKoprigi` dagi `const tannarx = p.cogs.total` **o'zgartirilishi
shart edi**: o'sha qatorning ma'nosi — "bu tovar uchun pul AVVAL chiqqan",
naqd tomoni pastdagi "Tovar uchun to'lov" (`kassa_ops goods/import`).
Yo'lkira esa pulni SHU davrda, hamyondan oladi — ya'ni oddiy xarajat kabi
o'zini o'zi yopadi. Qo'shilib qolganda `izohlanmagan` 0.13 $ dan
−228.70 $ ga sakrardi. Endi `p.cogs.total − p.cogs.kelish`.

### 22.4 Yo'l-yo'lakay topilgan: 6 318.62 $ hech qaysi hisobda yo'q edi

Yangi audit `kelish-kassa-ops` birinchi yurishida aynan ikki qatorni topdi:

| Sana | kassa_ops turi | Summa | Izoh |
|---|---|---:|---|
| 2026-08-13 | `goods` | 4 341.00 $ | "Kabel yolkirasi" |
| 2026-08-31 | `import` | 1 977.62 $ | "Import yo'lkira · shundadan zapchastlar kelgan" |

`goods`/`import` chiqimlari P&L ga **umuman kirmaydi** (ombor aktivi deb
hisoblanadi) — ya'ni bu 6 318.62 $ na xarajatda, na tannarxda ko'rinardi.
Bu **kod xatosi emas, joylashuv xatosi**: pulning to'g'ri joyi endi bor.
Rahbar qaroriga ko'ra yozuvlar KO'CHIRILMADI — audit ularni ko'rsatib
turadi, qaror rahbarniki (ko'chirilsa avgust sof foydasi 6 318.62 $ ga
kamayadi va kelish ulushi 7.18 % bo'ladi).

`kassa_ops` dagi "Import xarajati" yorlig'i **"Import to'lovi (tovar
uchun)"** ga o'zgartirildi — eski nom menejerni aynan noto'g'ri joyga
chorlardi. Kalit `import` o'zgarmadi.

### 22.5 Ko'cha ustasi — ikki tur, kod o'zgarishisiz

`svc_installer` ("mijoz to'lagan") va `svc_installer_free` ("bepul montaj"),
ikkalasi `service=true`, izoh majburiy. Mexanizm allaqachon tayyor edi:
`ExpenseModal` servis turida hamyonni servisga qotiradi, "Kimga → Ko'cha
usta" (`STREET_INSTALLER`) bor, `ServiceReport` `SERVICE_CATEGORIES` ni
yig'adi. Ikki tur — rahbar ajratgan ikki holat; yangi ustun kerak emas,
hisobot ularni tur kesimida alohida ko'rsatadi.

### 22.6 Lekin pul ko'rinmas joyga tushardi — "Servis foydasi" hisoboti

Ish davomida aniqlandi: **"Servis foydasi" Hisobotlar ro'yxatida umuman
ko'rinmasdi.** `lib/analyses.js` da unda `bazadan: true` yo'q edi,
`reports/page.jsx` esa aynan shuni filtrlaydi. Ustiga u kirimni Billz'ning
"Эффективность товаров" **Excel yuklamasidan** o'qirdi — holbuki jonli yo'l
(`serviceIncome.servisKirim()`) allaqachon bor va kassa balansi shuni
chaqiradi. Bu DAFTAR 19.2 dagi "Ombor qoplamasi" kasalining aynan o'zi.

Ya'ni ko'cha ustasi xarajatini qo'shsak-u buni tuzatmasak — pul yozilardi,
lekin hech kim ko'rmasdi. Tuzatildi: `bazadan: true`, Excel `source` olib
tashlandi, `reports/[id]` da `service` shoxi `bazadan` blokiga ko'chdi
(`stock`/`reorder` naqshi), `ServiceReport` kirimni `servisKirim()` dan
oladi va standart davr tanlagichga o'tdi. `jonliServisKirim` ga `byName`
qo'shildi — xizmat ta'rifi bitta joyda qoldi. Hisobotga "Servis xarajatlari
— tur bo'yicha" bloki qo'shildi: "bepul montajga qancha ketdi" shundan
ko'rinadi.

### 22.7 "Import va tannarx" moduli uzildi

`lib/shipmentsData.js` + `/finance/cost` partiya xarajatini tovarga
taqsimlab `products.cost_price` va `stock` **USTIGA yozardi** — ikkalasi
ham Billz ko'zgusi maydonlari. `billzMap.mergeProduct` eski qiymatni faqat
Billz **0** qaytarganda saqlaydi; odatda Billz o'z tannarxini beradi, ya'ni
qo'lda yozilgan landed cost keyingi sinxronda (har 5 daqiqa) o'chardi.
Tugma "qo'llandi" deb turadi-yu, raqam bir necha daqiqada yo'qoladi.

Bazada `shipments`/`shipment_items`/`shipment_costs` — **0 qator**, ya'ni
modul hech qachon ishlatilmagan. Menyudan va Moliya bosh sahifasidan
olindi, "Tannarxni qo'llash" tugmasi o'rniga sabab yozildi. Sahifa, kod va
jadvallar **o'chirilmadi** (loyiha qoidasi). Tovar-bo'yicha landed cost
kerak bo'lsa to'g'ri yo'l — Billz "Приход" (`supplier_invoices` ko'zgusi
tayyor), NSPOS'ning parallel yozuvi emas.

### 22.8 Qo'riqchilar

- `moslik` → **`kelish-tannarx`**: (1) P&L kelishi = `kelishXarajati()`
  (bitta ta'rif); (2) `OPEX + kelish = oyliksiz jami xarajat` (pul
  yo'qolmagan); (3) sof foyda eski usul bilan ham o'sha (yo'lkira ikki
  marta ayirilmagan — eng ehtimolli regressiya: `expensesPnl` `total` iga
  `+ kelish` qo'shib qo'yish); (4) kelish turi xarajat qatorida ham
  ko'rinmasin.
- `audit` → **`kelish-service`** (error) va **`kelish-kassa-ops`** (warn,
  bloklamaydi). Ikkalasi `scripts/tekshir.mjs` `KINDS` da — sog'lom holatda
  "✓" bo'lib turadi.

### 22.9 Yo'l-yo'lakay: 7 ta tahlilni HECH KIM ocha olmaydi

2026-09-05 da `service` ni bazaga ko'chirgach butun ro'yxat o'lchandi:
`bazadan: true` bo'lmagan tahlil **umuman ochilmaydi** —
`app/(app)/reports/page.jsx:15` faqat `bazadan` ni chizadi va boshqa
kirish nuqtasi yo'q (`ANALYSES` faqat o'sha sahifada va `StaffModal`
huquqlar ro'yxatida o'qiladi; `app/(app)/data/` bo'sh).

Shunday 7 ta bor: `abc_clients`, `abc_products`, `sellers`,
`sales_dynamics`, `stock_value`, `imports`, `writeoffs`.

**Yangisi yasalmadi** — har biri bugungi bazadan ishlaydigan tahlil bilan
qoplangan yoki ma'lumoti yo'q (sabab `lib/analyses.js` sarlavhasida
qatorma-qator yozildi). Ayniqsa `sellers`: o'lchov ko'rsatdiki sotuvchilar
aynan do'kon kassirlari (Abduvohid = Optim 88 071.39; Abdulahad + Akramjon
= Namangan 59 017.54), ya'ni "Sotuvchilar samaradorligi" do'kon kesimini
takrorlagan bo'lardi (CLAUDE.md 2026-09-04: bir xil ro'yxatga ikkinchi
karta yasalmaydi).

**Tuzatilgani:** `components/StaffModal.jsx` huquqlar ro'yxati endi faqat
ochiladigan hisobotlarni ko'rsatadi. Ilgari rahbar "Sotuvchilar
samaradorligi"ni belgilardi-yu, o'sha hisobotni hech kim ocha olmasdi —
belgilanadigan narsa ochiladigan narsa bilan bir xil bo'lishi kerak.

### 22.10 Excel davridagi P&L kodi olib tashlandi

`lib/pnlData.js` dan `sinceLedgerStart`, `pnlSource`, `billzPnlIsUploaded`,
`pnlSourceGap`, `billzPnl`, `billzPnlTotals`, `billzCashflow` (~130 qator)
olindi: ularning yagona iste'molchisi `BillzCompare` edi va u 05.09 da
olib tashlangan (21-bo'lim). Billz uchun Excel zaxira yo'li bo'lmaydi —
ikki yo'l qolsa ertami-kechmi ikki xil raqam beradi. O'lchov: avgust
raqamlarining hammasi o'zgarmadi (sof foyda 27 243.57).

## 23. 2026-09-06 — Qaysi Billz kaliti bilan ishlaymiz (Dashboard ↔ tizim.enes.uz)

Rahbar Billz'dagi ikkita faol integratsiya kalitini ko'rsatdi — **Dashboard**
(19.08.2026) va **tizim.enes.uz** (24.08.2026) — va "hammasini shu ikkinchisi
tortyapti" deb taxmin qildi. Taxminni tekshirish kerak edi, chunki DAFTAR
20.5 (4) dagi ochiq band aynan kalitning roliga bog'liq: spisanie va kassa
smenasi **403** qaytaradi. Agar o'lchov boshqa kalit bilan qilingan bo'lsa,
rahbardan bekorga ish so'ralayotgan bo'lardi.

Muammoning tagi: **qaysi kalit ishlatilayotgani hech qayerda yozilmagan edi.**
`.env` da faqat `BILLZ_SECRET_TOKEN=<240 belgi>` turadi — u o'zini tanitmaydi.

### 23.1 O'lchov vositasi: `scripts/billz-kalit.mjs`

```
node --import ./scripts/lib/register.mjs scripts/billz-kalit.mjs            # .env dagi kalit
node --import ./scripts/lib/register.mjs scripts/billz-kalit.mjs --kalit=2  # .env dagi BILLZ_KALIT_2
BILLZ_KALIT=<token> node --import ./scripts/lib/register.mjs scripts/billz-kalit.mjs
```

Kalitni **nomi bilan** aytadi: Billz login qaytargan JWT ichida `user_id`
bor, Billz esa har integratsiya kaliti uchun `<nom> api` degan soxta xodim
yaratadi — id `/v1/user` ro'yxatidagi qatorga tushiriladi. Keyin mavjud
`probe()` (`lib/billzApi.js`) bilan nima ochiqligi ko'rsatiladi.

Token ekranga chiqmaydi — faqat sha256 ning dastlabki 8 belgisi ("barmoq
izi"), u ikki kalitni va lokal ↔ server sozlamasini solishtirishga yetadi.
Faqat login + GET; Billz'ga hech narsa yozilmaydi.

### 23.2 Natija: taxmin teskari, lekin farqi yo'q

| Kalit | Barmoq izi | Billz'dagi xodim | Tizim ishlatadimi |
|---|---|---|---|
| Dashboard | `a8610a20` | `Dashboard api` (4d7992c8…) | **HA** — lokal `.env.local` ham, serverdagi `.env.production` ham |
| tizim.enes.uz | `5540c7d1` | `tizim.enes.uz api` (f453a49f…) | yo'q — yaratilgan, ishlatilmaydi |

Ya'ni tizim **Dashboard** kaliti bilan tortadi (nomi chalg'itadi: manzil
`tizim.enes.uz` bo'lsa-da, kalit boshqasi). Serverdagi barmoq izi lokal
bilan bir xil — cron ham, kompyuterdagi skriptlar ham bitta kalitda.

**Ikkala kalitning huquqi ham TENG** (ikkalasi alohida sinaldi):

```
OCHIQ  company shops products(657) categories clients(5024)
       suppliers users orders(1274) debts(11131) supplier-orders(1)
403    write-off (spisanie) · cash-shifts (smena)
```

Xulosa: kalitni almashtirish **hech narsa bermaydi**. 403 kalitdan emas,
uning roliga berilmagan huquqdan — DAFTAR 20.5 (4) o'z kuchida qoladi:
Billz → Sozlamalar → Integratsiya → rolga "Списания" va "Кассовые смены"
o'qish huquqi. `/v1/user` bu huquqni ko'rsatmaydi (API xodimlarida
`roles: null`), shuning uchun yagona o'lchov — yuqoridagi jadval.

Ko'ndalang tekshiruv: serverdagi `GET /api/billz/sync?probe=1` javobi
skript natijasi bilan belgima-belgi bir xil chiqdi.

### 23.3 Topilgan va o'sha kuni yopilgan xavf: `04-ilova.sh` sirlarni o'chirardi

`scripts/server/04-ilova.sh` `.env.production` ni **ustidan yozardi** va
yozadigan qatorlari atigi to'rtta edi: `NEXT_PUBLIC_SUPABASE_URL`,
`DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`. Ishlayotgan serverda esa
to'qqizta bor — qolgan beshtasi qo'lda qo'yilgan va hech qayerda
saqlanmagan:

| Kalit | Kim qo'ygan | Yo'qolsa |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | qo'lda yasalgan JWT | sayt bazani umuman o'qimaydi |
| `BILLZ_SECRET_TOKEN` | qo'lda | Billz sinxronizatsiyasi 500 |
| `CRON_SECRET` | qo'lda | cron 401 — 5 daqiqalik ko'zgu to'xtaydi |
| `NSPOS_REST_INTERNAL` | `10-ichki.sh` | server o'ziga tashqi TLS orqali aylanadi |
| `BILLZ_API_URL` | qo'lda | (standart qiymatga tushadi) |

Ya'ni o'rnatishning shu qadamini **ikkinchi marta** yurgizish yetardi:
`npm ci` o'tadi, `next build` o'tadi, sayt ochiladi, hamma sahifa 200
qaytaradi — faqat raqam yangilanmay qotib qoladi. Aynan biz qochadigan
jim nosozlik: ekranda hech qanday belgi yo'q, xato faqat
`/opt/nspos/zaxira/billz.log` ichida ko'rinadi.

**Tuzatildi (2026-09-06).** Endi skript faqat **o'zi boshqaradigan to'rt
qatorni** yozadi, qolgan hamma qatorni eski fayldan ko'chiradi.
Saqlanadiganlar ro'yxati **nomma-nom emas** ("bizniki emas — demak
saqlanadi"): nomma-nom ro'yxat ertaga qo'shilgan kalitni o'tkazib
yuborardi va xato aynan o'sha ko'rinishda qaytardi. Yana uchta narsa:

- `CRON_SECRET` yo'q bo'lsa **yasaladi** (`openssl rand -hex 24`,
  `07-api.sh` dagi kabi bir marta) — birinchi o'rnatishdan keyin cron
  darrov ishlaydi;
- eski fayl `/etc/nspos/env.production.oldingi` ga nusxalanadi (600,
  ilova papkasida emas — u yerdan `chiqar.sh` rsync'i tashlab yuborishi
  mumkin);
- `SUPABASE_SERVICE_ROLE_KEY` yoki `BILLZ_SECRET_TOKEN` yo'q bo'lsa
  ekranda **ogohlantirish va aniq buyruq** chiqadi (birinchi o'rnatishda
  ular hali yo'q — bu xato emas, lekin jim ham qolmasligi kerak).

O'lchov (blok ajratib olinib, uchta holatda yurgizildi):

| Holat | Kirish | Natija |
|---|---|---|
| Ishlayotgan server | 9 kalit | 9 kalit — beshta sir joyida, to'rttasi yangilandi |
| Birinchi o'rnatish | fayl yo'q | 4 + yasalgan `CRON_SECRET`, 2 ta ogohlantirish |
| Sir yarim | `CRON_SECRET` yo'q | 8 kalit, `CRON_SECRET` yasaldi, `TELEGRAM_BOT_TOKEN` saqlandi |

Serverda `04-ilova.sh` QAYTA YURGIZILMADI: u nginx sozlamasini ham
qaytadan yozadi va domensiz chaqirilsa `09-domen.sh` qo'ygan sertifikat
sozlamasi buziladi. Shuning uchun tekshiruv blokni ajratib olib, aynan
serverdagi kalitlar ro'yxati ustida yurgizildi.

## 24. 2026-09-06 — "Kalit roliga huquq bering" xulosasi NOTO'G'RI edi

23-bo'limdan keyin rahbar Billz kabinetiga login berdi: "o'zing kirib
keraklilarini belgilab saqla". Belgilash o'rniga **o'lchov** chiqdi va u
ochiq bandni (20.5 №4) butunlay bekor qildi.

Vosita: `scripts/billz-huquq.mjs` — Chrome + xom CDP (naqsh
`scripts/server/brauzer-kirgan.mjs` dan; loyihada playwright yo'q).
Skript **hech narsa bosmaydi**: kiradi, o'qiydi, kabinet o'zi qaysi
manzilga borayotganini yozib oladi.

### 24.1 Rol allaqachon berilgan edi — lekin 403 baribir turardi

Kalitlar sahifasidagi havoladan (taxmin emas) rol topildi:
Dashboard → `916a7ed7-…`, tizim.enes.uz → `2d42b63f-…`.

Dashboard rolida «Списание» ning **hamma** ichki huquqi yoqilgan.
Billz'ning O'Z metodi bilan tasdiqlandi — `/api/v2/user/4d7992c8-…/permissions`:
`write-off-cost`, `write-off-delete`, `write-off-list` → `is_active: true`.
Shunga qaramay integratsiya kaliti `/v2/write-off` da **403** oladi.

Hal qiluvchi dalil esa teskari tomondan keldi: «Поставщики» ning **hamma**
huquqi o'chiq (`supplier-list: is_active false`) — lekin `/v1/supplier`
kalitga **ochiq** (count=2).

> **Rol katakchalari integratsiya kalitiga umuman ta'sir qilmaydi.**
> Kalitda qat'iy ro'yxat (whitelist) bor va u kabinetdan boshqarilmaydi.

Ya'ni 20.5 №4 ("rolga Списания va Кассовые смены o'qish huquqini bering")
bajarilsa ham hech narsa o'zgarmasdi. Uni bajarish uchun sarflangan vaqt —
noto'g'ri xulosa narxi. Xulosa noto'g'ri edi, chunki 403 ni ko'rib
"huquq yetishmayapti" deb **taxmin qilingan**, o'lchanmagan.

### 24.2 Yo'llarning bir qismi ham noto'g'ri edi

Ilgari yo'llar 45 ta nomzodni sinab topilgandi (`billz-probe-xarid.mjs`).
Endi kabinetning o'zi kuzatildi va **haqiqiy** yo'llar ma'lum bo'ldi:

| Modul | Bizda yozilgani | Haqiqiy yo'l | Kalitga |
|---|---|---|---|
| Inventarizatsiya | «topilmadi» | `/v2/stocktaking` | **OCHIQ — 8 hujjat** |
| Spisanie sabablari | — | `/v2/write-off-reason` | **OCHIQ — 6 ta** |
| Kassalar | — | `/v1/cash-box` | **OCHIQ — 3 ta** |
| Mijozlar (qarz filtri bilan) | — | `/v1/customers-list` | **OCHIQ — 5024** |
| Qarz statistikasi | — | `/v1/debt-stats` | **OCHIQ** |
| Spisanie hujjatlari | `/v2/write-off` | o'sha | 403 (**765 hujjat**) |
| Kassa smenasi | `/v1/order/cash-shifts` | `/v1/cashbox-shifts` | 403 |
| Qayta narxlash | «topilmadi» | `/v2/repricing` | 403 |
| Kassa kirim/chiqimi | — | `/v1/gl-transaction` | 403 |
| Qarz to'lovlari (do'kon bilan) | — | `/v1/debt-transactions` | 403 |
| Moliya kategoriyalari | — | `/v1/account` | 403 |

Ikkita xulosa bir vaqtda: **kutilganidan ko'prog'i ochiq** (inventarizatsiya
umuman yo'q deb hisoblanardi) va **yopig'i huquq bilan ochilmaydi**.

### 24.3 Spisanie ichida nima bor (ko'zgu uchun o'lchandi)

765 hujjat, maydonlari: `id, external_id, name, reason_id, reason,
status_id, shop_id, shop, comment, total_loaded/arrived_measurement_value,
total_retail_price, total_supply_price, created_by, created_at,
finished_at, write_off_items[]`. Ya'ni **tannarx bilan** (`total_supply_price`)
— P&L uchun aynan kerakli raqam. Inventarizatsiya (`/v2/stocktaking`):
`shop_name, shortage, surplus, difference_sum, type, status_id,
created_at, finished_at, items[]`.

### 24.4 Yopiq ma'lumotni olishning ikki yo'li (qaror rahbarniki)

1. **Billz'dan so'rash** — kalitga `/v2/write-off`, `/v1/cashbox-shifts`,
   `/v1/gl-transaction`, `/v1/debt-transactions` metodlarini ochib berish.
   Toza yo'l: hech qanday parol saqlanmaydi, sinish ehtimoli past.
2. **Foydalanuvchi sessiyasi** — kabinet `POST /api/v2/auth/web/login`
   bilan kiradi va o'sha token hamma metodni ochadi. Ishlaydi, lekin
   rahbarning **paroli serverda** turishi kerak va Billz UI'sini
   o'zgartirsa sinadi. Faqat birinchi yo'l bo'lmasa.

Ochiq metodlar (inventarizatsiya, kassalar, spisanie sabablari) esa hozirning
o'zida ko'zguga qo'shilishi mumkin — bu alohida ish.

## 25. 2026-09-06 — Inventarizatsiya ko'zgusi (`/v2/stocktaking`)

24-bo'limda topilgan ochiq metod ishga solindi. Ilgari bu modul "Billz'da
yo'q" deb hisoblanardi — aslida bor edi, nomi boshqacha (`stocktaking`,
"inventarizatsiya" emas).

**Qurildi:** `scripts/sql/stocktakings.sql` (jadval + RLS + grant),
`billzApi.stocktakingPages`, `billzMap.stocktakingRow`,
`billzSync.syncStocktakings` (yangi bosqich, `STAGES` ga qo'shildi),
`lib/stocktakingsData.js` (ko'zgu moduli), Ombor operatsiyalari
sahifasida blok. Ro'yxat kichik — bosqich DOIM to'liq tortadi,
inkremental murakkablik bu yerda foyda bermaydi.

### 25.1 O'lchov: "8 ta inventarizatsiya" — aslida 0 ta

Jadvalda 8 hujjat, lekin **hammasi `type=TRANSFER`**: bular transfer
qabulida ochiladigan jarayonlar, sanoq emas. Ya'ni kompaniya haqiqiy
inventarizatsiyani (`INVENTORY`) hech qachon qilmagan.

Shuning uchun modul `sanoqlar()` (transferdan tozalangan) va
`transferJarayonSummary()` ni AJRATIB beradi. Bo'lmasa ekranda
"8 ta inventarizatsiya" degan yolg'on turardi.

### 25.2 Lekin ichida haqiqiy kamomad bor edi

Transfer jarayonlarida yozilgan kamomad — **329 dona, −2 540.50 $**:

| Sana | Do'kon | Dona | Kamomad | Farq summasi |
|---|---|---|---|---|
| 09.11.2024 | NScamera Optim | 325 | 325 | −2 484.50 $ |
| 13.12.2024 | NScamera Optim | 4 | 4 | −56.00 $ |

2025–2026 da kamomad **yo'q** (eng kattasi 29.12.2025 — 6 200 dona,
farqsiz). Ikkala kamomad ham hisob boshlanishidan oldin, shuning uchun
P&L ga qo'shilmadi — lekin ekranda **ko'rsatiladi**: "sanoq qilinmagan"
xabari ostida yashirilsa, o'sha 2 540 $ hech qachon ko'rinmasdi.

### 25.3 Ikki tuzoq — ikkalasi ham tutildi

1. **Yuklanish paytidagi yolg'on.** Blok birinchi chizilganda "Billz
   ro'yxatida **0 ta** yozuv bor" derdi — ma'lumot hali kelmagan edi.
   Skrinshotda ko'rindi, `useToliq()` bilan to'sildi (CLAUDE.md
   2026-09-03 qoidasi: og'ir ma'lumotdan hisoblangan blok `toliq`
   bo'lmaguncha chizilmaydi).
2. **Muhr.** Sahifa `BillzMuhr` ATAYLAB qo'yilmaydiganlar ro'yxatida
   (CLAUDE.md 2026-09-05): sarlavha raqami NSPOS'niki, Billz bloki yon
   ma'lumot. Qoida buzilmadi.

RLS alohida tekshirildi (`set local role nspos_app` + rahbar da'volari →
8 qator ko'rinadi): PostgREST huquqsizlikni bo'sh ro'yxat bilan
bildiradi, ya'ni tekshirilmasa blok jimgina bo'sh turardi.

### 25.4 Nima QILINMADI

- **Tovar kesimi yo'q**: `items` API'da doim `null`, `/v2/stocktaking/{id}`
  yopiq. "Qaysi tovar yetishmadi" degan savolga javob yo'q — faqat dona
  va summa. Bu ekranda yozib qo'yilgan.
- **P&L ga ulanmadi**: sanoq yo'q, mavjud kamomad esa 2024-yilda.
  Haqiqiy sanoq boshlangan kuni bu qaror qayta ko'riladi.

## 26. 2026-09-12 — Ilova ochilishi: nima sekin edi va nima o'lchanmagan

7-bo'limdagi ochiq ish ("ilova ochilganda hamma jadvalni yuklamasin")
qo'lga olindi. Ishni boshlashdan oldin KOD o'qildi, keyin raqam
qo'yildi — 24-bo'limdagi xato (403 ni ko'rib "huquq yetishmayapti" deb
TAXMIN qilish) shundan chiqqan edi.

### 26.1 Topilgan uchinchi yuk: kuzatuv so'rovlari

`lib/db.js` → `subscribeAll` har 20 soniyada "qaysi jadval o'zgardi"
deb so'raydi. Uch narsa ustma-ust tushgan edi:

1. So'rov HAR JADVAL uchun alohida — 21 ta (`syncTable` bilan qayd
   etilganlar; `registerModule` bilan to'g'ridan-to'g'ri qayd
   etilganlar — xarajat, KPI, NPS, huquq — UMUMAN so'ralmaydi, ya'ni
   ularda jonli yangilanish yo'qligi ham shu yerda ko'rindi).
2. Ular KETMA-KET (`for … await`) — har biri ~250 ms, ya'ni bir
   aylanish ~5 soniya uzluksiz so'rov, har ochiq oynadan, kun bo'yi.
3. Birinchi aylanish ILOVA OCHILAYOTGANDA boshlanardi va brauzerning
   bitta manzilga ochadigan 6 ta ulanishini og'ir jadvallar bilan
   bo'lishib olardi.

Ya'ni "jonli yangilanish" aynan yuklanishni sekinlashtirardi.

Endi bitta chaqiriq: `jadval_yangilanish(jadvallar text[])`
(`scripts/sql/jadval-yangilanish.sql`), `security invoker` — RLS o'z
kuchida qoladi, xodim ko'ra olmaydigan qator uni bezovta qilmaydi.
Kuzatuv og'ir jadvallar kelgandan KEYIN boshlanadi. Funksiya bazada
bo'lmasa ilova eski yo'lga tushadi, lekin konsolda AYTADI: jimgina
sekin ishlab turgan tizim eng yomon holat.

`max(updated_at)` indekssiz butun jadvalni o'qiydi — eski yo'l
(`order by updated_at desc limit 1`) ham xuddi shunday edi, ya'ni bu
xarajat ilgari ham bor edi, faqat ko'rinmasdi. Migratsiya kuzatiladigan
jadvallarga indeks qo'yadi; bola jadvallar (chek qatorlari, qoldiq,
to'lovlar) ataylab ro'yxatda yo'q — ular so'ralmaydi, sinxron esa
ularga minglab qator yozadi.

### 26.2 Cheklar ikki to'lqinda

Eng og'ir yuk — cheklar va ular ichidagi qatorlar (9 600 chek,
35 000 qator): qolgan hamma jadval yig'indisidan katta. Endi avval
oxirgi **120 kun** keladi, qolgan tarix orqadan (`oyna` sozlamasi).

Qiyini — oraliqdagi holat. Ikki oson yo'lning ikkalasi ham xato:

- butun sahifani "yuklanmoqda" qilish — ma'lumot aslida bor,
  foydalanuvchi behuda kutadi;
- bor ma'lumotni ko'rsatib qo'yish — "Yil" tanlangan bo'lsa raqam
  KAM chiqadi va buni hech narsa bildirmaydi (9.6 dagi ishonarli
  yolg'onning aynan o'zi).

Shuning uchun ilova qaysi SANADAN beri ma'lumot to'liq ekanini biladi
(`oynaHolat()` → `{ tayyor, dan }`) va sahifa o'z DAVRI bilan
solishtiradi: `useDavrToliq(range.from)`. Bosh sahifa ("Oy") darrov
chiziladi, "Yil" esa avvalgidek kutadi. Qolgan sahifalar tegilmadi —
ular snapshot yoki butun tarix ko'rsatadi va `useToliq()` bilan kutadi.

Bir tuzoq yo'lda tutildi: `restore()` xotirani ALMASHTIRADI, ya'ni
ikkinchi to'lqin birinchisini o'chirib yuborardi — shuning uchun
ikkala to'lqin birga beriladi. Ikkinchisi: shu paytda xodim yangi
yozuv kiritsa (hali bazaga yozilmagan, `creating`), almashtirish uni
ekrandan yo'qotardi. `sync.js` endi saqlanayotgan yozuvni ro'yxatda
qoldiradi.

### 26.3 Sahifalar barobar olinadi

`readAll` sahifalarni ketma-ket olardi (11 752 qarz = 3 ta
borib-kelish). Jami son birinchi sahifa bilan BIRGA keladi
(`count=exact`), ya'ni qolganini kutib o'tirmasdan barobar so'rash
mumkin. Oxirgi ketma-ket halqa ATAYLAB qoldirildi: yuklash paytida
Billz sinxroni yangi chek yozsa jami son eskiradi va oxirida qolgan
qatorlar baribir olinadi — busiz chek jimgina tushib qolardi.

Sinov (soxta PostgREST, 12 300 qator): 1-to'lqin 4 000 qator bitta
so'rovda, 2-to'lqin 8 300 qator ikkita so'rovda, xotirada 12 300
noyob qator — dublikat ham, tushib qolgan qator ham yo'q.

### 26.4 O'lchov ilovaning ichida

"Sekin" degan gapni kod bilan emas, raqam bilan tekshirish uchun har
jadvalning qatori, so'rovi, tarmoqdan o'tgan bayti va soniyasi
yig'iladi. Saytda konsolda:

```
__nsposYuklash()     // { jadvallar: [...], sorovlar: {...} }
```

Bayt `content-length` dan olinadi (nginx gzip'dan keyingi hajm).
Sarlavha bo'lmasa `null` yoziladi — 0 yozilsa "hech narsa kelmadi"
degan yolg'on bo'lardi.

### 26.5 Nima QILINMADI

- **Saytda o'lchanmadi.** Bu sessiya yopiq muhitda ketdi: serverga
  SSH yo'q, `tizim.enes.uz` va Billz manzillari yopiq, `.env.local`
  yo'q. Ya'ni migratsiya qo'llanmadi, `npm run tekshir:server`
  yurgizilmadi va saytga chiqarilmadi — "har o'zgarishdan keyin
  saytga chiqariladi" qoidasi bu safar BAJARILMADI. Kutilgan farq
  o'lchanishi kerak: ochilishdagi soniya va 20 soniyalik aylanishdagi
  so'rov soni (30+ → 1).
- **Jadvallar talab bo'yicha yuklanmaydi.** Qaralgan va rad etilgan:
  faqat bitta sahifa o'qiydigan jadvallar (`stocktakings`,
  `stock_transfers`, `shipments`, `invites`) KICHIK — ular parallel
  kelgani uchun kutish vaqtiga qo'shmaydi, sahifa esa hookni unutsa
  jimgina bo'sh ro'yxat ko'rsatardi. Og'irlari (chek, qarz, mijoz,
  tovar) esa bosh sahifaning o'ziga kerak.
- **Jonli yangilanish hali ham ma'lumotni QAYTA O'QIMAYDI.**
  `subscribeAll` o'zgarishni sezadi-yu, faqat ekranni qayta chizadi;
  xotiraga yangi qator kelmaydi (shuning uchun "Yangilash" tugmasi
  sahifani butunlay qayta yuklaydi). To'g'ri yechim — `updated_at`
  bo'yicha inkremental o'qish; butun modulni qayta tortish esa
  Billz sinxroni har 5 daqiqada yozgani uchun teskari natija berardi.
  Alohida ish sifatida ochiq ishlar ro'yxatida.

## 27. 2026-09-13 — Qoldiq salomatligiga kesim filtri

Rahbar so'rovi: Ombor qiymati hisobotidagi kabi **Kategoriya · Brend ·
Yetkazib beruvchi** filtri "Qoldiq salomatligi" da ham bo'lsin.

### 27.1 Filtr jadvalga emas, HISOBGA beriladi

Oson yo'l — qatorlarni `applyFilters` bilan kesish — bu yerda YOLG'ON
beradi: sahifaning bosh raqamlari (Muzlab qolgan pul, Kuniga
yo'qotilayotgan foyda, Buyurtma ro'yxati) va grafik jadvaldan emas,
`deadStock()` / `reorderSummary()` dan chiqadi. Jadval kesilib, kartochka
butun katalog bo'yicha qolsa — ekranda "3 pozitsiya, 41 000 $" turardi.

Shuning uchun tanlov `stockCoverage({ kesim })` ga beriladi va u
mahsulotlarni ENG BOSHIDA filtrlaydi: `reorderList`, `deadStock`,
kartochkalar, grafik, jadval — hammasi o'z-o'zidan bitta tanlov bo'yicha.
Filtrsiz chaqiruvchilar (REST API, Telegram bot, "Buyurtma taklifi"
kartasi) avvalgidek ishlaydi — `kesim = null`.

### 27.2 Bo'sh qiymat ham variant

`tovarKesim()` — bitta ta'rif: `Kategoriyasiz`, `Brendsiz`,
`Yetkazib beruvchisiz`. Bo'sh qiymat tashlab yuborilsa, brendsiz tovarlar
hech bir tanlovga tushmay ko'rinmay qolardi (Ombor qoplamasida 118 ta
shunday tovar bor edi). Kesim endi `stockCoverage` qatorining O'ZIDA
keladi — `StockReport` dagi nusxa olib tashlandi.

### 27.3 Uch joyda bitta filtr

`useKesimFiltri()` (`components/KesimFiltri.jsx`) — Qoldiq salomatligi va
Buyurtma taklifi kartasi AYNAN shu hook'ni chaqiradi. Bir sahifada
filtr bor-u ikkinchisida yo'qligi foydalanuvchi uchun tushunarsiz
bo'lardi (CLAUDE.md: bir qoida — tegishli hamma joyga).

Sinov (soxta katalog + cheklar, bazasiz): variantlar ro'yxati,
har filtr alohida va birga (AND), bo'sh/`null` filtr = filtrsiz,
xizmat tovari kirmasligi, bucket yig'indisi kartochka puliga tengligi —
hammasi o'tdi. `next build` va `npm run nomlar` toza.

### 27.4 Sotuv oynasi — o'sha ekranda o'zgartiriladi (2026-09-13)

Fidbek: "kunlik o'rtacha 30 kunlik tarixdan olinadi — shuni o'zim
o'zgartira oladigan qil".

Raqam allaqachon sozlama edi (`stock.windowDays`), lekin uch muammo bilan:

1. **Uzoqda.** Uni Sozlamalar → Biznes qoidalaridan qidirib topish kerak
   edi, formulani o'qiyotgan ekranda esa faqat "boshqa qoidalar — u yerda"
   degan yozuv turardi.
2. **Matn qotirib yozilgan edi.** "oxirgi 30 kun; 30 kunda sotuv bo'lmasa
   90 kunlik oyna" — sozlama 60 ga o'zgartirilsa matn baribir 30 deb
   turaverardi, ya'ni ekran jimgina yolg'on gapirardi.
3. **Chegara ikki joyda.** Sozlamalar sahifasi 7–365 ni o'zi qisardi,
   `analytics` esa standart 30 ni o'zi olardi.

Endi: `companyData.getStockWindow/setStockWindow` (7–365, eng kami 7 —
undan qisqa oynada bitta katta chek "kuniga 5 dona" degan yolg'on tezlik
beradi), maydon "Buyurtma miqdori qanday hisoblanadi" blokida
(Yetkazish/Zaxira yonida, faqat rahbarga), matndagi raqamlar sozlamadan
chiqadi (zaxira oyna — uch barobari). `deadStock` dagi qotirib yozilgan
30 ham olib tashlandi.

O'lchandi (soxta ma'lumot: 50 kun oldin 10 dona sotilgan):

| Oyna | Qator oynasi | Kunlik o'rtacha | Buyurtma |
|---|---|---|---|
| 30 (standart) | 90 (zaxira) | 0.111 | 5 |
| 60 | 60 | 0.167 | 8 |
| 90 | 90 | 0.111 | 5 |

3 va 400 kun kiritilganda qiymat O'ZGARMADI (chegara ishlaydi), 7 kun
qabul qilindi.
