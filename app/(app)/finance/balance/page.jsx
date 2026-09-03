"use client";
import { t, tt } from "@/lib/i18n";
import BillzMuhr from "@/components/BillzMuhr";
import { useMemo, useState } from "react";
import {
  Scale, Landmark, Boxes, Percent, TriangleAlert, ArrowRight,
} from "lucide-react";
import { fmtUSD, demoStores } from "@/lib/demoData";
import { fmtDate } from "@/lib/dates";
import StatCard from "@/components/finance/StatCard";
import { balanceSheet, ledgerStartDate } from "@/lib/balanceData";
import BalanceStructure from "@/components/finance/BalanceStructure";
import Manfiy from "@/components/ui/Manfiy";
import useUploadRows from "@/components/useUploadRows";

export default function FinanceBalance() {
  const [asOf] = useState(() => new Date());
  // Debitor qarzdorlik Billz'ning "Долги клиентов" yuklamasidan keladi.
  // Qarz endi faqat bazadan (Billz ko'zgusi) — Excel yuklamasi yo'q.
  const rows = useUploadRows(["efficiency"]);
  const b = useMemo(() => balanceSheet(asOf), [asOf, rows]);

  const bar = (amount, total) => (total > 0 ? (amount / total) * 100 : 0);

  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight mb-2">{t("Balans")}</h1>
      <BillzMuhr className="mb-4" />
      <p className="text-muted font-semibold mb-7">
        {tt("{d} holatiga · {start} dan boshlab yig'ilgan", {
          d: fmtDate(asOf), start: fmtDate(ledgerStartDate()),
        })}
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-7">
        <StatCard icon={Landmark} label="Jami aktiv" value={fmtUSD(b.totalAssets)}
          hint={t("Korxonada nima bor")} />
        <StatCard icon={Scale} label="Jami majburiyat" tone="red" value={fmtUSD(b.totalLiabilities)}
          hint={t("Boshqalarga qarzimiz")} />
        <StatCard icon={Percent} label="O'z kapitali" tone="green" value={fmtUSD(b.equity)}
          hint={tt("Aktivning {n}%", { n: b.equityRatio })} />
        <StatCard icon={Boxes} label="Aylanma kapital"
          tone={b.workingCapital >= 0 ? "green" : "red"}
          value={<Manfiy v={b.workingCapital} sabab="majburiyat">{fmtUSD(b.workingCapital)}</Manfiy>}
          hint={b.currentRatio !== null ? tt("Joriy likvidlik {n}", { n: b.currentRatio }) : "—"} />
      </div>

      {/* Aktiv / Passiv */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-7">

      {/* Ikki uzun ro'yxatdan "pulimiz qayerda?" degan savolga javob
          topish uchun raqamlarni ko'z bilan solishtirish kerak edi —
          270 758 va 8 347 ni. Ustun uzunligi buni bir qarashda
          ko'rsatadi. */}
      <BalanceStructure balance={b} />

        <div className="card p-7">
          <h2 className="text-2xl font-extrabold mb-1">{t("AKTIV")}</h2>
          <p className="text-sm text-muted font-semibold mb-6">{t("Korxona mablag'lari")}</p>
          <div className="space-y-5">
            {b.assets.map((a) => (
              <div key={a.key}>
                <div className="flex items-end justify-between mb-1.5">
                  <span className="font-bold">
                    {t(a.label)}
                    {a.hint && <span className="block text-sm font-semibold text-muted">{a.hint}</span>}
                  </span>
                  <span className="font-extrabold whitespace-nowrap">{fmtUSD(a.amount)}</span>
                </div>
                <div className="h-2 rounded-full bg-track overflow-hidden">
                  <div className="h-full rounded-full bg-brand"
                    style={{ width: bar(a.amount, b.totalAssets) + "%" }} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-line mt-6 pt-5">
            <span className="text-lg font-extrabold">{t("Jami aktiv")}</span>
            <span className="text-2xl font-extrabold">{fmtUSD(b.totalAssets)}</span>
          </div>
        </div>

        <div className="card p-7">
          <h2 className="text-2xl font-extrabold mb-1">{t("PASSIV")}</h2>
          <p className="text-sm text-muted font-semibold mb-6">{t("Mablag' manbalari")}</p>
          <div className="space-y-5">
            {b.liabilities.map((l) => (
              <div key={l.key}>
                <div className="flex items-end justify-between mb-1.5">
                  <span className="font-bold">
                    {t(l.label)}
                    {l.hint && <span className="block text-sm font-semibold text-muted">{l.hint}</span>}
                  </span>
                  <span className="font-extrabold whitespace-nowrap text-danger">{fmtUSD(l.amount)}</span>
                </div>
                <div className="h-2 rounded-full bg-track overflow-hidden">
                  <div className="h-full rounded-full bg-danger"
                    style={{ width: bar(l.amount, b.totalAssets) + "%" }} />
                </div>
              </div>
            ))}
            <div>
              <div className="flex items-end justify-between mb-1.5">
                <span className="font-bold">
                  {t("O'z kapitali")}
                  <span className="block text-sm font-semibold text-muted">
                    {t("Aktiv minus majburiyat")}
                  </span>
                </span>
                <span className="font-extrabold whitespace-nowrap text-ok">{fmtUSD(b.equity)}</span>
              </div>
              <div className="h-2 rounded-full bg-track overflow-hidden">
                <div className="h-full rounded-full bg-ok"
                  style={{ width: bar(b.equity, b.totalAssets) + "%" }} />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-line mt-6 pt-5">
            <span className="text-lg font-extrabold">{t("Jami passiv")}</span>
            <span className="text-2xl font-extrabold">
              {fmtUSD(+(b.totalLiabilities + b.equity).toFixed(2))}
            </span>
          </div>
        </div>
      </div>

      {/* Ombor tafsiloti */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-7">
        <div className="card p-7">
          <h2 className="text-2xl font-extrabold mb-5">{t("Omborda bog'lanib qolgan pul")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            <div>
              <p className="text-sm font-bold text-muted mb-1">{t("Tannarxda")}</p>
              <p className="text-2xl font-extrabold">{fmtUSD(b.inventory.cost)}</p>
            </div>
            <div>
              <p className="text-sm font-bold text-muted mb-1">{t("Sotuv narxida")}</p>
              <p className="text-2xl font-extrabold">{fmtUSD(b.inventory.retail)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-ok font-bold mb-5">
            <ArrowRight size={18} />
            {tt("Sotilsa {n} foyda beradi", { n: fmtUSD(b.inventory.potentialProfit) })}
          </div>
          <table className="w-full text-[0.9375rem]">
            <tbody>
              {demoStores.map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <td className="py-3 font-bold">{s.name}</td>
                  {/* `tabular-nums` — raqamlar bir-birining tagiga tushsin.
                      Proporsional raqamda "1 284.00" va "947.50" xonalari
                      siljib turadi va ustunni ko'z bilan solishtirib
                      bo'lmaydi. */}
                  <td className="py-3 text-right font-extrabold tabular-nums">{fmtUSD(b.inventory.byStore[s.id])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-sm text-muted font-semibold mt-4">
            {tt("Aktivning {n}% i omborda turibdi", { n: b.inventoryShare })}
          </p>
        </div>

        <div className="card p-7">
          <h2 className="text-2xl font-extrabold mb-5">{t("Qarz muvozanati")}</h2>
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="font-bold">{t("Bizga qarz (debitor)")}</span>
              <span className="text-xl font-extrabold text-ok">{fmtUSD(b.receivables.total)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold">{t("Biz qarzdormiz (kreditor)")}</span>
              <span className="text-xl font-extrabold text-danger">{fmtUSD(b.payables.totalOpen)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-line pt-5">
              <span className="font-extrabold">{t("Sof qarz holati")}</span>
              <span className={`text-2xl font-extrabold ${
                b.receivables.total >= b.payables.totalOpen ? "text-ok" : "text-danger"}`}>
                {fmtUSD(+(b.receivables.total - b.payables.totalOpen).toFixed(2))}
              </span>
            </div>
          </div>
          <p className="text-sm text-muted font-semibold mt-5">
            {t("Musbat bo'lsa — bizga qarzdorlar ko'p. Lekin bu pul hali kelmagan: qancha tez qaytsa, aylanma shuncha yengil.")}
          </p>
        </div>
      </div>

      {/* Ogohlantirish */}
      <div className="card p-6 border-warn/40">
        <div className="flex gap-4">
          <span className="w-10 h-10 rounded-xl bg-warn-soft text-warn flex items-center justify-center shrink-0">
            <TriangleAlert size={20} />
          </span>
          <div>
            <p className="font-extrabold mb-2">{t("Balans qanday hisoblanadi")}</p>
            <ul className="text-[0.9375rem] text-muted font-semibold space-y-1.5">
              <li>{t("Kassa qoldig'i 01.01.2026 dan boshlab sotuv va kassa operatsiyalaridan yig'iladi — boshlang'ich qoldiq nolga teng deb olingan.")}</li>
              <li>{t("Ombor tannarxda baholanadi, manfiy qoldiqlar (masalan montaj xizmati) aktivga kiritilmaydi.")}</li>
              <li>{t("O'z kapitali balanslovchi qism sifatida chiqariladi: ta'sischi qo'ygan boshlang'ich mablag' alohida yuritilmagan.")}</li>
              <li>{t("Asosiy vositalar (bino, mashina, jihoz) hali kiritilmagan — ularni bersangiz aktivga qo'shiladi.")}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
