"use client";
// ══════════════════════════════════════════════════════════════
// "BERISHIM KERAK" KARTOCHKASI
// ══════════════════════════════════════════════════════════════
// Jadvalda faqat SUMMA turadi — rahbarning talabi. Kimga, qancha va
// qachon berilishi shu kartochka ichida: ustiga bosilganda ochiladi.
//
// Nega shunday: jadval kunlik holatni ko'rsatadi, unda o'nlab ism
// bo'lsa asosiy raqamlar ko'rinmay ketadi. Tafsilot esa kerak
// bo'lgandagina — bitta bosishda.
import { t, tt } from "@/lib/i18n";
import { useState } from "react";
import { X, Plus, Check, Pencil, Trash2, Undo2 } from "lucide-react";
import { fmtUSD } from "@/lib/demoData";
import { KASSAS, WALLETS } from "@/lib/kassaData";
import { daysLeft, somOf, PAYOUT_CATEGORIES } from "@/lib/payoutsData";
import { getUsdRate } from "@/lib/companyData";
import PayoutWaterfall from "@/components/finance/PayoutWaterfall";

const fmtDay = (d) => {
  const [y, m, dd] = String(d).slice(0, 10).split("-");
  return `${dd}.${m}.${y}`;
};

// "3 kun qoldi" / "2 kun kechikkan" — sana o'zi hech narsa demaydi,
// shoshilinchlik kerak
function DueBadge({ date }) {
  const n = daysLeft(date);
  const cls = n <= 0 ? "bg-danger-soft text-danger"
    : n <= 7 ? "bg-warn-soft text-warn" : "bg-track text-muted";
  return (
    <span className={`text-sm font-bold px-3 py-1 rounded-lg whitespace-nowrap ${cls}`}>
      {n < 0 ? tt("{n} kun kechikkan", { n: -n })
        : n === 0 ? t("Bugun") : tt("{n} kun qoldi", { n })}
    </span>
  );
}

// focusDate — jadvalda bitta kun ustidan ochilgan bo'lsa, avval o'sha
// kunning to'lovlari ko'rsatiladi ("qaysi kuni kimga" degan savol shu).
// Bir bosishda butun ro'yxatga qaytiladi.
// focusTab — jadvaldagi yashil "to'langan" qatoridan ochilganda darrov
// "To'langan" ro'yxati ko'rsatiladi ("men to'lagan to'lovlar qayerda?").
export default function PayoutsCard({
  open = [], paid = [], total = 0, cashOnHand = 0, focusDate = null, focusTab = null,
  onAdd, onEdit, onPay, onRemove, onUnpay, onClose,
}) {
  const [tab, setTab] = useState(focusTab === "paid" ? "paid" : "open");
  const [day, setDay] = useState(focusDate);
  const rate = getUsdRate();

  const shown = day ? open.filter((p) => p.dueDate === day) : open;
  const list = tab === "open" ? shown : paid;
  const shownTotal = +shown.reduce((s, p) => s + p.amount, 0).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 bg-overlay/50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}>
      <div className="card w-full max-w-4xl my-8" onClick={(e) => e.stopPropagation()}>
        {/* Sarlavha */}
        <div className="px-8 pt-8 pb-6 border-b border-line">
          <div className="flex items-start justify-between gap-4 mb-1">
            <div>
              <h2 className="text-2xl font-extrabold">
                {t("Berishim kerak")}
                {day && <span className="text-muted"> · {fmtDay(day)}</span>}
              </h2>
              <p className="text-muted font-semibold">
                {day
                  ? tt("Shu kuni {n} ta to'lov", { n: shown.length })
                  : open.length
                    ? tt("{n} ta to'lov · to'langach {a} qoladi", {
                        n: open.length, a: fmtUSD(+(cashOnHand - total).toFixed(2)) })
                    : t("Hozircha hech kimga berishingiz kerak emas")}
                {day && (
                  <button onClick={() => setDay(null)}
                    className="ml-2 text-brand font-bold hover:underline">
                    {t("barchasini ko'rish")}
                  </button>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button onClick={onAdd}
                className="flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-5 py-2.5">
                <Plus size={18} /> {t("Yangi to'lov")}
              </button>
              <button onClick={onClose} className="text-muted hover:text-ink"><X size={22} /></button>
            </div>
          </div>
          <p className="text-4xl font-extrabold mt-4">{fmtUSD(day ? shownTotal : total)}</p>
        </div>

        {/* Pul zinapoyasi — kartochka ichida, chunki bu ham tafsilot.
            Kun bo'yicha filtr yoqilganda ko'rsatilmaydi: zinapoya butun
            reja uchun mantiqli, bitta kun uchun emas. */}
        {!day && open.length > 0 && (
          <div className="px-8 pt-6">
            <PayoutWaterfall start={cashOnHand} items={open} bare />
          </div>
        )}

        {/* Rejadagi / to'langan */}
        <div className="px-8 pt-6">
          <div className="bg-track rounded-2xl p-1.5 flex w-fit">
            {[
              { k: "open", lbl: "Rejada", n: shown.length },
              { k: "paid", lbl: "To'langan", n: paid.length },
            ].map(({ k, lbl, n }) => (
              <button key={k} onClick={() => setTab(k)}
                className={`tab-btn ${tab === k ? "active" : ""}`}>
                {t(lbl)} {n > 0 && <span className="opacity-70">· {n}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Ro'yxat */}
        <div className="px-8 pb-8 pt-4">
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full text-[0.9375rem] min-w-[38.75rem]">
              {/* Sarlavha + "Jami" tepada, birga yopishib turadi */}
              <thead className="sticky top-0 z-20">
                <tr className="text-left text-muted text-sm border-b border-line [&>th]:bg-panel">
                  <th className="py-3 font-bold">{t("Kimga")}</th>
                  <th className="py-3 font-bold">{t("Nima uchun")}</th>
                  <th className="py-3 font-bold">{t(tab === "open" ? "Qachon" : "To'langan sana")}</th>
                  <th className="py-3 font-bold">{t("Qayerdan")}</th>
                  <th className="py-3 font-bold text-right">{t("Qancha")}</th>
                  <th className="py-3" />
                </tr>
                {list.length > 0 && (
                  <tr className="border-b-2 border-line bg-panel">
                    <th className="py-4 font-bold text-muted text-left" colSpan={4}>{t("Jami")}</th>
                    <th className="py-4 text-right text-lg font-extrabold">
                      {fmtUSD(+list.reduce((s, p) => s + p.amount, 0).toFixed(2))}
                    </th>
                    <th />
                  </tr>
                )}
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="py-4 pr-3">
                      <p className="font-bold">{p.title}</p>
                      {p.note && <p className="text-sm text-muted">{p.note}</p>}
                    </td>
                    <td className="py-4 pr-3 font-semibold text-muted">
                      {t(PAYOUT_CATEGORIES[p.category] ?? p.category)}
                    </td>
                    <td className="py-4 pr-3">
                      <p className="font-semibold mb-1">
                        {fmtDay(tab === "open" ? p.dueDate : p.paidAt)}
                      </p>
                      {tab === "open" && <DueBadge date={p.dueDate} />}
                    </td>
                    <td className="py-4 pr-3 font-semibold text-muted whitespace-nowrap">
                      {t(KASSAS[p.kassa]?.label ?? p.kassa)}
                      <span className="block text-sm">{t(WALLETS[p.wallet])}</span>
                    </td>
                    <td className="py-4 pr-3 text-right">
                      <p className={`font-extrabold ${tab === "paid" ? "text-ok" : ""}`}>
                        {fmtUSD(p.amount)}
                      </p>
                      {(p.amountSom != null || rate) && (
                        <p className="text-sm text-muted font-semibold">
                          {Math.round(somOf(p)).toLocaleString("ru-RU")} {t("so'm")}
                        </p>
                      )}
                    </td>
                    <td className="py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {tab === "open" ? (
                          <>
                            <button onClick={() => onPay(p)}
                              className="flex items-center gap-1.5 rounded-xl bg-ok hover:opacity-90 text-white font-bold px-4 py-2.5 whitespace-nowrap">
                              <Check size={17} /> {t("To'ladim")}
                            </button>
                            <button onClick={() => onEdit(p)} title={t("Tahrirlash")}
                              className="text-muted hover:text-brand p-2"><Pencil size={18} /></button>
                            <button onClick={() => onRemove(p)} title={t("O'chirish")}
                              className="text-muted hover:text-danger p-2"><Trash2 size={18} /></button>
                          </>
                        ) : (
                          <button onClick={() => onUnpay(p)} title={t("Rejaga qaytarish")}
                            className="text-muted hover:text-brand p-2"><Undo2 size={18} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-muted font-semibold">
                    {t(tab === "open"
                      ? "Reja bo'sh. \"Yangi to'lov\" bilan kimga qachon qancha berishingizni yozib qo'ying."
                      : "Hali hech qanday to'lov qilinmagan.")}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
