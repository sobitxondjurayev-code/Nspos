"use client";
// ══════════════════════════════════════════════════════════════
// KUNNI YOPISH
// ══════════════════════════════════════════════════════════════
// Kassa endi butunlay emas, KUN bo'yicha yopiladi: sana tanlanadi va
// aynan o'sha kunning qoldig'i rahbarga uzatiladi. Shuning uchun oyna
// avval o'sha kunda nima bo'lganini ko'rsatadi — kirim, chiqim, qoldiq —
// keyin tugma beradi. Menejer nimani topshirayotganini ko'rib turadi.
import { t, tt } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { X, LockKeyhole, Check, Clock, Undo2 } from "lucide-react";
import { fmtUSD } from "@/lib/demoData";
import DateField from "@/components/DateField";
import { KASSAS, WALLETS, dayRemainder, closingOf, walletsOf } from "@/lib/kassaData";

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function CloseKassaModal({ kassa, date, onClose, onConfirm, onCancelClose }) {
  const [day, setDay] = useState(date ?? iso(new Date()));
  const [note, setNote] = useState("");

  const rem = useMemo(() => dayRemainder(kassa, day), [kassa, day]);
  const closed = useMemo(() => closingOf(kassa, day), [kassa, day]);
  const wallets = walletsOf(kassa);
  const parts = wallets.filter((w) => (rem.byWallet[w] ?? 0) > 0.004);

  return (
    <div className="fixed inset-0 z-50 bg-overlay/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-8 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-2xl font-extrabold">{t("Kunni yopish")}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={22} /></button>
        </div>
        <p className="text-muted font-semibold mb-5">{t(KASSAS[kassa]?.label ?? kassa)}</p>

        <label className="block text-sm font-bold mb-2">{t("Qaysi kun")}</label>
        <DateField value={day} onChange={setDay} className="mb-5" />

        {/* O'sha kuni nima bo'lgani */}
        <div className="rounded-xl bg-surface px-5 py-4 mb-5 space-y-2">
          <div className="flex items-baseline justify-between gap-3 font-semibold">
            <span className="text-muted">{t("Kirim")}</span>
            <span className="font-bold tabular-nums text-ok">{fmtUSD(rem.in)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3 font-semibold">
            <span className="text-muted">{t("Chiqim")}</span>
            <span className="font-bold tabular-nums text-danger">
              {rem.out > 0 ? "−" : ""}{fmtUSD(rem.out)}
            </span>
          </div>
          <div className="border-t border-line pt-2 flex items-baseline justify-between gap-3">
            <span className="font-bold">{t("Topshiriladigan pul")}</span>
            <span className="text-xl font-extrabold tabular-nums">{fmtUSD(rem.total)}</span>
          </div>
          {parts.map((w) => (
            <div key={w} className="flex items-baseline justify-between gap-3 text-sm font-semibold">
              <span className="text-muted">{t(WALLETS[w])}</span>
              <span className="font-bold tabular-nums">{fmtUSD(rem.byWallet[w])}</span>
            </div>
          ))}
        </div>

        {closed ? (
          <>
            <div className={`rounded-xl px-5 py-4 mb-5 font-bold ${
              closed.status === "pending" ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok"}`}>
              <p className="flex items-center gap-2">
                {closed.status === "pending" ? <Clock size={18} /> : <Check size={18} />}
                {closed.status === "pending"
                  ? tt("Bu kun {n} bilan yopilgan — rahbar tasdig'i kutilmoqda", { n: fmtUSD(closed.amount) })
                  : tt("Bu kun {n} bilan yopilgan va tasdiqlangan", { n: fmtUSD(closed.amount) })}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-xl border border-line font-bold py-3 hover:bg-surface">
                {t("Yopish")}
              </button>
              {closed.status === "pending" && (
                <button onClick={() => onCancelClose?.(day)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-line font-bold py-3 hover:border-danger hover:text-danger">
                  <Undo2 size={18} /> {t("Yopishni bekor qilish")}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <label className="block text-sm font-bold mb-2">{t("Izoh")}</label>
            <input value={note} onChange={(e) => setNote(e.target.value)}
              className="inp mb-4" placeholder={t("Ixtiyoriy")} />

            <p className="text-sm text-muted font-semibold mb-5">
              {rem.total > 0.004
                ? t("Pul rahbar tasdiqlaguncha \"yo'lda\" turadi. Har hamyon o'z turi bilan boradi — naqd naqdga, Payme Payme'ga.")
                : t("Bu kuni topshiriladigan pul qolmagan. Kun baribir yopilishi mumkin — shunda u \"tekshirilgan\" bo'lib turadi va yopilmaganlar ro'yxatida qizarib qolmaydi.")}
            </p>

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-xl border border-line font-bold py-3 hover:bg-surface">
                {t("Bekor qilish")}
              </button>
              <button onClick={() => onConfirm(day, note.trim())}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold py-3">
                <LockKeyhole size={18} /> {t("Kunni yopish")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
