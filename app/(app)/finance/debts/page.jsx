"use client";
import { t, tt } from "@/lib/i18n";
import BillzMuhr from "@/components/BillzMuhr";
import { useMemo, useState } from "react";
import { Search, Wallet } from "lucide-react";
import { fmtUSD } from "@/lib/demoData";
import { listCustomers } from "@/lib/customersData";
import { debtorRows, jamiQarz } from "@/lib/debtsData";
import { billzVaqtMatni } from "@/lib/billzLogData";
import { addOperation } from "@/lib/financeData";
import DebtPaymentModal from "@/components/DebtPaymentModal";
import StatCard from "@/components/finance/StatCard";
import { useLive } from "@/components/DataProvider";
import DataTable from "@/components/ui/DataTable";
import Button from "@/components/ui/Button";

export default function FinanceDebts() {
  const [q, setQ] = useState("");
  const [payFor, setPayFor] = useState(null);
  const [tick, setTick] = useState(0);
  const live = useLive();

  // QARZ BO'YICHA, mijoz bo'yicha emas. Ilgari `listCustomers()` aylanib
  // har mijozning qarzi olinardi — mijozi bog'lanmagan qarz jimgina
  // tushib qolardi va jami Balans bilan mos kelmasdi. `debtorRows()`
  // bunday qarzlarni "Ro'yxatdan o'tmagan mijozlar" qatoriga yig'adi.
  const hamma = useMemo(() => debtorRows().filter((r) => r.openAmount > 0), [tick, live]);
  const debtors = useMemo(() => {
    const s = q.trim().toLowerCase();
    const digits = s.replace(/\D/g, "");
    return hamma
      .map((r) => ({ customer: r.customer, stats: r }))
      .filter(({ customer: c }) =>
        !s || c.name.toLowerCase().includes(s) || (digits && String(c.phone ?? "").replace(/\D/g, "").includes(digits)))
      .sort((a, b) => b.stats.oldestOpenDays - a.stats.oldestOpenDays);
  }, [q, hamma]);

  // Jami qarzdorlik — Billz "Jami qarz" bilan bir xil ta'rif
  // (`jamiQarz`): Balans, Hisobotlar va API ham shu funksiyani o'qiydi.
  const jami = useMemo(() => jamiQarz(), [tick, live]);
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
      <BillzMuhr entity="debts" className="mb-4" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
        <StatCard icon={Wallet} label="Jami qarzdorlik" tone="red" value={fmtUSD(jami.jami)}
          hint={tt("{n} ta qarz · {m} ta qarzdor · Billz: {v}",
            { n: jami.soni, m: hamma.length, v: billzVaqtMatni(jami.billzVaqti) ?? "—" })} />
        <StatCard icon={Wallet} label="30 kundan oshgan" tone="amber" value={tt("{n} ta", { n: overdue })}
          hint={t("Muddati o'tgan qarzdorlar")} />
      </div>

      <div className="card flex items-center gap-3 px-4 mb-5">
        <Search size={20} className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={t("Qarzdorni ism yoki telefon bo'yicha qidirish...")}
          className="w-full py-3.5 outline-none font-semibold bg-transparent" />
      </div>

      {/* Jadval standarti `DataTable` da: sarlavha pin, chap ustun pin,
          "Jami", saralash, "Ustunlar", Excel — hammasi o'zi bo'ladi.
          Ilgari bu sahifada ularning BIRORTASI yo'q edi. */}
      <DataTable
        id="finance-debts"
        name={t("Qarz to'lovlari")}
        rows={debtors}
        rowKey={(r) => r.customer.id}
        count={debtors.length}
        boshSort={{ key: "kun", dir: "desc" }}
        minWidth="34rem"
        empty={{ icon: Wallet, title: "Qarzdor topilmadi",
                 hint: "Qidiruvni tozalab ko'ring yoki Billz'dan qarzlarni yangilang" }}
        columns={[
          {
            key: "nom", label: "Qarzdor", locked: true,
            value: (r) => r.customer.name,
            cell: (r) => (
              <>
                <p className="font-bold">{r.customer.name}</p>
                <p className="text-sm text-muted">{r.customer.phone}</p>
              </>
            ),
          },
          {
            key: "qarz", label: "Qarzi", right: true,
            value: (r) => r.stats.openAmount,
            cell: (r) => <span className="font-extrabold text-danger">{fmtUSD(r.stats.openAmount)}</span>,
            total: (rows) => (
              <span className="text-danger">
                {fmtUSD(rows.reduce((a, r) => a + r.stats.openAmount, 0))}
              </span>
            ),
          },
          {
            key: "kun", label: "Eng eski", right: true,
            value: (r) => r.stats.oldestOpenDays,
            cell: (r) => (
              <span className={`font-bold ${r.stats.oldestOpenDays > 30 ? "text-danger" : "text-warn"}`}>
                {tt("{n} kun", { n: r.stats.oldestOpenDays })}
              </span>
            ),
          },
          {
            key: "harakat", label: "Harakat", harakat: true, right: true, width: "8rem",
            cell: (r) => (r.customer.id === "unknown" ? null : (
              <Button olcham="kichik" korinish="asosiy" onClick={() => setPayFor(r.customer)}>
                To'lash
              </Button>
            )),
          },
        ]}
      />

      {payFor && (
        <DebtPaymentModal customer={payFor} onClose={() => setPayFor(null)} onPaid={handlePaid} />
      )}
    </div>
  );
}
