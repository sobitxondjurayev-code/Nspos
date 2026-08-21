"use client";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine, Legend } from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { t, tt } from "@/lib/i18n";
import { foiz } from "@/lib/format";
import ChartCard from "@/components/ui/ChartCard";

// ══════════════════════════════════════════════════════════════
// PARETO — 80/20 qoidasi ko'zga tashlanadi
// ══════════════════════════════════════════════════════════════
// ABC tahlili jadval bo'lib turardi: 300 qator, har birida "ulushi"
// va "kumulyativ" foizi. Jadvaldan "nechta pozitsiya tushumning 80 %
// ini beradi" degan javobni ko'z bilan topib bo'lmaydi.
//
// Pareto aynan shuni ko'rsatadi: ustunlar — har birining ulushi,
// chiziq — jamlanma. Chiziq 80 % ga qayerda yetsa, o'sha yergacha
// bo'lgan pozitsiyalar "A sinf".
//
// ── IKKI O'Q TAQIQI ──
// Klassik Pareto ikki `Y` o'qi bilan chiziladi: chapda summa, o'ngda
// foiz. Bu YOZILMAYDI — ikki o'qning bir-biriga nisbati ixtiyoriy va
// grafik o'zi o'ylab topgan bog'liqlikni ko'rsatadi.
//
// Yechim: ikkala qiymat ham FOIZ. Ustun — "shu pozitsiya tushumning
// necha foizi", chiziq — "shu yergacha jami necha foiz". Bitta o'q,
// 0 dan 100 gacha. Hech narsa yo'qolmaydi.
export default function ParetoChart({ rows, cutA = 80, cutB = 95, label = "Pozitsiya" }) {
  const { chart } = useTheme();

  // Ekranga 40 tadan ko'p ustun sig'maydi — qolgani bitta "Boshqalar"
  // ustuniga yig'iladi. Jamlanma chiziq esa BUTUN ro'yxat bo'yicha
  // yuradi, ya'ni 100 % ga baribir yetadi.
  const MAX = 40;
  const asosiy = rows.slice(0, MAX);
  const qolgan = rows.slice(MAX);
  const data = [
    ...asosiy.map((r) => ({ nom: r.label, ulush: r.share, jamlanma: r.cumPct, abc: r.abc })),
    ...(qolgan.length ? [{
      nom: t("Boshqalar"),
      ulush: qolgan.reduce((a, r) => a + r.share, 0),
      jamlanma: 100,
      abc: "C",
      nechta: qolgan.length,
    }] : []),
  ];

  const rang = { A: chart.ok, B: chart.warn, C: chart.tick };

  return (
    <ChartCard
      title="Pareto — 80/20"
      hint={tt("Chiziq {a}% ga yetgan joygacha — A sinf. Undan keyin {b}% gacha — B.", { a: cutA, b: cutB })}
      oq="Ulushi, %"
      bosh={!rows.length}
      boshMatn="Ma'lumot yo'q"
      className="mb-6">
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke={chart.grid} />
        <XAxis dataKey="nom" tick={false} axisLine={{ stroke: chart.grid }}
          tickLine={false} height={12} />
        {/* BITTA o'q — ikkalasi ham foiz */}
        <YAxis domain={[0, 100]} tick={{ fill: chart.tick, fontSize: 12 }}
          tickLine={false} axisLine={false} width={44}
          tickFormatter={(v) => `${v}%`} />
        <ReferenceLine y={cutA} stroke={chart.ok} strokeDasharray="4 4"
          label={{ value: `${cutA}%`, position: "right", fill: chart.ok, fontSize: 11, fontWeight: 700 }} />
        <Tooltip
          cursor={{ fill: chart.grid, opacity: 0.35 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div className="bg-panel rounded-xl shadow-pop px-4 py-3 max-w-xs">
                <p className="font-bold mb-1 break-words">{d.nom}</p>
                {d.nechta && (
                  <p className="text-sm text-muted font-semibold">{tt("{n} ta pozitsiya", { n: d.nechta })}</p>
                )}
                <p className="font-extrabold">{t("Ulushi")}: {foiz(d.ulush, 2)}</p>
                <p className="text-sm text-muted font-semibold">{t("Jamlanma")}: {foiz(d.jamlanma, 2)}</p>
              </div>
            );
          }} />
        <Legend wrapperStyle={{ fontSize: 13, fontWeight: 700, paddingTop: 8 }} />
        <Bar name={t("Ulushi")} dataKey="ulush" radius={[4, 4, 0, 0]} maxBarSize={26}>
          {data.map((d, i) => <Cell key={i} fill={rang[d.abc] ?? chart.tick} />)}
        </Bar>
        <Line name={t("Jamlanma")} type="monotone" dataKey="jamlanma"
          stroke={chart.brand} strokeWidth={2} dot={false} />
      </ComposedChart>
    </ChartCard>
  );
}
