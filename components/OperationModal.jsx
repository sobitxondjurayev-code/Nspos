"use client";
import { t } from "@/lib/i18n";
import NumberField from "@/components/NumberField";
import { useState } from "react";
import { X, Banknote, ArrowDownLeft, ArrowUpRight, Smartphone } from "lucide-react";
import { OP_CATEGORIES } from "@/lib/financeData";

export default function OperationModal({ storeId, onClose, onSave }) {
  const [type, setType] = useState("chiqim"); // ko'pincha xarajat kiritiladi
  const [category, setCategory] = useState("supply");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");

  // Faqat tanlangan turga mos kategoriyalar
  const cats = Object.entries(OP_CATEGORIES).filter(([, c]) => c.type === type);

  function pickType(next) {
    setType(next);
    const first = Object.entries(OP_CATEGORIES).find(([, c]) => c.type === next);
    if (first) setCategory(first[0]);
  }

  const amt = Number(amount) || 0;
  const valid = amt > 0;

  return (
    <div className="fixed inset-0 z-50 bg-overlay/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-extrabold">{t("Yangi operatsiya")}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={22} /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {[
            { k: "kirim", lbl: "Kirim", icon: ArrowDownLeft },
            { k: "chiqim", lbl: "Chiqim", icon: ArrowUpRight },
          ].map(({ k, lbl, icon: Icon }) => (
            <button key={k} onClick={() => pickType(k)}
              className={`flex items-center justify-center gap-2 rounded-xl py-3 font-bold border-2 transition-colors ${
                type === k
                  ? k === "kirim" ? "border-ok bg-ok-soft text-ok" : "border-danger bg-danger-soft text-danger"
                  : "border-line hover:border-brand"}`}>
              <Icon size={18} /> {t(lbl)}
            </button>
          ))}
        </div>

        <label className="block text-sm font-bold mb-2">{t("Kategoriya")}</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="inp mb-4">
          {cats.map(([k, c]) => <option key={k} value={k}>{t(c.label)}</option>)}
        </select>

        <label className="block text-sm font-bold mb-2">{t("Summa (USD)")}</label>
        <NumberField value={amount === "" ? null : Number(amount)} allowEmpty autoFocus
          onChange={(v) => setAmount(v == null ? "" : String(v))}
          className="inp mb-4" placeholder="0.00" />

        <p className="text-sm font-bold mb-2">{t("To'lov turi")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {[
            { k: "cash", lbl: "Naqd", icon: Banknote },
            { k: "payme", lbl: "Payme", icon: Smartphone },
          ].map(({ k, lbl, icon: Icon }) => (
            <button key={k} onClick={() => setMethod(k)}
              className={`flex items-center justify-center gap-2 rounded-xl py-3 font-bold border transition-colors ${
                method === k ? "border-brand bg-brand-soft text-brand" : "border-line hover:border-brand"}`}>
              <Icon size={18} /> {t(lbl)}
            </button>
          ))}
        </div>

        <label className="block text-sm font-bold mb-2">{t("Izoh")}</label>
        <input value={note} onChange={(e) => setNote(e.target.value)}
          className="inp mb-7" placeholder={t("Ixtiyoriy")} />

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-line font-bold py-3 hover:bg-surface">
            {t("Bekor qilish")}
          </button>
          <button disabled={!valid}
            onClick={() => onSave({ category, amount: amt, method, note, storeId })}
            className="flex-1 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold py-3 disabled:opacity-50">
            {t("Saqlash")}
          </button>
        </div>
      </div>
    </div>
  );
}
