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
  payStaff, paidFor, listPayrollPayments,
} from "@/lib/payrollData";
import { addOp, COMPANY } from "@/lib/kassaData";
import { useAuth } from "@/components/AuthProvider";
import StatCard from "@/components/finance/StatCard";

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

      <div className="grid grid-cols-5 gap-5 mb-7">
        <StatCard icon={Wallet} label="Qat'iy maosh" value={fmtUSD(sum.fixed)} />
        <StatCard icon={Percent} label="Sotuvdan foiz" tone="green" value={fmtUSD(sum.salesBonus)} />
        <StatCard icon={Wrench} label="Xizmat ulushi" tone="green" value={fmtUSD(sum.serviceShare)} />
        <StatCard icon={Target} label="Reja bonusi" tone="amber" value={fmtUSD(sum.planBonus)} />
        <StatCard icon={Wallet} label="Jami ish haqi" tone="red" value={fmtUSD(sum.total)}
          hint={tt("{n} ta xodim", { n: sum.count })} />
      </div>

      {/* Do'kon rejalari */}
      <h2 className="text-2xl font-extrabold mb-4">{t("Do'kon rejalari")}</h2>
      <div className="grid grid-cols-3 gap-5 mb-8">
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
      <div className="card overflow-auto max-h-[70vh]">
        <table className="w-full text-[0.9375rem]">
          <thead>
            <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-20 text-left text-muted text-sm border-b border-line [&>th]:bg-panel">
              <th className="px-6 py-4 font-bold">{t("Xodim")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Qat'iy")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Shaxsiy sotuv")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Foiz")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Xizmat ulushi")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Bonus")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Jami")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("To'langan")}</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const already = paidFor(r.staff.id, range.from, range.to);
              const left = +(r.total - already).toFixed(2);
              return (
                <tr key={r.staff.id} className="border-b border-line last:border-0 hover:bg-surface/70">
                  <td className="px-6 py-4">
                    <p className="font-bold">{r.staff.name}</p>
                    <p className="text-sm text-muted">{t(ROLES[r.staff.role]?.label ?? r.staff.role)}</p>
                  </td>
                  <td className="px-4 py-4 text-right font-semibold">{fmtUSD(r.fixed)}</td>
                  <td className="px-4 py-4 text-right font-semibold text-muted">
                    {r.personalSales > 0 ? fmtUSD(r.personalSales) : "—"}
                  </td>
                  <td className="px-4 py-4 text-right font-semibold text-ok">
                    {r.salesBonus > 0 ? fmtUSD(r.salesBonus) : "—"}
                  </td>
                  <td className="px-4 py-4 text-right font-semibold text-ok">
                    {r.serviceShare > 0
                      ? <span title={tt("{n} buyurtma", { n: r.serviceOrders })}>{fmtUSD(r.serviceShare)}</span>
                      : "—"}
                  </td>
                  <td className="px-4 py-4 text-right font-semibold text-warn">
                    {r.planBonus > 0 ? fmtUSD(r.planBonus) : "—"}
                  </td>
                  <td className="px-4 py-4 text-right font-extrabold">{fmtUSD(r.total)}</td>
                  <td className="px-4 py-4 text-right font-semibold">
                    {already > 0 ? <span className="text-ok">{fmtUSD(already)}</span> : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {left > 0.001 ? (
                      <button onClick={() => pay(r)}
                        className="rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-4 py-2 whitespace-nowrap">
                        {tt("To'lash {n}", { n: fmtUSD(left) })}
                      </button>
                    ) : r.total > 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-ok font-bold">
                        <Check size={16} /> {t("To'langan")}
                      </span>
                    ) : (
                      // Ish haqi hisoblanmaydigan xodim (masalan egasi) —
                      // "to'langan" deb ko'rsatish chalg'itadi
                      <span className="text-muted font-semibold">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-6 py-12 text-center text-muted font-semibold">
                {t("Bu davrda hisoblanadigan ish haqi yo'q")}
              </td></tr>
            )}
          </tbody>
        </table>
        {rows.length > 0 && (
          <div className="border-t border-line px-6 py-4 flex justify-between font-bold bg-surface/50">
            <span className="text-muted">{t("Jami")}</span>
            <span className="text-lg font-extrabold">{fmtUSD(sum.total)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
