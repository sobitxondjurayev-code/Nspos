"use client";
// ══════════════════════════════════════════════════════════════
// MOLIYA — BOSH SAHIFA
// ══════════════════════════════════════════════════════════════
// Hisobotlar bo'limi kabi: bo'lim bosilganda darrov ichki sahifaga
// tashlamaydi, avval umumiy moliyaviy holatni ko'rsatadi.
//
// Har kartochka o'z asosiy raqami bilan turadi — rahbar ichiga
// kirmasdan ham qayerda nima borligini ko'radi va faqat kerakligini
// ochadi. Kassa operatsiyalari jurnali /finance/operations ga ko'chdi.
import { t, tt } from "@/lib/i18n";
import BillzMuhr from "@/components/BillzMuhr";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Wallet, ListChecks, Receipt, Users, Truck, Banknote, TrendingUp,
  Scale, Upload, Package, Clock, ArrowDownLeft, ArrowUpRight, PiggyBank,
  ChevronRight, SlidersHorizontal,
} from "lucide-react";
import { fmtUSD } from "@/lib/demoData";
import { periodRange } from "@/lib/dates";
import { canOpen } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";
import StatCard from "@/components/finance/StatCard";
import Warnings from "@/components/finance/Warnings";
import CellSources from "@/components/finance/CellSources";
import ColumnSettings from "@/components/ColumnSettings";
import { useColumns } from "@/components/useColumns";
import { kassaBalances, moneyFlow } from "@/lib/kassaData";
import { payoutSummary } from "@/lib/payoutsData";
import { overallDebtStats } from "@/lib/debtsData";
import { payablesSummary } from "@/lib/suppliersData";
import { totalExpenses } from "@/lib/expensesData";
import { profitAndLoss } from "@/lib/pnlData";
import { balanceSheet } from "@/lib/balanceData";
import useUploadRows from "@/components/useUploadRows";

const TONES = {
  brand: "bg-brand-soft text-brand",
  green: "bg-ok-soft text-ok",
  amber: "bg-warn-soft text-warn",
  red: "bg-danger-soft text-danger",
};

const TEXT_TONES = {
  green: "text-ok", amber: "text-warn", red: "text-danger", brand: "",
};

export default function FinanceHome() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  // Ko'rsatkich bosilganda ochiladigan yozuvlar ro'yxati
  const [src, setSrc] = useState(null);
  // Raqamlar brauzer xotirasidan va bazadan yig'iladi — serverda ular
  // yo'q. Shuning uchun chizilgunga qadar "—" turadi: aks holda server
  // nol chizadi, brauzer boshqa raqam chizadi va gidratsiya buziladi.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const show = (v) => (mounted ? v : "—");

  // Davr — joriy oy. Bo'lim ichidagi sahifalarda o'z davr tanlagichi bor,
  // bosh sahifada esa bitta oddiy o'lchov yetarli.
  const month = useMemo(() => periodRange("Oy"), []);

  // Kartochkalardagi raqamlar Billz yuklamalariga ham tayanadi (tushum,
  // tannarx, kassa harakati). Qatorlar ro'yxat bilan birga kelmagani
  // uchun ular shu yerda tortiladi va kelgach hisob qayta yuriladi —
  // aks holda "Foyda" faqat xarajatdan iborat bo'lib, zarar ko'rinardi.
  const rows = useUploadRows(["summary", "cashflow", "efficiency"]);

  const bal = useMemo(() => kassaBalances(new Date()), [rows]);
  const flow = useMemo(() => moneyFlow(month.from, month.to), [month, rows]);
  const plan = useMemo(() => payoutSummary(), [rows]);
  const debt = useMemo(() => overallDebtStats(), [rows]);
  const supp = useMemo(() => payablesSummary(), [rows]);
  const exp = useMemo(() => totalExpenses(month.from, month.to), [month, rows]);
  const pnl = useMemo(() => profitAndLoss(month.from, month.to), [month, rows]);
  const sheet = useMemo(() => balanceSheet(new Date()), [rows]);

  // Menejerga faqat O'Z kassasi: boshqa do'konning puli unga tegishli
  // emas va uni ko'rsatish "kompaniyada qancha pul bor" degan javob
  // bo'lib qolardi.
  const cash = +Object.entries(bal)
    .filter(([k]) => isOwner || !user?.storeId || k === user.storeId)
    .reduce((s, [, b]) => s + b.total, 0).toFixed(2);
  const free = +(cash - plan.planned).toFixed(2);

  // —— Bo'limlar ————————————————————————————————————
  // value — kartochkadagi asosiy raqam, hint — bo'lim nima uchunligi.
  const sections = [
    {
      href: "/finance/kassa", icon: Wallet, label: "Kassalar va balans", term: "Cash & bank",
      hint: "Do'kon kassalari va kompaniya balansi",
      value: fmtUSD(cash), tone: "brand",
    },
    {
      href: "/finance/plan", icon: ListChecks, label: "Pul rejasi", term: "Payment schedule",
      hint: "Kimga, qachon va qancha berish kerak",
      value: fmtUSD(plan.planned),
      tone: plan.overdueCount > 0 ? "red" : "amber",
      note: plan.overdueCount > 0
        ? tt("{n} tasi kechikkan", { n: plan.overdueCount })
        : plan.count > 0 ? tt("{n} ta to'lov rejada", { n: plan.count }) : null,
    },
    {
      href: "/finance/operations", icon: Banknote, label: "Kassa operatsiyalari", term: "Cash book",
      hint: "Kunlik kirim-chiqim jurnali",
      value: fmtUSD(flow.out), tone: "red", note: t("Shu oyda chiqim"),
    },
    {
      href: "/finance/expenses", icon: Receipt, label: "Xarajatlar", term: "OPEX",
      hint: "Ijara, kommunal, transport, ovqat",
      value: fmtUSD(exp), tone: "red", note: t("Shu oyda"),
    },
    {
      href: "/finance/payroll", icon: Users, label: "Ish haqi", term: "Payroll",
      hint: "Maosh, foiz va bonuslar",
      // pnl.expenses.payroll — qat'iy maosh + foiz + bonus (usta ulushi
      // xizmat foydasida alohida chegirilgan, bu yerda ikki marta emas)
      value: fmtUSD(pnl.expenses?.payroll ?? 0), tone: "amber", note: t("Shu oyda"),
    },
    {
      href: "/finance/debts", icon: Clock, label: "Qarz to'lovlari", term: "Receivables (AR)",
      hint: "Mijozlar bizga qarzdor",
      value: fmtUSD(debt.openAmount ?? 0), tone: "green",
    },
    // Yetkazib beruvchilar hozircha yuritilmaydi — kartochka faqat
    // yozuv paydo bo'lganda chiqadi (bo'sh bo'lim joy egallamasin).
    ...(supp.totalOpen > 0 || supp.overdueCount > 0 ? [{
      href: "/finance/payables", icon: Truck, label: "Yetkazib beruvchilar", term: "Payables (AP)",
      hint: "Biz qarzdormiz",
      value: fmtUSD(supp.totalOpen), tone: "red",
      note: supp.overdueCount > 0 ? tt("{n} tasi kechikkan", { n: supp.overdueCount }) : null,
    }] : []),
    {
      href: "/finance/pnl", icon: TrendingUp, label: "Foyda va pul oqimi", term: "P&L · Cash flow",
      hint: "Tushum, tannarx, sof foyda",
      value: fmtUSD(pnl.netProfit), tone: pnl.netProfit >= 0 ? "green" : "red",
      note: t("Shu oyda sof foyda"),
    },
    {
      href: "/finance/balance", icon: Scale, label: "Balans", term: "Balance sheet",
      hint: "Aktiv va passiv",
      value: fmtUSD(sheet.totalAssets), tone: "brand", note: t("Jami aktiv"),
    },
    {
      href: "/finance/import", icon: Upload, label: "Billz'dan yuklash", term: "Import",
      hint: "ДДС va boshqa hisobotlarni yuklash",
    },
    {
      href: "/finance/cost", icon: Package, label: "Import va tannarx", term: "Landed cost",
      hint: "Keltirilgan tovar tannarxi",
    },
  ].filter((s) => canOpen(s.href, user));

  // —— Tepadagi ko'rsatkichlar ————————————————————————
  // Tartibini va qaysi biri ko'rinishini rahbar o'zi belgilaydi
  // (jadval ustunlaridagi kabi, sozlama shu brauzerda saqlanadi).
  const ALL_STATS = useMemo(() => [
    { key: "cash", label: "Hozir kassalarda", icon: Wallet,
      value: fmtUSD(cash), hint: t("Do'konlar va kompaniya balansi") },
    { key: "in", label: "Shu oyda kirgan", icon: ArrowDownLeft, tone: "green",
      value: fmtUSD(flow.in), src: "in" },
    { key: "out", label: "Shu oyda chiqqan", icon: ArrowUpRight, tone: "red",
      value: fmtUSD(flow.out), src: "out" },
    { key: "free", label: "To'lovlardan keyin qoladi", icon: PiggyBank,
      tone: free >= 0 ? "green" : "red", value: fmtUSD(free),
      hint: plan.planned > 0
        ? tt("Berishim kerak: {n}", { n: fmtUSD(plan.planned) })
        : t("Rejada to'lov yo'q") },
    { key: "profit", label: "Shu oyda sof foyda", icon: TrendingUp,
      tone: pnl.netProfit >= 0 ? "green" : "red", value: fmtUSD(pnl.netProfit) },
    { key: "debt", label: "Mijozlar qarzi", icon: Clock, tone: "amber",
      value: fmtUSD(debt.openAmount ?? 0), hint: t("Hali qaytmagan pul") },
    { key: "expenses", label: "Shu oyda xarajat", icon: Receipt, tone: "red",
      value: fmtUSD(exp), src: "out" },
    { key: "assets", label: "Jami aktiv", icon: Scale,
      value: fmtUSD(sheet.totalAssets), hint: t("Kassa, ombor va qarzlar bilan") },
  ], [cash, flow.in, flow.out, free, plan.planned, pnl.netProfit, debt.openAmount, exp, sheet.totalAssets]);

  // Standart holat: dastlabki to'rttasi ko'rinadi, qolgani zaxirada —
  // kerak bo'lsa rahbar "Ko'rsatkichlar" dan yoqadi
  const statPrefs = useColumns("finance-stats", ALL_STATS,
    { defaultHidden: ["profit", "debt", "expenses", "assets"] });
  const stats = statPrefs.columns;

  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight mb-2">{t("Moliya")}</h1>
      <BillzMuhr className="mb-4" />
      <p className="text-muted font-semibold mb-7 max-w-3xl">
        {t("Kompaniyaning bugungi moliyaviy holati. Har bo'lim o'z asosiy raqami bilan turadi — kerakligini bosib ochasiz.")}
      </p>

      {/* Hisobdagi nomuvofiqliklar — bo'lsa shu yerda turadi */}
      <Warnings />

      {/* —— Asosiy ko'rsatkichlar ——
          Faqat rahbarga: bular butun kompaniya bo'yicha (hamma do'kon
          kassasi, oborot). Menejer o'z kassasidan boshqasini ko'rmasligi
          kerak — unga faqat pastdagi bo'lim kartochkalari chiqadi. */}
      {isOwner && (<>
        <div className="flex justify-end mb-3">
          <button onClick={statPrefs.openSettings}
            className="flex items-center gap-2 rounded-xl border border-line px-4 py-2 font-bold hover:border-brand hover:text-brand transition-colors">
            <SlidersHorizontal size={16} /> {t("Ko'rsatkichlar")}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
          {stats.map((s) => (
            <StatCard key={s.key} icon={s.icon} label={s.label} tone={s.tone}
              value={show(s.value)} hint={s.hint}
              onOpen={s.src ? () => setSrc({ key: s.src, label: s.label }) : undefined} />
          ))}
        </div>
      </>)}

      {/* —— Bo'limlar —— */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {sections.map((s) => (
          <Link key={s.href} href={s.href}
            className="card p-6 flex items-start gap-4 hover:border-brand transition-colors">
            <span className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              TONES[s.tone ?? "brand"]}`}>
              <s.icon size={22} />
            </span>

            <div className="flex-1 min-w-0">
              <p className="text-lg font-extrabold text-ink mb-1 flex items-center gap-2 flex-wrap">
                {t(s.label)}
                {/* Buxgalteriyadagi rasmiy nomi — hisobchi yoki investor
                    bilan gaplashganda bo'lim qaysi hisobot ekani aniq
                    bo'lsin (P&L, Cash flow, Balance sheet…) */}
                {s.term && (
                  <span className="text-[0.6875rem] font-bold uppercase tracking-wide text-muted
                    bg-track rounded-md px-1.5 py-0.5 shrink-0">{s.term}</span>
                )}
              </p>
              <p className="text-sm text-muted font-semibold">{t(s.hint)}</p>
            </div>

            {/* Raqami bor bo'limlar uni o'ng chetda ko'rsatadi */}
            <div className="text-right shrink-0">
              {s.value ? (
                <>
                  <p className={`text-xl font-extrabold ${TEXT_TONES[s.tone] ?? ""}`}>{show(s.value)}</p>
                  {s.note && mounted && <p className="text-sm text-muted font-semibold">{s.note}</p>}
                </>
              ) : (
                <ChevronRight size={20} className="text-muted mt-2" />
              )}
            </div>
          </Link>
        ))}
      </div>

      {statPrefs.open && (
        <ColumnSettings {...statPrefs.dialogProps}
          title="Ko'rsatkichlarni sozlash"
          countLabel="{n} ta ko'rsatkich ko'rinadi"
          hint="Ko'rsatkichni ushlab tortsangiz joyi almashadi. Ko'z belgisini bossangiz yashirinadi — o'chib ketmaydi, xohlagan payt qaytarasiz." />
      )}

      {src && (
        <CellSources from={month.from} to={month.to} colKey={src.key} label={src.label}
          dayLabel={t("Shu oyda")} onClose={() => setSrc(null)} />
      )}
    </div>
  );
}
