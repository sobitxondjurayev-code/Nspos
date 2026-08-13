"use client";
import { t, tt } from "@/lib/i18n";
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
// `rows` berilsa yozuvlar tashqaridan keladi (kassaning kunlik daftari
// o'z ro'yxatini o'zi beradi) — oyna ko'rinishi baribir bitta bo'lib
// qoladi. Berilmasa, odatdagidek katak kalitidan hisoblanadi.
export default function CellSources({ from, to, colKey, label, dayLabel, kassa = null,
                                      rows: given = null, onClose }) {
  const rows = given ?? flowSources(from, to, colKey, { kassa });
  const total = +rows.reduce((s, r) => s + (r.out ? -r.amount : r.amount), 0).toFixed(2);
  const totalSom = rows.some((r) => r.amountSom != null)
    ? rows.reduce((s, r) => s + (r.amountSom ?? 0), 0) : null;

  return (
    <div className="fixed inset-0 z-[60] bg-overlay/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-7 pb-5 border-b border-line">
          <div>
            <h2 className="text-2xl font-extrabold">{t(label)}</h2>
            <p className="text-sm text-muted font-semibold">
              {dayLabel} · {tt("{n} ta yozuv", { n: rows.length })}
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={22} /></button>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-[0.9375rem]">
            <thead className="sticky top-0 z-20">
              <tr className="text-left text-muted text-sm border-b border-line [&>th]:bg-panel">
                <th className="px-6 py-4 font-bold">{t("Sana")}</th>
                <th className="px-4 py-4 font-bold">{t("Nima uchun")}</th>
                <th className="px-6 py-4 font-bold text-right">{t("Summa")}</th>
              </tr>
              <tr className="bg-panel border-b-2 border-line font-extrabold">
                <th className="px-6 py-4 text-left" colSpan={2}>{t("Jami")}</th>
                <th className={`px-6 py-4 text-right ${total < 0 ? "text-danger" : "text-ok"}`}>
                  {total < 0 ? "−" : ""}{fmtUSD(Math.abs(total))}
                  {totalSom > 0 && (
                    <span className="block text-sm text-muted font-bold">{som(totalSom)} {t("so'm")}</span>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
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
                <tr><td colSpan={3} className="px-6 py-12 text-center text-muted font-semibold">
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
