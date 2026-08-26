"use client";
import { t, tt } from "@/lib/i18n";
import { useMemo, useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  Wallet, TrendingUp, Users, ShieldCheck, Clock, CalendarOff, Target,
  ChevronLeft, ChevronRight, Settings2, Plus, Trash2, Smile,
  ArrowLeft, ChevronRight as Arrow, Camera, Trophy, Medal, Award, Star, Pencil, MessageSquare,
  SlidersHorizontal, CalendarDays,
} from "lucide-react";
import NumberField from "@/components/NumberField";
import NpsModal from "@/components/NpsModal";
import SortTh, { useSort } from "@/components/SortTh";
import ColumnSettings from "@/components/ColumnSettings";
import { useColumns } from "@/components/useColumns";
import ExportButton from "@/components/ExportButton";
import FilterBar, { applyFilters } from "@/components/FilterBar";
import { listStaff } from "@/lib/staffData";
import { PERIODS, periodRange, fmtDate } from "@/lib/dates";
import DateRangePicker from "@/components/DateRangePicker";
import { listNps, npsForInstaller, npsDayCounts, productAvg, addNps, updateNps, removeNps } from "@/lib/npsData";
import { useAuth } from "@/components/AuthProvider";
import { useLive } from "@/components/DataProvider";
import { can } from "@/lib/auth";
import {
  computeMonth, computeDay, listDays, saveDay, savePlan, saveRules,
  monthKey, todayKey, isRevisionDay, isPayDay, isPayAnyDayMonth, PAY_DAYS, KPI_TYPES, MANAGER_TYPES, typeOf,
  getType, setType, hasType, setInstallerRate, setInstallerNps, installerRange,
  BILLZ_COLS,
} from "@/lib/kpiData";

const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
const WEEK = ["Yak", "Du", "Se", "Cho", "Pay", "Ju", "Sha"];

const som = (n) => Math.round(n).toLocaleString("ru-RU");
// Davr tanlagichi Date qaytaradi, jadvaldagi sana esa "2026-08-01".
// Solishtirishdan oldin ikkisi bir ko'rinishga keltiriladi.
const dayKey = (d) => (d instanceof Date
  ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  : String(d ?? "").slice(0, 10));
const usd = (n) => (+n || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

// Bonus qismlarining ko'rinishi (nomi va belgisi)
const PART_META = {
  sales: { label: "Savdo hajmi", icon: TrendingUp },
  collection: { label: "Pul qaytishi", icon: Wallet },
  akb: { label: "AKB — aktiv mijozlar", icon: Users },
  nps: { label: "NPS — mijoz mamnunligi", icon: Smile },
  cameras: { label: "Kamera o'rnatish", icon: Camera },
  revision: { label: "Reviziya", icon: ShieldCheck },
  late: { label: "Kech qolish", icon: Clock },
  dayOff: { label: "Dam olish", icon: CalendarOff },
  combo: { label: "Ikkovi to'liq (qo'shimcha)", icon: Award },
};

const STATUS_TONE = {
  ahead: "bg-ok-soft text-ok", close: "bg-warn-soft text-warn",
  behind: "bg-danger-soft text-danger", none: "bg-track text-muted",
};
const STATUS_TEXT = {
  ahead: "Oldinda", close: "Yaqin", behind: "Orqada", none: "Ma'lumot yo'q",
};

// ══════════════════════════════════════════════════════════════
// Qoidalar tahriri — tur bo'yicha (faqat rahbar ko'radi)
// ══════════════════════════════════════════════════════════════
function Num({ label, value, onChange, hint }) {
  return (
    <label className="block">
      <span className="block text-sm font-bold mb-2">{t(label)}</span>
      <NumberField value={value ?? 0} onChange={onChange} />
      {hint && <span className="block text-sm text-muted font-semibold mt-1">{t(hint)}</span>}
    </label>
  );
}

// Har bir bonus qismi uchun qoida bloki
function PartRule({ partKey, r, onRule }) {
  const box = (title, children) => (
    <div>
      <p className="font-extrabold mb-3">{t(title)}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{children}</div>
    </div>
  );

  if (partKey === "collection" || partKey === "nps") {
    const o = r[partKey]; const title = partKey === "nps" ? "NPS bonusi" : "Pul qaytishi";
    return box(title, <>
      <Num label="Bonus (so'm)" value={o.bonus}
        onChange={(v) => onRule({ [partKey]: { ...o, bonus: v } })} />
      <Num label="To'liq (%)" value={Math.round(o.full * 100)}
        onChange={(v) => onRule({ [partKey]: { ...o, full: v / 100 } })} />
      <Num label="Yarim (%)" value={Math.round(o.partial * 100)}
        onChange={(v) => onRule({ [partKey]: { ...o, partial: v / 100 } })} />
    </>);
  }
  if (partKey === "akb") {
    const o = r.akb;
    return box("AKB", <>
      <Num label="Bonus (so'm)" value={o.bonus} onChange={(v) => onRule({ akb: { ...o, bonus: v } })} />
      <Num label="Eng kam (%)" value={Math.round(o.min * 100)} onChange={(v) => onRule({ akb: { ...o, min: v / 100 } })} />
      <Num label="Eng ko'p (%)" value={Math.round(o.max * 100)} onChange={(v) => onRule({ akb: { ...o, max: v / 100 } })} />
    </>);
  }
  if (partKey === "revision") {
    const o = r.revision;
    return (
      <div>
        <p className="font-extrabold mb-3">{t("Reviziya")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Num label="Bonus (so'm)" value={o.bonus} onChange={(v) => onRule({ revision: { ...o, bonus: v } })} />
          <Num label="Yarim bonus ($ gacha)" value={o.halfUpTo} onChange={(v) => onRule({ revision: { ...o, halfUpTo: v } })} />
        </div>
      </div>
    );
  }
  if (partKey === "late") {
    const o = r.late;
    return box("Kech qolish", <>
      <Num label="Bonus (so'm)" value={o.bonus} onChange={(v) => onRule({ late: { ...o, bonus: v } })} />
      <Num label="To'liq (kungacha)" value={o.fullUpTo} onChange={(v) => onRule({ late: { ...o, fullUpTo: v } })} />
      <Num label="Yarim (kungacha)" value={o.partialUpTo} onChange={(v) => onRule({ late: { ...o, partialUpTo: v } })} />
    </>);
  }
  if (partKey === "dayOff") {
    const o = r.dayOff;
    return box("Dam olish", <>
      <Num label="Bonus (so'm)" value={o.bonus} onChange={(v) => onRule({ dayOff: { ...o, bonus: v } })} />
      <Num label="To'liq (kungacha)" value={o.fullUpTo} onChange={(v) => onRule({ dayOff: { ...o, fullUpTo: v } })} />
      <Num label="Yarim (aynan shu kun)" value={o.partialAt} onChange={(v) => onRule({ dayOff: { ...o, partialAt: v } })} />
    </>);
  }
  if (partKey === "combo") {
    const o = r.combo || { bonus: 0 };
    return (
      <div>
        <p className="font-extrabold mb-3">{t("Ikkovi to'liq (qo'shimcha)")}</p>
        <div className="grid grid-cols-1 gap-3">
          <Num label="Bonus (so'm)" value={o.bonus}
            onChange={(v) => onRule({ combo: { ...o, bonus: v } })}
            hint="Kech qolmasa + dam to'liq bo'lsa qo'shiladi" />
        </div>
      </div>
    );
  }
  return null;
}

// Qoralama bilan ishlaydi: har harfda saqlamaydi. Aks holda har
// o'zgarishda butun daraxt qayta chizilib, kiritilayotgan katakdan
// fokus uchib ketardi va "saqlanmadi" bo'lib tuyulardi.
function RulesEditor({ m, onRule, onPlan }) {
  const [draft, setDraft] = useState({ plan: m.plan, rules: m.rules });
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  const r = draft.rules;
  const plan = draft.plan;
  const conf = m.conf;
  const otherParts = conf.parts.filter((k) => k !== "sales");

  const setRule = (patch) => {
    setDraft((d) => ({ ...d, rules: { ...d.rules, ...patch } }));
    setDirty(true); setSaved(false);
  };
  const setPlan = (patch) => {
    setDraft((d) => ({ ...d, plan: { ...d.plan, ...patch } }));
    setDirty(true); setSaved(false);
  };
  const save = () => {
    onPlan(draft.plan);
    onRule(draft.rules);
    setDirty(false); setSaved(true);
  };

  return (
    <div className="card p-7 mb-6">
      <h2 className="text-2xl font-extrabold mb-1">{t("Reja va bonus qoidalari")}</h2>
      <p className="text-muted font-semibold mb-6">
        {tt("{m} uchun. Har oy alohida — o'zgartirilsa keyingi oylarga meros bo'ladi.",
          { m: MONTHS[+m.month.slice(5) - 1] })}
      </p>

      {/* Oylik reja — tur bo'yicha maydonlar */}
      <p className="font-extrabold mb-3">{t("Oylik reja")}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-7">
        {conf.planFields.map((f) => (
          <Num key={f.key} label={f.label} value={plan[f.key]} hint={f.hint}
            onChange={(v) => setPlan({ [f.key]: v })} />
        ))}
        <Num label="Fiksa (so'm)" value={r.fixed} onChange={(v) => setRule({ fixed: v })} />
        {conf.parts.includes("revision") && (
          <Num label="Reviziya har necha kunda" value={r.revisionEveryDays ?? 5}
            onChange={(v) => setRule({ revisionEveryDays: v })}
            hint="Sanash kunida va ertasiga yoziladi" />
        )}
      </div>

      {/* Savdo bosqichlari — faqat savdosi bor turlarda */}
      {conf.parts.includes("sales") && r.salesTiers && (<>
      <p className="font-extrabold mb-3">{t("Savdo hajmi bonusi")}</p>
      <div className="space-y-3 mb-7">
        {r.salesTiers.map((tier, i) => (
          <div key={i} className="flex items-end gap-3">
            <label className="flex-1">
              <span className="block text-sm font-bold mb-2">{t("Shundan oshsa ($)")}</span>
              <NumberField value={tier.from}
                onChange={(v) => { const n = [...r.salesTiers]; n[i] = { ...tier, from: v }; setRule({ salesTiers: n }); }} />
            </label>
            <label className="flex-1">
              <span className="block text-sm font-bold mb-2">{t("Bonus (so'm)")}</span>
              <NumberField value={tier.bonus}
                onChange={(v) => { const n = [...r.salesTiers]; n[i] = { ...tier, bonus: v }; setRule({ salesTiers: n }); }} />
            </label>
            <button onClick={() => setRule({ salesTiers: r.salesTiers.filter((_, j) => j !== i) })}
              className="w-12 h-12 rounded-xl border border-line text-muted hover:text-danger hover:border-danger flex items-center justify-center shrink-0">
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        <button onClick={() => setRule({ salesTiers: [...r.salesTiers, { from: 0, bonus: 0 }] })}
          className="flex items-center gap-2 text-brand font-bold">
          <Plus size={18} /> {t("Bosqich qo'shish")}
        </button>
      </div>
      </>)}

      {/* Qolgan bonuslar — tur qaysilarni ishlatsa o'shalar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-7">
        {otherParts.map((k) => <PartRule key={k} partKey={k} r={r} onRule={setRule} />)}
      </div>

      {/* Saqlash — o'zgarishlar shu tugma bosilgandagina yoziladi */}
      <div className="flex items-center gap-4 mt-8 pt-6 border-t border-line">
        <button onClick={save} disabled={!dirty}
          className="rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-7 py-3 disabled:opacity-40 disabled:cursor-not-allowed">
          {t("Saqlash")}
        </button>
        {dirty && <span className="font-semibold text-warn">{t("O'zgarishlar saqlanmagan")}</span>}
        {saved && <span className="font-semibold text-ok">{t("Saqlandi")}</span>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Kunlik jadval — tur ustunlariga qarab chiziladi
// ══════════════════════════════════════════════════════════════
function DailyTable({ m, rows, month, onEdit, canEdit, canEditPast = false, showSalary = false, payAnyDay = false }) {
  const today = todayKey();
  // Menejer faqat bugun va kechani tahrirlaydi — eski kunlar yopiq,
  // aks holda hisoblangan oylik keyinchalik jimgina o'zgartirilib
  // ketardi. RAHBAR esa istalgan o'tgan kunni tuzata oladi: xatoni
  // keyinroq topib to'g'irlash faqat unga ruxsat etilgan.
  const yesterday = (() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return todayKey(d);
  })();
  const [y, mo] = month.split("-").map(Number);
  const byDate = new Map(rows.map((r) => [r.date, r]));
  // Pul yashiringanda (usta o'zi ko'rsa) shaxsiy pul ustunlari butunlay
  // chiqmaydi: kunlik summa (camMoney) va olgan pul (olgan).
  const PAY_COLS = new Set(["camMoney", "olgan"]);
  const baseCols = showSalary ? m.conf.columns : m.conf.columns.filter((c) => !PAY_COLS.has(c.key));
  // Ustun tartibi va ko'rinishini xodimning o'zi sozlaydi (Meta Ads
  // Manager'dagidek). Sozlama KPI TURI bo'yicha saqlanadi: B2B va B2C
  // jadvallarining ustunlari boshqacha.
  const colPrefs = useColumns(`kpi-daily-${m.type}`, baseCols);
  const cols = colPrefs.columns;
  const isCalc = (c) => c.kind === "calc";
  // Har qanday qo'lda kiritiladigan ustunning oylik jamisi
  const sumCol = (key) => rows.reduce((a, r) => a + (Number(r[key]) || 0), 0);
  // "Oylik jami" katagi. Yangi ustun qo'shilsa jamisi O'ZI chiqadi —
  // qo'lda kiritiladigan har qanday ustun shu yerda yig'iladi. Quyidagi
  // maxsus holatlar faqat boshqacha ko'rsatiladiganlari uchun.
  const totalFor = (c) => {
    if (c.kind === "check") return c.key === "late" ? m.lateDays : m.offDays;
    if (c.key === "sales" || c.calc === "cum") return usd(m.sales);
    if (c.key === "cameras" || c.calc === "cumCam") return m.cameras;
    if (c.calc === "camMoney") return showSalary ? som(m.camMoney) : "•••";
    if (c.key === "olgan") return som(m.olgan || 0);
    if (c.calc === "income") return usd(m.income);
    if (c.calc === "diff") return usd(m.sales - m.income);
    if (c.calc === "planpct") return `${(m.planPct * 100).toFixed(1)}%`;
    if (c.calc === "nps") return m.npsPct == null ? "—" : `${Math.round(m.npsPct * 100)}%`;
    if (c.calc === "npsInstalled") return m.installed;
    if (c.calc === "npsTaken") return m.npsCollected;
    if (c.kind === "money") return usd(sumCol(c.key));
    if (c.kind === "int") return sumCol(c.key);
    return "";
  };
  // Retention menejer: O'rnatilgan/NPS olingan ustunlari NPS baholaridan
  // avtomat to'ladi (kunma-kun, sana bo'yicha).
  const npsCounts = m.type === "b2c_retention" ? npsDayCounts(month) : null;

  // Ustunlarni rang bilan ajratamiz (mayin, yorqin emas):
  //   • siz to'ldiradigan ustunlar — mayin ko'k (brand-soft)
  //   • tizim o'zi hisoblaydigan ustunlar — mayin kulrang (track)
  const align = (c) => `text-${c.kind === "check" ? "center" : "right"}`;
  // Ustun bo'ylab yaxlit rang bandlari (Google Sheet'dagidek, oxirigacha):
  //   • siz to'ldiradigan — mayin ko'k    • tizim hisoblaydigan — mayin kulrang
  // Asosiy ranglar past shaffoflik bilan — yorug'/qorong'i ikkalasida ham
  // bir xil ko'rinadi, yorqin emas.
  // Sarlavha SHAFFOFMAS bo'lishi shart (sticky bo'lganda tag ko'rinmasin):
  // kirish — mayin ko'k (brand-soft), hisoblanadigan — kulrang (track2).
  const headTone = (c) => (isCalc(c) ? "bg-track2 text-muted" : "bg-brand-soft text-brand");
  const cellTone = (c) => (isCalc(c) ? "bg-muted/10" : "bg-brand/10");
  const footTone = (c) => (isCalc(c) ? "bg-muted/20" : "bg-brand/20");
  const headCls = (c) => `px-3 py-4 font-bold sticky top-0 z-20 border-b-2 border-line ${align(c)} ${headTone(c)}`;

  return (
    <>
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-3 text-sm font-semibold">
      <span className="flex items-center gap-2 text-muted">
        <span className="w-3.5 h-3.5 rounded bg-brand/25 border border-brand/50" />
        {t("Siz to'ldirasiz")}
      </span>
      <span className="flex items-center gap-2 text-muted">
        <span className="w-3.5 h-3.5 rounded bg-muted/25 border border-muted/50" />
        {t("Tizim o'zi hisoblaydi")}
      </span>
      {/* Uchinchi belgi: raqam Billz cheklaridan kelgan. Qo'lda
          to'ldiriladigan ustundan farqi ko'rinib tursin — aks holda
          menejer "nega yozolmayapman" deb o'ylaydi. */}
      <span className="flex items-center gap-2 text-muted">
        <span className="w-3.5 h-3.5 rounded bg-brand/25 border border-brand" />
        {t("Billz'dan avtomatik")}
      </span>
      <button onClick={colPrefs.openSettings}
        className="ml-auto flex items-center gap-2 rounded-xl border border-line px-4 py-2 font-bold hover:border-brand hover:text-brand transition-colors">
        <SlidersHorizontal size={16} /> {t("Ustunlar")}
      </button>
    </div>
    <div className="card overflow-auto max-h-[78vh]">
      <table className="w-full text-[0.9375rem] whitespace-nowrap">
        {/* Sarlavha + "Oylik jami" birga tepada yopishib turadi: rahbar
            pastga tushganda ham oy yakunini ko'rib turadi. */}
        <thead className="sticky top-0 z-20">
          <tr className="text-left text-muted text-sm">
            <th className="px-5 py-4 font-bold sticky left-0 z-30 bg-panel border-b-2 border-r border-line">{t("Sana")}</th>
            {cols.map((c) => <th key={c.key} className={headCls(c)}>{t(c.label)}</th>)}
          </tr>
          {/* Qator foni SHAFFOFMAS bo'lishi shart — sticky bo'lgani uchun
              tagidagi kunlar ko'rinib ketmasin. Ustun ranglari (mayin ko'k /
              kulrang) shaffof, shuning uchun ular ostiga bg-panel qo'yiladi. */}
          <tr className="font-extrabold border-b-2 border-line bg-panel">
            <th className="px-5 py-3 text-left sticky left-0 z-30 bg-panel border-b-2 border-r border-line">{t("Oylik jami")}</th>
            {cols.map((c) => (
              <th key={c.key} className={`px-3 py-3 font-extrabold border-b-2 border-line ${align(c)} ${footTone(c)}`}>
                {totalFor(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: m.daysInMonth }, (_, i) => {
            const d = new Date(y, mo - 1, i + 1);
            const date = `${month}-${String(i + 1).padStart(2, "0")}`;
            const r = byDate.get(date) ?? {};
            const cd = computeDay(r);
            const isToday = date === today;
            const isFuture = date > today;
            // Yopiq: kelajak yoki kechadan oldingi kun
            const closed = isFuture || (!canEditPast && date < yesterday);
            const weekend = d.getDay() === 0;
            const revDay = isRevisionDay(i + 1, m.rules.revisionEveryDays ?? 5);
            // Pul beriladigan kun (1, 5, 10, 15, 20, 25). Rahbar uchun
            // cheklov yo'q — u xohlagan kuni bera oladi. Cheklov
            // vaqtincha ochilgan oyda (PAY_ANY_DAY_MONTHS) menejer ham
            // istalgan kunga yozadi.
            const payDay = payAnyDay || isPayDay(i + 1, month);

            // Jami savdo: SHU kun savdosi bo'sh bo'lsa — jami ham bo'sh
            const hasSales = r.sales != null && r.sales !== "";
            const cum = hasSales
              ? rows.filter((x) => x.date <= date).reduce((a, x) => a + (Number(x.sales) || 0), 0)
              : null;
            // Usta: jami kamera (shu kun kiritilmagan bo'lsa bo'sh)
            const hasCam = r.cameras != null && r.cameras !== "";
            const cumCam = hasCam
              ? rows.filter((x) => x.date <= date).reduce((a, x) => a + (Number(x.cameras) || 0), 0)
              : null;
            const rate = Number(m.plan.rate) || 0;

            const cellFor = (c) => {
              if (c.kind === "check") {
                return closed || !canEdit ? (
                  r[c.key] ? <span className="font-bold text-danger">{t("Ha")}</span> : <span className="text-muted">·</span>
                ) : (
                  <input type="checkbox" checked={!!r[c.key]}
                    onChange={(e) => onEdit(date, { [c.key]: e.target.checked })}
                    className="w-4 h-4 accent-brand" />
                );
              }
              if (c.kind === "money" || c.kind === "int") {
                // Savdo, Naqd, Payme va Servis Billz API'dagi haqiqiy
                // cheklardan avtomatik kelgan bo'lsa, ularni qo'lda
                // o'zgartirib bo'lmaydi. Bu KPI va moliya bir xil
                // raqamni ko'rsatishini kafolatlaydi; eski qo'lda
                // yozilgan tarix esa bazada joyida qoladi.
                //
                // Ustun ro'yxati `kpiData.BILLZ_COLS` da — yangi
                // avtomat ustun qo'shilsa bu yerga tegilmaydi.
                if (BILLZ_COLS[c.key] && r[BILLZ_COLS[c.key]]) {
                  return <span className="font-extrabold text-brand" title={t("Billz'dan avtomatik")}>{usd(r[c.key])}</span>;
                }
                const locked = closed || (c.revisionCol && !revDay) || (c.payDayCol && !payDay) || !canEdit;
                if (locked) {
                  const has = r[c.key] != null && r[c.key] !== "";
                  return has ? <span className="font-semibold">{usd(r[c.key])}</span> : <span className="text-muted">·</span>;
                }
                return (
                  <NumberField value={r[c.key]} allowEmpty placeholder="—"
                    onChange={(v) => onEdit(date, editPatch(c.key, v, r))}
                    className="w-24 bg-transparent text-right font-semibold outline-none border-b border-transparent focus:border-brand py-1" />
                );
              }
              // Hisoblanuvchi ustunlar
              if (c.calc === "income")
                return <span className="text-muted">{cd.income == null ? "—" : usd(cd.income)}</span>;
              if (c.calc === "diff")
                // Nasiya = savdo − tushgan pul. Musbat bo'lsa pul hali
                // kelmagan (qarz) — QIZIL. Manfiy bo'lsa eski qarz ham
                // yopilgan, ya'ni savdodan ko'proq pul tushgan — YASHIL.
                return <span className={cd.diff == null || cd.diff === 0 ? "text-muted"
                  : cd.diff > 0 ? "text-danger" : "text-ok"}>
                  {cd.diff == null ? "—" : usd(cd.diff)}</span>;
              if (c.calc === "cum")
                return <span className="font-extrabold text-muted">{cum == null ? "—" : usd(cum)}</span>;
              if (c.calc === "planpct")
                return <span className="text-muted">{cum == null || m.plan.salesPlan <= 0 ? "—" : `${((cum / m.plan.salesPlan) * 100).toFixed(1)}%`}</span>;
              // O'rnatilgan (ta) — o'rnatilgan sana bo'yicha NPS yozuvlari soni
              if (c.calc === "npsInstalled") {
                const n = npsCounts?.installed[date] || 0;
                return <span className={n ? "font-semibold" : "text-muted"}>{n || "·"}</span>;
              }
              // NPS olingan (ta) — to'ldirilgan sana bo'yicha NPS yozuvlari soni
              if (c.calc === "npsTaken") {
                const n = npsCounts?.taken[date] || 0;
                return <span className={n ? "font-semibold" : "text-muted"}>{n || "·"}</span>;
              }
              if (c.calc === "nps") {
                const inst = npsCounts?.installed[date] || 0, got = npsCounts?.taken[date] || 0;
                return <span className="text-muted">{inst === 0 ? "—" : `${Math.round(got / inst * 100)}%`}</span>;
              }
              if (c.calc === "camMoney") {
                if (!showSalary) return <span className="text-muted">•••</span>;
                const cm = num(r.cameras);
                return <span className="font-semibold text-muted">{cm == null ? "—" : som(cm * rate)}</span>;
              }
              if (c.calc === "cumCam")
                return <span className="font-extrabold text-muted">{cumCam == null ? "—" : cumCam}</span>;
              return null;
            };

            return (
              <tr key={date} className={`border-b border-line last:border-0 ${isFuture ? "opacity-45" : ""}`}>
                <td className={`px-5 py-2.5 font-bold sticky left-0 z-10 border-r border-line ${
                  isToday ? "bg-brand-soft" : "bg-panel"}`}>
                  {isToday && <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand mr-2 align-middle" />}
                  <span className={isToday ? "text-brand" : ""}>
                    {String(i + 1).padStart(2, "0")}.{String(mo).padStart(2, "0")}
                  </span>
                  <span className={`font-semibold ml-2 ${isToday ? "text-brand" : "text-muted"}`}>{t(WEEK[d.getDay()])}</span>
                </td>
                {cols.map((c) => (
                  <td key={c.key} className={`px-3 py-2.5 ${align(c)} ${cellTone(c)}`}>
                    {cellFor(c)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    {colPrefs.open && <ColumnSettings {...colPrefs.dialogProps} />}
    </>
  );
}
const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v) || 0);

// ══════════════════════════════════════════════════════════════
// SERVIS PULI NAQDDAN AJRATILADI
// ══════════════════════════════════════════════════════════════
// Menejer avval kun bo'yi tushgan NAQDni yozadi (masalan 731), keyin
// o'shaning ichidan servisga tegishlisini ajratadi (31). Servis raqami
// naqdga QO'SHIMCHA emas — uning bir bo'lagi. Shuning uchun servis
// yozilganda naqddan o'sha miqdor ayiriladi: 731 → 700.
//
// Farq bo'yicha ishlaydi: servis 31 dan 40 ga o'zgarsa, naqddan yana
// 9 ayiriladi (31 emas), servis tozalansa esa pul naqdga qaytadi.
function editPatch(key, value, day) {
  if (key !== "service") return { [key]: value };
  // Naqd hali yozilmagan bo'lsa tegmaymiz — ayiradigan pul yo'q
  if (day?.cash == null || day?.cash === "") return { service: value };
  const delta = (Number(value) || 0) - (Number(day.service) || 0);
  // Naqd minusga tushmasin: servis naqddan katta bo'lsa, bor pul ayiriladi
  const nextCash = +Math.max(0, (Number(day.cash) || 0) - delta).toFixed(2);
  return { service: value, cash: nextCash };
}

// ══════════════════════════════════════════════════════════════
// Bitta xodim — to'liq ko'rinish (karta + bonus + jadval)
// ══════════════════════════════════════════════════════════════
function StaffDetail({ staffId, month, canEdit, canRules, canEditPast = false, showSalary = false, payAnyDay = false, tick, bump }) {
  const live = useLive();   // boshqa xodim yozgani ham darrov ko'rinsin
  const [showRules, setShowRules] = useState(false);
  const m = useMemo(() => computeMonth(staffId, month), [staffId, month, tick, live]);
  const rows = useMemo(() => listDays(staffId, month), [staffId, month, tick, live]);

  const edit = (date, patch) => { saveDay(staffId, date, patch); bump(); };
  const editPlan = (patch) => { savePlan(staffId, month, patch); bump(); };
  const editRule = (patch) => { saveRules(staffId, month, patch); bump(); };

  return (
    <div>
      {canRules && (
        <div className="flex justify-end mb-4">
          <button onClick={() => setShowRules((v) => !v)}
            className={`flex items-center gap-2 rounded-xl font-bold px-5 py-3 border transition-colors ${
              showRules ? "border-brand bg-brand-soft text-brand" : "border-line hover:bg-surface"}`}>
            <Settings2 size={18} /> {t("Reja va qoidalar")}
          </button>
        </div>
      )}

      {/* Asosiy karta — oylik, savdo rejasi, prognoz. Faqat egasi ko'radi;
          boshqalarda umuman ko'rinmaydi. */}
      {showSalary && (
      <div className="card p-6 sm:p-8 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          <div>
            <p className="text-sm font-bold text-muted mb-2">
              {t(m.type === "installer" ? "Ishlab topgan" : "Shu paytgacha oylik")}
            </p>
            {!showSalary ? (
              <>
                <p className="text-5xl font-extrabold text-muted mb-1">•••</p>
                <p className="text-sm text-muted font-semibold">{t("Oylik summa hozircha yopiq")}</p>
              </>
            ) : m.type === "installer" ? (<>
              <p className="text-5xl font-extrabold text-brand mb-1">{som(m.total)}</p>
              <div className="mt-3 space-y-1.5">
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-muted">{t("Olgan puli")}</span><span>{som(m.olgan || 0)} {t("so'm")}</span>
                </div>
                {/* O'tgan oylardan ko'chib kelgan qarz — qaysi oydan ekani bilan */}
                {m.carryFrom?.length > 0 && m.carryFrom.map((c) => (
                  <div key={c.month} className="flex justify-between text-sm font-semibold">
                    <span className="text-muted">
                      {tt("{m} dan qolgan", { m: MONTHS[+c.month.slice(5) - 1] })}
                    </span>
                    <span className={c.balance < 0 ? "text-danger" : "text-ok"}>
                      {som(c.balance)} {t("so'm")}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between font-extrabold">
                  <span>{t("Balans")}</span>
                  <span className={m.qoldiq < 0 ? "text-danger" : "text-ok"}>{som(m.qoldiq)} {t("so'm")}</span>
                </div>
                {!m.monthDone && (
                  <div className="flex justify-between text-sm font-semibold pt-1">
                    <span className="text-muted">{t("Davomat bonusi (shartli)")}</span>
                    <span className="text-muted">{som(m.bonusPending)} {t("so'mgacha")}</span>
                  </div>
                )}
              </div>
            </>) : (<>
              <p className="text-5xl font-extrabold text-brand mb-1">{som(m.total)}</p>
              <p className="text-muted font-semibold">{tt("so'm · to'liq bajarilsa {n}", { n: som(m.totalMax) })}</p>
              {!m.monthDone && (
                <p className="text-sm font-semibold text-muted mt-2">
                  {tt("Davomat va kamomad bonusi — {n} so'mgacha, oy oxirida aniqlanadi", { n: som(m.bonusPending) })}
                </p>
              )}
              <div className="h-2 rounded-full bg-track overflow-hidden mt-4">
                <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (m.total / m.totalMax) * 100)}%` }} />
              </div>
            </>)}
          </div>
          {m.type === "installer" ? (<>
            <div>
              <p className="text-sm font-bold text-muted mb-2">{t("O'rnatilgan kamera")}</p>
              <p className="text-3xl font-extrabold mb-1">{m.cameras} <span className="text-lg text-muted">{t("dona")}</span></p>
              {showSalary && (
                <p className="text-muted font-semibold">
                  {tt("{r} so'm/dona · jami {m} so'm", { r: som(m.plan.rate || 0), m: som(m.camMoney) })}
                </p>
              )}
              {(() => {
                const { avg, count } = npsForInstaller(staffId, month);
                return (
                  <p className="text-sm font-semibold mt-2">
                    <span className="text-muted">{t("NPS")}: </span>
                    <span className={avg == null ? "text-muted" : avg >= 8 ? "text-ok" : avg >= 6 ? "text-warn" : "text-danger"}>
                      {avg == null ? "—" : tt("{a} / 10 · {c} baho", { a: avg.toFixed(1), c: count })}
                    </span>
                  </p>
                );
              })()}
              {m.plan.camerasPlan > 0 && (
                <div className="h-2 rounded-full bg-track overflow-hidden mt-4">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, m.camPlanPct * 100)}%` }} />
                </div>
              )}
              {m.plan.camerasPlan > 0 && (
                <p className="text-sm text-muted font-semibold mt-2">
                  {tt("Reja {n} dona · {p}%", { n: m.plan.camerasPlan, p: Math.round(m.camPlanPct * 100) })}
                </p>
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-muted mb-2">{t("Davomat")}</p>
              <p className="text-3xl font-extrabold mb-1">{m.camDays} <span className="text-lg text-muted">{t("kun ishlagan")}</span></p>
              <p className="text-muted font-semibold">{tt("Kuniga o'rtacha {n} dona", { n: m.avgCam.toFixed(1) })}</p>
              <p className="text-sm text-muted font-semibold mt-4">
                {tt("{l} kun kech · {o} kun dam", { l: m.lateDays, o: m.offDays })}
              </p>
            </div>
          </>) : (<>
          <div>
            <p className="text-sm font-bold text-muted mb-2">{t("Savdo rejasi")}</p>
            <p className="text-3xl font-extrabold mb-1">
              {usd(m.sales)} <span className="text-lg text-muted">/ {usd(m.plan.salesPlan)} $</span>
            </p>
            <span className={`inline-block text-sm font-bold px-3 py-1 rounded-lg ${STATUS_TONE[m.status]}`}>{t(STATUS_TEXT[m.status])}</span>
            <div className="relative h-2 rounded-full bg-track overflow-hidden mt-4">
              <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, m.planPct * 100)}%` }} />
              <div className="absolute top-0 bottom-0 w-0.5 bg-ink" style={{ left: `${Math.min(100, m.timePct * 100)}%` }} />
            </div>
            <p className="text-sm text-muted font-semibold mt-2">
              {tt("Reja {p}% · {n} kun to'ldirilgan ({v}%)", {
                p: Math.round(m.planPct * 100), n: m.salesFilled, v: Math.round(m.timePct * 100),
              })}
            </p>
          </div>
          <div>
            <p className="text-sm font-bold text-muted mb-2">{t("Shu sur'atda oy oxirida")}</p>
            <p className="text-3xl font-extrabold mb-1">{usd(m.forecast)} $</p>
            <p className="text-muted font-semibold">
              {m.forecast >= m.plan.salesPlan ? t("Reja bajariladi")
                : tt("Rejaga {n} $ yetmaydi", { n: usd(m.plan.salesPlan - m.forecast) })}
            </p>
            <p className="text-sm text-muted font-semibold mt-4">{tt("Kuniga o'rtacha {n} $", { n: usd(m.avgDay) })}</p>
          </div>
          </>)}
        </div>
      </div>
      )}

      {/* key — xodim yoki oy almashsa qoralama yangidan boshlanadi */}
      {showRules && canRules && (
        <RulesEditor key={`${staffId}-${month}`} m={m} onRule={editRule} onPlan={editPlan} />
      )}

      {/* Bonus tarkibi + Fiksa — oylik summalari. Faqat egasi ko'radi
          (rahbar keyin "ko'rsat" deganда yoqiladi). */}
      {showSalary && (<>
      <h2 className="text-2xl font-extrabold mb-4">{t("Bonus tarkibi")}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-4">
        {m.conf.parts.map((key) => {
          const meta = PART_META[key]; const Icon = meta.icon; const p = m.parts[key];
          const pct = p.max > 0 ? (p.value / p.max) * 100 : 0;
          return (
            <div key={key} className={`card p-6 ${p.pending ? "border border-dashed border-line" : ""}`}>
              <div className="flex items-center gap-3 mb-3">
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  p.pending ? "bg-track text-muted"
                    : pct >= 100 ? "bg-ok-soft text-ok" : pct > 0 ? "bg-warn-soft text-warn" : "bg-track text-muted"}`}>
                  <Icon size={20} />
                </span>
                <p className="text-sm font-bold text-muted">{t(meta.label)}</p>
                {/* "Shartli" — bu pul hali ishlab topilmagan, oy oxirigacha
                    o'zgarishi mumkin. Aks holda karta va'daga o'xshab qoladi. */}
                {p.pending && (
                  <span className="text-[0.6875rem] font-bold px-2 py-0.5 rounded-md bg-track text-muted uppercase tracking-wide">
                    {t("shartli")}
                  </span>
                )}
              </div>
              <p className={`text-2xl font-extrabold ${p.pending ? "text-muted" : ""}`}>
                {p.pending ? tt("{n} gacha", { n: som(p.max) }) : som(p.value)}
              </p>
              <p className="text-sm text-muted font-semibold mb-3">
                {p.pending ? t("Oy oxirida aniqlanadi") : tt("{n} dan", { n: som(p.max) })}
              </p>
              <div className="h-1.5 rounded-full bg-track overflow-hidden">
                <div className={`h-full rounded-full ${p.pending ? "bg-track2" : pct >= 100 ? "bg-ok" : "bg-warn"}`}
                  style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
              <p className="text-sm text-muted font-semibold mt-2">{t(p.note)}</p>
              {p.pending && (
                <p className="text-sm font-semibold mt-2">
                  {pct >= 100 ? <span className="text-ok">{t("Hozircha shart bajarilyapti")}</span>
                    : pct > 0 ? <span className="text-warn">{t("Hozircha yarim bonus")}</span>
                    : <span className="text-danger">{t("Hozirgi holatda berilmaydi")}</span>}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="card p-6 mb-7 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-brand-soft text-brand flex items-center justify-center"><Target size={20} /></span>
          <div>
            <p className="font-extrabold">{t("Fiksa")}</p>
            <p className="text-sm text-muted font-semibold">{t("Davomatga bog'liq emas")}</p>
          </div>
        </div>
        <p className="text-2xl font-extrabold">{som(m.fixed)}</p>
      </div>
      </>)}

      {/* Kunlik jadval */}
      <h2 className="text-2xl font-extrabold mb-1">{t("Kunlik raqamlar")}</h2>
      <p className="text-muted font-semibold mb-4">
        {m.conf.parts.includes("revision")
          ? tt("Kulrang ustunlar o'zi hisoblanadi. Kamomad har {n} kunda va ertasiga yoziladi. Kelmagan kunlar yopiq.",
              { n: m.rules.revisionEveryDays ?? 5 })
          : t("Kulrang ustunlar o'zi hisoblanadi. Kelmagan kunlar yopiq.")}
        {m.type === "installer" && (
          <> {payAnyDay
            ? tt("Pul odatda {d}-kunlari beriladi — rahbar sifatida siz istalgan kunga yoza olasiz.", { d: PAY_DAYS.join(", ") })
            : isPayAnyDayMonth(month)
              ? tt("Pul odatda {d}-kunlari beriladi — shu oyga cheklov vaqtincha ochilgan, istalgan kunga yozaverasiz.", { d: PAY_DAYS.join(", ") })
              : tt("Pul faqat {d}-kunlari beriladi. Boshqa kunga rahbar yozadi.", { d: PAY_DAYS.join(", ") })}</>
        )}
      </p>
      <DailyTable m={m} rows={rows} month={month} onEdit={edit} canEdit={canEdit}
        canEditPast={canEditPast} showSalary={showSalary} payAnyDay={payAnyDay} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Rahbar admin paneli — barcha xodimlar bir joyda
// ══════════════════════════════════════════════════════════════
function AdminOverview({ staff, month, tick, onOpen, bump }) {
  // Jami oylik fond
  const totalFund = useMemo(
    () => staff.reduce((a, s) => a + computeMonth(s.id, month).total, 0),
    [staff, month, tick]
  );

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        <div className="card p-6">
          <p className="text-sm font-bold text-muted mb-2">{t("Xodimlar")}</p>
          <p className="text-3xl font-extrabold">{staff.length}</p>
        </div>
        <div className="card p-6 sm:col-span-2">
          <p className="text-sm font-bold text-muted mb-2">{t("Shu oyda jami maosh fondi")}</p>
          <p className="text-3xl font-extrabold text-brand">{som(totalFund)} <span className="text-lg text-muted">so'm</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {staff.map((s) => {
          const m = computeMonth(s.id, month);
          const conf = m.conf;
          return (
            <div key={s.id} className="card p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="min-w-0">
                  <p className="text-lg font-extrabold truncate">{s.name}</p>
                  <p className="text-sm text-muted font-semibold">{t(conf.label)}</p>
                </div>
                <span className={`text-sm font-bold px-3 py-1 rounded-lg shrink-0 ${STATUS_TONE[m.status]}`}>{t(STATUS_TEXT[m.status])}</span>
              </div>

              {/* KPI turini biriktirish — rahbar shu yerda tanlaydi */}
              <label className="block mb-4">
                <span className="block text-sm font-bold mb-2">{t("KPI turi")}</span>
                <select value={MANAGER_TYPES.includes(getType(s.id)) ? getType(s.id) : "b2b"}
                  onChange={(e) => { setType(s.id, e.target.value); bump(); }}
                  className="inp font-bold">
                  {MANAGER_TYPES.map((k) => <option key={k} value={k}>{t(KPI_TYPES[k].label)}</option>)}
                </select>
              </label>

              <div className="flex items-end justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-muted mb-1">{t("Shu paytgacha oylik")}</p>
                  <p className="text-2xl font-extrabold text-brand">{som(m.total)} <span className="text-sm text-muted">so'm</span></p>
                </div>
                <p className="text-sm text-muted font-semibold">{usd(m.sales)} / {usd(m.plan.salesPlan)} $</p>
              </div>
              <div className="relative h-2 rounded-full bg-track overflow-hidden mb-4">
                <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, m.planPct * 100)}%` }} />
                <div className="absolute top-0 bottom-0 w-0.5 bg-ink" style={{ left: `${Math.min(100, m.timePct * 100)}%` }} />
              </div>

              <button onClick={() => onOpen(s.id)}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold py-3">
                {t("Batafsil ochish")} <Arrow size={18} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Ustalar reytingi — kim nechta kamera o'rnatdi, oyligi, davomati
// Rahbar ham, ustalarning o'zi ham ko'radi. Rahbar narxni tahrirlaydi.
// ══════════════════════════════════════════════════════════════
const MEDAL = ["text-[#F5B301]", "text-[#9AA4B2]", "text-[#CD7F32]"];

function InstallerBoard({ installers, month, range = null, tick, onOpen, canOpen = true, canEditRate, canEditNps, showSalary = false, highlightId, bump }) {
  const live = useLive();
  // Saralash uchun tekis maydonlar — SortTh shular bo'yicha ishlaydi
  const { sort, toggle, sortRows } = useSort("cameras", "desc");
  // Filtr — boshqa jadvallardagidek (qidiruv + oraliqlar)
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({});
  const FIELDS = useMemo(() => [
    { key: "cameras", label: "Kamera (dona)", type: "range", get: (r) => r.cameras },
    { key: "nps", label: "NPS bahosi", type: "range", get: (r) => r.nps ?? 0 },
    { key: "late", label: "Kech qolgan kun", type: "range", get: (r) => r.late },
    { key: "off", label: "Dam olgan kun", type: "range", get: (r) => r.off },
    ...(showSalary ? [
      { key: "total", label: "Ishlab topgan (so'm)", type: "range", get: (r) => r.total },
      { key: "qoldiq", label: "Balans (so'm)", type: "range", get: (r) => r.qoldiq },
    ] : []),
  ], [showSalary]);
  // Tanlangan davr oyni to'liq qoplaydimi. Qoplasa — oylik hisob
  // (davomat bonuslari va o'tgan oy qoldig'i bilan). Qoplamasa —
  // HAMMA ustun tanlangan kunlar bo'yicha sanaladi: aks holda "0 kamera,
  // lekin 320 000 ishlab topgan" degan chalkash qator chiqadi.
  const fullMonth = useMemo(() => {
    if (!range) return true;
    const [y, mo] = month.split("-").map(Number);
    const last = `${month}-${String(new Date(y, mo, 0).getDate()).padStart(2, "0")}`;
    // Sana Date bo'lishi mumkin — satrga keltirmasdan solishtirsak
    // "Sat Aug 01 2026..." bilan taqqoslanadi va javob doim noto'g'ri
    const from = dayKey(range.from), to = dayKey(range.to);
    return from <= `${month}-01` && to >= last;
  }, [range?.from, range?.to, month]);

  const rowsAll = useMemo(() => {
    const base = installers.map((s) => {
      const m = computeMonth(s.id, month, "installer");
      const nps = npsForInstaller(s.id, month);
      const rg = range ? installerRange(s.id, range.from, range.to) : null;
      // Davr bo'yicha "ishlab topgan" — shu kunlardagi kamera puli.
      // Davomat bonuslari oylik va oy oxirida aniqlanadi, shuning uchun
      // yarim oyga ular qo'shilmaydi.
      const earned = fullMonth ? m.total : rg.camMoney;
      const taken = fullMonth ? (m.olgan || 0) : rg.olgan;
      return { s, m, name: s.name,
        cameras: rg ? rg.cameras : m.cameras,
        rate: Number(m.plan.rate) || 0,
        nps: nps.avg,
        late: rg ? rg.lateDays : m.lateDays,
        off: rg ? rg.offDays : m.offDays,
        total: earned, olgan: taken,
        // BALANS — o'tgan oylardan qolgan qarz ham ichida. Davr
        // tanlansa ham u yo'qolmaydi: iyulda usta oldindan pul olgan
        // bo'lsa, avgustda "1,5 mln berishimiz kerak" degan yolg'on
        // raqam chiqmasligi kerak.
        qoldiq: +(m.carryIn + earned - taken).toFixed(0),
        carryIn: m.carryIn };
    });
    return sortRows(base);
  }, [installers, month, range?.from, range?.to, fullMonth, tick, sort, live]);

  // Qidiruv darhol, qolgan filtrlar FilterBar orqali
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const byName = s ? rowsAll.filter((r) => r.name.toLowerCase().includes(s)) : rowsAll;
    return applyFilters(byName, FIELDS, filters);
  }, [rowsAll, q, filters, FIELDS]);

  const totalCam = rows.reduce((a, r) => a + r.cameras, 0);
  const totalFund = rows.reduce((a, r) => a + r.total, 0);
  const totalOlgan = rows.reduce((a, r) => a + r.olgan, 0);
  const totalQoldiq = rows.reduce((a, r) => a + r.qoldiq, 0);

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-10 h-10 rounded-xl bg-brand-soft text-brand flex items-center justify-center"><Trophy size={20} /></span>
        <div>
          <h2 className="text-2xl font-extrabold">{t("Ustalar reytingi")}</h2>
          <p className="text-sm text-muted font-semibold">
            {showSalary
              ? tt("{c} dona kamera · jami {f} so'm", { c: totalCam, f: som(totalFund) })
              : tt("{c} dona kamera", { c: totalCam })}
            {!fullMonth && showSalary && (
              <span className="text-warn"> · {t("tanlangan kunlar bo'yicha (davomat bonuslari oy oxirida)")}</span>
            )}
          </p>
        </div>
      </div>

      {rowsAll.length === 0 ? (
        <div className="card p-8 text-center text-muted font-semibold">{t("Hali usta qo'shilmagan")}</div>
      ) : (<>
        <FilterBar
          search={{ value: q, onChange: setQ, placeholder: "Usta ismi bo'yicha qidirish..." }}
          fields={FIELDS} filters={filters} onChange={setFilters} />
        <ExportButton name={`Ustalar reytingi ${month}`} rows={rows}
          note={tt("{n} ta usta", { n: rows.length })}
          columns={[
            { label: "Usta", get: (r) => r.name },
            { label: "Kamera (dona)", get: (r) => r.cameras },
            ...(showSalary ? [{ label: "Narx (so'm/dona)", get: (r) => r.rate }] : []),
            { label: "NPS", get: (r) => (r.nps == null ? "" : +r.nps.toFixed(1)) },
            { label: "Kech (kun)", get: (r) => r.late },
            { label: "Dam (kun)", get: (r) => r.off },
            ...(showSalary ? [
              { label: "Ishlab topgan (so'm)", get: (r) => Math.round(r.total) },
              { label: "Olgan (so'm)", get: (r) => Math.round(r.olgan) },
              { label: "Balans (so'm)", get: (r) => Math.round(r.qoldiq) },
            { label: "O'tgan oylardan (so'm)", get: (r) => Math.round(r.carryIn ?? 0) },
            ] : []),
          ]} />
        <div className="card overflow-auto max-h-[70vh]">
          <table className="w-full text-[0.9375rem] whitespace-nowrap">
            {/* Sarlavha + "Jami" birga tepada yopishib turadi */}
            <thead className="sticky top-0 z-20">
              <tr className="text-left text-muted text-sm border-b border-line [&>th]:bg-panel">
                <th className="px-5 py-4 font-bold">#</th>
                <SortTh label="Usta" sortKey="name" sort={sort} onSort={toggle} />
                <SortTh label="Kamera (dona)" sortKey="cameras" sort={sort} onSort={toggle} align="right" />
                {showSalary && <SortTh label="Narx (so'm/dona)" sortKey="rate" sort={sort} onSort={toggle} align="right" />}
                <SortTh label="NPS" sortKey="nps" sort={sort} onSort={toggle} align="right" />
                <SortTh label="Kech" sortKey="late" sort={sort} onSort={toggle} align="center" />
                <SortTh label="Dam" sortKey="off" sort={sort} onSort={toggle} align="center" />
                {showSalary && (<>
                  <SortTh label="Ishlab topgan" sortKey="total" sort={sort} onSort={toggle} align="right" />
                  <SortTh label="Olgan" sortKey="olgan" sort={sort} onSort={toggle} align="right" />
                  <SortTh label="Balans" sortKey="qoldiq" sort={sort} onSort={toggle} align="right" />
                </>)}
                <th className="px-3 py-4"></th>
              </tr>
              {/* Jami tepada — rahbarga ustalarga jami qancha pul ketishi
                  kerakligi darrov ko'rinsin. Fon shaffofmas bo'lsin. */}
              {showSalary && rows.length > 0 && (
                <tr className="border-b-2 border-line font-extrabold bg-panel">
                  <th className="px-5 py-4 text-left" colSpan={2}>{t("Jami")}</th>
                  <th className="px-3 py-4 text-right text-lg">{totalCam}</th>
                  <th className="px-3 py-4"></th>
                  <th className="px-3 py-4"></th>
                  <th className="px-3 py-4 text-center">{rows.reduce((a, r) => a + r.late, 0)}</th>
                  <th className="px-3 py-4 text-center">{rows.reduce((a, r) => a + r.off, 0)}</th>
                  <th className="px-3 py-4 text-right text-brand">{som(totalFund)}</th>
                  <th className="px-3 py-4 text-right text-muted">{som(totalOlgan)}</th>
                  <th className={`px-3 py-4 text-right ${totalQoldiq < 0 ? "text-danger" : ""}`}>{som(totalQoldiq)}</th>
                  <th className="px-3 py-4"></th>
                </tr>
              )}
            </thead>
            <tbody>
              {rows.map((r0, i) => { const { s, m } = r0; return (
                <tr key={s.id} className={`border-b border-line last:border-0 ${
                  s.id === highlightId ? "bg-brand-soft" : i % 2 ? "bg-surface/30" : ""}`}>
                  <td className="px-5 py-3 font-extrabold">
                    {i < 3 ? <Medal size={20} className={MEDAL[i]} /> : <span className="text-muted">{i + 1}</span>}
                  </td>
                  <td className="px-3 py-3 font-bold">{s.name}</td>
                  <td className="px-3 py-3 text-right font-extrabold text-lg">{r0.cameras}</td>
                  {showSalary && (
                    <td className="px-3 py-3 text-right">
                      {canEditRate ? (
                        <NumberField value={m.plan.rate ?? 0}
                          onChange={(v) => { setInstallerRate(s.id, v, month); bump(); }}
                          className="w-28 bg-transparent text-right font-semibold outline-none border-b border-line focus:border-brand py-1" />
                      ) : (
                        <span className="font-semibold">{som(m.plan.rate || 0)}</span>
                      )}
                    </td>
                  )}
                  {/* NPS: retention menejer qo'ygan 1–10 baholarning o'rtachasi */}
                  <td className="px-3 py-3 text-right">
                    {(() => {
                      const { avg, count } = npsForInstaller(s.id, month);
                      if (avg == null) return <span className="text-muted">—</span>;
                      return (
                        <span className="font-bold">
                          <span className={avg >= 8 ? "text-ok" : avg >= 6 ? "text-warn" : "text-danger"}>
                            {avg.toFixed(1)}
                          </span>
                          <span className="text-xs text-muted font-semibold"> ({count})</span>
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-3 text-center font-bold">{r0.late}</td>
                  <td className="px-3 py-3 text-center font-bold">{r0.off}</td>
                  {showSalary && (<>
                    <td className="px-3 py-3 text-right font-extrabold text-brand">{som(r0.total)}</td>
                    <td className="px-3 py-3 text-right font-semibold text-muted">{som(r0.olgan)}</td>
                    <td className={`px-3 py-3 text-right font-extrabold ${r0.qoldiq < 0 ? "text-danger" : ""}`}>
                      {som(r0.qoldiq)}
                      {/* O'tgan oydan qarz bo'lsa — ochiq yozamiz, aks
                          holda "nega bu raqam?" degan savol qoladi */}
                      {Math.abs(r0.carryIn ?? 0) > 0.5 && (
                        <span className="block text-sm font-semibold text-muted">
                          {tt("o'tgan oydan {n}", { n: som(r0.carryIn) })}
                        </span>
                      )}
                    </td>
                  </>)}
                  <td className="px-3 py-3 text-right">
                    {canOpen && (
                      <button onClick={() => onOpen(s.id)} className="text-brand font-bold inline-flex items-center gap-1 hover:underline">
                        {t("Ochish")} <Arrow size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
      </>)}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// NPS baholari jadvali — retention menejer to'ldiradi
// (mijoz, telefon, usta, 1–10 baho, izoh)
// ══════════════════════════════════════════════════════════════
function NpsRecords({ installers, month, tick, bump }) {
  const live = useLive();
  const [modal, setModal] = useState(null);   // null | {} | { rec }
  const { sort, toggle, sortRows } = useSort("createdAt", "desc");
  const recs = useMemo(() => {
    const base = listNps(month).map((r) => ({ ...r,
      usta: installers.find((s) => s.id === r.installerId)?.name || "—",
      filled: r.createdAt ? String(r.createdAt).slice(0, 10) : "" }));
    return sortRows(base);
  }, [month, tick, sort, installers, live]);
  const prod = useMemo(() => productAvg(month), [month, tick, live]);
  const nameOf = (id) => installers.find((s) => s.id === id)?.name || "—";
  const scoreCls = (n) => n == null ? "text-muted" : n >= 8 ? "text-ok" : n >= 6 ? "text-warn" : "text-danger";

  const save = (data) => {
    if (modal?.rec) updateNps(modal.rec.id, data);
    else addNps({ ...data, month });
    setModal(null); bump();
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-brand-soft text-brand flex items-center justify-center"><Star size={20} /></span>
          <div>
            <h2 className="text-2xl font-extrabold">{t("NPS baholari")}</h2>
            <p className="text-sm text-muted font-semibold">
              {tt("{n} ta baho", { n: recs.length })}
              {prod.avg != null && <> · {t("Mahsulot o'rtacha")}: <span className={`font-bold ${scoreCls(prod.avg)}`}>{prod.avg.toFixed(1)}</span></>}
            </p>
          </div>
        </div>
        <button onClick={() => setModal({})}
          className="flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-5 py-2.5 shrink-0">
          <Plus size={18} /> {t("Baho qo'shish")}
        </button>
      </div>

      {recs.length === 0 ? (
        <div className="card p-8 text-center text-muted font-semibold">{t("Hali baho qo'shilmagan")}</div>
      ) : (
        <>
        <ExportButton name={`NPS baholari ${month}`} rows={recs}
          columns={[
            { label: "Mijoz", get: (r) => r.customerName },
            { label: "Telefon", get: (r) => r.phone || "" },
            { label: "Usta", get: (r) => r.usta },
            { label: "O'rnatilgan sana", get: (r) => r.installedDate || "" },
            { label: "NPS olingan sana", get: (r) => r.filled },
            { label: "Usta bahosi", get: (r) => r.score },
            { label: "Mahsulot bahosi", get: (r) => r.productScore ?? "" },
            { label: "Izoh", get: (r) => r.comment || "" },
            { label: "Mahsulot izohi", get: (r) => r.productComment || "" },
          ]} />
        <div className="card overflow-auto max-h-[70vh]">
          <table className="w-full text-[0.9375rem] whitespace-nowrap">
            <thead>
              <tr className="text-left text-muted text-sm border-b border-line [&>th]:sticky [&>th]:top-0 [&>th]:z-20 [&>th]:bg-panel">
                <th className="px-5 py-4 font-bold">#</th>
                <SortTh label="Mijoz" sortKey="customerName" sort={sort} onSort={toggle}
                  className="px-5 sticky left-0 z-10 bg-panel border-r border-line" />
                <SortTh label="Telefon" sortKey="phone" sort={sort} onSort={toggle} />
                <SortTh label="Usta" sortKey="usta" sort={sort} onSort={toggle} />
                <SortTh label="O'rnatilgan sana" sortKey="installedDate" sort={sort} onSort={toggle} />
                <SortTh label="NPS olingan sana" sortKey="filled" sort={sort} onSort={toggle} />
                <SortTh label="Usta bahosi" sortKey="score" sort={sort} onSort={toggle} align="center" />
                <SortTh label="Mahsulot bahosi" sortKey="productScore" sort={sort} onSort={toggle} align="center" />
                <th className="px-3 py-4 font-bold">{t("Izoh")}</th>
                <th className="px-3 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {recs.map((r, i) => (
                <tr key={r.id} className={`border-b border-line last:border-0 ${i % 2 ? "bg-surface/30" : ""}`}>
                  <td className="px-5 py-3 font-semibold text-muted tabular-nums">{i + 1}</td>
                  <td className={`px-5 py-3 font-bold sticky left-0 z-10 border-r border-line ${i % 2 ? "bg-surface" : "bg-panel"}`}>{r.customerName}</td>
                  <td className="px-3 py-3 font-semibold text-muted">{r.phone || "—"}</td>
                  <td className="px-3 py-3 font-semibold">{nameOf(r.installerId)}</td>
                  <td className="px-3 py-3 font-semibold text-muted">{r.installedDate || "—"}</td>
                  <td className="px-3 py-3 font-semibold text-muted">{r.createdAt ? String(r.createdAt).slice(0, 10) : "—"}</td>
                  <td className={`px-3 py-3 text-center font-extrabold text-lg ${scoreCls(r.score)}`}>{r.score}</td>
                  <td className={`px-3 py-3 text-center font-extrabold text-lg ${scoreCls(r.productScore)}`}>{r.productScore ?? "—"}</td>
                  <td className="px-3 py-3 font-semibold max-w-xs">
                    {r.comment ? <p className="truncate" title={r.comment}>{r.comment}</p> : null}
                    {r.productComment ? <p className="text-xs text-muted truncate" title={r.productComment}>{t("Mahsulot")}: {r.productComment}</p> : null}
                    {!r.comment && !r.productComment ? <span className="text-muted">—</span> : null}
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <button onClick={() => setModal({ rec: r })} className="text-muted hover:text-brand mr-3"><Pencil size={16} /></button>
                    <button onClick={() => { removeNps(r.id); bump(); }} className="text-muted hover:text-danger"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {modal && (
        <NpsModal installers={installers} initial={modal.rec}
          onClose={() => setModal(null)} onSave={save} />
      )}
    </div>
  );
}

// Sahifa holati — realtime hodisasi kelib butun daraxt qayta
// chizilganda ham rahbar ochgan xodim va tanlangan oy saqlanib qolsin
// (aks holda raqam kiritayotganda ro'yxatga qaytib ketardi).
let uiOpenId = null;
let uiMonth = null;

// ══════════════════════════════════════════════════════════════
export default function Kpi() {
  const { user } = useAuth();
  const staff = listStaff().filter((s) => s.active !== false);
  const isAdmin = can("staff.manage", user) || can("finance.payroll", user);

  // O'z yozuvini topish: avval id (haqiqiy xodim = profil id), keyin
  // email, oxirida ism bo'yicha
  const own = staff.find((s) => s.id === user.id)
    || staff.find((s) => user.email && s.email && s.email === user.email)
    || staff.find((s) => s.name === user.name)
    || staff[0];

  const [cursor, setCursor] = useState(() =>
    uiMonth ? new Date(+uiMonth.slice(0, 4), +uiMonth.slice(5, 7) - 1, 1) : new Date());
  const [tick, setTick] = useState(0);
  // Boshqa xodim yozgan o'zgarish ham darrov ko'rinsin
  const live = useLive();
  const bump = () => setTick((v) => v + 1);

  // Rahbar: "overview" yoki bitta xodim ochilgan. Xodim: doim o'zi.
  const [openId, setOpenIdState] = useState(uiOpenId);
  const setOpenId = (v) => { uiOpenId = v; setOpenIdState(v); };

  // Ustalar reytingi uchun kun oralig'i. Standart holat — tanlangan
  // oyning o'zi, ya'ni hech narsa o'zgarmaydi; rahbar xohlasa hafta yoki
  // bitta kunga toraytiradi.
  const [insPeriod, setInsPeriod] = useState("Oy");
  const [insRange, setInsRange] = useState(() => periodRange("Oy"));
  const [insPicker, setInsPicker] = useState(false);

  const month = monthKey(cursor);
  const [y, mo] = month.split("-").map(Number);
  const shift = (n) => { const c = new Date(y, mo - 1 + n, 1); uiMonth = monthKey(c); setCursor(c); };

  // Xodimlarni ikkiga ajratamiz: ustalar (reyting) va menejerlar.
  // Rahbarlar ro'yxatga kirmaydi: ular oylik olmaydi, biznesdan NS
  // sifatida pul oladi (Kassa → NS). Ilgari ular ham xodim qatorida
  // turib, "shu paytgacha oylik" hisoblanardi va jami oylikni
  // ko'taradi — bu raqam yolg'on edi.
  const installers = staff.filter((s) => s.role === "installer");
  const managers = staff.filter((s) => s.role !== "installer" && s.role !== "owner");
  const isInstaller = own?.role === "installer";
  // Retention menejer ustalar NPS'ini belgilaydi — unga reyting ochiladi
  const isRetention = !!own && !isInstaller && getType(own.id) === "b2c_retention";
  // Do'kon (B2C) menejeri ustalarning kunlik ma'lumotini kiritadi
  // (davomat, kamera, olgan pul) — usta o'zi kirita olmaydi
  const isStore = !!own && !isInstaller && getType(own.id) === "b2c_store";

  // Yon menyudagi alohida bo'limlar: /kpi, /installers (Ustalar reytingi),
  // /nps (NPS baholari) — bir komponent, manzilga qarab bo'lim ko'rsatadi.
  const pathname = usePathname();
  const view = pathname === "/installers" ? "installers" : pathname === "/nps" ? "nps" : "kpi";
  // Bo'lim o'zgarsa ochilgan xodim yopiladi (ro'yxatga qaytadi)
  // Faqat bo'lim HAQIQATDA almashganda yopiladi. Ilgari bu effekt har
  // chizilganda ham ishlab ketardi va ochilgan xodim o'z-o'zidan
  // yopilib, foydalanuvchi ro'yxatga qaytib qolardi.
  const prevView = useRef(view);
  useEffect(() => {
    if (prevView.current === view) return;
    prevView.current = view;
    setOpenId(null);
  }, [view]);

  // Ustalarga "installer" turini bir marta biriktiramiz (agar hali yo'q bo'lsa).
  // Faqat haqiqiy hisoblar (uuid) — demo seed id'lari (u4) bazaga yozilmasin.
  const isUuid = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(String(id));
  useEffect(() => {
    for (const s of installers) if (isUuid(s.id) && !hasType(s.id)) setType(s.id, "installer");
  }, [installers.map((s) => s.id).join(",")]);

  const TITLES = {
    kpi: isAdmin ? "Xodimlar KPI — boshqaruv" : "Mening KPI va oyligim",
    installers: "Ustalar reytingi",
    nps: "NPS baholari",
  };
  const SUBS = {
    kpi: isAdmin ? "Har bir xodimning kunlik ko'rsatkichlari, reja va oyligini shu yerdan nazorat qilasiz"
      : "Kunlik raqamni kiritasiz — oyligingiz shu zahoti qayta hisoblanadi",
    installers: "Har usta nechta kamera o'rnatdi, davomati va bahosi",
    nps: "Mijoz baholarini shu yerda yuritasiz",
  };

  const canManageInstaller = isAdmin || isStore;      // ustani ochib tahrirlaydi
  const openInstaller = staff.find((s) => s.id === openId && s.role === "installer");
  const openManager = staff.find((s) => s.id === openId && s.role !== "installer");
  const avatar = (name) => (
    <span className="w-11 h-11 rounded-xl bg-brand text-white flex items-center justify-center font-extrabold text-lg">
      {(name || "?").slice(0, 1)}
    </span>
  );
  const backBtn = (label, onClick) => (
    <button onClick={onClick}
      className="flex items-center gap-2 rounded-xl border border-line font-bold px-4 py-2.5 hover:bg-surface">
      <ArrowLeft size={18} /> {t(label)}
    </button>
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-7">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">{t(TITLES[view])}</h1>
          <p className="text-muted font-semibold">{t(SUBS[view])}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} className="w-11 h-11 rounded-xl border border-line hover:border-brand flex items-center justify-center"><ChevronLeft size={18} /></button>
          <span className="font-extrabold text-lg w-40 text-center">{t(MONTHS[mo - 1])} {y}</span>
          <button onClick={() => shift(1)} className="w-11 h-11 rounded-xl border border-line hover:border-brand flex items-center justify-center"><ChevronRight size={18} /></button>
        </div>
      </div>

      {/* ═══════════ USTALAR REYTINGI ═══════════ */}
      {view === "installers" ? (
        openInstaller && canManageInstaller ? (
          <div>
            <div className="flex items-center gap-3 mb-6">
              {backBtn("Ustalar", () => setOpenId(null))}
              <div>
                <p className="text-xl font-extrabold">{openInstaller.name}</p>
                <p className="text-sm text-muted font-semibold">{t("O'rnatuvchi usta")}</p>
              </div>
            </div>
            <StaffDetail staffId={openInstaller.id} month={month} canEdit canRules={canManageInstaller}
              canEditPast={isAdmin} showSalary={canManageInstaller} payAnyDay={isAdmin}
              tick={tick} bump={bump} />
          </div>
        ) : (
          <>
            {/* Kun oralig'i — kamera, kech va dam shu bo'yicha sanaladi */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="bg-track rounded-2xl p-1.5 flex">
                {PERIODS.map((p) => (
                  <button key={p} onClick={() => { setInsPeriod(p); setInsRange(periodRange(p)); }}
                    className={`tab-btn ${insPeriod === p ? "active" : ""}`}>{t(p)}</button>
                ))}
              </div>
              <div className="relative">
                <button onClick={() => setInsPicker((v) => !v)}
                  className="card flex items-center gap-4 px-5 py-3 font-bold">
                  <CalendarDays size={20} className="text-brand" />
                  <span className="text-right leading-tight">
                    {fmtDate(insRange.from)}<br />{fmtDate(insRange.to)}
                  </span>
                </button>
                {insPicker && (
                  <DateRangePicker from={insRange.from} to={insRange.to}
                    onApply={(f, t2) => { setInsPeriod(null); setInsRange({ from: f, to: t2 }); setInsPicker(false); }}
                    onClose={() => setInsPicker(false)} />
                )}
              </div>
            </div>
            <InstallerBoard installers={installers} month={month} range={insRange} tick={tick}
              onOpen={canManageInstaller ? setOpenId : () => {}} canOpen={canManageInstaller}
              canEditRate={canManageInstaller} canEditNps={false} showSalary={canManageInstaller}
              highlightId={isInstaller ? own?.id : null} bump={bump} />
          </>
        )

      /* ═══════════ NPS BAHOLARI ═══════════ */
      ) : view === "nps" ? (
        (isAdmin || isRetention) ? (
          <NpsRecords installers={installers} month={month} tick={tick} bump={bump} />
        ) : (
          <div className="card p-10 text-center">
            <p className="font-extrabold mb-2">{t("Bu bo'lim retention menejer uchun")}</p>
            <p className="text-muted font-semibold">{t("NPS baholarini retention menejer yuritadi.")}</p>
          </div>
        )

      /* ═══════════ KPI VA OYLIK ═══════════ */
      ) : isAdmin ? (
        openManager ? (
          <div>
            <div className="flex items-center gap-3 mb-6">
              {backBtn("Orqaga", () => setOpenId(null))}
              <div>
                <p className="text-xl font-extrabold">{openManager.name}</p>
                <p className="text-sm text-muted font-semibold">{t(typeOf(getType(openManager.id)).label)}</p>
              </div>
            </div>
            <StaffDetail staffId={openManager.id} month={month} canEdit canRules
              canEditPast={isAdmin} showSalary tick={tick} bump={bump} />
          </div>
        ) : managers.length > 0 ? (
          <AdminOverview staff={managers} month={month} tick={tick} onOpen={setOpenId} bump={bump} />
        ) : (
          <div className="card p-10 text-center text-muted font-semibold">{t("Menejer yo'q")}</div>
        )
      ) : !own ? (
        <div className="card p-10 text-center">
          <p className="font-extrabold mb-2">{t("KPI hali sozlanmagan")}</p>
          <p className="text-muted font-semibold">{t("Rahbardan sizni tizimga qo'shishini so'rang.")}</p>
        </div>
      ) : (
        // Menejer yoki usta — o'z paneli
        <div>
          <div className="flex items-center gap-3 mb-6">
            {avatar(own.name)}
            <div>
              <p className="text-xl font-extrabold">{own.name}</p>
              <p className="text-sm text-muted font-semibold">
                {isInstaller ? t("O'rnatuvchi usta") : t(typeOf(getType(own.id)).label)}
              </p>
            </div>
          </div>
          {isInstaller && (
            <div className="card p-4 mb-4 text-sm text-muted font-semibold">
              {t("Ma'lumotni do'kon menejeri kiritadi. Bu yerda faqat natijangizni ko'rasiz.")}
            </div>
          )}
          <StaffDetail staffId={own.id} month={month} canEdit={!isInstaller} canRules={false}
            canEditPast={isAdmin} showSalary={isAdmin} tick={tick} bump={bump} />
        </div>
      )}
    </div>
  );
}
