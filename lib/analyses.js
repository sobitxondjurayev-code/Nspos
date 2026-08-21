"use client";
// ══════════════════════════════════════════════════════════════
// TAHLILLAR RO'YXATI
// ══════════════════════════════════════════════════════════════
// Tizim "fayl yuklash" dan emas, TAHLILDAN boshlanadi.
//
// Foydalanuvchi "Mijozlar ABC" ni ochadi → oxirgi yuklangan ma'lumot
// bo'yicha dashboard chiqadi. "Yangilash" bossa — Billz'ning aynan
// qayeridan qaysi hisobotni olish kerakligi ko'rsatiladi.
//
// Nega shunday: foydalanuvchi "menga qaysi mijozlar muhim?" deb
// o'ylaydi, "Отчет по клиентам.xlsx kerak" deb emas. Kerakli faylni
// tizimning o'zi aytib berishi kerak.
//
// Har tahlil `source` orqali qaysi hisobotga tayanishini bildiradi —
// bitta hisobot bir nechta tahlilga xizmat qilishi mumkin (masalan
// "Отчет по клиентам" ham ABC ga, ham qarzdorlarga).
import {
  Users, Package, TrendingUp, Wallet, Boxes, UserCheck, Clock, PieChart, Trash2, ShoppingCart, Wrench,
  Coins, Snowflake,
} from "lucide-react";

export const ANALYSES = [
  // ── BAZADAN ISHLAYDIGAN TAHLIL ───────────────────────────────
  // `source` YO'Q — `bazadan: true`. Qolgan tahlillar Billz'dan
  // Excel yuklashni talab qiladi, bu esa bazadagi 34 489 chek
  // qatoridan o'qiydi: fayl kutilmaydi, "Yangilash" tugmasi
  // chiqmaydi, ma'lumot doim bugungi.
  //
  // Nega aynan shu tahlil: Billz "eng ko'p SOTILGAN" ni beradi,
  // "eng ko'p FOYDA keltirgan" ni bermaydi — tannarx uning
  // hisobotiga umuman kirmaydi.
  {
    id: "product_profit",
    label: "Tovar kesimida foyda",
    hint: "Qaysi tovar, kategoriya, brend va do'kon qancha SOF foyda keltirdi — tannarx hisobga olingan holda",
    icon: Coins,
    bazadan: true,
    kind: "productProfit",
  },
  {
    id: "stock_health",
    label: "Qoldiq salomatligi",
    hint: "Nimani buyurtma qilish kerak va qaysi tovarga pul muzlab qolgan — ikkalasi bitta joyda",
    icon: Snowflake,
    bazadan: true,
    kind: "stockHealth",
  },
  {
    id: "abc_clients",
    label: "Mijozlar ABC tahlili",
    hint: "Qaysi mijozlar tushumning 80% ini beradi — asosiylari, zaxira va kam ta'sirlilari",
    icon: Users,
    source: {
      reportId: "clients",
      name: "Отчет по клиентам",
      where: "Billz → Отчеты → Клиенты",
      steps: [
        "Billz'ga kiring va chap menyudan Отчеты ni oching",
        "Chap menyudan Клиенты bo'limini tanlang",
        "Mijozlar hisoboti kartasida \"Перейти к отчету\" ni bosing",
        "Yuqori o'ngdagi sanadan davrni tanlang — yil boshidan bugungacha",
        "Скачать bosing va faylni shu yerga tashlang",
      ],
      needs: [["ФИО клиента"], ["Общая сумма покупок"]],
    },
    kind: "abc",
    // ABC hisobi uchun ustunlar — nomi biroz farq qilsa ham topiladi
    valueColumn: ["Общая сумма покупок", "Выручка", "Сумма"],
    labelColumn: ["ФИО клиента", "Клиент"],
    countColumn: ["Продажи", "Покупки", "Кол-во продаж"],
    phoneColumn: ["Телефон"],
  },
  {
    id: "abc_products",
    label: "Tovarlar ABC tahlili",
    hint: "Qaysi tovarlar tushumni ko'taradi va qaysilari javonni band qilib turibdi",
    icon: Package,
    source: {
      reportId: "product_sales",
      name: "Отчет по продажам",
      where: "Billz → Отчеты → Товары",
      steps: [
        "Billz → Отчеты → Товары bo'limini oching",
        "\"Продажи\" hisoboti kartasida \"Перейти к отчету\" ni bosing",
        "Davrni tanlang — yil boshidan bugungacha",
        "Скачать bosing va faylni shu yerga tashlang",
      ],
      needs: [["Наименование"], ["Кол-во проданных"]],
    },
    kind: "abc",
    valueColumn: ["Продажи без учета скидки", "Выручка", "Сумма"],
    labelColumn: ["Наименование"],
    countColumn: ["Кол-во проданных"],
  },
  {
    id: "sellers",
    label: "Sotuvchilar samaradorligi",
    hint: "Kim qancha sotdi, o'rtacha cheki qancha, qancha chegirma berdi",
    icon: UserCheck,
    source: {
      reportId: "sellers",
      name: "Отчет по продавцам",
      where: "Billz → Отчеты → Продавцы",
      steps: [
        "Billz → Отчеты bo'limini oching",
        "Chap menyudan Продавцы ni tanlang",
        "Ikkala hisobot ham to'g'ri keladi:",
        "  · \"Продажи по продавцам\" — sotuvchi × tovar kesimida",
        "  · \"Отчет по продавцам\" — kunlik tushum va chegirma",
        "Davrni tanlang, Скачать bosing va faylni shu yerga tashlang",
      ],
      // Ikki hisobotning ikkisi ham yaraydi — ustun nomlari farq qiladi,
      // shuning uchun har shart uchun bir nechta variant beriladi
      needs: [["Продавец"], ["Выручка", "Продажи без учета скидки"]],
    },
    kind: "generic",
    preset: { dim: "Продавец", measure: ["Выручка", "Продажи без учета скидки"] },
  },
  {
    id: "sales_dynamics",
    label: "Savdo dinamikasi",
    hint: "Kunlik va oylik tushum, to'lov turlari, qaytarishlar",
    icon: TrendingUp,
    source: {
      reportId: "transactions",
      name: "Отчет по транзакциям",
      where: "Billz → Отчеты → Магазин → Транзакции",
      steps: [
        "Billz → Отчеты bo'limini oching",
        "Chap menyudan Магазин ni tanlang",
        "\"Транзакции\" kartasidagi \"Перейти к отчету\" ni bosing",
        "Davrni tanlang — bir yillik olsangiz butun dinamika ko'rinadi",
        "Скачать bosing va faylni shu yerga tashlang",
      ],
      needs: [["ID транзакции"], ["Сумма транзакции"]],
    },
    kind: "generic",
    preset: { dim: "Дата", measure: ["Сумма транзакции"] },
  },
  {
    id: "debtors",
    label: "Qarzdorlar",
    hint: "Kim qancha qarzdor, qaysi cheklar bo'yicha, qancha vaqtdan beri",
    icon: Wallet,
    source: {
      reportId: "client_debts",
      name: "Долги клиентов",
      where: "Billz → Клиенты → Долги клиентов",
      steps: [
        "Billz → Клиенты → Долги клиентов bo'limini oching",
        "Yuqori o'ngdagi sanadan davrni tanlang",
        "Скачать (yoki eksport) tugmasini bosib Excel yuklab oling",
        "Faylni shu yerga tashlang — qolgan qarz bo'yicha hisoblanadi",
      ],
      // Eski tranzaksiya hisoboti ham qabul qilinadi (В долг)
      needs: [["Остаток долга", "В долг"], ["Клиент", "ФИО клиента"]],
    },
    kind: "debtors",
  },
  {
    id: "stock_coverage",
    label: "Ombor qoplamasi",
    hint: "Qaysi tovar necha kunga yetadi, qaysilari qotib qolgan",
    icon: Boxes,
    source: {
      reportId: "efficiency",
      name: "Отчет Эффективность товаров",
      where: "Billz → Отчеты → Товары",
      steps: [
        "Billz → Отчеты → Товары bo'limini oching",
        "\"Эффективность товаров\" kartasida \"Перейти к отчету\" ni bosing",
        "Davrni tanlang — uzunroq davr aniqroq tezlik beradi",
        "Скачать bosing va faylni shu yerga tashlang",
      ],
      // Hisobotda "Оборачиваемость" ustuni yo'q — harakatlar guruhlarga
      // bo'lingan holda keladi. Qoldiq shu harakatlardan hisoblanadi:
      // boshlang'ich + kirim − chiqim.
      needs: [["Продажи товаров"], ["Остаток на"]],
    },
    kind: "stock",
  },
  {
    id: "reorder",
    label: "Buyurtma taklifi",
    hint: "Nimani, qancha buyurtma qilish kerak — sotuv tezligi va qoldiqqa qarab",
    icon: ShoppingCart,
    source: {
      reportId: "efficiency",
      name: "Отчет Эффективность товаров",
      where: "Billz → Отчеты → Товары",
      steps: [
        "Billz → Отчеты → Товары bo'limini oching",
        "\"Эффективность товаров\" kartasida \"Перейти к отчету\" ni bosing",
        "Davrni tanlang — uzunroq davr aniqroq tezlik beradi",
        "Скачать bosing va faylni shu yerga tashlang",
      ],
      needs: [["Продажи товаров"], ["Остаток на"]],
    },
    kind: "reorder",
  },
  {
    id: "service",
    label: "Servis foydasi",
    hint: "O'rnatish xizmati qancha kirim keltirdi va ustalarga qancha ketdi",
    icon: Wrench,
    source: {
      reportId: "efficiency",
      name: "Отчет Эффективность товаров",
      where: "Billz → Отчеты → Товары",
      steps: [
        "Billz → Отчеты → Товары bo'limini oching",
        "\"Эффективность товаров\" kartasida \"Перейти к отчету\" ni bosing",
        "Davrni tanlang va Скачать bosing",
        "Faylni shu yerga tashlang",
      ],
      needs: [["Продажи товаров"], ["Наименование"]],
    },
    kind: "service",
  },
  {
    id: "stock_value",
    label: "Ombor qiymati",
    hint: "Omborda qancha pul bog'langan — do'kon va kategoriya kesimida",
    icon: PieChart,
    source: {
      reportId: "stock",
      name: "Отчет по остаткам",
      where: "Billz → Отчеты → Товары",
      steps: [
        "Billz → Отчеты → Товары bo'limini oching",
        "\"Остатки\" kartasida \"Перейти к отчету\" ni bosing",
        "Скачать bosing — qoldiq hozirgi holat bo'yicha keladi",
        "Faylni shu yerga tashlang",
      ],
      // Hisobotda DONA narxi keladi ("Цена поставки"), summa emas —
      // qiymat qoldiqqa ko'paytirilib o'zimizda hisoblanadi.
      needs: [["Наименование товара", "Наименование"], ["Цена поставки"], ["Кол-во"]],
    },
    kind: "stockValue",
  },
  {
    id: "imports",
    label: "Import partiyalari",
    hint: "Qachon nima kirdi, qanchasi sotildi, qancha pul hali omborda yotibdi",
    icon: Clock,
    source: {
      reportId: "imports",
      name: "Отчет по импортам",
      where: "Billz → Отчеты → Товары",
      steps: [
        "Billz → Отчеты → Товары bo'limini oching",
        "\"Импорты\" kartasida \"Перейти к отчету\" ni bosing",
        "Davrni tanlang va Скачать bosing",
        "Faylni shu yerga tashlang",
      ],
      needs: [["ID импорта"], ["Кол-во импортированных"]],
    },
    kind: "imports",
  },
  {
    id: "writeoffs",
    label: "Hisobdan chiqarishlar",
    hint: "Qancha tovar yo'qotildi — sabab, do'kon va xodim kesimida",
    icon: Trash2,
    source: {
      reportId: "writeoffs",
      name: "Отчет по списаниям",
      where: "Billz → Отчеты → Товары",
      steps: [
        "Billz → Отчеты → Товары bo'limini oching",
        "\"Списания\" kartasida \"Перейти к отчету\" ni bosing",
        "Davrni tanlang va Скачать bosing",
        "Faylni shu yerga tashlang",
      ],
      needs: [["Причина списания"], ["Кол-во списанных"]],
    },
    kind: "writeoffs",
  },
];

export const getAnalysis = (id) => ANALYSES.find((a) => a.id === id) ?? null;

// Ustun nomini moslashuvchan topish: Billz nomga izoh qo'shadi
// ("Общая сумма покупок (всего)"), shuning uchun aynan tenglik emas.
const norm = (s) => String(s).toLowerCase().replace(/[^a-zа-яё0-9]/gi, "");

export function findColumn(header, candidates) {
  if (!candidates) return null;
  for (const want of candidates) {
    const hit = header.find((h) => norm(h).includes(norm(want)));
    if (hit) return hit;
  }
  return null;
}
