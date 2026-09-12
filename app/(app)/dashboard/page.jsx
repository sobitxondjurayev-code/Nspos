"use client";
import { t } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { ChevronDown } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from "recharts";
import { demoStores, fmtUSD } from "@/lib/demoData";
import { salesSeries, storeTotalsInRange, granularityFor, MONTHS_SHORT } from "@/lib/salesData";
import { MONTHS } from "@/lib/dates";
import PeriodPicker, { usePeriod } from "@/components/ui/PeriodPicker";
import { useLive, useDavrToliq } from "@/components/DataProvider";
import BillzMuhr from "@/components/BillzMuhr";

function ChartTooltip({ active, payload, label, granularity, combined, brand }) {
  if (!active || !payload?.length) return null;

  // Sarlavha bo'linishga qarab: soat / kun.oy.yil / oy yil
  const year = new Date().getFullYear();
  const monthIdx = MONTHS_SHORT.indexOf(label);
  const head =
    granularity === "hour" ? label
    : granularity === "day" ? `${label}.${year}`
    : `${monthIdx >= 0 ? MONTHS[monthIdx] : label} ${year}`;

  return (
    <div className="bg-panel rounded-2xl shadow-pop px-5 py-4 min-w-[16.25rem]">
      <div className="bg-surface rounded-xl text-center py-2 font-bold mb-3">{head}</div>
      <div className="space-y-3">
        {payload.map((p) => {
          const store = demoStores.find((s) => s.id === p.dataKey);
          const name = combined ? t("Barcha do'konlar") : store?.name;
          const color = combined ? brand : store?.color;
          return (
            <div key={p.dataKey} className="flex items-start gap-3">
              <span className="w-3.5 h-3.5 rounded-full mt-1" style={{ background: color }} />
              <div>
                <p className="font-bold leading-tight">{name}</p>
                <p className="font-bold" style={{ color }}>{fmtUSD(p.value)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const davr = usePeriod("Oy");
  const range = davr.range;
  const [combined, setCombined] = useState(false);
  const { chart } = useTheme();
  // `useLive()` — modul xotirasidan o'qiydigan har useMemo bog'lamiga
  // kerak (CLAUDE.md, 2026-08-13). Busiz bu sahifa `salesData` ning
  // BOSHLANG'ICH qiymatida qotib qolardi — u esa `lib/billzExport.js`
  // dagi muzlatilgan Excel nusxasi (01.01–22.07.2026). Ya'ni bosh
  // sahifa bazadagi 9 032 chekni emas, iyulda to'xtagan nusxani
  // ko'rsatardi va buni hech narsa bildirmasdi.
  const live = useLive();
  // `useToliq()` emas: bu sahifa FAQAT tanlangan davrni ko'rsatadi va
  // cheklar birinchi to'lqinda oxirgi 120 kun bilan keladi. Ya'ni
  // "Oy" davri uchun ma'lumot allaqachon to'liq — qolgan tarixni
  // kutib turish behuda kutish edi. "Yil" tanlansa esa avvalgidek
  // "yuklanmoqda" turadi (`lib/db.js` → `oyna`).
  const toliq = useDavrToliq(range.from);

  const data = useMemo(() => salesSeries(range.from, range.to), [range, live]);
  const totals = useMemo(() => storeTotalsInRange(range.from, range.to), [range, live]);
  const granularity = granularityFor(range.from, range.to);
  const grandTotal = +demoStores.reduce((a, s) => a + (totals[s.id] || 0), 0).toFixed(2);

  return (
    <div>
      <button className="flex items-center gap-3 text-4xl font-extrabold tracking-tight mb-3">
        {t("Barcha do'konlar")} <ChevronDown size={30} className="text-muted" />
      </button>

      {/* Grafikdagi savdo Billz ko'zgusidan keladi — demak bu sahifada
          ham muhr turishi SHART (CLAUDE.md 2026-09-03). Ilgari muhr
          9 sahifada bor edi-yu, aynan eng ko'p ochiladiganida yo'q
          edi: ma'lumot eskirsa yoki ko'zgu Billz'dan ajralsa, buni
          birinchi ko'radigan odam aynan shu ekranda ko'rmasdi. */}
      <BillzMuhr entity="orders" className="mb-8" />

      {/* Davr tanlash — standart komponent (`ui/PeriodPicker`).
          Ilgari bu yerda o'z nusxasi bor edi va telefonda "Yil" tabi
          ekrandan chiqib ketardi: lenta o'ralmasdi ham, surilmasdi
          ham. Standart komponentda bu allaqachon hal qilingan. */}
      <div className="mb-8">
        <PeriodPicker {...davr} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        {/* Grafik */}
        <div className="card p-7">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-2xl font-extrabold">{t("Sotuvlar")}</h2>
            {!toliq && (
              <span className="text-sm font-bold text-muted animate-pulse">
                {t("yuklanmoqda…")}
              </span>
            )}
          </div>
          <div className="h-[27.5rem]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="0" stroke={chart.grid} vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false}
                  tick={{ fill: chart.tick, fontSize: 13, fontWeight: 600 }}
                  interval="preserveStartEnd" minTickGap={20} />
                <YAxis tickLine={false} axisLine={false} width={44}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)} K` : v)}
                  tick={{ fill: chart.tick, fontSize: 13, fontWeight: 600 }} />
                <Tooltip content={<ChartTooltip granularity={granularity} combined={combined} brand={chart.brand} />} />

                {combined ? (
                  <Line type="monotone" dataKey="all" stroke={chart.brand} strokeWidth={3.5} dot={false}
                    activeDot={{ r: 7, strokeWidth: 3, stroke: chart.dot }} />
                ) : (
                  demoStores.map((s) => (
                    <Line key={s.id} type="monotone" dataKey={s.id} stroke={s.color}
                      strokeWidth={3.5} dot={false}
                      activeDot={{ r: 7, strokeWidth: 3, stroke: chart.dot }} />
                  ))
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* O'ng panel */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <p className="text-lg font-bold">{t("Umumiy grafik")}</p>
            <button onClick={() => setCombined(!combined)} aria-label={t("Umumiy grafik")}
              className={`w-14 h-8 rounded-full p-1 transition-colors ${combined ? "bg-brand" : "bg-track2"}`}>
              <span className={`block w-6 h-6 bg-panel rounded-full shadow transition-transform ${combined ? "translate-x-6" : ""}`} />
            </button>
          </div>

          <div className="space-y-3">
            {demoStores.map((store) => (
              <div key={store.id} className="bg-surface rounded-2xl px-5 py-4 flex items-start gap-3">
                <span className="w-3.5 h-3.5 rounded-full mt-1.5" style={{ background: store.color }} />
                <div>
                  <p className="font-bold">{store.name}</p>
                  {toliq
                    ? <p className="font-extrabold text-brand">{fmtUSD(totals[store.id] || 0)}</p>
                    : <span className="block h-5 w-24 mt-1 rounded bg-track2 animate-pulse" />}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-line mt-6 pt-5">
            <p className="text-lg text-muted font-semibold">{t("Umumiy summa:")}</p>
            {toliq
              ? <p className="text-3xl font-extrabold mt-1">{fmtUSD(grandTotal)}</p>
              : <span className="block h-8 w-40 mt-2 rounded bg-track2 animate-pulse" />}
          </div>
        </div>
      </div>
    </div>
  );
}
