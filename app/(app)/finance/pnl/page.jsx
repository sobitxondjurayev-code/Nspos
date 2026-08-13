"use client";
import { t, tt } from "@/lib/i18n";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays, TrendingUp, TrendingDown, Banknote, Landmark, AlertTriangle,
} from "lucide-react";
import { fmtUSD } from "@/lib/demoData";
import { PERIODS, periodRange, fmtDate } from "@/lib/dates";
import DateRangePicker from "@/components/DateRangePicker";
import { profitAndLoss, cashFlow, billzPnl, billzPnlTotals, billzCashflow, pnlSourceGap } from "@/lib/pnlData";
import { listDatasets, loadRows } from "@/lib/datasets";
import { useLive } from "@/components/DataProvider";
import { demoStores } from "@/lib/demoData";
import StatCard from "@/components/finance/StatCard";

const tabs = ["Foyda va zarar", "Pul oqimi", "Billz bilan solishtirish"];

/* Hisobot qatori — chapda nom, o'ngda summa.
   `negative` — musbat summani chiqim sifatida ko'rsatadi (ishorasini teskari qiladi).
   Ishorali qiymat (masalan sof oqim) `negative`siz beriladi va minusini saqlaydi. */
function Row({ label, value, hint, bold, tone, indent, negative }) {
  const signed = negative ? -value : value;
  return (
    <div className={`flex items-baseline justify-between py-2.5 ${indent ? "pl-6" : ""}`}>
      <div className="min-w-0">
        <span className={`${bold ? "font-extrabold" : "font-semibold"} ${indent ? "text-muted" : ""}`}>
          {label}
        </span>
        {hint && <span className="text-sm text-muted font-semibold ml-2">{hint}</span>}
      </div>
      <span className={`shrink-0 tabular-nums ${bold ? "text-lg font-extrabold" : "font-bold"} ${tone ?? ""}`}>
        {signed < 0 ? "−" : ""}{fmtUSD(Math.abs(signed))}
      </span>
    </div>
  );
}

const Divider = () => <div className="border-t border-dashed border-line my-2" />;

/* ——— P&L ——————————————————————————————————— */
function PnlView({ range }) {
  const p = useMemo(() => profitAndLoss(range.from, range.to), [range]);
  const gap = useMemo(() => pnlSourceGap(range.from, range.to), [range]);
  const exp = p.expenses;

  return (
    <div>
      {/* Billz'ning ikki hisoboti bir davr uchun har xil raqam bersa,
          buni yashirmaymiz — rahbar qaysi biriga tayanishini o'zi
          hal qilsin. 1% dan kichik farqda bu blok chiqmaydi. */}
      {gap && (
        <div className="card p-5 mb-6 flex items-start gap-3 bg-brand-soft">
          <Landmark size={20} className="text-brand shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-bold mb-1">{t("Bu yerdagi foyda nasiyani ham hisoblaydi")}</p>
            <p className="text-sm font-semibold text-muted">
              {tt("To'liq oy bo'yicha yalpi foyda {a}. Billz'ning \"Прибыли и убытки\" hisobotida {b} — chunki u tovarni faqat puli kelganda tushum deb yozadi, nasiyaga berilgani esa hisobga olinmaydi. Bu yerda tovar sotilgan kuni tushum sanaladi: nasiya ham sotuv, uning puli keyin keladi.",
                { a: fmtUSD(gap.ourGross), b: fmtUSD(gap.pnlGross) })}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-5 mb-7">
        <StatCard icon={TrendingUp} label="Jami tushum" tone="green" value={fmtUSD(p.revenue.total)}
          hint={tt("{n} ta sotuv", { n: p.revenue.salesCount })} />
        <StatCard icon={Landmark} label="Yalpi foyda" value={fmtUSD(p.grossProfit)}
          hint={tt("Marja {n}%", { n: p.grossMargin })} />
        <StatCard icon={TrendingDown} label="Operatsion xarajatlar" tone="red"
          value={fmtUSD(exp.total + exp.installerShare)} />
        <StatCard icon={p.netProfit >= 0 ? TrendingUp : AlertTriangle} label="Sof foyda"
          tone={p.netProfit >= 0 ? "green" : "red"} value={fmtUSD(p.netProfit)}
          hint={tt("Marja {n}%", { n: p.netMargin })} />
      </div>

      <div className="card p-8 max-w-3xl">
        <h2 className="text-xl font-extrabold mb-4">{t("Foyda va zarar hisoboti")}</h2>

        <Row label={t("Tovar sotuvi")} value={p.revenue.goods} />
        {p.revenue.services > 0 && (
          <Row label={t("Xizmat daromadi")} value={p.revenue.services}
            hint={tt("{n} buyurtma", { n: p.revenue.serviceCount })} />
        )}
        <Divider />
        <Row label={t("Jami tushum")} value={p.revenue.total} bold />

        {(p.revenue.returns > 0 || p.revenue.discounts > 0) && (
          <div className="mt-1 mb-1">
            {p.revenue.returns > 0 && (
              <Row label={t("shundan qaytarilgan")} value={p.revenue.returns}
                indent tone="text-muted" negative />
            )}
            {p.revenue.discounts > 0 && (
              <Row label={t("shundan chegirma berilgan")} value={p.revenue.discounts}
                indent tone="text-muted" negative />
            )}
          </div>
        )}

        <Divider />
        <Row label={t("Sotilgan tovar tannarxi")} value={p.cogs.goods} tone="text-danger" negative />
        {p.cogs.serviceMaterials > 0 && (
          <Row label={t("Xizmatdagi material tannarxi")} value={p.cogs.serviceMaterials}
            tone="text-danger" negative />
        )}
        <Divider />
        <Row label={t("Yalpi foyda")} value={p.grossProfit} bold
          tone={p.grossProfit >= 0 ? "text-ok" : "text-danger"}
          hint={tt("{n}%", { n: p.grossMargin })} />

        <div className="mt-6 mb-2">
          <p className="font-extrabold text-muted text-sm uppercase tracking-wide">
            {t("Operatsion xarajatlar")}
          </p>
        </div>

        {exp.payroll > 0 && (
          <Row label={t("Ish haqi")} value={exp.payroll} tone="text-danger" negative />
        )}
        {exp.installerShare > 0 && (
          <Row label={t("Ustalar ulushi")} value={exp.installerShare} tone="text-danger" negative />
        )}
        {Object.entries(exp.byCategory).map(([label, amount]) => (
          <Row key={label} label={t(label)} value={amount} tone="text-danger" negative />
        ))}
        {exp.writeoff > 0 && (
          <Row label={t("Hisobdan chiqarilgan tovar")} value={exp.writeoff} tone="text-danger" negative />
        )}
        {exp.shrinkage > 0 && (
          <Row label={t("Inventarizatsiya kamomadi")} value={exp.shrinkage} tone="text-danger" negative />
        )}
        {exp.total + exp.installerShare === 0 && (
          <p className="text-muted font-semibold py-3">{t("Bu davrda xarajat qayd etilmagan")}</p>
        )}

        <Divider />
        <Row label={t("Jami xarajatlar")} value={exp.total + exp.installerShare}
          tone="text-danger" negative />

        <div className="border-t-2 border-line mt-4 pt-3">
          <Row label={t("SOF FOYDA")} value={p.netProfit} bold
            tone={p.netProfit >= 0 ? "text-ok" : "text-danger"}
            hint={tt("{n}%", { n: p.netMargin })} />
        </div>
      </div>
    </div>
  );
}

/* ——— Cash Flow ——————————————————————————————— */
function CashFlowView({ range }) {
  const live = useLive();
  // Servis kirimi Billz yuklamasidan olinadi, lekin yuklama qatorlari
  // ro'yxat bilan birga kelmaydi — shu sahifada kerak bo'lgani uchun
  // shu yerda tortiladi, kelgach hisob qayta yuriladi.
  const [rowsTick, setRowsTick] = useState(0);
  useEffect(() => {
    const ds = listDatasets().find((d) => d.reportId === "efficiency");
    if (!ds || ds.rows) return;
    let alive = true;
    loadRows(ds.id).then(() => { if (alive) setRowsTick((v) => v + 1); });
    return () => { alive = false; };
    // `live` bog'lamda: ilova ochilganda yuklamalar ro'yxati hali
    // kelmagan bo'lishi mumkin — o'shanda `ds` topilmaydi va qatorlar
    // hech qachon tortilmasdi (kassa "ДДС yuklang" deb turardi).
  }, [live]);

  const c = useMemo(() => cashFlow(range.from, range.to), [range, rowsTick, live]);

  return (
    <div>
      <div className="grid grid-cols-4 gap-5 mb-7">
        <StatCard icon={TrendingUp} label="Pul kirimi" tone="green" value={fmtUSD(c.in.total)} />
        <StatCard icon={TrendingDown} label="Pul chiqimi" tone="red" value={fmtUSD(c.out.total)} />
        <StatCard icon={Banknote} label="Sof pul oqimi"
          tone={c.net >= 0 ? "green" : "red"} value={fmtUSD(c.net)} />
        <StatCard icon={AlertTriangle} label="Qarzga berilgan" tone="amber" value={fmtUSD(c.onCredit)}
          hint={t("Tushum bor, pul yo'q")} />
      </div>

      <div className="grid grid-cols-2 gap-6 items-start">
        <div className="card p-8">
          <h2 className="text-xl font-extrabold mb-4 text-ok">{t("Pul kirimi")}</h2>
          <Row label={t("Naqd sotuv")} value={c.in.salesCash} />
          <Row label={t("Payme sotuv")} value={c.in.salesPayme} />
          {/* Karta ishlatilmaydi — eski yozuvda uchrasagina ko'rsatiladi */}
          {c.in.salesCard > 0 && <Row label={t("Karta sotuv")} value={c.in.salesCard} />}
          {c.in.debtCollected > 0 && <Row label={t("Qaytgan qarz puli")} value={c.in.debtCollected} />}
          {c.in.opsCash > 0 && <Row label={t("Naqd kirim (kassa)")} value={c.in.opsCash} />}
          {c.in.opsNonCash > 0 && <Row label={t("Payme kirim (kassa)")} value={c.in.opsNonCash} />}
          <Divider />
          <Row label={t("Jami kirim")} value={c.in.total} bold tone="text-ok" />
          {/* Servis puli cheklarning ichida keladi — yangi pul emas,
              shuning uchun jamidan keyin izoh qatori sifatida turadi. */}
          {c.in.service > 0 && (
            <Row label={t("shundan servis kassasiga")} value={c.in.service} indent tone="text-muted"
              hint={c.serviceSource.period
                ? tt("{a} — {b} yuklamasidan", {
                    a: fmtDate(new Date(c.serviceSource.period.from)),
                    b: fmtDate(new Date(c.serviceSource.period.to)) })
                : null} />
          )}
          {c.in.salesBalance > 0 && (
            <p className="text-sm text-muted font-semibold mt-3">
              {tt("Bundan tashqari {n} mijoz balansidan to'langan (yangi pul emas)",
                { n: fmtUSD(c.in.salesBalance) })}
            </p>
          )}
          {!c.serviceSource.ready && c.out.service > 0 && (
            <p className="text-sm text-muted font-semibold mt-3">
              {t("Servis kirimi ko'rinishi uchun \"Servis foydasi\" tahliliga Billz hisobotini yuklang.")}
            </p>
          )}
        </div>

        <div className="card p-8">
          <h2 className="text-xl font-extrabold mb-4 text-danger">{t("Pul chiqimi")}</h2>
          <Row label={t("Naqd chiqim")} value={c.out.cash} tone="text-danger" negative />
          <Row label={t("Payme chiqim")} value={c.out.nonCash} tone="text-danger" negative />
          {c.out.service > 0 && (
            <Row label={t("Servis kassasidan")} value={c.out.service} tone="text-danger" negative />
          )}
          <Divider />
          <Row label={t("Jami chiqim")} value={c.out.total} bold tone="text-danger" negative />

          <div className="border-t-2 border-line mt-6 pt-3">
            <Row label={t("Sof pul oqimi")} value={c.net} bold
              tone={c.net >= 0 ? "text-ok" : "text-danger"} />
          </div>

          <div className="bg-surface rounded-2xl p-5 mt-5 space-y-2">
            <p className="text-sm font-bold text-muted mb-1">{t("Turlar bo'yicha sof")}</p>
            <div className="flex justify-between font-semibold">
              <span className="text-muted">{t("Naqd")}</span>
              <span className={`font-extrabold ${c.byMethod.cash >= 0 ? "text-ok" : "text-danger"}`}>
                {fmtUSD(c.byMethod.cash)}
              </span>
            </div>
            <div className="flex justify-between font-semibold">
              <span className="text-muted">{t("Payme")}</span>
              <span className={`font-extrabold ${c.byMethod.nonCash >= 0 ? "text-ok" : "text-danger"}`}>
                {fmtUSD(c.byMethod.nonCash)}
              </span>
            </div>
            {c.byMethod.service !== 0 && (
              <div className="flex justify-between font-semibold">
                <span className="text-muted">{t("Servis kassasi")}</span>
                <span className={`font-extrabold ${c.byMethod.service >= 0 ? "text-ok" : "text-danger"}`}>
                  {fmtUSD(c.byMethod.service)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card p-6 mt-6 max-w-3xl flex items-start gap-3 bg-warn-soft">
        <AlertTriangle size={20} className="text-warn shrink-0 mt-0.5" />
        <p className="font-semibold text-[0.9375rem]">
          {t("Qarzga sotilgan tovar foyda hisobiga kiradi, lekin pul oqimiga kirmaydi — pul mijoz qarzni to'laganda keladi.")}
        </p>
      </div>
    </div>
  );
}

/* ——— Billz bilan solishtirish ——————————————————— */
function BillzCompare() {
  const rows = useMemo(() => billzPnl(), []);
  const tot = useMemo(() => billzPnlTotals(), []);
  const cf = useMemo(() => billzCashflow(), []);
  const storeName = (id) => demoStores.find((s) => s.id === id)?.name;

  // Hisob boshlanish sanasidan oldingi oylar sanalmaydi. Eksport eski
  // davrniki bo'lsa, bu bo'limda ko'rsatadigan narsa qolmaydi — nolni
  // raqam sifatida ko'rsatmay, nima qilish kerakligini aytamiz.
  if (!rows.length) {
    return (
      <div className="card p-10 text-center">
        <AlertTriangle size={40} className="mx-auto text-muted mb-4" />
        <p className="text-xl font-extrabold mb-2">{t("Bu davr uchun Billz raqamlari yo'q")}</p>
        <p className="text-muted font-semibold max-w-xl mx-auto">
          {t("Hisob 1-avgustdan yuritiladi, yuklangan eksport esa undan oldingi davrni qamragan. Billz'dan \"Прибыли и убытки\" hisobotini shu davr uchun chiqarib, \"Ma'lumot yuklash\" bo'limiga tashlang.")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="card p-5 mb-6 flex items-start gap-3 bg-brand-soft">
        <AlertTriangle size={20} className="text-brand shrink-0 mt-0.5" />
        <div>
          <p className="font-bold mb-1">{t("Billz eksportidan olingan haqiqiy raqamlar")}</p>
          <p className="text-sm font-semibold text-muted">
            {t("Billz operatsion xarajatlarni (ish haqi, ijara) hisobga olmaydi — uning \"sof foyda\"si aslida yalpi foyda. NSPOS'da ular ham chegiriladi.")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-5 mb-7">
        <StatCard icon={TrendingUp} label="Billz: tushum" value={fmtUSD(tot.revenue)}
          hint={tt("{d} sanasiga", { d: tot.date.split("-").reverse().join(".") })} />
        <StatCard icon={TrendingUp} label="Billz: sof tushum" tone="green" value={fmtUSD(tot.netRevenue)}
          hint={tt("Chegirma {a}, qaytarish {b}", { a: fmtUSD(tot.discounts), b: fmtUSD(tot.returns) })} />
        <StatCard icon={TrendingDown} label="Billz: tannarx" tone="red" value={fmtUSD(tot.cogs)} />
        <StatCard icon={Landmark} label="Billz: yalpi foyda" tone="green" value={fmtUSD(tot.grossProfit)}
          hint={tt("Marja {n}%", { n: tot.grossMarginPct })} />
      </div>

      <h2 className="text-2xl font-extrabold mb-4">{t("Do'konlar kesimida")}</h2>
      <div className="card overflow-auto max-h-[70vh] mb-8">
        <table className="w-full text-[0.9375rem]">
          <thead>
            <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-20 text-left text-muted text-sm border-b border-line [&>th]:bg-panel">
              <th className="px-6 py-4 font-bold">{t("Do'kon")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Tushum")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Chegirma")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Qaytarish")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Sof tushum")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Tannarx")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Yalpi foyda")}</th>
              <th className="px-6 py-4 font-bold text-right">{t("Marja")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.store} className="border-b border-line last:border-0 hover:bg-surface/70">
                <td className="px-6 py-4 font-bold">{storeName(r.storeId) ?? r.store}</td>
                <td className="px-4 py-4 text-right font-semibold">{fmtUSD(r.revenue)}</td>
                <td className="px-4 py-4 text-right font-semibold text-muted">{fmtUSD(r.discounts)}</td>
                <td className="px-4 py-4 text-right font-semibold text-muted">{fmtUSD(r.returns)}</td>
                <td className="px-4 py-4 text-right font-extrabold">{fmtUSD(r.netRevenue)}</td>
                <td className="px-4 py-4 text-right font-semibold text-danger">{fmtUSD(r.cogs)}</td>
                <td className="px-4 py-4 text-right font-extrabold text-ok">{fmtUSD(r.grossProfit)}</td>
                <td className="px-6 py-4 text-right font-bold">{r.grossMarginPct?.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-extrabold mb-4">{t("Billz ДДС: pul oqimi")}</h2>
      <div className="grid grid-cols-2 gap-6 items-start">
        <div className="card p-8">
          <Row label={t("Naqd")} value={cf.cash} />
          <Row label="Payme" value={cf.payme} />
          {cf.card > 0 && <Row label={t("Karta")} value={cf.card} />}
          {cf.service > 0 && <Row label={t("Servis")} value={cf.service} />}
          <Divider />
          <Row label={t("Jami kirim")} value={cf.total} bold tone="text-ok" />
          <p className="text-sm text-muted font-semibold mt-3">
            {tt("{n} ta operatsiya", { n: cf.count })}
          </p>
        </div>
        <div className="card p-8">
          <p className="font-extrabold mb-4">{t("Davr")}</p>
          <div className="flex justify-between font-semibold py-2.5">
            <span className="text-muted">{t("Kunlar")}</span>
            <span className="font-bold">{cf.days}</span>
          </div>
          <div className="flex justify-between font-semibold py-2.5">
            <span className="text-muted">{t("Operatsiyalar")}</span>
            <span className="font-bold">{cf.count}</span>
          </div>
          <Divider />
          <Row label={t("Kunlik o'rtacha")} value={cf.days > 0 ? +(cf.total / cf.days).toFixed(2) : 0} bold />
        </div>
      </div>
    </div>
  );
}

export default function FinancePnl() {
  const [tab, setTab] = useState(tabs[0]);
  const [period, setPeriod] = useState("Oy");
  const [range, setRange] = useState(() => periodRange("Oy"));
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight mb-2">{t("Foyda va pul oqimi")}</h1>
      <p className="text-muted font-semibold mb-7">
        {t("Hisobot NSPOS modullaridan yig'iladi: sotuv, tannarx, xizmat, xarajat va ish haqi")}
      </p>

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

      <div className="bg-track rounded-2xl p-1.5 flex w-fit mb-7">
        {tabs.map((tb) => (
          <button key={tb} onClick={() => setTab(tb)}
            className={`tab-btn ${tab === tb ? "active" : ""}`}>{t(tb)}</button>
        ))}
      </div>

      {tab === "Foyda va zarar" && <PnlView range={range} />}
      {tab === "Pul oqimi" && <CashFlowView range={range} />}
      {tab === "Billz bilan solishtirish" && <BillzCompare />}
    </div>
  );
}
