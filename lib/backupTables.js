// ══════════════════════════════════════════════════════════════
// ZAXIRAGA TUSHADIGAN JADVALLAR — YAGONA RO'YXAT
// ══════════════════════════════════════════════════════════════
// Ro'yxat alohida faylda turadi, chunki u UCH joyda kerak:
//   1. `app/api/backup/route.js` — kunlik zaxira
//   2. tiklash yo'li — zaxira fayldan bazaga qaytarish
//   3. tekshiruv — har jadval haqiqatda o'qilyaptimi
// Ikki nusxa bo'lsa ular ertami-kech ajralib ketadi va bitta jadval
// jimgina zaxirasiz qolib ketadi (aynan shunday bo'lgan edi).
//
// Yangi jadval qo'shilsa — FAQAT shu yerga qo'shiladi.
//
// `staff_directory` ro'yxatda YO'Q: u jadval emas, `profiles` ustidagi
// ko'rinish (view). Ma'lumot yo'qolmaydi — `profiles` o'zi ro'yxatda.
// Ko'rinishga qaytadan yozib ham bo'lmaydi, ya'ni tiklash uni baribir
// chetlab o'tishi kerak edi.
//
// `audit_log` ataylab kiritilmagan: u bazaning eng katta jadvali va
// zaxira faylini Telegram cheklovidan (50 MB) oshirib yuboradi.
// U tarixiy jurnal — yo'qolsa hisob-kitob buzilmaydi.
export const BACKUP_TABLES = [
  // —— Tizim va xodimlar ——
  "companies", "stores", "profiles", "invites", "doc_counters",
  // —— Mijoz va qarz ——
  "customers", "debts", "debt_payments",
  // —— KPI, oylik, NPS ——
  "kpi_day", "kpi_plan", "kpi_assign", "nps_records",
  "payroll_payments", "store_plans",
  // —— Moliya ——
  "expenses", "kassa_ops", "payouts", "usd_rates",
  // Eski kassa modeli — hali `lib/financeData.js` ga ulangan
  "cash_operations",
  // —— Ta'minot va import ——
  "suppliers", "supplier_invoices", "supplier_payments",
  "shipments", "shipment_items", "shipment_costs",
  // —— Katalog, savdo, ombor ——
  "categories", "products", "stock", "sales", "sale_items",
  "warehouse_operations", "warehouse_items", "shifts",
  // —— Servis ——
  "service_orders", "service_items",
  // —— Yuklangan Excel hisobotlar ——
  // Bularsiz tiklashdan keyin ДДС, P&L va kunlik yakun sahifalari
  // bo'shab qoladi
  "datasets", "dataset_chunks",
  // —— Billz kursori ——
  // Yo'qolsa tiklashdan keyin BUTUN tarix (9 000+ chek) qaytadan
  // tortiladi — bir necha soatlik ish
  "billz_sync_log",
];
