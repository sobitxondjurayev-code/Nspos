"use client";
import { t, tt } from "@/lib/i18n";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays, Plus, Wallet, Lock, Waves, Percent, Repeat, Trash2, Pencil,
  SlidersHorizontal, Coins,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { demoStores, fmtUSD } from "@/lib/demoData";
import { PERIODS, periodRange, fmtDate } from "@/lib/dates";
import DateRangePicker from "@/components/DateRangePicker";
import { useTheme } from "@/components/ThemeProvider";
import ExpenseModal from "@/components/ExpenseModal";
import StatCard from "@/components/finance/StatCard";
import { useAuth } from "@/components/AuthProvider";
import { useLive } from "@/components/DataProvider";
import { kassasOf } from "@/lib/kassaData";
import { storeTotalsInRange } from "@/lib/salesData";
import {
  EXPENSE_CATEGORIES, categoryLabel, methodLabel, STREET_INSTALLER,
  expensesInRange, expensesByCategory, expensesByStore, expenseStructure,
  expenseSeries, monthlyFixedRunRate,
  listRecurring, addRecurring, removeRecurring, updateRecurring,
  addExpense, removeExpense, updateExpense, somOf, monthlyFixedRunRateSom,
} from "@/lib/expensesData";
import { getStaff } from "@/lib/staffData";
import ColumnSettings from "@/components/ColumnSettings";
import { useColumns } from "@/components/useColumns";
import { getUsdRate } from "@/lib/companyData";
import RateModal from "@/components/RateModal";

// Xarajatlar bo'limi so'mda ko'rsatiladi — pul shu valyutada chiqadi va
// shu valyutada kiritiladi. Boshqa hisobotlar (P&L, balans, tushumga
// nisbat) dollarda qolaveradi: ular savdo bilan solishtiriladi.
// Kurs bo'lmasa dollarga qaytamiz — yolg'on raqam ko'rsatmaymiz.
const fmtSom = (som) => Math.round(som).toLocaleString("ru-RU") + " so'm";

// Rahbar buni "doimiy xarajat" deydi — har oy o'zi takrorlanadigan
// ijara, internet, soliq. Bo'lim nomi ham o'sha so'z bilan.
const TABS = ["Xarajatlar ro'yxati", "Doimiy xarajatlar"];
const fmtDay = (s) => s.split("-").reverse().join(".");
const storeName = (id) => demoStores.find((s) => s.id === id)?.name ?? null;

export default function FinanceExpenses() {
  const { chart } = useTheme();
  const { user } = useAuth();
  // Menejer faqat O'Z kassasining xarajatini ko'radi va kiritadi.
  // Rahbarning shaxsiy xarajati yoki boshqa do'kon raqami unga ochilmasin.
  const isOwner = user?.role === "owner";
  const myKassas = useMemo(() => kassasOf(user), [user]);
  const mineOnly = (list) => isOwner ? list : list.filter((e) => myKassas.includes(e.kassa));
  const [period, setPeriod] = useState("Yil");
  const [range, setRange] = useState(() => periodRange("Yil"));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tab, setTab] = useState(TABS[0]);
  const [modal, setModal] = useState(null); // null | {} | {initial}
  // Kurs oynasi. `then: "expense"` — kurs yozilgach darrov xarajat
  // oynasi ochiladi (birinchi xarajatda kurs majburiy).
  const [rateModal, setRateModal] = useState(null);
  // Kurs brauzer xotirasidan tiklanadi — serverda u yo'q. Chipni faqat
  // chizilgandan keyin ko'rsatamiz, aks holda server bilan mos kelmay
  // gidratsiya xatosi chiqadi.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [tick, setTick] = useState(0);
  // Boshqa xodim yozgan o'zgarish ham darrov ko'rinsin
  const live = useLive();
  const bump = () => setTick((v) => v + 1);

  const rows = useMemo(
    () => mineOnly(expensesInRange(range.from, range.to)), [range, tick, isOwner, myKassas.join(), live]);
  const byCat = useMemo(() => expensesByCategory(range.from, range.to), [range, tick, live]);
  const byStore = useMemo(() => expensesByStore(range.from, range.to), [range, tick, live]);
  const struct = useMemo(() => expenseStructure(range.from, range.to), [range, tick, live]);
  const series = useMemo(() => expenseSeries(range.from, range.to), [range, tick, live]);
  const recur = useMemo(() => mineOnly(listRecurring()), [tick, isOwner, myKassas.join(), live]);

  const revenue = useMemo(() => {
    const totals = storeTotalsInRange(range.from, range.to);
    return +Object.values(totals).reduce((a, v) => a + v, 0).toFixed(2);
  }, [range]);

  // —— Ro'yxat filtri ————————————————————————————————
  // Tanlovlar davr ichida haqiqatda uchragan qiymatlardan yig'iladi:
  // bo'sh variantlar ko'rsatilmaydi ("Soliq" tanlab, hech narsa
  // chiqmasligi chalkashtiradi).
  const [fCat, setFCat] = useState("all");
  const [fStore, setFStore] = useState("all");
  const [fMethod, setFMethod] = useState("all");
  const [fStaff, setFStaff] = useState("all");
  const [fBy, setFBy] = useState("all");

  const uniq = (list) => [...new Set(list.filter(Boolean))];
  const catOptions = useMemo(() => uniq(rows.map((e) => e.category)), [rows]);
  const methodOptions = useMemo(() => uniq(rows.map((e) => e.method)), [rows]);
  const staffOptions = useMemo(() => uniq(rows.map((e) => e.staffId)), [rows]);
  // Ko'cha ustasi xodim emas — filtrda alohida variant
  const hasStreet = useMemo(() => rows.some((e) => e.paidTo), [rows]);
  const byOptions = useMemo(() => uniq(rows.map((e) => e.createdBy)), [rows]);

  const hasFilter = [fCat, fStore, fMethod, fStaff, fBy].some((v) => v !== "all");
  const clearFilters = () => {
    setFCat("all"); setFStore("all"); setFMethod("all"); setFStaff("all"); setFBy("all");
  };

  const shown = useMemo(() => rows.filter((e) => {
    if (fCat !== "all" && e.category !== fCat) return false;
    // "Umumkorxona" — do'konga biriktirilmagan xarajat
    if (fStore === "all-company" ? (e.storeId && e.storeId !== "all") : false) return false;
    if (fStore !== "all" && fStore !== "all-company" && e.storeId !== fStore) return false;
    if (fMethod !== "all" && e.method !== fMethod) return false;
    if (fStaff === "none" && (e.staffId || e.paidTo)) return false;
    if (fStaff === "street" && !e.paidTo) return false;
    if (fStaff !== "all" && fStaff !== "none" && fStaff !== "street" && e.staffId !== fStaff) return false;
    if (fBy !== "all" && e.createdBy !== fBy) return false;
    return true;
  }), [rows, fCat, fStore, fMethod, fStaff, fBy]);

  // Jami — ko'rinib turgan qatorlar bo'yicha, filtr bilan birga o'zgaradi
  const shownSom = useMemo(
    () => shown.reduce((a, e) => a + somOf(e), 0), [shown]);


  const ofRevenue = revenue > 0 ? +((struct.total / revenue) * 100).toFixed(1) : 0;
  const runRate = monthlyFixedRunRate();

  // Kurs bor bo'lsa hamma summa so'mda, aks holda avvalgidek dollarda
  const inSom = !!getUsdRate();
  const money = (usd, som) => (inSom ? fmtSom(som) : fmtUSD(usd));

  // —— Ustunlar ————————————————————————————————————
  // Har ustun o'z katagini o'zi chizadi — shunda tartibini almashtirish
  // yoki yashirish jadval mantiqiga tegmaydi (Meta Ads Manager naqshi).
  const ALL_EXP_COLS = useMemo(() => [
    {
      key: "category", label: "Kategoriya",
      cell: (e) => (
        <>
          <p className="font-bold">
            {t(categoryLabel(e.category))}
            {e.source === "recurring" && <Repeat size={14} className="inline ml-2 text-brand" />}
          </p>
          {/* Usta biriktirilgan bo'lsa, turi ostida ismi turadi */}
          {(e.staffId || e.paidTo) && (
            <p className="text-sm font-bold text-brand">
              {e.staffId ? (getStaff(e.staffId)?.name ?? "—") : e.paidTo}
            </p>
          )}
          {e.note && <p className="text-sm text-muted">{e.note}</p>}
        </>
      ),
    },
    { key: "date", label: "Sana",
      cell: (e) => <span className="font-semibold text-muted">{fmtDay(e.date)}</span> },
    { key: "store", label: "Do'kon",
      cell: (e) => (
        <span className="font-semibold">
          {storeName(e.storeId) ?? <span className="text-muted">{t("Umumkorxona")}</span>}
        </span>
      ) },
    { key: "method", label: "Kassa",
      cell: (e) => (
        <span className="bg-brand-soft text-brand text-sm font-bold px-3 py-1 rounded-lg">
          {t(methodLabel(e.method))}
        </span>
      ) },
    { key: "staff", label: "Kimga",
      cell: (e) => (
        <span className="font-semibold text-muted">
          {e.staffId ? (getStaff(e.staffId)?.name ?? "—") : (e.paidTo || "—")}
        </span>
      ) },
    // Kim kiritgani hisobdan olinadi — menejer hech narsa tanlamaydi
    { key: "by", label: "Kim kiritdi",
      cell: (e) => (
        <span className="font-semibold text-muted">
          {e.createdBy ? (getStaff(e.createdBy)?.name ?? "—") : "—"}
        </span>
      ) },
    { key: "amount", label: "Summa", right: true,
      cell: (e) => (
        <span className="font-extrabold text-danger">−{money(e.amount, somOf(e))}</span>
      ) },
  ], [inSom]);

  // "Kategoriya" yashirilmaydi: usiz qator nima ekani bilinmaydi
  const colPrefs = useColumns("expenses-list", ALL_EXP_COLS, { locked: ["category"] });
  const expCols = colPrefs.columns;

  function save({ kind, data }) {
    if (modal?.initial) {
      // Tahrirlash: yozuv o'sha id bilan yangilanadi. Ilgari bir
      // martaligi o'chirilib qaytadan qo'shilardi — bazada o'chirish va
      // yozish ketma-ket ketib, id ham almashardi.
      if (modal.initial.from) updateRecurring(modal.initial.id, data);
      else updateExpense(modal.initial.id, data);
    } else if (kind === "recurring") {
      addRecurring(data);
      // Doimiy xarajat ro'yxatga darrov ko'rinsin: u kunlik ro'yxatda
      // faqat o'z to'lov kuniga tushadi va rahbar "yo'qolib qoldi" deb
      // o'ylaydi. Shuning uchun qo'shilgach o'sha bo'limga o'tkazamiz.
      setTab(TABS[1]);
    } else addExpense(data);
    setModal(null);
    bump();
  }

  // Xarajat so'mda kiritiladi va dollarga o'giriladi — kurssiz uni
  // saqlab bo'lmaydi. Shuning uchun kurs yo'q bo'lsa avval o'sha
  // so'raladi, keyin xarajat oynasi ochiladi.
  function newExpense(initial = null) {
    if (!getUsdRate()) { setRateModal({ then: "expense" }); return; }
    setModal(initial ? { initial } : {});
  }

  function del(e) {
    if (!confirm(t("Ushbu xarajat o'chirilsinmi?"))) return;
    if (e.source === "recurring") removeRecurring(e.recurringId);
    else removeExpense(e.id);
    bump();
  }

  const empty = rows.length === 0 && recur.length === 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h1 className="text-4xl font-extrabold tracking-tight">{t("Xarajatlar")}</h1>
        <div className="flex items-center gap-3">
          {/* Kurs doim ko'z oldida: xarajat so'mda kiritilib shu kurs
              bilan dollarga o'giriladi. Kun davomida o'zgarsa —
              bir bosishda yangilanadi. */}
          {mounted && (
            <button onClick={() => setRateModal({})}
              className="flex items-center gap-2 rounded-xl border border-line px-4 py-3 font-bold hover:border-brand hover:text-brand transition-colors">
              <Coins size={17} className="text-brand" />
              {inSom
                ? tt("Kurs {n} so'm", { n: Math.round(getUsdRate()).toLocaleString("ru-RU") })
                : t("Kursni yozish")}
            </button>
          )}
        <button onClick={() => newExpense()}
          className="flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-5 py-3">
          <Plus size={20} /> {t("Yangi xarajat")}
        </button>
        </div>
      </div>
      <p className="text-muted font-semibold mb-7">
        {t("Ijara, kommunal, transport, soliq va boshqa operatsion xarajatlar. Bu yerdagi raqamlar P&L'ning sof foydasiga to'g'ridan-to'g'ri ta'sir qiladi.")}
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

      {empty ? (
        <div className="card p-10 text-center">
          <Wallet size={40} className="mx-auto text-muted mb-4" />
          <p className="text-xl font-extrabold mb-2">{t("Xarajat hali kiritilmagan")}</p>
          <p className="text-muted font-semibold max-w-xl mx-auto">
            {t("Billz xarajat yuritmaydi, shuning uchun bu raqamlar faqat qo'lda kiritiladi. Ijara va internet kabi har oy takrorlanadiganini bir marta kiritsangiz kifoya — tizim har oyga o'zi yoyadi.")}
          </p>
          <button onClick={() => setModal({})}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-6 py-3">
            <Plus size={20} /> {t("Birinchi xarajatni kiritish")}
          </button>
        </div>
      ) : (
        <>
          {/* Kompaniya kesimidagi tahlil — faqat rahbarga. Menejerga
              o'z ro'yxati yetarli, umumiy raqamlar uning ishi emas. */}
          {isOwner && (
          <>
          <div className="grid grid-cols-5 gap-5 mb-7">
            <StatCard icon={Wallet} label="Jami xarajat" tone="red" value={money(struct.total, struct.totalSom)}
              hint={tt("{n} ta yozuv", { n: rows.length })} />
            <StatCard icon={Lock} label="Doimiy xarajat" value={money(struct.fixed, struct.fixedSom)}
              hint={tt("Jamidan {n}%", { n: struct.fixedPct })} />
            <StatCard icon={Waves} label="O'zgaruvchan" tone="amber" value={money(struct.variable, struct.variableSom)} />
            {/* Tushum dollarda — nisbat ham dollarda solishtiriladi */}
            <StatCard icon={Percent} label="Tushumga nisbatan" tone={ofRevenue > 25 ? "red" : "green"}
              value={ofRevenue + "%"} hint={tt("Tushum {n}", { n: fmtUSD(revenue) })} />
            <StatCard icon={Repeat} label="Oylik doimiy yuk" value={money(runRate, monthlyFixedRunRateSom())}
              hint={t("Sotuv bo'lmasa ham to'lanadi")} />
          </div>

          {/* Oylik dinamika */}
          <div className="card p-7 mb-7">
            <h2 className="text-2xl font-extrabold mb-5">{t("Oylik xarajat dinamikasi")}</h2>
            <div className="h-[18.75rem]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="0" stroke={chart.grid} vertical={false} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false}
                    tick={{ fill: chart.tick, fontSize: 13, fontWeight: 600 }} />
                  {/* So'mda millionlar chiqadi — o'qda qisqartirib beramiz */}
                  <YAxis axisLine={false} tickLine={false} width={inSom ? 86 : 70}
                    tickFormatter={(v) => (inSom ? (v / 1e6).toFixed(1) + " mln" : fmtUSD(v))}
                    tick={{ fill: chart.tick, fontSize: 13, fontWeight: 600 }} />
                  <Tooltip formatter={(v) => (inSom ? fmtSom(v) : fmtUSD(v))}
                    contentStyle={{ borderRadius: 14, border: "none", fontWeight: 700 }} />
                  <Legend wrapperStyle={{ fontWeight: 700, fontSize: 13 }} />
                  {/* name — ustunning o'qiladigan nomi. Berilmasa Recharts
                      dataKey'ni ko'rsatadi va izohda "fixedSom" chiqadi.
                      Legend ham shu nomni oladi, alohida formatter kerak emas. */}
                  <Bar name={t("Doimiy")} dataKey={inSom ? "fixedSom" : "fixed"}
                    stackId="a" fill={chart.brand} radius={[0, 0, 0, 0]} />
                  <Bar name={t("O'zgaruvchan")} dataKey={inSom ? "variableSom" : "variable"}
                    stackId="a" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-7">
            {/* Kategoriya kesimi */}
            <div className="card p-7">
              <h2 className="text-2xl font-extrabold mb-5">{t("Kategoriya kesimida")}</h2>
              <div className="space-y-4">
                {byCat.map((c) => (
                  <div key={c.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold">
                        {t(c.label)}
                        <span className="ml-2 text-sm font-semibold text-muted">
                          {t(c.group === "fixed" ? "doimiy" : "o'zgaruvchan")}
                        </span>
                      </span>
                      <span className="font-extrabold">{money(c.amount, c.som)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-track overflow-hidden">
                      <div className="h-full rounded-full bg-brand" style={{ width: c.share + "%" }} />
                    </div>
                    <p className="text-sm text-muted font-semibold mt-1">{c.share}%</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Do'kon kesimi */}
            <div className="card p-7">
              <h2 className="text-2xl font-extrabold mb-2">{t("Do'kon kesimida")}</h2>
              <p className="text-sm text-muted font-semibold mb-5">
                {t("Umumkorxona xarajatlari tushum nisbatida taqsimlangan")}
              </p>
              <table className="w-full text-[0.9375rem]">
                <thead>
                  <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-20 text-left text-muted text-sm border-b border-line [&>th]:bg-panel">
                    <th className="py-3 font-bold">{t("Do'kon")}</th>
                    <th className="py-3 font-bold text-right">{t("O'zining")}</th>
                    <th className="py-3 font-bold text-right">{t("Ulushi")}</th>
                    <th className="py-3 font-bold text-right">{t("Jami")}</th>
                  </tr>
                </thead>
                <tbody>
                  {byStore.map((s) => (
                    <tr key={s.storeId} className="border-b border-line last:border-0">
                      <td className="py-3.5 font-bold">
                        {s.name}
                        <span className="block text-sm font-semibold text-muted">
                          {tt("tushum ulushi {n}%", { n: s.sharePct })}
                        </span>
                      </td>
                      <td className="py-3.5 text-right font-semibold">{money(s.direct, s.directSom)}</td>
                      <td className="py-3.5 text-right font-semibold text-muted">{money(s.allocated, s.allocatedSom)}</td>
                      <td className="py-3.5 text-right font-extrabold text-danger">{money(s.total, s.totalSom)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </>
          )}

          {/* Tablar */}
          <div className="bg-track rounded-2xl p-1.5 flex w-fit mb-5">
            {TABS.map((tb) => (
              <button key={tb} onClick={() => setTab(tb)}
                className={`tab-btn ${tab === tb ? "active" : ""}`}>{t(tb)}</button>
            ))}
          </div>

          {tab === TABS[0] ? (
            <>
            {/* —— Filtr —— Ro'yxat uzun bo'lgani uchun kesim kerak:
                qaysi tur, qaysi do'kon, qaysi usta, kim kiritgan.
                Tanlangani bilan "Jami" ham qayta hisoblanadi. */}
            <div className="card p-5 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                <label className="block">
                  <span className="block text-sm font-bold mb-2">{t("Kategoriya")}</span>
                  <select className="inp" value={fCat} onChange={(e) => setFCat(e.target.value)}>
                    <option value="all">{t("Barchasi")}</option>
                    {catOptions.map((k) => (
                      <option key={k} value={k}>{t(EXPENSE_CATEGORIES[k]?.label ?? k)}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="block text-sm font-bold mb-2">{t("Do'kon")}</span>
                  <select className="inp" value={fStore} onChange={(e) => setFStore(e.target.value)}>
                    <option value="all">{t("Barchasi")}</option>
                    <option value="all-company">{t("Umumkorxona")}</option>
                    {demoStores.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="block text-sm font-bold mb-2">{t("Hamyon")}</span>
                  <select className="inp" value={fMethod} onChange={(e) => setFMethod(e.target.value)}>
                    <option value="all">{t("Barchasi")}</option>
                    {methodOptions.map((m) => (
                      <option key={m} value={m}>{t(methodLabel(m))}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="block text-sm font-bold mb-2">{t("Kimga")}</span>
                  <select className="inp" value={fStaff} onChange={(e) => setFStaff(e.target.value)}>
                    <option value="all">{t("Barchasi")}</option>
                    <option value="none">{t("Hech kimga bog'liq emas")}</option>
                    {hasStreet && <option value="street">{t(STREET_INSTALLER)}</option>}
                    {staffOptions.map((id) => (
                      <option key={id} value={id}>{getStaff(id)?.name ?? "—"}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="block text-sm font-bold mb-2">{t("Kim kiritdi")}</span>
                  <select className="inp" value={fBy} onChange={(e) => setFBy(e.target.value)}>
                    <option value="all">{t("Barchasi")}</option>
                    {byOptions.map((id) => (
                      <option key={id} value={id}>{getStaff(id)?.name ?? "—"}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex items-center gap-4 mt-4">
                {hasFilter && (
                  <button onClick={clearFilters}
                    className="text-sm font-bold text-brand hover:underline">
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
                {/* Sarlavha + "Jami" birga tepada yopishib turadi.
                    Fon shaffofmas — tagidagi qatorlar ko'rinmasin. */}
                <thead className="sticky top-0 z-20">
                  <tr className="text-left text-muted text-sm border-b border-line [&>th]:bg-panel">
                    {expCols.map((c) => (
                      <th key={c.key}
                        className={`px-4 py-4 font-bold ${c.right ? "text-right" : ""}`}>
                        {t(c.label)}
                      </th>
                    ))}
                    <th className="px-4 py-4 bg-panel" />
                  </tr>
                  <tr className="bg-surface border-b-2 border-line">
                    <th className="px-4 py-4 font-extrabold text-left" colSpan={Math.max(1, expCols.length - 1)}>
                      {t("Jami")}
                      <span className="ml-2 text-sm font-bold text-muted">
                        {tt("{n} ta yozuv", { n: shown.length })}
                      </span>
                    </th>
                    <th className="px-4 py-4 text-right text-lg font-extrabold text-danger whitespace-nowrap">
                      −{fmtSom(shownSom)}
                    </th>
                    <th className="px-4 py-4" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((e) => (
                    <tr key={e.id} className="border-b border-line last:border-0 hover:bg-surface/70">
                      {expCols.map((c) => (
                        <td key={c.key}
                          className={`px-4 py-4 ${c.right ? "text-right" : ""}`}>
                          {c.cell(e)}
                        </td>
                      ))}
                      <td className="px-4 py-4 text-right whitespace-nowrap">
                        {/* Takrorlanuvchidan yoyilgan qator shu yerda
                            tahrirlanmaydi — u alohida yozuv emas, qoidaning
                            aksi. Qoidaning o'zi "Takrorlanuvchi to'lovlar"
                            bo'limida tuzatiladi. */}
                        {e.source !== "recurring" && (
                          <button onClick={() => setModal({ initial: e })}
                            className="text-muted hover:text-brand mr-3">
                            <Pencil size={18} />
                          </button>
                        )}
                        <button onClick={() => del(e)} className="text-muted hover:text-danger">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {shown.length === 0 && (
                    <tr><td colSpan={7} className="px-6 py-12 text-center text-muted font-semibold">
                      {hasFilter
                        ? t("Bu filtrga mos xarajat yo'q")
                        : t("Bu davrda xarajat yo'q")}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            </>
          ) : (
            <div className="card overflow-auto max-h-[70vh]">
              <table className="w-full text-[0.9375rem]">
                <thead>
                  <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-20 text-left text-muted text-sm border-b border-line [&>th]:bg-panel">
                    <th className="px-6 py-4 font-bold">{t("Kategoriya")}</th>
                    <th className="px-4 py-4 font-bold">{t("Do'kon")}</th>
                    <th className="px-4 py-4 font-bold">{t("Davri")}</th>
                    <th className="px-4 py-4 font-bold">{t("To'lov kuni")}</th>
                    <th className="px-6 py-4 font-bold text-right">{t("Oyiga")}</th>
                    <th className="px-4 py-4" />
                  </tr>
                </thead>
                <tbody>
                  {recur.map((r) => (
                    <tr key={r.id} className="border-b border-line last:border-0 hover:bg-surface/70">
                      <td className="px-6 py-4">
                        <p className="font-bold">{t(categoryLabel(r.category))}</p>
                        {r.note && <p className="text-sm text-muted">{r.note}</p>}
                      </td>
                      <td className="px-4 py-4 font-semibold">
                        {storeName(r.storeId) ?? <span className="text-muted">{t("Umumkorxona")}</span>}
                      </td>
                      <td className="px-4 py-4 font-semibold text-muted">
                        {r.from} — {r.to || t("hozirgacha")}
                      </td>
                      <td className="px-4 py-4 font-semibold">{tt("{n}-kun", { n: r.day })}</td>
                      <td className="px-6 py-4 text-right font-extrabold">{money(r.amount, somOf(r))}</td>
                      <td className="px-4 py-4 text-right whitespace-nowrap">
                        <button onClick={() => setModal({ initial: r })} className="text-muted hover:text-brand mr-3">
                          <Pencil size={18} />
                        </button>
                        <button onClick={() => { removeRecurring(r.id); bump(); }} className="text-muted hover:text-danger">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {recur.length === 0 && (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-muted font-semibold">
                      {t("Doimiy xarajat kiritilmagan")}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {rateModal && (
        <RateModal
          onClose={() => setRateModal(null)}
          onSaved={() => { if (rateModal.then === "expense") setModal({}); bump(); }} />
      )}

      {colPrefs.open && <ColumnSettings {...colPrefs.dialogProps} />}

      {modal && (
        <ExpenseModal initial={modal.initial ?? null} onClose={() => setModal(null)} onSave={save} />
      )}
    </div>
  );
}
