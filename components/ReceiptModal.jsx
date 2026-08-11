"use client";
import { t, tt } from "@/lib/i18n";
import { X, Check } from "lucide-react";
import { demoStores, fmtUSD } from "@/lib/demoData";

export default function ReceiptModal({ sale, onClose }) {
  const store = demoStores.find((s) => s.id === sale.storeId);
  const d = new Date(sale.at);
  const pad = (n) => String(n).padStart(2, "0");
  const when = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

  return (
    <div className="fixed inset-0 z-50 bg-overlay/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-8 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-extrabold">{t("Chek")} {sale.no}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={22} /></button>
        </div>

        <div className="flex items-center gap-3 bg-ok-soft text-ok rounded-2xl px-5 py-4 mb-6">
          <span className="w-9 h-9 rounded-full bg-ok text-white flex items-center justify-center shrink-0">
            <Check size={20} />
          </span>
          <p className="font-bold">{t("Sotuv muvaffaqiyatli yakunlandi")}</p>
        </div>

        <div className="bg-surface rounded-2xl px-5 py-4 mb-5 text-[0.9375rem] space-y-1.5">
          <div className="flex justify-between">
            <span className="text-muted font-semibold">{t("Do'kon:")}</span>
            <span className="font-bold">{store?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted font-semibold">{t("Sana:")}</span>
            <span className="font-bold">{when}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted font-semibold">{t("Kassir:")}</span>
            <span className="font-bold">{sale.cashier}</span>
          </div>
        </div>

        <div className="space-y-3 mb-5">
          {sale.items.map((i) => (
            <div key={i.productId} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold leading-tight">{i.name}</p>
                <p className="text-sm text-muted">{i.qty} × {i.price.toFixed(2)} $</p>
              </div>
              <p className="font-extrabold shrink-0">{i.total.toFixed(2)} $</p>
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-line pt-4 space-y-2 text-[0.9375rem]">
          <div className="flex justify-between font-semibold">
            <span className="text-muted">{t("Oraliq summa:")}</span>
            <span>{fmtUSD(sale.subtotal)}</span>
          </div>
          {sale.discountAmt > 0 && (
            <div className="flex justify-between font-semibold">
              <span className="text-muted">{tt("Chegirma ({n}%):", { n: sale.discountPct })}</span>
              <span className="text-danger">−{fmtUSD(sale.discountAmt)}</span>
            </div>
          )}
          <div className="flex justify-between text-xl font-extrabold pt-1">
            <span>{t("Jami:")}</span>
            <span>{fmtUSD(sale.total)}</span>
          </div>
          <div className="border-t border-dashed border-line pt-3 mt-3 space-y-2">
            {sale.cash > 0 && (
              <div className="flex justify-between font-semibold">
                <span className="text-muted">{t("Naqd:")}</span><span>{fmtUSD(sale.cash)}</span>
              </div>
            )}
            {sale.card > 0 && (
              <div className="flex justify-between font-semibold">
                <span className="text-muted">{t("Karta:")}</span><span>{fmtUSD(sale.card)}</span>
              </div>
            )}
            {sale.payme > 0 && (
              <div className="flex justify-between font-semibold">
                <span className="text-muted">Payme:</span><span>{fmtUSD(sale.payme)}</span>
              </div>
            )}
            {sale.fromBalance > 0 && (
              <div className="flex justify-between font-semibold">
                <span className="text-muted">{t("Balansdan:")}</span><span>{fmtUSD(sale.fromBalance)}</span>
              </div>
            )}
            {sale.debt > 0 && (
              <div className="flex justify-between font-semibold">
                <span className="text-muted">{t("Qarzga:")}</span>
                <span className="text-danger font-extrabold">{fmtUSD(sale.debt)}</span>
              </div>
            )}
            {sale.change > 0 && (
              <div className="flex justify-between font-semibold">
                <span className="text-muted">{t("Qaytim:")}</span>
                <span className="text-ok font-extrabold">{fmtUSD(sale.change)}</span>
              </div>
            )}
          </div>
        </div>

        <button onClick={onClose}
          className="w-full mt-7 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold py-3">
          {t("Yopish")}
        </button>
      </div>
    </div>
  );
}
