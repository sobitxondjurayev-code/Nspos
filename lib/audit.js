"use client";
// ══════════════════════════════════════════════════════════════
// PUL NAZORATI — ilova ichidagi ogohlantirishlar
// ══════════════════════════════════════════════════════════════
// `scripts/tekshir.mjs` bilan bir xil tekshiruvlar, faqat brauzerda:
// menejer va rahbar xatoni men aytishimni kutmasdan o'zi ko'radi va
// tuzatadi.
//
// Har ogohlantirish uch narsani aytadi: NIMA bo'lgan, QANCHA pulga
// tegishli va QAYERGA borib tuzatish kerak. Sababi ko'rsatilmasa,
// ogohlantirish "nimadir xato" degan bezovtalikdan boshqa narsa emas.
import { KASSAS, WALLETS, kassaIds, kassaBalances, listOps, unclosedDays, COMPANY,
  negativeDays, kassasOf, isB2bKassa } from "./kassaData";
import { listPayouts } from "./payoutsData";
import { listAllDays } from "./kpiData";
import { listStaff } from "./staffData";
import { expensesInRange, listOneOff, STREET_INSTALLER } from "./expensesData";
import { lastRate } from "./ratesData";
import { ymd } from "./dates";
import { getUsdRate, getLedgerStart } from "./companyData";
import { listSales } from "./salesData";
import { listProducts, totalQty } from "./productsData";
import { listDebts, yorliqXato } from "./debtsData";
import { listSinxronJurnal } from "./billzLogData";
import { listStores } from "./storesData";
import { kirimYigindisi } from "./kassaIncome";

// Sana "YYYY-MM-DD" ko'rinishida solishtiriladi (DAFTAR 4-bo'lim:
// Date'ni String() qilib kesish "Sat Aug 0" beradi va taqqoslash buziladi)
const iso = (d) => ymd(d);

// KPI kunlik jadvalida XODIM o'zi to'ldiradigan maydonlar. Savdo,
// Naqd, Payme va Servis bu ro'yxatda YO'Q — ular Billz'dan avtomat
// keladi (`kpiData.BILLZ_COLS`), ya'ni ular bo'yicha "eskirdi" deb
// bo'lmaydi.
const QOL_MAYDONLAR = ["late", "dayOff", "revision", "cameras", "olgan",
  "clientCalls", "newGroups", "wholesalePosts"];

const money = (n) => `${(+n).toFixed(2)} USD`;

// Dollar raqami so'mga o'xshab qolganini ushlash chegarasi.
// Katalog narxi ham (`billz-price-som`), chek qatori ham
// (`savdo-narx-som`) shu chegara bilan tekshiriladi.
//
// Nega aynan 5 000 — o'lchandi (23.08.2026, 9 032 chek · 34 489 qator):
//   eng qimmat dona narxi      1 100
//   eng qimmat dona tannarxi     400
//   eng qimmat katalog narxi     700
//   eng arzon so'm narxi      ~11 880  (1 $ × kurs)
// Ya'ni haqiqiy dollar raqamlari 1 100 da tugaydi, so'm raqamlari
// 11 880 dan boshlanadi. Chegara shu ikki oraliq ORASIDA turadi:
// haqiqiy narxdan 4.5 barobar yuqori, eng arzon so'm narxidan
// 2.4 barobar past — ikki tomonga ham zaxira bor.
const SOM_CHEGARA = 5000;

// user — kim ko'ryapti. Menejerga faqat O'Z kassasiga tegishlisi
// chiqadi: boshqa do'konning muammosini u tuzata olmaydi.
export function moneyWarnings(user) {
  const out = [];
  const isOwner = user?.role === "owner";
  const mine = kassasOf(user);
  const seen = (kassa) => isOwner || mine.includes(kassa);

  // 1) Kurs qo'yilmagan — so'mdagi xarajat umuman saqlanmaydi
  if (!getUsdRate()) {
    out.push({
      id: "rate", level: "error",
      title: "Valyuta kursi qo'yilmagan",
      detail: "So'mda kiritilgan xarajat saqlanmaydi va oylik dollarga o'girilmaydi.",
      action: "Sozlamalarda kursni yoqing", href: "/settings",
    });
  }

  // 2) Manfiy hamyon. Sababi IKKI XIL bo'ladi va ular butunlay boshqa
  //    narsa — shuning uchun matni ham boshqacha:
  //
  //    a) Biror kunning O'ZIDA chiqim kirimdan oshgan (negativeDays) —
  //       kirim to'liq yozilmagan yoki xarajat boshqa kassaga tushgan.
  //       Bu haqiqiy tekshiruv talab qiladi.
  //    b) Bunday kun yo'q, lekin qoldiq baribir minus — demak kassa
  //       o'zida bo'lganidan KO'P TOPSHIRGAN: pul yo'qolmagan, u
  //       kompaniya balansida turibdi (odatda xarajat kun yopilgandan
  //       keyin kiritilgani uchun). Keyingi topshirishda shuncha kam
  //       berilsa, o'zi tekislanadi.
  const bal = kassaBalances(new Date());
  for (const k of kassaIds()) {
    if (!seen(k)) continue;
    const yomonKunlar = negativeDays(k);
    for (const w of Object.keys(WALLETS)) {
      const v = bal[k]?.[w] ?? 0;
      if (v >= -0.01) continue;
      const kunlar = yomonKunlar.filter((d) => d.wallet === w);
      const kunlarJami = +kunlar.reduce((s, d) => s + d.amount, 0).toFixed(2);
      const ortiqcha = +(v - kunlarJami).toFixed(2);   // topshirilgan ortiqcha qism
      const izoh = [];
      if (kunlar.length) {
        izoh.push(`${money(kunlarJami)} — o'sha kuni kassada bo'lganidan ko'p chiqim bo'lgan (${kunlar.map((d) => d.date).join(", ")}): kirim to'liq yozilmagan yoki xarajat boshqa kassaga tushgan.`);
      }
      if (ortiqcha < -0.01) {
        izoh.push(`${money(ortiqcha)} — pul yo'qolmagan: kassa o'zida bo'lganidan ko'p topshirgan, u kompaniya balansida turibdi (odatda xarajat kun yopilgandan keyin kiritilgan). Keyingi topshirishda shuncha kam berilsa tekislanadi.`);
      }
      out.push({
        id: `neg-${k}-${w}`, level: kunlar.length ? "error" : "warn",
        title: `${KASSAS[k]?.label ?? k} · ${WALLETS[w]} minusda: ${money(v)}`,
        detail: izoh.join(" "),
        action: "Kunma-kun ko'rish", href: `/finance/kassa/${k}`,
      });
    }
  }

  // 3) Yopilmagan kunlar — pul topshirilmagan yoki tekshirilmagan
  for (const k of kassaIds()) {
    if (KASSAS[k]?.main || !seen(k)) continue;
    const days = unclosedDays(k);
    if (!days.length) continue;
    out.push({
      id: `unclosed-${k}`, level: "warn",
      title: `${KASSAS[k]?.label ?? k}: ${days.length} kun yopilmagan`,
      detail: `Eng eskisi ${days[0]}. Yopilmagan kunning puli topshirilganmi yoki yo'qmi — bilinmaydi.`,
      action: "Kunlarni ochish", href: `/finance/kassa/${k}`,
    });
  }

  // 4) To'langan reja kassa yozuviga bog'lanmagan — "rejaga qaytarish"
  //    chiqimni o'chira olmaydi, ya'ni pul ikki marta chiqib ketishi mumkin
  if (isOwner) {
    const unlinked = listPayouts().filter((p) => p.status === "paid" && !p.opId);
    if (unlinked.length) {
      out.push({
        id: "unlinked", level: "warn",
        title: `${unlinked.length} ta to'lov kassa yozuviga bog'lanmagan`,
        detail: unlinked.slice(0, 3).map((p) => `${p.title} · ${money(p.amount)}`).join(" · "),
        action: "Pul rejasini ochish", href: "/finance/plan",
      });
    }
  }

  // 5) Ikkilangan chiqim — bir xil summa, bir xil izoh, bir necha marta
  const byKey = new Map();
  for (const o of listOps()) {
    if (o.kind !== "out") continue;
    if (!seen(o.kassa)) continue;
    const key = `${o.kassa}|${o.wallet}|${o.amount}|${o.note ?? ""}`;
    byKey.set(key, [...(byKey.get(key) ?? []), o]);
  }
  for (const [, list] of byKey) {
    if (list.length < 2) continue;
    const o = list[0];
    out.push({
      id: `dup-${o.kassa}-${o.amount}-${o.note}`, level: "warn",
      title: `Bir xil chiqim ${list.length} marta: ${o.note || "izohsiz"} · ${money(o.amount)}`,
      detail: `Sanalari: ${list.map((x) => x.date).join(", ")}. Agar bu bitta to'lov bo'lsa, ortiqchasi o'chirilsin.`,
      action: "Pul rejasini ochish", href: "/finance/plan",
    });
  }

  // 6) Kassasi yo'q do'konning kirimi — pul hech qaysi kassaga tushmaydi
  //
  // 2026-08-26 gacha bu tekshiruv XODIM ustidan borardi: menejer
  // kunlik kirimni qo'lda yozardi va do'koni bo'lmasa pul yo'qolardi.
  // Endi kirim Billz cheklaridan, ya'ni DO'KON bilan birga keladi va
  // bo'shliq boshqa joyga ko'chdi: `kassaData.kpiIncome`/`fillDays`
  // kassa ro'yxatida turmagan do'konni JIMGINA tashlab ketadi
  // (masalan Sklad). Shuning uchun tekshiruv ham o'sha yerni qaraydi.
  if (isOwner) {
    // FAQAT hisob boshidan: undan oldingi pul harakati umuman
    // sanalmaydi (kelishuv, DAFTAR 1-bo'lim). Davrsiz olinganda
    // 30–31 iyulda kiritilgan 567 $ "kassaga tushmagan" bo'lib
    // ekranda qizil xato bo'lib turardi (2026-08-14).
    const stores = new Map(listStores().map((x) => [x.id, x.name]));
    for (const [store, k] of Object.entries(kirimYigindisi(getLedgerStart(), iso(new Date())))) {
      if (kassaIds().includes(store)) continue;
      const sum = +(k.cash + k.payme + k.service).toFixed(2);
      if (sum <= 0) continue;
      out.push({
        id: `nostore-${store}`, level: "error",
        title: `${stores.get(store) ?? store}: ${money(sum)} hech qaysi kassaga tushmagan`,
        detail: "Bu do'konda Billz cheklari bor, lekin NSPOS'da kassa yuritilmaydi — kirimi kassa balansiga qo'shilmaydi.",
        action: "Do'konlarni ochish", href: "/management",
      });
    }
  }

  // 7) Usta puli IKKI MARTA hisoblangan
  //    Qoida (2026-08-13): usta olgan pul BITTA manbadan — KPI
  //    jadvalidagi "olgan" ustuni. U avtomat ravishda "Oylik" turidagi
  //    xarajat bo'lib qo'shiladi. Menejer o'sha pulni Xarajatlar
  //    bo'limiga QO'LDA ham kiritsa, bir xil pul ikki marta chiqadi:
  //    servis hamyoni minusga tushadi, usta esa "ko'p olgan" bo'lib
  //    ko'rinadi. Belgi: bir xil usta, bir xil kun, bir xil summa.
  {
    const rows = expensesInRange(new Date(getLedgerStart() + "T00:00:00"), new Date());
    const key = (e) => `${e.staffId}|${e.date}|${e.amount.toFixed(2)}`;
    const fromKpi = new Set(rows.filter((e) => e.source === "installer").map(key));
    const staff = new Map(listStaff().map((s) => [s.id, s]));
    const dubl = rows.filter((e) => e.source !== "installer" && e.category === "salary"
      && e.staffId && staff.get(e.staffId)?.role === "installer" && fromKpi.has(key(e)));
    for (const e of dubl) {
      if (!seen(e.kassa)) continue;
      out.push({
        id: `dubl-${e.id}`, level: "error",
        title: `${staff.get(e.staffId)?.name ?? "Usta"}: ${money(e.amount)} ikki marta hisoblangan (${e.date})`,
        detail: "Bu pul KPI jadvalidagi \"olgan\" ustunida allaqachon bor va u yerdan avtomat xarajat bo'lib chiqadi. Xarajatlardagi qo'lda kiritilgan nusxasi o'chirilsin.",
        action: "Xarajatni ochish", href: `/finance/expenses?edit=${e.id}`,
      });
    }
  }

  // 8) Oylik berilgan, lekin KIMGA berilgani bog'lanmagan
  //    Izohda ismi yozilgani yetarli emas: hisob xodim bo'yicha
  //    yuritiladi (kim qancha ishlab topdi, qancha oldi, qancha
  //    qoldi). Bog'lanmagan yozuv hech kimning balansiga tushmaydi —
  //    natijada balansdagi "to'lanmagan ish haqi" ham, xodim
  //    kartochkasidagi qarz ham noto'g'ri bo'ladi.
  //    "Ko'cha usta" ataylab qo'yilgan qiymat (hisobi yo'q usta) —
  //    u ogohlantirilmaydi.
  {
    const bogsiz = expensesInRange(new Date(getLedgerStart() + "T00:00:00"), new Date())
      .filter((e) => e.category === "salary" && e.source !== "installer"
        && !e.staffId && e.paidTo !== STREET_INSTALLER);
    if (bogsiz.length && isOwner) {
      const jami = +bogsiz.reduce((s, e) => s + e.amount, 0).toFixed(2);
      out.push({
        id: `nostaff-oylik`, level: "warn",
        title: `${bogsiz.length} ta oylik to'lovi xodimga bog'lanmagan: ${money(jami)}`,
        detail: bogsiz.slice(0, 3).map((e) => `${e.date} · ${e.note || "izohsiz"} · ${money(e.amount)}`).join(" · ")
          + " — yozuvni ochib, \"Kimga\" maydonida xodimni tanlang, shunda uning oylik balansiga tushadi.",
        action: "Xarajatlarni ochish", href: "/finance/expenses",
      });
    }
  }

  // —— BILLZ SINXRONIZATSIYASI ————————————————————————
  // Bu uchtasi "raqam bir-biriga teng emas" emas, "ma'lumot xato"
  // turkumidan — shuning uchun `lib/moslik.js` da emas, shu yerda.

  // 1) Chek bor, ichida tovar yo'q.
  //    Billz Excel eksporti chek tarkibini bermasdi, shuning uchun
  //    2026-08-19 gacha `sale_items` BUTUNLAY bo'sh edi va tovar
  //    kesimidagi foyda hech qachon hisoblanmasdi. Endi qatorlar
  //    API'dan keladi. Agar chek qatorlarsiz qolsa — o'sha chek
  //    hisobotlarda "0 dona sotildi, lekin pul tushdi" bo'lib chiqadi.
  if (isOwner) {
    const sales = listSales();
    const bosh = sales.filter((s) => !s.items?.length);
    if (bosh.length) {
      // ULUSH PUL BO'YICHA hisoblanadi, chek soni bo'yicha emas.
      //
      // Ilgari `bosh.length / sales.length` olinardi va u 9 032 chekdan
      // 39 tasi uchun "0%" chiqarardi — ya'ni ogohlantirish o'zini
      // "e'tibor bermasa ham bo'ladi" deb ko'rsatardi.
      //
      // Pul bo'yicha esa manzara boshqa: o'sha 39 chek 17 052.88 $
      // turadi, ya'ni tushumning 1.6 % i. Tovar kesimidagi har qanday
      // tahlil aynan shu pulni KO'RMAYDI.
      const boshPul = +bosh.reduce((a, s) => a + Math.abs(+s.total || 0), 0).toFixed(2);
      const jamiPul = sales.reduce((a, s) => a + Math.abs(+s.total || 0), 0);
      const ulush = jamiPul > 0 ? (boshPul / jamiPul) * 100 : 0;
      out.push({
        id: "billz-items-missing", level: bosh.length === sales.length ? "error" : "warn",
        title: `${bosh.length} ta chekda tovar tarkibi yo'q — ${money(boshPul)} (tushumning ${ulush.toFixed(1)}%)`,
        detail: "Tovar kesimidagi foyda, ABC tahlil va \"eng ko'p sotilgan\" shu qatorlardan "
          + "hisoblanadi — bu pul ularda KO'RINMAYDI. Avval quyidagi \"bog'lanmagan chek\" "
          + "ogohlantirishi bor-yo'qligini ko'ring: 2026-08-23 da aynan shu ogohlantirishning "
          + "sababi Billz emas, Excel'dan qolgan dublikat bo'lib chiqqan. Dublikat bo'lmasa "
          + "Sozlamalar → Billz'dan yangilash, butun tarix uchun "
          + "`npm run billz -- --only=orders --full`.",
        action: "Sozlamalarni ochish", href: "/settings",
      });
    }
  }

  // 1-B) Excel'dan qolgan chek Billz chekiga bog'lanmagan.
  //
  // Bu xato o'zini "tovar tarkibi yo'q" bo'lib ko'rsatadi va shuning
  // uchun uzoq vaqt noto'g'ri tomonga qaratib turdi (2026-08-23):
  // Billz'dan qayta tortish taklif qilinardi, aslida esa chek allaqachon
  // bazada — ikkinchi nusxa bo'lib, tovarlari bilan birga.
  //
  // Sabab: `linkSales()` eski qatorni Billz chekiga raqam+tur+summa
  // bo'yicha bog'laydi, summa esa bir tiyinga farq qilishi mumkin
  // (1030.53 / 1030.54). Bog'lanmasa — ikkalasi ham sanaladi.
  //
  // Belgisi: `billzId` bo'sh chek, lekin bazada AYNAN o'sha raqam va
  // turdagi boshqa chek bor. Faqat raqamning takrorlanishi yetarli
  // emas — Billz qaytarish chekiga asl chekning raqamini beradi va
  // bir chekka ikki marta qaytarish bo'lishi mumkin (000800069246,
  // 06 va 07-avgust, ikkalasi ham haqiqiy).
  if (isOwner) {
    const hammasi = listSales();
    const kalit = (s) => `${String(s.no ?? "").trim()}|${s.type}`;
    const jufti = new Map();
    for (const s of hammasi) {
      if (!s.billzId) continue;
      const k = kalit(s);
      if (!jufti.has(k)) jufti.set(k, []);
      jufti.get(k).push(Math.abs(+s.total || 0));
    }
    const bogsiz = hammasi.filter((s) => {
      if (s.billzId) return false;
      const list = jufti.get(kalit(s)) ?? [];
      return list.some((t) => Math.abs(t - Math.abs(+s.total || 0)) <= 0.02);
    });
    if (bogsiz.length) {
      const pul = +bogsiz.reduce((a, s) => a + Math.abs(+s.total || 0), 0).toFixed(2);
      out.push({
        id: "billz-unlinked-duplicate", level: "error",
        title: `${bogsiz.length} ta chek ikki marta yozilgan — ${money(pul)}`,
        detail: "Bu cheklar Excel importidan qolgan va Billz'dagi o'sha chekka bog'lanmagan, "
          + "ya'ni tushum ikki marta sanalyapti. O'chirilmaydi: "
          + "`node scripts/billz-sync.mjs --link-sales` bog'laydi, bog'lanmagani "
          + "`sales.superseded_by` bilan hisobdan chiqariladi "
          + "(`scripts/sql/sales-superseded.sql`).",
        action: "Sozlamalarni ochish", href: "/settings",
      });
    }
  }

  // 2) Narx dollar emas, so'mga o'xshab qolgan.
  //    Billz bir tovarning `retail_currency` sini do'konga qarab "USD"
  //    yoki "UZS" deb qaytaradi, RAQAM esa bir xil — shuning uchun
  //    sinxronizatsiya yorliqni O'QIMAYDI, raqamni dollar deb oladi
  //    (tekshirildi 19.08.2026: 260 = 260). Billz tomonida bu qoida
  //    o'zgarsa narx ~12 000 barobar oshadi va butun hisobot buziladi.
  //    Shu holat shu yerda ushlanadi.
  if (isOwner) {
    const somga = listProducts().filter((p) => (+p.salePrice || 0) > SOM_CHEGARA);
    if (somga.length) {
      out.push({
        id: "billz-price-som", level: "error",
        title: `${somga.length} ta tovarning narxi so'mda ko'rinyapti`,
        detail: somga.slice(0, 3).map((p) => `${p.name} — ${(+p.salePrice).toLocaleString("ru-RU")}`).join(" · ")
          + ". Billz narxni dollarda beradi; bu raqamlar so'mga o'xshaydi. "
          + "Sinxronizatsiyani to'xtatib, lib/billzMap.js dagi valyuta qoidasini tekshiring.",
        action: "Tovarlarni ochish", href: "/products",
      });
    }
  }

  // 2-B) Chek ichidagi narx so'mga o'xshab qolgan.
  //
  //    Yuqoridagi tekshiruv faqat KATALOG narxini ko'radi
  //    (`products.sale_price`). Ekrandagi tushum esa katalogdan emas,
  //    CHEK QATORLARIDAN yig'iladi (`sales` → `sale_items`, masalan
  //    `managementData.billzInRange`). Ya'ni Billz valyuta qoidasini
  //    o'zgartirsa, katalog toza turgani holda tushum va foyda
  //    ~12 000 barobar oshib ketardi va hech qayerda ushlanmasdi.
  //
  //    Chegara chek JAMISIGA emas, DONA NARXIGA qo'yiladi: haqiqiy
  //    6 650 $ lik chek bor (DAFTAR 11-bo'lim) — jami bo'yicha 5 000
  //    lik chegara qo'yilsa u har safar yolg'on trevoga berardi.
  //    Dona narxi esa 1 100 da tugaydi (yuqoridagi o'lchov).
  if (isOwner) {
    const CHEK_CHEGARA = 50000;   // faqat tarkibi yo'q cheklar uchun
    const shubha = [];
    let itemsiz = 0;
    for (const s of listSales()) {
      const items = s.items ?? [];
      if (items.length) {
        if (items.some((i) => (+i.price || 0) > SOM_CHEGARA || (+i.costPrice || 0) > SOM_CHEGARA)) {
          shubha.push(s);
        }
      } else if (Math.abs(+s.total || 0) > CHEK_CHEGARA) {
        // Tarkibi yo'q chek (Excel davridan qolganlar) — dona narxini
        // ko'rib bo'lmaydi, shuning uchun jami bo'yicha va keng
        // chegara bilan: eng katta haqiqiy chek ~6 650 $, so'mga
        // o'xshagan chek esa 5 $ lik savdoda ham 59 400 dan boshlanadi.
        shubha.push(s);
        itemsiz++;
      }
    }
    if (shubha.length) {
      const pul = +shubha.reduce((a, s) => a + Math.abs(+s.total || 0), 0).toFixed(2);
      out.push({
        id: "savdo-narx-som", level: "error",
        title: `${shubha.length} ta chekdagi narx so'mda ko'rinyapti — ${money(pul)}`,
        detail: shubha.slice(0, 3).map((s) => `№${s.no} — ${Math.abs(+s.total || 0).toLocaleString("ru-RU")}`).join(" · ")
          + ". Billz narxni dollarda beradi; bu raqamlar so'mga o'xshaydi. "
          + "Sinxronizatsiyani TO'XTATIB, lib/billzMap.js dagi valyuta qoidasini tekshiring — "
          + "tushum, foyda va P&L to'g'ridan-to'g'ri shu qatorlardan hisoblanadi."
          + (itemsiz ? ` (${itemsiz} tasi tarkibi yo'q chek — jami bo'yicha ushlandi.)` : ""),
        action: "Savdolarni ochish", href: "/sales",
      });
    }
  }

  // 3) Tannarxi 0 — qoldig'i bor YOKI oxirgi 90 kunda sotilgan.
  //    Billz qoldig'i tugagan tovarning tannarxini 0 deb qaytaradi
  //    (`product_supplier_stock` bo'sh bo'lib qoladi) — shuning uchun
  //    sinxronizatsiya NOLNI USTIGA YOZMAYDI. Baribir 0 bo'lib qolgan
  //    tovar bo'lsa, u bo'yicha foyda 100% bo'lib ko'rinadi.
  //    2026-09-03 gacha faqat qoldig'i borlar tekshirilardi — "Qoldiq
  //    salomatligi"dagi 43 tugagan tovardan 20 tasi tannarxsiz edi va
  //    hech qayerda ko'rinmasdi (yo'qotish narxning to'lig'iga teng
  //    chiqardi). ODAM kiritadi (Billz'da kirim narxi) — bloklamaydi.
  if (isOwner) {
    const chegara = Date.now() - 90 * 864e5;
    const sotilgan = new Set();
    for (const s of listSales()) {
      if (new Date(s.at).getTime() < chegara) continue;
      for (const i of s.items ?? []) if (i.qty > 0) sotilgan.add(i.productId);
    }
    const tannarxsiz = listProducts().filter((p) =>
      !p.isService && !(+p.costPrice) && (totalQty(p) > 0 || sotilgan.has(p.id)));
    if (tannarxsiz.length) {
      const qoldiqli = tannarxsiz.filter((p) => totalQty(p) > 0).length;
      out.push({
        id: "billz-cost-zero", level: "warn",
        title: `${tannarxsiz.length} ta tovarning tannarxi 0 (${qoldiqli} tasida qoldiq bor, qolgani oxirgi 90 kunda sotilgan)`,
        detail: tannarxsiz.slice(0, 3).map((p) => `${p.name} — ${totalQty(p)} dona`).join(" · ")
          + ". Bu tovarlar bo'yicha foyda 100% bo'lib ko'rinadi, buyurtma taklifida esa "
          + "yo'qotish hisoblanmaydi. Billz'da kirim narxini kiriting yoki tovar "
          + "kartochkasida qo'lda qo'ying.",
        action: "Tovarlarni ochish", href: "/products",
        bloklamaydi: true,
      });
    }
  }

  // N) Sotuv ma'lumoti eskirib qolgan.
  //
  // Nega bu tekshiruv bor (2026-08-22): Billz `end_date` berilmasa
  // faqat `start_date` KUNINI qaytarar ekan. Sinxronizatsiya har 30
  // daqiqada muvaffaqiyatli tugardi, jurnalda "34 ta chek qo'shildi"
  // deb yozardi — aslida esa 19-avgustdan beri 101 ta chek bazaga
  // umuman tushmagandi. Uch kun davomida hech narsa bildirmadi.
  //
  // Bu turdagi nosozlikni xato xabari tuta olmaydi: so'rov
  // muvaffaqiyatli, javob to'g'ri, shunchaki ma'lumot kam. Uni faqat
  // "eng yangi chek qachon edi?" degan savol tutadi.
  const oxirgiChek = (() => {
    let m = null;
    for (const s2 of listSales()) {
      const k = ymd(s2.at);
      if (k && (!m || k > m)) m = k;
    }
    return m;
  })();
  if (oxirgiChek) {
    const kun = Math.floor((new Date(ymd(new Date())) - new Date(oxirgiChek)) / 86400000);
    if (kun >= 2) {
      out.push({
        id: "stale-sales", level: kun >= 4 ? "error" : "warn",
        title: `Sotuv ma'lumoti ${kun} kundan beri yangilanmagan`,
        detail: `Bazadagi eng yangi chek — ${oxirgiChek}. Do'kon ishlayotgan bo'lsa, `
          + "Billz'dan tortish to'xtagan degani. Sozlamalar → Billz'dan yangilash.",
        action: "Sozlamalarni ochish", href: "/settings",
      });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // N) SINXRONIZATSIYA NIMANI TASHLAB KETGANI
  // ══════════════════════════════════════════════════════════════
  // Yuqoridagi "Sotuv ma'lumoti eskirgan" tekshiruvi sinxronizatsiya
  // BUTUNLAY to'xtaganini tutadi. Lekin u ISHLAB turib, ma'lumotning
  // bir qismini jimgina tashlab ketishi ham mumkin — bu holatda eng
  // yangi chek bugungi bo'ladi va tekshiruv yashil turaveradi.
  //
  // Uchta bunday teshik bor edi (2026-08-24 auditi). Endi uchalasi
  // ham jurnalga yoziladi (`billz-audit.sql`) va shu yerda ekranga
  // chiqadi.
  //
  // DIQQAT — jurnalni faqat rahbar va menejer o'qiy oladi (RLS).
  // Usta yoki kassir ochsa PostgREST xato emas, BO'SH ro'yxat
  // qaytaradi. Shuning uchun "yozuv yo'q" holati JIM o'tiladi:
  // aks holda huquqi yo'q xodim ekranida soxta trevoga turardi.
  {
    const jurnal = listSinxronJurnal();
    const cheklar = jurnal.find((x) => x.entity === "orders") ?? null;

    // N.1) Billz'da tanilmagan to'lov turi chiqqan.
    // Bunday pul hech qaysi hamyonga tushmaydi: kassa solishtiruvida
    // ko'rinmaydi va "menejer naqdni kam yozibdi" bo'lib chiqadi.
    const nomalum = cheklar?.warnings?.unknownPayments ?? null;
    if (nomalum && Object.keys(nomalum).length) {
      const royxat = Object.entries(nomalum)
        .map(([nom, summa]) => `${nom} — ${money(summa)}`).join(", ");
      out.push({
        id: "billz-nomalum-tolov", level: "warn",
        title: `Billz'da tanilmagan to'lov turi: ${Object.keys(nomalum).length} ta`,
        detail: `${royxat}. Bu pul hech qaysi hamyonga tushmaydi va kassa `
          + "solishtiruvida ko'rinmaydi. Tur `lib/billzMap.js` → `PAYMENT_KINDS` "
          + "ro'yxatiga qo'shilishi kerak.",
        action: "Sozlamalarni ochish", href: "/settings",
      });
    }

    // N.2) Do'koni tanilmagani uchun chek UMUMAN yozilmagan.
    // Billz'da do'kon qayta nomlansa `matchStores()` uni topolmaydi
    // va o'sha do'konning hamma cheki tashlanadi. Bu MASHINA
    // nosozligi — nomni tuzatish bilan hal bo'ladi, shuning uchun
    // darvozani yopadi (`bloklamaydi` qo'yilmagan).
    if (cheklar?.noStore > 0) {
      const dokonlar = cheklar.warnings?.unmatchedShops ?? [];
      out.push({
        id: "billz-dokonsiz", level: "error",
        title: `${cheklar.noStore} ta chek do'koni tanilmagani uchun YOZILMADI`,
        detail: (dokonlar.length
          ? `Billz'da mos kelmagan do'kon: ${dokonlar.join(", ")}. `
          : "")
          + "Billz'da do'kon nomi o'zgargan bo'lishi mumkin — NSPOS'dagi "
          + "`stores` nomi bilan bir xil bo'lishi kerak. Ungacha o'sha "
          + "do'konning savdosi hisobga umuman kirmaydi.",
        action: "Sozlamalarni ochish", href: "/settings",
      });
    }

    // N.3) Tortish CHALA tugagan.
    // Bir chaqiriqda 300 chek yoki 280 soniya chegarasi bor. Har
    // yurish chala tugayversa orqada qolish o'sib boradi, eng yangi
    // chek esa baribir bugungi bo'lib turaveradi — ya'ni eskirish
    // tekshiruvi buni KO'RMAYDI.
    //
    // `null` — bu ustun paydo bo'lishidan oldingi eski yozuv, u
    // "chala" degani emas. Ikkisi ataylab farqlanadi.
    if (cheklar && cheklar.exhausted === false && cheklar.finishedAt) {
      const soat = Math.floor((Date.now() - new Date(cheklar.finishedAt)) / 3600_000);
      if (soat >= 2) {
        out.push({
          id: "billz-chala", level: "warn",
          title: `Billz'dan tortish chala tugagan — ${soat} soatdan beri davom etmagan`,
          detail: "Oxirgi yurish chegaraga urilib to'xtagan ('yana qoldi'), keyin esa "
            + "davom ettirilmagan. Cron to'xtagan bo'lishi mumkin. Ma'lumot to'liq "
            + "emas, lekin eng yangi chek bugungi bo'lgani uchun boshqa hech qayerda "
            + "bilinmaydi.",
          action: "Sozlamalarni ochish", href: "/settings",
        });
      }
    }
  }

  // N.3a) KO'ZGU BILLZ BILAN MOS EMAS — farq detektori (`billzSync.
  // moslikTekshir`, har yurish oxirida). Sinxron "OK" deb turib ham
  // ko'zgu orqada qolishi mumkin (filtr to'liq ro'yxat bermaydi,
  // yorliq yozilmaydi) — bu tekshiruv Billz'ning O'Z sonlariga
  // qaraydi. MASHINA nosozligi — darvozani yopadi.
  {
    const m = listSinxronJurnal().find((x) => x.entity === "moslik");
    const farq = m?.warnings?.farq ?? [];
    if (farq.length) {
      out.push({
        id: "billz-farq", level: "error",
        title: `Ko'zgu Billz bilan mos emas: ${farq.length} ta farq`,
        detail: farq.map((f) => `${f.nima}: Billz ${f.billz}, bu yerda ${f.nspos}`).join("; ")
          + ". Sinxron yurgan, lekin ro'yxat to'liq emas — Sozlamalarda to'liq tortish yoki "
          + "`npm run billz -- --full`.",
        action: "Sozlamalarni ochish", href: "/settings",
      });
    }
  }

  // N.3b) Billz qarzi 'billz' yorlig'isiz.
  // Sinxron `source` ni yozmasdi va baza default 'nspos' qo'yardi;
  // `listDebts()` esa faqat 'billz' ni sanardi — 20.08 dan keyingi
  // 150 qarz (20 180 $) ekranda umuman ko'rinmadi (DAFTAR 17). Endi
  // yorliqni sinxron o'zi yozadi; bu yerda qolib ketgani ushlanadi.
  // MASHINA nosozligi — darvozani yopadi.
  {
    const n = yorliqXato();
    if (n > 0) {
      out.push({
        id: "qarz-manba", level: "error",
        title: `${n} ta Billz qarzi 'billz' yorlig'isiz yozilgan`,
        detail: "Billz id'si bor, lekin `source` boshqa. Sinxron yorliqni yozmayapti "
          + "yoki eski qatorlar tuzatilmagan (`scripts/sql/debt-source-tuzat.sql`).",
        action: "Billz'dan yangilash", href: "/settings",
      });
    }
  }

  // N.4) Qarz to'lovining usuli tanilmagan.
  // Ilgari bunday to'lov jimgina "naqd" bo'lib yozilardi — ya'ni pul
  // kassaga tushmagan bo'lsa ham tushgan bo'lib ko'rinardi va kamomad
  // menejer zimmasiga o'tardi. Endi `unknown` bo'lib turadi.
  // Bu ODAM tuzatadigan narsa emas, lekin kod tuzatadi — shuning
  // uchun ogohlantirish bor, darvoza esa yopilmaydi.
  {
    let n = 0, summa = 0;
    for (const d of listDebts()) {
      for (const p of d.payments ?? []) {
        if (p.method !== "unknown") continue;
        n++; summa += +p.amount || 0;
      }
    }
    if (n) {
      out.push({
        id: "qarz-nomalum-usul", level: "warn",
        title: `${n} ta qarz to'lovining usuli tanilmagan — ${money(summa)}`,
        detail: "Billz to'lov usulini erkin matn bilan beradi. Tanilmagani hech "
          + "qaysi hamyonga qo'shilmaydi: pul kassaga tushgan bo'lsa ham kassa "
          + "solishtiruvida ko'rinmaydi. `lib/billzMap.js` → `PAYMENT_KINDS`.",
        action: "Qarzlarni ochish", href: "/finance/debts",
        bloklamaydi: true,
      });
    }
  }

  // N.5) Birorta do'kon B2B deb belgilanmagan.
  //
  // Optom (B2B) va chakana (B2C) ajratishi ALOHIDA sozlama emas:
  // do'konga "B2B menejer" turidagi xodim biriktirilgan bo'lsa, o'sha
  // do'kon B2B hisoblanadi (`kassaData.b2bStoreIds`). Bu qulay —
  // menejer boshqa do'konga o'tsa belgi ham o'zi ko'chadi.
  //
  // Lekin shu qulaylikning narxi bor: menejer o'chirilsa yoki uning
  // KPI turi olib tashlansa, do'kon JIMGINA B2B'likdan chiqadi. Hech
  // qanday xato chiqmaydi — shunchaki optom kassada servis hamyoni
  // paydo bo'ladi va xarajatlar boshqa ustunga tusha boshlaydi.
  // Faqat rahbarga: bu kompaniya sozlamasi.
  if (isOwner && kassaIds().length && !kassaIds().some((k) => isB2bKassa(k))) {
    out.push({
      id: "b2b-belgilanmagan", level: "warn",
      title: "Birorta do'kon optom (B2B) deb belgilanmagan",
      detail: "Optom do'konda servis hamyoni bo'lmasligi kerak, xarajatlar ham "
        + "boshqa ustunga tushadi. Belgi KPI turidan olinadi: o'sha do'kon "
        + "menejeriga \"B2B\" turi biriktirilsin.",
      action: "KPI ni ochish", href: "/kpi",
      bloklamaydi: true,
    });
  }

  // ══════════════════════════════════════════════════════════════
  // N) QO'LDA KIRITILADIGAN MA'LUMOT TO'XTAB QOLGAN
  // ══════════════════════════════════════════════════════════════
  // NEGA BU TEKSHIRUV BOR (2026-08-24):
  // 21-avgustdan 24-avgustgacha xarajat, kassa va KPI ga BIRORTA
  // yozuv kiritilmagan — sotuv esa Billz'dan kelib turgani uchun
  // ekran "ishlayotgan"dek ko'rinardi. 20-avgust kechqurun sayt
  // VPS'ga ko'chdi, 21–22 avgust nosoz turdi, xodimlar kiritishni
  // qayta boshlamadi. To'rt kun hech narsa bildirmadi.
  //
  // Yuqoridagi "Sotuv ma'lumoti eskirgan" tekshiruvi buni TUTMAYDI:
  // sotuv har 30 daqiqada yangilanib turadi, ya'ni u doim yashil.
  // Ya'ni eng ishonchli ko'rsatkich eng ko'r joyni yaratgan.
  //
  // Ro'yxatga yangi manba qo'shish — bitta qator (CLAUDE.md: yangi
  // maydon qo'shilsa jamisi va tekshiruvi ham o'sha zahoti).
  {
    const bugun = iso(new Date());
    const kunFarqi = (sana) =>
      Math.floor((new Date(bugun) - new Date(sana)) / 86400000);
    // Ro'yxatdagi eng katta "YYYY-MM-DD" — bo'sh bo'lsa null
    const engOxirgi = (list) =>
      list.reduce((m, d) => (d && (!m || d > m) ? d : m), null);

    const MANBALAR = [
      { id: "expenses", nom: "Xarajat", ogoh: 2, xato: 4,
        oxirgi: () => engOxirgi(listOneOff().map((e) => e.date)),
        amal: "Xarajatlarni ochish", href: "/finance/expenses",
        izoh: "Kunlik xarajat kiritilmasa foyda ko'p, kassa qoldig'i esa katta bo'lib ko'rinadi." },
      { id: "kassa", nom: "Kassa", ogoh: 2, xato: 4,
        oxirgi: () => engOxirgi(listOps().map((o) => o.date)),
        amal: "Kassani ochish", href: "/finance/kassa",
        izoh: "Kun yopilmasa topshirilgan pul hisobga tushmaydi va hamyon balansi haqiqatdan uzoqlashadi." },
      // FAQAT QO'LDA to'ldiriladigan maydonlar bo'yicha o'lchanadi.
      // 2026-08-26 dan Naqd/Payme/Servis va Savdo Billz'dan avtomat
      // to'ladi, ya'ni `kpi_day` qatori bo'lishining o'zi "xodim
      // ishlayapti" degani emas. Bu yerda aynan o'sha xato bo'lardi:
      // eng ishonchli manba eng ko'r joyni yaratadi (CLAUDE.md
      // 2026-08-24) — jadval to'la ko'rinib, kech/dam/kamera/olgan
      // haftalab kiritilmay turardi.
      { id: "kpi", nom: "KPI kunligi", ogoh: 2, xato: 4,
        oxirgi: () => engOxirgi(listAllDays()
          .filter((d) => QOL_MAYDONLAR.some((k) => d[k] !== null && d[k] !== undefined && d[k] !== "" && d[k] !== false))
          .map((d) => d.date)),
        amal: "KPI ni ochish", href: "/kpi",
        izoh: "Kunlik yozuvsiz oylik ham, ustalar reytingi ham hisoblanmaydi." },
      // Kurs har kuni o'zgarmaydi — chegara ataylab uzunroq, aks holda
      // ogohlantirish har kuni turaverib ma'nosini yo'qotardi.
      { id: "rate", nom: "Dollar kursi", ogoh: 7, xato: 14,
        oxirgi: () => iso(lastRate()?.at),
        amal: "Sozlamalarni ochish", href: "/settings",
        izoh: "So'mdagi xarajat eski kurs bilan dollarga o'giriladi." },
    ];

    for (const m of MANBALAR) {
      const oxirgi = m.oxirgi();
      if (!oxirgi) continue;              // umuman yozuv yo'q (demo)
      const kun = kunFarqi(oxirgi);
      if (kun < m.ogoh) continue;
      out.push({
        id: `stale-${m.id}`, level: kun >= m.xato ? "error" : "warn",
        title: `${m.nom}: ${kun} kundan beri kiritilmagan`,
        detail: `Oxirgi yozuv — ${oxirgi}. ${m.izoh}`,
        action: m.amal, href: m.href,
        // Ekranda QIZIL, lekin saytga chiqarishni BLOKLAMAYDI.
        //
        // Farq shu: "Sotuv ma'lumoti eskirgan" — MASHINA ishlamay
        // qolgani (sinxronizatsiya to'xtagan), uni kod bilan tuzatish
        // mumkin, shuning uchun u darvozani yopadi. Bu yerdagilar esa
        // ODAM hali kiritmagani — hech qanday kod uni tuzatmaydi.
        // Bloklasa, darvoza xodim ma'lumot kiritmaguncha doim qizil
        // turardi va tez orada hamma unga e'tibor bermay qo'yardi
        // (DAFTAR 10.4: yolg'on jurnal haqiqiy nosozlikni yashiradi).
        bloklamaydi: true,
      });
    }
  }

  return out;
}
