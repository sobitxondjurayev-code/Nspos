"use client";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, Legend } from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { t, tt } from "@/lib/i18n";
import { pul, foiz, MANFIY_SABAB } from "@/lib/format";
import ChartCard from "@/components/ui/ChartCard";
import { SERIES, foldSeries } from "@/lib/chartColors";

// ══════════════════════════════════════════════════════════════
// BALANS STRUKTURASI
// ══════════════════════════════════════════════════════════════
// Balans hisoboti ikkita uzun ro'yxat edi: aktivlar va passivlar.
// Undan "pulimiz qayerda?" degan savolga javob topish uchun raqamlarni
// ko'z bilan solishtirish kerak bo'lardi — 270 758 va 8 347 ni.
//
// ── NEGA DOIRAVIY (PIE) EMAS ──
// Doiravi diagrammada burchakni ko'z bilan solishtirib bo'lmaydi, ayniqsa
// bo'lak ko'p bo'lsa. Gorizontal ustun esa bir o'lchovli: uzunlik
// bevosita summa. Har ustun yonida summa YOZILGAN.
//
// ── RANG ──
// Har modda alohida SHAXS (kim/nima), ya'ni seriya rangi. Palitrada
// beshta rang bor; oltinchisidan boshlab "Boshqalar" ga yig'iladi —
// yangi rang O'YLAB TOPILMAYDI (chunki ajratib bo'lmaydi).
export default function BalanceStructure({ balance }) {
  const { chart } = useTheme();

  const { aktiv, passiv, jamiA, jamiP } = useMemo(() => {
    const musbat = (xs) => xs.filter((x) => Math.abs(x.amount) > 0.009);
    const a = foldSeries(musbat(balance.assets ?? []), { id: (x) => x.key, value: (x) => Math.abs(x.amount) });
    const p = foldSeries(musbat(balance.liabilities ?? []), { id: (x) => x.key, value: (x) => Math.abs(x.amount) });
    return {
      aktiv: a, passiv: p,
      jamiA: +(balance.assets ?? []).reduce((s, x) => s + x.amount, 0).toFixed(2),
      jamiP: +(balance.liabilities ?? []).reduce((s, x) => s + x.amount, 0).toFixed(2),
    };
  }, [balance]);

  // Manfiy modda (masalan kassa hamyoni minusda) ustun UZUNLIGI bilan
  // ko'rsatiladi, lekin belgilanadi: nomi oldida "−", ustun qizil,
  // yorlig'i va ipuchi ishorali. Ilgari `Math.abs` uni musbat qilib
  // yuborardi — manfiy aktiv "pul bor" bo'lib ko'rinardi (2026-09-03).
  const chiz = (rows, jami, sarlavha, izoh) => (
    <ChartCard title={sarlavha} hint={izoh} oq="USD"
      bosh={!rows.length} boshMatn="Bu yerda hech narsa yo'q"
      balandlik={rows.length > 4 ? "h-64" : "h-48"}>
      <BarChart data={rows.map((x) => ({
          nom: (x.amount < 0 ? "− " : "") + t(x.label),
          summa: +Math.abs(x.amount).toFixed(2),
          ishorali: +Number(x.amount).toFixed(2),
          manfiy: x.amount < 0,
        }))}
        layout="vertical" margin={{ top: 4, right: 92, left: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke={chart.grid} />
        <XAxis type="number" tick={{ fill: chart.tick, fontSize: 12, fontWeight: 600 }}
          tickLine={false} axisLine={false}
          tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)} K` : v)} />
        <YAxis type="category" dataKey="nom" width={168} interval={0}
          tick={{ fill: chart.tick, fontSize: 12, fontWeight: 600 }}
          tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: "transparent" }} content={<Ipuchi jami={jami} />} />
        <Bar dataKey="summa" radius={[0, 4, 4, 0]} maxBarSize={24}
             label={{ position: "right", fill: chart.tick, fontSize: 11, fontWeight: 700,
                      formatter: (v, entry) => pul(entry?.payload?.ishorali ?? v) }}>
          {rows.map((x, i) => (
            <Cell key={i} fill={x.amount < 0 ? chart.danger : SERIES[i % SERIES.length]} />
          ))}
        </Bar>
      </BarChart>
    </ChartCard>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {chiz(aktiv, jamiA, "Pul qayerda turibdi (aktiv)",
        tt("Jami {n}. Ustun uzunligi — summa.", { n: pul(jamiA) }))}
      {chiz(passiv, jamiP, "Kimga qarzdormiz (passiv)",
        jamiP > 0 ? tt("Jami {n}.", { n: pul(jamiP) }) : t("Hech kimga qarz yo'q."))}
    </div>
  );
}

function Ipuchi({ active, payload, jami }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-panel rounded-2xl shadow-pop px-4 py-3">
      <p className="font-bold mb-1">{d.nom}</p>
      <p className={`font-extrabold tabular-nums ${d.manfiy ? "text-danger" : ""}`}>{pul(d.ishorali ?? d.summa)}</p>
      {d.manfiy && (
        <p className="text-sm font-semibold text-danger max-w-[16rem]">{t(MANFIY_SABAB.hamyon)}</p>
      )}
      {jami > 0 && !d.manfiy && (
        <p className="text-sm font-semibold text-muted">{foiz((d.summa / jami) * 100)}</p>
      )}
    </div>
  );
}
