"use client";
// ══════════════════════════════════════════════════════════════
// "BERISHIM KERAK" KARTOCHKASI
// ══════════════════════════════════════════════════════════════
// Jadvalda faqat SUMMA turadi — rahbarning talabi. Kimga, qancha va
// qachon berilishi shu kartochka ichida: ustiga bosilganda ochiladi.
//
// Uch ko'rinish:
//   Kunlar bo'yicha — sana, naqd, Payme, kassalardagi balans, o'sha kuni
//                     kimga berish kerakligi va kimga berilgani
//   Rejada          — hali berilmagan to'lovlar
//   To'langan       — berilganlar tarixi
//
// Ism ustiga bosilsa — o'sha odam bo'yicha BUTUN tarix (avval qancha
// berilgan, yana qancha berish kerak). "Buni oldin ham to'lagandik-ku?"
// degan savolga javob shu.
import { t, tt } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { X, Plus, Check, Pencil, Trash2, Undo2, ArrowLeft } from "lucide-react";
import { fmtUSD } from "@/lib/demoData";
import { KASSAS, WALLETS } from "@/lib/kassaData";
import { daysLeft, somOf, PAYOUT_CATEGORIES } from "@/lib/payoutsData";
import { getUsdRate } from "@/lib/companyData";
import PayoutWaterfall from "@/components/finance/PayoutWaterfall";

const fmtDay = (d) => {
  const [y, m, dd] = String(d).slice(0, 10).split("-");
  return `${dd}.${m}.${y}`;
};

const WEEKDAYS = ["Yak", "Du", "Se", "Cho", "Pa", "Ju", "Sha"];
const weekday = (d) => WEEKDAYS[new Date(String(d).slice(0, 10) + "T12:00:00").getDay()];

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
// focusTab — qaysi ko'rinish bilan ochilishi ("days" | "open" | "paid").
export default function PayoutsCard({
  open = [], paid = [], days = [], total = 0, cashOnHand = 0,
  focusDate = null, focusTab = null,
  onAdd, onEdit, onPay, onRemove, onUnpay, onClose,
}) {
  const [tab, setTab] = useState(
    focusTab === "paid" ? "paid" : focusTab === "days" ? "days" : "open");
  const [day, setDay] = useState(focusDate);
  const [who, setWho] = useState(null);      // ism ustiga bosilganda — tarix
  const rate = getUsdRate();

  const shown = day ? open.filter((p) => p.dueDate === day) : open;

  // Bir odam bo'yicha butun tarix: rejadagi ham, to'langani ham
  const history = useMemo(() => {
    if (!who) return [];
    const key = (p) => String(p.title || "").trim().toLowerCase();
    return [...open, ...paid]
      .filter((p) => key(p) === who.toLowerCase())
      .sort((a, b) => {
        const da = String(a.paidAt ?? a.dueDate).slice(0, 10);
        const db = String(b.paidAt ?? b.dueDate).slice(0, 10);
        return da < db ? 1 : da > db ? -1 : 0;
      });
  }, [who, open, paid]);

  const list = who ? history : tab === "open" ? shown : tab === "paid" ? paid : [];
  const listTotal = +list.reduce((s, p) => s + p.amount, 0).toFixed(2);
  const shownTotal = +shown.reduce((s, p) => s + p.amount, 0).toFixed(2);
  const histPaid = +history.filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount, 0).toFixed(2);
  const histOpen = +history.filter((p) => p.status !== "paid")
    .reduce((s, p) => s + p.amount, 0).toFixed(2);

  // —— Kunlar bo'yicha ————————————————————————————
  // Har sana uchun: o'sha kungi naqd va Payme kirimi, kassalardagi
  // balans, o'sha kuni berish kerak bo'lganlari va berilganlari.
  // Balans yugurib boradi va oxirgi kun bugungi qoldiqqa tushadi —
  // shuning uchun boshi orqadan hisoblanadi.
  const dayRows = useMemo(() => {
    const m = new Map();
    const row = (d) => {
      if (!m.has(d)) m.set(d, { date: d, cash: 0, payme: 0, net: 0, due: [], paid: [] });
      return m.get(d);
    };
    for (const d of days) {
      const r = row(d.date);
      r.cash = d.cash ?? 0;
      r.payme = d.payme ?? 0;
      r.net = +(((d.b2b ?? 0) + (d.b2c ?? 0) + (d.service ?? 0))
        - ((d.b2bExp ?? 0) + (d.storeExp ?? 0) + (d.svcExp ?? 0)
          + (d.salary ?? 0) + (d.ns ?? 0) + (d.companyExp ?? 0))).toFixed(2);
    }
    for (const p of open) row(p.dueDate).due.push(p);
    for (const p of paid) {
      const d = String(p.paidAt ?? "").slice(0, 10);
      if (d) row(d).paid.push(p);
    }
    const rows = [...m.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
    // Boshlang'ich qoldiq: hozirgi puldan davr ichidagi harakat ayriladi
    let bal = +(cashOnHand - rows.reduce((s, r) => s + r.net, 0)).toFixed(2);
    for (const r of rows) {
      bal = +(bal + r.net).toFixed(2);
      r.balance = bal;
    }
    return rows;
  }, [days, open, paid, cashOnHand]);

  const dayTotals = useMemo(() => ({
    cash: +dayRows.reduce((s, r) => s + r.cash, 0).toFixed(2),
    payme: +dayRows.reduce((s, r) => s + r.payme, 0).toFixed(2),
    due: +dayRows.reduce((s, r) => s + r.due.reduce((a, p) => a + p.amount, 0), 0).toFixed(2),
    paid: +dayRows.reduce((s, r) => s + r.paid.reduce((a, p) => a + p.amount, 0), 0).toFixed(2),
  }), [dayRows]);

  // Ism — bosiladigan: o'sha odamning butun tarixi ochiladi
  const Who = ({ p }) => (
    <button onClick={() => setWho(p.title)}
      className="font-bold text-left rounded-lg px-1 -mx-1 border-b border-dashed border-muted/50 hover:bg-brand-soft hover:text-brand hover:border-transparent transition-colors">
      {p.title}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 bg-overlay/50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}>
      <div className="card w-full max-w-6xl my-8" onClick={(e) => e.stopPropagation()}>
        {/* Sarlavha */}
        <div className="px-8 pt-8 pb-6 border-b border-line">
          <div className="flex items-start justify-between gap-4 mb-1">
            <div>
              <h2 className="text-2xl font-extrabold">
                {who ? who : t("Berishim kerak")}
                {!who && day && <span className="text-muted"> · {fmtDay(day)}</span>}
              </h2>
              <p className="text-muted font-semibold">
                {who
                  ? tt("{n} ta to'lov · to'langani {a} · rejada {b}", {
                      n: history.length, a: fmtUSD(histPaid), b: fmtUSD(histOpen) })
                  : day
                    ? tt("Shu kuni {n} ta to'lov", { n: shown.length })
                    : open.length
                      ? tt("{n} ta to'lov · to'langach {a} qoladi", {
                          n: open.length, a: fmtUSD(+(cashOnHand - total).toFixed(2)) })
                      : t("Hozircha hech kimga berishingiz kerak emas")}
                {!who && day && (
                  <button onClick={() => setDay(null)}
                    className="ml-2 text-brand font-bold hover:underline">
                    {t("barchasini ko'rish")}
                  </button>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {who ? (
                <button onClick={() => setWho(null)}
                  className="flex items-center gap-2 rounded-xl border border-line font-bold px-5 py-2.5 hover:border-brand">
                  <ArrowLeft size={18} /> {t("Orqaga")}
                </button>
              ) : (
                <button onClick={onAdd}
                  className="flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-5 py-2.5">
                  <Plus size={18} /> {t("Yangi to'lov")}
                </button>
              )}
              <button onClick={onClose} className="text-muted hover:text-ink"><X size={22} /></button>
            </div>
          </div>
          <p className="text-4xl font-extrabold mt-4">
            {fmtUSD(who ? listTotal : day ? shownTotal : total)}
          </p>
        </div>

        {/* Pul zinapoyasi — kartochka ichida, chunki bu ham tafsilot.
            Kun bo'yicha filtr yoqilganda ko'rsatilmaydi: zinapoya butun
            reja uchun mantiqli, bitta kun uchun emas. */}
        {!who && !day && tab === "open" && open.length > 0 && (
          <div className="px-8 pt-6">
            <PayoutWaterfall start={cashOnHand} items={open} bare />
          </div>
        )}

        {/* Ko'rinishlar */}
        {!who && (
          <div className="px-8 pt-6">
            <div className="bg-track rounded-2xl p-1.5 flex w-fit">
              {[
                { k: "days", lbl: "Kunlar bo'yicha", n: 0 },
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
        )}

        {/* —— Kunlar bo'yicha jadval —— */}
        {!who && tab === "days" && (
          <div className="px-8 pb-8 pt-4">
            <div className="overflow-auto max-h-[70vh]">
              <table className="w-full text-[0.9375rem] min-w-[56rem]">
                <thead className="sticky top-0 z-20">
                  <tr className="text-left text-muted text-sm border-b border-line [&>th]:bg-panel">
                    <th className="py-3 pr-3 font-bold">{t("Sana")}</th>
                    <th className="py-3 pr-3 font-bold text-right">{t("Naqd")}</th>
                    <th className="py-3 pr-3 font-bold text-right">{t("Payme")}</th>
                    <th className="py-3 pr-3 font-bold text-right">{t("Kassalarda balans")}</th>
                    <th className="py-3 pr-3 font-bold">{t("Berish kerak")}</th>
                    <th className="py-3 font-bold">{t("Berilgan")}</th>
                  </tr>
                  <tr className="border-b-2 border-line bg-panel">
                    <th className="py-4 pr-3 text-left font-extrabold">{t("Jami")}</th>
                    <th className="py-4 pr-3 text-right font-extrabold whitespace-nowrap">{fmtUSD(dayTotals.cash)}</th>
                    <th className="py-4 pr-3 text-right font-extrabold whitespace-nowrap">{fmtUSD(dayTotals.payme)}</th>
                    <th className="py-4 pr-3 text-right font-extrabold whitespace-nowrap">{fmtUSD(cashOnHand)}</th>
                    <th className="py-4 pr-3 text-left font-extrabold text-warn">
                      {dayTotals.due > 0 ? fmtUSD(dayTotals.due) : "—"}
                    </th>
                    <th className="py-4 text-left font-extrabold text-ok">
                      {dayTotals.paid > 0 ? fmtUSD(dayTotals.paid) : "—"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dayRows.map((r) => (
                    <tr key={r.date} className="border-b border-line last:border-0 align-top">
                      <td className="py-4 pr-3 font-bold whitespace-nowrap">
                        {fmtDay(r.date)}
                        <span className="block text-sm text-muted font-semibold">{t(weekday(r.date))}</span>
                      </td>
                      <td className="py-4 pr-3 text-right font-semibold whitespace-nowrap">
                        {r.cash ? fmtUSD(r.cash) : <span className="text-muted">—</span>}
                      </td>
                      <td className="py-4 pr-3 text-right font-semibold whitespace-nowrap">
                        {r.payme ? fmtUSD(r.payme) : <span className="text-muted">—</span>}
                      </td>
                      <td className={`py-4 pr-3 text-right font-extrabold whitespace-nowrap ${
                        r.balance < 0 ? "text-danger" : ""}`}>
                        {fmtUSD(r.balance)}
                      </td>
                      {/* Kimga va nima uchun — o'sha kuni */}
                      <td className="py-4 pr-3">
                        {r.due.length === 0 ? <span className="text-muted">—</span> : (
                          <div className="space-y-1.5">
                            {r.due.map((p) => (
                              <div key={p.id} className="flex items-baseline gap-2">
                                <Who p={p} />
                                <span className="text-sm text-muted font-semibold">
                                  {t(PAYOUT_CATEGORIES[p.category] ?? p.category)}
                                </span>
                                <span className="ml-auto font-bold text-warn whitespace-nowrap">
                                  {fmtUSD(p.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-4">
                        {r.paid.length === 0 ? <span className="text-muted">—</span> : (
                          <div className="space-y-1.5">
                            {r.paid.map((p) => (
                              <div key={p.id} className="flex items-baseline gap-2">
                                <Who p={p} />
                                <span className="text-sm text-muted font-semibold">
                                  {t(PAYOUT_CATEGORIES[p.category] ?? p.category)}
                                  {" · "}{t(KASSAS[p.kassa]?.label ?? p.kassa)}
                                </span>
                                <span className="ml-auto font-bold text-ok whitespace-nowrap">
                                  −{fmtUSD(p.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {dayRows.length === 0 && (
                    <tr><td colSpan={6} className="py-12 text-center text-muted font-semibold">
                      {t("Bu davrda pul harakati ham, to'lov ham bo'lmagan.")}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-muted font-semibold mt-4">
              {t("Naqd va Payme — o'sha kundagi kirimning to'lov turi bo'yicha bo'linishi. \"Kassalarda balans\" — o'sha kun oxirida hamma kassada qolgan pul. Ism ustiga bossangiz o'sha odam bo'yicha butun tarix ochiladi.")}
            </p>
          </div>
        )}

        {/* —— Ro'yxat: rejada / to'langan / bir odam tarixi —— */}
        {(who || tab !== "days") && (
        <div className="px-8 pb-8 pt-4">
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full text-[0.9375rem] min-w-[38.75rem]">
              {/* Sarlavha + "Jami" tepada, birga yopishib turadi */}
              <thead className="sticky top-0 z-20">
                <tr className="text-left text-muted text-sm border-b border-line [&>th]:bg-panel">
                  <th className="py-3 font-bold">{t("Kimga")}</th>
                  <th className="py-3 font-bold">{t("Nima uchun")}</th>
                  <th className="py-3 font-bold">{t(tab === "open" && !who ? "Qachon" : "Sana")}</th>
                  <th className="py-3 font-bold">{t("Qayerdan")}</th>
                  <th className="py-3 font-bold text-right">{t("Qancha")}</th>
                  <th className="py-3" />
                </tr>
                {list.length > 0 && (
                  <tr className="border-b-2 border-line bg-panel">
                    <th className="py-4 font-bold text-muted text-left" colSpan={4}>{t("Jami")}</th>
                    <th className="py-4 text-right text-lg font-extrabold">{fmtUSD(listTotal)}</th>
                    <th />
                  </tr>
                )}
              </thead>
              <tbody>
                {list.map((p) => {
                  const isPaid = p.status === "paid";
                  return (
                    <tr key={p.id} className="border-b border-line last:border-0">
                      <td className="py-4 pr-3">
                        {who ? <p className="font-bold">{p.title}</p> : <Who p={p} />}
                        {p.note && <p className="text-sm text-muted">{p.note}</p>}
                      </td>
                      <td className="py-4 pr-3 font-semibold text-muted">
                        {t(PAYOUT_CATEGORIES[p.category] ?? p.category)}
                      </td>
                      <td className="py-4 pr-3">
                        <p className="font-semibold mb-1">{fmtDay(isPaid ? p.paidAt : p.dueDate)}</p>
                        {isPaid
                          ? <span className="text-sm font-bold text-ok">{t("to'langan")}</span>
                          : <DueBadge date={p.dueDate} />}
                      </td>
                      <td className="py-4 pr-3 font-semibold text-muted whitespace-nowrap">
                        {t(KASSAS[p.kassa]?.label ?? p.kassa)}
                        <span className="block text-sm">{t(WALLETS[p.wallet])}</span>
                      </td>
                      <td className="py-4 pr-3 text-right">
                        <p className={`font-extrabold ${isPaid ? "text-ok" : ""}`}>{fmtUSD(p.amount)}</p>
                        {(p.amountSom != null || rate) && (
                          <p className="text-sm text-muted font-semibold">
                            {Math.round(somOf(p)).toLocaleString("ru-RU")} {t("so'm")}
                          </p>
                        )}
                      </td>
                      <td className="py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isPaid ? (
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
                  );
                })}
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
        )}
      </div>
    </div>
  );
}
