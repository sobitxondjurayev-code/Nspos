"use client";
import { t, tt } from "@/lib/i18n";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays, TrendingUp, Wallet, Percent, Receipt, Target,
  TriangleAlert, Info, CircleAlert, ChevronRight, Landmark,
} from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { fmtUSD } from "@/lib/demoData";
import { PERIODS, periodRange, fmtDate } from "@/lib/dates";
import DateRangePicker from "@/components/DateRangePicker";
import { useTheme } from "@/components/ThemeProvider";
import StatCard from "@/components/finance/StatCard";
import { kpis, storeScoreboard, trend, breakEven, alerts } from "@/lib/managementData";
import { balanceSheet } from "@/lib/balanceData";
import { openPayouts, payoutSummary, daysLeft } from "@/lib/payoutsData";
import useUploadRows from "@/components/useUploadRows";

const fmtDay = (d) => {
  const [y, m, dd] = String(d).slice(0, 10).split("-");
  return `${dd}.${m}.${y}`;
};

const LEVELS = {
  danger: { icon: CircleAlert, cls: "bg-danger-soft text-danger" },
  warn: { icon: TriangleAlert, cls: "bg-warn-soft text-warn" },
  info: { icon: Info, cls: "bg-brand-soft text-brand" },
};

export default function Management() {
  const { chart } = useTheme();
  const [period, setPeriod] = useState("Yil");
  const [range, setRange] = useState(() => periodRange("Yil"));
  const [pickerOpen, setPickerOpen] = useState(false);

  // Raqamlar Billz yuklamalaridan yig'iladi (tushum, tannarx, kassa
  // harakati, mijoz qarzlari) — qatorlar kelmaguncha hisob bo'sh bo'ladi
  const rows = useUploadRows(["summary", "cashflow", "efficiency", "client_debts"]);

  const k = useMemo(() => kpis(range.from, range.to), [range, rows]);
  const board = useMemo(() => storeScoreboard(range.from, range.to), [range, rows]);
  const series = useMemo(() => trend(range.from, range.to), [range, rows]);
  const be = useMemo(() => breakEven(range.from, range.to), [range, rows]);
  const warn = useMemo(() => alerts(range.from, range.to), [range, rows]);
  const bal = useMemo(() => balanceSheet(new Date()), [rows]);
  const plan = useMemo(() => payoutSummary(), [rows]);
  const upcoming = useMemo(() => openPayouts().slice(0, 5), [rows]);

  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight mb-2">{t("Rahbariyat dashboardi")}</h1>
      <p className="text-muted font-semibold mb-7">
        {t("Barcha modullardan yig'ilgan asosiy raqamlar va e'tibor talab qiladigan nuqtalar")}
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

      {/* Ogohlantirishlar */}
      {warn.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-7">
          {warn.map((a, i) => {
            const L = LEVELS[a.level];
            return (
              <Link key={i} href={a.href}
                className="card p-5 flex items-start gap-4 hover:border-brand transition-colors">
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${L.cls}`}>
                  <L.icon size={20} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-ink">{t(a.title)}</p>
                  <p className="text-sm text-muted font-semibold">{t(a.detail)}</p>
                </div>
                <ChevronRight size={20} className="text-muted shrink-0 mt-2" />
              </Link>
            );
          })}
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-5 gap-5 mb-7">
        <StatCard icon={TrendingUp} label="Sof tushum" value={fmtUSD(k.revenue)}
          hint={tt("{n} ta chek", { n: k.checkCount })} />
        <StatCard icon={Percent} label="Yalpi foyda" tone="green" value={fmtUSD(k.grossProfit)}
          hint={tt("Marja {n}%", { n: k.grossMargin })} />
        <StatCard icon={Wallet} label="Operatsion xarajat" tone="red"
          value={fmtUSD(+(k.opex + k.wages).toFixed(2))}
          hint={tt("shundan ish haqi {n}", { n: fmtUSD(k.wages) })} />
        <StatCard icon={Landmark} label="Sof foyda"
          tone={k.netProfit >= 0 ? "green" : "red"} value={fmtUSD(k.netProfit)}
          hint={tt("Rentabellik {n}%", { n: k.netMargin })} />
        <StatCard icon={Receipt} label="O'rtacha chek" value={fmtUSD(k.avgCheck)}
          hint={tt("Qarzga {n}", { n: fmtUSD(k.onCredit) })} />
      </div>

      {/* Yaqin to'lovlar — rahbar o'zi belgilagan reja. To'liq ro'yxat
          va kirim-chiqim hisobi Pul rejasi bo'limida. */}
      {(plan.count > 0 || plan.overdueCount > 0) && (
        <div className="card p-7 mb-7">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-2xl font-extrabold">{t("Yaqin to'lovlar")}</h2>
            <Link href="/finance/plan" className="text-brand font-bold flex items-center gap-1">
              {t("Pul rejasi")} <ChevronRight size={18} />
            </Link>
          </div>
          <p className="text-sm text-muted font-semibold mb-5">
            {tt("Rejada {n} ta to'lov · jami {a}", { n: plan.count, a: fmtUSD(plan.planned) })}
            {plan.overdueCount > 0 && (
              <span className="text-danger">
                {" · "}{tt("{n} tasi kechikkan ({a})", { n: plan.overdueCount, a: fmtUSD(plan.overdue) })}
              </span>
            )}
          </p>
          <div className="space-y-2">
            {upcoming.map((p) => {
              const n = daysLeft(p.dueDate);
              return (
                <div key={p.id} className="flex items-center gap-4 rounded-xl bg-surface px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold truncate">{p.title}</p>
                    <p className="text-sm text-muted font-semibold">
                      {fmtDay(p.dueDate)}
                      {p.note && ` · ${p.note}`}
                    </p>
                  </div>
                  <span className={`text-sm font-bold px-3 py-1 rounded-lg whitespace-nowrap shrink-0 ${
                    n < 0 ? "bg-danger-soft text-danger"
                      : n <= 7 ? "bg-warn-soft text-warn" : "bg-track text-muted"}`}>
                    {n < 0 ? tt("{n} kun kechikkan", { n: -n })
                      : n === 0 ? t("Bugun") : tt("{n} kun qoldi", { n })}
                  </span>
                  <p className="text-lg font-extrabold shrink-0">{fmtUSD(p.amount)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trend */}
      <div className="card p-7 mb-7">
        <h2 className="text-2xl font-extrabold mb-1">{t("Tushum, foyda va xarajat")}</h2>
        <p className="text-sm text-muted font-semibold mb-5">
          {t("Ustunlar — yalpi foyda va xarajat, chiziq — tushum")}
        </p>
        <div className="h-[21.25rem]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="0" stroke={chart.grid} vertical={false} />
              <XAxis dataKey="date" axisLine={false} tickLine={false}
                tick={{ fill: chart.tick, fontSize: 13, fontWeight: 600 }} />
              <YAxis axisLine={false} tickLine={false} width={70}
                tickFormatter={(v) => fmtUSD(v)}
                tick={{ fill: chart.tick, fontSize: 13, fontWeight: 600 }} />
              <Tooltip formatter={(v) => fmtUSD(v)}
                contentStyle={{ borderRadius: 14, border: "none", fontWeight: 700 }} />
              <Legend wrapperStyle={{ fontWeight: 700, fontSize: 13 }} />
              {/* name — izohda ham, pastdagi ro'yxatda ham shu nom chiqadi.
                  Berilmasa Recharts dataKey'ni ko'rsatardi ("grossProfit"). */}
              <Bar name={t("Yalpi foyda")} dataKey="grossProfit" fill="#22c55e" radius={[8, 8, 0, 0]} maxBarSize={38} />
              <Bar name={t("Xarajat")} dataKey="expense" fill="#ef4444" radius={[8, 8, 0, 0]} maxBarSize={38} />
              <Line name={t("Tushum")} type="monotone" dataKey="revenue" stroke={chart.brand} strokeWidth={3.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-7">
        {/* Do'kon reytingi */}
        <div className="card p-7 col-span-2">
          <h2 className="text-2xl font-extrabold mb-1">{t("Do'konlar kesimida")}</h2>
          <p className="text-sm text-muted font-semibold mb-5">
            {t("Umumkorxona xarajatlari tushum nisbatida taqsimlangan")}
          </p>
          <table className="w-full text-[0.9375rem]">
            <thead>
              <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-20 text-left text-muted text-sm border-b border-line [&>th]:bg-panel">
                <th className="py-3 font-bold">{t("Do'kon")}</th>
                <th className="py-3 font-bold text-right">{t("Tushum")}</th>
                <th className="py-3 font-bold text-right">{t("Yalpi foyda")}</th>
                <th className="py-3 font-bold text-right">{t("Xarajat")}</th>
                <th className="py-3 font-bold text-right">{t("Sof foyda")}</th>
                <th className="py-3 font-bold text-right">{t("Reja")}</th>
              </tr>
            </thead>
            <tbody>
              {board.map((s) => (
                <tr key={s.storeId} className="border-b border-line last:border-0">
                  <td className="py-4 font-bold">{s.name}</td>
                  <td className="py-4 text-right font-semibold">{fmtUSD(s.revenue)}</td>
                  <td className="py-4 text-right font-semibold text-ok">
                    {fmtUSD(s.grossProfit)}
                    <span className="block text-sm text-muted">{s.grossMargin}%</span>
                  </td>
                  <td className="py-4 text-right font-semibold text-danger">
                    {s.expense > 0 ? fmtUSD(s.expense) : "—"}
                  </td>
                  <td className={`py-4 text-right font-extrabold ${
                    s.netProfit >= 0 ? "text-ok" : "text-danger"}`}>
                    {fmtUSD(s.netProfit)}
                  </td>
                  <td className="py-4 text-right font-bold">
                    {s.planPct === null ? <span className="text-muted">—</span> : (
                      <span className={s.planPct >= 100 ? "text-ok" : "text-warn"}>{s.planPct}%</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Zararsizlik nuqtasi */}
        <div className="card p-7">
          <div className="flex items-center gap-3 mb-5">
            <span className="w-10 h-10 rounded-xl bg-brand-soft text-brand flex items-center justify-center">
              <Target size={20} />
            </span>
            <h2 className="text-xl font-extrabold">{t("Zararsizlik nuqtasi")}</h2>
          </div>
          <p className="text-sm text-muted font-semibold mb-5">
            {t("Doimiy xarajatni qoplash uchun oyiga qancha sotish kerak")}
          </p>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-bold">{t("Oylik doimiy yuk")}</span>
              <span className="font-extrabold">{fmtUSD(be.monthlyFixed)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold">{t("Yalpi marja")}</span>
              <span className="font-extrabold">{be.marginPct}%</span>
            </div>
            <div className="flex items-center justify-between border-t border-line pt-4">
              <span className="font-extrabold">{t("Kerakli oylik savdo")}</span>
              <span className="text-2xl font-extrabold text-brand">
                {be.required === null ? "—" : fmtUSD(be.required)}
              </span>
            </div>
          </div>
          {be.monthlyFixed === 0 && (
            <p className="text-sm text-warn font-semibold mt-5">
              {t("Doimiy xarajat kiritilmagani uchun hozircha hisoblab bo'lmaydi.")}
            </p>
          )}
        </div>
      </div>

      {/* Moliyaviy holat */}
      <div className="card p-7">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-extrabold">{t("Bugungi moliyaviy holat")}</h2>
          <Link href="/finance/balance" className="text-brand font-bold flex items-center gap-1">
            {t("Balansga o'tish")} <ChevronRight size={18} />
          </Link>
        </div>
        <div className="grid grid-cols-4 gap-6">
          {[
            { lbl: "Jami aktiv", val: bal.totalAssets, cls: "" },
            { lbl: "Ombordagi tovar", val: bal.inventory.cost, cls: "" },
            { lbl: "Mijozlardan olinadigan", val: bal.receivables.total, cls: "text-ok" },
            { lbl: "Yetkazib beruvchilarga qarz", val: bal.payables.totalOpen, cls: "text-danger" },
          ].map((x) => (
            <div key={x.lbl}>
              <p className="text-sm font-bold text-muted mb-1">{t(x.lbl)}</p>
              <p className={`text-2xl font-extrabold ${x.cls}`}>{fmtUSD(x.val)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
