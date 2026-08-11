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

  const summary = useMemo(() => payablesSummary(), [tick]);
  const schedule = useMemo(() => openInvoices(), [tick]);
  const rows = useMemo(() => supplierRows(), [tick]);
  // Debitor tomoni — taqqoslash uchun (mijozlar bizga qarzdor)
  const receivable = useMemo(() => overallDebtStats(), [tick]);
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
      <div className="card overflow-auto max-h-[70vh] mb-8">
        <table className="w-full text-[0.9375rem]">
          <thead>
            <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-20 text-left text-muted text-sm border-b border-line [&>th]:bg-panel">
              <th className="px-6 py-4 font-bold">{t("Faktura")}</th>
              <th className="px-4 py-4 font-bold">{t("Yetkazib beruvchi")}</th>
              <th className="px-4 py-4 font-bold">{t("Sana")}</th>
              <th className="px-4 py-4 font-bold">{t("Muddat")}</th>
              <th className="px-4 py-4 font-bold">{t("Holati")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Qoldiq")}</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((i) => {
              const s = getSupplier(i.supplierId);
              return (
                <tr key={i.id} className="border-b border-line last:border-0 hover:bg-surface/70">
                  <td className="px-6 py-4">
                    <p className="font-bold">{i.no}</p>
                    {i.note && <p className="text-sm text-muted">{i.note}</p>}
                  </td>
                  <td className="px-4 py-4 font-semibold">{s?.name ?? "—"}</td>
                  <td className="px-4 py-4 font-semibold text-muted">{fmtDay(i.invoiceDate)}</td>
                  <td className="px-4 py-4 font-semibold">{fmtDay(i.dueDate)}</td>
                  <td className="px-4 py-4">
                    {i.overdue > 0 ? (
                      <span className="bg-danger-soft text-danger text-sm font-bold px-3 py-1 rounded-lg whitespace-nowrap">
                        {tt("{n} kun kechikkan", { n: i.overdue })}
                      </span>
                    ) : i.overdue > -8 ? (
                      <span className="bg-warn-soft text-warn text-sm font-bold px-3 py-1 rounded-lg whitespace-nowrap">
                        {tt("{n} kun qoldi", { n: -i.overdue })}
                      </span>
                    ) : (
                      <span className="bg-track text-muted text-sm font-bold px-3 py-1 rounded-lg whitespace-nowrap">
                        {tt("{n} kun qoldi", { n: -i.overdue })}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right font-extrabold text-danger">{fmtUSD(i.remaining)}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => setPayFor({ supplier: s, invoiceId: i.id })}
                      className="rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-4 py-2">
                      {t("To'lash")}
                    </button>
                  </td>
                </tr>
              );
            })}
            {schedule.length === 0 && (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-muted font-semibold">
                {t("Ochiq faktura yo'q — barcha to'lovlar qilingan")}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Yetkazib beruvchilar kesimi */}
      <h2 className="text-2xl font-extrabold mb-4">{t("Yetkazib beruvchilar kesimi")}</h2>
      <div className="card overflow-auto max-h-[70vh]">
        <table className="w-full text-[0.9375rem]">
          <thead>
            <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-20 text-left text-muted text-sm border-b border-line [&>th]:bg-panel">
              <th className="px-6 py-4 font-bold">{t("Yetkazib beruvchi")}</th>
              <th className="px-4 py-4 font-bold text-center">{t("Fakturalar")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Jami olingan")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Ochiq qarz")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Muddati o'tgan")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Eng uzoq kechikish")}</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.supplier.id} className="border-b border-line last:border-0 hover:bg-surface/70">
                <td className="px-6 py-4">
                  <p className="font-bold">{r.supplier.name}</p>
                  <p className="text-sm text-muted">{r.supplier.contact}</p>
                </td>
                <td className="px-4 py-4 text-center font-bold">{r.invoiceCount}</td>
                <td className="px-4 py-4 text-right font-semibold text-muted">{fmtUSD(r.totalInvoiced)}</td>
                <td className="px-4 py-4 text-right font-extrabold">
                  {r.openAmount > 0
                    ? <span className="text-danger">{fmtUSD(r.openAmount)}</span>
                    : <span className="text-muted">—</span>}
                </td>
                <td className="px-4 py-4 text-right font-semibold">
                  {r.overdueAmount > 0
                    ? <span className="text-danger">{fmtUSD(r.overdueAmount)}</span>
                    : <span className="text-muted">—</span>}
                </td>
                <td className="px-4 py-4 text-right font-bold">
                  {r.maxOverdueDays > 0
                    ? <span className="text-danger">{tt("{n} kun", { n: r.maxOverdueDays })}</span>
                    : <span className="text-muted">—</span>}
                </td>
                <td className="px-6 py-4 text-right">
                  {r.openAmount > 0 && (
                    <button onClick={() => setPayFor({ supplier: r.supplier })}
                      className="rounded-xl border border-line font-bold px-4 py-2 hover:border-brand hover:text-brand">
                      {t("To'lash")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {payFor && (
        <SupplierPayModal supplier={payFor.supplier} preselectId={payFor.invoiceId}
          onClose={() => setPayFor(null)} onPaid={handlePaid} />
      )}
      {invModal && <InvoiceModal onClose={() => setInvModal(false)} onSave={saveInvoice} />}
    </div>
  );
}
