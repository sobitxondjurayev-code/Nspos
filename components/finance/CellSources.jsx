"use client";
import { t, tt } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { fmtUSD } from "@/lib/demoData";
import { flowSources } from "@/lib/kassaData";

// "2026-08-05" → "05.08.2026"
const fmtDay = (d) => {
  const [y, m, dd] = String(d).slice(0, 10).split("-");
  return `${dd}.${m}.${y}`;
};
const som = (n) => Math.round(n).toLocaleString("ru-RU");

// ══════════════════════════════════════════════════════════════
// KATAK ORTIDAGI RO'YXAT
// ══════════════════════════════════════════════════════════════
// Jadvaldagi raqamning ustiga bosilganda ochiladi: shu summa qaysi
// yozuvlardan yig'ilgani — sana, kim/nima uchun va qancha.
//
// Nega kerak: "5 419 dollar qayerdan chiqdi?" degan savolga jadvalning
// o'zi javob bermaydi. Rahbar har safar Xarajatlar yoki KPI bo'limiga
// borib qidirishi kerak bo'lardi.
//
// Ikki ko'rinish: "Turi bo'yicha" (tushlik, yo'lkira, mashina gazi —
// har biri yig'ilgan holda) va "Ro'yxat" (har yozuv alohida). O'nlab
// mayda yozuvni ko'zdan kechirgandan ko'ra, avval qaysi turga qancha
// ketgani ko'ringani yaxshi.
export default function CellSources({ from, to, colKey, label, dayLabel, kassa = null,
                                      rows: given = null, onClose }) {
  const rows = given ?? flowSources(from, to, colKey, { kassa });
  const total = +rows.reduce((s, r) => s + (r.out ? -r.amount : r.amount), 0).toFixed(2);
  const totalSom = rows.some((r) => r.amountSom != null)
    ? rows.reduce((s, r) => s + (r.amountSom ?? 0), 0) : null;

  // Pul qaysi qopdan chiqqani (B2C · Naqd, Servis…) — kassaning kunlik
  // jadvali shu belgini beradi, boshqa sahifalar bermaydi.
  const hasPot = rows.some((r) => r.pot);

  // Turi bo'yicha yig'indi. Kalit — nomi va qopi: bir xil turdagi
  // xarajat servisdan ham, do'kon naqdidan ham chiqishi mumkin.
  const groups = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      const key = `${r.title}|${r.pot ?? ""}|${r.out ? "-" : "+"}`;
      const g = m.get(key) ?? {
        key, title: r.title, pot: r.pot ?? null, out: !!r.out,
        n: 0, amount: 0, amountSom: null, repeat: r.repeat,
      };
      g.n += 1;
      g.amount = +(g.amount + r.amount).toFixed(2);
      if (r.amountSom != null) g.amountSom = (g.amountSom ?? 0) + r.amountSom;
      m.set(key, g);
    }
    return [...m.values()].sort((a, b) => b.amount - a.amount);
  }, [rows]);

  // Yig'ish faqat foyda bersa (yozuv turlardan ko'p bo'lsa) o'zi yoqiladi
  const [view, setView] = useState(() => (rows.length > groups.length ? "group" : "list"));
  const grouped = view === "group";

  return (
    <div className="fixed inset-0 z-[60] bg-overlay/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 p-7 pb-5 border-b border-line">
          <div>
            <h2 className="text-2xl font-extrabold">{t(label)}</h2>
            <p className="text-sm text-muted font-semibold">
              {dayLabel} · {tt("{n} ta yozuv", { n: rows.length })}
              {rows.length > groups.length && ` · ${tt("{n} xil tur", { n: groups.length })}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {rows.length > groups.length && (
              <div className="bg-track rounded-xl p-1 flex shrink-0">
                {[["group", "Turi bo'yicha"], ["list", "Ro'yxat"]].map(([k, lbl]) => (
                  <button key={k} onClick={() => setView(k)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-bold transition-colors ${
                      view === k ? "bg-panel text-ink" : "text-muted hover:text-ink"}`}>
                    {t(lbl)}
                  </button>
                ))}
              </div>
            )}
            <button onClick={onClose} className="text-muted hover:text-ink"><X size={22} /></button>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-[0.9375rem]">
            <thead className="sticky top-0 z-20">
              <tr className="text-left text-muted text-sm border-b border-line [&>th]:bg-panel">
                <th className="px-6 py-4 font-bold">{t(grouped ? "Nima uchun" : "Sana")}</th>
                <th className="px-4 py-4 font-bold">{t(grouped ? "Nechta" : "Nima uchun")}</th>
                {hasPot && <th className="px-4 py-4 font-bold">{t("Qayerdan")}</th>}
                <th className="px-6 py-4 font-bold text-right">{t("Summa")}</th>
              </tr>
              <tr className="bg-panel border-b-2 border-line font-extrabold">
                <th className="px-6 py-4 text-left" colSpan={hasPot ? 3 : 2}>{t("Jami")}</th>
                <th className={`px-6 py-4 text-right ${total < 0 ? "text-danger" : "text-ok"}`}>
                  {total < 0 ? "−" : ""}{fmtUSD(Math.abs(total))}
                  {totalSom > 0 && (
                    <span className="block text-sm text-muted font-bold">{som(totalSom)} {t("so'm")}</span>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {grouped && groups.map((g) => (
                <tr key={g.key} className="border-b border-line last:border-0">
                  <td className="px-6 py-4">
                    <p className="font-bold">
                      {t(g.title)}
                      {g.repeat && (
                        <span className="ml-2 text-xs font-bold text-brand">{t("doimiy")}</span>
                      )}
                    </p>
                  </td>
                  <td className="px-4 py-4 font-semibold text-muted whitespace-nowrap">
                    {tt("{n} ta", { n: g.n })}
                  </td>
                  {hasPot && (
                    <td className="px-4 py-4 font-semibold text-muted whitespace-nowrap">{t(g.pot ?? "—")}</td>
                  )}
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <span className={`font-extrabold ${g.out ? "text-danger" : "text-ok"}`}>
                      {g.out ? "−" : ""}{fmtUSD(g.amount)}
                    </span>
                    {g.amountSom != null && (
                      <span className="block text-sm text-muted font-semibold">{som(g.amountSom)} {t("so'm")}</span>
                    )}
                  </td>
                </tr>
              ))}
              {!grouped && rows.map((r, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="px-6 py-4 font-bold whitespace-nowrap">{fmtDay(r.date)}</td>
                  <td className="px-4 py-4">
                    <p className="font-bold">
                      {t(r.title)}
                      {r.repeat && (
                        <span className="ml-2 text-xs font-bold text-brand">{t("doimiy")}</span>
                      )}
                    </p>
                    {r.note && <p className="text-sm text-muted font-semibold">{r.note}</p>}
                  </td>
                  {hasPot && (
                    <td className="px-4 py-4 font-semibold text-muted whitespace-nowrap">{t(r.pot ?? "—")}</td>
                  )}
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <span className={`font-extrabold ${r.out ? "text-danger" : "text-ok"}`}>
                      {r.out ? "−" : ""}{fmtUSD(r.amount)}
                    </span>
                    {r.amountSom != null && (
                      <span className="block text-sm text-muted font-semibold">{som(r.amountSom)} {t("so'm")}</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={hasPot ? 4 : 3} className="px-6 py-12 text-center text-muted font-semibold">
                  {t("Bu katak ortida yozuv yo'q")}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
