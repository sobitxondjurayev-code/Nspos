"use client";
import { t, tt } from "@/lib/i18n";
import { useMemo, useState } from "react";
import {
  CalendarDays, TrendingUp, TrendingDown, Banknote, Landmark, AlertTriangle,
} from "lucide-react";
import { fmtUSD } from "@/lib/demoData";
import { PERIODS, periodRange, fmtDate } from "@/lib/dates";
import DateRangePicker from "@/components/DateRangePicker";
import { profitAndLoss, cashFlow, foydaPulKoprigi } from "@/lib/pnlData";
import { useLive } from "@/components/DataProvider";
import BillzMuhr from "@/components/BillzMuhr";
import PnlWaterfall from "@/components/finance/PnlWaterfall";
import { foiz } from "@/lib/format";
import StatCard from "@/components/finance/StatCard";
import Manfiy from "@/components/ui/Manfiy";

const tabs = ["Foyda va zarar", "Pul oqimi", "Foyda → Pul"];

/* Hisobot qatori — chapda nom, o'ngda summa.
   `negative` — musbat summani chiqim sifatida ko'rsatadi (ishorasini teskari qiladi).
   Ishorali qiymat (masalan sof oqim) `negative`siz beriladi va minusini saqlaydi. */
function Row({ label, value, hint, bold, tone, indent, negative, sabab }) {
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
        {/* `negative` qatorlar (xarajat, tannarx) — ko'rsatish uchun minus,
            ma'lumot musbat: "pul chiqdi". Ishorali qator (foyda, oqim)
            manfiy bo'lsa — sababi bilan (`Manfiy`). */}
        <Manfiy v={negative ? 0 : signed} sabab={sabab}>
          {signed < 0 ? "−" : ""}{fmtUSD(Math.abs(signed))}
        </Manfiy>
      </span>
    </div>
  );
}

const Divider = () => <div className="border-t border-dashed border-line my-2" />;

/* Uchala tab ham Billz yuklamalariga tayanadi: tushum va tannarx
   "Сводный"dan, solishtirish "Прибыли и убытки"dan, pul oqimi ДДС va
   samaradorlik hisobotidan. Qatorlar tab tanlanishini kutmay, sahifa
   ochilishi bilan tortiladi — aks holda tushum 0 bo'lib turardi. */

/* ——— P&L ——————————————————————————————————— */
function PnlView({ range, rows }) {
  const p = useMemo(() => profitAndLoss(range.from, range.to), [range, rows]);
  const exp = p.expenses;

  return (
    <div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-7">
        <StatCard icon={TrendingUp} label="Jami tushum" tone="green" value={fmtUSD(p.revenue.total)}
          hint={tt("{n} ta sotuv", { n: p.revenue.salesCount })} />
        <StatCard icon={Landmark} label="Yalpi foyda" value={fmtUSD(p.grossProfit)}
          hint={tt("Marja {n}%", { n: p.grossMargin })} />
        <StatCard icon={TrendingDown} label="Operatsion xarajatlar" tone="red"
          value={fmtUSD(exp.total + exp.installerShare)} />
        <StatCard icon={p.netProfit >= 0 ? TrendingUp : AlertTriangle} label="Sof foyda"
          tone={p.netProfit >= 0 ? "green" : "red"}
          value={<Manfiy v={p.netProfit} sabab="sofFoyda">{fmtUSD(p.netProfit)}</Manfiy>}
          hint={tt("Marja {n}%", { n: p.netMargin })} />
      </div>

      {/* Sharshara: tushumdan sof foydagacha pul qayerda kamayadi.
          U `profitAndLoss` ning to'liq obyektini kutadi, shuning
          uchun AYNAN shu komponentda turishi shart — pastdagi
          "Billz bilan solishtirish" bo'limida `p` umuman yo'q. */}
      <PnlWaterfall pnl={p} />

      <div className="card p-8 max-w-3xl">
        <h2 className="text-xl font-extrabold mb-4">{t("Foyda va zarar hisoboti")}</h2>

        {/* Yalpi savdo → (−) qaytarish → sof savdo. DAFTAR 20 (D):
            qaytarish avgustda 10.6 % (Optim 14.6 %) — u izoh qatori
            emas, bosh qator: rahbar foizni ko'rishi shart. */}
        <Row label={t("Yalpi savdo")} value={p.revenue.gross ?? p.revenue.goods}
          hint={tt("{n} ta sotuv", { n: p.revenue.salesCount })} />
        {p.revenue.returns > 0 && (
          <Row label={t("Qaytarilgan")} value={p.revenue.returns} tone="text-danger" negative
            hint={p.revenue.returnsPct ? tt("{n}% yalpi savdodan", { n: p.revenue.returnsPct }) : undefined} />
        )}
        {p.revenue.discounts > 0 && (
          <Row label={t("shundan chegirma berilgan")} value={p.revenue.discounts}
            indent tone="text-muted" negative />
        )}
        <Row label={t("Tovar sotuvi (sof)")} value={p.revenue.goods} bold />
        {p.revenue.services > 0 && (
          <Row label={t("Xizmat daromadi")} value={p.revenue.services}
            hint={tt("{n} buyurtma", { n: p.revenue.serviceCount })} />
        )}
        <Divider />
        <Row label={t("Jami tushum")} value={p.revenue.total} bold />

        <Divider />
        <Row label={t("Sotilgan tovar tannarxi")} value={p.cogs.goods} tone="text-danger" negative
          hint={t("montaj qatori tannarxsiz — usta puli ish haqida")} />
        {p.cogs.tannarxsiz?.qatorlar > 0 && (
          <Row label={tt("Tannarxsiz sotuv ({n} qator)", { n: p.cogs.tannarxsiz.qatorlar })}
            value={p.cogs.tannarxsiz.summa} indent tone="text-warn"
            hint={t("tannarxga kirmagan — foydasi noma'lum, 0 emas")} />
        )}
        {p.cogs.serviceMaterials > 0 && (
          <Row label={t("Xizmatdagi material tannarxi")} value={p.cogs.serviceMaterials}
            tone="text-danger" negative />
        )}
        <Divider />
        <Row label={t("Yalpi foyda")} value={p.grossProfit} bold sabab="sofFoyda"
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

        {p.soliq?.summa > 0 && (
          <>
            <Row label={t("Foyda (soliqdan oldin)")} value={p.soliqdanOldin} bold sabab="sofFoyda"
              tone={p.soliqdanOldin >= 0 ? "text-ok" : "text-danger"} />
            <Row label={tt("Soliq zaxirasi ({n}%)", { n: p.soliq.foiz })} value={p.soliq.summa}
              tone="text-danger" negative hint={t("Sozlamalar → Biznes qoidalari")} />
          </>
        )}
        <div className="border-t-2 border-line mt-4 pt-3">
          <Row label={t("SOF FOYDA")} value={p.netProfit} bold sabab="sofFoyda"
            tone={p.netProfit >= 0 ? "text-ok" : "text-danger"}
            hint={tt("{n}%", { n: p.netMargin })} />
        </div>
      </div>
    </div>
  );
}

/* ——— Cash Flow ——————————————————————————————— */
function CashFlowView({ range, rows }) {
  const c = useMemo(() => cashFlow(range.from, range.to), [range, rows]);

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-7">
        <StatCard icon={TrendingUp} label="Pul kirimi" tone="green" value={fmtUSD(c.in.total)} />
        <StatCard icon={TrendingDown} label="Pul chiqimi" tone="red" value={fmtUSD(c.out.total)} />
        <StatCard icon={Banknote} label="Sof pul oqimi"
          tone={c.net >= 0 ? "green" : "red"} value={fmtUSD(c.net)} />
        <StatCard icon={AlertTriangle} label="Qarzga berilgan" tone="amber" value={fmtUSD(c.onCredit)}
          hint={t("Tushum bor, pul yo'q")} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
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
          {/* "Qayerga ketdi" — kompaniya balansidan (DAFTAR 20): tovar
              uchun to'lov aktiv, NS foydani taqsimlash — ikkalasi P&L da
              yo'q, shuning uchun aynan shu yerda ko'rinishi shart. */}
          {(c.tovarUchun > 0 || c.ns > 0 || c.boshqaChiqim > 0) && (
            <div className="mt-1">
              {c.tovarUchun > 0 && <Row label={t("shundan tovar uchun to'lov")} value={c.tovarUchun} indent tone="text-muted" negative />}
              {c.ns > 0 && <Row label={t("shundan NS — rahbar olgan pul")} value={c.ns} indent tone="text-muted" negative />}
              {c.boshqaChiqim > 0 && <Row label={t("shundan boshqa chiqim (kassa)")} value={c.boshqaChiqim} indent tone="text-muted" negative />}
            </div>
          )}

          <div className="border-t-2 border-line mt-6 pt-3">
            <Row label={t("Sof pul oqimi")} value={c.net} bold sabab="pulOqimi"
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

/* ——— "Billz bilan solishtirish" OLIB TASHLANDI (2026-09-05) ————
   Bu yerda `BillzCompare` komponenti turardi: Billz Excel EKSPORTIGA
   tayanib P&L va pul oqimini yonma-yon ko'rsatardi. U tab ro'yxatida
   (`tabs`) allaqachon chaqirilmasdi, ya'ni ekranda ko'rinmasdi.

   Nega qaytarilmaydi: 2026-08-19 dan Billz ma'lumoti API orqali
   keladi va CLAUDE.md (2026-09-03) qoidasi aniq — Billz uchun
   Excel/demo ZAXIRA YO'LI YO'Q, ko'zgu bitta. Ikki yo'l qolsa
   ertami-kechmi ikki xil raqam beradi va qaysi biri to'g'riligi
   bilinmaydi. Solishtiruv endi boshqa joyda: farq detektori
   (`billzSync.moslikTekshir` → `BillzMuhr`) va `npm run billz:solishtir`.

   `lib/pnlData.js` dagi `billzPnl` / `billzPnlTotals` / `billzCashflow`
   endi hech kim chaqirmaydi — ular keyingi tozalashda olinadi (pul
   moduli, alohida o'lchov bilan). */

/* ——— Foyda → Pul ko'prigi ————————————————————————
   "Foyda bor, pul yo'q" degan savolga javob (DAFTAR 20 R). Har qator
   nima uchun foyda pulga aylanmaganini aytadi; "izohlanmagan" qator
   YASHIRILMAYDI — u yozilmagan tovar xaridi, ta'minotchi qarzi yoki
   kiritilmagan xarajat. */
function KoprikView({ range, rows }) {
  const k = useMemo(() => foydaPulKoprigi(range.from, range.to), [range, rows]);
  const katta = Math.abs(k.izohlanmagan) > Math.max(500, Math.abs(k.kutilgan) * 0.1);
  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-7">
        <StatCard icon={Landmark} label="Sof foyda (P&L)" tone={k.qatorlar[0].summa >= 0 ? "green" : "red"}
          value={fmtUSD(k.qatorlar[0].summa)} />
        <StatCard icon={Banknote} label="Kutilgan kassa o'zgarishi" value={fmtUSD(k.kutilgan)}
          hint={t("foyda − nasiya − tovar − NS ± oylik")} />
        <StatCard icon={Banknote} label="Haqiqiy kassa o'zgarishi" tone={k.haqiqiy >= 0 ? "green" : "red"}
          value={fmtUSD(k.haqiqiy)} hint={tt("{a} → {b}", { a: fmtUSD(k.kassaBoshi), b: fmtUSD(k.kassaOxiri) })} />
        <StatCard icon={AlertTriangle} label="Izohlanmagan farq" tone={katta ? "red" : "amber"}
          value={fmtUSD(k.izohlanmagan)} hint={t("yozilmagan xarid, ta'minotchi qarzi yoki xarajat")} />
      </div>

      <div className="card p-8 max-w-3xl">
        <h2 className="text-xl font-extrabold mb-1">{t("Foyda qanday qilib pulga aylanadi")}</h2>
        <p className="text-sm text-muted font-semibold mb-4">
          {t("Har qator sof foyda bilan kassa orasidagi farqning bir sababi. Nasiya bilan sotilgan tovar foyda, lekin pul emas; tovar uchun to'lov pul, lekin xarajat emas.")}
        </p>
        {k.qatorlar.map((r, i) => (
          <Row key={r.kalit} label={t(r.nom)} value={r.summa} bold={i === 0} hint={r.izoh}
            tone={r.summa < 0 ? "text-danger" : r.summa > 0 && i > 0 ? "text-ok" : undefined} />
        ))}
        <Divider />
        <Row label={t("Kutilgan kassa o'zgarishi")} value={k.kutilgan} bold />
        <Row label={t("Haqiqiy kassa o'zgarishi")} value={k.haqiqiy} bold
          tone={k.haqiqiy >= 0 ? "text-ok" : "text-danger"} />
        <div className="border-t-2 border-line mt-4 pt-3">
          <Row label={t("IZOHLANMAGAN FARQ")} value={k.izohlanmagan} bold
            tone={katta ? "text-danger" : "text-warn"}
            hint={t("haqiqiy − kutilgan")} />
        </div>
      </div>

      <div className="card p-6 mt-6 max-w-3xl flex items-start gap-3 bg-warn-soft">
        <AlertTriangle size={20} className="text-warn shrink-0 mt-0.5" />
        <p className="font-semibold text-[0.9375rem]">
          {t("Tovar xaridi (Billz «Приход») hali tizimga kelmaydi — tannarx ~96 000 $/oy, yozilgan to'lov ancha kam. Shu sabab «izohlanmagan» qator katta; u yashirilmaydi, Billz xarid oqimi ulangach kichrayadi.")}
        </p>
      </div>
    </div>
  );
}

export default function FinancePnl() {
  const [tab, setTab] = useState(tabs[0]);
  const [period, setPeriod] = useState("Oy");
  const [range, setRange] = useState(() => periodRange("Oy"));
  const [pickerOpen, setPickerOpen] = useState(false);
  const rows = useLive();

  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight mb-2">{t("Foyda va pul oqimi")}</h1>
      {/* Savdo, tannarx va qaytarish — hammasi Billz ko'zgusidan.
          Muhr ko'zgu qachon yangilanganini va Billz bilan mosligini
          aytadi; busiz eskirgan raqam "ishonarli yolg'on" bo'lardi. */}
      <BillzMuhr className="mb-4" />
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

      {tab === "Foyda va zarar" && <PnlView range={range} rows={rows} />}
      {tab === "Pul oqimi" && <CashFlowView range={range} rows={rows} />}
      {tab === "Foyda → Pul" && <KoprikView range={range} rows={rows} />}
    </div>
  );
}
