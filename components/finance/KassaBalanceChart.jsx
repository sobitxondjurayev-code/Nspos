"use client";
import { useMemo } from "react";
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend } from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { t, tt } from "@/lib/i18n";
import { pul } from "@/lib/format";
import ChartCard from "@/components/ui/ChartCard";
import { SERIES } from "@/lib/chartColors";
import { kassaBalanceSeries } from "@/lib/kassaData";

// ══════════════════════════════════════════════════════════════
// KASSA QOLDIG'I DINAMIKASI
// ══════════════════════════════════════════════════════════════
// Kassa sahifasi "bugun qancha pul bor" degan savolga javob berardi.
// Rahbarning ikkinchi savoli esa: "u o'syaptimi yoki kamayyaptimi?"
// Jadvaldan buni ko'z bilan topib bo'lmaydi.
//
// ── IKKI CHIZIQ, BITTA O'Q ──
// Qoldiq ham, kamomad ham DOLLAR — ya'ni bitta o'qqa tushadi. Ikki
// o'q ishlatilmaydi (u o'zi o'ylab topgan bog'liqlikni ko'rsatadi).
//
// Rang: qoldiq — seriya rangi (u shunchaki "pul"), kamomad — HOLAT
// rangi `danger` (u muammo). Bu ikkisi ataylab aralashtirilmaydi.
//
// Kamomad NOL CHIZIG'IDAN PASTGA tushadi: u manfiy son va shunday
// ko'rinishi kerak — "hisob-kitobda teshik bor" degani, "pul kam"
// degani emas.
export default function KassaBalanceChart({ from, to, live }) {
  const { chart } = useTheme();
  const data = useMemo(() => kassaBalanceSeries(from, to), [from, to, live]);

  const oxirgi = data.at(-1)?.qoldiq ?? 0;
  const birinchi = data[0]?.qoldiq ?? 0;
  const farq = +(oxirgi - birinchi).toFixed(2);
  const kamomadKun = data.filter((d) => d.kamomad < 0).length;

  return (
    <ChartCard
      title="Kassa qoldig'i — kunma-kun"
      hint={
        kamomadKun > 0
          ? tt("Davr davomida {a}. {n} kunda hamyonlardan biri minusda bo'lgan.", {
              a: farq >= 0 ? `+${pul(farq)}` : pul(farq), n: kamomadKun })
          : tt("Davr davomida {a}. Hech bir hamyon minusga tushmagan.", {
              a: farq >= 0 ? `+${pul(farq)}` : pul(farq) })
      }
      oq="USD"
      bosh={!data.length}
      className="mb-6"
      balandlik="h-56 sm:h-72">
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke={chart.grid} />
        <XAxis dataKey="sana" tick={{ fill: chart.tick, fontSize: 12, fontWeight: 600 }}
          tickLine={false} axisLine={false} minTickGap={16} />
        <YAxis tick={{ fill: chart.tick, fontSize: 12, fontWeight: 600 }}
          tickLine={false} axisLine={false} width={52}
          tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)} K` : v)} />
        <ReferenceLine y={0} stroke={chart.tick} />
        <Tooltip cursor={{ stroke: chart.grid }} content={<Ipuchi />} />
        <Legend verticalAlign="top" height={28} iconType="plainline"
          formatter={(v) => <span className="text-sm font-semibold text-muted">{t(v)}</span>} />
        <Line type="monotone" dataKey="qoldiq" name="Kassa qoldig'i"
          stroke={SERIES[0]} strokeWidth={2} dot={false}
          activeDot={{ r: 5, strokeWidth: 2, stroke: chart.dot }} />
        <Area type="monotone" dataKey="kamomad" name="Kamomad"
          stroke={chart.danger} fill={chart.danger} fillOpacity={0.18} strokeWidth={2} dot={false} />
      </ComposedChart>
    </ChartCard>
  );
}

function Ipuchi({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-panel rounded-2xl shadow-pop px-4 py-3 min-w-[11rem]">
      <p className="font-bold mb-1">{label}</p>
      <p className="font-extrabold tabular-nums">{pul(d.qoldiq)}</p>
      {d.kamomad < 0 && (
        <p className="text-sm font-bold text-danger mt-1">
          {t("Kamomad")}: {pul(d.kamomad)}
        </p>
      )}
    </div>
  );
}
