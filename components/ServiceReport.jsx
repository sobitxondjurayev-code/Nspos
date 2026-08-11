"use client";
import { t, tt } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { fmtUSD } from "@/lib/demoData";
import SortTh, { useSort } from "@/components/SortTh";
import ExportButton from "@/components/ExportButton";
import TotalsRow from "@/components/TotalsRow";
import ColumnSettings from "@/components/ColumnSettings";
import { useColumns } from "@/components/useColumns";
import { numberOf, textOf } from "@/lib/datasets";
import { expensesInRange, SERVICE_CATEGORIES, categoryLabel } from "@/lib/expensesData";
import { isServiceName, getServiceNames, getUsdRate } from "@/lib/companyData";
import { listStaff } from "@/lib/staffData";
import { computeMonth, monthKey } from "@/lib/kpiData";
import { AlertTriangle, SlidersHorizontal } from "lucide-react";

// ══════════════════════════════════════════════════════════════
// SERVIS (O'RNATISH) FOYDASI
// ══════════════════════════════════════════════════════════════
// Savol: o'rnatish xizmati o'zini oqlayaptimi?
//
// KIRIM — Billz'da xizmat alohida bo'lim emas, u oddiy tovar kabi
// sotiladi ("montaj"). Qaysi nomlar xizmat ekani Sozlamalarda
// belgilanadi, shuning uchun kirim shu nomlar bo'yicha ajratiladi.
//
// XARAJAT — ustalarning oyligi. U KPI modulida hisoblanadi (kamera ×
// narx + davomat) va SO'MDA yuritiladi, shuning uchun kurs bo'yicha
// dollarga o'giriladi.
//
// MATERIAL — mashina gazi, avtol, shurup, samarez va shunga o'xshash
// mayda narsalar. Ular Xarajatlar modulida "servis" deb belgilangan
// kategoriyalarga kiritiladi va shu yerda avtomat yig'iladi.
//
// FOYDA = kirim − ustalar oyligi − material. Umumiy xarajatlar (ijara,
// internet) bu yerga kirmaydi — ular butun korxonaga tegishli.

const col = (header, ...names) =>
  header.find((h) => names.some((n) => h.toLowerCase().includes(n.toLowerCase()))) ?? null;

function periodMonths(header) {
  // Ustun nomidagi davr: "Продажи товаров 2026-06-20 - 2026-08-04 · ..."
  for (const h of header) {
    const m = h.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
    if (!m) continue;
    const out = [];
    const d = new Date(m[1]); d.setDate(1);
    const end = new Date(m[2]);
    while (d <= end) {
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      d.setMonth(d.getMonth() + 1);
    }
    return { months: out, from: m[1], to: m[2] };
  }
  return { months: [monthKey(new Date())], from: null, to: null };
}

export default function ServiceReport({ dataset }) {
  const { sort, toggle, sortRows } = useSort("revenue", "desc");

  // —— Ustunlar (Xizmat ustuni doim chapda qoladi) ————————
  const ALL_COLS = useMemo(() => [
    { key: "store", label: "Do'kon", sortKey: "store",
      cellClass: () => "font-semibold text-muted", cell: (x) => x.store },
    { key: "qty", label: "Soni", sortKey: "qty", align: "right",
      cellClass: () => "font-semibold",
      cell: (x) => Math.round(x.qty).toLocaleString("ru-RU"),
      total: (v) => ({ value: Math.round(v.qty).toLocaleString("ru-RU") }) },
    { key: "revenue", label: "Kirim", sortKey: "revenue", align: "right",
      cellClass: () => "font-extrabold", cell: (x) => fmtUSD(Math.round(x.revenue)),
      total: (v) => ({ value: fmtUSD(Math.round(v.revenue)) }) },
    { key: "avg", label: "O'rtacha narx", sortKey: "avg", align: "right",
      cellClass: () => "font-semibold text-muted", cell: (x) => fmtUSD(+x.avg.toFixed(2)),
      // O'rtacha narx: jami kirim ÷ jami soni
      total: (v) => ({ value: v.qty > 0 ? fmtUSD(+(v.revenue / v.qty).toFixed(2)) : "—", className: "text-muted" }) },
  ], []);
  const colPrefs = useColumns("report-service", ALL_COLS);
  const tableCols = colPrefs.columns;

  const { header, rows } = dataset;
  const period = useMemo(() => periodMonths(header), [header]);
  const rate = getUsdRate();

  const cols = useMemo(() => ({
    name:  header.find((h) => h === "Наименование") ?? col(header, "Наименование"),
    store: col(header, "Магазин"),
    qty:   header.find((h) => h.startsWith("Продажи товаров") && h.endsWith("Кол-во")),
    cost:  header.find((h) => h.startsWith("Продажи товаров") && h.includes("цене поставки")),
    rev:   header.find((h) => h.startsWith("Продажи товаров") && h.includes("скидк")),
    revList: header.find((h) => h.startsWith("Продажи товаров")
                             && h.includes("Сумма продажи") && !h.includes("скидк")),
  }), [header]);

  // —— Kirim: xizmat deb belgilangan nomlar ————————————
  const { service, goods } = useMemo(() => {
    const svc = [], gds = [];
    for (const r of rows) {
      const qty = numberOf(r, cols.qty);
      if (qty <= 0) continue;
      const revenue = numberOf(r, cols.rev) || numberOf(r, cols.revList);
      const item = {
        name: textOf(r, cols.name), store: textOf(r, cols.store),
        qty, revenue, cost: numberOf(r, cols.cost),
      };
      item.profit = revenue - item.cost;
      (isServiceName(item.name) ? svc : gds).push(item);
    }
    return { service: svc, goods: gds };
  }, [rows, cols]);

  const inc = useMemo(() => service.reduce((a, x) => ({
    qty: a.qty + x.qty, revenue: a.revenue + x.revenue, cost: a.cost + x.cost,
  }), { qty: 0, revenue: 0, cost: 0 }), [service]);

  const goodsRevenue = useMemo(() => goods.reduce((a, x) => a + x.revenue, 0), [goods]);

  // —— Xarajat: servis materiallari (gaz, avtol, shurup, samarez…) —
  const material = useMemo(() => {
    if (!period.from || !period.to) return { total: 0, byCat: [] };
    const rows = expensesInRange(period.from, period.to)
      .filter((e) => SERVICE_CATEGORIES.includes(e.category));
    const map = new Map();
    let total = 0;
    for (const e of rows) {
      total += e.amount;
      const k = e.category;
      map.set(k, (map.get(k) ?? 0) + e.amount);
    }
    return {
      total,
      byCat: [...map.entries()]
        .map(([k, v]) => ({ key: k, label: categoryLabel(k), amount: v }))
        .sort((a, b) => b.amount - a.amount),
    };
  }, [period]);

  // —— Xarajat: ustalar oyligi (KPI) ————————————————
  const wage = useMemo(() => {
    const installers = listStaff().filter((s) => s.role === "installer" && s.active !== false);
    const byStaff = [];
    let som = 0, cameras = 0;
    for (const s of installers) {
      let personal = 0, cam = 0;
      for (const m of period.months) {
        const r = computeMonth(s.id, m, "installer");
        personal += r.total; cam += r.cameras;
      }
      som += personal; cameras += cam;
      if (personal > 0 || cam > 0) byStaff.push({ name: s.name, som: personal, cameras: cam });
    }
    return { som, cameras, usd: rate ? +(som / rate).toFixed(2) : null,
      byStaff: byStaff.sort((a, b) => b.som - a.som) };
  }, [period, rate]);

  if (!cols.qty || !cols.name) {
    return (
      <div className="card p-10 text-center">
        <p className="font-extrabold mb-2">{t("Hisobot mos kelmadi")}</p>
        <p className="text-muted font-semibold">
          {t("Bu tahlil uchun Billz'ning \"Эффективность товаров\" hisoboti kerak.")}
        </p>
      </div>
    );
  }

  const wageUsd = wage.usd ?? 0;
  const cost = wageUsd + material.total;      // ustalar oyligi + material
  const profit = inc.revenue - inc.cost - cost;
  const margin = inc.revenue > 0 ? (profit / inc.revenue) * 100 : 0;
  const sharePct = goodsRevenue + inc.revenue > 0
    ? (inc.revenue / (goodsRevenue + inc.revenue)) * 100 : 0;

  const card = (title, value, hint, cls = "") => (
    <div className="card p-6">
      <p className="text-sm font-bold text-muted mb-2">{title}</p>
      <p className={`text-3xl font-extrabold ${cls}`}>{value}</p>
      <p className="text-sm text-muted font-semibold mt-1">{hint}</p>
    </div>
  );

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-6">
        {card(t("Servis kirimi"), fmtUSD(Math.round(inc.revenue)),
          tt("{q} ta o'rnatish · savdoning {p}% i", { q: Math.round(inc.qty).toLocaleString("ru-RU"), p: sharePct.toFixed(1) }))}
        {card(t("Ustalar oyligi"), wage.usd != null ? fmtUSD(Math.round(wage.usd)) : "—",
          tt("{n} so'm · {c} kamera", { n: Math.round(wage.som).toLocaleString("ru-RU"), c: wage.cameras }),
          "text-danger")}
        {card(t("Material va yoqilg'i"), fmtUSD(Math.round(material.total)),
          material.byCat.length
            ? material.byCat.slice(0, 3).map((c) => c.label).join(", ")
            : t("Xarajatlar bo'limiga kiritilmagan"),
          "text-danger")}
        {card(t("Servis foydasi"), fmtUSD(Math.round(profit)),
          t("Kirim − oylik − material"), profit >= 0 ? "text-ok" : "text-danger")}
        {card(t("Servis marjasi"), `${margin.toFixed(1)}%`,
          t("Foyda / kirim"), margin >= 0 ? "text-ok" : "text-danger")}
      </div>

      {!rate && (
        <div className="card p-5 mb-6 flex items-start gap-3 border-warn/40">
          <span className="w-9 h-9 rounded-xl bg-warn-soft text-warn flex items-center justify-center shrink-0">
            <AlertTriangle size={18} />
          </span>
          <div>
            <p className="font-bold">{t("Dollar kursi yo'q")}</p>
            <p className="text-sm text-muted font-semibold">
              {t("Ustalar oyligi so'mda — kurs qo'yilmaguncha foyda hisobiga qo'shilmadi. Sozlamalarda yoqing.")}
            </p>
          </div>
        </div>
      )}

      <div className="card p-5 mb-6 text-sm font-semibold text-muted">
        {tt("Xizmat deb belgilangan nomlar: {n}. Sozlamalarda o'zgartiriladi. Davr: {d}.",
          { n: getServiceNames().join(", ") || "—", d: period.from ? `${period.from} — ${period.to}` : period.months.join(", ") })}
      </div>

      {/* Ustalar kesimi */}
      {wage.byStaff.length > 0 && (
        <div className="card overflow-auto max-h-[70vh] mb-6">
          <table className="w-full text-[0.9375rem] whitespace-nowrap">
            <thead>
              <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-20 text-left text-muted text-sm border-b border-line [&>th]:bg-panel">
                <th className="px-5 py-4 font-bold">#</th>
                <th className="px-3 py-4 font-bold">{t("Usta")}</th>
                <th className="px-3 py-4 font-bold text-right">{t("Kamera (dona)")}</th>
                <th className="px-3 py-4 font-bold text-right">{t("Oyligi (so'm)")}</th>
                <th className="px-3 py-4 font-bold text-right">{t("Bir kameraga")}</th>
              </tr>
            </thead>
            <tbody>
              {wage.byStaff.map((x, i) => (
                <tr key={x.name} className={`border-b border-line last:border-0 ${i % 2 ? "bg-surface/30" : ""}`}>
                  <td className="px-5 py-3.5 font-semibold text-muted tabular-nums">{i + 1}</td>
                  <td className="px-3 py-3.5 font-bold">{x.name}</td>
                  <td className="px-3 py-3.5 text-right font-extrabold">{x.cameras}</td>
                  <td className="px-3 py-3.5 text-right font-semibold">{Math.round(x.som).toLocaleString("ru-RU")}</td>
                  <td className="px-3 py-3.5 text-right font-semibold text-muted">
                    {x.cameras > 0 ? Math.round(x.som / x.cameras).toLocaleString("ru-RU") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ExportButton name="Servis kirimi" rows={sortRows(service)}
        note={tt("{n} ta xizmat yozuvi", { n: service.length })}
        columns={[
          { label: "Xizmat", get: (x) => x.name },
          { label: "Do'kon", get: (x) => x.store },
          { label: "Soni", get: (x) => x.qty },
          { label: "Kirim ($)", get: (x) => Math.round(x.revenue) },
        ]} />

      <div className="flex justify-end mb-3">
        <button onClick={colPrefs.openSettings}
          className="flex items-center gap-2 rounded-xl border border-line px-4 py-2 font-bold hover:border-brand hover:text-brand transition-colors">
          <SlidersHorizontal size={16} /> {t("Ustunlar")}
        </button>
      </div>

      <div className="card overflow-auto max-h-[70vh]">
        <table className="w-full text-[0.9375rem] whitespace-nowrap">
          <thead className="sticky top-0 z-20">
            <tr className="text-left text-muted text-sm border-b border-line [&>th]:bg-panel">
              <th className="px-5 py-4 font-bold">#</th>
              <SortTh label="Xizmat" sortKey="name" sort={sort} onSort={toggle} className="px-5" />
              {tableCols.map((c) => (
                <SortTh key={c.key} label={c.label} sortKey={c.sortKey} sort={sort} onSort={toggle}
                  align={c.align} />
              ))}
            </tr>
            <TotalsRow count={service.length} span={2}
              cells={tableCols.map((c) => (c.total ? c.total(inc) : null))} />
          </thead>
          <tbody>
            {sortRows(service.map((x) => ({ ...x, avg: x.qty > 0 ? x.revenue / x.qty : 0 })))
              .map((x, i) => (
              <tr key={`${x.name}-${x.store}-${i}`} className={`border-b border-line last:border-0 ${i % 2 ? "bg-surface/30" : ""}`}>
                <td className="px-5 py-3.5 font-semibold text-muted tabular-nums">{i + 1}</td>
                <td className="px-5 py-3.5 font-bold">{x.name}</td>
                {tableCols.map((c) => (
                  <td key={c.key}
                    className={`px-3 py-3.5 ${c.align === "right" ? "text-right" : ""} ${c.cellClass?.(x) ?? ""}`}>
                    {c.cell(x)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {service.length === 0 && (
          <p className="px-5 py-10 text-center text-muted font-semibold">
            {t("Xizmat topilmadi — Sozlamalarda nomini to'g'ri yozganingizni tekshiring.")}
          </p>
        )}
      </div>

      {colPrefs.open && <ColumnSettings {...colPrefs.dialogProps} />}
    </div>
  );
}
