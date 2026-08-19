"use client";
import { t, tt } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { Wallet, Users, Clock, TriangleAlert } from "lucide-react";
import { fmtUSD } from "@/lib/demoData";
import FilterBar, { applyFilters } from "@/components/FilterBar";
import { findColumn } from "@/lib/analyses";
import { numberOf, dateOf, textOf, listDatasets } from "@/lib/datasets";
import NumberField from "@/components/NumberField";
import TotalsRow from "@/components/TotalsRow";

// ══════════════════════════════════════════════════════════════
// QARZDORLAR TAHLILI — MUDDAT MATRITSASI
// ══════════════════════════════════════════════════════════════
// Manba: "Долги клиентов" hisoboti (Остаток долга, Срок погашения).
//
// Har mijoz — bitta qator. Ustunlar — muddat guruhlari: qarzning
// TO'LOV MUDDATIDAN (Срок погашения) necha kun O'TIB KETGANiga qarab.
// Har katak — o'sha mijozning o'sha guruhga tushgan qarzi summasi.
// Oxirgi ustun — jami. Guruh kunlarini foydalanuvchi o'zi o'zgartiradi.
//
// Misol: qarz muddati 25.07 edi, bugun 10.08 — 16 kun o'tgan → "16–20"
// guruhiga tushadi.

const todayStr = () => new Date().toISOString().slice(0, 10);
const overdueDays = (due, today) => Math.floor((new Date(today) - new Date(due)) / 86400000);

export default function DebtorsReport({ analysis, dataset }) {
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({});
  // Uchta chegara — foydalanuvchi o'zgartiradi
  const [cuts, setCuts] = useState([15, 20, 30]);

  const { header, rows, profile: pf } = dataset;
  const today = todayStr();

  const cols = useMemo(() => ({
    client: findColumn(header, ["Клиент", "ФИО клиента"]),
    debt: findColumn(header, ["Остаток долга", "В долг", "Долг"]),
    // Muddat: to'lov muddati; bo'lmasa berish sanasi + izoh
    due: findColumn(header, ["Срок погашения"]),
    created: findColumn(header, ["Дата создания", "Дата"]),
    status: findColumn(header, ["Статус долга"]),
    phone: findColumn(header, ["Контактный номер", "Телефон"]),
    type: findColumn(header, ["Тип транзакции"]),
  }), [header]);

  // To'lov muddati bormi — bo'lmasa berish sanasidan hisoblaymiz
  const dueKey = cols.due || cols.created;
  const byDue = !!cols.due;

  const cleanPhone = (p) => String(p ?? "").replace(/[;\s]+$/, "").trim();

  // Guruh ustunlari: [0..c1], [c1+1..c2], [c2+1..c3], [c3+]
  const bucketDefs = useMemo(() => ([
    { label: `${cuts[0]} kungacha`, tone: "text-warn" },
    { label: `${cuts[0] + 1}–${cuts[1]} kun`, tone: "text-warn" },
    { label: `${cuts[1] + 1}–${cuts[2]} kun`, tone: "text-danger" },
    { label: `${cuts[2]}+ kun`, tone: "text-danger" },
  ]), [cuts]);

  const bucketOf = (days) =>
    days <= cuts[0] ? 0 : days <= cuts[1] ? 1 : days <= cuts[2] ? 2 : 3;

  const FIELDS = useMemo(() =>
    pf.columns.filter((c) => c.filterable).slice(0, 5).map((c) => ({
      key: c.key, type: "select", label: c.label,
      options: c.options.map((o) => ({ value: o, label: o })),
      get: (r) => textOf(r, c.key),
    })), [pf]);

  // —— Mijoz × guruh matritsasi ————————————————————————
  const { debtors, notDueTotal } = useMemo(() => {
    if (!cols.client || !cols.debt) return { debtors: [], notDueTotal: 0 };
    const base = applyFilters(rows, FIELDS, filters);
    const map = new Map();
    let notDue = 0;

    for (const r of base) {
      if (cols.type && /возврат|qaytar|return/i.test(textOf(r, cols.type))) continue;
      const debt = numberOf(r, cols.debt);
      if (debt <= 0) continue;

      const name = textOf(r, cols.client) || "Noma'lum";
      const d = dueKey ? dateOf(r, dueKey) : null;
      const od = d ? overdueDays(d.toISOString().slice(0, 10), today) : null;

      // Muddati kelmagan qarz (od <= 0) — alohida, matritsaga kirmaydi
      if (od != null && od <= 0) { notDue += debt; }

      const cur = map.get(name) ?? {
        name, phone: "", buckets: [0, 0, 0, 0], total: 0, maxOverdue: 0, notDue: 0,
      };
      if (cols.phone && !cur.phone) cur.phone = cleanPhone(r[cols.phone]);
      if (od != null && od > 0) {
        cur.buckets[bucketOf(od)] += debt;
        cur.total += debt;
        cur.maxOverdue = Math.max(cur.maxOverdue, od);
      } else if (od == null) {
        // muddat noma'lum — jamiga qo'shamiz, oxirgi guruhga
        cur.buckets[3] += debt; cur.total += debt;
      } else {
        cur.notDue += debt;
      }
      map.set(name, cur);
    }

    return {
      debtors: [...map.values()].filter((c) => c.total > 0).sort((a, b) => b.total - a.total),
      notDueTotal: notDue,
    };
  }, [rows, FIELDS, filters, cols, cuts, today, dueKey]);

  // —— Yig'ma ————————————————————————————————————
  const totals = useMemo(() => {
    const cols4 = [0, 0, 0, 0];
    let all = 0;
    for (const d of debtors) { d.buckets.forEach((v, i) => (cols4[i] += v)); all += d.total; }
    return { cols4, all, count: debtors.length };
  }, [debtors]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const digits = s.replace(/\D/g, "");
    return debtors.filter((d) => !s || d.name.toLowerCase().includes(s) ||
      (digits && d.phone.replace(/\D/g, "").includes(digits)));
  }, [debtors, q]);

  if (!cols.client || !cols.debt) {
    return (
      <div className="card p-10 text-center">
        <p className="font-extrabold mb-2">{t("Kerakli ustunlar topilmadi")}</p>
        <p className="text-muted font-semibold">{t("Kerak: Клиент va Остаток долга")}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Yig'ma kartalar */}
      <div className="grid grid-cols-4 gap-5 mb-6">
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-10 h-10 rounded-xl bg-danger-soft text-danger flex items-center justify-center">
              <TriangleAlert size={20} />
            </span>
            <p className="text-sm font-bold text-muted">{t("Muddati o'tgan qarz")}</p>
          </div>
          <p className="text-3xl font-extrabold text-danger">{fmtUSD(+totals.all.toFixed(2))}</p>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-10 h-10 rounded-xl bg-brand-soft text-brand flex items-center justify-center">
              <Users size={20} />
            </span>
            <p className="text-sm font-bold text-muted">{t("Muddati o'tgan qarzdorlar")}</p>
          </div>
          <p className="text-3xl font-extrabold">{totals.count}</p>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-10 h-10 rounded-xl bg-ok-soft text-ok flex items-center justify-center">
              <Clock size={20} />
            </span>
            <p className="text-sm font-bold text-muted">{t("Muddati kelmagan")}</p>
          </div>
          <p className="text-3xl font-extrabold">{fmtUSD(+notDueTotal.toFixed(2))}</p>
          <p className="text-sm text-muted font-semibold mt-1">{t("Hali muddati bor")}</p>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-10 h-10 rounded-xl bg-warn-soft text-warn flex items-center justify-center">
              <Wallet size={20} />
            </span>
            <p className="text-sm font-bold text-muted">{t("Jami qarz")}</p>
          </div>
          <p className="text-3xl font-extrabold">{fmtUSD(+(totals.all + notDueTotal).toFixed(2))}</p>
        </div>
      </div>

      {/* Guruh chegaralari */}
      <div className="card p-6 mb-6">
        <p className="font-extrabold mb-1">{t("Muddat guruhlari (kun)")}</p>
        <p className="text-sm text-muted font-semibold mb-4">
          {t(byDue
            ? "Qarzning to'lov muddatidan necha kun o'tgani bo'yicha"
            : "Diqqat: bu faylda to'lov muddati yo'q — berish sanasidan hisoblanmoqda")}
        </p>
        <div className="grid grid-cols-3 gap-5">
          {["Birinchi guruh", "Ikkinchi guruh", "Uchinchi guruh"].map((lbl, i) => (
            <label key={i} className="block">
              <span className="block text-sm font-bold mb-2">{t(lbl)}</span>
              <NumberField value={cuts[i]}
                onChange={(v) => { const next = [...cuts]; next[i] = v; setCuts(next); }} />
            </label>
          ))}
        </div>
      </div>

      <FilterBar
        search={{ value: q, onChange: setQ, placeholder: "Nom yoki telefon bo'yicha qidirish..." }}
        fields={FIELDS} filters={filters} onChange={setFilters}
      />

      <p className="text-sm text-muted font-semibold mb-4">
        {tt("{n} ta muddati o'tgan qarzdor", { n: shown.length })}
      </p>

      {/* Matritsa: mijoz × guruh */}
      <div className="card overflow-auto max-h-[70vh]">
        <table className="w-full text-[0.9375rem] whitespace-nowrap">
          <thead className="sticky top-0 z-20">
            <tr className="text-left text-muted text-sm border-b border-line [&>th]:bg-panel">
              <th className="px-5 py-4 font-bold">#</th>
              <th className="px-4 py-4 font-bold">{t("Mijoz")}</th>
              {bucketDefs.map((b, i) => (
                <th key={i} className={`px-4 py-4 font-bold text-right ${b.tone}`}>{b.label}</th>
              ))}
              <th className="px-5 py-4 font-bold text-right">{t("Jami")}</th>
            </tr>
            <TotalsRow count={shown.length} cells={[
            ...totals.cols4.map((v) => ({ value: fmtUSD(+v.toFixed(2)) })),
            { value: fmtUSD(+totals.all.toFixed(2)), className: "text-danger" },
            ]} />
          </thead>
          <tbody>
            {shown.slice(0, 300).map((d, i) => (
              <tr key={d.name} className="border-b border-line last:border-0 hover:bg-surface/70">
                <td className="px-5 py-3.5 font-semibold text-muted">{i + 1}</td>
                <td className="px-4 py-3.5">
                  <p className="font-bold">{d.name}</p>
                  {d.phone && <p className="text-sm text-muted">{d.phone}</p>}
                </td>
                {d.buckets.map((v, j) => (
                  <td key={j} className={`px-4 py-3.5 text-right font-semibold ${
                    v > 0 ? "" : "text-muted"}`}>
                    {v > 0 ? fmtUSD(+v.toFixed(2)) : "—"}
                  </td>
                ))}
                <td className="px-5 py-3.5 text-right font-extrabold">{fmtUSD(+d.total.toFixed(2))}</td>
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
    </div>
  );
}
