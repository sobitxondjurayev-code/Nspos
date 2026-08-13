"use client";
// ══════════════════════════════════════════════════════════════
// PUL REJASI — rahbar uchun
// ══════════════════════════════════════════════════════════════
// Rahbar Google Sheets'da yuritgan jadvalning o'zi: B2B, B2C, mashina
// xarajatlari, oylik maoshlar, NS (o'ziga olgan pul), Payme, Naqd va
// "Berishim kerak". Farqi — raqamlar qo'lda kiritilmaydi, platformadagi
// ma'lumotdan o'zi chiqadi.
//
// "Berishim kerak" ustunida FAQAT SUMMA turadi (rahbarning talabi).
// Kimga, qachon va qancha berilishi — ustiga bosilganda ochiladigan
// kartochka ichida.
import { t, tt } from "@/lib/i18n";
import { useMemo, useState } from "react";
import {
  CalendarDays, ArrowDownLeft, Wallet, ChevronRight, SlidersHorizontal, Plus, ClipboardList,
} from "lucide-react";
import { fmtUSD } from "@/lib/demoData";
import { PERIODS, periodRange, fmtDate } from "@/lib/dates";
import DateRangePicker from "@/components/DateRangePicker";
import PayoutModal from "@/components/PayoutModal";
import PayoutsCard from "@/components/PayoutsCard";
import PayModal from "@/components/PayModal";
import CellSources from "@/components/finance/CellSources";
import ColumnSettings from "@/components/ColumnSettings";
import { useColumns } from "@/components/useColumns";
import { useAuth } from "@/components/AuthProvider";
import { useLive } from "@/components/DataProvider";
import {
  KASSAS, WALLETS, WALLET_IDS, kassaBalances, moneyFlow, summaryRow, dailyRows,
  walletSources, COMPANY,
} from "@/lib/kassaData";
import { getLedgerStart } from "@/lib/companyData";
import {
  listPayouts, addPayout, updatePayout, removePayout, payPayout, unpayPayout,
  payoutSummary, plannedByKassa,
} from "@/lib/payoutsData";

const isoOf = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// "2026-08-05" → "05.08.2026". Date ham kelishi mumkin (davr tanlagichi
// Date qaytaradi) — String(Date) esa "Sat Aug 05 2026..." beradi.
const fmtDay = (d) => {
  const s = d instanceof Date ? isoOf(d) : String(d).slice(0, 10);
  const [y, m, dd] = s.split("-");
  return `${dd}.${m}.${y}`;
};

const WEEKDAYS = ["Yak", "Du", "Se", "Cho", "Pa", "Ju", "Sha"];
const weekday = (d) => WEEKDAYS[new Date(d + "T12:00:00").getDay()];

export default function FinancePlan() {
  const { user } = useAuth();
  const [period, setPeriod] = useState("Oy");
  const [range, setRange] = useState(() => periodRange("Oy"));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [card, setCard] = useState(null);        // { date? } | null
  const [form, setForm] = useState(null);        // { initial } | {}
  const [paying, setPaying] = useState(null);    // "To'ladim" bosilgan reja
  const [src, setSrc] = useState(null);          // bosilgan katak ortidagi ro'yxat
  const [walletSrc, setWalletSrc] = useState(null);  // hamyon (naqd/Payme/servis) ortidagi ro'yxat
  const [tick, setTick] = useState(0);
  // Boshqa xodim yozgan o'zgarish ham darrov ko'rinsin
  const live = useLive();
  const bump = () => setTick((v) => v + 1);

  const flow = useMemo(() => moneyFlow(range.from, range.to), [range, tick, live]);
  const days = useMemo(() => dailyRows(range.from, range.to), [range, tick, live]);
  const total = useMemo(() => summaryRow(range.from, range.to), [range, tick, live]);
  const bal = useMemo(() => kassaBalances(new Date()), [tick, live]);
  const rows = useMemo(() => listPayouts(), [tick, live]);
  const sum = useMemo(() => payoutSummary(), [tick, live]);
  const booked = useMemo(() => plannedByKassa(), [tick, live]);

  const open = rows.filter((p) => p.status === "planned");
  const allPaid = rows.filter((p) => p.status === "paid");

  const cashOnHand = useMemo(
    () => +Object.values(bal).reduce((s, b) => s + b.total, 0).toFixed(2), [bal]);

  // Hamma kassadagi pul hamyon bo'yicha: naqd, Payme, servis
  const walletTotals = useMemo(() => Object.fromEntries(
    WALLET_IDS.map((w) => [w, +Object.values(bal).reduce((s, b) => s + (b[w] ?? 0), 0).toFixed(2)])
  ), [bal]);

  // —— Ustunlar ————————————————————————————————————
  // Rahbarning o'z ro'yxati, o'sha tartibda. tone: kirimmi chiqimmi.
  // Rahbar bergan tartib. Xarajatlar kassasi bo'yicha ajratilgan:
  // B2B kassasidan chiqqani — B2B xarajati, B2C kassasidan chiqqani —
  // do'kon xarajati, servis hamyonidan chiqqani — servis xarajati.
  const ALL_COLS = [
    { key: "b2b", label: "B2B", tone: "in" },
    { key: "b2bExp", label: "B2B xarajatlari", tone: "out" },
    { key: "b2c", label: "B2C", tone: "in" },
    { key: "storeExp", label: "Do'kon xarajatlari", tone: "out" },
    // Servis kirimi — o'rnatish xizmatidan tushgan pul. Servis
    // xarajatlari aynan shundan chiqadi, shuning uchun yonma-yon turadi.
    { key: "service", label: "Servis", tone: "in" },
    { key: "svcExp", label: "Servis xarajatlar", tone: "out" },
    { key: "salary", label: "Oylik maoshlar", tone: "out" },
    { key: "cash", label: "Naqd", tone: "split" },
    { key: "payme", label: "Payme", tone: "split" },
    { key: "ns", label: "NS", tone: "out" },
    // Kompaniya balansidan qilingan xarajat (ijara, soliq…) — yuqoridagi
    // uch ustunning hech biriga kirmaydi, shuning uchun alohida turadi.
    // Keraksiz bo'lsa "Ustunlar" dan yashiriladi.
    { key: "companyExp", label: "Kompaniya xarajatlari", tone: "out" },
  ];
  // Ustun tartibini rahbar o'zi belgilaydi. "Sana" va "Berishim kerak"
  // sozlamaga kirmaydi: ular jadvalning ikki cheti va doim kerak.
  const colPrefs = useColumns("plan-daily", ALL_COLS);
  const COLS = colPrefs.columns;

  // Jadval faqat pul harakati bo'lgan kunlarni ko'rsatadi. To'lov
  // rejasi bu yerda emas — u "Berishim kerak" oynasida, kunlar bo'yicha
  // jadval bilan birga (kelasi muddatlar ham o'sha yerda ko'rinadi).
  const tableRows = days;

  // Jami — jadvalning eng tepasida, kunlardan oldin. Pastda takrorlash
  // kerak emas: bir xil raqam ikki joyda turgani foyda bermaydi.
  // Fon SHAFFOFMAS — sticky bo'lgani uchun tagidagi kunlar ko'rinmasin
  const totals = () => (
    <tr className="bg-surface border-b-2 border-line">
      <td className="px-4 py-5 font-extrabold sticky left-0 bg-surface">{t("Jami")}</td>
      {COLS.map((c) => (
        <td key={c.key} className="px-3 py-5 text-right whitespace-nowrap">
          {/* Ustiga bosilsa — shu summa qaysi yozuvlardan yig'ilgani */}
          <button disabled={total[c.key] === 0}
            onClick={() => setSrc({ key: c.key, label: c.label, from: range.from, to: range.to,
              dayLabel: `${fmtDay(range.from)} — ${fmtDay(range.to)}` })}
            className={`text-lg font-extrabold rounded-lg px-1.5 -mx-1.5 enabled:hover:bg-brand-soft enabled:hover:text-brand transition-colors ${
              total[c.key] === 0 ? "text-muted"
                : c.tone === "out" ? "text-danger" : c.tone === "in" ? "text-ok" : ""}`}>
            {c.tone === "out" && total[c.key] > 0 ? "−" : ""}{fmtUSD(total[c.key])}
          </button>
        </td>
      ))}
    </tr>
  );

  // payNow — reja qilib o'tirilmaydigan xarajat: bir bosishda yoziladi
  // ham, to'lanadi ham. Pul o'sha zahoti kassadan chiqadi.
  function save(data, { payNow } = {}) {
    if (form?.initial) {
      updatePayout(form.initial.id, data);
    } else {
      const p = addPayout(data);
      if (payNow && p) {
        payPayout(p.id, {
          amount: data.amount, amountSom: data.amountSom,
          date: data.dueDate, staffId: user?.id ?? null,
        });
      }
    }
    setForm(null);
    bump();
  }

  // "To'ladim" darrov to'liq summani yozmaydi — qancha berilgani
  // so'raladi. Qolgani yangi muddat bilan rejada turaveradi.
  function pay(p) { setPaying(p); }

  function confirmPay(data) {
    payPayout(paying.id, { ...data, staffId: user?.id ?? null });
    setPaying(null);
    bump();
  }

  // Rejaga qaytarish — pul kassaga qaytadi, ya'ni bu ham pul harakati.
  // Tasodifan bosilib ketmasin: avval so'raladi.
  function unpay(p) {
    if (!confirm(tt("\"{name}\" to'lovi rejaga qaytarilsinmi?\n\n{n} kassaga qaytariladi va to'lov yana \"Berishim kerak\" bo'lib turadi.",
      { name: p.title, n: fmtUSD(p.amount) }))) return;
    unpayPayout(p.id);
    bump();
  }

  function drop(p) {
    if (!confirm(tt("\"{name}\" to'lovi o'chirilsinmi?", { name: p.title }))) return;
    removePayout(p.id);
    bump();
  }

  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight mb-2">{t("Pul rejasi")}</h1>
      <p className="text-muted font-semibold mb-7 max-w-3xl">
        {t("Davr ichida qancha pul kirdi va qayerga ketdi. Kimga qancha berish kerakligi va qaysi to'lovlar qilingani — \"Berishim kerak\" tugmasida.")}
      </p>

      {/* Davr */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="bg-track rounded-2xl p-1.5 flex">
          {PERIODS.map((p) => (
            <button key={p} onClick={() => { setPeriod(p); setRange(periodRange(p)); }}
              className={`tab-btn ${period === p ? "active" : ""}`}>{t(p)}</button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {/* To'lov shu sahifada rejalashtiriladi (asosan kompaniya
              balansidan chiqim) — tugma "Berishim kerak" kartochkasi
              ichida yashirin turmasin, asosiy ekranda tursin. */}
          <button onClick={() => setForm({})}
            className="flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-5 py-3">
            <Plus size={18} /> {t("Yangi to'lov")}
          </button>
          {/* Butun reja alohida oynada: kunlar bo'yicha jadval, rejadagi
              va to'langanlar. Jadvaldagi katakni qidirib topish shart
              emas — tugma shu yerda turadi. */}
          <button onClick={() => setCard({ tab: "days" })}
            className="flex items-center gap-2 rounded-xl bg-surface hover:bg-track border border-line font-bold px-5 py-3 transition-colors">
            <ClipboardList size={18} className="text-brand" /> {t("Berishim kerak")}
          </button>
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

      {/* —— Ikki kartochka —— */}
      {/* Kirgan va chiqqan pul BITTA kartochkada: ular bir savolning ikki
          tomoni ("davr ichida pul qanday yurdi"), alohida turgani joyni
          egallardi va ko'z ikkalasini solishtirish uchun baribir birga
          qaraydi. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-7">
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-10 h-10 rounded-xl bg-brand-soft text-brand flex items-center justify-center">
              <ArrowDownLeft size={20} />
            </span>
            <p className="text-sm font-bold text-muted">{t("Kirgan va chiqqan pul")}</p>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <span className="text-3xl font-extrabold text-ok whitespace-nowrap">{fmtUSD(flow.in)}</span>
            <span className={`text-3xl font-extrabold whitespace-nowrap ${
              flow.out > 0.004 ? "text-danger" : "text-muted"}`}>
              {flow.out > 0.004 ? "−" : ""}{fmtUSD(flow.out)}
            </span>
          </div>
          <p className="text-sm text-muted font-semibold mt-1">
            {tt("Kirgan · chiqqan · farqi {n}", { n: fmtUSD(flow.net) })}
          </p>
        </div>

        {/* Kassalarda qancha pul bor — hamyon bo'yicha bo'lingan holda */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-10 h-10 rounded-xl bg-brand-soft text-brand flex items-center justify-center">
              <Wallet size={20} />
            </span>
            <p className="text-sm font-bold text-muted">{t("Hozir kassalarda")}</p>
          </div>
          <p className="text-3xl font-extrabold">{fmtUSD(cashOnHand)}</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1.5">
            {/* Har hamyon bosiladi: o'sha pul qayerdan kelib qayerga
                ketgani ochiladi. Servis ayniqsa savol tug'diradi —
                undan usta oyligi ham to'lanadi, ya'ni raqam "Servis
                xarajatlar" ustunidan katta kamayadi. */}
            {WALLET_IDS.map((w) => (
              <button key={w} onClick={() => setWalletSrc(w)}
                className="text-sm font-semibold text-muted whitespace-nowrap rounded-lg px-1.5 -mx-1.5 border-b border-dashed border-muted/50 hover:bg-brand-soft hover:text-brand hover:border-transparent transition-colors">
                {t(WALLETS[w])} <b className="text-ink">{fmtUSD(walletTotals[w])}</b>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* —— Rahbar jadvali: har kun alohida qator —— */}
      <div className="flex justify-end mb-3">
        <button onClick={colPrefs.openSettings}
          className="flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm font-bold hover:border-brand hover:text-brand transition-colors">
          <SlidersHorizontal size={16} /> {t("Ustunlar")}
        </button>
      </div>
      <div className="card overflow-auto max-h-[70vh] mb-3">
        {/* Ustun sarlavhalari ikki qatorga bo'linishi mumkin ("Mashina
            xarajatlari"), shunda jadval oddiy ekranga sig'adi va
            gorizontal skroll kerak bo'lmaydi. */}
        <table className="w-full text-[0.9375rem] min-w-[53.75rem]">
          {/* Sarlavha + "Jami" birga tepada yopishib turadi */}
          <thead className="bg-surface text-left text-sm sticky top-0 z-20">
            <tr className="border-b border-line [&>th]:bg-surface">
              <th className="px-4 py-4 font-bold whitespace-nowrap sticky left-0 bg-surface">{t("Sana")}</th>
              {COLS.map((c) => (
                <th key={c.key} className="px-3 py-4 font-bold text-right align-bottom">{t(c.label)}</th>
              ))}
            </tr>
            {/* Jami tepada va pin: kunlar ko'payganda pastigacha
                aylantirmasdan umumiy raqam ko'rinib tursin */}
            {totals()}
          </thead>
          <tbody>
            {tableRows.map((r) => {
              return (
                <tr key={r.date} className="border-b border-line last:border-0 hover:bg-surface/60">
                  <td className="px-4 py-4 font-bold whitespace-nowrap sticky left-0 bg-panel">
                    {fmtDay(r.date)}
                    <span className="block text-sm text-muted font-semibold">{t(weekday(r.date))}</span>
                  </td>
                  {COLS.map((c) => (
                    <td key={c.key} className="px-3 py-4 text-right whitespace-nowrap">
                      {r[c.key] === 0 ? (
                        <span className="text-muted">—</span>
                      ) : (
                        // Ustiga bosilsa — shu kundagi raqam qaysi
                        // yozuvlardan yig'ilgani ochiladi
                        <button
                          onClick={() => setSrc({ key: c.key, label: c.label, from: r.date, to: r.date,
                            dayLabel: fmtDay(r.date) })}
                          className={`font-bold rounded-lg px-1.5 -mx-1.5 hover:bg-brand-soft hover:text-brand transition-colors ${
                            c.tone === "out" ? "text-danger" : c.tone === "in" ? "text-ok" : ""}`}>
                          {c.tone === "out" ? "−" : ""}{fmtUSD(r[c.key])}
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
            {tableRows.length === 0 && (
              <tr><td colSpan={COLS.length + 1} className="px-5 py-12 text-center text-muted font-semibold">
                {t("Bu davrda pul harakati bo'lmagan")}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-muted font-semibold mb-8">
        {t("Faqat pul harakati bo'lgan kunlar ko'rsatiladi. Payme va Naqd — o'sha kirimning to'lov turi bo'yicha bo'linishi, alohida pul emas.")}
        {" "}
        {t("Rejadagi to'lovlar va kelasi muddatlar \"Berishim kerak\" oynasida, kunlar bo'yicha jadval bilan birga.")}
      </p>

      {/* —— Kassalar: qanchasi band —— */}
      <div className="card overflow-hidden">
        <div className="px-6 py-5 border-b border-line">
          <p className="text-lg font-extrabold">{t("Qaysi kassada qancha bo'sh pul bor")}</p>
          <p className="text-sm text-muted font-semibold">
            {t("Band — shu kassadan chiqishi rejalashtirilgan to'lovlar")}
          </p>
        </div>
        <table className="w-full text-[0.9375rem]">
          <thead className="bg-surface text-left text-sm">
            <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-20 border-b border-line [&>th]:bg-surface">
              <th className="px-6 py-4 font-bold">{t("Kassa")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Bor")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Band")}</th>
              <th className="px-6 py-4 font-bold text-right">{t("Bo'sh")}</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(bal).map((k) => {
              const has = bal[k].total;
              const bk = booked[k]?.total ?? 0;
              const free = +(has - bk).toFixed(2);
              return (
                <tr key={k} className="border-b border-line last:border-0">
                  <td className="px-6 py-4 font-bold">
                    {t(KASSAS[k]?.label ?? k)}
                    {k === COMPANY && (
                      <span className="ml-2 text-sm font-bold text-brand">{t("asosiy")}</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right font-semibold">{fmtUSD(has)}</td>
                  <td className="px-4 py-4 text-right font-semibold">
                    {bk > 0 ? <span className="text-warn">{fmtUSD(bk)}</span> : <span className="text-muted">—</span>}
                  </td>
                  <td className={`px-6 py-4 text-right font-extrabold ${
                    free < 0 ? "text-danger" : "text-ok"}`}>
                    {fmtUSD(free)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {card && (
        <PayoutsCard
          open={open} paid={allPaid} days={days} total={sum.planned} cashOnHand={cashOnHand}
          focusDate={card.date ?? null} focusTab={card.tab ?? null}
          onAdd={() => setForm({ dueDate: card.date ?? null })}
          onEdit={(p) => setForm({ initial: p })}
          onPay={pay}
          onRemove={drop}
          onUnpay={unpay}
          onClose={() => setCard(null)}
        />
      )}

      {/* dueDate — kun ustidan ochilganda yangi to'lovga o'sha sana qo'yiladi */}
      {form && (
        <PayoutModal initial={form.initial ?? null} dueDate={form.dueDate ?? null} balances={bal}
          onClose={() => setForm(null)} onSave={save} />
      )}

      {/* "To'ladim" — qancha berilgani so'raladi, qolgani rejada qoladi */}
      {paying && (
        <PayModal payout={paying} onClose={() => setPaying(null)} onConfirm={confirmPay} />
      )}

      {/* Hamyon ustiga bosilganda — o'sha hamyonga tushgan va undan
          chiqqan hamma yozuv (hisob boshidan) */}
      {walletSrc && (
        <CellSources label={`${t("Hozir kassalarda")} · ${t(WALLETS[walletSrc])}`}
          dayLabel={t("Hisob boshidan")}
          rows={walletSources(walletSrc, getLedgerStart(), new Date())}
          onClose={() => setWalletSrc(null)} />
      )}

      {/* Katak ustiga bosilganda — shu summa qaysi yozuvlardan yig'ilgani */}
      {src && (
        <CellSources from={src.from} to={src.to} colKey={src.key} label={src.label}
          dayLabel={src.dayLabel} onClose={() => setSrc(null)} />
      )}

      {colPrefs.open && <ColumnSettings {...colPrefs.dialogProps} />}
    </div>
  );
}
