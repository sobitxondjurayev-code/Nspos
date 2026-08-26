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
- [ ] Tezlik: ilova ochilganda hamma jadvalni yuklamasin
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

---

## 8. Muloqot uslubi

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
