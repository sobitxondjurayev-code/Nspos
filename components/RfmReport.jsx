"use client";
import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { Users, TriangleAlert, Phone } from "lucide-react";
import { t, tt } from "@/lib/i18n";
import { pul, son, foiz } from "@/lib/format";
import { useTheme } from "@/components/ThemeProvider";
import { useLive } from "@/components/DataProvider";
import { rfm, storeOptions } from "@/lib/analytics";
import DataTable from "@/components/ui/DataTable";
import ChartCard from "@/components/ui/ChartCard";
import { SERIES } from "@/lib/chartColors";

// ══════════════════════════════════════════════════════════════
// MIJOZ SEGMENTATSIYASI (RFM)
// ══════════════════════════════════════════════════════════════
// Ro'yxatda 9 087 mijoz bor — bu ro'yxatga qarab hech qanday qaror
// qabul qilib bo'lmaydi. Savol boshqacha: KIMGA qo'ng'iroq qilish
// kerak va KIMNI yo'qotayotganimiz.
//
// Rang: segment nomi yonidagi nuqta — HOLAT (yaxshi / e'tibor
// kerak), seriya rangi emas. Ustunlar esa bitta rangda: ularning
// uzunligi o'zi o'lchov, rang qo'shimcha ma'no tashimaydi.
const HOLAT_RANG = { ok: "bg-ok", warn: "bg-warn", neutral: "bg-track2" };

export default function RfmReport() {
  const [storeId, setStoreId] = useState("all");
  const [tanlangan, setTanlangan] = useState(null);
  const live = useLive();

  const { chart } = useTheme();
  const d = useMemo(() => rfm({ storeId }), [storeId, live]);

  const rows = useMemo(
    () => (tanlangan ? d.rows.filter((r) => r.segment === tanlangan) : d.rows),
    [d, tanlangan]
  );

  const grafik = useMemo(
    () => d.segments.map((s) => ({ nom: t(s.label), pul: s.money, odam: s.count })),
    [d]
  );

  const birlashgan = d.rows.filter((r) => r.nusxa > 1).length;
  const asosiy = d.segments.find((s) => s.id === "asosiy");

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <select value={storeId} onChange={(e) => setStoreId(e.target.value)}
          className="card px-4 py-3 font-bold bg-panel">
          {storeOptions.map((s) => (
            <option key={s.id} value={s.id}>{t(s.name)}</option>
          ))}
        </select>
        {tanlangan && (
          <button onClick={() => setTanlangan(null)}
            className="rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-5 py-3">
            {t("Filtrni olib tashlash")}
          </button>
        )}
      </div>

      {/* Bosh xulosa — bitta jumla. Bu sahifadagi eng muhim gap. */}
      {asosiy && d.money > 0 && (
        <div className="card p-5 sm:p-6 mb-6">
          <p className="text-lg sm:text-xl font-extrabold">
            {tt("{n} ta \"Asosiy\" mijoz ({p}) barcha mijoz tushumining {m} ini beradi.", {
              n: son(asosiy.count),
              p: foiz((asosiy.count / d.rows.length) * 100),
              m: foiz((asosiy.money / d.money) * 100),
            })}
          </p>
          <p className="text-sm font-semibold text-muted mt-1">
            {t("Ular ketsa o'rnini to'ldirish uchun o'nlab yangi mijoz kerak bo'ladi.")}
          </p>
        </div>
      )}

      {/* Segmentlar — bosilsa jadval filtrlanadi */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {d.segments.map((s) => (
          <button key={s.id} onClick={() => setTanlangan(tanlangan === s.id ? null : s.id)}
            className={`card p-5 text-left transition-colors ${tanlangan === s.id ? "border-brand" : "hover:border-brand"}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2.5 h-2.5 rounded-full ${HOLAT_RANG[s.holat] ?? "bg-track2"}`} />
              <p className="font-extrabold">{t(s.label)}</p>
            </div>
            <p className="text-2xl font-extrabold tabular-nums">{son(s.count)}
              <span className="text-base font-bold text-muted"> {t("odam")}</span></p>
            <p className="font-bold text-brand tabular-nums">{pul(s.money)}</p>
            <p className="text-sm font-semibold text-muted mt-2">{t(s.izoh)}</p>
            <p className="text-sm font-bold text-ink mt-1">{t(s.nima)}</p>
          </button>
        ))}
      </div>

      {/* Dublikat va tarix haqida ochiq gap */}
      <div className="card p-5 mb-6 flex items-start gap-3">
        <TriangleAlert size={18} className="text-warn shrink-0 mt-0.5" />
        <div className="text-sm font-semibold text-muted space-y-1">
          <p>
            {tt("Bir odam bazada bir necha marta yozilgan bo'lishi mumkin — har do'kon o'zicha kiritgan. Bu yerda ular TELEFON bo'yicha bitta odam deb qaralgan ({n} ta odamda birdan ortiq yozuv bor). Bazadagi yozuvlar o'chirilmagan va birlashtirilmagan.", { n: son(birlashgan) })}
          </p>
          <p>
            {tt("Sotuv tarixi {k} kun ({a} dan). \"Uxlab qolgan\" degani \"180 kundan beri yo'q\" — undan uzoq muddatni bu ma'lumot ko'rsata olmaydi.", { k: d.tarix.kun, a: d.tarix.boshi })}
          </p>
        </div>
      </div>

      <ChartCard
        title="Pul qaysi segmentda"
        hint="Ustun uzunligi — o'sha segment qoldirgan pul. Odam soni ustun yonida."
        oq="Qoldirgan puli, USD"
        bosh={!grafik.length}
        className="mb-6"
        balandlik="h-64 sm:h-72">
        <BarChart data={grafik} layout="vertical" margin={{ top: 4, right: 96, left: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke={chart.grid} />
          <XAxis type="number" tick={{ fill: chart.tick, fontSize: 12, fontWeight: 600 }}
            tickLine={false} axisLine={false}
            tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)} K` : v)} />
          <YAxis type="category" dataKey="nom" width={170} interval={0}
            tick={{ fill: chart.tick, fontSize: 12, fontWeight: 600 }}
            tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: "transparent" }} content={<Ipuchi />} />
          <Bar dataKey="pul" radius={[0, 4, 4, 0]} maxBarSize={24}
               label={{ position: "right", fill: chart.tick, fontSize: 11, fontWeight: 700,
                        formatter: (v) => pul(v) }}>
            {grafik.map((_, i) => <Cell key={i} fill={SERIES[0]} />)}
          </Bar>
        </BarChart>
      </ChartCard>

      <DataTable
        id="rfm"
        name={t("Mijozlar segmentatsiyasi")}
        rows={rows}
        rowKey={(r) => r.key}
        count={rows.length}
        boshSort={{ key: "money", dir: "desc" }}
        minWidth="62rem"
        limit={300}
        empty={{ icon: Users, title: "Bu segmentda mijoz yo'q" }}
        columns={[
          { key: "name", label: "Mijoz", locked: true, width: "18rem",
            cell: (r) => (
              <span className="font-bold flex items-center gap-2">
                {r.name}
                {r.nusxa > 1 && (
                  <span className="text-xs font-bold text-muted bg-surface rounded-lg px-2 py-0.5 shrink-0"
                        title={t("Bazada shuncha yozuv, telefon bo'yicha birlashtirilgan")}>
                    {r.nusxa}
                  </span>
                )}
              </span>
            ) },
          { key: "phone", label: "Telefon",
            cell: (r) => (r.phone
              ? <span className="font-semibold text-muted flex items-center gap-1.5">
                  <Phone size={13} /> {r.phone}
                </span>
              : <span className="text-faint">—</span>) },
          { key: "segment", label: "Segment", value: (r) => r.segment,
            cell: (r) => {
              const s = d.segments.find((x) => x.id === r.segment);
              return (
                <span className="font-bold flex items-center gap-2 whitespace-nowrap">
                  <span className={`w-2 h-2 rounded-full ${HOLAT_RANG[s?.holat] ?? "bg-track2"}`} />
                  {t(s?.label ?? r.segment)}
                </span>
              );
            } },
          { key: "checks", label: "Xarid", right: true,
            total: (rs) => son(rs.reduce((a, r) => a + r.checks, 0)) },
          { key: "money", label: "Qoldirgan puli", right: true,
            cell: (r) => <span className="font-extrabold">{pul(r.money)}</span>,
            total: (rs) => pul(rs.reduce((a, r) => a + r.money, 0)) },
          { key: "avgCheck", label: "O'rtacha chek", right: true, cell: (r) => pul(r.avgCheck),
            // O'rtachalarning o'rtachasi olinmaydi — jami pul / jami chek
            total: (rs) => {
              const c = rs.reduce((a, r) => a + r.checks, 0);
              const m = rs.reduce((a, r) => a + r.money, 0);
              return c > 0 ? pul(m / c) : "—";
            } },
          { key: "recency", label: "Oxirgi xarid", right: true, value: (r) => r.recency ?? 99999,
            cell: (r) => (r.recency == null ? <span className="text-faint">—</span>
              : <span className={r.recency > 180 ? "font-bold text-warn" : ""}>
                  {tt("{n} kun oldin", { n: r.recency })}
                </span>) },
          { key: "lastAt", label: "Sana", right: true,
            cell: (r) => <span className="text-muted font-semibold">{r.lastAt ?? "—"}</span> },
        ]}
      />
    </div>
  );
}

function Ipuchi({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-panel rounded-2xl shadow-pop px-4 py-3">
      <p className="font-bold mb-1">{d.nom}</p>
      <p className="font-extrabold tabular-nums">{pul(d.pul)}</p>
      <p className="text-sm font-semibold text-muted">{tt("{n} odam", { n: son(d.odam) })}</p>
    </div>
  );
}
