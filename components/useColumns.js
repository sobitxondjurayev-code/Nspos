"use client";
// Jadval ustunlari sozlamasini bitta joydan boshqaradi: yuklash,
// qo'llash, saqlash, asliga qaytarish. Jadval faqat ikki qator
// qo'shadi — sozlash oynasi va tugma.
//
// Ishlatish:
//   const cols = useColumns("kpi-daily", ALL_COLUMNS, { locked: ["date"] });
//   ... cols.columns.map(...)
//   <button onClick={cols.openSettings}>Ustunlar</button>
//   {cols.open && <ColumnSettings {...cols.dialogProps} />}
import { useEffect, useMemo, useState } from "react";
import { loadPrefs, savePrefs, clearPrefs, applyPrefs } from "@/lib/columnPrefs";

export function useColumns(id, columns, { locked = [] } = {}) {
  // localStorage faqat brauzerda bor — birinchi chizishda standart
  // tartib ishlatiladi, keyin sozlama qo'llanadi (gidratsiya buzilmaydi)
  const [prefs, setPrefs] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => { setPrefs(loadPrefs(id)); }, [id]);

  const shown = useMemo(
    () => applyPrefs(columns, prefs, { locked }), [columns, prefs, locked.join()]);

  const save = (p) => { savePrefs(id, p); setPrefs(p); setOpen(false); };
  const reset = () => { clearPrefs(id); setPrefs(null); setOpen(false); };

  return {
    columns: shown,
    open,
    openSettings: () => setOpen(true),
    closeSettings: () => setOpen(false),
    save, reset, prefs,
    // Sozlash oynasiga to'g'ridan-to'g'ri beriladigan qiymatlar
    dialogProps: {
      columns, prefs, locked,
      onSave: save, onReset: reset, onClose: () => setOpen(false),
    },
  };
}
