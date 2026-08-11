"use client";
import { t } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { MONTHS, WEEKDAYS, monthGrid, sameDay } from "@/lib/dates";

// ══════════════════════════════════════════════════════════════
// BITTA SANA TANLAGICH
// ══════════════════════════════════════════════════════════════
// Brauzerning o'z <input type="date"> oynasi tizim tilida ochiladi:
// "August 2026", "Clear", "Today" — o'zbekcha interfeys ichida begona
// ko'rinadi va oy nomi kesilib qoladi. Shuning uchun kalendar ilovaning
// o'zinikidan (DateRangePicker bilan bir xil ko'rinish), faqat bitta kun
// tanlanadigan qilib.
//
// Qiymat "YYYY-MM-DD" ko'rinishida keladi va shunday qaytadi — chaqiruvchi
// kod o'zgarmaydi.

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const parse = (v) => {
  const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};

// "2026-08-05" → "5-avgust, 2026"
const human = (v) => {
  const d = parse(v);
  return d ? `${d.getDate()}-${MONTHS[d.getMonth()].toLowerCase()}, ${d.getFullYear()}` : "";
};

export default function DateField({ value, onChange, className = "" }) {
  const [open, setOpen] = useState(false);
  const picked = parse(value);
  const [view, setView] = useState(() => {
    const d = picked ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const box = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const cells = monthGrid(view.getFullYear(), view.getMonth());
  const shift = (n) => setView(new Date(view.getFullYear(), view.getMonth() + n, 1));
  const today = new Date();

  return (
    <div ref={box} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        className={`inp flex items-center justify-between text-left ${open ? "border-brand" : ""}`}>
        <span className={picked ? "" : "text-muted"}>
          {picked ? human(value) : t("Sanani tanlang")}
        </span>
        <CalendarDays size={18} className="text-brand shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 card shadow-pop p-5 w-[20rem]">
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={() => shift(-1)}
              className="p-1.5 rounded-lg text-brand hover:bg-brand-soft"><ChevronLeft size={20} /></button>
            <p className="font-extrabold">{MONTHS[view.getMonth()]} {view.getFullYear()}</p>
            <button type="button" onClick={() => shift(1)}
              className="p-1.5 rounded-lg text-brand hover:bg-brand-soft"><ChevronRight size={20} /></button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-xs font-bold text-muted py-1">{w}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map(({ date, outside }, i) => {
              const on = picked && sameDay(date, picked);
              const isToday = sameDay(date, today);
              return (
                <button key={i} type="button"
                  onClick={() => { onChange(iso(date)); setOpen(false); }}
                  className={`h-9 rounded-lg text-sm font-bold transition-colors
                    ${on ? "bg-brand text-white"
                      : isToday ? "bg-brand-soft text-brand"
                      : outside ? "text-faint hover:bg-surface"
                      : "hover:bg-surface"}`}>
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <button type="button"
            onClick={() => { onChange(iso(new Date())); setOpen(false); }}
            className="mt-3 w-full rounded-xl bg-surface hover:bg-brand-soft font-bold py-2.5 text-sm transition-colors">
            {t("Bugun")}
          </button>
        </div>
      )}
    </div>
  );
}
