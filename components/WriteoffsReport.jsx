"use client";
import { t, tt } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { fmtUSD } from "@/lib/demoData";
import FilterBar, { applyFilters } from "@/components/FilterBar";
import SortTh, { useSort } from "@/components/SortTh";
import ExportButton from "@/components/ExportButton";
import TotalsRow from "@/components/TotalsRow";
import { numberOf, textOf } from "@/lib/datasets";
import { AlertTriangle } from "lucide-react";

// ══════════════════════════════════════════════════════════════
// HISOBDAN CHIQARISHLAR (yo'qotishlar)
// ══════════════════════════════════════════════════════════════
// Har hisobdan chiqarish — ombordan yo'qolgan pul. Savol uchta:
// nima sababdan, qaysi do'konda va KIM chiqargan.
//
// Ikki xil summa ko'rsatiladi:
//   tannarx bo'yicha — haqiqiy zarar (pul shuncha ketdi)
//   sotuv narxida    — yo'qotilgan tushum (sotilganda shuncha bo'lardi)

const CUTS = [
  { key: "reason", label: "Sabab" },
  { key: "store", label: "Do'kon" },
  { key: "user", label: "Xodim" },
  { key: "category", label: "Kategoriya" },
  { key: "brand", label: "Brend" },
];

const col = (header, ...names) =>
  header.find((h) => names.some((n) => h.toLowerCase().includes(n.toLowerCase()))) ?? null;

export default function WriteoffsReport({ dataset }) {
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({});
  const [cut, setCut] = useState("reason");
  const { sort, toggle, sortRows } = useSort("retail", "desc");

  const { header, rows } = dataset;

  const cols = useMemo(() => ({
    date:     col(header, "Время создания"),
    reason:   col(header, "Причина списания"),
    store:    col(header, "Название магазина", "Магазин"),
    user:     col(header, "Имя пользователя"),
    name:     col(header, "Названия продукта", "Наименование"),
    category: col(header, "Категории", "Категория"),
    brand:    col(header, "Бренд"),
    qty:      col(header, "Кол-во списанных"),
    // Diqqat: Billz'da "Суммма по цене продажи" — uch "м" bilan yozilgan.
    // Shuning uchun to'liq nom emas, ishonchli bo'lak bo'yicha qidiramiz.
    cost:     col(header, "по цене поставки"),
    retail:   col(header, "по цене продажи"),
  }), [header]);

  const items = useMemo(() => rows.map((r) => ({
    date: String(textOf(r, cols.date)).slice(0, 10),
    reason: textOf(r, cols.reason) || "—",
    store: textOf(r, cols.store) || "—",
    user: textOf(r, cols.user) || "—",
    name: textOf(r, cols.name),
    category: textOf(r, cols.category) || "—",
    brand: textOf(r, cols.brand) || "—",
    qty: numberOf(r, cols.qty),
    cost: numberOf(r, cols.cost),
    retail: numberOf(r, cols.retail),
  })), [rows, cols]);

  const FIELDS = useMemo(() => {
    const uniq = (k) => [...new Set(items.map((x) => x[k]).filter((v) => v && v !== "—"))].sort();
    const selects = CUTS.map((c) => ({
      key: c.key, label: c.label, type: "select",
      options: uniq(c.key).slice(0, 40).map((v) => ({ value: v, label: v })),
    })).filter((f) => f.options.length > 1);
    const ranges = [
      { key: "qty", label: "Dona" },
      { key: "cost", label: "Zarar tannarx ($)" },
      { key: "retail", label: "Sotuv narxida ($)" },
    ].map((f) => ({ ...f, type: "range" }));
    return [...selects, ...ranges];
  }, [items]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return applyFilters(items, FIELDS, filters)
      .filter((x) => !needle || x.name.toLowerCase().includes(needle));
  }, [items, FIELDS, filters, q]);

  const tot = useMemo(() => shown.reduce((a, x) => ({
    qty: a.qty + x.qty, cost: a.cost + x.cost, retail: a.retail + x.retail,
  }), { qty: 0, cost: 0, retail: 0 }), [shown]);

  // Tannarxi 0 bo'lgan yozuvlar — zarar aslida kattaroq
  const zeroCost = useMemo(() => shown.filter((x) => x.cost === 0 && x.qty > 0).length, [shown]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const x of shown) {
      const k = x[cut] || "—";
      const g = map.get(k) ?? { key: k, n: 0, qty: 0, cost: 0, retail: 0 };
      g.n++; g.qty += x.qty; g.cost += x.cost; g.retail += x.retail;
      map.set(k, g);
    }
    return [...map.values()].sort((a, b) => b.retail - a.retail);
  }, [shown, cut]);

  if (!cols.qty || !cols.reason) {
    return (
      <div className="card p-10 text-center">
        <p className="font-extrabold mb-2">{t("Hisobot mos kelmadi")}</p>
        <p className="text-muted font-semibold">{t("Bu tahlil uchun Billz'ning \"Списания\" hisoboti kerak.")}</p>
      </div>
    );
  }

  const card = (title, value, hint, cls = "") => (
    <div className="card p-6">
      <p className="text-sm font-bold text-muted mb-2">{title}</p>
      <p className={`text-3xl font-extrabold ${cls}`}>{value}</p>
      <p className="text-sm text-muted font-semibold mt-1">{hint}</p>
    </div>
  );

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        {card(t("Zarar (tannarx)"), fmtUSD(Math.round(tot.cost)), t("Ombordan ketgan pul"), "text-danger")}
        {card(t("Sotuv narxida"), fmtUSD(Math.round(tot.retail)), t("Sotilganda shuncha bo'lardi"))}
        {card(t("Chiqarilgan tovar"), Math.round(tot.qty).toLocaleString("ru-RU"),
          tt("{n} ta yozuv", { n: shown.length }))}
        {card(t("O'rtacha yozuv"), fmtUSD(shown.length ? Math.round(tot.retail / shown.length) : 0),
          t("Sotuv narxida"))}
      </div>

      {zeroCost > 0 && (
        <div className="card p-5 mb-6 flex items-start gap-3 border-warn/40">
          <span className="w-9 h-9 rounded-xl bg-warn-soft text-warn flex items-center justify-center shrink-0">
            <AlertTriangle size={18} />
          </span>
          <div>
            <p className="font-bold">{tt("{n} ta yozuvda tannarx 0", { n: zeroCost })}</p>
            <p className="text-sm text-muted font-semibold">
              {t("Haqiqiy zarar ko'rsatilganidan kattaroq — bu tovarlarga Billz'da kirim narxi yozilmagan.")}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-5">
        {CUTS.map((c) => (
          <button key={c.key} onClick={() => setCut(c.key)}
            className={`rounded-xl border-2 font-bold px-5 py-2.5 transition-colors ${
              cut === c.key ? "border-brand bg-brand-soft text-brand" : "border-line hover:border-brand"}`}>
            {t(c.label)}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto mb-6">
        <table className="w-full text-[0.9375rem] whitespace-nowrap">
          <thead>
            <tr className="text-left text-muted text-sm border-b border-line">
              <th className="px-5 py-4 font-bold">{t(CUTS.find((c) => c.key === cut).label)}</th>
              <th className="px-3 py-4 font-bold text-right">{t("Yozuv")}</th>
              <th className="px-3 py-4 font-bold text-right">{t("Dona")}</th>
              <th className="px-3 py-4 font-bold text-right">{t("Zarar (tannarx)")}</th>
              <th className="px-3 py-4 font-bold w-48">{t("Ulush")}</th>
              <th className="px-3 py-4 font-bold text-right">{t("Sotuv narxida")}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g, i) => {
              const share = tot.retail > 0 ? (g.retail / tot.retail) * 100 : 0;
              return (
                <tr key={g.key} className={`border-b border-line last:border-0 ${i % 2 ? "bg-surface/30" : ""}`}>
                  <td className="px-5 py-3.5 font-bold max-w-xs truncate" title={g.key}>{g.key}</td>
                  <td className="px-3 py-3.5 text-right font-semibold text-muted">{g.n}</td>
                  <td className="px-3 py-3.5 text-right font-semibold">{Math.round(g.qty).toLocaleString("ru-RU")}</td>
                  <td className="px-3 py-3.5 text-right font-extrabold text-danger">{fmtUSD(Math.round(g.cost))}</td>
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-track overflow-hidden">
                        <div className="h-full rounded-full bg-danger" style={{ width: `${share}%` }} />
                      </div>
                      <span className="text-sm font-bold text-muted w-10 text-right">{share.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-right font-semibold">{fmtUSD(Math.round(g.retail))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <FilterBar
        search={{ value: q, onChange: setQ, placeholder: "Tovar nomi bo'yicha qidirish..." }}
        fields={FIELDS} filters={filters} onChange={setFilters}
      />

      <ExportButton name="Hisobdan chiqarishlar" rows={sortRows(shown)}
        columns={[
          { label: "Sana", get: (x) => x.date },
          { label: "Tovar", get: (x) => x.name },
          { label: "Do'kon", get: (x) => x.store },
          { label: "Xodim", get: (x) => x.user },
          { label: "Sabab", get: (x) => x.reason },
          { label: "Kategoriya", get: (x) => x.category },
          { label: "Dona", get: (x) => x.qty },
          { label: "Zarar tannarx ($)", get: (x) => Math.round(x.cost) },
          { label: "Sotuv narxida ($)", get: (x) => Math.round(x.retail) },
        ]} />

      <div className="card overflow-auto max-h-[70vh]">
        <table className="w-full text-[0.9375rem] whitespace-nowrap">
          <thead className="sticky top-0 z-20">
            <tr className="text-left text-muted text-sm border-b border-line [&>th]:bg-panel">
              <th className="px-5 py-4 font-bold">#</th>
              <SortTh label="Sana" sortKey="date" sort={sort} onSort={toggle} className="px-5" />
              <SortTh label="Tovar" sortKey="name" sort={sort} onSort={toggle} />
              <SortTh label="Do'kon" sortKey="store" sort={sort} onSort={toggle} />
              <SortTh label="Xodim" sortKey="user" sort={sort} onSort={toggle} />
              <SortTh label="Sabab" sortKey="reason" sort={sort} onSort={toggle} />
              <SortTh label="Dona" sortKey="qty" sort={sort} onSort={toggle} align="right" />
              <SortTh label="Zarar" sortKey="cost" sort={sort} onSort={toggle} align="right" />
            </tr>
            <TotalsRow count={shown.length} cells={[
            null, null, null, null,
            { value: Math.round(tot.qty).toLocaleString("ru-RU") },
            { value: fmtUSD(Math.round(tot.cost)), className: "text-danger" },
            ]} />
          </thead>
          <tbody>
            {sortRows(shown).slice(0, 300).map((x, i) => (
              <tr key={`${x.date}-${x.name}-${i}`} className={`border-b border-line last:border-0 ${i % 2 ? "bg-surface/30" : ""}`}>
                <td className="px-5 py-3.5 font-semibold text-muted tabular-nums">{i + 1}</td>
                <td className="px-5 py-3.5 font-semibold text-muted">{x.date}</td>
                <td className="px-3 py-3.5 font-bold max-w-xs truncate" title={x.name}>{x.name}</td>
                <td className="px-3 py-3.5 font-semibold text-muted">{x.store}</td>
                <td className="px-3 py-3.5 font-semibold text-muted">{x.user}</td>
                <td className="px-3 py-3.5 font-semibold text-muted max-w-xs truncate" title={x.reason}>{x.reason}</td>
                <td className="px-3 py-3.5 text-right font-semibold">{Math.round(x.qty).toLocaleString("ru-RU")}</td>
                <td className="px-3 py-3.5 text-right font-extrabold text-danger">{fmtUSD(Math.round(x.cost))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length > 300 && (
          <p className="px-5 py-4 text-sm text-muted font-semibold border-t border-line">
            {tt("Birinchi 300 tasi ko'rsatildi ({n} tadan) — filtrni toraytiring yoki Excelga chiqaring", { n: shown.length })}
          </p>
        )}
      </div>
    </div>
  );
}
