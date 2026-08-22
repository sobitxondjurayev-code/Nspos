"use client";
import { useMemo } from "react";
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { t, tt } from "@/lib/i18n";
import { pul, foiz } from "@/lib/format";
import ChartCard from "@/components/ui/ChartCard";
import { SERIES } from "@/lib/chartColors";
import { kpis } from "@/lib/managementData";
import { MONTHS } from "@/lib/dates";

// ══════════════════════════════════════════════════════════════
// OYLARARO TREND — biznes o'syaptimi
// ══════════════════════════════════════════════════════════════
// Rahbariyat paneli BITTA davrni ko'rsatardi: "shu oyda 76 723".
// Undan "ko'pmi yoki kammi?" degan savolga javob yo'q — solishtirish
// uchun ikkinchi raqam kerak.
//
// Har oy uchun `kpis` NING O'ZI chaqiriladi. Hisob bu yerda qayta
// yozilmaydi: grafikdagi ustun va sahifadagi kartochka bir xil
// funksiyadan chiqadi, ya'ni ular ajralib keta olmaydi.
//
// ── BITTA O'Q ──
// Tushum, yalpi foyda va sof foyda — uchalasi DOLLAR. Marja esa foiz
// va u grafikka QO'SHILMAYDI: ikkinchi o'q ochish kerak bo'lardi.
// Marja ipuchida yoziladi.
export default function KpiTrend({ oylar = 6, live }) {
  const { chart } = useTheme();

  const data = useMemo(() => {
    const bugun = new Date();
    const out = [];
    for (let i = oylar - 1; i >= 0; i--) {
      const boshi = new Date(bugun.getFullYear(), bugun.getMonth() - i, 1);
      const oxiri = new Date(bugun.getFullYear(), bugun.getMonth() - i + 1, 0, 23, 59, 59, 999);
      // Kelajakdagi kunlar hisobga olinmaydi — joriy oy YARIM oy
      const to = oxiri > bugun ? bugun : oxiri;
      const k = kpis(boshi, to);
      out.push({
        oy: MONTHS[boshi.getMonth()].slice(0, 3),
        toliq: `${MONTHS[boshi.getMonth()]} ${boshi.getFullYear()}`,
        tushum: k.revenue,
        yalpi: k.grossProfit,
        sof: k.netProfit,
        marja: k.netMargin,
        joriy: i === 0,
      });
    }
    return out;
  }, [oylar, live]);

  const oxirgi = data.at(-1);
  const oldingi = data.at(-2);
  const osish = oldingi && oldingi.tushum > 0
    ? ((oxirgi.tushum - oldingi.tushum) / oldingi.tushum) * 100 : null;

  return (
    <ChartCard
      title={tt("Oxirgi {n} oy", { n: oylar })}
      hint={
        osish == null
          ? t("Joriy oy hali tugamagan — u to'liq oylar bilan teng emas.")
          : tt("Joriy oy o'tgan oyga nisbatan {a}. Joriy oy hali tugamagan.", {
              a: `${osish >= 0 ? "+" : ""}${foiz(osish)}`,
            })
      }
      oq="USD"
      bosh={!data.length}
      className="mb-6"
      balandlik="h-56 sm:h-72">
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke={chart.grid} />
        <XAxis dataKey="oy" tick={{ fill: chart.tick, fontSize: 12, fontWeight: 600 }}
          tickLine={false} axisLine={false} />
        <YAxis tick={{ fill: chart.tick, fontSize: 12, fontWeight: 600 }}
          tickLine={false} axisLine={false} width={52}
          tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)} K` : v)} />
        <ReferenceLine y={0} stroke={chart.tick} />
        <Tooltip cursor={{ fill: "transparent" }} content={<Ipuchi />} />
        <Legend verticalAlign="top" height={28}
          formatter={(v) => <span className="text-sm font-semibold text-muted">{t(v)}</span>} />
        {/* Tushum — ustun (hajm), foyda — chiziq (uning ichidagi ulush).
            Ikkalasi bir o'qda: ular bir xil o'lchov, dollar. */}
        <Bar dataKey="tushum" name="Tushum" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={40} />
        <Line type="monotone" dataKey="yalpi" name="Yalpi foyda"
          stroke={SERIES[1]} strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="sof" name="Sof foyda"
          stroke={SERIES[2]} strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ChartCard>
  );
}

function Ipuchi({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-panel rounded-2xl shadow-pop px-4 py-3 min-w-[13rem]">
      <p className="font-bold mb-2">
        {d.toliq}
        {d.joriy && <span className="ml-2 text-sm font-semibold text-muted">{t("(tugamagan)")}</span>}
      </p>
      <div className="space-y-1 text-sm font-semibold">
        <p className="flex justify-between gap-4">
          <span className="text-muted">{t("Tushum")}</span>
          <span className="font-extrabold tabular-nums">{pul(d.tushum)}</span>
        </p>
        <p className="flex justify-between gap-4">
          <span className="text-muted">{t("Yalpi foyda")}</span>
          <span className="font-extrabold tabular-nums">{pul(d.yalpi)}</span>
        </p>
        <p className="flex justify-between gap-4">
          <span className="text-muted">{t("Sof foyda")}</span>
          <span className={`font-extrabold tabular-nums ${d.sof < 0 ? "text-danger" : "text-ok"}`}>
            {pul(d.sof)}
          </span>
        </p>
        <p className="flex justify-between gap-4 pt-1 border-t border-line">
          <span className="text-muted">{t("Sof marja")}</span>
          <span className="font-bold tabular-nums">{foiz(d.marja)}</span>
        </p>
      </div>
    </div>
  );
}
