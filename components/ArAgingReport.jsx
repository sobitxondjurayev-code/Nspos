"use client";
import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { PhoneCall, Wallet, TriangleAlert } from "lucide-react";
import { t, tt } from "@/lib/i18n";
import { pul, son, foiz } from "@/lib/format";
import { useTheme } from "@/components/ThemeProvider";
import { useLive } from "@/components/DataProvider";
import { arAging, AR_BUCKETS, storeOptions } from "@/lib/analytics";
import DataTable from "@/components/ui/DataTable";
import ChartCard from "@/components/ui/ChartCard";
import { SERIES } from "@/lib/chartColors";

// ══════════════════════════════════════════════════════════════
// QARZ UNDIRISH USTUVORLIGI (AR aging)
// ══════════════════════════════════════════════════════════════
// "Jami qarz 50 930 $" degan bitta raqamdan hech narsa qilib
// bo'lmaydi. Ikki savol kerak:
//   1. Bu pulning qanchasi ESKI (ya'ni qaytmasligi mumkin)
//   2. Ertaga KIMGA qo'ng'iroq qilish kerak
//
// Mavjud "Qarzdorlar" jadvali qarzni to'lov TEZLIGI bo'yicha
// guruhlaydi — bu boshqa savol va u ham kerak, lekin bu emas.
export default function ArAgingReport() {
  const [storeId, setStoreId] = useState("all");
  const [tanlangan, setTanlangan] = useState(null);
  const { chart } = useTheme();
  const live = useLive();

  const d = useMemo(() => arAging({ storeId }), [storeId, live]);
  const rows = useMemo(
    () => (tanlangan ? d.rows.filter((r) => r.bucket === tanlangan) : d.rows),
    [d, tanlangan]
  );

  const eski = d.buckets.filter((b) => b.id === "d90" || b.id === "d90p")
    .reduce((a, b) => a + b.open, 0);
  const hechTolamagan = d.rows.filter((r) => r.ortachaKun == null);

  const grafik = useMemo(
    () => d.buckets.map((b) => ({ nom: t(b.label), pul: b.open, soni: b.count })),
    [d]
  );

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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card p-5">
          <p className="text-sm font-bold text-muted mb-1">{t("Ochiq qarz")}</p>
          <p className="text-2xl sm:text-3xl font-extrabold tabular-nums">{pul(d.open)}</p>
          <p className="text-sm font-semibold text-muted mt-1">
            {tt("{n} qarzdor", { n: son(d.rows.length) })}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-bold text-muted mb-1">{t("60 kundan eski")}</p>
          <p className="text-2xl sm:text-3xl font-extrabold tabular-nums text-warn">{pul(eski)}</p>
          <p className="text-sm font-semibold text-muted mt-1">
            {d.open > 0 ? tt("Ochiq qarzning {p} i", { p: foiz((eski / d.open) * 100) }) : "—"}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-bold text-muted mb-1">{t("Hech to'lov qilmagan")}</p>
          <p className="text-2xl sm:text-3xl font-extrabold tabular-nums text-danger">
            {pul(hechTolamagan.reduce((a, r) => a + r.open, 0))}
          </p>
          <p className="text-sm font-semibold text-muted mt-1">
            {tt("{n} qarzdor — birorta to'lov yozuvi yo'q", { n: son(hechTolamagan.length) })}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-bold text-muted mb-1">{t("Eng eski qarz")}</p>
          <p className="text-2xl sm:text-3xl font-extrabold tabular-nums">
            {tt("{n} kun", { n: son(Math.max(0, ...d.rows.map((r) => r.oldest))) })}
          </p>
        </div>
      </div>

      {/* Birinchi qo'ng'iroq ro'yxati — bu sahifadan chiqadigan
          yagona AMALIY narsa, shuning uchun eng tepada. */}
      {d.birinchi.length > 0 && (
        <div className="card p-5 sm:p-6 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <span className="w-10 h-10 rounded-xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
              <PhoneCall size={20} />
            </span>
            <div>
              <p className="text-lg font-extrabold">{t("Birinchi shularga qo'ng'iroq qiling")}</p>
              <p className="text-sm font-semibold text-muted mt-0.5">
                {t("90 kundan eski qarzlar ichida eng katta summalar. Faqat summa bo'yicha saralansa, kecha qarz olgan yirik mijoz tepaga chiqib qolardi.")}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {d.birinchi.map((r) => (
              <div key={r.key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-surface rounded-xl px-4 py-3">
                <span className="font-bold">{r.name}</span>
                <span className="text-sm font-semibold text-muted flex-1 min-w-[12rem]">
                  {r.phone ?? t("telefon yo'q")}
                  {" · "}
                  {r.ortachaKun == null
                    ? <span className="text-danger font-bold">{t("hech to'lov qilmagan")}</span>
                    : tt("avval o'rtacha {n} kunda to'lagan", { n: r.ortachaKun })}
                </span>
                <span className="font-extrabold tabular-nums shrink-0">{pul(r.open)}</span>
                <span className="text-sm font-bold text-warn tabular-nums shrink-0">
                  {tt("{n} kun", { n: r.oldest })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <ChartCard
        title="Qarz qancha vaqtdan beri ochiq"
        hint="Guruhga bosilsa jadval o'sha guruh bo'yicha filtrlanadi."
        oq="Ochiq qarz, USD"
        bosh={!d.open}
        boshMatn="Ochiq qarz yo'q"
        className="mb-6"
        balandlik="h-56 sm:h-64">
        <BarChart data={grafik} layout="vertical" margin={{ top: 4, right: 80, left: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke={chart.grid} />
          <XAxis type="number" tick={{ fill: chart.tick, fontSize: 12, fontWeight: 600 }}
            tickLine={false} axisLine={false}
            tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)} K` : v)} />
          <YAxis type="category" dataKey="nom" width={130} interval={0}
            tick={{ fill: chart.tick, fontSize: 12, fontWeight: 600 }}
            tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: "transparent" }} content={<Ipuchi jami={d.open} />} />
          <Bar dataKey="pul" radius={[0, 4, 4, 0]} maxBarSize={26}
               onClick={(_, i) => setTanlangan(AR_BUCKETS[i]?.id ?? null)}
               className="cursor-pointer"
               label={{ position: "right", fill: chart.tick, fontSize: 11, fontWeight: 700,
                        formatter: (v) => pul(v) }}>
            {grafik.map((_, i) => <Cell key={i} fill={SERIES[0]} />)}
          </Bar>
        </BarChart>
      </ChartCard>

      <div className="card p-5 mb-6 flex items-start gap-3">
        <TriangleAlert size={18} className="text-warn shrink-0 mt-0.5" />
        <p className="text-sm font-semibold text-muted">
          {t("Bir odam bazada bir necha marta yozilgan bo'lishi mumkin — bu yerda ular telefon bo'yicha bitta qarzdor deb qaralgan. Bazadagi yozuvlar o'chirilmagan va birlashtirilmagan.")}
        </p>
      </div>

      <DataTable
        id="ar-aging"
        name={t("Qarz undirish ro'yxati")}
        rows={rows}
        rowKey={(r) => r.key}
        count={rows.length}
        boshSort={{ key: "oldest", dir: "desc" }}
        minWidth="60rem"
        empty={{ icon: Wallet, title: "Bu guruhda qarzdor yo'q" }}
        columns={[
          { key: "name", label: "Qarzdor", locked: true, width: "18rem",
            cell: (r) => (
              <span className="font-bold flex items-center gap-2">
                {r.name}
                {r.nusxa > 1 && (
                  <span className="text-xs font-bold text-muted bg-surface rounded-lg px-2 py-0.5 shrink-0">
                    {r.nusxa}
                  </span>
                )}
              </span>
            ) },
          { key: "phone", label: "Telefon",
            cell: (r) => (r.phone ?? <span className="text-faint">—</span>) },
          { key: "open", label: "Ochiq qarz", right: true,
            cell: (r) => <span className="font-extrabold">{pul(r.open)}</span>,
            total: (rs) => pul(rs.reduce((a, r) => a + r.open, 0)) },
          { key: "oldest", label: "Eng eskisi", right: true,
            cell: (r) => (
              <span className={r.oldest > 90 ? "font-bold text-danger" : r.oldest > 60 ? "font-bold text-warn" : ""}>
                {tt("{n} kun", { n: r.oldest })}
              </span>
            ) },
          { key: "count", label: "Qarz soni", right: true,
            total: (rs) => son(rs.reduce((a, r) => a + r.count, 0)) },
          { key: "tolangan", label: "Ilgari to'lagan", right: true, cell: (r) => pul(r.tolangan),
            total: (rs) => pul(rs.reduce((a, r) => a + r.tolangan, 0)) },
          { key: "ortachaKun", label: "O'rtacha to'lov", right: true,
            value: (r) => r.ortachaKun ?? 99999,
            cell: (r) => (r.ortachaKun == null
              ? <span className="font-bold text-danger">{t("to'lamagan")}</span>
              : tt("{n} kun", { n: r.ortachaKun })) },
        ]}
      />
    </div>
  );
}

function Ipuchi({ active, payload, jami }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-panel rounded-2xl shadow-pop px-4 py-3">
      <p className="font-bold mb-1">{d.nom}</p>
      <p className="font-extrabold tabular-nums">{pul(d.pul)}</p>
      <p className="text-sm font-semibold text-muted">
        {tt("{n} qarz", { n: son(d.soni) })}
        {jami > 0 ? ` · ${foiz((d.pul / jami) * 100)}` : ""}
      </p>
    </div>
  );
}
