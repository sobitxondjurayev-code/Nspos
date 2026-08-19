"use client";
import { t, tt } from "@/lib/i18n";
import { useState } from "react";
import { X } from "lucide-react";
import { fmtUSD } from "@/lib/demoData";
import { shiftSummary } from "@/lib/shiftsData";

/* Smena ochish */
export function OpenShiftModal({ store, cashier, onClose, onOpen }) {
  const [cash, setCash] = useState("");
  const amt = Number(cash) || 0;

  return (
    <div className="fixed inset-0 z-50 bg-overlay/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-extrabold">{t("Smenani ochish")}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={22} /></button>
        </div>
        <p className="text-muted font-semibold mb-6">{store.name} · {cashier}</p>

        <label className="block text-sm font-bold mb-2">{t("Kassadagi boshlang'ich naqd (USD)")}</label>
        <input type="number" value={cash} onChange={(e) => setCash(e.target.value)}
          className="inp mb-2" placeholder="0.00" autoFocus />
        <p className="text-sm text-muted font-semibold mb-7">
          {t("Smena boshida kassada turgan pulni sanab kiriting")}
        </p>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-line font-bold py-3 hover:bg-surface">
            {t("Bekor qilish")}
          </button>
          <button onClick={() => onOpen(amt)}
            className="flex-1 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold py-3">
            {t("Smenani ochish")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Smena yopish — kassani sanash va farqni ko'rsatish */
export function CloseShiftModal({ shift, store, onClose, onCloseShift }) {
  const s = shiftSummary(shift);
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");

  const has = counted.trim() !== "";
  const amt = Number(counted) || 0;
  const diff = has ? +(amt - s.expectedCash).toFixed(2) : null;

  const Row = ({ label, value, strong, tone }) => (
    <div className="flex justify-between font-semibold">
      <span className="text-muted">{label}</span>
      <span className={`${strong ? "font-extrabold" : ""} ${tone ?? ""}`}>{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-overlay/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-8 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-extrabold">{t("Smenani yopish")}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={22} /></button>
        </div>
        <p className="text-muted font-semibold mb-6">{shift.no} · {store.name} · {shift.cashier}</p>

        <div className="bg-surface rounded-2xl p-5 mb-5 space-y-2">
          <Row label={t("Ochilishdagi naqd")} value={fmtUSD(shift.openingCash)} />
          <Row label={t("Naqd sotuvlar")} value={fmtUSD(s.salesCash)} />
          {s.opsCashIn > 0 && <Row label={t("Naqd kirim")} value={fmtUSD(s.opsCashIn)} />}
          {s.opsCashOut > 0 && <Row label={t("Naqd chiqim")} value={`−${fmtUSD(s.opsCashOut)}`} tone="text-danger" />}
          <div className="border-t border-dashed border-line pt-2 mt-2">
            <Row label={t("Kassada bo'lishi kerak")} value={fmtUSD(s.expectedCash)} strong />
          </div>
        </div>

        {/* Payme'ga tushgani kassadagi naqdga ta'sir qilmaydi */}
        <div className="bg-surface rounded-2xl p-5 mb-5 space-y-2">
          <Row label={t("Payme sotuvlar")} value={fmtUSD(s.salesPayme)} />
          {s.salesCard > 0 && <Row label={t("Karta sotuvlar")} value={fmtUSD(s.salesCard)} />}
          {s.salesDebt > 0 && <Row label={t("Qarzga berilgan")} value={fmtUSD(s.salesDebt)} tone="text-danger" />}
          <Row label={t("Smena tushumi")} value={fmtUSD(s.revenue)} strong />
          <p className="text-sm text-muted font-semibold pt-1">
            {tt("{n} ta chek", { n: s.salesCount })}
          </p>
        </div>

        <label className="block text-sm font-bold mb-2">{t("Sanalgan naqd (USD)")}</label>
        <input type="number" value={counted} onChange={(e) => setCounted(e.target.value)}
          className="inp mb-2" placeholder="0.00" autoFocus />
        <button onClick={() => setCounted(String(s.expectedCash))}
          className="text-sm font-bold text-brand hover:underline mb-4">
          {tt("Kutilgani bilan bir xil: {n}", { n: fmtUSD(s.expectedCash) })}
        </button>

        {has && (
          <div className={`rounded-2xl px-5 py-4 mb-5 font-bold ${
            diff === 0 ? "bg-ok-soft text-ok"
              : diff > 0 ? "bg-warn-soft text-warn"
              : "bg-danger-soft text-danger"}`}>
            {diff === 0
              ? t("Farq yo'q — kassa to'g'ri")
              : diff > 0
                ? tt("Ortiqcha: {n}", { n: fmtUSD(diff) })
                : tt("Kamomad: {n}", { n: fmtUSD(Math.abs(diff)) })}
          </div>
        )}

        <label className="block text-sm font-bold mb-2">{t("Izoh")}</label>
        <input value={note} onChange={(e) => setNote(e.target.value)}
          className="inp mb-7" placeholder={t("Farq sababi, agar bo'lsa")} />

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-line font-bold py-3 hover:bg-surface">
            {t("Bekor qilish")}
          </button>
          <button disabled={!has} onClick={() => onCloseShift(amt, note)}
            className="flex-1 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold py-3 disabled:opacity-50">
            {t("Smenani yopish")}
          </button>
        </div>
      </div>
    </div>
  );
}
