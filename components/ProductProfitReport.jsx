"use client";
import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine } from "recharts";
import { Package, TriangleAlert } from "lucide-react";
import { t, tt } from "@/lib/i18n";
import { pul, son, foiz } from "@/lib/format";
import { useTheme } from "@/components/ThemeProvider";
import { useLive } from "@/components/DataProvider";
import { productProfit, storeOptions } from "@/lib/analytics";
import DataTable from "@/components/ui/DataTable";
import ChartCard from "@/components/ui/ChartCard";
import PeriodPicker, { usePeriod } from "@/components/ui/PeriodPicker";
import { SERIES } from "@/lib/chartColors";

// ══════════════════════════════════════════════════════════════
// TOVAR KESIMIDA HAQIQIY FOYDA
// ══════════════════════════════════════════════════════════════
// Billz "eng ko'p sotilgan" ni beradi, "eng ko'p FOYDA keltirgan" ni
// bermaydi — tannarx uning hisobotiga kirmaydi. Amalda bu ikkisi
// boshqa tovarlar bo'lib chiqadi: aksessuar ko'p sotiladi, foyda
// esa kamera va domofonda.
//
// Bu sahifa BAZADAN ishlaydi (34 489 chek qatori), Excel yuklamasidan
// emas — har qatorda o'sha paytdagi tannarx saqlangan, ya'ni foyda
// taxmin qilinmaydi.
//
// ── RANG HAQIDA ──
// Ustunlar SERIYA rangida emas, HOLAT rangida: foyda — `ok`, zarar —
// `danger`. Bu qoidaga zid emas — bu yerda rang "kim" ni emas, "yaxshi
// yoki yomon" ni bildiradi, ya'ni haqiqatan holat. Har ustun yonida
// summa YOZILGAN, ya'ni ma'no faqat rangga tayanmaydi.
const KESIMLAR = [
  { id: "product", label: "Tovar" },
  { id: "category", label: "Kategoriya" },
  { id: "brand", label: "Brend" },
  { id: "store", label: "Do'kon" },
];

const TOP = 12;

function Kartochka({ label, value, hint, rang = "text-ink" }) {
  return (
    <div className="card p-5">
      <p className="text-sm font-bold text-muted mb-1">{t(label)}</p>
      <p className={`text-2xl sm:text-3xl font-extrabold tabular-nums ${rang}`}>{value}</p>
      {hint && <p className="text-sm font-semibold text-muted mt-1">{hint}</p>}
    </div>
  );
}

export default function ProductProfitReport() {
  const davr = usePeriod("Oy");
  const [by, setBy] = useState("product");
  const [storeId, setStoreId] = useState("all");
  const { chart } = useTheme();
  // Modul xotirasidan o'qiydigan bog'lam — `useLive()` busiz sahifa
  // birinchi yuklangan holatda qotib qoladi (CLAUDE.md).
  const live = useLive();

  const rows = useMemo(
    () => productProfit(davr.range.from, davr.range.to, { by, storeId }),
    [davr.range, by, storeId, live]
  );

  const jami = useMemo(() => {
    const revenue = rows.reduce((a, r) => a + r.revenue, 0);
    const cogs = rows.reduce((a, r) => a + r.cogs, 0);
    const profit = revenue - cogs;
    return { revenue, cogs, profit, margin: revenue > 0 ? (profit / revenue) * 100 : null };
  }, [rows]);

  // Zararda sotilganlar — alohida ajratiladi, chunki bu jadvalda
  // pastda ko'milib qoladi va hech kim pastgacha tushmaydi.
  const zarar = useMemo(
    () => rows.filter((r) => r.profit < 0).sort((a, b) => a.profit - b.profit),
    [rows]
  );

  // Grafik: eng ko'p foyda keltirgan TOP ta, qolgani bittaga yig'iladi.
  // "Boshqalar" ustuni YO'QOLMAYDI — aks holda grafikdagi yig'indi
  // kartochkadagi foydaga teng bo'lmay qoladi va odam sabab qidiradi.
  const grafik = useMemo(() => {
    const musbat = rows.filter((r) => r.profit > 0);
    const bosh = musbat.slice(0, TOP);
    const qolgan = musbat.slice(TOP);
    const data = bosh.map((r) => ({ nom: r.name, foyda: r.profit, marja: r.margin }));
    if (qolgan.length) {
      data.push({
        nom: tt("Boshqa {n} ta", { n: qolgan.length }),
        foyda: +qolgan.reduce((a, r) => a + r.profit, 0).toFixed(2),
        marja: null,
        boshqa: true,
      });
    }
    return data;
  }, [rows]);

  const kesimNomi = KESIMLAR.find((k) => k.id === by)?.label ?? "Tovar";

  return (
    <div>
      {/* Boshqaruv */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-6">
        <div className="bg-track rounded-2xl p-1.5 flex overflow-x-auto">
          {KESIMLAR.map((k) => (
            <button key={k.id} onClick={() => setBy(k.id)}
              className={`tab-btn whitespace-nowrap ${by === k.id ? "active" : ""}`}>
              {t(k.label)}
            </button>
          ))}
        </div>

        <select value={storeId} onChange={(e) => setStoreId(e.target.value)}
          className="card px-4 py-3 font-bold bg-panel">
          {storeOptions.map((s) => (
            <option key={s.id} value={s.id}>{t(s.name)}</option>
          ))}
        </select>

        <div className="lg:ml-auto"><PeriodPicker {...davr} /></div>
      </div>

      {/* Yig'ma raqamlar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kartochka label="Tushum" value={pul(jami.revenue)} />
        <Kartochka label="Tannarx (COGS)" value={pul(jami.cogs)} />
        <Kartochka label="Yalpi foyda" value={pul(jami.profit)}
          rang={jami.profit < 0 ? "text-danger" : "text-ok"} />
        <Kartochka label="Marja" value={jami.margin == null ? "—" : foiz(jami.margin)}
          hint={tt("{n} ta {k}", { n: son(rows.length), k: t(kesimNomi).toLowerCase() })} />
      </div>

      {/* Zarar — jadvaldan OLDIN, chunki bu tuzatiladigan yagona narsa */}
      {zarar.length > 0 && (
        <div className="card p-5 sm:p-6 mb-6 border-danger/40">
          <div className="flex items-start gap-3 mb-4">
            <span className="w-10 h-10 rounded-xl bg-danger/10 text-danger flex items-center justify-center shrink-0">
              <TriangleAlert size={20} />
            </span>
            <div>
              <p className="text-lg font-extrabold">
                {tt("{n} ta {k} ZARARIGA sotilgan — {s}", {
                  n: zarar.length, k: t(kesimNomi).toLowerCase(), s: pul(zarar.reduce((a, r) => a + r.profit, 0)),
                })}
              </p>
              <p className="text-sm font-semibold text-muted mt-0.5">
                {t("Sotuv narxi tannarxdan past. Ikki sabab bo'ladi: narx noto'g'ri qo'yilgan yoki tannarx Billz'da noto'g'ri turibdi.")}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {zarar.slice(0, 8).map((r) => (
              <div key={r.key} className="flex items-baseline justify-between gap-3 bg-surface rounded-xl px-4 py-2.5">
                <span className="font-bold truncate">{r.name}</span>
                <span className="font-extrabold text-danger tabular-nums shrink-0">{pul(r.profit)}</span>
              </div>
            ))}
          </div>
          {zarar.length > 8 && (
            <p className="text-sm font-semibold text-muted mt-3">
              {tt("Yana {n} ta — jadvaldan \"Foyda\" bo'yicha o'sishiga saralang.", { n: zarar.length - 8 })}
            </p>
          )}
        </div>
      )}

      {/* Grafik */}
      <ChartCard
        title={tt("Foyda qayerdan keladi — {k} kesimida", { k: t(kesimNomi).toLowerCase() })}
        hint={tt("Eng ko'p foyda keltirgan {n} tasi. Qolgani bitta ustunga yig'ilgan — yig'indi yuqoridagi foydaga teng.", { n: TOP })}
        oq="Foyda, USD"
        bosh={!grafik.length}
        boshMatn="Bu davrda foyda keltirgan sotuv yo'q"
        className="mb-6"
        balandlik="h-[26rem] sm:h-[30rem]">
        <BarChart data={grafik} layout="vertical" margin={{ top: 4, right: 56, left: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke={chart.grid} />
          <XAxis type="number" tick={{ fill: chart.tick, fontSize: 12, fontWeight: 600 }}
            tickLine={false} axisLine={false}
            tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)} K` : v)} />
          <YAxis type="category" dataKey="nom" width={150} interval={0}
            tick={{ fill: chart.tick, fontSize: 12, fontWeight: 600 }}
            tickLine={false} axisLine={false} />
          <ReferenceLine x={0} stroke={chart.tick} />
          <Tooltip cursor={{ fill: "transparent" }} content={<Ipuchi />} />
          <Bar dataKey="foyda" radius={[0, 4, 4, 0]} maxBarSize={22}
               label={{ position: "right", formatter: (v) => pul(v),
                        fill: chart.tick, fontSize: 11, fontWeight: 700 }}>
            {grafik.map((d, i) => (
              <Cell key={i} fill={d.boshqa ? chart.tick : SERIES[0]} />
            ))}
          </Bar>
        </BarChart>
      </ChartCard>

      {/* Jadval */}
      <DataTable
        id={`profit-${by}`}
        name={tt("Foyda — {k}", { k: t(kesimNomi) })}
        rows={rows}
        rowKey={(r) => r.key}
        boshSort={{ key: "profit", dir: "desc" }}
        minWidth="62rem"
        limit={300}
        empty={{ icon: Package, title: "Bu davrda sotuv yo'q",
                 hint: "Davrni o'zgartiring yoki Billz'dan ma'lumotni yangilang." }}
        qatorClass={(r) => (r.profit < 0 ? "bg-danger/5" : "")}
        columns={[
          { key: "name", label: kesimNomi, locked: true, width: "18rem",
            cell: (r) => <span className="font-bold">{r.name}</span> },
          { key: "qty", label: "Dona", right: true, value: (r) => r.qty,
            cell: (r) => son(r.qty),
            total: (rs) => son(rs.reduce((a, r) => a + r.qty, 0)) },
          { key: "checks", label: "Chek", right: true,
            total: (rs) => son(rs.reduce((a, r) => a + r.checks, 0)) },
          { key: "revenue", label: "Tushum", right: true, cell: (r) => pul(r.revenue),
            total: (rs) => pul(rs.reduce((a, r) => a + r.revenue, 0)) },
          { key: "cogs", label: "Tannarx", right: true,
            cell: (r) => <span className="text-muted">{pul(r.cogs)}</span>,
            total: (rs) => pul(rs.reduce((a, r) => a + r.cogs, 0)) },
          { key: "profit", label: "Foyda", right: true,
            cell: (r) => (
              <span className={`font-extrabold ${r.profit < 0 ? "text-danger" : "text-ok"}`}>
                {pul(r.profit)}
              </span>
            ),
            total: (rs) => pul(rs.reduce((a, r) => a + r.profit, 0)) },
          { key: "margin", label: "Marja", right: true, value: (r) => r.margin ?? -999,
            cell: (r) => (r.margin == null ? <span className="text-faint">—</span> : foiz(r.margin)),
            // Marjaning O'RTACHASI olinmaydi — u yolg'on chiqadi
            // (kichik tovarning 90% i katta tovarning 12% ini ko'tarib
            // yuboradi). Jami marja = jami foyda / jami tushum.
            total: (rs) => {
              const rev = rs.reduce((a, r) => a + r.revenue, 0);
              const pr = rs.reduce((a, r) => a + r.profit, 0);
              return rev > 0 ? foiz((pr / rev) * 100) : "—";
            } },
          { key: "perUnit", label: "Donasiga", right: true, value: (r) => r.perUnit ?? -999999,
            cell: (r) => (r.perUnit == null ? <span className="text-faint">—</span> : pul(r.perUnit)),
            total: (rs) => {
              const q = rs.reduce((a, r) => a + r.qty, 0);
              const pr = rs.reduce((a, r) => a + r.profit, 0);
              return q > 0 ? pul(pr / q) : "—";
            } },
        ]}
      />
    </div>
  );
}

function Ipuchi({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-panel rounded-2xl shadow-pop px-4 py-3 min-w-[12rem]">
      <p className="font-bold mb-1">{d.nom}</p>
      <p className="font-extrabold text-ok tabular-nums">{pul(d.foyda)}</p>
      {d.marja != null && (
        <p className="text-sm font-semibold text-muted">{t("Marja")}: {foiz(d.marja)}</p>
      )}
    </div>
  );
}
