"use client";
import { t, tt } from "@/lib/i18n";
import { useState } from "react";
import { X, Banknote, Smartphone } from "lucide-react";
import { fmtUSD } from "@/lib/demoData";
import { debtsOf, remainingOf, payDebt, debtsFromBillz } from "@/lib/debtsData";

const fmtWhen = (iso) => {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
};

const daysSince = (iso) => Math.round((Date.now() - new Date(iso).getTime()) / 86400000);

export default function DebtPaymentModal({ customer, onClose, onPaid }) {
  const open = debtsOf(customer.id)
    .filter((d) => !d.closedAt && remainingOf(d) > 0)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); // eng eskisi tepada

  const [selected, setSelected] = useState(open[0]?.id ?? null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");

  const debt = open.find((d) => d.id === selected);
  const rem = debt ? remainingOf(debt) : 0;
  const amt = Math.min(Number(amount) || 0, rem);
  const valid = debt && amt > 0;

  function submit() {
    payDebt(debt.id, amt);
    onPaid?.({ customerId: customer.id, debtId: debt.id, amount: amt, method });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-overlay/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-8 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-extrabold">{t("Qarzni to'lash")}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={22} /></button>
        </div>
        <p className="text-muted font-semibold mb-6">{customer.name} · {customer.phone}</p>

        {/* Qarzlar Billz'dan kelayotgan bo'lsa, to'lovni shu yerda qabul
            qilib bo'lmaydi — aks holda NSPOS "to'landi" deb turadi,
            Billz esa "qarz" deb, va ikkalasi ajralib ketadi. */}
        {debtsFromBillz() ? (
          <div className="rounded-2xl border border-line bg-surface/60 p-6 text-center">
            <p className="font-bold mb-2">{t("To'lov Billz'da qabul qilinadi")}</p>
            <p className="text-sm text-muted font-semibold">
              {t("Qarzlar ro'yxati Billz'dan yuklangan. Pulni Billz kassasida qabul qiling, so'ng qarz hisobotini qayta yuklang — bu yerdagi raqamlar o'zi yangilanadi.")}
            </p>
          </div>
        ) : open.length === 0 ? (
          <p className="text-muted font-semibold text-center py-10">{t("Bu mijozda ochiq qarz yo'q")}</p>
        ) : (
          <>
            <p className="text-sm font-bold mb-2">{t("Qaysi qarz")}</p>
            <div className="space-y-2 mb-5">
              {open.map((d) => {
                const age = daysSince(d.createdAt);
                return (
                  <button key={d.id} onClick={() => { setSelected(d.id); setAmount(""); }}
                    className={`w-full text-left rounded-2xl px-5 py-3 border transition-colors ${
                      selected === d.id ? "border-brand bg-brand-soft" : "border-line hover:border-brand"}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold">{d.no}</p>
                        <p className="text-sm text-muted font-semibold">
                          {fmtWhen(d.createdAt)} · {tt("{n} kun oldin", { n: age })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-extrabold text-danger">{fmtUSD(remainingOf(d))}</p>
                        {d.payments.length > 0 && (
                          <p className="text-sm text-muted font-semibold">{tt("{n} dan", { n: fmtUSD(d.amount) })}</p>
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
            <div className="grid grid-cols-2 gap-3 mb-6">
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
              <p className="text-sm font-semibold text-ok mb-5">
                {t("Bu to'lov bilan qarz to'liq yopiladi")}
              </p>
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
