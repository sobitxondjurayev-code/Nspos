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
  // `diff === null` — o'sha kun KPI jadvalida qo'lda to'ldirilmagan,
  // ya'ni solishtiradigan IKKINCHI manba yo'q (2026-08-26 dan Naqd/
  // Payme/Servis Billz'dan avtomat keladi). Bunday kun jamiga ham,
  // "farq bor" sanog'iga ham KIRMAYDI — aks holda Billz'ning butun
  // kunlik puli kamomad bo'lib ko'rinardi.
  const solish = days.filter((d) => d.diff !== null);
  const totals = solish.reduce((a, d) => ({
    billz: a.billz + d.billz, kpi: a.kpi + d.kpi, diff: a.diff + d.diff,
  }), { billz: 0, kpi: 0, diff: 0 });
  // Netto farq aldamchi: bir kuni +1000, boshqa kuni −1000 bo'lsa
  // yig'indi NOL chiqadi. Shuning uchun kam va ko'p alohida sanaladi.
  const short = +solish.filter((d) => d.diff < -0.01).reduce((a, d) => a + d.diff, 0).toFixed(2);
  const over = +solish.filter((d) => d.diff > 0.01).reduce((a, d) => a + d.diff, 0).toFixed(2);
  // Farq bo'lgan kunlar soni. Tiyinlik farq ham sanaladi: rahbar
  // "0.50 qayerdan chiqdi?" deb so'raganda javob ko'rinib turishi kerak.
  const bad = solish.filter((d) => Math.abs(d.diff) >= 0.01).length;
  // 1 dollargacha farq yaxlitlashdan — ko'rinadi, lekin kulrang
  const big = solish.filter((d) => Math.abs(d.diff) > 1).length;

  return (
    <div className="fixed inset-0 z-[60] bg-overlay/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-7 pb-5 border-b border-line">
          <div>
            <h2 className="text-2xl font-extrabold">{t(label)}</h2>
            <p className="text-sm text-muted font-semibold">
              {tt("{n} kundan {b} tasida farq bor", { n: solish.length, b: bad })}
              {bad > 0 && big < bad && (
                <span> · {tt("{n} tasi 1 dollardan kam (yaxlitlash)", { n: bad - big })}</span>
              )}
              {days.length > solish.length && (
                <span> · {tt("{n} kun solishtirilmagan", { n: days.length - solish.length })}</span>
              )}
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
                <th className="px-6 py-4 text-right">
                  <span className={totals.diff < -1 ? "text-danger" : "text-ok"}>
                    {totals.diff > 0 ? "+" : ""}{fmtUSD(+totals.diff.toFixed(2))}
                  </span>
                  {(short < -0.01 || over > 0.01) && (
                    <span className="block text-sm font-bold">
                      {short < -0.01 && <span className="text-danger">{fmtUSD(short)}</span>}
                      {short < -0.01 && over > 0.01 && <span className="text-muted"> · </span>}
                      {over > 0.01 && <span className="text-ok">+{fmtUSD(over)}</span>}
                    </span>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                // Farq umuman yo'q — "—". Bor, lekin 1 dollardan kam —
                // kulrang ko'rsatiladi (yaxlitlash, kamomad emas).
                // `null` — solishtirilmagan kun (pastga qarang).
                const yoq = d.diff === null;
                const none = !yoq && Math.abs(d.diff) < 0.01;
                const small = !yoq && Math.abs(d.diff) <= 1;
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
                      {yoq ? <span className="text-muted">{t("kiritilmagan")}</span> : fmtUSD(d.kpi)}
                      {!yoq && (
                        <span className="block text-sm text-muted font-semibold">
                          {tt("naqd {c} · Payme {p}", { c: fmtUSD(d.kpiCash), p: fmtUSD(d.kpiPayme) })}
                          {d.kpiService > 0 && ` · ${t("servis")} ${fmtUSD(d.kpiService)}`}
                        </span>
                      )}
                    </td>
                    <td className={`px-6 py-3.5 text-right font-extrabold ${
                      yoq || none || small ? "text-muted" : d.diff < 0 ? "text-danger" : "text-ok"}`}>
                      {yoq ? <span title={t("Bu kun qo'lda to'ldirilmagan — solishtiradigan ikkinchi manba yo'q")}>—</span>
                        : none ? "—" : `${d.diff > 0 ? "+" : ""}${fmtUSD(d.diff)}`}
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
          {t("Pastdagi ikki raqam — kam topshirilgani va ko'p topshirilgani alohida. Ularni qo'shib yubormaslik kerak: bir kuni 1 000 kam, boshqa kuni 1 000 ko'p bo'lsa yig'indi nol chiqadi-yu, ikkala kun ham tekshiruvsiz qoladi.")}
          {" "}
          {t("Servis puli ham qo'shib solishtiriladi: menejer uni naqddan ayirib yozadi, Billz esa montajni oddiy sotuv deb naqdga qo'shadi. 1 dollardan kam farq kulrang turadi — u yaxlitlash, kamomad emas. Farq manfiy bo'lsa menejer Billz ko'rsatgandan kam topshirgan, musbat bo'lsa ko'p.")}
          {" "}
          {t("2026-08-26 dan KPI jadvalidagi Naqd/Payme/Servis Billz'dan avtomat to'ladi. Shuning uchun bu yerda faqat menejer QO'LDA yozgan kunlar solishtiriladi — qolganida ikkinchi manba yo'q va \"farq 0\" deb ko'rsatish yolg'on bo'lardi.")}
        </p>
      </div>
    </div>
  );
}
