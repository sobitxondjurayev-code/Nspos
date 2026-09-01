"use client";
import { t, tt } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

// ══════════════════════════════════════════════════════════════
// BIR NECHTA QIYMAT TANLANADIGAN RO'YXAT (filtr uchun)
// ══════════════════════════════════════════════════════════════
// `value === null` — "Barchasi" (hech narsa cheklanmagan); aks holda
// tanlangan kalitlar massivi. Aynan `ExpenseModal` dagi
// `!list || list.includes(k)` qoidasi: null = hammasi.
//
// Nega alohida modal emas: bu filtr, oyna emas — fon skrolli
// qulflanmaydi (`useOyna` ISHLATILMAYDI), tashqariga bosilsa yopiladi.
// Popover CHAPGA (`left-0`) yopishadi: `DateRangePicker` dagi 375px
// xatosi aynan `right-0` dan chiqqan edi.
//
// Har o'zgarish YANGI massiv yoki null qaytaradi — sahifadagi
// `useMemo` bog'lamlari aynan shunga tayanadi.
export default function MultiSelect({
  label, options = [], value = null, onChange, allLabel = "Barchasi", className = "",
}) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const btn = useRef(null);

  // Tashqariga bosilganda yoki Esc'da yopiladi — faqat ochiq turganda tinglanadi
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => {
      if (e.key === "Escape") { setOpen(false); btn.current?.focus(); }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isOn = (v) => value != null && value.includes(v);
  const toggle = (v) => {
    if (value == null) return onChange([v]);              // hammasidan → bittasi
    const next = value.includes(v) ? value.filter((x) => x !== v) : [...value, v];
    onChange(next.length ? next : null);                  // oxirgisi olinsa → yana hammasi
  };

  const labelOf = (v) => options.find((o) => o.value === v)?.label ?? v;
  const chosen = value ?? [];
  const text = value == null ? t(allLabel)
    : chosen.length === 1 ? t(labelOf(chosen[0]))
    : tt("{n} ta tanlandi", { n: chosen.length });
  const title = value == null ? "" : chosen.map((v) => t(labelOf(v))).join(", ");

  return (
    <div ref={box} className={`relative ${className}`}>
      {label && <span className="block text-sm font-bold mb-2">{t(label)}</span>}
      <button ref={btn} type="button" onClick={() => setOpen((o) => !o)} title={title}
        aria-haspopup="listbox" aria-expanded={open}
        className={`inp flex items-center justify-between gap-2 text-left ${
          value ? "border-brand bg-brand-soft text-brand" : ""}`}>
        <span className="truncate">{text}</span>
        <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div role="listbox" aria-multiselectable="true"
          className="absolute left-0 top-full mt-2 z-40 card shadow-pop p-2 w-full min-w-[16rem]
                     max-w-[calc(100vw-2rem)] max-h-[60vh] overflow-y-auto">
          {/* "Barchasi" — belgilansa cheklov olib tashlanadi; belgisini olib bo'lmaydi */}
          <label className={`flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer border-b border-line mb-1 pb-2 ${
            value == null ? "text-brand" : "hover:bg-surface"}`}>
            <input type="checkbox" checked={value == null} onChange={() => onChange(null)}
              className="w-4 h-4 accent-brand shrink-0" />
            <span className="font-bold text-sm">{t(allLabel)}</span>
          </label>

          {options.map((o) => {
            const on = isOn(o.value);
            return (
              <label key={o.value}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                  on ? "bg-brand-soft text-brand" : "hover:bg-surface"}`}>
                <input type="checkbox" checked={on} onChange={() => toggle(o.value)}
                  className="w-4 h-4 accent-brand shrink-0" />
                <span className="font-semibold text-sm">{t(o.label)}</span>
              </label>
            );
          })}

          {options.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted font-semibold">{t("Tanlash uchun hech narsa yo'q")}</p>
          )}
        </div>
      )}
    </div>
  );
}
