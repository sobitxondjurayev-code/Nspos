"use client";
import { t, tt } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { Search, Wallet } from "lucide-react";
import { fmtUSD } from "@/lib/demoData";
import { listCustomers } from "@/lib/customersData";
import { customerDebtStats } from "@/lib/debtsData";
import { addOperation } from "@/lib/financeData";
import DebtPaymentModal from "@/components/DebtPaymentModal";
import StatCard from "@/components/finance/StatCard";
import useUploadRows from "@/components/useUploadRows";

export default function FinanceDebts() {
  const [q, setQ] = useState("");
  const [payFor, setPayFor] = useState(null);
  const [tick, setTick] = useState(0);
  // Qarzlar Billz yuklamasidan o'qiladi — qatorlari shu yerda tortiladi
  const rows = useUploadRows(["client_debts"]);

  const debtors = useMemo(() => {
    const s = q.trim().toLowerCase();
    const digits = s.replace(/\D/g, "");
    return listCustomers()
      .map((c) => ({ customer: c, stats: customerDebtStats(c.id) }))
      .filter((r) => r.stats.openAmount > 0)
      .filter(({ customer: c }) =>
        !s || c.name.toLowerCase().includes(s) || (digits && c.phone.replace(/\D/g, "").includes(digits)))
      .sort((a, b) => b.stats.oldestOpenDays - a.stats.oldestOpenDays);
  }, [q, tick, rows]);

  const totalOpen = +debtors.reduce((a, r) => a + r.stats.openAmount, 0).toFixed(2);
  const overdue = debtors.filter((r) => r.stats.oldestOpenDays > 30).length;

  function handlePaid({ amount, method, customerId }) {
    const c = listCustomers().find((x) => x.id === customerId);
    addOperation({
      category: "debt", amount, method,
      note: tt("{name} qarz to'lovi", { name: c?.name ?? "" }), customerId,
    });
    setTick((v) => v + 1);
  }

  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight mb-7">{t("Qarz to'lovlari")}</h1>

      <div className="grid grid-cols-3 gap-5 mb-6">
        <StatCard icon={Wallet} label="Umumiy ochiq qarz" tone="red" value={fmtUSD(totalOpen)}
          hint={tt("{n} ta qarzdor", { n: debtors.length })} />
        <StatCard icon={Wallet} label="30 kundan oshgan" tone="amber" value={tt("{n} ta", { n: overdue })}
          hint={t("Muddati o'tgan qarzdorlar")} />
      </div>

      <div className="card flex items-center gap-3 px-4 mb-5">
        <Search size={20} className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={t("Qarzdorni ism yoki telefon bo'yicha qidirish...")}
          className="w-full py-3.5 outline-none font-semibold bg-transparent" />
      </div>

      <div className="card overflow-auto max-h-[70vh]">
        <table className="w-full text-[0.9375rem]">
          <thead>
            <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-20 text-left text-muted text-sm border-b border-line [&>th]:bg-panel">
              <th className="px-6 py-4 font-bold">{t("Qarzdor")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Qarzi")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Eng eski")}</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {debtors.map(({ customer: c, stats }) => (
              <tr key={c.id} className="border-b border-line last:border-0 hover:bg-surface/70">
                <td className="px-6 py-4">
                  <p className="font-bold">{c.name}</p>
                  <p className="text-sm text-muted">{c.phone}</p>
                </td>
                <td className="px-4 py-4 text-right font-extrabold text-danger">{fmtUSD(stats.openAmount)}</td>
                <td className="px-4 py-4 text-right font-bold">
                  <span className={stats.oldestOpenDays > 30 ? "text-danger" : "text-warn"}>
                    {tt("{n} kun", { n: stats.oldestOpenDays })}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => setPayFor(c)}
                    className="rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-4 py-2">
                    {t("To'lash")}
                  </button>
                </td>
              </tr>
            ))}
            {debtors.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-muted font-semibold">
                {t("Qarzdor topilmadi")}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {payFor && (
        <DebtPaymentModal customer={payFor} onClose={() => setPayFor(null)} onPaid={handlePaid} />
      )}
    </div>
  );
}
