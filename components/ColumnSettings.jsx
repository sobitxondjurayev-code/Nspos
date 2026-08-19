"use client";
// ══════════════════════════════════════════════════════════════
// USTUNLARNI SOZLASH
// ══════════════════════════════════════════════════════════════
// Meta Ads Manager'dagi "Customize columns" bilan bir xil ish:
// ro'yxatni tortib tartiblash, keraksizini yashirish, asliga qaytarish.
//
// Kutubxona ishlatilmadi — brauzerning o'z drag&drop hodisalari
// yetarli va ilovaga yana bitta bog'liqlik qo'shilmaydi.
import { t, tt } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { X, GripVertical, Eye, EyeOff, RotateCcw, Lock } from "lucide-react";

export default function ColumnSettings({
  columns,          // [{ key, label }] — TO'LIQ ro'yxat (yashiringanlari ham)
  prefs,            // { order, hidden } | null
  locked = [],      // yashirib bo'lmaydigan kalitlar
  onSave,           // (prefs) => void
  onReset,          // () => void
  onClose,
  // Bu oyna jadval ustunlari uchun ham, kartochkalar uchun ham ishlaydi —
  // faqat nomi o'zgaradi ("ustun" o'rniga "ko'rsatkich" va h.k.)
  title = "Ustunlarni sozlash",
  countLabel = "{n} ta ustun ko'rinadi",
  hint = "Ustunni ushlab tortsangiz joyi almashadi. Ko'z belgisini bossangiz jadvaldan yashirinadi — o'chib ketmaydi, xohlagan payt qaytarasiz.",
}) {
  // Boshlang'ich tartib: sozlama bo'lsa o'shanikidek, bo'lmasa asliday
  const initial = useMemo(() => {
    const byKey = new Map(columns.map((c) => [c.key, c]));
    const out = [];
    for (const k of prefs?.order ?? []) if (byKey.has(k)) { out.push(byKey.get(k)); byKey.delete(k); }
    out.push(...byKey.values());
    return out;
  }, [columns, prefs]);

  const [list, setList] = useState(initial);
  const [hidden, setHidden] = useState(new Set(prefs?.hidden ?? []));
  const [dragKey, setDragKey] = useState(null);

  const isLocked = (k) => locked.includes(k);
  const shownCount = list.filter((c) => !hidden.has(c.key)).length;

  function move(from, to) {
    if (!from || from === to) return;
    const next = [...list];
    const fi = next.findIndex((c) => c.key === from);
    const ti = next.findIndex((c) => c.key === to);
    if (fi < 0 || ti < 0) return;
    const [item] = next.splice(fi, 1);
    next.splice(ti, 0, item);
    setList(next);
  }

  function toggle(k) {
    if (isLocked(k)) return;
    const next = new Set(hidden);
    if (next.has(k)) next.delete(k); else next.add(k);
    setHidden(next);
  }

  return (
    <div className="fixed inset-0 z-50 bg-overlay/50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}>
      <div className="card w-full max-w-lg my-8 p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="text-2xl font-extrabold">{t(title)}</h2>
            <p className="text-muted font-semibold">
              {tt(countLabel, { n: shownCount })}
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={22} /></button>
        </div>

        <p className="text-sm text-muted font-semibold mt-4 mb-5">
          {t(hint)}
        </p>

        <div className="space-y-2 mb-7">
          {list.map((c) => {
            const off = hidden.has(c.key);
            const lock = isLocked(c.key);
            return (
              <div key={c.key}
                draggable={!lock}
                onDragStart={() => setDragKey(c.key)}
                onDragEnd={() => setDragKey(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { move(dragKey, c.key); setDragKey(null); }}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                  dragKey === c.key ? "border-brand bg-brand-soft" : "border-line bg-surface"
                } ${off ? "opacity-50" : ""} ${lock ? "" : "cursor-grab active:cursor-grabbing"}`}>
                {lock
                  ? <Lock size={16} className="text-muted shrink-0" />
                  : <GripVertical size={18} className="text-muted shrink-0" />}
                <span className="flex-1 font-bold truncate">{t(c.label)}</span>
                {lock ? (
                  <span className="text-sm font-bold text-muted">{t("doim ko'rinadi")}</span>
                ) : (
                  <button onClick={() => toggle(c.key)}
                    title={t(off ? "Ko'rsatish" : "Yashirish")}
                    className={`p-1.5 rounded-lg ${off ? "text-muted hover:text-brand" : "text-brand hover:bg-brand-soft"}`}>
                    {off ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={onReset}
            className="flex items-center gap-2 rounded-xl border border-line font-bold px-4 py-3 hover:border-brand">
            <RotateCcw size={17} /> {t("Asliga qaytarish")}
          </button>
          <div className="flex-1" />
          <button onClick={onClose} className="rounded-xl border border-line font-bold px-5 py-3 hover:bg-surface">
            {t("Bekor qilish")}
          </button>
          <button
            onClick={() => onSave({ order: list.map((c) => c.key), hidden: [...hidden] })}
            className="rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-6 py-3">
            {t("Saqlash")}
          </button>
        </div>
      </div>
    </div>
  );
}
