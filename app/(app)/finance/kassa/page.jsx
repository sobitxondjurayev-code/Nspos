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
} from "lucide-react";
import { fmtUSD } from "@/lib/demoData";
import ControlDays from "@/components/finance/ControlDays";
import CellSources from "@/components/finance/CellSources";
import { getLedgerStart } from "@/lib/companyData";
import { useAuth } from "@/components/AuthProvider";
import { useLive } from "@/components/DataProvider";
import KassaModal from "@/components/KassaModal";
import {
  KASSAS, kassaIds, WALLETS, WALLET_IDS, walletsOf, categoryLabel,
  kassaBalances, listOps, addOp, removeOp,
  requestTransfer, approveTransfer, rejectTransfer, pendingTransfers,
  kassasOf, canOperate, kassaControl, COMPANY,
} from "@/lib/kassaData";
import { addExpense, expensesInRange, categoryLabel as expenseCategoryLabel } from "@/lib/expensesData";
import { getStaff } from "@/lib/staffData";
import { listDatasets, loadRows } from "@/lib/datasets";
import { billzKassaFlow } from "@/lib/kassaIncome";
import DataSourceModal from "@/components/DataSourceModal";

// ДДС yuklamasi uchun manba ta'rifi — mavjud yuklash oynasi shu
// ko'rinishni kutadi (yo'riqnoma + fayl tekshiruvi).
const DDS_SOURCE = {
  label: "Pul oqimi (ДДС)",
  source: {
    reportId: "cashflow",
    name: "ДДС — Движение денежных средств",
    where: "Billz → Отчеты → Финансы → ДДС",
    steps: [
      "Billz'ga kiring, chap menyudan Отчеты ni oching",
      "Финансы bo'limini tanlang — bu hisobot Товары ichida emas",
      "ДДС (Движение денежных средств) ni oching",
      "Davrni tanlang: hisob boshlangan kundan bugungacha",
      "Скачать bosing va faylni shu yerga tashlang",
    ],
    needs: [["Касса"], ["Тип транзакции"]],
  },
};

const fmtDay = (d) => {
  const [y, m, dd] = String(d).split("-");
  return `${dd}.${m}.${y}`;
};

export default function KassaPage() {
  const { user } = useAuth();
  const [tick, setTick] = useState(0);
  // Boshqa xodim yozgan o'zgarish ham darrov ko'rinsin
  const live = useLive();
  const [modal, setModal] = useState(null);   // { kassa, mode }
  const [upload, setUpload] = useState(false);

  const isOwner = user?.role === "owner";
  const mine = useMemo(() => kassasOf(user), [user, tick, live]);
  const visible = isOwner ? kassaIds() : mine;

  // ДДС yuklamasining qatorlari ro'yxat bilan birga kelmaydi — kassa
  // balansi aynan shundan hisoblangani uchun shu yerda tortiladi.
  const [rowsTick, setRowsTick] = useState(0);
  useEffect(() => {
    const ds = listDatasets().find((d) => d.reportId === "cashflow");
    if (!ds || ds.rows) return;
    let alive = true;
    loadRows(ds.id).then(() => { if (alive) setRowsTick((v) => v + 1); });
    return () => { alive = false; };
  }, []);

  const flow = useMemo(() => billzKassaFlow(null, new Date()), [rowsTick, tick, live]);
  // Ma'lumot necha kun orqada qolgan. Yuklash unutilsa balans jimgina
  // eskirib boradi — shuni ko'rsatib turamiz.
  const staleDays = useMemo(() => {
    if (!flow.ready || !flow.period?.to) return null;
    const last = new Date(flow.period.to + "T00:00:00");
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((now - last) / 86400000));
  }, [flow]);
  const control = useMemo(() => kassaControl(), [rowsTick, tick, live]);
  // Farq ustiga bosilganda ochiladigan kunlik ro'yxat
  const [ctrlDays, setCtrlDays] = useState(null);
  // Kassa summasi bosilganda ochiladigan yozuvlar
  const [src, setSrc] = useState(null);
  const bal = useMemo(() => kassaBalances(new Date()), [tick, rowsTick, live]);
  const pending = useMemo(() => pendingTransfers(), [tick, live]);
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
    return [...kassaOps, ...exp]
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .slice(0, 60);
  }, [tick, visible.join(), live]);

  const refresh = () => setTick((v) => v + 1);

  // Kun oxirida kassani yopish: hamyonlardagi qolgan pulning HAMMASI
  // bitta bosishda rahbarga uzatiladi (Billz'dagi "закрыть кассу" kabi).
  // Har hamyon o'z turi bilan boradi — naqd naqdga, Payme Payme'ga,
  // servis servisga tushadi.
  function closeKassa(k) {
    const b = bal[k];
    const parts = walletsOf(k)
      .map((w) => ({ w, amount: +(b[w] ?? 0).toFixed(2) }))
      .filter((x) => x.amount > 0);
    if (!parts.length) {
      alert(t("Kassada o'tkaziladigan pul yo'q."));
      return;
    }
    const list = parts.map((x) => `${t(WALLETS[x.w])}: ${fmtUSD(x.amount)}`).join("\n");
    if (!confirm(`${t("Kassa yopiladi va quyidagi pul rahbarga o'tkaziladi:")}\n\n${list}\n\n${t("Rahbar tasdiqlaguncha pul \"yo'lda\" turadi.")}`)) return;
    for (const x of parts) {
      requestTransfer({ kassa: k, wallet: x.w, amount: x.amount, staffId: user?.id,
        note: t("Kassa yopildi") });
    }
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
        {t("Kassa kirimi menejerlarning kunlik jadvalidan olinadi (KPI va oylik bo'limi), chiqim esa shu yerda va Xarajatlar bo'limida kiritiladi. Kun oxirida qolgan pul rahbarga o'tkaziladi va u tasdiqlagach asosiy balansga qo'shiladi.")}
      </p>

      {/* ДДС yuklanmagan bo'lsa kassa bo'sh ko'rinadi — sababini aytamiz */}
      {/* ДДС majburiy emas: kassa kunlik jadvaldan ishlaydi. Lekin u
          yuklansa, menejer yozgan raqam Billz bilan solishtiriladi va
          kamomad ko'rinadi. Shuning uchun taklif qilib turamiz. */}
      {isOwner && !flow.ready && (
        <div className="card p-6 mb-6 flex items-start gap-3">
          <Scale size={20} className="text-brand shrink-0 mt-0.5" />
          <div>
            <p className="font-bold mb-1">{t("Kamomadni tekshirmoqchimisiz?")}</p>
            <p className="text-sm font-semibold text-muted mb-2">
              {t("Billz'dan ДДС hisobotini yuklasangiz, menejer kunlik jadvalga yozgan raqam Billz'niki bilan solishtiriladi va farqi ko'rinadi. Kassa busiz ham ishlayveradi — bu faqat nazorat uchun.")}
            </p>
            <button onClick={() => setUpload(true)}
              className="rounded-xl border border-line font-bold px-5 py-2.5 text-sm hover:border-brand">
              {t("ДДС yuklash")}
            </button>
          </div>
        </div>
      )}
      {flow.ready && flow.period && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6">
          <p className="text-sm text-muted font-semibold">
            {tt("Billz ДДС: {a} — {b} · {n} ta harakat", {
              a: fmtDay(flow.period.from), b: fmtDay(flow.period.to), n: flow.rows })}
          </p>
          {/* Yuklash unutilsa balans jimgina eskiradi — ko'rinib tursin */}
          {staleDays > 0 && (
            <span className={`text-sm font-bold px-3 py-1 rounded-lg ${
              staleDays >= 3 ? "bg-danger-soft text-danger" : "bg-warn-soft text-warn"}`}>
              {staleDays === 1
                ? t("Kechagi ma'lumot — bugungisi yuklanmagan")
                : tt("{n} kun orqada — yangilash kerak", { n: staleDays })}
            </span>
          )}
          <button onClick={() => setUpload(true)}
            className="text-sm font-bold text-brand hover:underline">
            {t("Yangi ДДС yuklash")}
          </button>
        </div>
      )}

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
              <div key={p.id} className="flex items-center gap-4 rounded-xl bg-surface px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {t(KASSAS[p.kassa].label)} → {t("Kompaniya")} · {t(WALLETS[p.wallet])}
                  </p>
                  <p className="text-sm text-muted font-semibold">
                    {fmtDay(p.date)}
                    {p.staffId && ` · ${getStaff(p.staffId)?.name ?? ""}`}
                    {p.note && ` · ${p.note}`}
                  </p>
                </div>
                <p className="text-xl font-extrabold shrink-0">{fmtUSD(p.amount)}</p>
                <button onClick={() => { approveTransfer(p.id, user?.id); refresh(); }}
                  className="flex items-center gap-1.5 rounded-xl bg-ok hover:opacity-90 text-white font-bold px-4 py-2.5">
                  <Check size={18} /> {t("Tasdiqlash")}
                </button>
                <button onClick={() => { rejectTransfer(p.id, user?.id); refresh(); }}
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
                      {fmtUSD(b[w])}
                    </span>
                  </div>
                ))}
              </div>

              {b.pending > 0 && (
                <p className="text-sm font-bold text-warn bg-warn-soft rounded-lg px-3 py-2 mb-4">
                  {tt("Yo'lda: {n} — rahbar tasdig'i kutilmoqda", { n: fmtUSD(b.pending) })}
                </p>
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
              {canOp && !main && (
                <button onClick={() => closeKassa(k)}
                  className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold py-2.5">
                  <LockKeyhole size={17} /> {t("Kassani yopish")}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* —— Kamomad nazorati —— */}
      {isOwner && control.ready && control.rows.some((r) => r.hasKpi) && (
        <div className="card overflow-hidden mb-7">
          <div className="px-6 py-5 border-b border-line flex items-center gap-2">
            <Scale size={20} className="text-brand" />
            <p className="text-lg font-extrabold">{t("Kamomad nazorati")}</p>
            <span className="text-sm text-muted font-semibold">
              {tt("{a} — {b}", { a: fmtDay(control.period.from), b: fmtDay(control.period.to) })}
            </span>
          </div>
          <p className="px-6 pt-4 text-sm text-muted font-semibold">
            {t("Chapda — Billz kassaga yozgan pul, o'ngda — menejer KPI jadvalida \"topshirdim\" degan raqam. Ular teng bo'lishi kerak.")}
          </p>
          <table className="w-full mt-2">
            <thead className="bg-surface text-left text-sm">
              <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-20 border-b border-line [&>th]:bg-surface">
                <th className="px-6 py-4 font-bold">{t("Kassa")}</th>
                <th className="px-4 py-4 font-bold text-right">{t("Billz bo'yicha")}</th>
                <th className="px-4 py-4 font-bold text-right">{t("KPI jadvalida")}</th>
                <th className="px-6 py-4 font-bold text-right">{t("Farq")}</th>
              </tr>
            </thead>
            <tbody>
              {control.rows.map((r) => {
                // 1% gacha farq — yaxlitlash va kunlar siljishi, kamomad emas
                const ok = r.pct == null || Math.abs(r.pct) <= 1;
                return (
                  <tr key={r.kassa} className="border-b border-line last:border-0">
                    <td className="px-6 py-4 font-bold">{t(r.label)}</td>
                    <td className="px-4 py-4 text-right font-semibold">{fmtUSD(r.billz)}</td>
                    <td className="px-4 py-4 text-right font-semibold">
                      {r.hasKpi ? fmtUSD(r.said) : <span className="text-muted">{t("kiritilmagan")}</span>}
                    </td>
                    <td className={`px-6 py-4 text-right font-extrabold ${
                      !r.hasKpi ? "text-muted" : ok ? "text-ok" : "text-danger"}`}>
                      {!r.hasKpi ? "—" : (
                        // Ustiga bosilsa — farq qaysi kunlarda chiqqani
                        <button onClick={() => setCtrlDays({ kassa: r.kassa, label: r.label })}
                          className="rounded-lg px-2 -mx-2 py-1 hover:bg-brand-soft hover:text-brand transition-colors">
                          {r.diff > 0 ? "+" : ""}{fmtUSD(r.diff)}
                          {/* Netto farq aldamchi: kam va ko'p bir-birini
                              yeb yuboradi. Shuning uchun ostida ikkalasi
                              alohida turadi. */}
                          {(r.short < -0.01 || r.over > 0.01) && (
                            <span className="block text-sm font-bold">
                              {r.short < -0.01 && (
                                <span className="text-danger">
                                  {fmtUSD(r.short)} <span className="text-muted">({r.shortDays} kun)</span>
                                </span>
                              )}
                              {r.short < -0.01 && r.over > 0.01 && <span className="text-muted"> · </span>}
                              {r.over > 0.01 && (
                                <span className="text-ok">
                                  +{fmtUSD(r.over)} <span className="text-muted">({r.overDays} kun)</span>
                                </span>
                              )}
                            </span>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* —— Harakatlar tarixi —— */}
      <div className="card overflow-hidden">
        <div className="px-6 py-5 border-b border-line">
          <p className="text-lg font-extrabold">{t("Harakatlar")}</p>
        </div>
        <table className="w-full">
          <thead className="bg-surface text-left text-sm">
            <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-20 border-b border-line [&>th]:bg-surface">
              <th className="px-6 py-4 font-bold">{t("Kassa")}</th>
              <th className="px-4 py-4 font-bold">{t("Turi")}</th>
              <th className="px-4 py-4 font-bold">{t("Hamyon")}</th>
              {/* Billz ДДС hisobotida ham "Пользователь" ustuni bor —
                  pulga kim tekkanini bilmasa, jurnalning foydasi yo'q */}
              <th className="px-4 py-4 font-bold">{t("Kim")}</th>
              <th className="px-4 py-4 font-bold">{t("Sana")}</th>
              <th className="px-6 py-4 font-bold text-right">{t("Summa")}</th>
              <th className="px-4 py-4" />
            </tr>
          </thead>
          <tbody>
            {ops.map((o) => {
              const out = o.kind === "out" || (o.kind === "transfer" && o.status === "approved");
              return (
                <tr key={o.id} className="border-b border-line last:border-0 hover:bg-surface/70">
                  <td className="px-6 py-4 font-bold">{t(KASSAS[o.kassa]?.label ?? o.kassa)}</td>
                  <td className="px-4 py-4">
                    <p className="font-semibold">
                      {o.kind === "transfer"
                        ? t("Rahbarga o'tkazma")
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
                  </td>
                  <td className="px-4 py-4 font-semibold">{t(WALLETS[o.wallet])}</td>
                  <td className="px-4 py-4 font-semibold text-muted">
                    {o.staffId ? (getStaff(o.staffId)?.name ?? "—") : "—"}
                  </td>
                  <td className="px-4 py-4 font-semibold text-muted">{fmtDay(o.date)}</td>
                  <td className={`px-6 py-4 text-right font-extrabold ${out ? "text-danger" : "text-ok"}`}>
                    {out ? "−" : "+"}{fmtUSD(o.amount)}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {o.kind !== "transfer" && !o.expense && canOperate(user, o.kassa) && (
                      <button onClick={() => { removeOp(o.id); refresh(); }}
                        className="text-muted hover:text-danger">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {ops.length === 0 && (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-muted font-semibold">
                {t("Hali harakat yo'q. Kunlik kirim KPI jadvali to'ldirilgach o'zi hisoblanadi.")}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {upload && (
        <DataSourceModal
          analysis={DDS_SOURCE}
          onClose={() => setUpload(false)}
          onDone={() => { setUpload(false); setRowsTick((v) => v + 1); refresh(); }}
        />
      )}

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

      {ctrlDays && (
        <ControlDays kassaId={ctrlDays.kassa} label={ctrlDays.label}
          onClose={() => setCtrlDays(null)} />
      )}

      {src && (
        <CellSources from={getLedgerStart()} to={new Date()} colKey="all"
          kassa={src.kassa} label={src.label} dayLabel={t("Hisob boshidan")}
          onClose={() => setSrc(null)} />
      )}
    </div>
  );
}
