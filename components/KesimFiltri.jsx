"use client";
import { useMemo, useState } from "react";
import { useLive } from "@/components/DataProvider";
import { kesimVariantlari } from "@/lib/analytics";
import FilterBar from "@/components/FilterBar";

// ══════════════════════════════════════════════════════════════
// TOVAR KESIMI FILTRI — kategoriya · brend · yetkazib beruvchi
// ══════════════════════════════════════════════════════════════
// Bir xil uchta filtr uch joyda kerak bo'ladi (Ombor qoplamasi,
// Qoldiq salomatligi, Buyurtma taklifi), shuning uchun u BITTA
// joyda turadi: aks holda bir sahifada "Brendsiz" varianti bor-u,
// boshqasida yo'q bo'lib qolardi.
//
// Filtr jadvalga emas, HISOBGA beriladi (`analytics.stockCoverage`
// → `kesim`): shunda kartochka, grafik va jadval bitta tanlov
// bo'yicha chiqadi. `applyFilters` bilan faqat jadval kesilsa,
// "Muzlab qolgan pul" butun katalog bo'yicha qolib ketardi.
//
// Qaytaradi: `kesim` (hisobga beriladigan tanlov) va `panel`
// (FilterBar — sahifa uni o'zi kerakli joyda chizadi).
export function useKesimFiltri() {
  const live = useLive();
  const [filters, setFilters] = useState({});

  // Variantlar KATALOGDAN, tanlangan do'kondan emas: do'kon almashganda
  // ro'yxat qisqarib, tanlangan brend o'zi tozalanib ketardi.
  const variantlar = useMemo(() => kesimVariantlari(), [live]);

  const FIELDS = useMemo(() => [
    { key: "category", label: "Kategoriya", type: "multi",
      options: variantlar.category, get: (r) => r.category },
    // Bitta variantli filtr ma'nosiz — ko'rsatilmaydi
    ...(variantlar.brand.length > 1 ? [{ key: "brand", label: "Brend", type: "multi",
      options: variantlar.brand, get: (r) => r.brand }] : []),
    ...(variantlar.supplier.length > 1 ? [{ key: "supplier", label: "Yetkazib beruvchi",
      type: "multi", options: variantlar.supplier, get: (r) => r.supplier }] : []),
  ], [variantlar]);

  const kesim = useMemo(
    () => ({ category: filters.category, brand: filters.brand, supplier: filters.supplier }),
    [filters]);

  // Tanlov ro'yxatdan yo'qolsa (tovar arxivlandi, kategoriya o'chdi)
  // `FilterBar` o'zi tozalaydi — sahifaga `useEffect` yozilmaydi.
  const panel = <FilterBar fields={FIELDS} filters={filters} onChange={setFilters} />;

  return { kesim, panel };
}
