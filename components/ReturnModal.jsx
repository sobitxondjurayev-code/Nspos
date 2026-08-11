"use client";
import { t, tt } from "@/lib/i18n";
import { useState } from "react";
import { X, Banknote, Smartphone, Undo2 } from "lucide-react";
import { fmtUSD } from "@/lib/demoData";
import { returnedQtyOf } from "@/lib/salesData";

// Chek bo'yicha qaytarish. Qisman qaytarish mumkin, lekin
// allaqachon qaytarilgan miqdordan oshib ketmaydi.
export default function ReturnModal({ sale, onClose, onConfirm }) {
  const already = returnedQtyOf(sale.id);

  // Har tovar uchun qaytarish mumkin bo'lgan maksimum
  const rows = sale.items.map((i) => ({
    ...i,
    maxQty: Math.max(0, i.qty - (already[i.productId] || 0)),
  }));

  const [qty, setQty] = useState(() =>
    Object.fromEntries(rows.map((r) => [r.productId, 0]))
  );
  const [method, setMethod] = useState(
    sale.cash > 0 ? "cash" : sale.card > 0 ? "card" : sale.payme > 0 ? "payme" : "cash"
  );
  const [reason, setReason] = useState("");

  const setQ = (id, v, max) =>
    setQty((p) => ({ ...p, [id]: Math.max(0, Math.min(Number(v) || 0, max)) }));

  const picked = rows.filter((r) => qty[r.productId] > 0);
  const amount = +picked.reduce((a, r) => a + r.price * qty[r.productId], 0).toFixed(2);
  // Asl chekdagi chegirma nisbati qaytarishga ham qo'llanadi
  const ratio = sale.subtotal > 0 ? sale.total / sale.subtotal : 1;
  const refund = +(amount * ratio).toFixed(2);

  const nothingLeft = rows.every((r) => r.maxQty === 0);
  const valid = picked.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-overlay/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-8 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-extrabold flex items-center gap-2">
            <Undo2 size={22} className="text-brand" /> {t("Tovarni qaytarish")}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={22} /></button>
        </div>
        <p className="text-muted font-semibold mb-6">
          {tt("Chek {n}", { n: sale.no })} · {fmtUSD(sale.total)}
        </p>

        {nothingLeft ? (
          <p className="text-muted font-semibold text-center py-10">
            {t("Bu chekdagi hamma tovar allaqachon qaytarilgan")}
          </p>
        ) : (
          <>
            <p className="text-sm font-bold mb-2">{t("Nimani qaytaramiz")}</p>
            <div className="space-y-2 mb-5">
              {rows.map((r) => (
                <div key={r.productId}
                  className={`rounded-2xl px-4 py-3 ${r.maxQty === 0 ? "bg-surface opacity-50" : "bg-surface"}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="font-bold leading-tight">{r.name}</p>
                      <p className="text-sm text-muted font-semibold">
                        {tt("{n} × {p}", { n: r.qty, p: r.price.toFixed(2) + " $" })}
                        {already[r.productId] > 0 &&
                          ` · ${tt("{n} qaytarilgan", { n: already[r.productId] })}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input type="number" value={qty[r.productId]} disabled={r.maxQty === 0}
                        onChange={(e) => setQ(r.productId, e.target.value, r.maxQty)}
                        className="w-16 bg-panel rounded-lg border border-line px-2 py-1.5 font-bold text-center outline-none disabled:opacity-50" />
                      <button disabled={r.maxQty === 0}
                        onClick={() => setQ(r.productId, r.maxQty, r.maxQty)}
                        className="text-sm font-bold text-brand hover:underline disabled:opacity-40">
                        {tt("Max {n}", { n: r.maxQty })}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-sm font-bold mb-2">{t("Pul qaytariladi")}</p>
            <div className="grid grid-cols-2 gap-3 mb-5">
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

            <label className="block text-sm font-bold mb-2">{t("Qaytarish sababi")}</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)}
              className="inp mb-5" placeholder={t("Masalan: nosoz chiqdi")} />

            <div className="bg-surface rounded-2xl p-5 mb-6 space-y-2">
              <div className="flex justify-between font-semibold">
                <span className="text-muted">{t("Tovarlar summasi")}</span>
                <span>{fmtUSD(amount)}</span>
              </div>
              {sale.discountPct > 0 && (
                <div className="flex justify-between font-semibold">
                  <span className="text-muted">
                    {tt("Chekdagi chegirma ({n}%)", { n: sale.discountPct })}
                  </span>
                  <span className="text-danger">−{fmtUSD(+(amount - refund).toFixed(2))}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-extrabold pt-1 border-t border-dashed border-line">
                <span>{t("Qaytariladigan summa")}</span>
                <span className="text-danger">{fmtUSD(refund)}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-xl border border-line font-bold py-3 hover:bg-surface">
                {t("Bekor qilish")}
              </button>
              <button disabled={!valid}
                onClick={() => onConfirm({
                  items: picked.map((r) => ({ ...r, qty: qty[r.productId] })),
                  method, reason,
                })}
                className="flex-1 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold py-3 disabled:opacity-50">
                {t("Qaytarishni tasdiqlash")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
