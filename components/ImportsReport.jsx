"use client";
import { t, tt } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { fmtUSD } from "@/lib/demoData";
import FilterBar, { applyFilters } from "@/components/FilterBar";
import SortTh, { useSort } from "@/components/SortTh";
import ExportButton from "@/components/ExportButton";
import TotalsRow from "@/components/TotalsRow";
import { numberOf, textOf } from "@/lib/datasets";

// ══════════════════════════════════════════════════════════════
// IMPORT PARTIYALARI
// ══════════════════════════════════════════════════════════════
// "Nima kirdi, qanchasi sotildi, qanchasi hali yotibdi?"
//
// Har qator — bitta partiyadagi bitta tovar. Billz sotilgan, qolgan,
// hisobdan chiqarilgan miqdorlarni allaqachon hisoblab beradi, shuning
// uchun bu yerda faqat guruhlash va YOSH qo'shiladi: partiya qancha
// vaqtdan beri omborda turibdi.
//
// Eng muhim ko'rsatkich — sotilish darajasi (sell-through): kirgan
// tovarning qanchasi pulga aylandi. Qolgani — muzlab qolgan kapital.

const CUTS = [
  { key: "batch", label: "Partiya" },
  { key: "category", label: "Kategoriya" },
  { key: "brand", label: "Brend" },
  { key: "store", label: "Do'kon" },
  { key: "supplier", label: "Yetkazib beruvchi" },
];

// Yosh guruhlari — eski partiyada qotgan pul eng og'riqli
const AGES = [
  { key: "a30", label: "30 kungacha", max: 30 },
  { key: "a90", label: "30–90 kun", max: 90 },
  { key: "a180", label: "90–180 kun", max: 180 },
  { key: "old", label: "180 kundan ortiq", max: Infinity },
];
const ageKey = (d) => AGES.find((a) => d <= a.max).key;

const col = (header, ...names) =>
  header.find((h) => names.some((n) => h.toLowerCase().includes(n.toLowerCase()))) ?? null;

export default function ImportsReport({ dataset }) {
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({});
  const [cut, setCut] = useState("batch");
  const { sort, toggle, sortRows } = useSort("restCost", "desc");

  const { header, rows } = dataset;

  const cols = useMemo(() => ({
    date:     col(header, "Дата импорта"),
    batch:    col(header, "ID импорта"),
    store:    col(header, "Магазин"),
    name:     col(header, "Наименование"),
    category: col(header, "Категория"),
    brand:    col(header, "Бренд"),
    supplier: col(header, "Поставщик"),
    impQty:   col(header, "Кол-во импортированных"),
    impCost:  col(header, "Сумма импорта по цене поставки"),
    soldQty:  col(header, "Продажи кол-во"),
    soldCost: col(header, "Сумма продаж по цене поставки"),
    soldRev:  col(header, "Сумма продаж по цене продажи"),
    restQty:  col(header, "Остаток кол-во"),
    restCost: col(header, "Сумма остатков по цене поставки"),
  }), [header]);

  const items = useMemo(() => {
    const today = new Date();
    return rows.map((r) => {
      const impQty = numberOf(r, cols.impQty);
      const soldQty = numberOf(r, cols.soldQty);
      const dateStr = String(textOf(r, cols.date)).slice(0, 10);
      const d = new Date(dateStr);
      const age = Number.isNaN(d.getTime()) ? 0 : Math.max(0, Math.round((today - d) / 86400000));
      const soldCost = numberOf(r, cols.soldCost);
      return {
        name: textOf(r, cols.name), store: textOf(r, cols.store),
        category: textOf(r, cols.category) || "—", brand: textOf(r, cols.brand) || "—",
        supplier: textOf(r, cols.supplier) || "—",
        batch: textOf(r, cols.batch) || "—", date: dateStr, age, ageKey: ageKey(age),
        impQty, impCost: numberOf(r, cols.impCost),
        soldQty, soldCost, profit: numberOf(r, cols.soldRev) - soldCost,
        restQty: numberOf(r, cols.restQty), restCost: numberOf(r, cols.restCost),
        sellPct: impQty > 0 ? (soldQty / impQty) * 100 : 0,
      };
    }).filter((x) => x.impQty > 0);
  }, [rows, cols]);

  const FIELDS = useMemo(() => {
    const uniq = (k) => [...new Set(items.map((x) => x[k]).filter((v) => v && v !== "—"))].sort();
    const selects = CUTS.filter((c) => c.key !== "batch").map((c) => ({
      key: c.key, label: c.label, type: "select",
      options: uniq(c.key).slice(0, 40).map((v) => ({ value: v, label: v })),
    })).filter((f) => f.options.length > 1);
    const ranges = [
      { key: "age", label: "Yosh (kun)" },
      { key: "sellPct", label: "Sotilish (%)" },
      { key: "restCost", label: "Qolgan pul ($)" },
      { key: "profit", label: "Foyda ($)" },
    ].map((f) => ({ ...f, type: "range" }));
    return [...selects, ...ranges];
  }, [items]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return applyFilters(items, FIELDS, filters)
      .filter((x) => !needle || x.name.toLowerCase().includes(needle));
  }, [items, FIELDS, filters, q]);

  const tot = useMemo(() => shown.reduce((a, x) => ({
    impQty: a.impQty + x.impQty, impCost: a.impCost + x.impCost,
    soldQty: a.soldQty + x.soldQty, profit: a.profit + x.profit,
    restQty: a.restQty + x.restQty, restCost: a.restCost + x.restCost,
  }), { impQty: 0, impCost: 0, soldQty: 0, profit: 0, restQty: 0, restCost: 0 }), [shown]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const x of shown) {
      const k = cut === "batch" ? `${x.batch}` : (x[cut] || "—");
      const g = map.get(k) ?? { key: k, n: 0, impQty: 0, impCost: 0, soldQty: 0, restCost: 0, profit: 0, age: x.age, date: x.date };
      g.n++; g.impQty += x.impQty; g.impCost += x.impCost; g.soldQty += x.soldQty;
      g.restCost += x.restCost; g.profit += x.profit;
      if (cut === "batch") { g.age = x.age; g.date = x.date; }
      map.set(k, g);
    }
    return [...map.values()].sort((a, b) => b.restCost - a.restCost);
  }, [shown, cut]);

  const aging = useMemo(() => {
    const m = Object.fromEntries(AGES.map((a) => [a.key, { rest: 0, n: 0 }]));
    for (const x of shown) { m[x.ageKey].rest += x.restCost; m[x.ageKey].n++; }
    return m;
  }, [shown]);

  if (!cols.impQty || !cols.batch) {
    return (
      <div className="card p-10 text-center">
        <p className="font-extrabold mb-2">{t("Hisobot mos kelmadi")}</p>
        <p className="text-muted font-semibold">{t("Bu tahlil uchun Billz'ning \"Импорты\" hisoboti kerak.")}</p>
      </div>
    );
  }

  const sellPct = tot.impQty > 0 ? (tot.soldQty / tot.impQty) * 100 : 0;
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
        {card(t("Import qilingan"), fmtUSD(Math.round(tot.impCost)),
          tt("{q} dona · {n} qator", { q: Math.round(tot.impQty).toLocaleString("ru-RU"), n: shown.length }))}
        {card(t("Sotilish darajasi"), `${sellPct.toFixed(1)}%`,
          tt("{q} dona sotilgan", { q: Math.round(tot.soldQty).toLocaleString("ru-RU") }),
          sellPct >= 50 ? "text-ok" : "text-warn")}
        {card(t("Omborda qolgan"), fmtUSD(Math.round(tot.restCost)),
          tt("{q} dona hali sotilmagan", { q: Math.round(tot.restQty).toLocaleString("ru-RU") }), "text-warn")}
        {card(t("Sotilganidan foyda"), fmtUSD(Math.round(tot.profit)), t("Sotuv narxi − tannarx"), "text-ok")}
      </div>

      {/* Yosh bo'yicha qolgan pul */}
      <div className="card p-6 mb-6">
        <p className="font-extrabold mb-1">{t("Qolgan pul — partiya yoshi bo'yicha")}</p>
        <p className="text-sm text-muted font-semibold mb-5">
          {t("Partiya qancha eski bo'lsa, undagi pul shuncha uzoq muzlab turibdi")}
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {AGES.map((a, i) => {
            const v = aging[a.key];
            const share = tot.restCost > 0 ? (v.rest / tot.restCost) * 100 : 0;
            const tone = i >= 2 ? "text-danger" : i === 1 ? "text-warn" : "text-ok";
            return (
              <div key={a.key} className="rounded-xl border border-line p-4">
                <p className="text-sm font-bold text-muted mb-1">{t(a.label)}</p>
                <p className={`text-2xl font-extrabold ${tone}`}>{fmtUSD(Math.round(v.rest))}</p>
                <p className="text-sm text-muted font-semibold mt-1">
                  {tt("{n} qator · {p}%", { n: v.n, p: share.toFixed(0) })}
                </p>
              </div>
            );
          })}
        </div>
      </div>

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
              {cut === "batch" && <th className="px-3 py-4 font-bold">{t("Sana")}</th>}
              {cut === "batch" && <th className="px-3 py-4 font-bold text-right">{t("Yosh")}</th>}
              <th className="px-3 py-4 font-bold text-right">{t("Import")}</th>
              <th className="px-3 py-4 font-bold w-40">{t("Sotilgan")}</th>
              <th className="px-3 py-4 font-bold text-right">{t("Qolgan pul")}</th>
              <th className="px-3 py-4 font-bold text-right">{t("Foyda")}</th>
            </tr>
          </thead>
          <tbody>
            {groups.slice(0, 200).map((g, i) => {
              const pct = g.impQty > 0 ? (g.soldQty / g.impQty) * 100 : 0;
              return (
                <tr key={g.key} className={`border-b border-line last:border-0 ${i % 2 ? "bg-surface/30" : ""}`}>
                  <td className="px-5 py-3.5 font-bold max-w-xs truncate" title={g.key}>{g.key}</td>
                  {cut === "batch" && <td className="px-3 py-3.5 font-semibold text-muted">{g.date}</td>}
                  {cut === "batch" && (
                    <td className={`px-3 py-3.5 text-right font-bold ${g.age > 180 ? "text-danger" : g.age > 90 ? "text-warn" : "text-muted"}`}>
                      {tt("{n} kun", { n: g.age })}
                    </td>
                  )}
                  <td className="px-3 py-3.5 text-right font-extrabold">{fmtUSD(Math.round(g.impCost))}</td>
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-track overflow-hidden">
                        <div className={`h-full rounded-full ${pct >= 50 ? "bg-ok" : "bg-warn"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <span className="text-sm font-bold text-muted w-10 text-right">{pct.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-right font-semibold text-warn">{fmtUSD(Math.round(g.restCost))}</td>
                  <td className="px-3 py-3.5 text-right font-semibold text-ok">{fmtUSD(Math.round(g.profit))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {groups.length > 200 && (
          <p className="px-5 py-4 text-sm text-muted font-semibold border-t border-line">
            {tt("Eng ko'p pul qolgan 200 tasi ({n} tadan)", { n: groups.length })}
          </p>
        )}
      </div>

      <FilterBar
        search={{ value: q, onChange: setQ, placeholder: "Tovar nomi bo'yicha qidirish..." }}
        fields={FIELDS} filters={filters} onChange={setFilters}
      />

      <ExportButton name="Import partiyalari" rows={sortRows(shown)}
        columns={[
          { label: "Tovar", get: (x) => x.name },
          { label: "Partiya", get: (x) => x.batch },
          { label: "Sana", get: (x) => x.date },
          { label: "Yosh (kun)", get: (x) => x.age },
          { label: "Do'kon", get: (x) => x.store },
          { label: "Kategoriya", get: (x) => x.category },
          { label: "Yetkazib beruvchi", get: (x) => x.supplier },
          { label: "Import (dona)", get: (x) => x.impQty },
          { label: "Import summasi ($)", get: (x) => Math.round(x.impCost) },
          { label: "Sotilgan (dona)", get: (x) => x.soldQty },
          { label: "Sotilish %", get: (x) => Math.round(x.sellPct) },
          { label: "Qolgan (dona)", get: (x) => x.restQty },
          { label: "Qolgan pul ($)", get: (x) => Math.round(x.restCost) },
          { label: "Foyda ($)", get: (x) => Math.round(x.profit) },
        ]} />

      <div className="card overflow-auto max-h-[70vh]">
        <table className="w-full text-[0.9375rem] whitespace-nowrap">
          <thead className="sticky top-0 z-20">
            <tr className="text-left text-muted text-sm border-b border-line [&>th]:bg-panel">
              <th className="px-5 py-4 font-bold">#</th>
              <SortTh label="Tovar" sortKey="name" sort={sort} onSort={toggle} className="px-5" />
              <SortTh label="Sana" sortKey="date" sort={sort} onSort={toggle} />
              <SortTh label="Yosh" sortKey="age" sort={sort} onSort={toggle} align="right" />
              <SortTh label="Import (dona)" sortKey="impQty" sort={sort} onSort={toggle} align="right" />
              <SortTh label="Sotilgan" sortKey="sellPct" sort={sort} onSort={toggle} align="right" />
              <SortTh label="Qolgan (dona)" sortKey="restQty" sort={sort} onSort={toggle} align="right" />
              <SortTh label="Qolgan pul" sortKey="restCost" sort={sort} onSort={toggle} align="right" />
            </tr>
            <TotalsRow count={shown.length} cells={[
            null,
            null,
            { value: Math.round(tot.impQty).toLocaleString("ru-RU") },
            // Sotilgan % — o'rtacha emas, jami sotilgan ÷ jami import
            { value: tot.impQty > 0 ? `${((tot.soldQty / tot.impQty) * 100).toFixed(0)}%` : "—" },
            { value: Math.round(tot.restQty).toLocaleString("ru-RU") },
            { value: fmtUSD(Math.round(tot.restCost)) },
            ]} />
          </thead>
          <tbody>
            {sortRows(shown).slice(0, 300).map((x, i) => (
              <tr key={`${x.batch}-${x.name}-${i}`} className={`border-b border-line last:border-0 ${i % 2 ? "bg-surface/30" : ""}`}>
                <td className="px-5 py-3.5 font-semibold text-muted tabular-nums">{i + 1}</td>
                <td className="px-5 py-3.5 font-bold max-w-xs truncate" title={x.name}>{x.name}</td>
                <td className="px-3 py-3.5 font-semibold text-muted">{x.date}</td>
                <td className={`px-3 py-3.5 text-right font-semibold ${x.age > 180 ? "text-danger" : x.age > 90 ? "text-warn" : "text-muted"}`}>
                  {x.age}
                </td>
                <td className="px-3 py-3.5 text-right font-semibold">{Math.round(x.impQty).toLocaleString("ru-RU")}</td>
                <td className="px-3 py-3.5 text-right font-semibold text-muted">{x.sellPct.toFixed(0)}%</td>
                <td className="px-3 py-3.5 text-right font-semibold">{Math.round(x.restQty).toLocaleString("ru-RU")}</td>
                <td className="px-3 py-3.5 text-right font-extrabold">{fmtUSD(Math.round(x.restCost))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
