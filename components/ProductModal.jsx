"use client";
import { t } from "@/lib/i18n";
import { useState } from "react";
import { X } from "lucide-react";
import { demoStores } from "@/lib/demoData";
import { demoCategories, genBarcode } from "@/lib/productsData";
import { useOyna } from "@/components/ui/Modal";

export default function ProductModal({ initial, onClose, onSave }) {
  // Esc bilan yopiladi, fon skrolli qulflanadi (`ui/Modal.jsx`)
  useOyna(onClose);
  const [f, setF] = useState(
    initial ?? {
      name: "", sku: "", barcode: genBarcode(), categoryId: demoCategories[0]?.id ?? null,
      costPrice: "", salePrice: "",
      stock: Object.fromEntries(demoStores.map((s) => [s.id, 0])),
    }
  );
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setStock = (sid, v) => setF((p) => ({ ...p, stock: { ...p.stock, [sid]: Number(v) || 0 } }));
  const valid = f.name.trim() && Number(f.salePrice) > 0;

  return (
    <div className="fixed inset-0 z-50 bg-overlay/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="card w-full max-w-xl p-6 sm:p-8 rounded-b-none sm:rounded-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-extrabold">{initial ? "Tovarni tahrirlash" : "Yangi tovar"}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={22} /></button>
        </div>

        <label className="block text-sm font-bold mb-2">{t("Nomi *")}</label>
        <input value={f.name} onChange={(e) => set("name", e.target.value)}
          className="inp mb-4" placeholder={t("Masalan: Canon EOS R6")} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-bold mb-2">{t("SKU / Artikul")}</label>
            <input value={f.sku} onChange={(e) => set("sku", e.target.value)} className="inp" placeholder="CAN-R6" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-2">{t("Shtrix-kod")}</label>
            <div className="flex gap-2">
              <input value={f.barcode} onChange={(e) => set("barcode", e.target.value)} className="inp" />
              <button onClick={() => set("barcode", genBarcode())}
                className="shrink-0 rounded-xl bg-brand-soft text-brand font-bold px-4 hover:bg-brand-soft">{t("Yangi")}</button>
            </div>
          </div>
        </div>

        <label className="block text-sm font-bold mb-2">{t("Kategoriya")}</label>
        <select value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)} className="inp mb-4">
          {demoCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block text-sm font-bold mb-2">{t("Tannarx (USD)")}</label>
            <input type="number" value={f.costPrice} onChange={(e) => set("costPrice", e.target.value)} className="inp" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-2">{t("Sotuv narxi (USD) *")}</label>
            <input type="number" value={f.salePrice} onChange={(e) => set("salePrice", e.target.value)} className="inp" placeholder="0.00" />
          </div>
        </div>

        <p className="text-sm font-bold mb-2">{t("Qoldiqlar")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-7">
          {demoStores.map((s) => (
            <div key={s.id} className="bg-surface rounded-xl p-3">
              <p className="text-xs font-bold text-muted mb-1 truncate">{s.name}</p>
              <input type="number" value={f.stock[s.id]} onChange={(e) => setStock(s.id, e.target.value)}
                className="w-full bg-panel rounded-lg border border-line px-3 py-2 font-bold outline-none focus:border-brand" />
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-line font-bold py-3 hover:bg-surface">{t("Bekor qilish")}</button>
          <button disabled={!valid}
            onClick={() => onSave({ ...f, costPrice: Number(f.costPrice) || 0, salePrice: Number(f.salePrice) || 0 })}
            className="flex-1 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold py-3 disabled:opacity-50">
            {t("Saqlash")}
          </button>
        </div>
      </div>
    </div>
  );
}
