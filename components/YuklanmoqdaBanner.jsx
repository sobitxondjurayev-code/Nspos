"use client";
import { useToliq } from "@/components/DataProvider";
import { t } from "@/lib/i18n";

// ══════════════════════════════════════════════════════════════
// OG'IR JADVALLAR KELGUNCHA — HAR SAHIFADA BITTA BANNER
// ══════════════════════════════════════════════════════════════
// Og'ir jadvallar (9 637 chek, 11 752 qarz + 16 346 to'lov, 9 196
// mijoz) fonda 15–60 soniya yuklanadi (tarmoqqa qarab). Shu davrda
// kassa, moliya va hisobot sahifalari QISMAN raqam ko'rsatadi: chek
// kelgan, qarz to'lovi hali kelmagan — Optim kassasi 14 452 $ o'rniga
// "Naqd minusda −61 367 $" va 6 ta "nomuvofiqlik" chiqadi. Bo'sh ekran
// emas, ISHONARLI YOLG'ON (CLAUDE.md 2026-08-13).
//
// 2026-09-03 xodim hisobi bilan sinovda topildi: banner faqat KPI va
// bosh sahifada bor edi, Kassa sahifasida yo'q edi. Endi banner ilova
// qobig'ida — HAR sahifa uchun bitta. Yangi sahifaga alohida banner
// kerak emas; ogohlantirish/audit bloklari esa `useToliq()` bilan
// yuklanguncha yashiriladi (kassa `Warnings` shunday).
export default function YuklanmoqdaBanner() {
  const toliq = useToliq();
  if (toliq) return null;
  return (
    <div className="mb-4 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm font-bold text-muted animate-pulse"
      role="status">
      {t("Billz ma'lumoti hali yuklanmoqda (cheklar, qarz to'lovlari) — kassa, Naqd/Payme/Servis va hisobot raqamlari hozircha to'liq emas.")}
    </div>
  );
}
