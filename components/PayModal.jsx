"use client";
import { t, tt } from "@/lib/i18n";
import { useState } from "react";
import { X, Check } from "lucide-react";
import NumberField from "@/components/NumberField";
import DateField from "@/components/DateField";
import { fmtUSD } from "@/lib/demoData";
import { KASSAS, WALLETS } from "@/lib/kassaData";
import { somOf } from "@/lib/payoutsData";
import { getUsdRate } from "@/lib/companyData";

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// ══════════════════════════════════════════════════════════════
// "TO'LADIM" — QANCHA TO'LANGANINI SO'RAYDI
// ══════════════════════════════════════════════════════════════
// Rejada 2 500 turgan bo'lsa ham qo'lda doim to'liq chiqmaydi: 2 000
// beriladi, 500 boshqa kunga qoladi. Shuning uchun "To'ladim" darrov
// to'liq summani yozmaydi — avval qancha berilganini so'raydi.
//
// Qisman to'lansa: to'langan qismi kassadan chiqadi va tarixga tushadi,
// qolgani esa YANGI reja bo'lib ro'yxatda qoladi — muddatini shu yerda
// belgilab ketiladi. Shunda "yarim to'langan" degan chalkash holat
// bo'lmaydi: har qator yo to'langan, yo hali kutilyapti.
export default function PayModal({ payout, onClose, onConfirm }) {
  const rate = getUsdRate();
  const fullSom = somOf(payout);
  // Reja so'mda kiritilgan bo'lsa, to'lov ham so'mda so'raladi
  const [cur, setCur] = useState(payout.amountSom != null ? "som" : "usd");
  const inSom = cur === "som";
  const full = inSom ? fullSom : payout.amount;

  const [amount, setAmount] = useState(String(inSom ? Math.round(fullSom) : payout.amount));
  const [date, setDate] = useState(iso(new Date()));
  const [restDate, setRestDate] = useState(payout.dueDate);

  const raw = Number(amount) || 0;
  const paidUsd = inSom ? (rate ? +(raw / rate).toFixed(2) : 0) : +raw.toFixed(2);
  const rest = +(payout.amount - paidUsd).toFixed(2);
  const restSom = +(fullSom - (inSom ? raw : raw * (rate || 0))).toFixed(0);
  const partial = rest > 0.009;
  const tooMuch = paidUsd > payout.amount + 0.009;
  const valid = paidUsd > 0 && !tooMuch && !!date && (!partial || !!restDate) && (!inSom || !!rate);

  const swap = (k) => {
    setCur(k);
    setAmount(String(k === "som" ? Math.round(fullSom) : payout.amount));
  };

  return (
    <div className="fixed inset-0 z-[60] bg-overlay/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-8 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-2xl font-extrabold">{t("Qancha to'ladingiz?")}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={22} /></button>
        </div>
        <p className="text-sm text-muted font-semibold mb-6">
          {payout.title} · {tt("rejada {n}", { n: fmtUSD(payout.amount) })}
          {payout.amountSom != null && ` (${Math.round(fullSom).toLocaleString("ru-RU")} ${t("so'm")})`}
        </p>

        <div className="flex gap-2 mb-2">
          {[{ k: "usd", lbl: "USD" }, { k: "som", lbl: "so'm" }].map(({ k, lbl }) => (
            <button key={k} onClick={() => swap(k)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${
                cur === k ? "border-brand bg-brand-soft text-brand" : "border-line hover:border-brand"}`}>
              {t(lbl)}
            </button>
          ))}
          <button onClick={() => setAmount(String(inSom ? Math.round(fullSom) : payout.amount))}
            className="ml-auto px-4 py-2 rounded-xl text-sm font-bold border border-line hover:border-brand">
            {t("To'liq")}
          </button>
        </div>
        <NumberField value={amount === "" ? null : Number(amount)} allowEmpty autoFocus
          onChange={(v) => setAmount(v == null ? "" : String(v))}
          className="inp mb-1" placeholder="0.00" />
        <p className={`text-sm font-semibold mb-5 ${tooMuch ? "text-danger" : "text-muted"}`}>
          {tooMuch
            ? tt("Rejadagidan ko'p — ko'pi bilan {n}", { n: inSom ? `${Math.round(fullSom).toLocaleString("ru-RU")} so'm` : fmtUSD(payout.amount) })
            : inSom
              ? (rate ? tt("≈ {n} USD", { n: paidUsd.toFixed(2) }) : t("Kurs olinmagan — so'mda kirita olmaysiz"))
              : (rate ? tt("≈ {s} so'm", { s: Math.round(raw * rate).toLocaleString("ru-RU") }) : " ")}
        </p>

        <label className="block text-sm font-bold mb-2">{t("Qachon to'ladingiz")}</label>
        <DateField value={date} onChange={setDate} className="mb-5" />

        {partial && (
          <div className="rounded-2xl border-2 border-warn/40 bg-warn/10 p-5 mb-6">
            <p className="font-extrabold mb-1">
              {tt("Qoladi: {n}", { n: fmtUSD(rest) })}
              {payout.amountSom != null && restSom > 0 && (
                <span className="text-muted font-bold"> · {restSom.toLocaleString("ru-RU")} {t("so'm")}</span>
              )}
            </p>
            <p className="text-sm text-muted font-semibold mb-3">
              {t("Qolgani rejada turaveradi — qachon berishingizni yozing")}
            </p>
            <DateField value={restDate} onChange={setRestDate} />
          </div>
        )}

        <p className="text-sm text-muted font-semibold mb-6">
          {tt("Pul {k} · {w} dan chiqadi", {
            k: t(KASSAS[payout.kassa]?.label ?? payout.kassa),
            w: t(WALLETS[payout.wallet] ?? payout.wallet),
          })}
        </p>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-line font-bold py-3 hover:border-brand">
            {t("Bekor")}
          </button>
          <button disabled={!valid}
            onClick={() => onConfirm({
              amount: paidUsd,
              amountSom: inSom ? raw : (rate ? +(raw * rate).toFixed(2) : null),
              date,
              restDate: partial ? restDate : null,
            })}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-ok hover:opacity-90 disabled:opacity-40 text-white font-bold py-3">
            <Check size={18} /> {t(partial ? "Qisman to'landi" : "To'landi")}
          </button>
        </div>
      </div>
    </div>
  );
}
