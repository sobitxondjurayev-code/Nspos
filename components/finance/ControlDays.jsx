"use client";
import { t, tt } from "@/lib/i18n";
import { X } from "lucide-react";
import { fmtUSD } from "@/lib/demoData";
import { kassaControlDays } from "@/lib/kassaData";

const fmtDay = (d) => {
  const [y, m, dd] = String(d).slice(0, 10).split("-");
  return `${dd}.${m}.${y}`;
};

// ══════════════════════════════════════════════════════════════
// FARQ QAYSI KUNLARDA CHIQQAN
// ══════════════════════════════════════════════════════════════
// Kamomad jadvalidagi "Farq" ustiga bosilganda ochiladi. Bitta umumiy
// raqam ("−5 662") hech narsani aytmaydi: pul bir kunda yo'qolganmi
// yoki har kuni ozdan kamayib borganmi — javob shu yerda.
//
// Kunlar farq kattaligi bo'yicha emas, SANA bo'yicha turadi: rahbar
// odatda "o'sha kuni nima bo'lgan edi?" deb eslashga harakat qiladi.
export default function ControlDays({ kassaId, label, onClose }) {
  const days = kassaControlDays(kassaId);
  const totals = days.reduce((a, d) => ({
    billz: a.billz + d.billz, kpi: a.kpi + d.kpi, diff: a.diff + d.diff,
  }), { billz: 0, kpi: 0, diff: 0 });
  // Sezilarli farq bo'lgan kunlar soni (1 dollargacha — yaxlitlash)
  const bad = days.filter((d) => Math.abs(d.diff) > 1).length;

  return (
    <div className="fixed inset-0 z-[60] bg-overlay/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-3xl max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-7 pb-5 border-b border-line">
          <div>
            <h2 className="text-2xl font-extrabold">{t(label)}</h2>
            <p className="text-sm text-muted font-semibold">
              {tt("{n} kundan {b} tasida farq bor", { n: days.length, b: bad })}
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={22} /></button>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-[0.9375rem]">
            <thead className="sticky top-0 z-20">
              <tr className="text-left text-muted text-sm border-b border-line [&>th]:bg-panel">
                <th className="px-6 py-4 font-bold">{t("Sana")}</th>
                <th className="px-4 py-4 font-bold text-right">{t("Billz bo'yicha")}</th>
                <th className="px-4 py-4 font-bold text-right">{t("KPI jadvalida")}</th>
                <th className="px-6 py-4 font-bold text-right">{t("Farq")}</th>
              </tr>
              <tr className="bg-panel border-b-2 border-line font-extrabold">
                <th className="px-6 py-4 text-left">{t("Jami")}</th>
                <th className="px-4 py-4 text-right">{fmtUSD(+totals.billz.toFixed(2))}</th>
                <th className="px-4 py-4 text-right">{fmtUSD(+totals.kpi.toFixed(2))}</th>
                <th className={`px-6 py-4 text-right ${totals.diff < -1 ? "text-danger" : "text-ok"}`}>
                  {totals.diff > 0 ? "+" : ""}{fmtUSD(+totals.diff.toFixed(2))}
                </th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const ok = Math.abs(d.diff) <= 1;
                return (
                  <tr key={d.date} className="border-b border-line last:border-0">
                    <td className="px-6 py-3.5 font-bold whitespace-nowrap">{fmtDay(d.date)}</td>
                    <td className="px-4 py-3.5 text-right font-semibold">
                      {fmtUSD(d.billz)}
                      <span className="block text-sm text-muted font-semibold">
                        {tt("naqd {c} · Payme {p}", { c: fmtUSD(d.billzCash), p: fmtUSD(d.billzPayme) })}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold">
                      {d.kpi > 0 ? fmtUSD(d.kpi) : <span className="text-muted">{t("kiritilmagan")}</span>}
                      {d.kpi > 0 && (
                        <span className="block text-sm text-muted font-semibold">
                          {tt("naqd {c} · Payme {p}", { c: fmtUSD(d.kpiCash), p: fmtUSD(d.kpiPayme) })}
                        </span>
                      )}
                    </td>
                    <td className={`px-6 py-3.5 text-right font-extrabold ${
                      ok ? "text-muted" : d.diff < 0 ? "text-danger" : "text-ok"}`}>
                      {ok ? "—" : `${d.diff > 0 ? "+" : ""}${fmtUSD(d.diff)}`}
                    </td>
                  </tr>
                );
              })}
              {days.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-muted font-semibold">
                  {t("Bu davrda solishtiradigan kun yo'q")}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="px-7 py-4 text-sm text-muted font-semibold border-t border-line">
          {t("1 dollargacha farq ko'rsatilmaydi — u yaxlitlash. Farq manfiy bo'lsa menejer Billz ko'rsatgandan kam topshirgan, musbat bo'lsa ko'p.")}
        </p>
      </div>
    </div>
  );
}
