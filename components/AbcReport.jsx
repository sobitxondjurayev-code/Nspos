"use client";
import { t, tt } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { fmtUSD } from "@/lib/demoData";
import FilterBar, { applyFilters } from "@/components/FilterBar";
import { findColumn } from "@/lib/analyses";
import { numberOf, textOf } from "@/lib/datasets";
import ParetoChart from "@/components/finance/ParetoChart";
// Bu to'rttasi ISHLATILARDI, lekin import qilinmagan edi — sahifa
// brauzerda "useColumns is not defined" bilan qulardi.
import { SlidersHorizontal } from "lucide-react";
import { useColumns } from "@/components/useColumns";
import ColumnSettings from "@/components/ColumnSettings";
import TotalsRow from "@/components/TotalsRow";

// ══════════════════════════════════════════════════════════════
// ABC TAHLILI
// ══════════════════════════════════════════════════════════════
// Kumulyativ tushum bo'yicha uch sinf:
//   A — 80% gacha  → asosiy, ular ketsa savdo qulaydi
//   B — 95% gacha  → o'sish zaxirasi
//   C — qolgani    → kam ta'sirli
//
// Chegaralar sozlanadi: har biznesda 80/15/5 to'g'ri kelavermaydi.
const CLASSES = {
  A: { bg: "bg-ok-soft", text: "text-ok", hint: "asosiy" },
  B: { bg: "bg-warn-soft", text: "text-warn", hint: "o'sish zaxirasi" },
  C: { bg: "bg-track", text: "text-muted", hint: "kam ta'sirli" },
};

export default function AbcReport({ analysis, dataset }) {
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({});
  const [tab, setTab] = useState("all");
  const [cutA, setCutA] = useState(80);
  const [cutB, setCutB] = useState(95);

  const { header, rows, profile: pf } = dataset;

  // Ustunlarni nomidan topamiz — Billz nomni o'zgartirsa ham ishlasin
  const cols = useMemo(() => ({
    label: findColumn(header, analysis.labelColumn),
    value: findColumn(header, analysis.valueColumn),
    count: findColumn(header, analysis.countColumn),
    phone: findColumn(header, analysis.phoneColumn),
  }), [header, analysis]);

  const FIELDS = useMemo(() =>
    pf.columns.filter((c) => c.filterable).slice(0, 6).map((c) => ({
      key: c.key, type: "select", label: c.label,
      options: c.options.map((o) => ({ value: o, label: o })),
      get: (r) => textOf(r, c.key),
    })), [pf]);

  // —— Hisob ————————————————————————————————————
  const ranked = useMemo(() => {
    if (!cols.value || !cols.label) return [];

    const base = applyFilters(rows, FIELDS, filters)
      .map((r) => ({
        label: textOf(r, cols.label) || "—",
        phone: cols.phone ? textOf(r, cols.phone) : "",
        value: numberOf(r, cols.value),
        count: cols.count ? numberOf(r, cols.count) : 0,
      }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);

    const total = base.reduce((a, r) => a + r.value, 0);
    let cum = 0;
    return base.map((r, i) => {
      cum += r.value;
      const cumPct = total > 0 ? (cum / total) * 100 : 0;
      return {
        ...r, rank: i + 1,
        share: total > 0 ? (r.value / total) * 100 : 0,
        cumPct,
        avg: r.count > 0 ? r.value / r.count : 0,
        abc: cumPct <= cutA ? "A" : cumPct <= cutB ? "B" : "C",
      };
    });
  }, [rows, FIELDS, filters, cols, cutA, cutB]);

  const summary = useMemo(() => {
    const out = { A: { n: 0, sum: 0 }, B: { n: 0, sum: 0 }, C: { n: 0, sum: 0 } };
    for (const r of ranked) { out[r.abc].n++; out[r.abc].sum += r.value; }
    return out;
  }, [ranked]);

  // —— Ustunlar ("#" va nom doim chapda) ————————————————
  const ALL_COLS = useMemo(() => [
    ...(cols.count ? [
      { key: "count", label: "Soni", align: "right",
        cellClass: () => "font-semibold", cell: (r) => r.count,
        total: (rs) => ({ value: rs.reduce((a, r) => a + (r.count || 0), 0).toLocaleString("ru-RU") }) },
      { key: "avg", label: "O'rtacha", align: "right",
        cellClass: () => "font-semibold text-muted", cell: (r) => fmtUSD(+r.avg.toFixed(2)),
        // O'rtacha chek: jami tushum ÷ jami soni (qatorlar o'rtachasi emas)
        total: (rs) => {
          const n = rs.reduce((a, r) => a + (r.count || 0), 0);
          const v = rs.reduce((a, r) => a + r.value, 0);
          return { value: n > 0 ? fmtUSD(+(v / n).toFixed(2)) : "—", className: "text-muted" };
        } },
    ] : []),
    { key: "value", label: "Tushum", align: "right",
      cellClass: () => "font-extrabold", cell: (r) => fmtUSD(+r.value.toFixed(2)),
      total: (rs) => ({ value: fmtUSD(+rs.reduce((a, r) => a + r.value, 0).toFixed(2)) }) },
    { key: "share", label: "Ulushi", align: "right",
      cellClass: () => "font-semibold text-muted", cell: (r) => `${r.share.toFixed(2)}%`,
      total: (rs) => ({ value: `${rs.reduce((a, r) => a + r.share, 0).toFixed(2)}%`, className: "text-muted" }) },
    { key: "cumPct", label: "Kumulyativ", align: "right",
      cellClass: () => "font-semibold text-muted", cell: (r) => `${r.cumPct.toFixed(2)}%` },
    { key: "abc", label: "Sinf", align: "center",
      cell: (r) => (
        <span className={`inline-block w-8 py-1 rounded-lg font-extrabold ${CLASSES[r.abc].bg} ${CLASSES[r.abc].text}`}>
          {r.abc}
        </span>
      ) },
  ], [cols.count]);
  const colPrefs = useColumns("report-abc", ALL_COLS);
  const tableCols = colPrefs.columns;

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return ranked
      .filter((r) => tab === "all" || r.abc === tab)
      .filter((r) => !s || r.label.toLowerCase().includes(s) || r.phone.includes(s));
  }, [ranked, tab, q]);

  if (!cols.value || !cols.label) {
    return (
      <div className="card p-10 text-center">
        <p className="font-extrabold mb-2">{t("Kerakli ustunlar topilmadi")}</p>
        <p className="text-muted font-semibold">
          {tt("Kerak: {a} va {b}", {
            a: analysis.labelColumn.join(" / "), b: analysis.valueColumn.join(" / "),
          })}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Uch sinf */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
        {["A", "B", "C"].map((k) => (
          <div key={k} className="card p-6">
            <div className="flex items-center gap-3 mb-3">
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-lg ${CLASSES[k].bg} ${CLASSES[k].text}`}>
                {k}
              </span>
              <p className="text-sm font-bold text-muted">
                {tt("{n} ta", { n: summary[k].n })}
              </p>
            </div>
            <p className="text-3xl font-extrabold">{fmtUSD(+summary[k].sum.toFixed(2))}</p>
            <p className="text-sm text-muted font-semibold mt-1">
              {k === "A" ? tt("Tushumning {n}% i — asosiylari", { n: cutA })
                : k === "B" ? tt("Keyingi {n}% — o'sish zaxirasi", { n: cutB - cutA })
                : tt("Oxirgi {n}% — kam ta'sirli", { n: 100 - cutB })}
            </p>
          </div>
        ))}
      </div>

      {/* Chegaralarni sozlash */}
      <div className="card p-6 mb-6">
        <p className="font-extrabold mb-4">{t("Sinf chegaralari")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <label className="block">
            <span className="block text-sm font-bold mb-2">{tt("A sinfi — {n}% gacha", { n: cutA })}</span>
            <input type="range" min="50" max="90" value={cutA} className="w-full accent-brand"
              onChange={(e) => setCutA(Math.min(+e.target.value, cutB - 1))} />
          </label>
          <label className="block">
            <span className="block text-sm font-bold mb-2">{tt("B sinfi — {n}% gacha", { n: cutB })}</span>
            <input type="range" min="60" max="99" value={cutB} className="w-full accent-brand"
              onChange={(e) => setCutB(Math.max(+e.target.value, cutA + 1))} />
          </label>
        </div>
      </div>

      {/* Pareto — jadvaldan oldin. Rahbar avval "nechta pozitsiya
          tushumning 80 % ini beradi" ni ko'radi, keyin ro'yxatga
          tushadi. Grafik filtrdan O'TGAN ro'yxat bo'yicha chiziladi,
          ya'ni jadval bilan bir xil ma'lumot. */}
      <ParetoChart rows={shown} cutA={cutA} cutB={cutB} />

      <FilterBar
        tabs={[
          { key: "all", label: "Barchasi", count: ranked.length },
          { key: "A", label: "A sinfi", count: summary.A.n },
          { key: "B", label: "B sinfi", count: summary.B.n },
          { key: "C", label: "C sinfi", count: summary.C.n },
        ]}
        activeTab={tab} onTab={setTab}
        search={{ value: q, onChange: setQ, placeholder: "Nom yoki telefon bo'yicha qidirish..." }}
        fields={FIELDS} filters={filters} onChange={setFilters}
      />

      <div className="flex justify-end mb-3">
        <button onClick={colPrefs.openSettings}
          className="flex items-center gap-2 rounded-xl border border-line px-4 py-2 font-bold hover:border-brand hover:text-brand transition-colors">
          <SlidersHorizontal size={16} /> {t("Ustunlar")}
        </button>
      </div>

      <div className="card overflow-auto max-h-[70vh]">
        <table className="w-full text-[0.9375rem]">
          <thead className="sticky top-0 z-20">
            <tr className="text-left text-muted text-sm border-b border-line [&>th]:bg-panel">
              <th className="px-6 py-4 font-bold">#</th>
              <th className="px-4 py-4 font-bold">{cols.label}</th>
              {tableCols.map((c) => (
                <th key={c.key}
                  className={`px-4 py-4 font-bold ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}`}>
                  {t(c.label)}
                </th>
              ))}
            </tr>
            <TotalsRow count={shown.length} span={2}
              cells={tableCols.map((c) => (c.total ? c.total(shown) : null))} />
          </thead>
          <tbody>
            {shown.slice(0, 300).map((r) => (
              <tr key={r.rank} className="border-b border-line last:border-0 hover:bg-surface/70">
                <td className="px-6 py-3.5 font-semibold text-muted">{r.rank}</td>
                <td className="px-4 py-3.5">
                  <p className="font-bold">{r.label}</p>
                  {r.phone && <p className="text-sm text-muted">{r.phone}</p>}
                </td>
                {tableCols.map((c) => (
                  <td key={c.key}
                    className={`px-4 py-3.5 ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""} ${c.cellClass?.(r) ?? ""}`}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length > 300 && (
          <p className="px-6 py-4 text-sm text-muted font-semibold border-t border-line">
            {tt("Yana {n} qator — filtr bilan toraytiring", { n: shown.length - 300 })}
          </p>
        )}
      </div>

      {colPrefs.open && <ColumnSettings {...colPrefs.dialogProps} />}
    </div>
  );
}
