"use client";
// ══════════════════════════════════════════════════════════════
// DOLLAR KURSI — yozish va tarix
// ══════════════════════════════════════════════════════════════
// Kurs kun davomida o'zgarib qoladi, xarajat esa so'mda kiritilib
// dollarga o'giriladi. Shuning uchun kurs har doim ko'z oldida turadi
// va bir bosishda yangilanadi. Har o'zgarish tarixga yoziladi: keyin
// "bu raqam qaysi kurs bilan chiqqan?" degan savolga javob bo'ladi.
import { t, tt } from "@/lib/i18n";
import { useState } from "react";
import { X, Check, History } from "lucide-react";
import NumberField from "@/components/NumberField";
import { getUsdRate, getRateDate, isRateAuto } from "@/lib/companyData";
import { listRates, saveRate } from "@/lib/ratesData";
import { getStaff } from "@/lib/staffData";
import { useOyna } from "@/components/ui/Modal";

const fmtWhen = (iso) => {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const som = (n) => Math.round(n).toLocaleString("ru-RU");

export default function RateModal({ onClose, onSaved }) {
  // Esc bilan yopiladi, fon skrolli qulflanadi (`ui/Modal.jsx`)
  useOyna(onClose);
  const current = getUsdRate();
  const [value, setValue] = useState(current ?? "");
  const [tick, setTick] = useState(0);
  const history = listRates().slice(0, 20);

  const n = Number(value) || 0;
  const valid = n > 0;

  function save() {
    saveRate(n);
    setTick((v) => v + 1);
    onSaved?.(n);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-overlay/50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}>
      <div className="card w-full max-w-md my-8 p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-extrabold">{t("Dollar kursi")}</h2>
            <p className="text-muted font-semibold">
              {current
                ? tt("Hozir: {n} so'm", { n: som(current) })
                : t("Hali yozilmagan")}
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={22} /></button>
        </div>

        <label className="block text-sm font-bold mb-2">{t("1 dollar necha so'm")}</label>
        <NumberField value={value === "" ? null : Number(value)} allowEmpty autoFocus
          onChange={(v) => setValue(v == null ? "" : String(v))}
          className="inp mb-2" placeholder="12 000" />
        <p className="text-sm text-muted font-semibold mb-6">
          {t("Shu kurs bilan barcha so'mdagi summa dollarga o'giriladi — siz o'zgartirmaguningizcha.")}
        </p>

        <div className="flex gap-3 mb-7">
          <button onClick={onClose} className="flex-1 rounded-xl border border-line font-bold py-3 hover:bg-surface">
            {t("Bekor qilish")}
          </button>
          <button disabled={!valid} onClick={save}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold py-3 disabled:opacity-50">
            <Check size={18} /> {t("Saqlash")}
          </button>
        </div>

        {/* —— Tarix —— */}
        <div className="flex items-center gap-2 mb-3">
          <History size={17} className="text-muted" />
          <p className="font-extrabold">{t("Kurs tarixi")}</p>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-muted font-semibold">
            {current && isRateAuto()
              ? tt("Hozirgi kurs Markaziy bankdan olingan{d}", {
                  d: getRateDate() ? ` · ${fmtWhen(getRateDate())}` : "" })
              : t("Hali qo'lda kurs yozilmagan.")}
          </p>
        ) : (
          <div className="space-y-2">
            {history.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl bg-surface px-4 py-3">
                <p className="font-extrabold w-28 shrink-0">{som(r.rate)} {t("so'm")}</p>
                <p className="text-sm text-muted font-semibold flex-1 min-w-0 truncate">
                  {fmtWhen(r.at)}
                  {r.createdBy && ` · ${getStaff(r.createdBy)?.name ?? ""}`}
                </p>
                {r.source === "cbu" && (
                  <span className="text-xs font-bold text-muted shrink-0">{t("Markaziy bank")}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
