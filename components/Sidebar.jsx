"use client";
import { t } from "@/lib/i18n";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PieChart,
  Wallet, Briefcase, Settings, ChevronRight, ChevronsLeft, MessageCircle,
  Sun, Moon, LogOut, Target, Trophy, Star, LayoutDashboard, Users,
} from "lucide-react";
import { canOpen, ROLES } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";
import { LANGS } from "@/lib/i18n";
import { useLang } from "@/components/LangProvider";
import { useTheme } from "@/components/ThemeProvider";
import YangilashTugma from "@/components/YangilashTugma";

// Moliya modullari ko'payib borgani uchun ichki menyu qo'shildi
// (Billz'ning o'zida ham "Продажи" shunday tuzilgan).
// Tovarlar / Sotuvlar / Xizmatlar / Mijozlar / Marketing menyudan
// olib tashlandi: kundalik ish Billz'da yuriladi, bu platforma esa
// Billz bermaydigan narsalar uchun — tahlil, KPI, ustalar, moliya.
// Sahifalar kodda qoldi, kerak bo'lsa menyuga qaytariladi.
// Smenalar ham shu sababdan olindi: kassa smenasi Billz'da yuritiladi,
// bu yerda ikkinchi marta yuritish shart emas.
const menu = [
  // Bosh sahifa ilgari MENYUDA YO'Q edi — unga faqat logotip orqali
  // tushilardi va ko'p foydalanuvchi uning borligini bilmasdi.
  { href: "/dashboard", label: "Bosh sahifa", icon: LayoutDashboard },
  { href: "/reports", label: "Hisobotlar", icon: PieChart },
  // MIJOZLAR MENYUGA QAYTARILDI (2026-08-21). Ilgari u ataylab olib
  // tashlangan edi — "kundalik ish Billz'da yuriladi" degan qoida
  // bo'yicha, va bu to'g'ri edi: mijoz kartochkasini Billz yuritadi.
  //
  // Lekin bu sahifada endi Billz BERMAYDIGAN narsa bor: mijoz
  // segmentatsiyasi (kim asosiy, kim uxlab qolgan, kim ketgan) va
  // qarz bo'yicha xulq — o'rtacha necha kunda qaytaradi. Bular
  // 9 087 mijoz va 16 000 to'lov yozuvidan hisoblanadi.
  //
  // Qolgan besh sahifa (Tovarlar, Cheklar, Xizmatlar, Smenalar,
  // Yetkazib beruvchilar) menyudan TASHQARIDA qoladi — ular bo'yicha
  // qoida o'zgarmadi.
  { href: "/clients", label: "Mijozlar", icon: Users },
  { href: "/kpi", label: "KPI va oylik", icon: Target },
  { href: "/installers", label: "Ustalar reytingi", icon: Trophy },
  { href: "/nps", label: "NPS baholari", icon: Star },
  {
    // Ichki ro'yxat MENYUDA OCHILADI (2026-08-21 dan). Ilgari
    // `hideChildren: true` turgan va sabab shunday izohlangan edi:
    // "Moliya bosh sahifasida har bo'lim kartochka bo'lib turibdi,
    // bir xil ro'yxatni ikki joyda ko'rsatish ortiqcha".
    //
    // Amalda buning narxi bor edi: Xarajatlardan Kassaga o'tish uchun
    // MENYU → MOLIYA → kartochkani topish → bosish kerak bo'lardi.
    // Ya'ni qo'shni bo'limga o'tish uchun har safar hub orqali
    // aylanib chiqiladi. Foydalanuvchi shuni "kerakli raqamgacha
    // uzoq" deb aytdi.
    //
    // Endi ikkalasi ham bor: hub kartochkalari asosiy raqamni
    // ko'rsatadi, menyu esa TEZ o'tish uchun.
    href: "/finance", label: "Moliya", icon: Wallet,
    children: [
      { href: "/finance/kassa", label: "Kassalar va balans" },
      { href: "/finance/plan", label: "Pul rejasi" },
      { href: "/finance/operations", label: "Kassa operatsiyalari" },
      { href: "/finance/debts", label: "Qarz to'lovlari" },
      // Yetkazib beruvchilar hozircha yuritilmaydi ("keyinroq" deyilgan)
      // — bo'sh bo'lim ro'yxatda turmasin. Sahifa kodda qoldi, kerak
      // bo'lganda bitta qator bilan qaytariladi.
      // { href: "/finance/payables", label: "Yetkazib beruvchilar" },
      { href: "/finance/payroll", label: "Ish haqi" },
      { href: "/finance/expenses", label: "Xarajatlar" },
      { href: "/finance/pnl", label: "Foyda va pul oqimi" },
      { href: "/finance/balance", label: "Balans" },
      { href: "/finance/cost", label: "Import va tannarx" },
    ],
  },
  { href: "/management", label: "Rahbariyat", icon: Briefcase },
  { href: "/settings", label: "Sozlamalar", icon: Settings },
];

export default function Sidebar({ mobileOpen = false, onClose }) {
  const pathname = usePathname();
  const { user, signOut, demo } = useAuth();
  const { lang, setLang } = useLang();
  const { theme, toggle } = useTheme();

  // Bo'lim ichida turgan bo'lsak, ichki menyu ochiq bo'ladi
  const inSection = (href) => pathname === href || pathname.startsWith(href + "/");

  // Rolga yopiq bo'limlar menyuda umuman ko'rinmaydi. Bo'lim ochiq,
  // lekin ichki punktlarining hammasi yopiq bo'lsa — bo'lim ham olib
  // tashlanadi (bo'sh menyu qolmasin).
  const allowed = menu
    .map((m) => ({
      ...m,
      children: m.children?.filter((c) => canOpen(c.href, user)),
      // Bo'limning O'ZI yopiq, lekin ichidagi biror sahifa ochiq bo'lishi
      // mumkin (masalan Moliya yopiq, Kassalar ochiq). Bunda bo'lim nomi
      // ko'rinadi, lekin uni bosganda taqiqlangan sahifaga olib bormaydi —
      // birinchi ochiq bolasiga o'tadi.
      self: canOpen(m.href, user),
      // Ichki ro'yxat odatda yashiriladi (Moliya bosh sahifasining o'zida
      // har bo'lim kartochka bo'lib turadi). LEKIN bo'limning o'zi yopiq
      // bo'lsa, o'sha bosh sahifa ochilmaydi — u holda ichki ro'yxat
      // ko'rsatilishi SHART, aks holda menejer birinchi bo'limdan
      // narisiga o'tolmay qoladi (Kassalarga tushib, Xarajatlarni
      // topolmagan holat).
      hideChildren: m.hideChildren && canOpen(m.href, user),
    }))
    .filter((m) => m.self || m.children?.length);

  return (
    <>
      {/* Telefonda ochiq drawer orqasidagi qoraytirish */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-overlay/50 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside className={`w-[17.5rem] shrink-0 h-screen bg-panel border-r border-line flex flex-col z-50
        fixed inset-y-0 left-0 transition-transform duration-200
        lg:sticky lg:top-0 lg:translate-x-0
        ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
      <div className="flex items-center justify-between px-6 py-6">
        <Link href="/dashboard" onClick={onClose} className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center text-white font-extrabold text-xl">N</span>
          <span className="tracking-[.35em] font-extrabold text-lg">NSPOS</span>
        </Link>
        <button onClick={onClose} className="text-muted hover:text-ink lg:hidden" aria-label={t("Yopish")}>
          <ChevronsLeft size={20} />
        </button>
      </div>

      <nav className="px-4 space-y-1 flex-1 overflow-y-auto">
        {allowed.map(({ href, label, icon: Icon, children, self, hideChildren }) => {
          const open = inSection(href);
          // Bo'lim yopiq bo'lsa — havola birinchi ochiq bolasiga ketadi
          const target = self ? href : (children?.[0]?.href ?? href);
          return (
            <div key={href}>
              <Link href={target} onClick={onClose} className={`side-link ${open ? "active" : ""}`}>
                <Icon size={20} />
                <span className="flex-1">{t(label)}</span>
                <ChevronRight size={16}
                  className={`opacity-60 transition-transform ${children && !hideChildren && open ? "rotate-90" : ""}`} />
              </Link>

              {children && !hideChildren && open && (
                <div className="ml-5 pl-4 border-l border-line mt-1 mb-2 space-y-0.5">
                  {children.map((c) => (
                    <Link key={c.href} href={c.href} onClick={onClose}
                      className={`block px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        pathname === c.href
                          ? "text-brand bg-brand-soft"
                          : "text-muted hover:text-ink hover:bg-surface"}`}>
                      {t(c.label)}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Til, yangilash va tema */}
      <div className="px-4 py-4 border-t border-line flex items-center gap-2">
        <div className="bg-track rounded-xl p-1 flex flex-1">
          {LANGS.map((l) => (
            <button key={l.code} onClick={() => setLang(l.code)}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                lang === l.code ? "bg-panel text-ink shadow-card" : "text-muted hover:text-ink"}`}>
              {l.short}
            </button>
          ))}
        </div>
        <YangilashTugma />
        <button onClick={toggle} aria-label="Tema"
          className="w-11 h-11 shrink-0 rounded-xl bg-track text-muted hover:text-brand flex items-center justify-center transition-colors">
          {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
        </button>
      </div>

      <div className="px-6 py-5 flex items-center gap-3 border-t border-line">
        <span className="w-11 h-11 rounded-full bg-brand text-white flex items-center justify-center font-bold">
          {user.initials}
        </span>
        <div className="min-w-0">
          <p className="font-bold leading-tight truncate">{user.name}</p>
          <p className="text-sm text-muted truncate">
            {user.company} · {t(ROLES[user.role]?.label ?? user.role)}
          </p>
        </div>
      </div>

      <div className="m-4 mt-0 flex gap-2">
        <button className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-ink text-panel py-3 font-semibold hover:opacity-90 transition-opacity">
          <MessageCircle size={18} /> {t("Qo'llab-quvvatlash")}
        </button>
        {!demo && (
          <button onClick={signOut} aria-label={t("Chiqish")} title={t("Chiqish")}
            className="w-12 shrink-0 rounded-xl border border-line text-muted hover:text-danger hover:border-danger flex items-center justify-center transition-colors">
            <LogOut size={18} />
          </button>
        )}
      </div>
    </aside>
    </>
  );
}
