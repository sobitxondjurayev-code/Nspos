"use client";
// ══════════════════════════════════════════════════════════════
// KASSA OPERATSIYALARI — pul harakati jurnali
// ══════════════════════════════════════════════════════════════
// Bitta joyda BARCHA pul harakati: kassa kirim-chiqimlari, rahbarga
// o'tkazmalar va xarajatlar. Kassalar sahifasidagi ro'yxat qisqa va
// kassaga bog'langan, bu yerda esa to'liq tarix — davr, filtr va jami
// bilan.
//
// Ilgari bu sahifa alohida `cash_operations` jadvalidan o'qirdi — u
// hech qachon to'ldirilmagan va balansga ta'sir qilmasdi, ya'ni ekranda
// bo'sh jurnal turardi. Endi manba bitta: kassa jurnali + xarajatlar.
import { t, tt } from "@/lib/i18n";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays, ArrowDownLeft, ArrowUpRight, Send, SlidersHorizontal, ChevronRight,
} from "lucide-react";
import { fmtUSD } from "@/lib/demoData";
import { PERIODS, periodRange, fmtDate } from "@/lib/dates";
import DateRangePicker from "@/components/DateRangePicker";
import StatCard from "@/components/finance/StatCard";
import ColumnSettings from "@/components/ColumnSettings";
import { useColumns } from "@/components/useColumns";
import { useAuth } from "@/components/AuthProvider";
import { useLive } from "@/components/DataProvider";
import {
  KASSAS, WALLETS, listOps, kassasOf, kassaIds, categoryLabel, COMPANY,
} from "@/lib/kassaData";
import {
  expensesInRange, categoryLabel as expenseCategoryLabel, somOf,
} from "@/lib/expensesData";
import { getStaff } from "@/lib/staffData";
import { getUsdRate } from "@/lib/companyData";

const fmtDay = (d) => {
  const [y, m, dd] = String(d).slice(0, 10).split("-");
  return `${dd}.${m}.${y}`;
};

const KINDS = {
  in: { label: "Kirim", cls: "bg-ok-soft text-ok" },
  out: { label: "Chiqim", cls: "bg-danger-soft text-danger" },
  transfer: { label: "Rahbarga o'tkazma", cls: "bg-brand-soft text-brand" },
};

export default function FinanceOperations() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const visible = useMemo(() => (isOwner ? kassaIds() : kassasOf(user)), [user, isOwner]);

  const [period, setPeriod] = useState("Oy");
  const [range, setRange] = useState(() => periodRange("Oy"));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [fKassa, setFKassa] = useState("all");
  const [fWallet, setFWallet] = useState("all");
  const [fKind, setFKind] = useState("all");
  // Boshqa xodim yozgan o'zgarish ham darrov ko'rinsin
  const live = useLive();

  // —— Jurnal: kassa yozuvlari + xarajatlar ————————————
  // Xarajat ham pul harakati: u kassadan chiqadi, faqat boshqa
  // modulda saqlanadi. Rahbar uchun ikkalasi bitta ro'yxat.
  const rows = useMemo(() => {
    const ops = listOps(range.from, range.to)
      .filter((o) => visible.includes(o.kassa))
      .map((o) => ({
        id: o.id, date: o.date, kassa: o.kassa, wallet: o.wallet,
        kind: o.kind, status: o.status,
        title: o.kind === "transfer" ? t("Rahbarga o'tkazma") : t(categoryLabel(o.category)),
        note: o.note, staffId: o.staffId,
        amount: o.amount, som: o.amountSom ?? null,
      }));

    const exp = expensesInRange(range.from, range.to)
      .filter((e) => visible.includes(e.kassa))
      .map((e) => ({
        id: "exp-" + e.id, date: e.date, kassa: e.kassa, wallet: e.method,
        kind: "out", status: null,
        title: t(expenseCategoryLabel(e.category)),
        note: e.note, staffId: e.staffId,
        amount: e.amount, som: somOf(e),
      }));

    return [...ops, ...exp].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [range, visible.join(), live]);

  const shown = useMemo(() => rows.filter((r) => {
    if (fKassa !== "all" && r.kassa !== fKassa) return false;
    if (fWallet !== "all" && r.wallet !== fWallet) return false;
    if (fKind !== "all" && r.kind !== fKind) return false;
    return true;
  }), [rows, fKassa, fWallet, fKind]);

  const hasFilter = [fKassa, fWallet, fKind].some((v) => v !== "all");
  const clearFilters = () => { setFKassa("all"); setFWallet("all"); setFKind("all"); };

  // O'tkazma pulni kompaniyaga ko'chiradi, yangi pul emas — kirim va
  // chiqim yig'indisiga qo'shilmaydi.
  const totalIn = +shown.filter((r) => r.kind === "in").reduce((a, r) => a + r.amount, 0).toFixed(2);
  const totalOut = +shown.filter((r) => r.kind === "out").reduce((a, r) => a + r.amount, 0).toFixed(2);
  const rate = getUsdRate();

  const ALL_COLS = useMemo(() => [
    { key: "date", label: "Sana",
      cell: (r) => <span className="font-semibold whitespace-nowrap">{fmtDay(r.date)}</span> },
    { key: "kind", label: "Turi",
      cell: (r) => (
        <div>
          <span className={`text-sm font-bold px-3 py-1 rounded-lg whitespace-nowrap ${KINDS[r.kind].cls}`}>
            {t(KINDS[r.kind].label)}
          </span>
          {r.kind === "transfer" && r.status && (
            <span className={`block text-sm font-bold mt-1 ${
              r.status === "approved" ? "text-ok" : r.status === "rejected" ? "text-danger" : "text-warn"}`}>
              {t(r.status === "approved" ? "Tasdiqlangan" : r.status === "rejected" ? "Rad etilgan" : "Kutilmoqda")}
            </span>
          )}
        </div>
      ) },
    { key: "title", label: "Nima uchun",
      cell: (r) => (
        <>
          <p className="font-bold">{r.title}</p>
          {r.note && <p className="text-sm text-muted">{r.note}</p>}
        </>
      ) },
    { key: "kassa", label: "Kassa",
      cell: (r) => (
        <span className="font-semibold whitespace-nowrap">
          {t(KASSAS[r.kassa]?.label ?? r.kassa)}
        </span>
      ) },
    { key: "wallet", label: "Hamyon",
      cell: (r) => (
        <span className="bg-brand-soft text-brand text-sm font-bold px-3 py-1 rounded-lg">
          {t(WALLETS[r.wallet] ?? r.wallet)}
        </span>
      ) },
    { key: "who", label: "Kim",
      cell: (r) => (
        <span className="font-semibold text-muted">
          {r.staffId ? (getStaff(r.staffId)?.name ?? "—") : "—"}
        </span>
      ) },
    { key: "amount", label: "Summa", right: true,
      cell: (r) => (
        <div className="whitespace-nowrap">
          <p className={`font-extrabold ${r.kind === "in" ? "text-ok" : r.kind === "out" ? "text-danger" : ""}`}>
            {r.kind === "in" ? "+" : r.kind === "out" ? "−" : ""}{fmtUSD(r.amount)}
          </p>
          {(r.som != null || rate) && (
            <p className="text-sm text-muted font-semibold">
              {Math.round(r.som ?? r.amount * rate).toLocaleString("ru-RU")} {t("so'm")}
            </p>
          )}
        </div>
      ) },
  ], [rate]);

  const colPrefs = useColumns("operations-journal", ALL_COLS, { locked: ["date"] });
  const cols = colPrefs.columns;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <h1 className="text-4xl font-extrabold tracking-tight">{t("Kassa operatsiyalari")}</h1>
        <Link href="/finance/kassa"
          className="flex items-center gap-2 rounded-xl border border-line px-4 py-3 font-bold hover:border-brand hover:text-brand transition-colors">
          {t("Kassalar va balans")} <ChevronRight size={18} />
        </Link>
      </div>
      <p className="text-muted font-semibold mb-7 max-w-3xl">
        {t("Barcha pul harakati bitta ro'yxatda: kassa kirim-chiqimi, rahbarga o'tkazmalar va xarajatlar. Yangi yozuv Kassalar bo'limida yoki Xarajatlarda kiritiladi.")}
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        <StatCard icon={ArrowDownLeft} label="Kirim" tone="green" value={fmtUSD(totalIn)} />
        <StatCard icon={ArrowUpRight} label="Chiqim" tone="red" value={fmtUSD(totalOut)} />
        <StatCard icon={Send} label="Yozuvlar" value={String(shown.length)}
          hint={t("Tanlangan davr va filtr bo'yicha")} />
      </div>

      {/* Filtr */}
      <div className="card p-5 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="block">
            <span className="block text-sm font-bold mb-2">{t("Kassa")}</span>
            <select className="inp" value={fKassa} onChange={(e) => setFKassa(e.target.value)}>
              <option value="all">{t("Barchasi")}</option>
              {visible.map((k) => (
                <option key={k} value={k}>{t(KASSAS[k]?.label ?? k)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-bold mb-2">{t("Hamyon")}</span>
            <select className="inp" value={fWallet} onChange={(e) => setFWallet(e.target.value)}>
              <option value="all">{t("Barchasi")}</option>
              {Object.entries(WALLETS).map(([k, lbl]) => (
                <option key={k} value={k}>{t(lbl)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-bold mb-2">{t("Turi")}</span>
            <select className="inp" value={fKind} onChange={(e) => setFKind(e.target.value)}>
              <option value="all">{t("Barchasi")}</option>
              {Object.entries(KINDS).map(([k, v]) => (
                <option key={k} value={k}>{t(v.label)}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-4 mt-4">
          {hasFilter && (
            <button onClick={clearFilters} className="text-sm font-bold text-brand hover:underline">
              {t("Filtrni tozalash")}
            </button>
          )}
          <button onClick={colPrefs.openSettings}
            className="ml-auto flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm font-bold hover:border-brand hover:text-brand transition-colors">
            <SlidersHorizontal size={16} /> {t("Ustunlar")}
          </button>
        </div>
      </div>

      <div className="card overflow-auto max-h-[70vh]">
        <table className="w-full text-[0.9375rem]">
          {/* Sarlavha + "Jami" birga tepada yopishib turadi */}
          <thead className="bg-surface text-left text-sm sticky top-0 z-20">
            <tr className="border-b border-line [&>th]:bg-surface">
              {cols.map((c) => (
                <th key={c.key} className={`px-4 py-4 font-bold ${c.right ? "text-right" : ""}`}>
                  {t(c.label)}
                </th>
              ))}
            </tr>
            {/* JAMI — har ustun uchun ALOHIDA katak. Ilgari
                `colSpan={cols.length - 1}` bilan summa OXIRGI katakka
                qo'yilgan edi, lekin "Ustunlar" tugmasi ustunni surish va
                yashirishga ruxsat beradi — Summa ko'chirilishi bilan jami
                boshqa ustun ostida qolardi. Naqsh:
                finance/plan/page.jsx:126 */}
            <tr className="bg-surface border-b-2 border-line">
              {cols.map((c, i) => (
                <th key={c.key}
                  className={`px-4 py-4 whitespace-nowrap ${c.right ? "text-right" : "text-left"}`}>
                  {i === 0 && (
                    <>
                      <span className="font-extrabold">{t("Jami")}</span>
                      <span className="ml-2 text-sm font-bold text-muted">
                        {tt("{n} ta yozuv", { n: shown.length })}
                      </span>
                    </>
                  )}
                  {c.key === "amount" && (
                    <>
                      <span className="text-ok font-extrabold">+{fmtUSD(totalIn)}</span>
                      <span className="block text-danger font-extrabold">−{fmtUSD(totalOut)}</span>
                    </>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0 hover:bg-surface/60">
                {cols.map((c) => (
                  <td key={c.key} className={`px-4 py-4 align-top ${c.right ? "text-right" : ""}`}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={cols.length} className="px-4 py-12 text-center text-muted font-semibold">
                {hasFilter
                  ? t("Bu filtrga mos yozuv yo'q")
                  : t("Bu davrda pul harakati bo'lmagan")}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {colPrefs.open && <ColumnSettings {...colPrefs.dialogProps} />}
    </div>
  );
}
