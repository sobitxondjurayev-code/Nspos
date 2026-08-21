"use client";
import { t, tt } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, X, Receipt, Wallet, PiggyBank, Users } from "lucide-react";
import { demoStores, fmtUSD } from "@/lib/demoData";
import {
  listCustomers, getCustomer, addCustomer, updateCustomer, removeCustomer, totalPurchasesOf,
} from "@/lib/customersData";
import { tierOf, nextTier, listGroups, listTags } from "@/lib/loyaltyData";
import { customerDebtStats, debtsOf, remainingOf } from "@/lib/debtsData";
import { listSales } from "@/lib/salesData";
import { addOperation } from "@/lib/financeData";
import CustomerModal from "@/components/CustomerModal";
import FilterBar, { applyFilters } from "@/components/FilterBar";
import DebtPaymentModal from "@/components/DebtPaymentModal";
import BalanceModal from "@/components/BalanceModal";
import DataTable from "@/components/ui/DataTable";
import Button from "@/components/ui/Button";

const fmtWhen = (iso) => {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
};

/* Mijoz kartasi: xaridlar va qarzlar tarixi */
function CustomerDrawer({ customer: initialCustomer, onClose, onChanged }) {
  const [payOpen, setPayOpen] = useState(false);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [tick, setTick] = useState(0); // to'lov/balansdan keyin qayta hisoblash

  // Mijozni har safar do'kondan qayta o'qiymiz. Prop'dagi nusxa ochilgan
  // paytdagi holat — balans to'ldirilgach u eskirib qoladi.
  const customer = useMemo(
    () => getCustomer(initialCustomer.id) ?? initialCustomer,
    [initialCustomer, tick]
  );

  const stats = useMemo(() => customerDebtStats(customer.id), [customer.id, tick]);
  const debts = useMemo(
    () => debtsOf(customer.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [customer.id, tick]
  );
  const sales = listSales().filter((s) => s.customerId === customer.id);
  const freshSpent = +sales.filter((s) => !s.id.startsWith("sale-seed"))
    .reduce((a, s) => a + s.total, 0).toFixed(2);
  const spent = +((customer.billzPurchases ?? 0) + freshSpent).toFixed(2);
  const tier = tierOf(totalPurchasesOf(customer));
  const next = nextTier(totalPurchasesOf(customer));
  const groups = listGroups().filter((g) => (customer.groups ?? []).includes(g.id));
  const tags = listTags().filter((x) => (customer.tags ?? []).includes(x.id));

  function handlePaid({ amount, method }) {
    // To'lov kassa jurnaliga kirim sifatida tushadi
    addOperation({
      category: "debt", amount, method,
      note: tt("{name} qarz to'lovi", { name: customer.name }), customerId: customer.id,
    });
    setTick((t) => t + 1);
    onChanged?.();
  }

  return (
    <div className="fixed inset-0 z-50 bg-overlay/50 flex justify-end" onClick={onClose}>
      <div className="bg-panel w-full max-w-2xl h-full overflow-y-auto p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-7">
          <div>
            <h2 className="text-3xl font-extrabold">{customer.name}</h2>
            <p className="text-muted font-semibold mt-1">{customer.phone}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={24} /></button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-surface rounded-2xl p-5">
            <p className="text-sm font-bold text-muted mb-1">{t("Jami xarid")}</p>
            <p className="text-xl font-extrabold">{fmtUSD(spent)}</p>
            <p className="text-sm text-muted font-semibold">{tt("{n} ta chek", { n: sales.length })}</p>
          </div>
          <div className="bg-surface rounded-2xl p-5">
            <p className="text-sm font-bold text-muted mb-1">{t("Cashback")}</p>
            <p className="text-xl font-extrabold text-ok">{fmtUSD(customer.cashback)}</p>
            <p className="text-sm text-muted font-semibold">{tt("{n}% dan", { n: tier.cashbackPct })}</p>
          </div>
          <div className="bg-surface rounded-2xl p-5">
            <p className="text-sm font-bold text-muted mb-1">{t("Ochiq qarz")}</p>
            <p className={`text-xl font-extrabold ${stats.openAmount > 0 ? "text-danger" : ""}`}>
              {fmtUSD(stats.openAmount)}
            </p>
            <p className="text-sm text-muted font-semibold">
              {stats.oldestOpenDays > 0 ? tt("eng eski {n} kun", { n: stats.oldestOpenDays }) : t("qarzsiz")}
            </p>
          </div>
        </div>

        {/* Sodiqlik darajasi va balans */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-surface rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-muted">{t("Sodiqlik darajasi")}</p>
              <span className="text-sm font-extrabold px-3 py-1 rounded-lg"
                style={{ background: tier.color + "22", color: tier.color }}>
                {t(tier.name)}
              </span>
            </div>
            <p className="text-xl font-extrabold">{tt("{n}% cashback", { n: tier.cashbackPct })}</p>
            {next && (
              <p className="text-sm text-muted font-semibold mt-1">
                {tt("{name} gacha {n} qoldi", { name: t(next.tier.name), n: fmtUSD(next.remaining) })}
              </p>
            )}
          </div>
          <div className="bg-surface rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-muted">{t("Balans")}</p>
              <button onClick={() => setBalanceOpen(true)}
                className="text-sm font-bold text-brand hover:underline">{t("To'ldirish")}</button>
            </div>
            <p className="text-xl font-extrabold">{fmtUSD(customer.balance ?? 0)}</p>
            <p className="text-sm text-muted font-semibold mt-1">{t("Oldindan to'lov")}</p>
          </div>
        </div>

        {(groups.length > 0 || tags.length > 0) && (
          <div className="flex flex-wrap gap-2 mb-6">
            {groups.map((g) => (
              <span key={g.id} className="text-sm font-bold px-3 py-1.5 rounded-lg"
                style={{ background: g.color + "22", color: g.color }}>{t(g.name)}</span>
            ))}
            {tags.map((x) => (
              <span key={x.id} className="text-sm font-semibold px-3 py-1.5 rounded-lg border border-line text-muted">
                {t(x.name)}
              </span>
            ))}
          </div>
        )}

        <div className="bg-brand-soft rounded-2xl p-5 mb-8">
          <p className="font-bold text-brand mb-2">{t("Qarz qaytarish odati")}</p>
          <div className="flex gap-8">
            <div>
              <p className="text-sm font-semibold text-muted">{t("Pulga tortilgan")}</p>
              <p className="text-2xl font-extrabold">{stats.weightedAvgDays == null ? "—" : tt("{n} kun", { n: stats.weightedAvgDays })}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-muted">{t("Oddiy o'rtacha")}</p>
              <p className="text-2xl font-extrabold">{stats.simpleAvgDays == null ? "—" : tt("{n} kun", { n: stats.simpleAvgDays })}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-muted">{t("Yopilgan qarz")}</p>
              <p className="text-2xl font-extrabold">{tt("{n} ta", { n: stats.closedCount })}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-extrabold flex items-center gap-2">
            <Wallet size={20} className="text-brand" /> {t("Qarzlar")}
          </h3>
          {stats.openAmount > 0 && (
            <button onClick={() => setPayOpen(true)}
              className="rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-5 py-2.5">
              {t("Qarzni to'lash")}
            </button>
          )}
        </div>
        <div className="space-y-3 mb-8">
          {debts.map((d) => (
            <div key={d.id} className="bg-surface rounded-2xl p-5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-bold">{d.no}</p>
                  <p className="text-sm text-muted font-semibold">{tt("{d} da berilgan", { d: fmtWhen(d.createdAt) })}</p>
                </div>
                <div className="text-right">
                  <p className="font-extrabold">{fmtUSD(d.amount)}</p>
                  {d.closedAt ? (
                    <span className="text-sm font-bold text-ok">
                      {tt("{n} kunda yopilgan", { n: Math.round((new Date(d.closedAt) - new Date(d.createdAt)) / 86400000) })}
                    </span>
                  ) : (
                    <span className="text-sm font-bold text-danger">{tt("{n} qoldi", { n: fmtUSD(remainingOf(d)) })}</span>
                  )}
                </div>
              </div>
              {d.payments.length > 0 && (
                <div className="border-t border-line pt-2 mt-2 space-y-1">
                  {d.payments.map((p, i) => (
                    <div key={i} className="flex justify-between text-sm font-semibold">
                      <span className="text-muted">{fmtWhen(p.at)}</span>
                      <span>{fmtUSD(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {debts.length === 0 && <p className="text-muted font-semibold">{t("Qarz olmagan")}</p>}
        </div>

        <h3 className="text-xl font-extrabold mb-4 flex items-center gap-2">
          <Receipt size={20} className="text-brand" /> {t("Xaridlar tarixi")}
        </h3>
        <div className="space-y-2">
          {sales.slice(0, 30).map((s) => (
            <div key={s.id} className="flex items-center justify-between bg-surface rounded-xl px-5 py-3">
              <div>
                <p className="font-bold">{s.no}</p>
                <p className="text-sm text-muted font-semibold">{fmtWhen(s.at)} · {tt("{n} tovar", { n: s.items.length })}</p>
              </div>
              <p className="font-extrabold">{fmtUSD(s.total)}</p>
            </div>
          ))}
          {sales.length === 0 && <p className="text-muted font-semibold">{t("Xarid qilmagan")}</p>}
        </div>

        {payOpen && (
          <DebtPaymentModal customer={customer}
            onClose={() => setPayOpen(false)} onPaid={handlePaid} />
        )}
        {balanceOpen && (
          <BalanceModal customer={customer} onClose={() => setBalanceOpen(false)}
            onDone={({ amount, method, note }) => {
              // Balans to'ldirish kassaga kirim bo'lib tushadi
              addOperation({
                category: "other_in", amount, method,
                note: tt("{name} balansini to'ldirish", { name: customer.name }) + (note ? ` · ${note}` : ""),
                customerId: customer.id,
              });
              setTick((v) => v + 1);
              onChanged?.();
            }} />
        )}
      </div>
    </div>
  );
}

export default function Clients() {
  const [items, setItems] = useState(listCustomers);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");
  const [filters, setFilters] = useState({});
  const [modal, setModal] = useState(null);
  const [drawer, setDrawer] = useState(null);

  const refresh = () => setItems(listCustomers());

  // Filtr tayyor qatorlarga qo'llanadi (xarid summasi va qarz shu yerda
  // hisoblanadi, mijoz yozuvining o'zida yo'q)
  const FIELDS = useMemo(() => [
    { key: "store", type: "select", label: "Ro'yxatdan o'tgan do'kon",
      options: demoStores.map((x) => ({ value: x.id, label: x.name })),
      get: (r) => r.customer.storeId },
    { key: "spent", type: "range", label: "Xarid summasi", get: (r) => r.spent },
    { key: "orders", type: "range", label: "Xaridlar soni", get: (r) => r.orders },
    { key: "debt", type: "range", label: "Ochiq qarzi", get: (r) => r.debt.openAmount },
    { key: "avgDays", type: "range", label: "O'rtacha to'lov kuni",
      get: (r) => r.debt.weightedAvgDays ?? 0 },
    { key: "phone", type: "text", label: "Telefon", placeholder: "Raqam bo'yicha",
      get: (r) => r.customer.phone },
  ], []);

  const rows = useMemo(() => {
    const sales = listSales();
    const s = q.trim().toLowerCase();
    const digits = s.replace(/\D/g, "");
    return items
      .filter((c) => !s || c.name.toLowerCase().includes(s) || (digits && c.phone.replace(/\D/g, "").includes(digits)))
      .map((c) => {
        const mine = sales.filter((x) => x.customerId === c.id);
        // Billz'dagi "Сумма покупок" asosiy raqam. NSPOS ichidagi seed
        // cheklar tarixiy fantaziya, shuning uchun ular bu ustunga
        // qo'shilmaydi — aks holda Billz bilan solishtirib bo'lmaydi.
        // Faqat NSPOS'da qilingan haqiqiy yangi sotuvlar qo'shiladi.
        const fresh = +mine.filter((x) => !x.id.startsWith("sale-seed"))
          .reduce((a, x) => a + x.total, 0).toFixed(2);
        return {
          customer: c,
          orders: mine.length,
          spent: +((c.billzPurchases ?? 0) + fresh).toFixed(2),
          debt: customerDebtStats(c.id),
        };
      });
  }, [items, q]);

  // Toifalar: qarzdor, faol, qarzi yo'q
  const tabs = useMemo(() => [
    { key: "all", label: "Barchasi", count: rows.length },
    { key: "debtor", label: "Qarzdor", count: rows.filter((r) => r.debt.openAmount > 0).length },
    { key: "active", label: "Xaridi bor", count: rows.filter((r) => r.spent > 0).length },
    { key: "overdue", label: "30 kundan oshgan",
      count: rows.filter((r) => r.debt.oldestOpenDays > 30).length },
  ], [rows]);

  const shown = useMemo(() => {
    let list = rows;
    if (tab === "debtor") list = list.filter((r) => r.debt.openAmount > 0);
    else if (tab === "active") list = list.filter((r) => r.spent > 0);
    else if (tab === "overdue") list = list.filter((r) => r.debt.oldestOpenDays > 30);
    return applyFilters(list, FIELDS, filters);
  }, [rows, tab, filters, FIELDS]);

  function save(data) {
    if (modal.mode === "edit") updateCustomer(modal.customer.id, data);
    else addCustomer(data);
    setModal(null); refresh();
  }
  function del(c) {
    if (confirm(`"${c.name}" o'chirilsinmi?`)) { removeCustomer(c.id); refresh(); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-7">
        <h1 className="text-4xl font-extrabold tracking-tight">{t("Mijozlar")}</h1>
        <button onClick={() => setModal({ mode: "new" })}
          className="flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-5 py-3">
          <Plus size={20} /> {t("Yangi mijoz")}
        </button>
      </div>

      <FilterBar
        tabs={tabs} activeTab={tab} onTab={setTab}
        search={{ value: q, onChange: setQ, placeholder: "Ism yoki telefon bo'yicha qidirish..." }}
        fields={FIELDS} filters={filters} onChange={setFilters}
      />

      {/* 9 087 mijoz bir vaqtda chizilmaydi — `limit` bilan
          chegaralanadi va nechtasi yashiringani AYTILADI. Ilgari
          chegara umuman yo'q edi: telefonda bu sahifa ochilmasdi. */}
      <DataTable
        id="clients-list"
        name={t("Mijozlar")}
        rows={shown}
        rowKey={(r) => r.customer.id}
        onRowClick={(r) => setDrawer(r.customer)}
        boshSort={{ key: "spent", dir: "desc" }}
        limit={200}
        count={items.length}
        jamiIzoh={tt("{a} / {b} mijoz", { a: shown.length.toLocaleString("ru-RU"), b: items.length.toLocaleString("ru-RU") })}
        minWidth="76rem"
        empty={{ icon: Users, title: "Hech narsa topilmadi",
                 hint: "Qidiruv yoki filtrni tozalab ko'ring" }}
        columns={[
          { key: "nom", label: "Mijoz", locked: true, value: (r) => r.customer.name,
            cell: (r) => (
              <>
                <p className="font-bold">{r.customer.name}</p>
                <p className="text-sm text-muted">{r.customer.phone}</p>
              </>
            ) },
          { key: "orders", label: "Xaridlar", right: true, value: (r) => r.orders,
            cell: (r) => <span className="font-bold">{r.orders}</span>,
            total: (rs) => rs.reduce((a, r) => a + r.orders, 0).toLocaleString("ru-RU") },
          { key: "spent", label: "Jami xarid", right: true, value: (r) => r.spent,
            cell: (r) => <span className="font-extrabold">{fmtUSD(r.spent)}</span>,
            total: (rs) => fmtUSD(rs.reduce((a, r) => a + r.spent, 0)) },
          { key: "daraja", label: "Daraja",
            value: (r) => totalPurchasesOf(r.customer),
            cell: (r) => {
              const tr = tierOf(totalPurchasesOf(r.customer));
              return <span className="text-sm font-bold px-3 py-1 rounded-lg whitespace-nowrap"
                style={{ background: tr.color + "22", color: tr.color }}>{t(tr.name)}</span>;
            } },
          { key: "balans", label: "Balans", right: true, value: (r) => r.customer.balance ?? 0,
            cell: (r) => ((r.customer.balance ?? 0) > 0
              ? <span className="font-bold">{fmtUSD(r.customer.balance)}</span>
              : <span className="text-muted">—</span>),
            total: (rs) => fmtUSD(rs.reduce((a, r) => a + (r.customer.balance ?? 0), 0)) },
          { key: "cashback", label: "Cashback", right: true, value: (r) => r.customer.cashback ?? 0,
            cell: (r) => <span className="font-semibold text-ok">{fmtUSD(r.customer.cashback)}</span>,
            total: (rs) => <span className="text-ok">{fmtUSD(rs.reduce((a, r) => a + (r.customer.cashback ?? 0), 0))}</span> },
          { key: "qarz", label: "Qarzdorlik", right: true, value: (r) => r.debt.openAmount,
            cell: (r) => (r.debt.openAmount > 0
              ? <span className="font-extrabold text-danger">{fmtUSD(r.debt.openAmount)}</span>
              : <span className="text-muted">—</span>),
            total: (rs) => <span className="text-danger">{fmtUSD(rs.reduce((a, r) => a + r.debt.openAmount, 0))}</span> },
          { key: "qaytarish", label: "O'rtacha qaytarish", right: true,
            value: (r) => r.debt.weightedAvgDays ?? null,
            cell: (r) => <span className="font-bold text-muted">
              {r.debt.weightedAvgDays != null ? tt("{n} kun", { n: r.debt.weightedAvgDays }) : "—"}</span> },
          {
            key: "harakat", label: "Harakat", harakat: true, right: true, width: "7rem",
            cell: (r) => (
              <span onClick={(e) => e.stopPropagation()} className="flex justify-end gap-1">
                <Button olcham="kichik" korinish="yassi" icon={Pencil}
                  onClick={() => setModal({ mode: "edit", customer: r.customer })}
                  className="text-muted hover:text-brand" />
                <Button olcham="kichik" korinish="yassi" icon={Trash2}
                  onClick={() => del(r.customer)}
                  className="text-muted hover:text-danger" />
              </span>
            ),
          },
        ]}
      />

      {modal && (
        <CustomerModal
          initial={modal.mode === "edit" ? modal.customer : null}
          onClose={() => setModal(null)} onSave={save} />
      )}
      {drawer && (
        <CustomerDrawer customer={drawer} onClose={() => setDrawer(null)} onChanged={refresh} />
      )}
    </div>
  );
}
