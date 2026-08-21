"use client";
import { t, tt } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { Truck, AlertTriangle, CalendarClock, Scale, Plus } from "lucide-react";
import { fmtUSD } from "@/lib/demoData";
import {
  listSuppliers, addSupplier, supplierRows, payablesSummary, openInvoices,
  getSupplier, addInvoice,
} from "@/lib/suppliersData";
import { overallDebtStats } from "@/lib/debtsData";
import { addOperation } from "@/lib/financeData";
import SupplierPayModal from "@/components/SupplierPayModal";
import StatCard from "@/components/finance/StatCard";
import DataTable from "@/components/ui/DataTable";
import Button from "@/components/ui/Button";
import useUploadRows from "@/components/useUploadRows";

const fmtDay = (iso) => {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
};

/* Qo'lda faktura qo'shish (partiyasiz xaridlar uchun) */
function InvoiceModal({ onClose, onSave }) {
  const suppliers = listSuppliers();
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [newName, setNewName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");

  const amt = Number(amount) || 0;
  const valid = (supplierId || newName.trim()) && amt > 0;

  function save() {
    let sid = supplierId;
    if (!sid && newName.trim()) sid = addSupplier({ name: newName.trim() }).id;
    onSave({ supplierId: sid, amount: amt, dueDate: dueDate || undefined, note });
  }

  return (
    <div className="fixed inset-0 z-50 bg-overlay/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-8" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-extrabold mb-6">{t("Yangi faktura")}</h2>

        <label className="block text-sm font-bold mb-2">{t("Yetkazib beruvchi")}</label>
        <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="inp mb-3">
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          <option value="">{t("+ Yangi yetkazib beruvchi")}</option>
        </select>
        {!supplierId && (
          <input value={newName} onChange={(e) => setNewName(e.target.value)}
            className="inp mb-3" placeholder={t("Yetkazib beruvchi nomi")} autoFocus />
        )}

        <label className="block text-sm font-bold mb-2">{t("Summa (USD)")} *</label>
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
          className="inp mb-3" placeholder="0.00" />

        <label className="block text-sm font-bold mb-2">{t("To'lov muddati")}</label>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="inp mb-1" />
        <p className="text-sm text-muted font-semibold mb-3">{t("Bo'sh qoldirilsa: 30 kun")}</p>

        <label className="block text-sm font-bold mb-2">{t("Izoh")}</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} className="inp mb-7"
          placeholder={t("Ixtiyoriy")} />

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-line font-bold py-3 hover:bg-surface">
            {t("Bekor qilish")}
          </button>
          <button disabled={!valid} onClick={save}
            className="flex-1 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold py-3 disabled:opacity-50">
            {t("Saqlash")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FinancePayables() {
  const [payFor, setPayFor] = useState(null); // { supplier, invoiceId? }
  const [invModal, setInvModal] = useState(false);
  const [tick, setTick] = useState(0);
  const bump = () => setTick((v) => v + 1);

  // Debitor qarz Billz yuklamasidan o'qiladi
  const uploads = useUploadRows(["client_debts"]);
  const summary = useMemo(() => payablesSummary(), [tick]);
  const schedule = useMemo(() => openInvoices(), [tick]);
  const rows = useMemo(() => supplierRows(), [tick]);
  // Debitor tomoni — taqqoslash uchun (mijozlar bizga qarzdor)
  const receivable = useMemo(() => overallDebtStats(), [tick, uploads]);
  const net = +(receivable.openAmount - summary.totalOpen).toFixed(2);

  // To'lov kassa jurnaliga chiqim bo'lib tushadi
  function handlePaid({ supplierId, invoiceNo, amount, method }) {
    const s = getSupplier(supplierId);
    addOperation({
      category: "supplier_payment", amount, method,
      note: `${s?.name ?? ""} · ${invoiceNo}`,
    });
    bump();
  }

  function saveInvoice(data) {
    addInvoice(data);
    setInvModal(false);
    bump();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-7">
        <h1 className="text-4xl font-extrabold tracking-tight">{t("Yetkazib beruvchilar")}</h1>
        <button onClick={() => setInvModal(true)}
          className="flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-5 py-3">
          <Plus size={20} /> {t("Yangi faktura")}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-5 mb-7">
        <StatCard icon={Truck} label="Kreditor qarz (biz qarzdormiz)" tone="red"
          value={fmtUSD(summary.totalOpen)}
          hint={tt("{n} ta ochiq faktura", { n: summary.openCount })} />
        <StatCard icon={AlertTriangle} label="Muddati o'tgan" tone="red"
          value={fmtUSD(summary.overdueAmount)}
          hint={tt("{n} ta faktura kechikkan", { n: summary.overdueCount })} />
        <StatCard icon={CalendarClock} label="7 kun ichida to'lash kerak" tone="amber"
          value={fmtUSD(summary.dueSoonAmount)}
          hint={tt("{n} ta faktura", { n: summary.dueSoonCount })} />
        <StatCard icon={Scale} label="Sof pozitsiya" tone={net >= 0 ? "green" : "red"}
          value={fmtUSD(net)}
          hint={tt("Debitor {a} − kreditor {b}", {
            a: fmtUSD(receivable.openAmount), b: fmtUSD(summary.totalOpen),
          })} />
      </div>

      {/* To'lov jadvali */}
      <h2 className="text-2xl font-extrabold mb-4">{t("To'lov jadvali")}</h2>
      <DataTable
        id="payables-schedule"
        name={t("To'lov jadvali")}
        rows={schedule}
        rowKey={(i) => i.id}
        boshSort={{ key: "muddat", dir: "asc" }}
        minWidth="58rem"
        className="mb-8"
        empty={{ icon: Truck, title: "Ochiq faktura yo'q — barcha to'lovlar qilingan" }}
        columns={[
          {
            key: "no", label: "Faktura", locked: true, value: (i) => i.no,
            cell: (i) => (
              <>
                <p className="font-bold">{i.no}</p>
                {i.note && <p className="text-sm text-muted">{i.note}</p>}
              </>
            ),
          },
          { key: "supplier", label: "Yetkazib beruvchi",
            value: (i) => getSupplier(i.supplierId)?.name ?? "—",
            cell: (i) => <span className="font-semibold">{getSupplier(i.supplierId)?.name ?? "—"}</span> },
          { key: "sana", label: "Sana", value: (i) => i.invoiceDate,
            cell: (i) => <span className="font-semibold text-muted">{fmtDay(i.invoiceDate)}</span> },
          { key: "muddat", label: "Muddat", value: (i) => i.dueDate,
            cell: (i) => <span className="font-semibold">{fmtDay(i.dueDate)}</span> },
          {
            key: "holat", label: "Holati", value: (i) => -i.overdue,
            cell: (i) => (
              i.overdue > 0 ? (
                <span className="bg-danger-soft text-danger text-sm font-bold px-3 py-1 rounded-lg whitespace-nowrap">
                  {tt("{n} kun kechikkan", { n: i.overdue })}
                </span>
              ) : (
                <span className={`text-sm font-bold px-3 py-1 rounded-lg whitespace-nowrap ${
                  i.overdue > -8 ? "bg-warn-soft text-warn" : "bg-track text-muted"}`}>
                  {tt("{n} kun qoldi", { n: -i.overdue })}
                </span>
              )
            ),
          },
          {
            key: "qoldiq", label: "Qoldiq", right: true, value: (i) => i.remaining,
            cell: (i) => <span className="font-extrabold text-danger">{fmtUSD(i.remaining)}</span>,
            total: (rows) => <span className="text-danger">{fmtUSD(rows.reduce((a, i) => a + i.remaining, 0))}</span>,
          },
          {
            key: "harakat", label: "Harakat", harakat: true, right: true, width: "8rem",
            cell: (i) => (
              <Button olcham="kichik" korinish="asosiy"
                onClick={() => setPayFor({ supplier: getSupplier(i.supplierId), invoiceId: i.id })}>
                To'lash
              </Button>
            ),
          },
        ]}
      />

      {/* Yetkazib beruvchilar kesimi */}
      <h2 className="text-2xl font-extrabold mb-4">{t("Yetkazib beruvchilar kesimi")}</h2>
<DataTable
        id="payables-suppliers"
        name={t("Yetkazib beruvchilar kesimi")}
        rows={rows}
        rowKey={(r) => r.supplier.id}
        boshSort={{ key: "ochiq", dir: "desc" }}
        minWidth="60rem"
        empty={{ icon: Truck, title: "Yetkazib beruvchi yo'q" }}
        columns={[
          {
            key: "nom", label: "Yetkazib beruvchi", locked: true,
            value: (r) => r.supplier.name,
            cell: (r) => (
              <>
                <p className="font-bold">{r.supplier.name}</p>
                <p className="text-sm text-muted">{r.supplier.contact}</p>
              </>
            ),
          },
          { key: "soni", label: "Fakturalar", right: true, value: (r) => r.invoiceCount,
            cell: (r) => <span className="font-bold">{r.invoiceCount}</span>,
            total: (rows) => rows.reduce((a, r) => a + r.invoiceCount, 0) },
          { key: "olingan", label: "Jami olingan", right: true, value: (r) => r.totalInvoiced,
            cell: (r) => <span className="font-semibold text-muted">{fmtUSD(r.totalInvoiced)}</span>,
            total: (rows) => fmtUSD(rows.reduce((a, r) => a + r.totalInvoiced, 0)) },
          { key: "ochiq", label: "Ochiq qarz", right: true, value: (r) => r.openAmount,
            cell: (r) => (r.openAmount > 0
              ? <span className="font-extrabold text-danger">{fmtUSD(r.openAmount)}</span>
              : <span className="text-muted">—</span>),
            total: (rows) => <span className="text-danger">{fmtUSD(rows.reduce((a, r) => a + r.openAmount, 0))}</span> },
          { key: "kechikkan", label: "Muddati o'tgan", right: true, value: (r) => r.overdueAmount,
            cell: (r) => (r.overdueAmount > 0
              ? <span className="font-semibold text-danger">{fmtUSD(r.overdueAmount)}</span>
              : <span className="text-muted">—</span>),
            total: (rows) => <span className="text-danger">{fmtUSD(rows.reduce((a, r) => a + r.overdueAmount, 0))}</span> },
          { key: "uzoq", label: "Eng uzoq kechikish", right: true, value: (r) => r.maxOverdueDays,
            cell: (r) => (r.maxOverdueDays > 0
              ? <span className="font-bold text-danger">{tt("{n} kun", { n: r.maxOverdueDays })}</span>
              : <span className="text-muted">—</span>) },
          {
            key: "harakat", label: "Harakat", harakat: true, right: true, width: "8rem",
            cell: (r) => (r.openAmount > 0 && (
              <Button olcham="kichik" onClick={() => setPayFor({ supplier: r.supplier })}>To'lash</Button>
            )),
          },
        ]}
      />

      {payFor && (
        <SupplierPayModal supplier={payFor.supplier} preselectId={payFor.invoiceId}
          onClose={() => setPayFor(null)} onPaid={handlePaid} />
      )}
      {invModal && <InvoiceModal onClose={() => setInvModal(false)} onSave={saveInvoice} />}
    </div>
  );
}
