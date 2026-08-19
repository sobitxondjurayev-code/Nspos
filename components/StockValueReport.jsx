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
// OMBOR QIYMATI
// ══════════════════════════════════════════════════════════════
// "Omborda qancha pul turibdi va u qayerda?" degan savolga javob.
//
// Billz "Остатки" hisobotida DONA narxi keladi ("Цена поставки"),
// summa emas. Shuning uchun qiymat o'zimizda hisoblanadi:
//
//   tannarx qiymati = qoldiq × yetkazib berish narxi
//   sotuv qiymati   = qoldiq × sotuv narxi
//   potentsial foyda = sotuv − tannarx
//
// (Tekshirildi: hisobotning o'z "Сумма прибыли остатков" ustuni bilan
// aynan mos tushadi.)
//
// Kesim almashtiriladi: do'kon, kategoriya, brend, yetkazib beruvchi —
// chunki "qayerda pul ko'p?" savoli har safar boshqa kesimda so'raladi.

const CUTS = [
  { key: "store", label: "Do'kon" },
  { key: "category", label: "Kategoriya" },
  { key: "brand", label: "Brend" },
  { key: "supplier", label: "Yetkazib beruvchi" },
];

const col = (header, ...names) =>
  header.find((h) => names.some((n) => h.toLowerCase().includes(n.toLowerCase()))) ?? null;

export default function StockValueReport({ dataset }) {
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({});
  const [cut, setCut] = useState("store");
  const { sort, toggle, sortRows } = useSort("cost", "desc");

  const { header, rows } = dataset;

  const cols = useMemo(() => ({
    name:     col(header, "Наименование товара", "Наименование"),
    store:    col(header, "Магазин"),
    category: col(header, "Категория"),
    brand:    col(header, "Бренд"),
    supplier: col(header, "Поставщик"),
    qty:      col(header, "Кол-во"),
    cost:     col(header, "Цена поставки"),
    price:    col(header, "Цена продажи"),
    archived: col(header, "Архивирован"),
  }), [header]);

  const { items, negatives } = useMemo(() => {
    const out = [], neg = [];
    for (const r of rows) {
      const qty = cols.qty ? numberOf(r, cols.qty) : 0;
      const unitCost = cols.cost ? numberOf(r, cols.cost) : 0;
      const unitPrice = cols.price ? numberOf(r, cols.price) : 0;
      const it = {
        name: textOf(r, cols.name), store: textOf(r, cols.store),
        category: textOf(r, cols.category) || "—", brand: textOf(r, cols.brand) || "—",
        supplier: textOf(r, cols.supplier) || "—",
        archived: /да/i.test(textOf(r, cols.archived)),
        qty, cost: qty * unitCost, retail: qty * unitPrice,
      };
      it.profit = it.retail - it.cost;
      it.margin = it.retail > 0 ? (it.profit / it.retail) * 100 : 0;
      // Manfiy qoldiq — bu ombor xatosi, tahlilga qo'shilmaydi lekin
      // ko'rsatiladi: aks holda jami summa jimgina noto'g'ri chiqadi.
      if (qty < 0) neg.push(it); else if (qty > 0) out.push(it);
    }
    return { items: out, negatives: neg };
  }, [rows, cols]);

  const FIELDS = useMemo(() => {
    const uniq = (k) => [...new Set(items.map((x) => x[k]).filter((v) => v && v !== "—"))].sort();
    const selects = CUTS.map((c) => ({
      key: c.key, label: c.label, type: "select",
      options: uniq(c.key).slice(0, 40).map((v) => ({ value: v, label: v })),
    })).filter((f) => f.options.length > 1);
    // Son oraliqlari — bir nechta shartni birga qo'llash uchun
    const ranges = [
      { key: "qty", label: "Dona" },
      { key: "cost", label: "Tannarx qiymati ($)" },
      { key: "retail", label: "Sotuv narxida ($)" },
      { key: "margin", label: "Marja (%)" },
    ].map((f) => ({ ...f, type: "range" }));
    return [...selects, ...ranges];
  }, [items]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return applyFilters(items, FIELDS, filters)
      .filter((x) => !needle || x.name.toLowerCase().includes(needle));
  }, [items, FIELDS, filters, q]);

  const totals = useMemo(() => shown.reduce((a, x) => ({
    cost: a.cost + x.cost, retail: a.retail + x.retail, qty: a.qty + x.qty,
  }), { cost: 0, retail: 0, qty: 0 }), [shown]);

  // Tanlangan kesim bo'yicha guruhlash
  const groups = useMemo(() => {
    const map = new Map();
    for (const x of shown) {
      const k = x[cut] || "—";
      const g = map.get(k) ?? { key: k, n: 0, qty: 0, cost: 0, retail: 0 };
      g.n++; g.qty += x.qty; g.cost += x.cost; g.retail += x.retail;
      map.set(k, g);
    }
    return [...map.values()].sort((a, b) => b.cost - a.cost);
  }, [shown, cut]);

  if (!cols.qty || !cols.cost) {
    return (
      <div className="card p-10 text-center">
        <p className="font-extrabold mb-2">{t("Hisobot mos kelmadi")}</p>
        <p className="text-muted font-semibold">
          {t("Bu tahlil uchun Billz'ning \"Остатки\" hisoboti kerak.")}
        </p>
      </div>
    );
  }

  const profit = totals.retail - totals.cost;
  const margin = totals.retail > 0 ? (profit / totals.retail) * 100 : 0;

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
        {card(t("Tannarx bo'yicha"), fmtUSD(Math.round(totals.cost)),
          tt("{n} pozitsiya · {q} dona", { n: shown.length, q: Math.round(totals.qty).toLocaleString("ru-RU") }))}
        {card(t("Sotuv narxida"), fmtUSD(Math.round(totals.retail)), t("Hammasi sotilsa"))}
        {card(t("Potentsial foyda"), fmtUSD(Math.round(profit)), t("Sotuv narxi − tannarx"), "text-ok")}
        {card(t("O'rtacha marja"), `${margin.toFixed(1)}%`, t("Foyda / sotuv narxi"))}
      </div>

      {negatives.length > 0 && (
        <div className="card p-5 mb-6 flex items-start gap-3 border-warn/40">
          <span className="w-9 h-9 rounded-xl bg-warn-soft text-warn flex items-center justify-center shrink-0">
            <AlertTriangle size={18} />
          </span>
          <div>
            <p className="font-bold">{tt("{n} ta pozitsiyada qoldiq manfiy", { n: negatives.length })}</p>
            <p className="text-sm text-muted font-semibold">
              {t("Ular hisobga olinmadi — bu ombor xatosi, inventarizatsiya qilish kerak:")}{" "}
              {negatives.slice(0, 3).map((x) => `${x.name} (${x.qty})`).join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Kesim tanlash */}
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
              <th className="px-3 py-4 font-bold text-right">{t("Pozitsiya")}</th>
              <th className="px-3 py-4 font-bold text-right">{t("Dona")}</th>
              <th className="px-3 py-4 font-bold text-right">{t("Tannarx qiymati")}</th>
              <th className="px-3 py-4 font-bold w-48">{t("Ulush")}</th>
              <th className="px-3 py-4 font-bold text-right">{t("Potentsial foyda")}</th>
              <th className="px-3 py-4 font-bold text-right">{t("Marja")}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g, i) => {
              const share = totals.cost > 0 ? (g.cost / totals.cost) * 100 : 0;
              const gm = g.retail > 0 ? ((g.retail - g.cost) / g.retail) * 100 : 0;
              return (
                <tr key={g.key} className={`border-b border-line last:border-0 ${i % 2 ? "bg-surface/30" : ""}`}>
                  <td className="px-5 py-3.5 font-bold max-w-xs truncate" title={g.key}>{g.key}</td>
                  <td className="px-3 py-3.5 text-right font-semibold text-muted">{g.n}</td>
                  <td className="px-3 py-3.5 text-right font-semibold text-muted">{Math.round(g.qty).toLocaleString("ru-RU")}</td>
                  <td className="px-3 py-3.5 text-right font-extrabold">{fmtUSD(Math.round(g.cost))}</td>
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-track overflow-hidden">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${share}%` }} />
                      </div>
                      <span className="text-sm font-bold text-muted w-10 text-right">{share.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-right font-semibold text-ok">{fmtUSD(Math.round(g.retail - g.cost))}</td>
                  <td className="px-3 py-3.5 text-right font-semibold">{gm.toFixed(0)}%</td>
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

      <ExportButton name="Ombor qiymati" rows={sortRows(shown)}
        columns={[
          { label: "Tovar", get: (x) => x.name },
          { label: "Do'kon", get: (x) => x.store },
          { label: "Kategoriya", get: (x) => x.category },
          { label: "Brend", get: (x) => x.brand },
          { label: "Yetkazib beruvchi", get: (x) => x.supplier },
          { label: "Dona", get: (x) => x.qty },
          { label: "Tannarx qiymati ($)", get: (x) => Math.round(x.cost) },
          { label: "Sotuv narxida ($)", get: (x) => Math.round(x.retail) },
          { label: "Potentsial foyda ($)", get: (x) => Math.round(x.profit) },
          { label: "Marja %", get: (x) => Math.round(x.margin) },
        ]} />

      <div className="card overflow-auto max-h-[70vh]">
        <table className="w-full text-[0.9375rem] whitespace-nowrap">
          <thead className="sticky top-0 z-20">
            <tr className="text-left text-muted text-sm border-b border-line [&>th]:bg-panel">
              <th className="px-5 py-4 font-bold">#</th>
              <SortTh label="Tovar" sortKey="name" sort={sort} onSort={toggle} className="px-5" />
              <SortTh label="Do'kon" sortKey="store" sort={sort} onSort={toggle} />
              <SortTh label="Kategoriya" sortKey="category" sort={sort} onSort={toggle} />
              <SortTh label="Dona" sortKey="qty" sort={sort} onSort={toggle} align="right" />
              <SortTh label="Tannarx qiymati" sortKey="cost" sort={sort} onSort={toggle} align="right" />
              <SortTh label="Sotuv narxida" sortKey="retail" sort={sort} onSort={toggle} align="right" />
              <SortTh label="Marja" sortKey="margin" sort={sort} onSort={toggle} align="right" />
            </tr>
            <TotalsRow count={shown.length} cells={[
            null,
            null,
            { value: Math.round(totals.qty).toLocaleString("ru-RU") },
            { value: fmtUSD(Math.round(totals.cost)) },
            { value: fmtUSD(Math.round(totals.retail)), className: "text-muted" },
            // Marja o'rtachasi emas: jami (sotuv − tannarx) ÷ jami sotuv
            { value: totals.retail > 0
            ? `${(((totals.retail - totals.cost) / totals.retail) * 100).toFixed(0)}%` : "—" },
            ]} />
          </thead>
          <tbody>
            {sortRows(shown).slice(0, 300).map((x, i) => (
              <tr key={`${x.name}-${x.store}-${i}`} className={`border-b border-line last:border-0 ${i % 2 ? "bg-surface/30" : ""}`}>
                <td className="px-5 py-3.5 font-semibold text-muted tabular-nums">{i + 1}</td>
                <td className="px-5 py-3.5 font-bold max-w-xs truncate" title={x.name}>{x.name}</td>
                <td className="px-3 py-3.5 font-semibold text-muted">{x.store}</td>
                <td className="px-3 py-3.5 font-semibold text-muted">{x.category}</td>
                <td className="px-3 py-3.5 text-right font-semibold">{Math.round(x.qty).toLocaleString("ru-RU")}</td>
                <td className="px-3 py-3.5 text-right font-extrabold">{fmtUSD(Math.round(x.cost))}</td>
                <td className="px-3 py-3.5 text-right font-semibold text-muted">{fmtUSD(Math.round(x.retail))}</td>
                <td className="px-3 py-3.5 text-right font-semibold">{x.margin.toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length > 300 && (
          <p className="px-5 py-4 text-sm text-muted font-semibold border-t border-line">
            {tt("Eng qimmat 300 tasi ko'rsatildi ({n} tadan)", { n: shown.length })}
          </p>
        )}
      </div>
    </div>
  );
}
