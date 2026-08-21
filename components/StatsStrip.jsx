"use client";
import { t } from "@/lib/i18n";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

// ══════════════════════════════════════════════════════════════
// STATISTIKA LENTASI
// ══════════════════════════════════════════════════════════════
// Billz'dagi "Показать статистику" naqshi: sarlavha ostida yig'ma
// raqamlar, kerak bo'lmasa yig'ib qo'yiladi.
//
// Muhim farq: Billz butun katalog bo'yicha ko'rsatadi, bu yerda esa
// FILTRLANGAN ro'yxat bo'yicha. Sababi — "Camera kategoriyasidagi
// tovarlarga qancha pul bog'langan?" degan savol amalda ko'proq
// kerak bo'ladi, umumiy raqamni esa filtrni tozalab olish mumkin.
export default function StatsStrip({ items = [], filtered = false }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="mb-6">
      <button onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-brand font-bold mb-4">
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        {t(open ? "Statistikani yashirish" : "Statistikani ko'rsatish")}
      </button>

      {open && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {items.map((s) => (
              <div key={s.label} className="card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    s.tone ?? "bg-brand-soft text-brand"}`}>
                    <s.icon size={20} />
                  </span>
                  <p className="text-sm font-bold text-muted">{t(s.label)}</p>
                </div>
                {/* Uzun raqam kartadan chiqib ketmasin: uzunlikka qarab
                    shrift kichrayadi va kerak bo'lsa qatorga bo'linadi */}
                <p className={`font-extrabold break-words leading-tight ${
                  String(s.value).length > 20 ? "text-lg"
                  : String(s.value).length > 14 ? "text-xl" : "text-2xl"}`}>
                  {s.value}
                  {s.unit && <span className="text-base text-muted font-bold ml-1.5">{t(s.unit)}</span>}
                </p>
                {s.hint && <p className="text-sm text-muted font-semibold mt-1">{s.hint}</p>}
              </div>
            ))}
          </div>
          {filtered && (
            <p className="text-sm text-muted font-semibold mt-3">
              {t("Raqamlar filtrlangan ro'yxat bo'yicha hisoblangan")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
