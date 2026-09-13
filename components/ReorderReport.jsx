"use client";
import { useState } from "react";
import { t } from "@/lib/i18n";
import { storeOptions } from "@/lib/analytics";
import ReorderPanel from "@/components/ReorderPanel";
import { useKesimFiltri } from "@/components/KesimFiltri";

// ══════════════════════════════════════════════════════════════
// BUYURTMA TAKLIFI — Hisobotlardagi alohida karta
// ══════════════════════════════════════════════════════════════
// 2026-09-04, rahbar qarori: zakaz juma kuni beriladi va uni
// "Qoldiq salomatligi" ichidan qidirib o'tirmaslik kerak.
//
// Ro'yxatning O'ZI bu yerda YOZILMAGAN — u `ReorderPanel` da, ya'ni
// "Qoldiq salomatligi" dagi "Buyurtma qilish kerak" tabi bilan AYNAN
// bir xil kod va AYNAN `analytics.reorderList()`. Ikkinchi nusxa
// yozilganda ikki sahifada ikki xil raqam paydo bo'lardi
// (CLAUDE.md: bir tushuncha — bitta funksiya).
//
// Farqi faqat KIRISH nuqtasida: bu yerda o'lik qoldiq tabi yo'q,
// darrov buyurtma ro'yxati ochiladi.
export default function ReorderReport() {
  const [storeId, setStoreId] = useState("all");
  // Filtr "Qoldiq salomatligi" dagi bilan AYNAN bir xil (bitta hook):
  // bir joyda kategoriya bo'yicha qarab, ikkinchisida qarab bo'lmasligi
  // foydalanuvchi uchun tushunarsiz bo'lardi.
  const { kesim, panel } = useKesimFiltri();

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <select value={storeId} onChange={(e) => setStoreId(e.target.value)}
          className="card px-4 py-3 font-bold bg-panel">
          {storeOptions.map((s) => (
            <option key={s.id} value={s.id}>{t(s.name)}</option>
          ))}
        </select>
      </div>

      {panel}

      <ReorderPanel storeId={storeId} kesim={kesim} />
    </div>
  );
}
