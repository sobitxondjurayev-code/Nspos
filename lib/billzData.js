"use client";
// ────────────────────────────────────────────────────────────────
// HAQIQIY BILLZ MA'LUMOTLARI — nskamera.billz.io dan olingan
// Olingan sana: 19.07.2026. Manba sahifalar izohlarda ko'rsatilgan.
// Bu fayl yagona haqiqat manbai: qolgan lib/* modullar shundan seed oladi.
// ────────────────────────────────────────────────────────────────

// —— Kompaniya ko'rsatkichlari ————————————————————————
// Manba: /clients (statistika), /products/catalog (tablar)
// DIQQAT: quyidagi massivlar Billz'ning TO'LIQ bazasi emas — namuna.
// Haqiqiy hajm BILLZ_SCALE da ko'rsatilgan; to'liq ko'chirish uchun
// har hisobotdagi "Скачать" (eksport) tugmasi ishlatilishi kerak.
export const BILLZ_SCALE = {
  products: 641,            // katalog: 65 sahifa × 10
  productUnits: 188310,     // jami dona
  stockCostValue: 275039.75,
  stockSaleValue: 384798,
  avgMarginPct: 30.46,
  customers: 4635,          // 464 sahifa × 10
  transfers: 1630,          // 163 sahifa × 10
  writeoffs: 750,           // 75 sahifa × 10
  revaluations: 4230,       // 423 sahifa × 10
  debtRecords: 10335,       // 2067 sahifa × 5
  leftoverRows: 750,        // qoldiq hisoboti: 15 sahifa × 50
};

export const BILLZ_STATS = {
  // 22.07.2026 holati (19.07 dagi: 4606 / 61 / 2356)
  customersTotal: 4635,
  customersLastWeek: 90,
  customersNotReturning: 2353,
  productsTotal: 193700,
  productsLowStock: 3,
  productsZeroStock: 350,
};

// —— Qarzdorlik ko'rsatkichlari ————————————————————————
// Manba: /clients/debts — o'ng paneldagi jamlanma
export const BILLZ_DEBT_STATS = {
  // 22.07.2026 holati
  totalIssued: 1588312.60,      // Сумма долгов
  totalRepaid: 1329987.66,      // Сумма погашений
  systemRepaid: 200603.49,      // Системные погашения
  outstanding: 57721.45,        // Остаток долгов
  debtorCount: 871,             // Кол-во должников
  closedCount: 9953,            // Погашенные
  openCount: 382,               // Непогашенные
  overdueCount: 372,            // Просроченные
  totalDebtRecords: 2067 * 5,   // ~10 335 yozuv (2067 sahifa × 5)
};

// —— Kunlik jamlanmalar ————————————————————————
// Manba: /order/all?start_date=... — o'ng paneldagi "Распечатать отчет"
// Uch kunlik haqiqiy ma'lumot: sotuv tuzilmasi va to'lov taqsimoti.
export const BILLZ_DAILY = [
  {
    date: "2026-07-22", transactions: 25, itemsSold: 1845, servicesSold: 5,
    returnsCount: 181, returnsAmount: -119.58, exchangeCount: 1, exchangeAmount: -11,
    total: 3580.577, cash: 432.04, payme: 14, debt: 3134.537,
    debtRepaid: 1280.565, debtRepaidPayme: 626.57, debtRepaidCash: 653.995,
  },
  {
    date: "2026-07-21", transactions: 47, itemsSold: 1481, servicesSold: 35,
    returnsCount: 204, returnsAmount: -347.694, exchangeCount: 1, exchangeAmount: 10,
    total: 3993.506, cash: 1205.91, payme: 685.16, debt: 2102.436,
    debtRepaid: 1444.02, debtRepaidPayme: 242.25, debtRepaidCash: 1201.77,
  },
  {
    date: "2026-07-19", transactions: 23, itemsSold: 881, servicesSold: 22,
    returnsCount: 52, returnsAmount: -118.6485, exchangeCount: 0, exchangeAmount: 0,
    total: 3510.514, cash: 1105.1275, payme: 78.2, debt: 2327.1865,
    debtRepaid: 1920.92, debtRepaidPayme: 82.64, debtRepaidCash: 1838.28,
  },
];

export const BILLZ_TODAY = {
  date: "2026-07-19",
  transactions: 23,
  itemsSold: 881,               // Товары
  servicesSold: 22,             // Услуги
  returnsCount: 52,             // Возвраты
  returnsAmount: -118.6485,
  total: 3510.514,              // Сумма транзакций
  cash: 1105.1275,              // Наличные
  payme: 78.2,                  // Payme
  debt: 2327.1865,              // В долг
  debtRepaid: 1920.92,          // Погашение долгов
  debtRepaidPayme: 82.64,
  debtRepaidCash: 1838.28,
};

// —— Do'konlar ————————————————————————————————————
// Manba: /reports/products/leftover — "Магазин" ustuni
export const BILLZ_STORES = [
  { id: "s1", name: "NScamera Optim", color: "#6b8afd" },
  { id: "s2", name: "NScamera Namangan", color: "#b03be0" },
  { id: "s3", name: "Sklad", color: "#f0a53a", warehouse: true },
];

// —— Xodimlar ————————————————————————————————————
// Manba: /reports/shop/summary — "Топ-10 продавцов"
// Sotuvchi ko'rsatkichlari 19.07.2026 kuni bo'yicha
// Nomlar haqiqiy: /reports/sellers, /products/transfer, /products/write-off,
// /products/inventory hujjatlarida uchraydigan foydalanuvchilar.
// salary — NSPOS'ning o'z sozlamasi (Billz'da ish haqi yuritilmaydi).
export const BILLZ_STAFF = [
  { id: "u1", name: "Sobitxon K.", role: "owner", phone: "+998 90 111 22 33", storeId: "s1", active: true,
    salary: 0, salesPct: 0, planBonus: 0 },
  { id: "u2", name: "Abduvohid Kassa", role: "cashier", phone: "+998 91 222 33 44", storeId: "s1", active: true,
    // KPI 22.07.2026 — /reports/sellers/all
    kpi: { revenue: 3245.12, grossProfit: 502.92, avgCheck: 238.15, avgItems: 129.57, avgPrice: 1.84, itemsSold: 1814, share: 91 },
    salary: 300, salesPct: 1.5, planBonus: 100 },
  { id: "u3", name: "Abdulahad Kassa", role: "cashier", phone: "+998 93 333 44 55", storeId: "s2", active: true,
    kpi: { revenue: 335.46, grossProfit: 119.68, avgCheck: 51.88, avgItems: 4.5, avgPrice: 11.53, itemsSold: 36, share: 9 },
    salary: 280, salesPct: 1.5, planBonus: 100 },
  { id: "u7", name: "Sobitxon Kassa", role: "manager", phone: "+998 90 111 22 34", storeId: "s3", active: true,
    kpi: { revenue: 0, share: 0 },
    salary: 250, salesPct: 1, planBonus: 50 },
  { id: "u8", name: "Azizbek Kassa", role: "cashier", phone: "+998 91 222 33 45", storeId: "s1", active: false,
    salary: 280, salesPct: 1.5, planBonus: 100 },
  { id: "u4", name: "Bahodir Qosimov", role: "installer", phone: "+998 94 444 55 66", storeId: "s1", active: true, sharePct: 35,
    salary: 150, salesPct: 0, planBonus: 0 },
  { id: "u5", name: "Sanjar Umarov", role: "installer", phone: "+998 97 555 66 77", storeId: "s1", active: true, sharePct: 30,
    salary: 150, salesPct: 0, planBonus: 0 },
  { id: "u6", name: "Ulug'bek Rasulov", role: "installer", phone: "+998 99 666 77 88", storeId: "s2", active: true, sharePct: 32,
    salary: 150, salesPct: 0, planBonus: 0 },
];

// —— Yetkazib beruvchilar ————————————————————————————
// Manba: /products/suppliers
export const BILLZ_SUPPLIERS = [
  { id: "sup_tosh", name: "toshkent", billzId: "172611", contact: "Toshkent", phone: "",
    debt: 0, orders: 0, paid: 0, productCount: 0 },
  { id: "sup_china", name: "china", billzId: "231379", contact: "Xitoy", phone: "",
    debt: 21, orders: 21, paid: 0, productCount: 1 },
];

// —— Mijozlar ————————————————————————————————————
// Manba: /clients?limit=10 — 1-sahifa (jami 4606 tadan)
// currentDebt — "Текущий долг" ustuni
export const BILLZ_CUSTOMERS = [
  { billzId: "700701090206", name: "nizomjon", phone: "+998 88 388 70 00", purchases: 100, currentDebt: 0, storeId: "s2", registeredAt: "2026-07-19" },
  { billzId: "600701090206", name: "habibullo aka", phone: "+998 99 322 82 82", purchases: 328.04, currentDebt: 0, storeId: "s2", registeredAt: "2026-07-19" },
  { billzId: "500701090206", name: "asadbek aka", phone: "+998 77 272 55 56", purchases: 10, currentDebt: 0, storeId: "s2", registeredAt: "2026-07-19" },
  { billzId: "400701090206", name: "abduqodir aka", phone: "+998 90 218 46 69", purchases: 5, currentDebt: 0, storeId: "s2", registeredAt: "2026-07-19" },
  { billzId: "300701090206", name: "Bobir oka promzon", phone: "+998 94 277 25 20", purchases: 400.62, currentDebt: 0, storeId: "s2", registeredAt: "2026-07-19" },
  { billzId: "100701090206", name: "Murodjon usta 106", phone: "+998 93 923 16 06", purchases: 69, currentDebt: 69, storeId: "s1", registeredAt: "2026-07-19" },
  { billzId: "900701080206", name: "umida opa turaqorg'on", phone: "+998 77 313 20 23", purchases: 198.96, currentDebt: 0, storeId: "s2", registeredAt: "2026-07-18" },
  { billzId: "800701080206", name: "sobitxon aka", phone: "+998 90 641 29 92", purchases: 10, currentDebt: 0, storeId: "s2", registeredAt: "2026-07-18" },
  { billzId: "700701080206", name: "yondagi dom", phone: "+998 91 340 85 14", purchases: 66.1, currentDebt: 0, storeId: "s2", registeredAt: "2026-07-18" },
  { billzId: "600701080206", name: "g'alcha", phone: "+998 91 362 67 62", purchases: 14, currentDebt: 0, storeId: "s2", registeredAt: "2026-07-18" },
  // —— 22.07.2026 da ro'yxatdan o'tganlar ————————————————
  { billzId: "600702020206", name: "elyor aka ulug'nor", phone: "+998 33 307 04 86", purchases: 84, currentDebt: 0, storeId: "s2", registeredAt: "2026-07-22" },
  { billzId: "500702020206", name: "fazo oya", phone: "+998 93 038 55 37", purchases: 0, currentDebt: 0, storeId: "s2", registeredAt: "2026-07-22" },
  { billzId: "400702020206", name: "bobur turaqorg'on", phone: "+998 91 359 57 49", purchases: 0, currentDebt: 0, storeId: "s2", registeredAt: "2026-07-22" },
  { billzId: "300702020206", name: "Sardor oka", phone: "+998 97 250 74 44", purchases: 7.87, currentDebt: 0, storeId: "s2", registeredAt: "2026-07-22" },
  { billzId: "200702020206", name: "odilxon", phone: "+998 93 911 19 29", purchases: 40, currentDebt: 0, storeId: "s2", registeredAt: "2026-07-22" },
  { billzId: "100702020206", name: "lola dukon", phone: "+998 91 760 77 77", purchases: 10, currentDebt: 0, storeId: "s2", registeredAt: "2026-07-22" },
  { billzId: "301702010206", name: "ibrohim", phone: "+998 93 757 02 00", purchases: 3.56, currentDebt: 0, storeId: "s2", registeredAt: "2026-07-21" },
  { billzId: "201702010206", name: "nurillo aka chortoq", phone: "+998 99 322 22 25", purchases: 69, currentDebt: 0, storeId: "s2", registeredAt: "2026-07-21" },
  { billzId: "101702010206", name: "savxo'z", phone: "+998 93 125 00 26", purchases: 141.27, currentDebt: 0, storeId: "s2", registeredAt: "2026-07-21" },
  { billzId: "1702010206", name: "G`ulomjon oka", phone: "+998 90 555 07 57", purchases: 5.16, currentDebt: 0, storeId: "s2", registeredAt: "2026-07-21" },

  // —— Yirik qarzdorlar (22.07 holati) ————————————————
  // Manba: /clients/debts — muddat sanasi bilan
  { billzId: "d-johongir", name: "johongir aka oltin kol", phone: "", purchases: 191.594, currentDebt: 191.594, storeId: "s1", registeredAt: "2026-07-22", dueDate: "2026-07-23" },
  { billzId: "d-aliakbar", name: "117. ALIAKBAR usta Uchqorgon", phone: "", purchases: 1974.5, currentDebt: 1974.5, storeId: "s1", registeredAt: "2026-07-22", dueDate: "2026-07-23" },
  { billzId: "d-muhammad", name: "Muhammad aka kame usta olahamak", phone: "", purchases: 59.012, currentDebt: 14, storeId: "s1", registeredAt: "2026-07-22", dueDate: "2026-07-23" },

  // —— Faol ustalar (sotuvlar tarixidan) ————————————————
  { billzId: "c-bobirxon", name: "120. BOBIRXON oka baliqchi usta", phone: "", purchases: 376, currentDebt: 0, storeId: "s1", registeredAt: "2026-07-21" },
  { billzId: "c-abdubanno", name: "152.abdubanno oka usta", phone: "", purchases: 228, currentDebt: 0, storeId: "s1", registeredAt: "2026-07-21" },
  { billzId: "c-ilyosxon", name: "ilyosxon aka pop usta", phone: "", purchases: 430.5, currentDebt: 0, storeId: "s1", registeredAt: "2026-07-21" },
  { billzId: "c-umidjon", name: "umidjon oka usta", phone: "", purchases: 110, currentDebt: 0, storeId: "s1", registeredAt: "2026-07-21" },
  { billzId: "c-guncha", name: "guncha pilarama", phone: "", purchases: 875.005, currentDebt: 0, storeId: "s2", registeredAt: "2026-07-21" },
  { billzId: "c-ahror", name: "AHROR OKA BALIQCHI", phone: "", purchases: 606, currentDebt: 0, storeId: "s2", registeredAt: "2026-07-21" },
  { billzId: "c-muzaffar", name: "MUZAFFAR", phone: "", purchases: 159.093, currentDebt: 0, storeId: "s1", registeredAt: "2026-07-21" },
  { billzId: "c-islomjon", name: "146.Islomjon oka usta norin", phone: "", purchases: 261.523, currentDebt: 0, storeId: "s1", registeredAt: "2026-07-22" },
  { billzId: "c-abdulloh", name: "140.Abdulloh aka usta uchqorgon", phone: "", purchases: 104, currentDebt: 0, storeId: "s1", registeredAt: "2026-07-22" },
  { billzId: "c-tasniym", name: "Tasniym pizza", phone: "", purchases: 0, currentDebt: 0, storeId: "s1", registeredAt: "2026-07-22" },
  // Qarzdorlar — manba: /clients/debts (telefon ko'rsatilmagan)
  { billzId: "d137", name: "137.SHermurod aka shaxand usta", phone: "", purchases: 1061, currentDebt: 1061, storeId: "s1", registeredAt: "2026-06-20", dueDate: "2026-07-20" },
  { billzId: "d-araboy", name: "araboy aka turaqorgon usta", phone: "", purchases: 314.616, currentDebt: 314.616, storeId: "s1", registeredAt: "2026-06-20", dueDate: "2026-07-20" },
  { billzId: "d-ilhonjon", name: "ILHONJON YANGIQORGON DOKON", phone: "", purchases: 98, currentDebt: 98, storeId: "s1", registeredAt: "2026-06-20", dueDate: "2026-07-20" },
  { billzId: "d134", name: "134. Akramxon oka uychi dokon", phone: "", purchases: 358, currentDebt: 358, storeId: "s1", registeredAt: "2026-06-20", dueDate: "2026-07-20" },
];

// —— Kategoriyalar ————————————————————————————————
// Manba: /reports/shop/summary — "Топ-10 категорий" + /reports/products/leftover
export const BILLZ_CATEGORIES = [
  "Camera", "Connectr", "Vint", "Quti", "Nojka", "NVR", "Poe", "Yupes",
  "Blokpitana", "Domafon", "Monitor", "Rotr", "KALONKA", "Xap", "Jiton", "kabel",
  "Hdmi", "Most", "DS", "CHip", "Vilka", "Zamok", "Mishka", "Ratsiya",
];

// —— Tovarlar ————————————————————————————————————
// Manba: /reports/products/leftover (1-sahifa, 50 qator) — do'konlar kesimida
// qoldiq va tannarx. Bitta tovar bir necha qatorda kelgan bo'lsa yig'ilgan.
export const BILLZ_PRODUCTS = [
  { name: "DS-KIS902-S", sku: "DOMAFON 902", barcode: "2000000005577", category: "Domafon", brand: "HIKvision", salePrice: 260, costPrice: 197, stock: { s1: 7, s2: 2, s3: 0 } },
  { name: "Xitoy ger karobka", sku: "Xitoy", barcode: "2000000005768", category: "Quti", brand: "NS", salePrice: 2, costPrice: 1, stock: { s1: 11, s2: 14, s3: 383 } },
  { name: "Solnichniy 3kuz tr4 4g okam pro", sku: "tr4-4g", barcode: "2000000007724", category: "Camera", brand: "NS", salePrice: 65, costPrice: 44, stock: { s1: 5, s2: 1, s3: 0 } },
  { name: "kabel cat6 310 m higway", sku: "cat6", barcode: "2000000007731", category: "kabel", brand: "NS", salePrice: 0.25, costPrice: 0.14, stock: { s1: 2790, s2: 0, s3: 0 } },
  { name: "Okam-3lens-xlg-wifi", sku: "3kuz qora", barcode: "2000000006093", category: "Camera", brand: "NS", salePrice: 50, costPrice: 25.3, stock: { s1: 4, s2: 5, s3: 11 } },
  { name: "TECH 7ST-DI8087G2H-LIU", sku: "8087", barcode: "2000000006529", category: "Camera", brand: "HIKvision", salePrice: 135, costPrice: 104.3, stock: { s1: 5, s2: 0, s3: 0 } },
  { name: "DS-2CD1347G3H-LIU 3.0", sku: "1347 G3", barcode: "2000000007144", category: "Camera", brand: "HIKvision", salePrice: 75, costPrice: 57, stock: { s1: 4, s2: 0, s3: 0 } },
  { name: "Speedom 36X", sku: "4.5 R.", barcode: "2000000002927", category: "Camera", brand: "NS", salePrice: 135, costPrice: 77, stock: { s1: 8, s2: 0, s3: 30 } },
  { name: "Monitor ahd 10dyum qora", sku: "10dyum", barcode: "2000000004051", category: "Monitor", brand: "NS", salePrice: 110, costPrice: 58.5, stock: { s1: 1, s2: 0, s3: 3 } },
  { name: "RUJE RG-EW300 PRO WIRELESS ROTER", sku: "EW300", barcode: "2000000007663", category: "Rotr", brand: "RUJE", salePrice: 25, costPrice: 16.4, stock: { s1: 3, s2: 0, s3: 0 } },
  { name: "LTE Rotr batarekali", sku: "TFN-99613", barcode: "2000000003948", category: "Rotr", brand: "NS", salePrice: 25, costPrice: 11, stock: { s1: 0, s2: 2, s3: 10 } },
  { name: "2 kuzli wifi okam", sku: "PTZ okam", barcode: "2000000003658", category: "Camera", brand: "NS", salePrice: 35, costPrice: 15.8, stock: { s1: 4, s2: 9, s3: 88 } },
  { name: "Damafon 605 P(C)", sku: "605", barcode: "2000000003306", category: "Domafon", brand: "HIKvision", salePrice: 150, costPrice: 96, stock: { s1: 2, s2: 0, s3: 0 } },
  { name: "KALONKA 20W WS-07", sku: "07.", barcode: "2000000005591", category: "KALONKA", brand: "NS", salePrice: 15, costPrice: 9, stock: { s1: 13, s2: 0, s3: 0 } },
  { name: "icsee 1kuz mini qora", sku: "p8 mn", barcode: "2000000003986", category: "Camera", brand: "NS", salePrice: 30, costPrice: 17.4, stock: { s1: 3, s2: 8, s3: 20 } },
  { name: "AHD Balonchi", sku: "CKZ-30289", barcode: "2000000007243", category: "Camera", brand: "NS", salePrice: 4, costPrice: 2, stock: { s1: 7, s2: 0, s3: 0 } },
  { name: "H20P-ZKMAS Smart zamok", sku: "H20P", barcode: "2000000007076", category: "Domafon", brand: "NS", salePrice: 165, costPrice: 108, stock: { s1: 3, s2: 0, s3: 9 } },
  { name: "Karobka ger.", sku: "JDL-93191", barcode: "2000000001425", category: "Quti", brand: "NS", salePrice: 0.5, costPrice: 0.33, stock: { s1: 125, s2: 242, s3: 0 } },
  { name: "IDS-TCM203-A", sku: "203-A", barcode: "2000000006758", category: "Camera", brand: "HIKvision", salePrice: 410, costPrice: 337.5, stock: { s1: 4, s2: 0, s3: 0 } },
  { name: "Ezviz R5C NVR", sku: "R5C", barcode: "2000000007007", category: "NVR", brand: "EZVIZ", salePrice: 75, costPrice: 55.25, stock: { s1: 1, s2: 0, s3: 0 } },
  { name: "Xap 8port gigabit", sku: "Xap", barcode: "2000000004549", category: "Xap", brand: "NS", salePrice: 15, costPrice: 5.8, stock: { s1: 9, s2: 16, s3: 120 } },
  { name: "1 kuz 845 6x zoomli karnay ptz", sku: "ptz", barcode: "2000000003979", category: "Camera", brand: "NS", salePrice: 45, costPrice: 24.7, stock: { s1: 6, s2: 9, s3: 15 } },
  { name: "LTE Rotr 620 4 shox", sku: "DKN-91960", barcode: "2000000004372", category: "Rotr", brand: "NS", salePrice: 30, costPrice: 14.9, stock: { s1: 10, s2: 6, s3: 50 } },
  { name: "Jiton oddiy", sku: "RLB-72753", barcode: "2000000001524", category: "Jiton", brand: "NS", salePrice: 1, costPrice: 0.11, stock: { s1: 90, s2: 180, s3: 0 } },
  // —— 2-sahifa ————————————————————————————————
  { name: "SMART POE 16+2+1 300W GIGABIT", sku: "16+2 GIGABIT", barcode: "2000000006598", category: "Poe", brand: "Smart", salePrice: 65, costPrice: 36.9, stock: { s1: 2, s2: 0, s3: 16 } },
  { name: "Nojka katta 30+30", sku: "STM-73924", barcode: "2000000001364", category: "Nojka", brand: "NS", salePrice: 4, costPrice: 2, stock: { s1: 12, s2: 0, s3: 100 } },
  { name: "DS-2CD3641G2-IZS (2.7-13.5MM)", sku: "3641G2", barcode: "2000000007700", category: "Camera", brand: "HIKvision", salePrice: 100, costPrice: 75, stock: { s1: 5, s2: 0, s3: 0 } },
  { name: "DP2C", sku: "ezviz", barcode: "2000000005089", category: "Camera", brand: "EZVIZ", salePrice: 95, costPrice: 76.5, stock: { s1: 3, s2: 0, s3: 0 } },
  { name: "NVR 32CH Xmeye", sku: "XM 4K 32", barcode: "2000000002897", category: "NVR", brand: "NS", salePrice: 105, costPrice: 50, stock: { s1: 0, s2: 1, s3: 8 } },
  { name: "DS-2CD1643GO-IZ 2.8-12mm", sku: "4MP 1643", barcode: "2000000004686", category: "Camera", brand: "HIKvision", salePrice: 95, costPrice: 71.25, stock: { s1: 8, s2: 0, s3: 0 } },
  { name: "RJ 45 kat 6 (kannektor)", sku: "kannektor", barcode: "2000000002019", category: "Connectr", brand: "NS", salePrice: 0.08, costPrice: 0.01, stock: { s1: 0, s2: 6783, s3: 16000 } },
  { name: "DS-7616NXI-K1", sku: "NVR", barcode: "2000000003054", category: "NVR", brand: "HIKvision", salePrice: 90, costPrice: 66.6, stock: { s1: 5, s2: 0, s3: 0 } },
  { name: "Usilitel-250W", sku: "250W", barcode: "2000000005997", category: "KALONKA", brand: "HIKvision", salePrice: 160, costPrice: 123.75, stock: { s1: 3, s2: 0, s3: 0 } },
  { name: "DS-7608NXI-K2", sku: "NVR", barcode: "2000000004297", category: "NVR", brand: "Hikvision", salePrice: 105, costPrice: 79, stock: { s1: 13, s2: 0, s3: 0 } },
  { name: "DS-7604NXI-K1", sku: "Hikvision", barcode: "2000000004600", category: "NVR", brand: "HIKvision", salePrice: 70, costPrice: 52.5, stock: { s1: 4, s2: 0, s3: 0 } },
  { name: "Ezviz H8c (3MP) 4G SIM", sku: "ezviz", barcode: "2000000004945", category: "Camera", brand: "EZVIZ", salePrice: 56, costPrice: 46.75, stock: { s1: 13, s2: 5, s3: 24 } },
  { name: "Ezviz h9C (5mp) 4g sim", sku: "h9c", barcode: "2000000007342", category: "Camera", brand: "EZVIZ", salePrice: 90, costPrice: 68.85, stock: { s1: 10, s2: 11, s3: 0 } },
  { name: "DS-7104NI-Q1", sku: "NVR", barcode: "2000000000817", category: "NVR", brand: "Hikvision", salePrice: 36, costPrice: 28.5, stock: { s1: 9, s2: 0, s3: 0 } },
  { name: "DHI-NVR4104-4KS3", sku: "4104 NVR", barcode: "2000000006253", category: "NVR", brand: "Dahua", salePrice: 55, costPrice: 37, stock: { s1: 4, s2: 0, s3: 0 } },
  { name: "Icsee-s6b-20x-wifi", sku: "20xzoom", barcode: "2000000006130", category: "Camera", brand: "NS", salePrice: 80, costPrice: 42.3, stock: { s1: 2, s2: 5, s3: 27 } },
  { name: "DP2 (3MP)", sku: "ezviz", barcode: "2000000005096", category: "Camera", brand: "EZVIZ", salePrice: 115, costPrice: 89.25, stock: { s1: 2, s2: 0, s3: 0 } },
  { name: "DS-2CD1343G2-I 2.8mm", sku: "1343", barcode: "2000000000916", category: "Camera", brand: "Hikvision", salePrice: 43, costPrice: 28.4, stock: { s1: 4, s2: 0, s3: 0 } },
  { name: "DS-2CD1023G2-LIU 2.8MM", sku: "1023 2MP", barcode: "2000000002811", category: "Camera", brand: "Hikvision", salePrice: 36, costPrice: 27, stock: { s1: 10, s2: 0, s3: 0 } },
  { name: "DS-K1T343MFWX (FACE ID)", sku: "FACE ID", barcode: "2000000003740", category: "Domafon", brand: "HIKvision", salePrice: 105, costPrice: 75, stock: { s1: 6, s2: 0, s3: 0 } },
  { name: "DS-KIS606-P(B)", sku: "606 p", barcode: "2000000003467", category: "Domafon", brand: "HIKvision", salePrice: 220, costPrice: 162.1, stock: { s1: 1, s2: 0, s3: 0 } },
  { name: "Nojka timir 218-130k/a", sku: "QRI-50198", barcode: "2000000007595", category: "Nojka", brand: "HIKvision", salePrice: 12, costPrice: 6.5, stock: { s1: 5, s2: 0, s3: 0 } },
  { name: "Ezviz DL20FVS", sku: "20FVS", barcode: "2000000006963", category: "Domafon", brand: "EZVIZ", salePrice: 285, costPrice: 204, stock: { s1: 1, s2: 0, s3: 0 } },
  { name: "DS-7716NXI-K4", sku: "7716 K4", barcode: "2000000006536", category: "NVR", brand: "HIKvision", salePrice: 200, costPrice: 155, stock: { s1: 2, s2: 0, s3: 0 } },
  { name: "Tuya solar bezlimit", sku: "YHN-87216", barcode: "2000000006802", category: "Camera", brand: "NS", salePrice: 105, costPrice: 57, stock: { s1: 2, s2: 8, s3: 19 } },
  { name: "NVR-108MH-K pro", sku: "Hilook", barcode: "2000000005218", category: "NVR", brand: "Hilook", salePrice: 60, costPrice: 48, stock: { s1: 1, s2: 0, s3: 0 } },
  { name: "Hdmi 4K 5MTR", sku: "5 MTR", barcode: "2000000001227", category: "Hdmi", brand: "NS", salePrice: 5, costPrice: 2, stock: { s1: 1, s2: 0, s3: 32 } },
  { name: "Adaptr 2A", sku: "2 A.", barcode: "2000000001289", category: "Blokpitana", brand: "NS", salePrice: 3, costPrice: 1, stock: { s1: 20, s2: 46, s3: 350 } },
  { name: "H80F9 4+4+4MP", sku: "Ezviz", barcode: "2000000005911", category: "Camera", brand: "NS", salePrice: 95, costPrice: 76.5, stock: { s1: 5, s2: 0, s3: 0 } },
  { name: "Granata tashqi panel 606", sku: "606", barcode: "2000000004860", category: "Domafon", brand: "HIKvision", salePrice: 95, costPrice: 76, stock: { s1: 1, s2: 0, s3: 0 } },

  // —— 3-sahifa ————————————————————————————————
  { name: "NS-HD602AI (4MP) TASHQI", sku: "red blu", barcode: "2000000004167", category: "Camera", brand: "NS", salePrice: 32, costPrice: 18.5, stock: { s1: 16, s2: 22, s3: 70 } },
  { name: "most 1.5km", sku: "most", barcode: "2000000002668", category: "Most", brand: "NS", salePrice: 65, costPrice: 23, stock: { s1: 0, s2: 1, s3: 0 } },
  { name: "AC10 Dual-band Gigabit 5/2.4 GHz", sku: "Tenda", barcode: "2000000005508", category: "Rotr", brand: "Tenda", salePrice: 33, costPrice: 21.6, stock: { s1: 0, s2: 1, s3: 0 } },
  { name: "H5 KNOPKA", sku: "H5.", barcode: "2000000006796", category: "DS", brand: "NS", salePrice: 7, costPrice: 2.8, stock: { s1: 3, s2: 0, s3: 0 } },
  { name: "Ezviz DL05", sku: "DL05", barcode: "2000000006956", category: "Domafon", brand: "EZVIZ", salePrice: 145, costPrice: 102, stock: { s1: 3, s2: 0, s3: 0 } },
  { name: "DS-2CD2047G2-L 2.8mm C", sku: "2047G2-L", barcode: "2000000001784", category: "Camera", brand: "Hikvision", salePrice: 95, costPrice: 66, stock: { s1: 6, s2: 0, s3: 0 } },
  { name: "CHip sandisk 256gb", sku: "256gb", barcode: "2000000005737", category: "CHip", brand: "sandisk", salePrice: 20, costPrice: 12.5, stock: { s1: 0, s2: 4, s3: 0 } },
  { name: "Vilka", sku: "LJX-56900", barcode: "2000000001647", category: "Vilka", brand: "NS", salePrice: 0.5, costPrice: 0.21, stock: { s1: 0, s2: 15, s3: 0 } },
  { name: "Xap 24 port 1000mbs", sku: "24 gigabit", barcode: "2000000007458", category: "Xap", brand: "NS", salePrice: 50, costPrice: 28.2, stock: { s1: 4, s2: 0, s3: 11 } },
  { name: "Camera 4mp 438 kalonkali", sku: "438-LM-P", barcode: "2000000000381", category: "Camera", brand: "Seetong", salePrice: 30, costPrice: 18.1, stock: { s1: 6, s2: 25, s3: 229 } },
  { name: "Gibkiy perexod katta 0.2sm/50sm", sku: "ZDK-12209", barcode: "2000000005485", category: "Nojka", brand: "NS", salePrice: 8, costPrice: 5, stock: { s1: 4, s2: 4, s3: 0 } },
  { name: "Mikrafon-COOMA", sku: "IDU-56709", barcode: "2000000005683", category: "KALONKA", brand: "NS", salePrice: 15, costPrice: 8.25, stock: { s1: 14, s2: 0, s3: 0 } },
  { name: "DS-2CD1043G2-I 2.8MM", sku: "ODDIY 4MP", barcode: "2000000000893", category: "Camera", brand: "Hikvision", salePrice: 37, costPrice: 29, stock: { s1: 34, s2: 0, s3: 0 } },
  { name: "DS-2CD2463G2-I(2.8mm)", sku: "6MP ACUSENSE", barcode: "2000000001777", category: "Camera", brand: "Hikvision", salePrice: 56, costPrice: 48, stock: { s1: 17, s2: 0, s3: 0 } },
  { name: "DS-2DE2C400MWG-4G", sku: "4G.", barcode: "2000000004631", category: "Camera", brand: "HIKvision", salePrice: 70, costPrice: 56.25, stock: { s1: 16, s2: 0, s3: 0 } },
  { name: "Ezviz H8C 4MP", sku: "ezviz", barcode: "2000000004976", category: "Camera", brand: "EZVIZ", salePrice: 65, costPrice: 46.75, stock: { s1: 7, s2: 0, s3: 0 } },
  { name: "Speedom 36x (8R)", sku: "8 R.", barcode: "2000000002941", category: "Camera", brand: "NS", salePrice: 195, costPrice: 105, stock: { s1: 16, s2: 0, s3: 20 } },
  { name: "Nojka Ichki", sku: "GWK-10177", barcode: "2000000006635", category: "Nojka", brand: "NS", salePrice: 2, costPrice: 0.6, stock: { s1: 12, s2: 0, s3: 230 } },
  { name: "Repetr 4 shoxli 1200mb", sku: "KMR-66271", barcode: "2000000001005", category: "Rotr", brand: "Pxlink", salePrice: 13, costPrice: 7, stock: { s1: 6, s2: 5, s3: 0 } },
  { name: "Nojka Tashqi", sku: "DVP-20450", barcode: "2000000006642", category: "Nojka", brand: "NS", salePrice: 2, costPrice: 0.5, stock: { s1: 57, s2: 17, s3: 100 } },
  { name: "Zonch 5000mah 6575 Rotr", sku: "6575 rotr", barcode: "2000000007892", category: "Rotr", brand: "NS", salePrice: 40, costPrice: 23, stock: { s1: 6, s2: 4, s3: 0 } },
  { name: "Most 01-5g-kit 2-para 1km", sku: "Tenda", barcode: "2000000005539", category: "Most", brand: "Tenda", salePrice: 85, costPrice: 52.5, stock: { s1: 2, s2: 1, s3: 0 } },
  { name: "Vint (xotira) 8TR WD", sku: "8TR WD", barcode: "2000000000428", category: "Vint", brand: "WD", salePrice: 335, costPrice: 270, stock: { s1: 0, s2: 2, s3: 0 } },
  { name: "KALONKA 3-6W ZT-593", sku: "593", barcode: "2000000005614", category: "KALONKA", brand: "NS", salePrice: 6, costPrice: 3, stock: { s1: 30, s2: 0, s3: 0 } },
  { name: "DS-2CD1063G2-LIU 2.8MM", sku: "SMART", barcode: "2000000001937", category: "Camera", brand: "HIKvision", salePrice: 55, costPrice: 38, stock: { s1: 20, s2: 5, s3: 0 } },
  { name: "chip sandisk 128 gb", sku: "chip 128 gb", barcode: "2000000001814", category: "CHip", brand: "sandisk", salePrice: 19, costPrice: 15, stock: { s1: 0, s2: 26, s3: 90 } },
  // —— 4-sahifa ————————————————————————————————
  { name: "H9C (5MP)", sku: "ezviz", barcode: "2000000005003", category: "Camera", brand: "EZVIZ", salePrice: 85, costPrice: 65.45, stock: { s1: 12, s2: 0, s3: 0 } },
  { name: "Okam-3kuz-grey solnichni 4g TX2", sku: "solnichni 4g", barcode: "2000000006123", category: "Camera", brand: "NS", salePrice: 65, costPrice: 43, stock: { s1: 0, s2: 1, s3: 0 } },
  { name: "Mishka bluetoth", sku: "E3.", barcode: "2000000001135", category: "Mishka", brand: "Meetoo", salePrice: 5, costPrice: 2, stock: { s1: 21, s2: 23, s3: 0 } },
  { name: "Ezviz H5 (3MP) 4G", sku: "H5.", barcode: "2000000007359", category: "Camera", brand: "EZVIZ", salePrice: 60, costPrice: 42.5, stock: { s1: 4, s2: 0, s3: 0 } },
  { name: "hdmi lan 60mtr", sku: "60mtr", barcode: "2000000003917", category: "Hdmi", brand: "hdmi", salePrice: 13, costPrice: 4.7, stock: { s1: 4, s2: 4, s3: 15 } },
  { name: "LTE Rotr 106 2 shox", sku: "LLM-75347", barcode: "2000000003375", category: "Rotr", brand: "NS", salePrice: 25, costPrice: 13.5, stock: { s1: 11, s2: 23, s3: 0 } },
  { name: "4 mp 1343 LIU", sku: "MAF-21789", barcode: "2000000003061", category: "Camera", brand: "HIKvision", salePrice: 50, costPrice: 34.8, stock: { s1: 8, s2: 0, s3: 0 } },
  { name: "vint 12 tr wd", sku: "12 tr wd", barcode: "2000000002804", category: "Vint", brand: "WD", salePrice: 395, costPrice: 300, stock: { s1: 5, s2: 0, s3: 0 } },
  { name: "ip testr 5200C plus", sku: "QIM-62489", barcode: "2000000004402", category: "Camera", brand: "NS", salePrice: 210, costPrice: 137, stock: { s1: 2, s2: 0, s3: 0 } },
  { name: "Ezviz C8C (1080)", sku: "VJA-73766", barcode: "2000000007793", category: "Camera", brand: "EZVIZ", salePrice: 50, costPrice: 38.25, stock: { s1: 6, s2: 0, s3: 12 } },
  { name: "DS 12V", sku: "WYK-33799", barcode: "2000000001593", category: "DS", brand: "NS", salePrice: 0.2, costPrice: 0.06, stock: { s1: 279, s2: 587, s3: 1800 } },
  { name: "DH-SD49225DB-HNY 2MP DAHUA", sku: "49225", barcode: "2000000007809", category: "Camera", brand: "Dahua", salePrice: 295, costPrice: 235.29, stock: { s1: 4, s2: 0, s3: 0 } },
  { name: "SHLAGBAUM TMG300", sku: "TMG300", barcode: "2000000003498", category: "Zamok", brand: "HIKvision", salePrice: 420, costPrice: 279, stock: { s1: 1, s2: 0, s3: 0 } },
  { name: "DS-7632NXI-K2", sku: "nvr", barcode: "2000000001913", category: "NVR", brand: "HIKvision", salePrice: 170, costPrice: 136, stock: { s1: 4, s2: 0, s3: 0 } },
  { name: "Xap 8port MB", sku: "OCQ-22701", barcode: "2000000001104", category: "Xap", brand: "Dahua", salePrice: 8, costPrice: 3, stock: { s1: 11, s2: 10, s3: 149 } },
  { name: "POE 1*2", sku: "MNY-80363", barcode: "2000000004228", category: "Poe", brand: "NS", salePrice: 8, costPrice: 2.6, stock: { s1: 11, s2: 0, s3: 95 } },
  { name: "DS-2CD1047G3H-LIUF/SL", sku: "1047G3", barcode: "2000000007489", category: "Camera", brand: "HIKvision", salePrice: 75, costPrice: 58.5, stock: { s1: 1, s2: 0, s3: 0 } },
  { name: "NS-TU433CRB-LM-P2 KALONKALI", sku: "KALONKALI", barcode: "2000000006376", category: "Camera", brand: "Seetong", salePrice: 30, costPrice: 17.5, stock: { s1: 18, s2: 35, s3: 445 } },
  { name: "Kalonka xaytek 510A OQ", sku: "510 A", barcode: "2000000006833", category: "KALONKA", brand: "HIKvision", salePrice: 22, costPrice: 13.5, stock: { s1: 20, s2: 0, s3: 0 } },
  { name: "H24-ZKMA smart zamok", sku: "H24", barcode: "2000000007106", category: "Zamok", brand: "NS", salePrice: 55, costPrice: 30, stock: { s1: 5, s2: 0, s3: 15 } },
  { name: "D06 4MP star light", sku: "D06", barcode: "2000000007083", category: "Camera", brand: "NS", salePrice: 25, costPrice: 11, stock: { s1: 14, s2: 13, s3: 388 } },
  { name: "ipc360-3lens-xlg", sku: "3kuz", barcode: "2000000006147", category: "Camera", brand: "NS", salePrice: 50, costPrice: 31.2, stock: { s1: 0, s2: 6, s3: 13 } },
  { name: "Xap 16 port 100M", sku: "1616", barcode: "2000000000978", category: "Xap", brand: "NS", salePrice: 20, costPrice: 11.6, stock: { s1: 8, s2: 0, s3: 24 } },
  { name: "kod panel 7612", sku: "iba 7612", barcode: "2000000003474", category: "Zamok", brand: "HIKvision", salePrice: 30, costPrice: 19.5, stock: { s1: 7, s2: 0, s3: 0 } },
  { name: "H3 5MP", sku: "ezviz", barcode: "2000000005034", category: "Camera", brand: "EZVIZ", salePrice: 60, costPrice: 46.75, stock: { s1: 7, s2: 0, s3: 0 } },
  { name: "H6C pro (4MP)", sku: "ezviz", barcode: "2000000004907", category: "Camera", brand: "EZVIZ", salePrice: 42, costPrice: 30.6, stock: { s1: 3, s2: 0, s3: 0 } },
  { name: "404MWG 4G 4X ZOOM", sku: "4+4", barcode: "2000000007779", category: "Camera", brand: "HIKvision", salePrice: 155, costPrice: 123, stock: { s1: 2, s2: 0, s3: 0 } },
  { name: "Hdmi 4K 1,5mtr", sku: "RDA-76855", barcode: "2000000001265", category: "Hdmi", brand: "NS", salePrice: 2, costPrice: 0.8, stock: { s1: 36, s2: 35, s3: 457 } },

  // —— 5-sahifa ————————————————————————————————
  { name: "Zamok Cogar", sku: "DGX-79075", barcode: "2000000001043", category: "Zamok", brand: "Cogar", salePrice: 35, costPrice: 15.75, stock: { s1: 10, s2: 0, s3: 0 } },
  { name: "Hdmi+Vega", sku: "EBX-18525", barcode: "2000000001487", category: "kabel", brand: "NS", salePrice: 7, costPrice: 2, stock: { s1: 0, s2: 4, s3: 14 } },
  { name: "KALONKA 548 10W", sku: "548", barcode: "2000000005652", category: "KALONKA", brand: "NS", salePrice: 10, costPrice: 5.25, stock: { s1: 5, s2: 0, s3: 0 } },
  { name: "SMART POE 16+2+1 300W", sku: "16+2", barcode: "2000000006581", category: "Poe", brand: "Smart", salePrice: 50, costPrice: 29, stock: { s1: 2, s2: 0, s3: 29 } },
  { name: "DS-2DE4215IW-DE T5", sku: "4215", barcode: "2000000005300", category: "Camera", brand: "HIKvision", salePrice: 235, costPrice: 180, stock: { s1: 19, s2: 0, s3: 0 } },
  { name: "4 mp 180gradusli hikvision", sku: "EXP-50084", barcode: "2000000002255", category: "Camera", brand: "HIKvision", salePrice: 100, costPrice: 86, stock: { s1: 1, s2: 0, s3: 0 } },
  { name: "2355 Smart zamok", sku: "IDW-23960", barcode: "2000000007410", category: "Zamok", brand: "NS", salePrice: 60, costPrice: 30, stock: { s1: 2, s2: 1, s3: 25 } },
  { name: "Trupka OQ", sku: "KWN-91363", barcode: "2000000004709", category: "Domafon", brand: "NS", salePrice: 10, costPrice: 7.2, stock: { s1: 3, s2: 0, s3: 0 } },
  { name: "Monitor ip 10dyum seriy", sku: "10dyum", barcode: "2000000004068", category: "Monitor", brand: "NS", salePrice: 110, costPrice: 56, stock: { s1: 2, s2: 0, s3: 2 } },
  { name: "DS-KABV6113-RS KAZEROG", sku: "6113", barcode: "2000000006772", category: "Quti", brand: "HIKvision", salePrice: 10, costPrice: 6.5, stock: { s1: 7, s2: 0, s3: 0 } },
  { name: "2 kuzli seriy icsee S9", sku: "ptz", barcode: "2000000002323", category: "Camera", brand: "icsee", salePrice: 35, costPrice: 18.5, stock: { s1: 1, s2: 7, s3: 123 } },
  { name: "Hicom POE 8+2", sku: "Hicom", barcode: "2000000001555", category: "Poe", brand: "Smart", salePrice: 22, costPrice: 17.42, stock: { s1: 10, s2: 0, s3: 0 } },
  { name: "Shkaf 4 YUNIT 600*600", sku: "KANIHAD", barcode: "2000000006031", category: "Quti", brand: "NS", salePrice: 65, costPrice: 50, stock: { s1: 3, s2: 0, s3: 0 } },
  { name: "Ratsiya C5", sku: "5KM baofeng", barcode: "2000000007137", category: "Ratsiya", brand: "NS", salePrice: 21, costPrice: 14, stock: { s1: 2, s2: 0, s3: 0 } },
  { name: "Nojka timir 1258a-135", sku: "QUF-28071", barcode: "2000000007601", category: "Nojka", brand: "Hikvision", salePrice: 12, costPrice: 7, stock: { s1: 5, s2: 0, s3: 0 } },
  { name: "DS-E04NI-Q1 NVR 1T", sku: "NVR", barcode: "2000000007274", category: "NVR", brand: "HIKvision", salePrice: 125, costPrice: 90, stock: { s1: 4, s2: 0, s3: 0 } },
  { name: "POE Splitter", sku: "KSV-21566", barcode: "2000000005447", category: "Poe", brand: "NS", salePrice: 3, costPrice: 1.3, stock: { s1: 17, s2: 10, s3: 60 } },
  { name: "NS-TC845AT -LY-4GZM 6X ZOOM", sku: "SEETONG", barcode: "2000000006499", category: "Camera", brand: "Seetong", salePrice: 55, costPrice: 32.6, stock: { s1: 6, s2: 3, s3: 19 } },
  { name: "Usilitel -350W", sku: "350W", barcode: "2000000005690", category: "KALONKA", brand: "NS", salePrice: 200, costPrice: 150, stock: { s1: 2, s2: 0, s3: 0 } },
  { name: "Mikrotik Vetnam", sku: "AUZ-32706", barcode: "2000000007625", category: "Rotr", brand: "Mikrotik", salePrice: 105, costPrice: 70, stock: { s1: 10, s2: 0, s3: 0 } },
  { name: "Vega+Hdmi", sku: "GAC-28247", barcode: "2000000001494", category: "kabel", brand: "NS", salePrice: 7, costPrice: 2, stock: { s1: 0, s2: 0, s3: 15 } },
  { name: "Camera 4mp 431 kalonkali", sku: "431-LM-P", barcode: "2000000000350", category: "Camera", brand: "Seetong", salePrice: 28, costPrice: 14.9, stock: { s1: 17, s2: 36, s3: 190 } },
  { name: "DS-2CD2421G0-I 2.8mm C", sku: "2421 2MP", barcode: "2000000000954", category: "Camera", brand: "Hikvision", salePrice: 40, costPrice: 28.5, stock: { s1: 14, s2: 0, s3: 0 } },
  { name: "Ezviz DL-IC-CPU R200 brelok", sku: "brelok", barcode: "2000000006949", category: "Jiton", brand: "EZVIZ", salePrice: 12, costPrice: 6.8, stock: { s1: 2, s2: 0, s3: 0 } },
  { name: "NVR 16 kanalli XM", sku: "XM 4K 16", barcode: "2000000000749", category: "NVR", brand: "Xmeye", salePrice: 45, costPrice: 25, stock: { s1: 1, s2: 1, s3: 10 } },
  { name: "836 Seetong wifi", sku: "KNV-44883", barcode: "2000000006352", category: "Camera", brand: "Seetong", salePrice: 35, costPrice: 19, stock: { s1: 11, s2: 6, s3: 166 } },
  { name: "Magnitniy kroshteyn", sku: "PJL-33873", barcode: "2000000004815", category: "Nojka", brand: "NS", salePrice: 6, costPrice: 4, stock: { s1: 1, s2: 0, s3: 0 } },

  // —— Katalogdan (yangi kelganlar) ————————————————
  { name: "DS-D5024F2-BP2 24li manitor", sku: "24li", barcode: "2000000007915", category: "Monitor", brand: "HIKvision", salePrice: 125, costPrice: 90, stock: { s1: 0, s2: 0, s3: 0 } },
  { name: "DS-2CFSP8-D/4G PT", sku: "SOLAR 2KUZ", barcode: "2000000007908", category: "Camera", brand: "HIKvision", salePrice: 135, costPrice: 105, stock: { s1: 4, s2: 0, s3: 0 }, supplier: "toshkent" },
  { name: "Mikrotik 2 Latvia", sku: "XJE-19483", barcode: "2000000007885", category: "Rotr", brand: "Mikrotik", salePrice: 70, costPrice: 45, stock: { s1: 10, s2: 0, s3: 0 } },
  { name: "DS-2CD1T67G2HP-LIUF/SL", sku: "180 GRADUS", barcode: "2000000007878", category: "Camera", brand: "HIKvision", salePrice: 115, costPrice: 89, stock: { s1: 5, s2: 0, s3: 0 } },
  { name: "DH-SD3D216NB-GNY PTZ 16X ZOOM 2MP", sku: "216 PTZ", barcode: "2000000007861", category: "Camera", brand: "Dahua", salePrice: 165, costPrice: 135, stock: { s1: 4, s2: 0, s3: 0 } },
  { name: "DHI-NVR4108-4KS3", sku: "4108 NVR", barcode: "2000000007854", category: "NVR", brand: "Dahua", salePrice: 75, costPrice: 54, stock: { s1: 3, s2: 0, s3: 0 } },
  { name: "DHI-NVR2104-4KS3", sku: "2104 NVR", barcode: "2000000007847", category: "NVR", brand: "Dahua", salePrice: 50, costPrice: 36.5, stock: { s1: 4, s2: 0, s3: 0 } },
  { name: "DHI-NVR2108-4KS3", sku: "2108 NVR", barcode: "2000000007830", category: "NVR", brand: "Dahua", salePrice: 55, costPrice: 41, stock: { s1: 4, s2: 0, s3: 0 } },
  { name: "DH-C4K-P DAHUA 4MP", sku: "C4K", barcode: "2000000007823", category: "Camera", brand: "Dahua", salePrice: 45, costPrice: 32, stock: { s1: 6, s2: 0, s3: 0 } },
  // Manba: /reports/shop/summary — "Топ-10 продуктов" (bugungi eng ko'p sotilganlar).
  // Bu tovarlar qoldiq hisobotining 1-sahifasiga tushmagan, narxlari
  // shu kategoriyadagi o'xshash tovarlarga qarab qo'yilgan.
  { name: "NET.Store CAT 5", sku: "CAT5", barcode: "2000000008001", category: "kabel", brand: "NET.Store", salePrice: 0.2, costPrice: 0.11, stock: { s1: 1800, s2: 900, s3: 0 }, topSold: 405 },
  { name: "NET.Store CAT 6", sku: "CAT6-NS", barcode: "2000000008002", category: "kabel", brand: "NET.Store", salePrice: 0.25, costPrice: 0.14, stock: { s1: 1200, s2: 600, s3: 0 }, topSold: 270 },
  { name: "RJ-45 CAT 5", sku: "RJ45-5", barcode: "2000000008003", category: "Connectr", brand: "NS", salePrice: 0.1, costPrice: 0.04, stock: { s1: 900, s2: 400, s3: 0 }, topSold: 44 },
  { name: "RJ 45 kat 6", sku: "RJ45-6", barcode: "2000000008004", category: "Connectr", brand: "NS", salePrice: 0.15, costPrice: 0.06, stock: { s1: 600, s2: 300, s3: 0 }, topSold: 8 },
  { name: "Nojka temir", sku: "NOJKA-T", barcode: "2000000008005", category: "Nojka", brand: "NS", salePrice: 2.5, costPrice: 1.3, stock: { s1: 120, s2: 60, s3: 0 }, topSold: 11 },
  { name: "NVR 10CH Seetong", sku: "NVR10", barcode: "2000000008006", category: "NVR", brand: "Seetong", salePrice: 55, costPrice: 38, stock: { s1: 14, s2: 6, s3: 0 }, topSold: 8 },
  { name: "Vint (xotira) 500GB WD", sku: "WD500", barcode: "2000000008007", category: "Vint", brand: "WD", salePrice: 32, costPrice: 22, stock: { s1: 18, s2: 8, s3: 0 }, topSold: 7 },
  { name: "Yupes mini", sku: "YUPES-M", barcode: "2000000008008", category: "Yupes", brand: "NS", salePrice: 12, costPrice: 7, stock: { s1: 25, s2: 10, s3: 0 }, topSold: 7 },
];

// —— Bugungi sotuvlar ————————————————————————————————
// Manba: /order/all?start_date=2026-07-19 (1-sahifa, 10 ta tranzaksiya)
// type: "sale" | "return". amount — Billz ko'rsatgan summa.
export const BILLZ_SALES = [
  { no: "000700055286", type: "return", at: "2026-07-19T20:08:49", amount: -40, storeId: "s1", customer: "137.SHermurod aka shaxand usta", items: 9 },
  { no: "000701099246", type: "sale", at: "2026-07-19T20:07:27", amount: 0, storeId: "s1", customer: "137.SHermurod aka shaxand usta", items: 43 },
  { no: "000701099236", type: "sale", at: "2026-07-19T20:06:18", amount: 1061, storeId: "s1", customer: "137.SHermurod aka shaxand usta", items: 10, payment: "debt" },
  { no: "000701099206", type: "sale", at: "2026-07-19T19:33:05", amount: 100, storeId: "s2", customer: "nizomjon", items: 93 },
  { no: "000701093266", type: "sale", at: "2026-07-19T18:46:08", amount: 314.616, storeId: "s1", customer: "araboy aka turaqorgon usta", items: 92, payment: "debt" },
  { no: "000701096286", type: "sale", at: "2026-07-19T18:30:45", amount: 328.04, storeId: "s2", customer: "habibullo aka", items: 4 },
  { no: "000701095266", type: "sale", at: "2026-07-19T18:28:39", amount: 98, storeId: "s1", customer: "ILHONJON YANGIQORGON DOKON", items: 10, payment: "debt" },
  { no: "000701097216", type: "sale", at: "2026-07-19T18:14:32", amount: 358, storeId: "s1", customer: "134. Akramxon oka uychi dokon", items: 1, payment: "debt" },
  { no: "000701096296", type: "sale", at: "2026-07-19T18:07:26", amount: 10, storeId: "s2", customer: "asadbek aka", items: 1 },
  { no: "000701096256", type: "sale", at: "2026-07-19T17:45:19", amount: 5, storeId: "s2", customer: "abduqodir aka", items: 1 },
];

// —— Haqiqiy tranzaksiyalar ————————————————————————
// Manba: /order/all — 22.07 (25 ta) va 21.07 (47 ta).
// type: sale | return | exchange
export const BILLZ_TRANSACTIONS = [
  // 22.07.2026
  { no: "000603004246", type: "return", at: "2026-07-22T18:10:18", amount: -33.94, storeId: "s1", customer: "Tasniym pizza", items: -84 },
  { no: "000602190206", type: "return", at: "2026-07-22T18:08:56", amount: -45.64, storeId: "s1", customer: "Tasniym pizza", items: -95 },
  { no: "000702111206", type: "sale", at: "2026-07-22T18:02:37", amount: 141.27, storeId: "s2", customer: "savxo'z", items: 25 },
  { no: "000702026256", type: "sale", at: "2026-07-22T18:00:36", amount: 84, storeId: "s2", customer: "elyor aka ulug'nor", items: 2 },
  { no: "000702026236", type: "sale", at: "2026-07-22T17:51:13", amount: 95, storeId: "s2", customer: "PROMZONA", items: 3 },
  { no: "000702024246", type: "sale", at: "2026-07-22T16:02:00", amount: 191.594, storeId: "s1", customer: "johongir aka oltin kol", items: 187 },
  { no: "000702024296", type: "sale", at: "2026-07-22T15:42:59", amount: 14, storeId: "s1", customer: "SHuxrat akani shogirt", items: 1 },
  { no: "000702024286", type: "sale", at: "2026-07-22T15:38:58", amount: 14, storeId: "s1", customer: "Muhammad aka kame usta olahamak", items: 2 },
  { no: "000702024276", type: "sale", at: "2026-07-22T14:56:39", amount: 512, storeId: "s1", customer: "117. ALIAKBAR usta Uchqorgon", items: 9 },
  { no: "000702023236", type: "sale", at: "2026-07-22T13:53:37", amount: 26.9, storeId: "s2", customer: "ABDURAHMON", items: 2 },
  { no: "000702023256", type: "sale", at: "2026-07-22T13:19:32", amount: 334, storeId: "s1", customer: "134. Akramxon oka uychi dokon", items: 10 },
  { no: "000702023246", type: "sale", at: "2026-07-22T12:58:38", amount: 1462.5, storeId: "s1", customer: "117. ALIAKBAR usta Uchqorgon", items: 157 },
  { no: "000702023216", type: "sale", at: "2026-07-22T12:53:39", amount: 9.5, storeId: "s1", customer: "abdulahad USTA", items: 2 },
  { no: "000702023206", type: "sale", at: "2026-07-22T11:59:36", amount: 30, storeId: "s1", customer: "umidjon oka usta", items: 1 },
  { no: "000702013266", type: "return", at: "2026-07-22T11:58:15", amount: -40, storeId: "s1", customer: "umidjon oka usta", items: -2 },
  { no: "000702022286", type: "sale", at: "2026-07-22T11:52:17", amount: 104, storeId: "s1", customer: "140.Abdulloh aka usta uchqorgon", items: 1105 },
  { no: "000702021286", type: "exchange", at: "2026-07-22T11:41:06", amount: -11, storeId: "s1", customer: "146.Islomjon oka usta norin", items: 0 },
  { no: "000702022246", type: "sale", at: "2026-07-22T11:34:45", amount: 7.87, storeId: "s2", customer: "Sardor oka", items: 1 },
  { no: "000702022226", type: "sale", at: "2026-07-22T11:26:06", amount: 74, storeId: "s1", customer: "150.Abdulbosit aka kamera planet", items: 2 },
  { no: "000702022216", type: "sale", at: "2026-07-22T11:25:25", amount: 17, storeId: "s1", customer: "muzaffar usta", items: 1 },
  { no: "000702021286b", type: "sale", at: "2026-07-22T11:24:17", amount: 261.523, storeId: "s1", customer: "146.Islomjon oka usta norin", items: 320 },
  { no: "000702021216", type: "sale", at: "2026-07-22T10:33:38", amount: 40, storeId: "s2", customer: "odilxon", items: 1 },
  { no: "000702021206", type: "sale", at: "2026-07-22T10:19:28", amount: 272, storeId: "s1", customer: "ilyosxon aka pop usta", items: 16 },
  { no: "000702020266", type: "sale", at: "2026-07-22T09:13:43", amount: 10, storeId: "s2", customer: "lola dukon", items: 1 },
  { no: "000702020256", type: "sale", at: "2026-07-22T09:12:00", amount: 10, storeId: "s2", customer: "SAYDULLOH OKA", items: 1 },

  // 21.07.2026 — eng yirik cheklar
  { no: "000702018266", type: "sale", at: "2026-07-21T19:03:04", amount: 875.005, storeId: "s2", customer: "guncha pilarama", items: 482 },
  { no: "000702016286", type: "sale", at: "2026-07-21T17:08:20", amount: 606, storeId: "s2", customer: "AHROR OKA BALIQCHI", items: 25 },
  { no: "000702014236", type: "sale", at: "2026-07-21T16:51:04", amount: 350.37, storeId: "s2", customer: "muhammadjon", items: 122 },
  { no: "000702013236", type: "sale", at: "2026-07-21T18:30:01", amount: 309.92, storeId: "s2", customer: "abrorbek", items: 74 },
  { no: "000702013216b", type: "sale", at: "2026-07-21T13:13:56", amount: 216, storeId: "s1", customer: "152.abdubanno oka usta", items: 19 },
  { no: "000702019286", type: "sale", at: "2026-07-21T19:53:08", amount: 214.9, storeId: "s2", customer: "ZAM-ZAM mashad", items: 120 },
  { no: "000702111226", type: "sale", at: "2026-07-21T20:43:54", amount: 202, storeId: "s1", customer: "120. BOBIRXON oka baliqchi usta", items: 5 },
  { no: "000702016266", type: "sale", at: "2026-07-21T17:01:11", amount: 174, storeId: "s1", customer: "120. BOBIRXON oka baliqchi usta", items: 8 },
  { no: "000702019216", type: "sale", at: "2026-07-21T19:15:53", amount: 170, storeId: "s1", customer: "139.Mirzaaxror aka usta", items: 2 },
  { no: "000702013296b", type: "sale", at: "2026-07-21T15:52:24", amount: 159.093, storeId: "s1", customer: "MUZAFFAR", items: 222 },
  { no: "000702012286", type: "sale", at: "2026-07-21T12:12:54", amount: 128.5, storeId: "s1", customer: "ilyosxon aka pop usta", items: 8 },
  { no: "000702010246", type: "sale", at: "2026-07-21T09:01:41", amount: 134, storeId: "s1", customer: "Anasxon gtg", items: 5 },
  { no: "000702014206", type: "sale", at: "2026-07-21T15:21:35", amount: 75, storeId: "s1", customer: "143.Abdumalik aka usta uychi dokon", items: 6 },
  { no: "000702018216", type: "sale", at: "2026-07-21T18:37:36", amount: 70.02, storeId: "s2", customer: "promzona", items: 15 },
  { no: "000702017206", type: "sale", at: "2026-07-21T17:32:17", amount: 68.8, storeId: "s2", customer: "", items: 2 },
  { no: "000702112286", type: "sale", at: "2026-07-21T21:50:55", amount: 69, storeId: "s2", customer: "nurillo aka chortoq", items: 2 },
  { no: "000702015206", type: "sale", at: "2026-07-21T16:34:45", amount: 59, storeId: "s2", customer: "0limjon aka", items: 2 },
  { no: "000702017256", type: "sale", at: "2026-07-21T17:59:36", amount: 55, storeId: "s2", customer: "Baxtiyor oka", items: 2 },
  { no: "000702014226", type: "sale", at: "2026-07-21T15:32:39", amount: 53, storeId: "s2", customer: "Dilnoza opa To`da qishloq", items: 2 },
  { no: "000702011296", type: "sale", at: "2026-07-21T12:01:56", amount: 45.012, storeId: "s1", customer: "Muhammad aka kame usta olahamak", items: 310 },
  { no: "000702011256", type: "sale", at: "2026-07-21T10:17:02", amount: 45, storeId: "s1", customer: "BOTIR OKA CHUST USTA", items: 1 },
  { no: "000702013206b", type: "sale", at: "2026-07-21T13:47:50", amount: 23.5, storeId: "s1", customer: "MAMUR OKA USTA", items: 2 },
  { no: "000702003246", type: "exchange", at: "2026-07-21T16:47:32", amount: 10, storeId: "s1", customer: "gofurjon aka usta", items: 0 },
  { no: "000702016266r", type: "return", at: "2026-07-21T20:56:14", amount: -74, storeId: "s1", customer: "120. BOBIRXON oka baliqchi usta", items: -2 },
  { no: "000702013216r", type: "return", at: "2026-07-21T19:23:47", amount: -76.5, storeId: "s1", customer: "152.abdubanno oka usta", items: -9 },
  { no: "000702103206", type: "return", at: "2026-07-21T16:25:23", amount: -43, storeId: "s1", customer: "MUHIDDIN USTA", items: -6 },
  { no: "000702013296r", type: "return", at: "2026-07-21T20:16:59", amount: -30.594, storeId: "s1", customer: "MUZAFFAR", items: -181 },
  { no: "000701074256", type: "return", at: "2026-07-21T09:10:41", amount: -48, storeId: "s1", customer: "160.sohibboy aka chortoq usta", items: -2 },
  { no: "000701049276", type: "return", at: "2026-07-21T15:53:12", amount: -23.6, storeId: "s1", customer: "SOYIBJON OKA", items: -1 },
];

// —— Xizmatlar ————————————————————————————————————
// Billz'da xizmat alohida modul emas, "montaj" nomli tovar sifatida sotiladi
// (bugun 22 ta "Услуги" o'tgan). NSPOS'da alohida modul bor.
export const BILLZ_SERVICE_HINT = { name: "montaj", soldToday: 22 };

// —— Kassa hisoblari ————————————————————————————————
// Manba: /order/cash-shifts — har do'konning nomlangan kassasi bor.
// Ochilish summasi hamma joyda 0: kompaniya smena naqdini yuritmaydi.
export const BILLZ_CASHBOXES = [
  { id: "01070", name: "Kassa NSkamera", storeId: "s1", lastClosed: "2026-07-19T21:01:01" },
  { id: "01071", name: "Kassa nskamera namangan", storeId: "s2", lastClosed: "2026-07-19T20:58:14" },
  { id: "00360", name: "Kassa Sklad", storeId: "s3", lastClosed: "2025-01-01T16:05:24" },
];

// —— "montaj" muammosi ————————————————————————————————
// Manba: /reports/products/leftover, 3-sahifa.
// O'rnatish xizmati Billz'da TOVAR sifatida sotiladi, lekin hech qachon
// kirim qilinmaydi — natijada qoldiq chuqur manfiy:
//   NScamera Optim: -18 567 dona, NScamera Namangan: -312 dona
// Tannarxi 0, "marja 100%". Bu Billz'da xizmatni yuritish imkoni yo'qligini
// ko'rsatadi — NSPOS'dagi alohida Xizmatlar moduli aynan shu muammoni yechadi.
export const BILLZ_MONTAJ_ISSUE = {
  name: "montaj", barcode: "2000000001609",
  salePrice: 10,
  negativeStock: { s1: -18567, s2: -312 },
  soldToday: 22,
};

// —— Sotuvchilar hisoboti ————————————————————————
// Manba: /reports/sellers/all?start_date=2026-07-22
// MUHIM: Billz sof foydani hisoblaydi — ya'ni tannarx ma'lumoti to'liq.
export const BILLZ_SELLER_REPORT = {
  date: "2026-07-22",
  revenue: 3776.39,        // Выручка
  netRevenue: 3580.58,     // Чистая выручка (qaytarishlar ayirilgan)
  netProfit: 622.6,        // Чистая прибыль
};

// —— Ombor operatsiyalari ————————————————————————
// Manba: /products/transfer — 163 sahifa, 10 tasi olindi.
// Har transferda: yaratgan va qabul qilgan xodim, summa, ikki vaqt.
export const BILLZ_TRANSFERS = [
  { id: "1000461", at: "2026-07-22T18:11:44", acceptedAt: "2026-07-22T18:14:11", from: "s1", to: "s2", qty: 174, amount: 29.58, createdBy: "Abduvohid Kassa", acceptedBy: "Abdulahad Kassa" },
  { id: "1000460", at: "2026-07-22T12:52:34", acceptedAt: "2026-07-22T12:54:56", from: "s2", to: "s1", qty: 140, amount: 70, createdBy: "Abdulahad Kassa", acceptedBy: "Abduvohid Kassa" },
  { id: "1000459", at: "2026-07-22T11:50:19", acceptedAt: "2026-07-22T11:50:42", from: "s3", to: "s1", qty: 1000, amount: 80, createdBy: "Abduvohid Kassa", acceptedBy: "Abduvohid Kassa" },
  { id: "1000458", at: "2026-07-22T11:43:34", acceptedAt: "2026-07-22T11:45:12", from: "s2", to: "s1", qty: 1, amount: 45, createdBy: "Abdulahad Kassa", acceptedBy: "Abduvohid Kassa" },
  { id: "1000457", at: "2026-07-22T11:08:58", acceptedAt: "2026-07-22T11:09:51", from: "s3", to: "s1", qty: 13, amount: 415, createdBy: "Abduvohid Kassa", acceptedBy: "Abduvohid Kassa" },
  { id: "1000456", at: "2026-07-22T10:59:58", acceptedAt: "2026-07-22T11:00:39", from: "s3", to: "s1", qty: 2480, amount: 421.6, createdBy: "Abduvohid Kassa", acceptedBy: "Abduvohid Kassa" },
  { id: "1000455", at: "2026-07-22T10:57:31", acceptedAt: "2026-07-22T11:01:21", from: "s3", to: "s2", qty: 1268, amount: 950.8, createdBy: "Abduvohid Kassa", acceptedBy: "Abdulahad Kassa" },
  { id: "1000454", at: "2026-07-22T10:55:51", acceptedAt: "2026-07-22T11:05:32", from: "s3", to: "s1", qty: 13, acceptedQty: 0, amount: 415, createdBy: "Abduvohid Kassa", acceptedBy: "Sobitxon Kassa" },
  { id: "1000453", at: "2026-07-21T21:11:54", acceptedAt: "2026-07-21T21:12:20", from: "s3", to: "s1", qty: 20, amount: 1100, createdBy: "Abduvohid Kassa", acceptedBy: "Abduvohid Kassa" },
  { id: "1000452", at: "2026-07-21T21:06:11", acceptedAt: "2026-07-21T21:07:10", from: "s1", to: "s2", qty: 35, amount: 145, createdBy: "Abduvohid Kassa", acceptedBy: "Abdulahad Kassa" },
];

// Manba: /products/inventory — 6 ta inventarizatsiya, farq summasi bilan
export const BILLZ_INVENTORIES = [
  { id: "1000003", at: "2026-07-22T10:57:09", doneAt: "2026-07-22T11:05:31", storeId: "s1", qty: 13, diff: 0, diffAmount: 0, createdBy: "Abduvohid Kassa", doneBy: "Sobitxon Kassa" },
  { id: "1000002", at: "2026-07-18T13:58:01", doneAt: "2026-07-18T14:21:26", storeId: "s1", qty: 26, diff: 0, diffAmount: 0, createdBy: "Azizbek Kassa", doneBy: "Sobitxon Kassa" },
  { id: "871843", at: "2025-12-29T14:48:25", doneAt: "2025-12-29T14:48:54", storeId: "s1", qty: 6200, diff: 0, diffAmount: 0, createdBy: "Sobitxon NS", doneBy: "Sobitxon NS" },
  { id: "971030", at: "2025-11-23T10:37:37", doneAt: "2025-11-23T11:30:41", storeId: "s1", qty: 4, diff: 0, diffAmount: 0, createdBy: "Sobitxon NS", doneBy: "Sobitxon NS" },
  { id: "953424", at: "2024-12-13T09:42:19", doneAt: "2024-12-13T09:43:41", storeId: "s1", qty: 4, diff: 4, diffAmount: -56, createdBy: "Sobitxon Jurayev", doneBy: "Sobitxon Jurayev" },
  { id: "414605", at: "2024-11-09T11:01:41", doneAt: "2024-11-09T11:02:00", storeId: "s1", qty: 325, diff: 325, diffAmount: -2484.5, createdBy: "Sobitxon Jurayev", doneBy: "Sobitxon Jurayev" },
];

// Manba: /products/write-off — 75 sahifa. Hammasi "Списание с каталога".
// Diqqat: "Сумма" ustunida ikki qiymat — tannarx va sotuv narxi.
export const BILLZ_WRITEOFFS = [
  { id: "1001589", at: "2026-07-15T15:21:57", storeId: "s2", qty: 1, cost: 10.1, price: 20, user: "Sobitxon Kassa" },
  { id: "1001571", at: "2026-07-15T15:18:04", storeId: "s2", qty: 1, cost: 0, price: 35, user: "Sobitxon Kassa" },
  { id: "1001562", at: "2026-07-15T15:16:57", storeId: "s2", qty: 1, cost: 0, price: 25, user: "Sobitxon Kassa" },
  { id: "1001553", at: "2026-07-15T15:15:18", storeId: "s2", qty: 3, cost: 0, price: 90, user: "Sobitxon Kassa" },
  { id: "1001544", at: "2026-07-15T15:13:53", storeId: "s2", qty: 1, cost: 0, price: 25, user: "Sobitxon Kassa" },
  { id: "1001535", at: "2026-07-15T15:12:26", storeId: "s2", qty: 2, cost: 0, price: 50, user: "Sobitxon Kassa" },
  { id: "1001529", at: "2026-07-15T15:03:04", storeId: "s2", qty: 1, cost: 19, price: 35, user: "Sobitxon Kassa" },
  { id: "1001520", at: "2026-07-15T15:00:19", storeId: "s2", qty: 2, cost: 0, price: 90, user: "Sobitxon Kassa" },
  { id: "1001508", at: "2026-07-15T14:56:35", storeId: "s2", qty: 1, cost: 0, price: 75, user: "Sobitxon Kassa" },
  { id: "1001499", at: "2026-07-15T14:55:42", storeId: "s2", qty: 1, cost: 0, price: 135, user: "Sobitxon Kassa" },
];

// Manba: /products/revaluation — 423 sahifa.
// MUHIM: Billz tannarx va sotuv narxini ALOHIDA operatsiya qiladi,
// har do'kon uchun ham alohida. Ya'ni bitta narx o'zgarishi = 6 ta yozuv.
export const BILLZ_REVALUATION_PATTERN = {
  types: ["Изменить цену поставки", "Изменить цену продажи"],
  perStore: true,
  totalPages: 423,
};

// Manba: /products/orders — yetkazib beruvchiga buyurtma
export const BILLZ_PURCHASE_ORDERS = [
  { id: "501860", name: "Заказ 2025.10.14 15:33", supplier: "china", storeId: "s3",
    status: "Принят", paid: 0, unpaid: 21 },
];

// —— To'lov turlari ————————————————————————————————
// Manba: /order/all — o'ng paneldagi to'lov taqsimoti.
// Billz'da Payme ham ishlatiladi — NSPOS'da ham bo'lishi kerak.
export const BILLZ_PAYMENT_METHODS = ["cash", "card", "payme", "debt"];
