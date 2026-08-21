"use client";
import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { t } from "@/lib/i18n";
import { PERIODS, periodRange, fmtDate } from "@/lib/dates";
import DateRangePicker from "@/components/DateRangePicker";

// ══════════════════════════════════════════════════════════════
// DAVR TANLAGICH
// ══════════════════════════════════════════════════════════════
// Bir xil o'n satr kod O'N TA sahifada nusxalangan edi: dashboard,
// management, kpi, services, plan, expenses, operations, payroll,
// pnl, kassa/[id]. Har nusxada `period`, `range`, `pickerOpen`
// holatlari va bir xil razmetka qayta yozilgan.
//
// Nusxa ko'p bo'lsa ular asta og'ib boradi: birida tugma `px-5 py-3`,
// boshqasida `px-4 py-2`; birida davr almashganda `period` tozalanadi,
// boshqasida yo'q. Va yangi qoida qo'shilsa (masalan "Kecha" olib
// tashlansin) uni o'n joyda tuzatish kerak bo'ladi.
//
// Ishlatish:
//   const davr = usePeriod("Oy");
//   <PeriodPicker {...davr} />
//   ... davr.range.from / davr.range.to
export function usePeriod(bosh = "Oy") {
  const [period, setPeriod] = useState(bosh);
  const [range, setRange] = useState(() => periodRange(bosh));
  const [open, setOpen] = useState(false);

  return {
    period, range, open,
    tanla: (p) => { setPeriod(p); setRange(periodRange(p)); },
    // Qo'lda oraliq tanlanganda `period` TOZALANADI — aks holda
    // tabda "Oy" yonib turadi-yu, oraliq boshqa bo'ladi.
    qol: (from, to) => { setPeriod(null); setRange({ from, to }); setOpen(false); },
    ochYop: () => setOpen((v) => !v),
    yop: () => setOpen(false),
    setRange,
  };
}

export default function PeriodPicker({ period, range, open, tanla, qol, ochYop, yop }) {
  return (
    // Telefonda ustma-ust: tab-lenta va sana tugmasi bitta qatorga
    // sig'maydi (375px da sana tugmasi tablarni siqib qo'yardi).
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div className="bg-track rounded-2xl p-1.5 flex overflow-x-auto">
        {PERIODS.map((p) => (
          <button key={p} onClick={() => tanla(p)}
            className={`tab-btn whitespace-nowrap ${period === p ? "active" : ""}`}>
            {t(p)}
          </button>
        ))}
      </div>

      <div className="relative shrink-0">
        <button onClick={ochYop}
          className="card flex items-center gap-3 px-4 sm:px-5 py-2.5 sm:py-3 font-bold w-full sm:w-auto">
          <CalendarDays size={20} className="text-brand shrink-0" />
          <span className="text-right leading-tight text-sm sm:text-base">
            {fmtDate(range.from)}<br />{fmtDate(range.to)}
          </span>
        </button>
        {open && (
          <DateRangePicker from={range.from} to={range.to}
            onApply={qol} onClose={yop} />
        )}
      </div>
    </div>
  );
}
