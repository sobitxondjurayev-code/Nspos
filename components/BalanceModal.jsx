"use client";
import { t, tt } from "@/lib/i18n";
import { useState } from "react";
import { X, Banknote, Smartphone, PiggyBank } from "lucide-react";
import { fmtUSD } from "@/lib/demoData";
import { topUpBalance, listBalanceLog } from "@/lib/customersData";
import { useOyna } from "@/components/ui/Modal";

const fmtWhen = (iso) => {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

// Mijoz balansini to'ldirish + harakatlar tarixi
export default function BalanceModal({ customer, onClose, onDone }) {
  // Esc bilan yopiladi, fon skrolli qulflanadi (`ui/Modal.jsx`)
  useOyna(onClose);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");

  const log = listBalanceLog(customer.id);
  const amt = Number(amount) || 0;
  const valid = amt > 0;

  function submit() {
    topUpBalance(customer.id, amt, note);
    onDone?.({ customerId: customer.id, amount: amt, method, note });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-overlay/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-6 sm:p-8 rounded-b-none sm:rounded-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-extrabold flex items-center gap-2">
            <PiggyBank size={22} className="text-brand" /> {t("Balansni to'ldirish")}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={22} /></button>
        </div>
        <p className="text-muted font-semibold mb-6">{customer.name} · {customer.phone}</p>

        <div className="bg-surface rounded-2xl px-5 py-4 mb-6">
          <p className="text-sm font-bold text-muted">{t("Hozirgi balans")}</p>
          <p className="text-3xl font-extrabold mt-1">{fmtUSD(customer.balance ?? 0)}</p>
        </div>

        <label className="block text-sm font-bold mb-2">{t("To'ldirish summasi (USD)")}</label>
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
          className="inp mb-5" placeholder="0.00" autoFocus />

        <p className="text-sm font-bold mb-2">{t("To'lov turi")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
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
          className="inp mb-5" placeholder={t("Ixtiyoriy")} />

        {amt > 0 && (
          <div className="bg-ok-soft rounded-2xl px-5 py-4 mb-6">
            <p className="font-bold text-ok">
              {tt("To'ldirgandan keyin balans: {n}", { n: fmtUSD((customer.balance ?? 0) + amt) })}
            </p>
          </div>
        )}

        {log.length > 0 && (
          <div className="mb-6">
            <p className="text-sm font-bold mb-3">{t("Balans harakatlari")}</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {log.slice(0, 10).map((b) => (
                <div key={b.id} className="flex items-center justify-between bg-surface rounded-xl px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="font-bold text-sm">
                      {b.type === "kirim" ? t("To'ldirildi") : t("Sotuvda ishlatildi")}
                    </p>
                    <p className="text-sm text-muted font-semibold">
                      {fmtWhen(b.at)}{b.note ? ` · ${b.note}` : ""}
                    </p>
                  </div>
                  <span className={`font-extrabold shrink-0 ${b.amount >= 0 ? "text-ok" : "text-danger"}`}>
                    {b.amount >= 0 ? "+" : ""}{fmtUSD(b.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-line font-bold py-3 hover:bg-surface">
            {t("Bekor qilish")}
          </button>
          <button disabled={!valid} onClick={submit}
            className="flex-1 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold py-3 disabled:opacity-50">
            {t("To'ldirish")}
          </button>
        </div>
      </div>
    </div>
  );
}
