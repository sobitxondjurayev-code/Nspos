"use client";
import { t } from "@/lib/i18n";
import { useState } from "react";
import { X } from "lucide-react";
import { useOyna } from "@/components/ui/Modal";

export default function CustomerModal({ initial, onClose, onSave }) {
  // Esc bilan yopiladi, fon skrolli qulflanadi (`ui/Modal.jsx`)
  useOyna(onClose);
  const [f, setF] = useState(initial ?? { name: "", phone: "+998 ", note: "" });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.name.trim() && f.phone.replace(/\D/g, "").length >= 9;

  return (
    <div className="fixed inset-0 z-50 bg-overlay/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-6 sm:p-8 rounded-b-none sm:rounded-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-extrabold">{initial ? "Mijozni tahrirlash" : "Yangi mijoz"}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={22} /></button>
        </div>

        <label className="block text-sm font-bold mb-2">{t("Ism familiya *")}</label>
        <input value={f.name} onChange={(e) => set("name", e.target.value)}
          className="inp mb-4" placeholder={t("Masalan: Aziz Karimov")} />

        <label className="block text-sm font-bold mb-2">{t("Telefon *")}</label>
        <input value={f.phone} onChange={(e) => set("phone", e.target.value)}
          className="inp mb-4" placeholder="+998 90 123 45 67" />

        <label className="block text-sm font-bold mb-2">{t("Izoh")}</label>
        <input value={f.note ?? ""} onChange={(e) => set("note", e.target.value)}
          className="inp mb-7" placeholder={t("Ixtiyoriy")} />

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-line font-bold py-3 hover:bg-surface">
            {t("Bekor qilish")}
          </button>
          <button disabled={!valid} onClick={() => onSave(f)}
            className="flex-1 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold py-3 disabled:opacity-50">
            {t("Saqlash")}
          </button>
        </div>
      </div>
    </div>
  );
}
