"use client";
// ══════════════════════════════════════════════════════════════
// KASSALAR VA ASOSIY BALANS
// ══════════════════════════════════════════════════════════════
// Billz'dagi "закрыть кассу" bilan bir xil model: har do'konning o'z
// kassasi, ustiga kompaniyaning asosiy balansi. Kirim-chiqim Billz ДДС
// eksportidan keladi, do'kon menejeri qolgan pulni rahbarga o'tkazadi,
// rahbar tasdiqlagach pul asosiy balansga qo'shiladi.
import { t, tt } from "@/lib/i18n";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Wallet, Send, Plus, Check, X as XIcon, Clock, Building2, Trash2, Scale, LockKeyhole,
  CalendarDays, AlertTriangle, ChevronRight,
} from "lucide-react";
import { fmtUSD } from "@/lib/demoData";
import { fmtDate } from "@/lib/dates";
import CellSources from "@/components/finance/CellSources";
import { getLedgerStart } from "@/lib/companyData";
import { useAuth } from "@/components/AuthProvider";
import { useLive, useToliq } from "@/components/DataProvider";
import KassaBalanceChart from "@/components/finance/KassaBalanceChart";
import KassaModal from "@/components/KassaModal";
import Manfiy from "@/components/ui/Manfiy";
import Warnings from "@/components/finance/Warnings";
import CloseKassaModal from "@/components/CloseKassaModal";
import {
  KASSAS, kassaIds, WALLETS, WALLET_IDS, walletsOf, categoryLabel,
  kassaBalances, listOps, addOp, removeOp,
  requestTransfer, pendingGroups, approveGroup, rejectGroup,
  closeDay, cancelClose, unclosedDays, negativeDays, CLOSE,
  kassasOf, canOperate, COMPANY,
} from "@/lib/kassaData";
import { addExpense, expensesInRange, categoryLabel as expenseCategoryLabel } from "@/lib/expensesData";
import { getStaff } from "@/lib/staffData";
import DataTable from "@/components/ui/DataTable";
import Button from "@/components/ui/Button";

const fmtDay = (d) => {
  const [y, m, dd] = String(d).split("-");
  return `${dd}.${m}.${y}`;
};

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function KassaPage() {
  const { user } = useAuth();
  const [tick, setTick] = useState(0);
  // Boshqa xodim yozgan o'zgarish ham darrov ko'rinsin
  const live = useLive();
  // Og'ir jadvallar (chek, qarz to'lovi) kelguncha balans qisman —
  // "minusda" degan ogohlantirish shu paytda YOLG'ON bo'ladi
  const toliq = useToliq();
  const [modal, setModal] = useState(null);   // { kassa, mode }

  const isOwner = user?.role === "owner";
  const mine = useMemo(() => kassasOf(user), [user, tick, live]);
  const visible = isOwner ? kassaIds() : mine;

  const rowsTick = live;
  // Farq ustiga bosilganda ochiladigan kunlik ro'yxat
  // Kassa summasi bosilganda ochiladigan yozuvlar
  const [src, setSrc] = useState(null);
  const bal = useMemo(() => kassaBalances(new Date()), [tick, rowsTick, live]);
  // Grafik oynasi: oxirgi 30 kun, LEKIN hisob boshlanishidan oldinga
  // o'tmaydi. Undan oldingi kunlarda balans NOL bo'lib chiqadi va
  // grafik "nolьdan 47 344 gacha o'sish" degan yolg'on ko'rsatardi —
  // aslida u shunchaki hisob boshlanmagan davr edi.
  //
  // `useMemo` shart: yangi Date har chizishda yangi obyekt bo'lib,
  // grafik cheksiz qayta hisoblanardi.
  const grafikDan = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 29); d.setHours(0, 0, 0, 0);
    const bosh = new Date(getLedgerStart() + "T00:00:00");
    return d < bosh ? bosh : d;
  }, [live]);
  // Tasdiq kutayotganlar KUN bo'yicha guruhlanadi: bir kun yopilganda
  // uchtagacha yozuv tug'iladi (naqd, Payme, servis), rahbar esa kunni
  // tasdiqlaydi — hamyonni emas.
  const pending = useMemo(() => pendingGroups(), [tick, live]);
  // Qaysi kassada necha kun yopilmagan — kartochkada ogohlantirish
  const openDays = useMemo(() => Object.fromEntries(
    kassaIds().filter((k) => !KASSAS[k]?.main).map((k) => [k, unclosedDays(k)])
  ), [tick, rowsTick, live]);
  // Qaysi kunda hamyon minusga tushgan — kirim kam yozilganmi yoki
  // kassadagidan ortiq xarajat qilinganmi, rahbar tekshirsin
  const minusDays = useMemo(() => Object.fromEntries(
    kassaIds().filter((k) => !KASSAS[k]?.main).map((k) => [k, negativeDays(k)])
  ), [tick, rowsTick, live]);
  // Harakatlar: kassa yozuvlari + xarajatlar birga. Menejer o'zi
  // kiritgan chiqimni shu yerda ko'rishi kerak — u Xarajatlar moduliga
  // yozilsa ham, pul aynan shu kassadan chiqqan.
  const ops = useMemo(() => {
    const kassaOps = listOps().filter((o) => visible.includes(o.kassa));
    const exp = expensesInRange(new Date("2000-01-01T00:00:00"), new Date())
      .filter((e) => visible.includes(e.kassa))
      .map((e) => ({
        id: "exp-" + e.id, kassa: e.kassa, wallet: e.method, kind: "out",
        amount: e.amount, date: e.date, note: e.note, staffId: null,
        category: e.category, expense: true,
      }));
    // Kesish shu yerda QILINMAYDI: aks holda komponent haqiqiy sonni
    // bilmaydi va "60 tadan ko'pi ko'rsatilmadi" deb ayta olmaydi.
    // Ilgari shunday edi — jadval jimgina 60 qatorda tugardi.
    return [...kassaOps, ...exp]
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [tick, visible.join(), live]);

  const OPS_LIMIT = 60;

  const refresh = () => setTick((v) => v + 1);

  // Kassa KUN bo'yicha yopiladi: qaysi kun yopilayotgani tanlanadi va
  // aynan o'sha kunning qoldig'i rahbarga uzatiladi. Ilgari hisob
  // boshidan yig'ilgan hamma pul bir bosishda ketardi — qaysi kunniki
  // ekani yo'qolar, yopilmay qolgan kun esa ko'rinmasdi.
  const [closing, setClosing] = useState(null);   // { kassa, date }

  function confirmClose(day, note) {
    closeDay({ kassa: closing.kassa, date: day, staffId: user?.id, note });
    setClosing(null);
    refresh();
  }

  function undoClose(day) {
    if (!confirm(t("Yopish bekor qilinsinmi? Pul kassaga qaytadi."))) return;
    cancelClose(closing.kassa, day);
    setClosing(null);
    refresh();
  }

  function save(data) {
    const { kind, wallet, amount, category, date, note, amountSom, rateUsed } = data;
    const kassa = modal.kassa;

    if (kind === "transfer") {
      requestTransfer({ kassa, wallet, amount, date, note, staffId: user?.id });
    } else if (kind === "out" && kassa !== COMPANY) {
      // Do'kon kassasidan chiqim — bu XARAJAT. Xarajatlar moduliga
      // yoziladi: shunda ham kassa kamayadi, ham foyda hisobiga tushadi.
      // Kassa yozuvi sifatida takrorlansa, pul ikki marta ayirilardi.
      // amountSom/rateUsed ham uzatiladi — ro'yxatda summa aynan
      // kiritilgan so'mda ko'rinsin, dollardan qaytarib hisoblanmasin
      addExpense({ date, category, storeId: kassa, amount, amountSom, rateUsed,
        method: wallet, kassa, note });
    } else {
      // Chiqim so'mda kiritiladi — kiritilgan raqam ham saqlanadi
      addOp({ kassa, kind, wallet, amount, amountSom, rateUsed, category, date, note,
        staffId: user?.id });
    }
    setModal(null);
    refresh();
  }

  if (!visible.length) {
    return (
      <div className="card p-12 text-center max-w-xl mx-auto mt-16">
        <p className="text-xl font-extrabold mb-2">{t("Sizga kassa biriktirilmagan")}</p>
        <p className="text-muted font-semibold">
          {t("Kassa xodimning do'koniga qarab beriladi. Rahbar Boshqaruv bo'limida sizga do'kon biriktirishi kerak.")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight mb-2">{t("Kassalar va balans")}</h1>
      <p className="text-muted font-semibold mb-7 max-w-3xl">
        {t("Kassa kirimi menejerlarning kunlik jadvalidan olinadi (KPI va oylik bo'limi), chiqim esa shu yerda va Xarajatlar bo'limida kiritiladi. Kassa har kun alohida yopiladi: o'sha kunning qoldig'i rahbarga topshiriladi va u tasdiqlagach asosiy balansga qo'shiladi. Qaysi kun yopilgani, qancha bilan yopilgani va yopilmay qolgani \"Kunlar\" ichida ko'rinadi.")}
      </p>

      {/* Hisobdagi nomuvofiqliklar — menejer ham ko'radi. Billz
          ma'lumoti to'liq kelmaguncha TEKSHIRILMAYDI: 2026-09-03 da
          yuklanish paytida "Optim naqd minusda −61 367 $" chiqqan edi. */}
      {toliq ? <Warnings /> : (
        <p className="mb-6 text-sm font-bold text-muted animate-pulse">
          {t("Nomuvofiqliklar Billz ma'lumoti to'liq kelgach tekshiriladi…")}
        </p>
      )}


      {/* Qoldiq o'syaptimi yoki kamayyaptimi — jadvaldan buni ko'z
          bilan topib bo'lmaydi. Oxirgi 30 kun; davr tanlagichi
          qo'yilmadi, chunki bu sahifa "bugungi holat" haqida. */}
      <KassaBalanceChart from={grafikDan} to={new Date()} live={live} />

      {/* —— Tasdiq kutayotgan o'tkazmalar —— */}
      {isOwner && pending.length > 0 && (
        <div className="card p-6 mb-6 border-2 border-warn">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={20} className="text-warn" />
            <p className="text-lg font-extrabold">{t("Tasdiq kutmoqda")}</p>
            <span className="bg-warn-soft text-warn text-sm font-bold px-2.5 py-0.5 rounded-lg">
              {pending.length}
            </span>
          </div>
          <div className="space-y-3">
            {pending.map((p) => (
              <div key={p.key} className="flex items-center gap-4 rounded-xl bg-surface px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {t(KASSAS[p.kassa]?.label ?? p.kassa)} → {t("Kompaniya")}
                    {p.close && (
                      <span className="ml-2 text-sm font-bold text-brand">{t("kun yopildi")}</span>
                    )}
                  </p>
                  <p className="text-sm text-muted font-semibold">
                    {fmtDay(p.date)}
                    {p.staffId && ` · ${getStaff(p.staffId)?.name ?? ""}`}
                    {" · "}
                    {p.items.map((i) => `${t(WALLETS[i.wallet])} ${fmtUSD(i.amount)}`).join(" · ")}
                    {p.note && ` · ${p.note}`}
                  </p>
                </div>
                <p className="text-xl font-extrabold shrink-0">{fmtUSD(p.total)}</p>
                <button onClick={() => { approveGroup(p, user?.id); refresh(); }}
                  className="flex items-center gap-1.5 rounded-xl bg-ok hover:opacity-90 text-white font-bold px-4 py-2.5">
                  <Check size={18} /> {t("Tasdiqlash")}
                </button>
                <button onClick={() => { rejectGroup(p, user?.id); refresh(); }}
                  className="flex items-center gap-1.5 rounded-xl border border-line font-bold px-4 py-2.5 hover:border-danger hover:text-danger">
                  <XIcon size={18} /> {t("Rad etish")}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* —— Kassa kartochkalari —— */}
      <div className={`grid gap-5 mb-7 ${
        visible.length > 1 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 max-w-md"}`}>
        {visible.map((k) => {
          const b = bal[k];
          const main = KASSAS[k].main;
          const canOp = main ? isOwner : canOperate(user, k);
          return (
            <div key={k} className={`card p-6 ${main ? "border-2 border-brand" : ""}`}>
              <div className="flex items-center gap-2 mb-1">
                {main ? <Building2 size={18} className="text-brand" /> : <Wallet size={18} className="text-brand" />}
                <p className="font-extrabold">{t(KASSAS[k].label)}</p>
              </div>
              <p className="text-sm text-muted font-semibold mb-4">{t(KASSAS[k].hint)}</p>

              {/* Ustiga bosilsa — shu kassaga qaysi yozuvlardan pul
                  kirgani va chiqqani ochiladi */}
              <button onClick={() => setSrc({ kassa: k, label: KASSAS[k].label })}
                className="text-3xl font-extrabold mb-4 block rounded-lg px-2 -mx-2 hover:bg-brand-soft hover:text-brand transition-colors">
                {fmtUSD(b.total)}
              </button>

              <div className="space-y-1.5 mb-4">
                {/* B2B kassada servis hamyoni ko'rsatilmaydi */}
                {walletsOf(k).map((w) => (
                  <div key={w} className="flex items-baseline justify-between gap-3 font-semibold text-[0.9375rem]">
                    <span className="text-muted shrink-0">{t(WALLETS[w])}</span>
                    <span className={`font-bold tabular-nums ${b[w] < 0 ? "text-danger" : ""}`}>
                      <Manfiy v={b[w]} sabab="hamyon">{fmtUSD(b[w])}</Manfiy>
                    </span>
                  </div>
                ))}
              </div>

              {b.pending > 0 && (
                <p className="text-sm font-bold text-warn bg-warn-soft rounded-lg px-3 py-2 mb-4">
                  {tt("Yo'lda: {n} — rahbar tasdig'i kutilmoqda", { n: fmtUSD(b.pending) })}
                </p>
              )}

              {/* Yopilmagan kunlar — kassaning eng muhim holati.
                  Kunma-kun daftar shu yerdan ochiladi. */}
              {!main && (
                <Link href={`/finance/kassa/${k}`}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 mb-4 text-sm font-bold transition-colors ${
                    openDays[k]?.length
                      ? "bg-danger-soft text-danger hover:opacity-90"
                      : "bg-ok-soft text-ok hover:opacity-90"}`}>
                  {openDays[k]?.length ? <AlertTriangle size={16} /> : <Check size={16} />}
                  <span className="flex-1">
                    {openDays[k]?.length
                      ? tt("{n} kun yopilmagan", { n: openDays[k].length })
                      : t("Hamma kun yopilgan")}
                  </span>
                  <ChevronRight size={16} />
                </Link>
              )}

              {/* Minusda qolgan kunlar. Kun yopilganda faqat musbat
                  qoldiq topshiriladi, minus esa kassada qotib qoladi —
                  shuning uchun uni aytib turish kerak: kirim kam
                  yozilganmi yoki ortiqcha xarajat qilinganmi. */}
              {!main && minusDays[k]?.length > 0 && (
                <Link href={`/finance/kassa/${k}`}
                  className="flex items-start gap-2 rounded-lg px-3 py-2 mb-4 text-sm font-bold
                    bg-warn-soft text-warn hover:opacity-90 transition-opacity">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span className="flex-1">
                    {minusDays[k].map((d) => tt("{d} — {w} {n} minusda", {
                      d: fmtDate(new Date(d.date + "T12:00:00")),
                      w: t(WALLETS[d.wallet]),
                      n: fmtUSD(Math.abs(d.amount)),
                    })).join(" · ")}
                    <span className="block font-semibold opacity-80">
                      {t("O'sha kunning kirimi to'liq yozilganini tekshiring")}
                    </span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 mt-0.5" />
                </Link>
              )}

              {canOp && (
                <div className="flex gap-2">
                  <button onClick={() => setModal({ kassa: k, mode: "in" })}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-line font-bold py-2.5 hover:border-brand">
                    <Plus size={17} /> {isOwner ? t("Kirim/Chiqim") : t("Chiqim")}
                  </button>
                  {!main && (
                    <button onClick={() => setModal({ kassa: k, mode: "transfer" })}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-line font-bold py-2.5 hover:border-brand">
                      <Send size={17} /> {t("Rahbarga")}
                    </button>
                  )}
                </div>
              )}
              {!main && (
                <div className="mt-2 flex gap-2">
                  {canOp && (
                    <button onClick={() => setClosing({ kassa: k, date: iso(new Date()) })}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold py-2.5">
                      <LockKeyhole size={17} /> {t("Kunni yopish")}
                    </button>
                  )}
                  <Link href={`/finance/kassa/${k}`}
                    className={`flex items-center justify-center gap-2 rounded-xl border border-line font-bold py-2.5 hover:border-brand ${
                      canOp ? "px-4" : "flex-1"}`}>
                    <CalendarDays size={17} /> {t("Kunlar")}
                  </Link>
                </div>
              )}
              {main && (
                <Link href={`/finance/kassa/${k}`}
                  className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl border border-line font-bold py-2.5 hover:border-brand">
                  <CalendarDays size={17} /> {t("Kunlar bo'yicha")}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* —— Harakatlar tarixi —— */}
      <div className="card overflow-auto max-h-[70vh]">
        <div className="px-6 py-5 border-b border-line">
          <p className="text-lg font-extrabold">{t("Harakatlar")}</p>
        </div>
        <DataTable
          id="kassa-ops"
          name={t("Kassa harakatlari")}
          rows={ops}
          rowKey={(o) => o.id}
          limit={OPS_LIMIT}
          boshSort={{ key: "sana", dir: "desc" }}
          minWidth="60rem"
          maxHeight="60vh"
          empty={{ title: "Hali harakat yo'q",
                   hint: "Kunlik kirim KPI jadvali to'ldirilgach o'zi hisoblanadi" }}
          columns={[
            { key: "kassa", label: "Kassa", locked: true,
              value: (o) => t(KASSAS[o.kassa]?.label ?? o.kassa),
              cell: (o) => <span className="font-bold">{t(KASSAS[o.kassa]?.label ?? o.kassa)}</span> },
            {
              key: "turi", label: "Turi",
              value: (o) => (o.kind === "transfer"
                ? (o.category === CLOSE ? t("Kun yopildi") : t("Rahbarga o'tkazma"))
                : o.expense ? t(expenseCategoryLabel(o.category)) : t(categoryLabel(o.category))),
              cell: (o) => (
                <>
                  <p className="font-semibold">
                    {o.kind === "transfer"
                      ? (o.category === CLOSE
                          ? tt("Kun yopildi · {d}", { d: fmtDay(o.date) })
                          : t("Rahbarga o'tkazma"))
                      : o.expense
                        ? t(expenseCategoryLabel(o.category))
                        : t(categoryLabel(o.category))}
                  </p>
                  {o.kind === "transfer" && (
                    <span className={`text-sm font-bold ${
                      o.status === "approved" ? "text-ok"
                        : o.status === "rejected" ? "text-danger" : "text-warn"}`}>
                      {t(o.status === "approved" ? "Tasdiqlangan"
                        : o.status === "rejected" ? "Rad etilgan" : "Kutilmoqda")}
                    </span>
                  )}
                  {o.note && <p className="text-sm text-muted">{o.note}</p>}
                </>
              ),
            },
            { key: "hamyon", label: "Hamyon", value: (o) => t(WALLETS[o.wallet]),
              cell: (o) => <span className="font-semibold">{t(WALLETS[o.wallet])}</span> },
            /* Billz ДДС hisobotida ham "Пользователь" ustuni bor —
               pulga kim tekkanini bilmasa, jurnalning foydasi yo'q */
            { key: "kim", label: "Kim",
              value: (o) => (o.staffId ? (getStaff(o.staffId)?.name ?? "—") : "—"),
              cell: (o) => <span className="font-semibold text-muted">
                {o.staffId ? (getStaff(o.staffId)?.name ?? "—") : "—"}</span> },
            { key: "sana", label: "Sana", value: (o) => o.date,
              cell: (o) => <span className="font-semibold text-muted">{fmtDay(o.date)}</span> },
            {
              key: "summa", label: "Summa", right: true,
              // Chiqim MANFIY qiymat bilan saralanadi — aks holda
              // "eng katta summa" da kirim va chiqim aralashib ketadi
              value: (o) => (o.kind === "out" || (o.kind === "transfer" && o.status === "approved")
                ? -o.amount : o.amount),
              cell: (o) => {
                const out = o.kind === "out" || (o.kind === "transfer" && o.status === "approved");
                return <span className={`font-extrabold ${out ? "text-danger" : "text-ok"}`}>
                  {out ? "−" : "+"}{fmtUSD(o.amount)}
                </span>;
              },
              total: (rows) => {
                const kirim = rows.filter((o) => !(o.kind === "out" || (o.kind === "transfer" && o.status === "approved")))
                  .reduce((a, o) => a + o.amount, 0);
                const chiqim = rows.filter((o) => o.kind === "out" || (o.kind === "transfer" && o.status === "approved"))
                  .reduce((a, o) => a + o.amount, 0);
                return (
                  <>
                    <span className="text-ok">+{fmtUSD(kirim)}</span>
                    <span className="block text-danger">−{fmtUSD(chiqim)}</span>
                  </>
                );
              },
            },
            {
              key: "harakat", label: "Harakat", harakat: true, right: true, width: "4rem",
              cell: (o) => (o.kind !== "transfer" && !o.expense && canOperate(user, o.kassa) && (
                <Button olcham="kichik" korinish="yassi" icon={Trash2}
                  onClick={() => { removeOp(o.id); refresh(); }}
                  className="text-muted hover:text-danger" />
              )),
            },
          ]}
        />
      </div>


      {modal && (
        <KassaModal
          kassa={modal.kassa}
          mode={modal.mode}
          balance={bal[modal.kassa]}
          canIncome={isOwner}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}

      {closing && (
        <CloseKassaModal kassa={closing.kassa} date={closing.date}
          onClose={() => setClosing(null)}
          onConfirm={confirmClose}
          onCancelClose={undoClose} />
      )}


      {src && (
        <CellSources from={getLedgerStart()} to={new Date()} colKey="all"
          kassa={src.kassa} label={src.label} dayLabel={t("Hisob boshidan")}
          onClose={() => setSrc(null)} />
      )}
    </div>
  );
}
