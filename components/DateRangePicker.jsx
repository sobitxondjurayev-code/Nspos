"use client";
import { t } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import {
  MONTHS, WEEKDAYS, PERIODS, monthGrid, periodRange,
  fmtDate, sameDay, startOfDay, endOfDay,
} from "@/lib/dates";

// Billz'dagi kabi: chapda kalendar, o'ngda tayyor davrlar, pastda kun/oy/yil maydonlari.
export default function DateRangePicker({ from, to, onApply, onClose }) {
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);
  const [view, setView] = useState(new Date(from.getFullYear(), from.getMonth(), 1));
  const box = useRef(null);

  // Tashqariga bosilganda yopiladi
  useEffect(() => {
    const onDown = (e) => { if (box.current && !box.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  const cells = monthGrid(view.getFullYear(), view.getMonth());
  const shiftMonth = (n) => setView(new Date(view.getFullYear(), view.getMonth() + n, 1));

  // Birinchi bosishda boshlanish, ikkinchisida tugash sanasi tanlanadi
  function pickDay(d) {
    if (!start || (start && end)) { setStart(startOfDay(d)); setEnd(null); return; }
    if (d < start) { setStart(startOfDay(d)); return; }
    setEnd(endOfDay(d));
  }

  const inRange = (d) => start && end && d >= startOfDay(start) && d <= end;
  const isEdge = (d) => (start && sameDay(d, start)) || (end && sameDay(d, end));

  function applyPeriod(p) {
    const r = periodRange(p);
    setStart(r.from); setEnd(r.to);
    setView(new Date(r.from.getFullYear(), r.from.getMonth(), 1));
  }

  // Pastdagi kun/oy/yil maydonlari
  const part = (d, kind) => {
    if (!d) return "";
    return kind === "d" ? String(d.getDate()).padStart(2, "0")
      : kind === "m" ? String(d.getMonth() + 1).padStart(2, "0")
      : String(d.getFullYear());
  };

  const canApply = start && end;

  return (
    <div ref={box} className="absolute right-0 top-full mt-3 z-40 card shadow-pop w-[45rem] overflow-hidden">
      <div className="grid grid-cols-[1fr_280px]">
        {/* Kalendar */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <button onClick={() => shiftMonth(-1)}
              className="p-2 rounded-xl text-brand hover:bg-brand-soft"><ChevronLeft size={22} /></button>
            <p className="text-lg font-extrabold">{MONTHS[view.getMonth()]} {view.getFullYear()}</p>
            <button onClick={() => shiftMonth(1)}
              className="p-2 rounded-xl text-brand hover:bg-brand-soft"><ChevronRight size={22} /></button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-sm font-bold text-muted py-1">{w}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map(({ date, outside }, i) => {
              const edge = isEdge(date);
              const mid = !edge && inRange(date);
              return (
                <button key={i} onClick={() => pickDay(date)}
                  className={`h-10 rounded-xl text-[0.9375rem] font-bold transition-colors
                    ${edge ? "bg-brand text-white"
                      : mid ? "bg-brand-soft text-brand"
                      : outside ? "text-faint hover:bg-surface"
                      : "hover:bg-surface"}`}>
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tayyor davrlar */}
        <div className="p-6 pl-0 space-y-2 border-l border-line">
          {PERIODS.map((p) => {
            const r = periodRange(p);
            const label = sameDay(r.from, r.to)
              ? fmtDate(r.from)
              : `${fmtDate(r.from)} - ${fmtDate(r.to)}`;
            return (
              <button key={p} onClick={() => applyPeriod(p)}
                className="w-full text-left bg-surface hover:bg-brand-soft rounded-2xl px-5 py-3 transition-colors group">
                <p className="font-bold text-brand">{p}</p>
                <p className="text-sm font-semibold text-muted group-hover:text-brand">{label}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pastki qator */}
      <div className="flex items-center justify-between gap-4 px-6 py-5 border-t border-line">
        <div className="flex items-center gap-3">
          {["d", "m", "y"].map((k) => (
            <span key={"s" + k} className="bg-surface rounded-xl px-4 py-2.5 font-bold min-w-[3.5rem] text-center">
              {part(start, k) || "—"}
            </span>
          ))}
          <ArrowRight size={18} className="text-muted mx-1" />
          {["d", "m", "y"].map((k) => (
            <span key={"e" + k} className="bg-surface rounded-xl px-4 py-2.5 font-bold min-w-[3.5rem] text-center">
              {part(end, k) || "—"}
            </span>
          ))}
        </div>
        <button disabled={!canApply} onClick={() => onApply(start, end)}
          className="rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-8 py-3 disabled:opacity-50">
          {t("Qo'llash")}
        </button>
      </div>
    </div>
  );
}
