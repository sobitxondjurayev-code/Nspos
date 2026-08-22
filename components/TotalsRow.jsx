"use client";
import { t, tt } from "@/lib/i18n";

// ══════════════════════════════════════════════════════════════
// JADVAL TEPASIDAGI "JAMI" QATORI
// ══════════════════════════════════════════════════════════════
// Hisobotlarda bir xil ko'rinishda bo'lishi uchun bitta joyda.
//
// Joyi: <thead> ichida, sarlavha qatoridan KEYIN. Sarlavha bilan birga
// tepada yopishib turadi — jadval uzun bo'lsa ham jami ko'rinib turadi.
// Fon shaffofmas (bg-panel) bo'lishi shart, aks holda sticky bo'lganda
// tagidan qatorlar ko'rinib ketadi.
//
// MUHIM: jami FILTRDAN o'tgan hamma qator bo'yicha berilishi kerak,
// jadvalda esa odatda 300 tasi ko'rsatiladi. Shuning uchun `count` ni
// chaqiruvchi o'zi beradi — ko'rinib turgan qatorlar soni emas.
//
// cells — qolgan ustunlar uchun qiymatlar (chapdagi `span` ta ustun
// "JAMI" yozuviga ketadi). Bo'sh ustun uchun null beriladi.
export default function TotalsRow({ count, cells, span = 2, hint }) {
  return (
    <tr className="text-[0.9375rem] border-b-2 border-line [&>th]:bg-panel [&>th]:py-4">
      {/* "JAMI" yozuvi chapdagi qotirilgan ustunlar ustida turadi —
          shuning uchun u ham yopishadi, aks holda gorizontal skrollda
          raqamlar ostida "JAMI" yozuvi yo'qolib ketardi. */}
      <th className="px-5 font-extrabold text-left sticky left-0 bg-panel z-30" colSpan={span}>
        {t("JAMI")}
        {count != null && (
          <span className="ml-2 text-sm font-semibold text-muted">
            {hint ?? tt("{n} ta", { n: Number(count).toLocaleString("ru-RU") })}
          </span>
        )}
      </th>
      {cells.map((c, i) => (
        <th key={i} className={`px-3 font-extrabold ${c?.left ? "text-left" : "text-right"} ${c?.className ?? ""}`}>
          {c == null ? "" : c.value}
        </th>
      ))}
    </tr>
  );
}
