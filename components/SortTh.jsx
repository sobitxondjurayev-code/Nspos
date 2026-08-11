"use client";
import { useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { t } from "@/lib/i18n";

// ══════════════════════════════════════════════════════════════
// USTUN BO'YICHA SARALASH (ko'p bosqichli)
// ══════════════════════════════════════════════════════════════
// Sarlavhani bosasiz — o'sha ustun bo'yicha saralaydi, yana bossangiz
// teskarisiga. SHIFT bilan bossangiz — avvalgisini saqlab, ikkinchi
// darajali saralash qo'shiladi: "eng ko'p sotilgani, ular orasidan
// eng foydalisi". Tartib raqami sarlavhada ko'rinadi.
//
// Bo'sh qiymatlar har doim oxirida — aks holda "—" lar tepani egallardi.

const isEmpty = (v) => v === null || v === undefined || v === "";

function compare(a, b, key, dir) {
  const mul = dir === "asc" ? 1 : -1;
  const va = a[key], vb = b[key];
  const ea = isEmpty(va), eb = isEmpty(vb);
  if (ea && eb) return 0;
  if (ea) return 1;
  if (eb) return -1;
  if (typeof va === "number" && typeof vb === "number") return (va - vb) * mul;
  return String(va).localeCompare(String(vb), "ru") * mul;
}

export function useSort(initialKey = null, initialDir = "desc") {
  // Bir nechta bosqich: [{ key, dir }, ...] — birinchisi asosiy
  const [keys, setKeys] = useState(initialKey ? [{ key: initialKey, dir: initialDir }] : []);

  const toggle = (key, additive = false) => {
    setKeys((cur) => {
      const i = cur.findIndex((k) => k.key === key);
      // Shift bilan — bosqich qo'shiladi yoki mavjudining yo'nalishi almashadi
      if (additive) {
        if (i < 0) return [...cur, { key, dir: "desc" }];
        const next = [...cur];
        // Uchinchi bosishda shu bosqich olib tashlanadi
        if (next[i].dir === "asc") return next.filter((k) => k.key !== key);
        next[i] = { key, dir: "asc" };
        return next;
      }
      // Oddiy bosish — faqat shu ustun qoladi
      if (i === 0 && cur.length === 1) {
        return [{ key, dir: cur[0].dir === "desc" ? "asc" : "desc" }];
      }
      return [{ key, dir: "desc" }];
    });
  };

  const sortRows = (rows) => {
    if (!keys.length) return rows;
    return [...rows].sort((a, b) => {
      for (const { key, dir } of keys) {
        const c = compare(a, b, key, dir);
        if (c !== 0) return c;
      }
      return 0;
    });
  };

  const clear = () => setKeys(initialKey ? [{ key: initialKey, dir: initialDir }] : []);

  return { sort: keys, toggle, sortRows, clear };
}

export default function SortTh({ label, sortKey, sort, onSort, align = "left", className = "" }) {
  const idx = sort.findIndex((k) => k.key === sortKey);
  const active = idx >= 0;
  const dir = active ? sort[idx].dir : null;
  const Icon = !active ? ChevronsUpDown : dir === "asc" ? ChevronUp : ChevronDown;
  const just = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";

  return (
    <th className={`px-3 py-4 font-bold text-${align} ${className}`}>
      <button type="button"
        onClick={(e) => onSort(sortKey, e.shiftKey)}
        title={t("Bosing — saralash. Shift bilan bosing — qo'shimcha bosqich.")}
        className={`w-full inline-flex items-center gap-1.5 ${just} hover:text-brand transition-colors ${active ? "text-brand" : ""}`}>
        <span>{t(label)}</span>
        <Icon size={14} className={active ? "" : "opacity-40"} />
        {/* Bir nechta bosqich bo'lsa tartib raqami */}
        {active && sort.length > 1 && (
          <span className="text-[0.625rem] font-extrabold bg-brand text-white rounded px-1 leading-4">{idx + 1}</span>
        )}
      </button>
    </th>
  );
}
