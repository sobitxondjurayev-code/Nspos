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

  return (
    <div className="fixed inset-0 z-50 bg-overlay/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-xl p-8 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-2xl font-extrabold">{t("Kunni yopish")}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={22} /></button>
        </div>
        <p className="text-muted font-semibold mb-5">{t(KASSAS[kassa]?.label ?? kassa)}</p>

        <label className="block text-sm font-bold mb-2">{t("Qaysi kun")}</label>
        <DateField value={day} onChange={setDay} className="mb-5" />

        {/* O'sha kuni har HAMYONDA nima bo'lgani. Servis ham shu jadvalda:
            servis materiallari servis pulidan chiqadi, shuning uchun
            topshiriladigani — servis kirimi minus servis chiqimi. */}
        <div className="rounded-xl bg-surface px-5 py-4 mb-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted font-bold">
                <th className="text-left pb-2">{t("Hamyon")}</th>
                <th className="text-right pb-2">{t("Kirim")}</th>
                <th className="text-right pb-2">{t("Chiqim")}</th>
                {rem.givenTotal > 0.004 && (
                  <th className="text-right pb-2 whitespace-nowrap">{t("Topshirilgan")}</th>
                )}
                <th className="text-right pb-2">{t("Qoldiq")}</th>
              </tr>
            </thead>
            <tbody className="font-semibold">
              {wallets.map((w) => (
                <tr key={w}>
                  <td className="py-1 text-muted">{t(WALLETS[w])}</td>
                  <td className="py-1 text-right tabular-nums text-ok">
                    {rem.inByWallet[w] > 0.004 ? fmtUSD(rem.inByWallet[w]) : <span className="text-muted">—</span>}
                  </td>
                  <td className="py-1 text-right tabular-nums text-danger">
                    {rem.outByWallet[w] > 0.004 ? `−${fmtUSD(rem.outByWallet[w])}` : <span className="text-muted">—</span>}
                  </td>
                  {rem.givenTotal > 0.004 && (
                    <td className="py-1 text-right tabular-nums text-muted">
                      {rem.givenByWallet[w] > 0.004 ? `−${fmtUSD(rem.givenByWallet[w])}` : "—"}
                    </td>
                  )}
                  <td className={`py-1 text-right tabular-nums font-bold ${
                    rem.byWallet[w] < -0.004 ? "text-danger" : ""}`}>
                    {fmtUSD(rem.byWallet[w])}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-line">
                <td className="pt-2 font-extrabold">{t("Topshiriladigan pul")}</td>
                <td className="pt-2 text-right tabular-nums text-ok font-bold">{fmtUSD(rem.in)}</td>
                <td className="pt-2 text-right tabular-nums text-danger font-bold">
                  {rem.out > 0.004 ? `−${fmtUSD(rem.out)}` : "—"}
                </td>
                {rem.givenTotal > 0.004 && (
                  <td className="pt-2 text-right tabular-nums text-muted font-bold">−{fmtUSD(rem.givenTotal)}</td>
                )}
                <td className="pt-2 text-right text-lg font-extrabold tabular-nums">{fmtUSD(rem.total)}</td>
              </tr>
            </tbody>
          </table>
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
