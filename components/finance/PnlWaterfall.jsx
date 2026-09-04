"use client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine } from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { t } from "@/lib/i18n";
import { pul } from "@/lib/format";
import ChartCard from "@/components/ui/ChartCard";

// ══════════════════════════════════════════════════════════════
// SHARSHARA: tushum qayerda kamayadi
// ══════════════════════════════════════════════════════════════
// P&L sahifasida 13 ta kartochka va 4 ta jadval bor edi, grafik yo'q.
// Rahbar "tushum 76 940, sof foyda 16 960" ni ko'radi-yu, ORALIQDA
// pulning qayerda kamayganini raqamlarni bir-biridan ayirib topishi
// kerak bo'lardi.
//
// Sharshara aynan shu savolga javob beradi: har ustun oldingisidan
// qancha kamayganini KO'RSATADI.
//
// Recharts'da sharshara turi yo'q — u ikki qatlamli ustun bilan
// yasaladi: pastda KO'RINMAS tayanch, ustida haqiqiy o'zgarish.
// Boshlanish va yakun ustunlari noldan turadi (`tayanch = 0`).
//
// Nega `stackId` bilan emas: manfiy qiymatda stacked bar ikkiga
// bo'linib ketadi (`PayoutWaterfall` da ham shu sabab CSS ishlatilgan).
// Bu yerda tayanch har doim MUSBAT bo'lgani uchun muammo yo'q —
// pastga tushadigan qadamda tayanch = yangi (kichik) qiymat.
export default function PnlWaterfall({ pnl }) {
  const { chart } = useTheme();

  const tushum = pnl.revenue.total;
  const tannarx = pnl.cogs.total;
  const yalpi = pnl.grossProfit;
  const opex = pnl.expenses.opex + pnl.expenses.operationsTotal;
  const oylik = pnl.expenses.payroll + pnl.expenses.installerShare;
  const boshqa = pnl.expenses.writeoff + pnl.expenses.shrinkage + (pnl.expenses.boshqaChiqim ?? 0);
  const soliq = pnl.soliq?.summa ?? 0;
  const sof = pnl.netProfit;

  // Har qadam: [nom, o'zgarish, yakuniy daraja, tur]
  const qadamlar = [
    { nom: "Tushum", delta: tushum, yakun: tushum, tur: "bosh" },
    { nom: "Tannarx", delta: -tannarx, yakun: yalpi, tur: "kamayadi" },
    { nom: "Yalpi foyda", delta: yalpi, yakun: yalpi, tur: "oraliq" },
    { nom: "Xarajat", delta: -opex, yakun: yalpi - opex, tur: "kamayadi" },
    { nom: "Ish haqi", delta: -oylik, yakun: yalpi - opex - oylik, tur: "kamayadi" },
    ...(Math.abs(boshqa) > 0.01
      ? [{ nom: "Yo'qotish", delta: -boshqa, yakun: yalpi - opex - oylik - boshqa, tur: "kamayadi" }]
      : []),
    ...(soliq > 0.01
      ? [{ nom: "Soliq zaxirasi", delta: -soliq, yakun: yalpi - opex - oylik - boshqa - soliq, tur: "kamayadi" }]
      : []),
    { nom: "Sof foyda", delta: sof, yakun: sof, tur: "yakun" },
  ];

  const data = qadamlar.map((q) => {
    const noldan = q.tur === "bosh" || q.tur === "yakun" || q.tur === "oraliq";
    const past = noldan ? 0 : Math.min(q.yakun, q.yakun - q.delta);
    const bal = noldan ? Math.abs(q.yakun) : Math.abs(q.delta);
    return { nom: t(q.nom), tayanch: past, bal, delta: q.delta, yakun: q.yakun, tur: q.tur };
  });

  const rang = (tur, delta) =>
    tur === "yakun" ? (delta >= 0 ? chart.ok : chart.danger)
    : tur === "kamayadi" ? chart.danger
    : chart.brand;

  return (
    <ChartCard
      title="Pul qayerda kamayadi"
      hint="Har ustun oldingisidan qancha kamayganini ko'rsatadi"
      oq="USD"
      bosh={!(tushum > 0)}
      boshMatn="Bu davrda tushum yo'q"
      className="mb-8">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke={chart.grid} />
        <XAxis dataKey="nom" tick={{ fill: chart.tick, fontSize: 12, fontWeight: 700 }}
          tickLine={false} axisLine={{ stroke: chart.grid }} interval={0} />
        <YAxis tick={{ fill: chart.tick, fontSize: 12 }} tickLine={false}
          axisLine={false} width={78}
          tickFormatter={(v) => pul(v, { qisqa: true })} />
        <ReferenceLine y={0} stroke={chart.grid} />
        <Tooltip
          cursor={{ fill: chart.grid, opacity: 0.35 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div className="bg-panel rounded-xl shadow-pop px-4 py-3">
                <p className="font-bold mb-1">{d.nom}</p>
                <p className={`font-extrabold ${d.delta < 0 ? "text-danger" : "text-ok"}`}>
                  {d.delta < 0 ? "−" : "+"}{pul(Math.abs(d.delta))}
                </p>
                <p className="text-sm text-muted font-semibold mt-1">
                  {t("Qoldi")}: {pul(d.yakun)}
                </p>
              </div>
            );
          }} />
        {/* Ko'rinmas tayanch — ustunni kerakli balandlikka ko'taradi */}
        <Bar dataKey="tayanch" stackId="a" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="bal" stackId="a" radius={[6, 6, 0, 0]} maxBarSize={54}>
          {data.map((d, i) => <Cell key={i} fill={rang(d.tur, d.delta)} />)}
        </Bar>
      </BarChart>
    </ChartCard>
  );
}
