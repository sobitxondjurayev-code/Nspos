"use client";
import { t, tt } from "@/lib/i18n";
import { useMemo, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Rows3, Hash, Wallet, ListFilter } from "lucide-react";
import { fmtUSD } from "@/lib/demoData";
import { useTheme } from "@/components/ThemeProvider";
import FilterBar, { applyFilters } from "@/components/FilterBar";
import StatsStrip from "@/components/StatsStrip";
import { numberOf, dateOf, textOf } from "@/lib/datasets";

// ══════════════════════════════════════════════════════════════
// UNIVERSAL DASHBOARD
// ══════════════════════════════════════════════════════════════
// Bitta komponent istalgan yuklangan hisobotni ko'rsatadi.
//
// Ishlash tartibi: ustunlar turiga qarab (yuklashda aniqlangan)
//   raqamli ustunlar  → ko'rsatkich (nimani yig'amiz)
//   matn ustunlari    → kesim (nima bo'yicha guruhlaymiz) va filtr
//   sana ustuni       → vaqt bo'yicha grafik
//
// Foydalanuvchi kesim va ko'rsatkichni o'zi tanlaydi — shuning uchun
// bitta hisobotdan o'nlab turli qarash olish mumkin. Aynan shu narsa
// Billz'da yo'q: u tayyor jadval beradi, kesimini o'zgartirib bo'lmaydi.

const MONTHS = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"];

const fmtNum = (n) =>
  Math.abs(n) >= 1000 ? n.toLocaleString("ru-RU", { maximumFractionDigits: 0 })
                      : +n.toFixed(2);

export default function DatasetDashboard({ dataset, preset }) {
  const { chart } = useTheme();
  const { rows, profile: pf } = dataset;

  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({});
  // Tahlil o'z sozlamasini bergan bo'lsa shundan boshlanadi —
  // "Sotuvchilar samaradorligi" ochilganda darhol sotuvchi kesimida
  // ko'rinsin, foydalanuvchi qo'lda tanlab o'tirmasin
  // Preset bitta nom yoki nomlar ro'yxati bo'lishi mumkin — faylda
  // qaysi biri bo'lsa o'sha olinadi
  const pick = (want, fallback) => {
    const has = (k) => pf.columns.some((c) => c.key === k);
    for (const w of [].concat(want ?? [])) if (has(w)) return w;
    // Aynan topilmasa — nomi ichida borini qidiramiz
    const norm = (x) => String(x).toLowerCase().replace(/[^a-zа-яё0-9]/gi, "");
    for (const w of [].concat(want ?? [])) {
      const hit = pf.columns.find((c) => norm(c.key).includes(norm(w)));
      if (hit) return hit.key;
    }
    return fallback;
  };
  const [dim, setDim] = useState(() =>
    pick(preset?.dim, pf.dateColumn ?? pf.labelColumn ?? pf.columns[0]?.key));
  const [measure, setMeasure] = useState(() =>
    pick(preset?.measure, pf.moneyColumns[0] ?? pf.numberColumns[0] ?? null));
  const [grain, setGrain] = useState("month");   // sana kesimida

  // —— Filtr maydonlari: ustun turidan yig'iladi ————————
  const FIELDS = useMemo(() => {
    const out = [];
    for (const c of pf.columns) {
      if (c.type === "date") {
        out.push({ key: c.key, type: "dateRange", label: c.label, get: (r) => r[c.key] });
      } else if (c.filterable) {
        out.push({
          key: c.key, type: "select", label: c.label,
          options: c.options.map((o) => ({ value: o, label: o })),
          get: (r) => textOf(r, c.key),
        });
      } else if (c.type === "ident") {
        out.push({ key: c.key, type: "text", label: c.label, get: (r) => textOf(r, c.key) });
      } else if (c.type === "money" || c.type === "number") {
        out.push({ key: c.key, type: "range", label: c.label, get: (r) => numberOf(r, c.key) });
      }
    }
    // Panel juda uzun bo'lmasin — eng foydalilari oldinda
    return out.slice(0, 9);
  }, [pf]);

  const shown = useMemo(() => {
    let list = applyFilters(rows, FIELDS, filters);
    const s = q.trim().toLowerCase();
    if (s) list = list.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(s)));
    return list;
  }, [rows, FIELDS, filters, q]);

  // —— Yig'ma kartalar ————————————————————————————
  const stats = useMemo(() => {
    const cards = [
      { label: "Qatorlar", icon: Rows3, value: shown.length.toLocaleString("ru-RU"), unit: "ta" },
    ];
    for (const key of [...pf.moneyColumns, ...pf.numberColumns].slice(0, 3)) {
      const sum = shown.reduce((a, r) => a + numberOf(r, key), 0);
      const isMoney = pf.moneyColumns.includes(key);
      cards.push({
        label: key, icon: isMoney ? Wallet : Hash,
        tone: isMoney ? "bg-ok-soft text-ok" : undefined,
        value: isMoney ? fmtUSD(+sum.toFixed(2)) : fmtNum(sum),
      });
    }
    return cards.slice(0, 4);
  }, [shown, pf]);

  // —— Guruhlash ————————————————————————————————
  const dimCol = pf.columns.find((c) => c.key === dim);
  const byDate = dimCol?.type === "date";

  const grouped = useMemo(() => {
    if (!dim) return [];
    const map = new Map();

    for (const r of shown) {
      let label;
      if (byDate) {
        const d = dateOf(r, dim);
        if (!d) continue;
        label = grain === "day"
          ? `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`
          : grain === "month" ? `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
          : String(d.getFullYear());
      } else {
        label = textOf(r, dim) || "—";
      }
      const cur = map.get(label) ?? { label, value: 0, count: 0, sort: 0 };
      cur.value += measure ? numberOf(r, measure) : 1;
      cur.count += 1;
      if (byDate) cur.sort = dateOf(r, dim)?.getTime() ?? 0;
      map.set(label, cur);
    }

    const list = [...map.values()];
    // Sana bo'yicha — vaqt tartibida; aks holda kattadan kichikka
    return byDate ? list.sort((a, b) => a.sort - b.sort)
                  : list.sort((a, b) => b.value - a.value);
  }, [shown, dim, measure, byDate, grain]);

  const chartData = byDate ? grouped : grouped.slice(0, 15);
  const isMoney = measure && pf.moneyColumns.includes(measure);
  const fmtVal = (v) => (isMoney ? fmtUSD(+v.toFixed(2)) : fmtNum(v));
  const total = grouped.reduce((a, g) => a + g.value, 0);

  return (
    <div>
      <StatsStrip items={stats} filtered={shown.length !== rows.length} />

      <FilterBar
        search={{ value: q, onChange: setQ, placeholder: "Barcha ustunlar bo'yicha qidirish..." }}
        fields={FIELDS} filters={filters} onChange={setFilters}
      />

      {/* Kesim va ko'rsatkich tanlash */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <ListFilter size={18} className="text-brand" />
          <h2 className="font-extrabold">{t("Kesim va ko'rsatkich")}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <label className="block">
            <span className="block text-sm font-bold mb-2">{t("Nima bo'yicha guruhlash")}</span>
            <select className="inp" value={dim ?? ""} onChange={(e) => setDim(e.target.value)}>
              {pf.columns.filter((c) => c.type === "text" || c.type === "date" || c.type === "ident")
                .map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="block text-sm font-bold mb-2">{t("Nimani hisoblash")}</span>
            <select className="inp" value={measure ?? ""} onChange={(e) => setMeasure(e.target.value || null)}>
              <option value="">{t("Qatorlar soni")}</option>
              {[...pf.moneyColumns, ...pf.numberColumns]
                .map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>

          {byDate && (
            <label className="block">
              <span className="block text-sm font-bold mb-2">{t("Bo'linish")}</span>
              <select className="inp" value={grain} onChange={(e) => setGrain(e.target.value)}>
                <option value="day">{t("Kunlab")}</option>
                <option value="month">{t("Oylab")}</option>
                <option value="year">{t("Yillab")}</option>
              </select>
            </label>
          )}
        </div>
      </div>

      {/* Grafik */}
      {grouped.length > 0 && (
        <div className="card p-7 mb-6">
          <h2 className="text-2xl font-extrabold mb-1">
            {measure || t("Qatorlar soni")}
          </h2>
          <p className="text-sm text-muted font-semibold mb-5">
            {dim} {t("kesimida")}
            {!byDate && grouped.length > 15 && ` · ${tt("eng katta {n} ta", { n: 15 })}`}
          </p>
          <div className="h-[21.25rem]">
            <ResponsiveContainer width="100%" height="100%">
              {byDate ? (
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="0" stroke={chart.grid} vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false}
                    tick={{ fill: chart.tick, fontSize: 13, fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} width={80} tickFormatter={fmtVal}
                    tick={{ fill: chart.tick, fontSize: 13, fontWeight: 600 }} />
                  <Tooltip formatter={fmtVal}
                    contentStyle={{ borderRadius: 14, border: "none", fontWeight: 700 }} />
                  <Line type="monotone" dataKey="value" stroke={chart.brand} strokeWidth={3.5} dot={false} />
                </LineChart>
              ) : (
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="0" stroke={chart.grid} vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} interval={0}
                    angle={-25} textAnchor="end" height={90}
                    tick={{ fill: chart.tick, fontSize: 12, fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} width={80} tickFormatter={fmtVal}
                    tick={{ fill: chart.tick, fontSize: 13, fontWeight: 600 }} />
                  <Tooltip formatter={fmtVal} cursor={{ fill: "transparent" }}
                    contentStyle={{ borderRadius: 14, border: "none", fontWeight: 700 }} />
                  <Bar dataKey="value" fill={chart.brand} radius={[8, 8, 0, 0]} maxBarSize={48} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Guruhlangan jadval */}
      <div className="card overflow-auto max-h-[70vh]">
        <table className="w-full text-[0.9375rem]">
          <thead>
            <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-20 text-left text-muted text-sm border-b border-line [&>th]:bg-panel">
              <th className="px-6 py-4 font-bold sticky left-0 bg-panel z-30">{dim}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Qatorlar")}</th>
              <th className="px-4 py-4 font-bold text-right">{measure || t("Soni")}</th>
              <th className="px-6 py-4 font-bold text-right">{t("Ulushi")}</th>
            </tr>
          </thead>
          <tbody>
            {grouped.slice(0, 200).map((g) => (
              <tr key={g.label} className="border-b border-line last:border-0 hover:bg-surface/70">
                <td className="px-6 py-3.5 font-bold sticky left-0 bg-panel z-10">{g.label}</td>
                <td className="px-4 py-3.5 text-right font-semibold text-muted">{g.count}</td>
                <td className="px-4 py-3.5 text-right font-extrabold">{fmtVal(g.value)}</td>
                <td className="px-6 py-3.5 text-right font-semibold text-muted">
                  {total > 0 ? ((g.value / total) * 100).toFixed(1) : 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {grouped.length > 200 && (
          <p className="px-6 py-4 text-sm text-muted font-semibold border-t border-line">
            {tt("Yana {n} qator — filtr bilan toraytiring", { n: grouped.length - 200 })}
          </p>
        )}
      </div>
    </div>
  );
}
