"use client";
import { t, tt } from "@/lib/i18n";
import { useState } from "react";
import { X, Banknote, Smartphone } from "lucide-react";
import { fmtUSD } from "@/lib/demoData";
import { invoicesOf, remainingOf, daysOverdue, payInvoice } from "@/lib/suppliersData";
import { useOyna } from "@/components/ui/Modal";

const fmtDay = (iso) => {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
};

// Yetkazib beruvchiga to'lov — DebtPaymentModal'ning kreditor tomondagi aksi.
// preselectId berilsa o'sha faktura tanlangan holda ochiladi.
export default function SupplierPayModal({ supplier, preselectId, onClose, onPaid }) {
  // Esc bilan yopiladi, fon skrolli qulflanadi (`ui/Modal.jsx`)
  useOyna(onClose);
  const open = invoicesOf(supplier.id)
    .filter((i) => remainingOf(i) > 0.001)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)); // eng yaqin muddat tepada

  const [selected, setSelected] = useState(
    preselectId && open.some((i) => i.id === preselectId) ? preselectId : open[0]?.id ?? null
  );
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");

  const inv = open.find((i) => i.id === selected);
  const rem = inv ? remainingOf(inv) : 0;
  const amt = Math.min(Number(amount) || 0, rem);
  const valid = inv && amt > 0;

  function submit() {
    payInvoice(inv.id, amt);
    onPaid?.({ supplierId: supplier.id, invoiceId: inv.id, invoiceNo: inv.no, amount: amt, method });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-overlay/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-6 sm:p-8 rounded-b-none sm:rounded-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-extrabold">{t("Yetkazib beruvchiga to'lov")}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={22} /></button>
        </div>
        <p className="text-muted font-semibold mb-6">{supplier.name} · {supplier.contact}</p>

        {open.length === 0 ? (
          <p className="text-muted font-semibold text-center py-10">{t("Ochiq faktura yo'q")}</p>
        ) : (
          <>
            <p className="text-sm font-bold mb-2">{t("Qaysi faktura")}</p>
            <div className="space-y-2 mb-5">
              {open.map((i) => {
                const od = daysOverdue(i);
                return (
                  <button key={i.id} onClick={() => { setSelected(i.id); setAmount(""); }}
                    className={`w-full text-left rounded-2xl px-5 py-3 border transition-colors ${
                      selected === i.id ? "border-brand bg-brand-soft" : "border-line hover:border-brand"}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold">{i.no}{i.note ? ` · ${i.note}` : ""}</p>
                        <p className="text-sm font-semibold">
                          <span className="text-muted">{tt("Muddat: {d}", { d: fmtDay(i.dueDate) })}</span>
                          {" · "}
                          {od > 0
                            ? <span className="text-danger">{tt("{n} kun kechikkan", { n: od })}</span>
                            : <span className={od > -8 ? "text-warn" : "text-muted"}>{tt("{n} kun qoldi", { n: -od })}</span>}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-extrabold text-danger">{fmtUSD(remainingOf(i))}</p>
                        {i.payments.length > 0 && (
                          <p className="text-sm text-muted font-semibold">{tt("{n} dan", { n: fmtUSD(i.amount) })}</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold">{t("To'lov summasi (USD)")}</label>
              <button onClick={() => setAmount(String(rem))}
                className="text-sm font-bold text-brand hover:underline">{tt("To'liq {n}", { n: fmtUSD(rem) })}</button>
            </div>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="inp mb-5" placeholder="0.00" autoFocus />

            <p className="text-sm font-bold mb-2">{t("To'lov turi")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
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

            {amt > 0 && amt < rem && (
              <p className="text-sm font-semibold text-muted mb-5">
                {tt("To'lovdan keyin {n} qarz qoladi", { n: fmtUSD(rem - amt) })}
              </p>
            )}
            {amt > 0 && amt >= rem && (
              <p className="text-sm font-semibold text-ok mb-5">{t("Bu to'lov bilan faktura to'liq yopiladi")}</p>
            )}

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-xl border border-line font-bold py-3 hover:bg-surface">
                {t("Bekor qilish")}
              </button>
              <button disabled={!valid} onClick={submit}
                className="flex-1 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold py-3 disabled:opacity-50">
                {t("To'lovni qabul qilish")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
