"use client";
import { t, tt } from "@/lib/i18n";
import { Download } from "lucide-react";
import { exportRows } from "@/lib/exportXlsx";

// Jadval ustidagi qator: nechta yozuv ko'rinayotgani + Excelga yuklash.
// Yuklanadigan narsa aynan ekrandagi ro'yxat — filtr va saralash bilan.
export default function ExportButton({ name, columns, rows, note }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <p className="text-sm text-muted font-semibold">
        {note ?? tt("{n} ta yozuv", { n: rows.length })}
      </p>
      <button type="button" onClick={() => exportRows(name, columns, rows)}
        disabled={!rows.length}
        className="flex items-center gap-2 rounded-xl border border-line font-bold px-4 py-2 hover:border-brand hover:text-brand disabled:opacity-40 shrink-0">
        <Download size={16} /> {t("Excel")}
      </button>
    </div>
  );
}
