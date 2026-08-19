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

// defaultHidden — foydalanuvchi hali hech narsa sozlamagan bo'lsa
// yashirin turadigan kalitlar. Ro'yxatga qo'shimcha ustun/ko'rsatkich
// kiritib, sahifaning boshlang'ich ko'rinishini o'zgartirmaslik uchun:
// kerak bo'lsa foydalanuvchi o'zi yoqadi.
export function useColumns(id, columns, { locked = [], defaultHidden = [] } = {}) {
  // localStorage faqat brauzerda bor — birinchi chizishda standart
  // tartib ishlatiladi, keyin sozlama qo'llanadi (gidratsiya buzilmaydi)
  const [prefs, setPrefs] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => { setPrefs(loadPrefs(id)); }, [id]);

  // Saqlangan sozlama yo'q bo'lsa — standart yashirinlar bilan ishlaymiz
  const effective = useMemo(
    () => prefs ?? (defaultHidden.length ? { order: [], hidden: defaultHidden } : null),
    [prefs, defaultHidden.join()]);

  const shown = useMemo(
    () => applyPrefs(columns, effective, { locked }), [columns, effective, locked.join()]);

  const save = (p) => { savePrefs(id, p); setPrefs(p); setOpen(false); };
  const reset = () => { clearPrefs(id); setPrefs(null); setOpen(false); };

  return {
    columns: shown,
    open,
    openSettings: () => setOpen(true),
    closeSettings: () => setOpen(false),
    save, reset, prefs: effective,
    // Sozlash oynasiga to'g'ridan-to'g'ri beriladigan qiymatlar
    dialogProps: {
      columns, prefs: effective, locked,
      onSave: save, onReset: reset, onClose: () => setOpen(false),
    },
  };
}
