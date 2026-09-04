"use client";
import { t, tt } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { CalendarDays, Wallet, Percent, Wrench, Target, Check } from "lucide-react";
import { demoStores, fmtUSD } from "@/lib/demoData";
import { PERIODS, periodRange, fmtDate } from "@/lib/dates";
import DateRangePicker from "@/components/DateRangePicker";
import { ROLES } from "@/lib/staffData";
import {
  payrollRows, payrollSummary, storePerformance, getStorePlans, setStorePlan,
  payStaff, paidFor, listPayrollPayments, payrollCost,
} from "@/lib/payrollData";
import { berilganOylik } from "@/lib/balanceData";
import { addOp, COMPANY } from "@/lib/kassaData";
import { useAuth } from "@/components/AuthProvider";
import StatCard from "@/components/finance/StatCard";
import DataTable from "@/components/ui/DataTable";
import Button from "@/components/ui/Button";

export default function FinancePayroll() {
  const { user } = useAuth();
  const [period, setPeriod] = useState("Oy");
  const [range, setRange] = useState(() => periodRange("Oy"));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const bump = () => setTick((v) => v + 1);

  const rows = useMemo(() => payrollRows(range.from, range.to), [range, tick]);
  const sum = useMemo(() => payrollSummary(range.from, range.to), [range, tick]);
  const perf = useMemo(() => storePerformance(range.from, range.to), [range, tick]);
  // Hisoblangan (P&L bilan bitta — `payrollCost`) va BERILGAN (xarajat
  // "Oylik" + usta olgan pul + kassa_ops salary) — DAFTAR 20 H
  const hisoblangan = useMemo(() => payrollCost(range.from, range.to), [range, tick]);
  const berilgan = useMemo(() => berilganOylik(range.from, range.to), [range, tick]);
  const plans = useMemo(() => getStorePlans(), [tick]);

  function pay(r) {
    const already = paidFor(r.staff.id, range.from, range.to);
    const left = +(r.total - already).toFixed(2);
    if (left <= 0) return;
    if (!confirm(tt("{name} ga {n} to'lansinmi?", { name: r.staff.name, n: fmtUSD(left) }))) return;

    payStaff({ staffId: r.staff.id, amount: left, periodFrom: range.from, periodTo: range.to });

    // Ustaning oyligi SERVIS kassasidan beriladi (rahbar qoidasi) —
    // o'rnatish xizmati o'zini o'zi boqadi. Qolgan xodimlar naqddan.
    // Ikkalasi ham kompaniya balansidan chiqadi: oylikni rahbar to'laydi.
    const isInstaller = r.staff.role === "installer";
    addOp({
      kassa: COMPANY,
      wallet: isInstaller ? "service" : "cash",
      kind: "out",
      category: "salary",
      amount: left,
      note: tt("{name} · ish haqi", { name: r.staff.name }),
      staffId: user?.id ?? null,
    });
    bump();
  }

  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight mb-2">{t("Ish haqi")}</h1>
      <p className="text-muted font-semibold mb-7">
        {t("Qat'iy maosh + shaxsiy sotuvdan foiz + xizmat ulushi + reja bonusi")}
      </p>

      {/* Davr */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="bg-track rounded-2xl p-1.5 flex">
          {PERIODS.map((p) => (
            <button key={p} onClick={() => { setPeriod(p); setRange(periodRange(p)); }}
              className={`tab-btn ${period === p ? "active" : ""}`}>{t(p)}</button>
          ))}
        </div>
        <div className="relative">
          <button onClick={() => setPickerOpen((v) => !v)}
            className="card flex items-center gap-4 px-5 py-3 font-bold">
            <CalendarDays size={20} className="text-brand" />
            <span className="text-right leading-tight">
              {fmtDate(range.from)}<br />{fmtDate(range.to)}
            </span>
          </button>
          {pickerOpen && (
            <DateRangePicker from={range.from} to={range.to}
              onApply={(f, to2) => { setPeriod(null); setRange({ from: f, to: to2 }); setPickerOpen(false); }}
              onClose={() => setPickerOpen(false)} />
          )}
        </div>
      </div>

      {/* KPI moduli hisoblagan haqiqiy oylik — asosiy manba shu.
          So'mda yuritiladi, foyda hisobotiga kurs bo'yicha tushadi. */}
      {sum.kpiSom > 0 && (
        <div className="card p-6 mb-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-muted mb-1">{t("KPI bo'yicha oylik")}</p>
              <p className="text-3xl font-extrabold">
                {Math.round(sum.kpiSom).toLocaleString("ru-RU")} <span className="text-lg text-muted">{t("so'm")}</span>
              </p>
              <p className="text-sm text-muted font-semibold mt-1">
                {tt("{n} ta xodim · KPI jadvalidan", { n: sum.kpiStaff?.length ?? 0 })}
              </p>
            </div>
            <div className="text-right">
              {sum.kpiUsd != null ? (
                <>
                  <p className="text-2xl font-extrabold text-brand">{fmtUSD(sum.kpiUsd)}</p>
                  <p className="text-sm text-muted font-semibold">
                    {tt("kurs {r} so'm · foyda hisobotiga shu tushadi", { r: Math.round(sum.kpiRate).toLocaleString("ru-RU") })}
                  </p>
                </>
              ) : (
                <p className="text-sm font-bold text-warn max-w-xs">
                  {t("Dollar kursi qo'yilmagan — Sozlamalarda kiriting, shundan keyin foyda hisobotiga qo'shiladi.")}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hisoblangan ↔ berilgan. Hisoblangani P&L "Ish haqi" bilan aynan
          bir raqam (`payrollCost`, har oy o'z kursi bilan); berilgani —
          pul qaysi yo'l bilan chiqqan bo'lsa ham (xarajat "Oylik", usta
          olgan pul, Pul rejasi). Farq — hali berilmagan yoki avans. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 mb-7">
        <StatCard icon={Wallet} label="Hisoblangan (P&L)" tone="red" value={fmtUSD(hisoblangan)}
          hint={t("KPI bo'yicha, har oy o'z kursi bilan")} />
        <StatCard icon={Check} label="Berilgan" tone="green" value={fmtUSD(berilgan.jami)}
          hint={tt("xarajat {x} · usta {u} · kassa {k}", { x: fmtUSD(berilgan.xarajat), u: fmtUSD(berilgan.usta), k: fmtUSD(berilgan.kassa) })} />
        <StatCard icon={Wallet} label="Qoldiq (hisoblangan − berilgan)"
          tone={hisoblangan - berilgan.jami > 0.005 ? "amber" : "green"}
          value={fmtUSD(+(hisoblangan - berilgan.jami).toFixed(2))}
          hint={t("Musbat — hali berilmagan; manfiy — avans yoki kiritilmagan hisob")} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5 mb-7">
        <StatCard icon={Wallet} label="Qat'iy maosh" value={fmtUSD(sum.fixed)} />
        <StatCard icon={Percent} label="Sotuvdan foiz" tone="green" value={fmtUSD(sum.salesBonus)} />
        <StatCard icon={Wrench} label="Xizmat ulushi" tone="green" value={fmtUSD(sum.serviceShare)} />
        <StatCard icon={Target} label="Reja bonusi" tone="amber" value={fmtUSD(sum.planBonus)} />
        <StatCard icon={Wallet} label="Jami ish haqi" tone="red" value={fmtUSD(sum.total)}
          hint={tt("{n} ta xodim", { n: sum.count })} />
      </div>

      {/* Do'kon rejalari */}
      <h2 className="text-2xl font-extrabold mb-4">{t("Do'kon rejalari")}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
        {demoStores.map((s) => {
          const p = perf[s.id];
          return (
            <div key={s.id} className="card p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full" style={{ background: s.color }} />
                  <p className="font-extrabold">{s.name}</p>
                </div>
                {p.plan > 0 && (
                  <span className={`text-sm font-bold px-3 py-1 rounded-lg ${
                    p.achieved ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}>
                    {p.pct}%
                  </span>
                )}
              </div>
              <p className="text-2xl font-extrabold mb-1">{fmtUSD(p.revenue)}</p>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm text-muted font-semibold">{t("Reja:")}</span>
                <input type="number" defaultValue={plans[s.id] ?? 0}
                  onBlur={(e) => { setStorePlan(s.id, e.target.value); bump(); }}
                  className="w-28 bg-surface rounded-lg px-2 py-1 font-bold text-sm outline-none" />
                <span className="text-sm text-muted font-semibold">{t("oyiga")}</span>
              </div>
              {p.plan > 0 && (
                <div className="h-2 rounded-full bg-track overflow-hidden">
                  <div className={`h-full rounded-full ${p.achieved ? "bg-ok" : "bg-brand"}`}
                    style={{ width: `${Math.min(100, p.pct ?? 0)}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Xodimlar */}
      <h2 className="text-2xl font-extrabold mb-4">{t("Xodimlar bo'yicha")}</h2>
      <DataTable
        id="payroll-staff"
        name={t("Ish haqi")}
        rows={rows}
        rowKey={(r) => r.staff.id}
        boshSort={{ key: "total", dir: "desc" }}
        minWidth="72rem"
        jamiIzoh={tt("{n} ta xodim", { n: rows.length })}
        empty={{ title: "Bu davrda hisoblanadigan ish haqi yo'q" }}
        columns={[
          { key: "xodim", label: "Xodim", locked: true, value: (r) => r.staff.name,
            cell: (r) => (
              <>
                <p className="font-bold">{r.staff.name}</p>
                <p className="text-sm text-muted">{t(ROLES[r.staff.role]?.label ?? r.staff.role)}</p>
              </>
            ) },
          { key: "fixed", label: "Qat'iy", right: true, value: (r) => r.fixed,
            cell: (r) => <span className="font-semibold">{fmtUSD(r.fixed)}</span>,
            total: (rs) => fmtUSD(rs.reduce((a, r) => a + r.fixed, 0)) },
          { key: "personalSales", label: "Shaxsiy sotuv", right: true, value: (r) => r.personalSales,
            cell: (r) => <span className="font-semibold text-muted">{r.personalSales > 0 ? fmtUSD(r.personalSales) : "—"}</span>,
            total: (rs) => <span className="text-muted">{fmtUSD(rs.reduce((a, r) => a + r.personalSales, 0))}</span> },
          { key: "salesBonus", label: "Foiz", right: true, value: (r) => r.salesBonus,
            cell: (r) => <span className="font-semibold text-ok">{r.salesBonus > 0 ? fmtUSD(r.salesBonus) : "—"}</span>,
            total: (rs) => <span className="text-ok">{fmtUSD(rs.reduce((a, r) => a + r.salesBonus, 0))}</span> },
          { key: "serviceShare", label: "Xizmat ulushi", right: true, value: (r) => r.serviceShare,
            cell: (r) => (r.serviceShare > 0
              ? <span className="font-semibold text-ok" title={tt("{n} buyurtma", { n: r.serviceOrders })}>{fmtUSD(r.serviceShare)}</span>
              : <span className="text-muted">—</span>),
            total: (rs) => <span className="text-ok">{fmtUSD(rs.reduce((a, r) => a + r.serviceShare, 0))}</span> },
          { key: "planBonus", label: "Bonus", right: true, value: (r) => r.planBonus,
            cell: (r) => <span className="font-semibold text-warn">{r.planBonus > 0 ? fmtUSD(r.planBonus) : "—"}</span>,
            total: (rs) => <span className="text-warn">{fmtUSD(rs.reduce((a, r) => a + r.planBonus, 0))}</span> },
          { key: "total", label: "Jami", right: true, value: (r) => r.total,
            cell: (r) => <span className="font-extrabold">{fmtUSD(r.total)}</span>,
            total: (rs) => <span className="text-lg">{fmtUSD(rs.reduce((a, r) => a + r.total, 0))}</span> },
          { key: "paid", label: "To'langan", right: true,
            value: (r) => paidFor(r.staff.id, range.from, range.to),
            cell: (r) => {
              const already = paidFor(r.staff.id, range.from, range.to);
              return already > 0
                ? <span className="font-semibold text-ok">{fmtUSD(already)}</span>
                : <span className="text-muted">—</span>;
            },
            total: (rs) => <span className="text-ok">
              {fmtUSD(rs.reduce((a, r) => a + paidFor(r.staff.id, range.from, range.to), 0))}
            </span> },
          {
            key: "harakat", label: "Harakat", harakat: true, right: true, width: "11rem",
            cell: (r) => {
              const already = paidFor(r.staff.id, range.from, range.to);
              const left = +(r.total - already).toFixed(2);
              if (left > 0.001) {
                return <Button olcham="kichik" korinish="asosiy" onClick={() => pay(r)}>
                  {tt("To'lash {n}", { n: fmtUSD(left) })}
                </Button>;
              }
              if (r.total > 0) {
                return <span className="inline-flex items-center gap-1.5 text-ok font-bold">
                  <Check size={16} /> {t("To'langan")}
                </span>;
              }
              // Ish haqi hisoblanmaydigan xodim (masalan egasi) —
              // "to'langan" deb ko'rsatish chalg'itadi
              return <span className="text-muted font-semibold">—</span>;
            },
          },
        ]}
      />
    </div>
  );
}
