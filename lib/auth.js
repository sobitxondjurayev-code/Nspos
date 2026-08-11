"use client";
// ══════════════════════════════════════════════════════════════
// ROLLAR VA RUXSATLAR
// ══════════════════════════════════════════════════════════════
// Tizimga bir nechta xodim kiradi: kassir, omborchi, menejer, egasi.
// Har biri o'z ishiga kerakli qismni ko'radi.
//
// MUHIM: bu qatlam faqat INTERFEYSNI boshqaradi — tugmani yashiradi,
// sahifani yopadi. Haqiqiy himoya bazada: Supabase RLS siyosatlari
// (schema.sql, "RLS" bo'limi). Brauzerdagi tekshiruvni chetlab o'tish
// mumkin, bazadagisini yo'q. Ikkalasi ham bo'lishi shart.

export const ROLES = {
  owner: {
    label: "Egasi",
    hint: "To'liq huquq: moliya, xarajat, ish haqi, sozlamalar",
  },
  manager: {
    label: "Menejer",
    hint: "Savdo, ombor, mijozlar, hisobotlar. O'z do'koni kassasi va unga ruxsat berilgan xarajat turlari",
  },
  cashier: {
    label: "Kassir",
    hint: "Faqat kassa: sotuv, qaytarish, o'z smenasi, mijoz qarzi",
  },
  storekeeper: {
    label: "Omborchi",
    hint: "Ombor, qabul, ko'chirish, inventarizatsiya",
  },
  installer: {
    label: "O'rnatuvchi usta",
    hint: "Faqat o'ziga biriktirilgan xizmat buyurtmalari",
  },
};

// —— Huquqlar ro'yxati ————————————————————————————
// Nom qoidasi: <soha>.<amal>. Yangi imkoniyat qo'shilganda shu yerga
// bitta qator qo'shiladi va rollarga tarqatiladi — sahifalar bo'ylab
// if'lar sochilib ketmasin.
export const PERMISSIONS = {
  // Savdo
  "sale.create": ["owner", "manager", "cashier"],
  "sale.return": ["owner", "manager", "cashier"],
  "sale.viewAll": ["owner", "manager"],          // boshqa kassirlar cheklari
  "sale.discount": ["owner", "manager"],         // chegirma berish

  // Tovar va ombor
  "product.view": ["owner", "manager", "cashier", "storekeeper"],
  "product.edit": ["owner", "manager"],
  "product.price": ["owner"],                    // narx o'zgartirish
  "warehouse.operate": ["owner", "manager", "storekeeper"],
  "warehouse.approve": ["owner", "manager"],     // inventarizatsiyani tasdiqlash

  // Mijozlar
  "customer.view": ["owner", "manager", "cashier"],
  "customer.edit": ["owner", "manager", "cashier"],
  "customer.debt": ["owner", "manager", "cashier"],
  "customer.export": ["owner"],                  // bazani yuklab olish

  // Kassalar (do'kon kassalari + kompaniya balansi)
  // Menejer faqat o'z do'konining kassasini ko'radi — qaysi biri ekani
  // profilidagi do'kondan aniqlanadi (kassaData.kassasOf), shuning uchun
  // bu yerda rol yetarli.
  "kassa.view": ["owner", "manager"],
  "kassa.operate": ["owner", "manager"],   // o'z kassasiga kirim/chiqim
  "kassa.transfer": ["owner", "manager"],  // rahbarga o'tkazma so'rash
  "kassa.company": ["owner"],              // asosiy balansdan chiqim
  "kassa.approve": ["owner"],              // o'tkazmani tasdiqlash

  // Moliya
  "finance.cash": ["owner", "manager", "cashier"],
  "finance.shift": ["owner", "manager", "cashier"],
  // Menejer ham xarajat kiritadi — lekin faqat O'Z kassasidan va rahbar
  // unga ruxsat bergan kategoriyalarda (expenseCategoriesOf).
  "finance.expenses": ["owner", "manager"],
  "finance.payroll": ["owner"],
  // To'lov rejasi — rahbarning shaxsiy ro'yxati: kimga qancha berishi
  // menejerga ham ko'rinmasligi kerak
  "finance.plan": ["owner"],
  "finance.pnl": ["owner"],
  "finance.balance": ["owner"],
  "finance.suppliers": ["owner", "manager"],
  "finance.import": ["owner"],

  // Xizmatlar
  "service.view": ["owner", "manager", "cashier", "installer"],
  "service.edit": ["owner", "manager"],
  "service.own": ["installer"],                  // faqat o'z buyurtmasi

  // Hisobot va boshqaruv
  "report.view": ["owner", "manager"],
  "report.margin": ["owner"],                    // foyda ko'rinadigan hisobotlar
  "management.view": ["owner"],
  "settings.edit": ["owner"],
  "staff.manage": ["owner"],
};

// —— Joriy foydalanuvchi ————————————————————————
// Demo rejimda egasi sifatida kiriladi. Supabase ulanganda bu
// ma'lumot auth sessiyasidan va `profiles` jadvalidan keladi
// (schema.sql), interfeys o'zgarmaydi.
let currentUser = {
  id: "u-owner",
  name: "Sobitxon K.",
  initials: "SK",
  company: "NScamera",
  role: "owner",
  storeId: null,        // null — barcha do'konlar; aks holda faqat o'zinikini
};

export const getUser = () => ({ ...currentUser });

export function setUser(u) {
  currentUser = { ...currentUser, ...u };
  return getUser();
}

// Bazadagi `profiles` qatoridan foydalanuvchini yig'ish.
// Rol va do'kon aynan shu yerdan keladi — brauzerdagi tanlovdan emas.
export function setUserFromProfile(profile, email) {
  const name = profile?.full_name || email || "Foydalanuvchi";
  return setUser({
    id: profile?.id ?? null,
    name,
    initials: name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join(""),
    role: profile?.role ?? "cashier",
    storeId: profile?.store_id ?? null,
    perms: profile?.perms ?? null,   // har xodimga alohida bo'lim ruxsatlari
    email,
  });
}

// —— Sozlanadigan bo'limlar ————————————————————————
// Egasi har xodimga qaysi bo'limlarni ko'rsatishni shu ro'yxatdan
// yoqib/o'chiradi. Kalit — sahifa manzili.
export const SECTIONS = [
  { key: "/dashboard", label: "Boshqaruv paneli" },
  { key: "/data", label: "Ma'lumot yuklash" },
  { key: "/reports", label: "Hisobotlar" },
  { key: "/kpi", label: "KPI va oylik" },
  { key: "/installers", label: "Ustalar reytingi" },
  { key: "/nps", label: "NPS baholari" },
  { key: "/finance", label: "Moliya — kassa" },
  { key: "/finance/kassa", label: "Kassalar va balans" },
  { key: "/finance/plan", label: "Pul rejasi" },
  { key: "/finance/payroll", label: "Ish haqi" },
  { key: "/finance/expenses", label: "Xarajatlar" },
  { key: "/finance/pnl", label: "Foyda va pul oqimi" },
  { key: "/finance/balance", label: "Balans" },
  { key: "/management", label: "Rahbariyat" },
  { key: "/settings", label: "Sozlamalar" },
];

// —— Tekshiruv ————————————————————————————————
export function can(permission, user = currentUser) {
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;          // noma'lum huquq — ruxsat yo'q
  return allowed.includes(user.role);
}

// Bir nechtasidan bittasi yetarli bo'lsa
export const canAny = (list, user = currentUser) => list.some((p) => can(p, user));

// —— Qaysi xarajatni kim kiritadi ————————————————————
// Rahbar har xodimga alohida belgilaydi (Boshqaruv → xodim → ruxsatlar).
// null qaytsa — cheklov yo'q, hamma kategoriya ochiq.
export function expenseCategoriesOf(user = currentUser) {
  if (!user || user.role === "owner") return null;
  const list = user.perms?.expenseCategories;
  return Array.isArray(list) ? list : null;
}

export const canEnterExpense = (category, user = currentUser) => {
  const list = expenseCategoriesOf(user);
  return !list || list.includes(category);
};

// Foydalanuvchi ko'ra oladigan do'konlar
export function visibleStores(stores, user = currentUser) {
  if (!user.storeId) return stores;
  return stores.filter((s) => s.id === user.storeId);
}

// Sahifani ochish huquqi — Sidebar ham, sahifa qorovuli ham shuni ishlatadi
export const ROUTE_PERMISSION = {
  "/dashboard": "report.view",
  "/data": "report.view",
  "/products": "product.view",
  "/products/operations": "warehouse.operate",
  "/sales": "sale.create",
  "/services": "service.view",
  "/clients": "customer.view",
  "/marketing": "customer.view",
  "/reports": "report.view",
  // KPI hammaga ochiq: har xodim o'z oyligini ko'rishi kerak.
  // Boshqalarnikini ko'rish sahifa ichida rol bilan cheklanadi.
  "/kpi": null,
  "/installers": null,   // Ustalar reytingi — sahifa ichida rolга qarab
  "/nps": null,          // NPS baholari — retention menejer/egasi
  "/finance": "finance.cash",
  "/finance/operations": "finance.cash",
  "/finance/shifts": "finance.shift",
  "/finance/debts": "customer.debt",
  "/finance/payables": "finance.suppliers",
  "/finance/payroll": "finance.payroll",
  "/finance/kassa": "kassa.view",
  "/finance/plan": "finance.plan",
  "/finance/expenses": "finance.expenses",
  "/finance/pnl": "finance.pnl",
  "/finance/balance": "finance.balance",
  "/finance/import": "finance.import",
  "/finance/cost": "finance.suppliers",
  "/management": "management.view",
  // Sozlamalar hammaga ochiq: tema, til va profil har bir xodimga kerak.
  // Ichidagi kompaniya sozlamalari alohida `settings.edit` bilan yopiladi.
  "/settings": null,
};

// Kassaga bog'liq bo'limlar: xodimga do'kon biriktirilmagan bo'lsa,
// unda kassa ham yo'q — bo'lim menyuda umuman ko'rinmaydi. Aks holda
// odam bosib kiradi-yu, bo'sh sahifa chiqadi.
const NEEDS_KASSA = ["/finance/kassa", "/finance/expenses"];

// Dinamik manzillar (/data/ds-123) ro'yxatda bo'lmaydi — ota bo'limning
// huquqi qo'llanadi. Aks holda ular hech kim uchun tekshirilmay qolardi.
// Bo'lim BOSH sahifasi — ichida hech qanday raqam yo'q, faqat
// kartochkalar ro'yxati (Moliya: Kassalar, Xarajatlar, Pul rejasi...).
// Kartochkalarning o'zi baribir alohida tekshiriladi, shuning uchun
// ichidagi biror sahifa ochiq bo'lsa, bosh sahifa ham ochiladi.
// Busiz menejer bo'limga umuman kira olmasdi: menyudan bosganda
// birinchi ruxsat etilgan sahifaga tushib qolar va ikkinchisini
// (masalan Xarajatlarni) topolmasdi.
const HUB_PAGES = ["/finance"];

export function canOpen(href, user = currentUser) {
  if (user.role !== "owner" && !user.storeId
      && NEEDS_KASSA.some((p) => href === p || href.startsWith(p + "/"))) {
    return false;
  }
  if (HUB_PAGES.includes(href) && !allowedRaw(href, user)) {
    return Object.keys(ROUTE_PERMISSION)
      .filter((p) => p !== href && p.startsWith(href + "/"))
      .some((child) => canOpen(child, user));
  }
  return allowedRaw(href, user);
}

function allowedRaw(href, user) {
  // Egasi doim hamma narsani ko'radi.
  const secs = (user.role !== "owner" && user.perms) ? user.perms.sections : null;

  // 1-bosqich — har xodimga alohida ruxsat (aniqdan umumiyга yuriladi).
  // Ota bo'lim yopilgan bo'lsa, bolalari ham yopiladi — agar bola uchun
  // alohida ruxsat berilmagan bo'lsa. Shu sabab bu bosqich rol
  // standartidan OLDIN to'liq tekshiriladi.
  if (secs) {
    let p = href;
    while (p) {
      if (p in secs) return !!secs[p];
      const cut = p.lastIndexOf("/");
      if (cut <= 0) break;
      p = p.slice(0, cut);
    }
  }

  // 2-bosqich — rol standarti (per-user ruxsat topilmaganda)
  let path = href;
  while (path) {
    if (path in ROUTE_PERMISSION) {
      const perm = ROUTE_PERMISSION[path];
      return !perm || can(perm, user);
    }
    const cut = path.lastIndexOf("/");
    if (cut <= 0) break;
    path = path.slice(0, cut);
  }
  return true;
}
