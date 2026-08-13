"use client";
// ══════════════════════════════════════════════════════════════
// BITTA KASSA — KUNMA-KUN DAFTAR
// ══════════════════════════════════════════════════════════════
// Kassa kartochkasidagi bitta raqam ("28 905") kunlar ichida nima
// bo'lganini aytmaydi. Bu sahifa aynan shuni ochadi: har kun uchun
// kirim, chiqim, kun qoldig'i, kassada qolgan pul va eng muhimi —
// o'sha kun yopilganmi, qancha bilan yopilgan.
//
// Yopish ham shu yerdan: har kunning o'z tugmasi bor, ya'ni kecha
// unutilgan bo'lsa bugun yopib qo'yiladi va qaysi kunniki ekani
// yo'qolmaydi.
import { t, tt } from "@/lib/i18n";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, CalendarDays, SlidersHorizontal, Wallet, LockKeyhole, Clock,
  Check, Undo2, AlertTriangle,
} from "lucide-react";
import { fmtUSD } from "@/lib/demoData";
import { PERIODS, periodRange, fmtDate } from "@/lib/dates";
import DateRangePicker from "@/components/DateRangePicker";
import ColumnSettings from "@/components/ColumnSettings";
import { useColumns } from "@/components/useColumns";
import StatCard from "@/components/finance/StatCard";
import CellSources from "@/components/finance/CellSources";
import CloseKassaModal from "@/components/CloseKassaModal";
import { useAuth } from "@/components/AuthProvider";
import { useLive } from "@/components/DataProvider";
import { getStaff } from "@/lib/staffData";
import {
  KASSAS, WALLETS, walletsOf, kassaBalances, kassaDailyRows, kassaSources, hasSources,
  closeDay, cancelClose, canOperate, kassasOf, unclosedDays,
} from "@/lib/kassaData";

const isoOf = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Davr tanlagichi Date qaytaradi, jadvaldagi sana esa "YYYY-MM-DD" —
// String(Date) qilinsa "Sat Aug 01 2026" chiqadi va taqqoslash buziladi.
const fmtDay = (d) => {
  const s = d instanceof Date ? isoOf(d) : String(d).slice(0, 10);
  const [y, m, dd] = s.split("-");
  return `${dd}.${m}.${y}`;
};

const WEEKDAYS = ["Yak", "Du", "Se", "Cho", "Pa", "Ju", "Sha"];
const weekday = (d) => WEEKDAYS[new Date(d + "T12:00:00").getDay()];

// Bosiladigan raqam ko'rinib tursin: faqat hover'da bilinsa, foydalanuvchi
// ustiga bosish mumkinligini umuman bilmaydi. Nuqtali chiziq — "batafsili
// bor" degan belgi, hover'da esa odatdagi yorug'lik.
const LINKY = "rounded-lg px-1.5 -mx-1.5 border-b border-dashed border-muted/50 " +
  "hover:bg-brand-soft hover:text-brand hover:border-transparent transition-colors";

export default function KassaDays() {
  const { id } = useParams();
  const { user } = useAuth();
  const live = useLive();
  const [tick, setTick] = useState(0);
  const bump = () => setTick((v) => v + 1);

  const [period, setPeriod] = useState("Oy");
  const [range, setRange] = useState(() => periodRange("Oy"));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [closing, setClosing] = useState(null);   // yopish oynasi: sana
  const [src, setSrc] = useState(null);           // katak ortidagi ro'yxat

  const kassa = KASSAS[id];
  const isOwner = user?.role === "owner";
  const mine = useMemo(() => kassasOf(user), [user, tick, live]);
  const canSee = isOwner || mine.includes(id);
  const canClose = !!kassa && !kassa.main && canOperate(user, id);

  const bal = useMemo(() => kassaBalances(new Date())[id], [id, tick, live]);
  const daily = useMemo(
    () => (kassa ? kassaDailyRows(id, range.from, range.to) : { carry: 0, rows: [] }),
    [id, range, tick, live, kassa]);
  const open = useMemo(
    () => (kassa && !kassa.main ? unclosedDays(id) : []), [id, tick, live, kassa]);

  // —— Ustunlar ————————————————————————————————————
  // "sum" — Jami qatorida qo'shiladi. Qoldiq esa qo'shilmaydi: u yugurib
  // boradigan raqam, oxirgi kunniki = bugungi qoldiq.
  const ALL_COLS = [
    { key: "in", label: "Kirim", tone: "in", total: "sum" },
    { key: "out", label: "Chiqim", tone: "out", total: "sum" },
    { key: "net", label: "Kun qoldig'i", tone: "split", total: "sum" },
    { key: "given", label: "Topshirilgan", tone: "split", total: "sum" },
    { key: "left", label: "Kassada qoldi", tone: "split", total: "last" },
    // Quyidagilar boshida yashirin — kerak bo'lsa "Ustunlar" dan yoqiladi
    { key: "inCash", label: "Naqd", tone: "in", total: "sum" },
    { key: "inPayme", label: "Payme", tone: "in", total: "sum" },
    { key: "inService", label: "Servis", tone: "in", total: "sum" },
    { key: "billz", label: "Billz bo'yicha", tone: "split", total: "sum" },
    { key: "diff", label: "Farq", tone: "split", total: "sum" },
  ];
  const colPrefs = useColumns(`kassa-days-${kassa?.main ? "company" : "store"}`, ALL_COLS, {
    defaultHidden: ["inCash", "inPayme", "inService", "billz", "diff"],
  });
  const COLS = colPrefs.columns;

  const rows = daily.rows;
  const totals = useMemo(() => {
    const out = {};
    for (const c of ALL_COLS) {
      if (c.total === "last") {
        out[c.key] = rows.length ? rows[rows.length - 1][c.key] : daily.carry;
      } else {
        out[c.key] = +rows.reduce((s, r) => s + (r[c.key] ?? 0), 0).toFixed(2);
      }
    }
    return out;
  }, [rows, daily.carry]);

  const closedCount = rows.filter((r) => r.close).length;

  function confirmClose(day, note) {
    closeDay({ kassa: id, date: day, staffId: user?.id, note });
    setClosing(null);
    bump();
  }

  function undoClose(day) {
    if (!confirm(t("Yopish bekor qilinsinmi? Pul kassaga qaytadi."))) return;
    cancelClose(id, day);
    setClosing(null);
    bump();
  }

  if (!kassa) {
    return (
      <div className="card p-12 text-center max-w-xl mx-auto mt-16">
        <p className="text-xl font-extrabold mb-2">{t("Bunday kassa yo'q")}</p>
        <Link href="/finance/kassa" className="font-bold text-brand hover:underline">
          {t("Kassalar va balans")}
        </Link>
      </div>
    );
  }
  if (!canSee) {
    return (
      <div className="card p-12 text-center max-w-xl mx-auto mt-16">
        <p className="text-xl font-extrabold mb-2">{t("Bu kassa sizga yopiq")}</p>
        <p className="text-muted font-semibold">
          {t("Kassa xodimning do'koniga qarab beriladi.")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <Link href="/finance/kassa"
        className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-brand mb-4">
        <ArrowLeft size={17} /> {t("Kassalar va balans")}
      </Link>
      <h1 className="text-4xl font-extrabold tracking-tight mb-2">{t(kassa.label)}</h1>
      <p className="text-muted font-semibold mb-7 max-w-3xl">
        {kassa.main
          ? t("Kompaniya balansiga kunma-kun nima tushgani va nima chiqqani. Do'kon kassalari yopilganda pul shu yerga keladi.")
          : t("Har kun alohida yopiladi: o'sha kunning qoldig'i rahbarga topshiriladi. Yopilmagan kun qizarib turadi — kecha unutilgan bo'lsa bugun yopib qo'yiladi.")}
      </p>

      {/* —— Uchta ko'rsatkich —— */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-7">
        <StatCard icon={Wallet} label="Kassada hozir" value={fmtUSD(bal?.total ?? 0)}
          hint={walletsOf(id).map((w) => `${t(WALLETS[w])} ${fmtUSD(bal?.[w] ?? 0)}`).join(" · ")} />
        <StatCard icon={Clock} label="Yo'lda — tasdiq kutilmoqda" tone="amber"
          value={fmtUSD(bal?.pending ?? 0)}
          hint={bal?.pending > 0 ? t("Rahbar tasdiqlagach kompaniya balansiga qo'shiladi") : t("Kutayotgan pul yo'q")} />
        {!kassa.main && (
          <StatCard icon={open.length ? AlertTriangle : Check}
            label="Yopilmagan kunlar" tone={open.length ? "red" : "green"}
            value={String(open.length)}
            hint={open.length
              ? tt("Eng eskisi {d}", { d: fmtDay(open[0]) })
              : t("Hamma kun yopilgan")} />
        )}
      </div>

      {/* Davr */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="bg-track rounded-2xl p-1.5 flex">
          {PERIODS.map((p) => (
            <button key={p} onClick={() => { setPeriod(p); setRange(periodRange(p)); }}
              className={`tab-btn ${period === p ? "active" : ""}`}>{t(p)}</button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {canClose && (
            <button onClick={() => setClosing(isoOf(new Date()))}
              className="flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-5 py-3">
              <LockKeyhole size={18} /> {t("Kunni yopish")}
            </button>
          )}
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
      </div>

      <div className="flex items-center justify-between gap-4 mb-3">
        <p className="text-sm text-muted font-semibold">
          {daily.carry !== 0 && tt("Davr boshida kassada {n} bor edi", { n: fmtUSD(daily.carry) })}
        </p>
        <button onClick={colPrefs.openSettings}
          className="flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm font-bold hover:border-brand hover:text-brand transition-colors">
          <SlidersHorizontal size={16} /> {t("Ustunlar")}
        </button>
      </div>

      <div className="card overflow-auto max-h-[70vh] mb-3">
        <table className="w-full text-[0.9375rem] min-w-[53.75rem]">
          {/* Sarlavha va "Jami" birga tepada yopishib turadi */}
          <thead className="bg-surface text-left text-sm sticky top-0 z-20">
            <tr className="border-b border-line [&>th]:bg-surface">
              <th className="px-4 py-4 font-bold whitespace-nowrap sticky left-0 bg-surface">{t("Sana")}</th>
              {COLS.map((c) => (
                <th key={c.key} className="px-3 py-4 font-bold text-right align-bottom">{t(c.label)}</th>
              ))}
              {!kassa.main && (
                <th className="px-4 py-4 font-bold text-right align-bottom sticky right-0 bg-surface border-l border-line shadow-[-10px_0_12px_-10px_rgba(0,0,0,.55)]">
                  {t("Kassa yopilgani")}
                </th>
              )}
            </tr>
            {/* Jami — TEPADA, fon shaffofmas (tagidagi kunlar ko'rinmasin) */}
            <tr className="bg-surface border-b-2 border-line">
              <td className="px-4 py-5 font-extrabold sticky left-0 bg-surface">{t("Jami")}</td>
              {COLS.map((c) => {
                const v = totals[c.key];
                // Jami raqami ham bosiladi — davr bo'yicha yozuvlar ochiladi
                const open = hasSources(c.key) && Math.abs(v) > 0.004;
                const cls = `text-lg font-extrabold ${
                  v === 0 ? "text-muted"
                    : c.tone === "out" ? "text-danger"
                    : c.tone === "in" ? "text-ok"
                    : v < 0 ? "text-danger" : ""}`;
                const text = `${c.tone === "out" && v > 0 ? "−" : ""}${fmtUSD(v)}`;
                return (
                  <td key={c.key} className="px-3 py-5 text-right whitespace-nowrap">
                    {open ? (
                      <button
                        onClick={() => setSrc({ from: daily.from, to: daily.to,
                          key: c.key, label: c.label,
                          dayLabel: `${fmtDay(range.from)} — ${fmtDay(range.to)}` })}
                        className={`${cls} ${LINKY}`}>
                        {text}
                      </button>
                    ) : (
                      <span className={cls}>{text}</span>
                    )}
                    {c.total === "last" && (
                      <span className="block text-sm text-muted font-semibold">{t("hozirgi qoldiq")}</span>
                    )}
                  </td>
                );
              })}
              {!kassa.main && (
                <td className="px-4 py-5 text-right sticky right-0 bg-surface border-l border-line shadow-[-10px_0_12px_-10px_rgba(0,0,0,.55)]">
                  <span className={`font-extrabold ${
                    closedCount === rows.length ? "text-ok" : "text-warn"}`}>
                    {tt("{a} / {b}", { a: closedCount, b: rows.length })}
                  </span>
                  <span className="block text-sm text-muted font-semibold">{t("kun yopilgan")}</span>
                </td>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const today = isoOf(new Date());
              // Yopilmagan o'tgan kun — qizil. Bugungi kun hali yopilmagani
              // xato emas: kun tugamagan.
              const late = !r.close && r.date < today && (r.in > 0.004 || r.out > 0.004);
              return (
                <tr key={r.date} className="border-b border-line last:border-0 hover:bg-surface/60">
                  <td className="px-4 py-4 font-bold whitespace-nowrap sticky left-0 bg-panel">
                    {fmtDay(r.date)}
                    <span className="block text-sm text-muted font-semibold">{t(weekday(r.date))}</span>
                  </td>
                  {COLS.map((c) => {
                    const v = r[c.key];
                    // Ustiga bosilsa — shu kundagi raqam qaysi yozuvlardan
                    // yig'ilgani ochiladi. Qoldiq ustunlari bosilmaydi:
                    // ular yugurib boradigan raqam, o'z yozuvi yo'q.
                    const open = hasSources(c.key) && Math.abs(v ?? 0) > 0.004;
                    const cls = `font-bold ${
                      c.tone === "out" ? "text-danger"
                        : c.tone === "in" ? "text-ok"
                        : v < 0 ? "text-danger" : ""}`;
                    return (
                      <td key={c.key} className="px-3 py-4 text-right whitespace-nowrap">
                        {v == null || v === 0 ? <span className="text-muted">—</span>
                          : open ? (
                            <button
                              onClick={() => setSrc({ from: r.date, to: r.date, key: c.key,
                                label: c.label, dayLabel: fmtDay(r.date) })}
                              className={`${cls} ${LINKY}`}>
                              {c.tone === "out" ? "−" : ""}{fmtUSD(v)}
                            </button>
                          ) : (
                            <span className={cls}>{c.tone === "out" ? "−" : ""}{fmtUSD(v)}</span>
                          )}
                      </td>
                    );
                  })}
                  {!kassa.main && (
                    <td className="px-4 py-4 text-right sticky right-0 bg-panel border-l border-line shadow-[-10px_0_12px_-10px_rgba(0,0,0,.55)]">
                      {r.close ? (
                        <button onClick={() => setClosing(r.date)}
                          className="inline-flex flex-col items-end rounded-xl border-2 border-line hover:border-brand px-3 py-2 transition-colors">
                          <span className="font-extrabold whitespace-nowrap">{fmtUSD(r.close.amount)}</span>
                          <span className={`text-sm font-bold flex items-center gap-1 ${
                            r.close.status === "pending" ? "text-warn" : "text-ok"}`}>
                            {r.close.status === "pending"
                              ? <><Clock size={14} /> {t("tasdiq kutmoqda")}</>
                              : <><Check size={14} /> {t("tasdiqlangan")}</>}
                          </span>
                          {r.close.staffId && (
                            <span className="text-sm text-muted font-semibold">
                              {getStaff(r.close.staffId)?.name ?? ""}
                            </span>
                          )}
                        </button>
                      ) : canClose ? (
                        <button onClick={() => setClosing(r.date)}
                          className={`inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-2 font-bold transition-colors ${
                            late ? "border-danger text-danger hover:bg-danger-soft"
                              : "border-line hover:border-brand hover:text-brand"}`}>
                          <LockKeyhole size={15} /> {t("Yopish")}
                        </button>
                      ) : (
                        <span className={`font-bold ${late ? "text-danger" : "text-muted"}`}>
                          {t("Yopilmagan")}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLS.length + (kassa.main ? 1 : 2)}
                  className="px-5 py-12 text-center text-muted font-semibold">
                  {t("Bu davrda pul harakati bo'lmagan")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-muted font-semibold mb-8">
        {t("\"Kun qoldig'i\" — o'sha kundagi kirim minus chiqim, ya'ni topshirilishi kerak bo'lgan pul. \"Kassada qoldi\" esa yugurib boradigan qoldiq: topshirilgan pul undan chiqadi. Rahbar tasdiqlaguncha pul \"yo'lda\" turadi va qoldiqda sanalaveradi — kartochkadagi raqam bilan bir xil bo'lishi uchun.")}
        {" "}
        {t("Kirim va chiqim ustiga bossangiz — o'sha kundagi summa qaysi yozuvlardan yig'ilgani ochiladi.")}
      </p>

      {colPrefs.open && <ColumnSettings {...colPrefs.dialogProps} />}

      {closing && (
        <CloseKassaModal kassa={id} date={closing}
          onClose={() => setClosing(null)}
          onConfirm={confirmClose}
          onCancelClose={undoClose} />
      )}

      {src && (
        <CellSources label={`${t(kassa.label)} · ${t(src.label)}`}
          dayLabel={src.dayLabel}
          rows={kassaSources(id, src.from, src.to, src.key)}
          onClose={() => setSrc(null)} />
      )}
    </div>
  );
}
