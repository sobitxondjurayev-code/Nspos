"use client";
import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { ShoppingCart, Snowflake, TriangleAlert } from "lucide-react";
import { t, tt } from "@/lib/i18n";
import { pul, son } from "@/lib/format";
import { useTheme } from "@/components/ThemeProvider";
import { useLive } from "@/components/DataProvider";
import { deadStock, storeOptions } from "@/lib/analytics";
import { sana } from "@/lib/format";

import DataTable from "@/components/ui/DataTable";
// Buyurtma bloki IKKI joyda chiziladi (bu tab va Hisobotlardagi
// "Buyurtma taklifi" kartasi) — nusxa emas, bitta komponent.
import ReorderPanel, { Kartochka } from "@/components/ReorderPanel";
import ChartCard from "@/components/ui/ChartCard";
import { SERIES } from "@/lib/chartColors";

// ══════════════════════════════════════════════════════════════
// QOLDIQ SALOMATLIGI — nima buyurtma qilish, nima muzlab qolgan
// ══════════════════════════════════════════════════════════════
// Ikki qarama-qarshi savol bitta sahifada, chunki ular bitta pul
// haqida: qoldiqqa qotib qolgan pul.
//
//   TUGAGAN   — pul KELMAYAPTI (tovar bor edi, sotilardi, endi yo'q)
//   O'LIK     — pul YOTIBDI   (tovar bor, lekin qimirlamayapti)
//
// Rahbar ikkalasini birga ko'rmasa noto'g'ri qaror qabul qiladi:
// o'lik qoldiqni ko'rmasdan "yana buyurtma beraylik" deydi.
const BOLIM = [
  { id: "reorder", label: "Buyurtma qilish kerak", icon: ShoppingCart },
  { id: "dead", label: "O'lik qoldiq", icon: Snowflake },
];


export default function StockHealthReport() {
  const [bolim, setBolim] = useState("reorder");
  const [storeId, setStoreId] = useState("all");
  const { chart } = useTheme();
  const live = useLive();

  // Buyurtma bloki (ro'yxat, kartochkalar, muddat, transferlar) —
  // `ReorderPanel` ichida. Bu yerda QAYTA hisoblanmaydi: `reorderList()`
  // og'ir (butun katalog × chek tarixi) va ikki marta chaqirilsa
  // sahifa ikki barobar sekinlashardi.
  const olik = useMemo(() => deadStock({ storeId }), [storeId, live]);

  const grafik = useMemo(
    () => olik.buckets.filter((b) => b.count > 0)
      .map((b) => ({ nom: b.label, qiymat: b.value, soni: b.count })),
    [olik]
  );

  return (
    <div>
      {/* Boshqaruv */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="bg-track rounded-2xl p-1.5 flex overflow-x-auto">
          {BOLIM.map((b) => (
            <button key={b.id} onClick={() => setBolim(b.id)}
              className={`tab-btn whitespace-nowrap flex items-center gap-2 ${bolim === b.id ? "active" : ""}`}>
              <b.icon size={16} /> {t(b.label)}
            </button>
          ))}
        </div>
        <select value={storeId} onChange={(e) => setStoreId(e.target.value)}
          className="card px-4 py-3 font-bold bg-panel sm:ml-auto">
          {storeOptions.map((s) => (
            <option key={s.id} value={s.id}>{t(s.name)}</option>
          ))}
        </select>
      </div>

      {bolim === "reorder" ? (
        <ReorderPanel storeId={storeId} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <Kartochka label="Muzlab qolgan pul" value={pul(olik.value)} icon={Snowflake}
              rang="text-warn" hint={tt("{n} pozitsiya", { n: son(olik.rows.length) })} />
            <Kartochka label="Tarix boshidan beri sotilmagan"
              value={pul(olik.buckets.at(-1)?.value ?? 0)}
              hint={tt("{n} ta tovar", { n: son(olik.buckets.at(-1)?.count ?? 0) })} />
            <Kartochka label="Sotuv tarixi" value={tt("{n} kun", { n: son(olik.tarix.kun) })}
              hint={tt("{a} dan {b} gacha", { a: olik.tarix.boshi, b: olik.tarix.oxiri })} />
          </div>

          {/* Tarix chegarasi ochiq aytiladi. Busiz "sotilmagan" degan
              yorliq "hech qachon sotilmagan" deb tushuniladi. */}
          <div className="card p-5 mb-6 flex items-start gap-3">
            <TriangleAlert size={18} className="text-warn shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-muted">
              {tt("Bazadagi sotuv tarixi {n} kun ({a} dan). Undan oldingi sotuvlar yo'q, shuning uchun \"sotilmagan\" degani \"{a} dan beri sotilmagan\" — bundan oldin sotilgan bo'lishi mumkin.",
                  { n: olik.tarix.kun, a: olik.tarix.boshi })}
            </p>
          </div>

          <ChartCard
            title="Qancha vaqtdan beri yotibdi"
            hint="Qoldiq puli tannarx bo'yicha. Guruhlar mavjud tarixdan hisoblangan."
            oq="Qoldiq puli, USD"
            bosh={!grafik.length}
            boshMatn="O'lik qoldiq yo'q"
            className="mb-6"
            balandlik="h-56 sm:h-64">
            <BarChart data={grafik} layout="vertical" margin={{ top: 4, right: 64, left: 4, bottom: 4 }}>
              <CartesianGrid horizontal={false} stroke={chart.grid} />
              <XAxis type="number" tick={{ fill: chart.tick, fontSize: 12, fontWeight: 600 }}
                tickLine={false} axisLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)} K` : v)} />
              <YAxis type="category" dataKey="nom" width={200} interval={0}
                tick={{ fill: chart.tick, fontSize: 12, fontWeight: 600 }}
                tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "transparent" }} content={<Ipuchi />} />
              {/* Bitta rang: ustun UZUNLIGI o'lchov, rang esa qo'shimcha
                  ma'no tashimaydi. Guruhlarni rangga bo'yash "yashil
                  yaxshi, qizil yomon" degan yolg'on ma'no qo'shardi —
                  aslida hammasi bir xil yomon, farqi faqat muddatda. */}
              <Bar dataKey="qiymat" radius={[0, 4, 4, 0]} maxBarSize={26}
                   label={{ position: "right", formatter: (v) => pul(v),
                            fill: chart.tick, fontSize: 11, fontWeight: 700 }}>
                {grafik.map((_, i) => <Cell key={i} fill={SERIES[0]} />)}
              </Bar>
            </BarChart>
          </ChartCard>

          <DataTable
            id="dead-stock"
            name={t("O'lik qoldiq")}
            rows={olik.rows}
            rowKey={(r) => r.product.id}
            boshSort={{ key: "stockValue", dir: "desc" }}
            minWidth="60rem"
            empty={{ icon: Snowflake, title: "O'lik qoldiq yo'q",
                     hint: "Hamma tovar oxirgi 90 kun ichida sotilgan." }}
            columns={[
              { key: "name", label: "Tovar", locked: true, width: "20rem",
                value: (r) => r.product.name,
                cell: (r) => <span className="font-bold">{r.product.name}</span> },
              { key: "stock", label: "Qoldiq", right: true,
                total: (rs) => son(rs.reduce((a, r) => a + r.stock, 0)) },
              { key: "stockValue", label: "Muzlagan pul", right: true,
                cell: (r) => <span className="font-extrabold text-warn">{pul(r.stockValue)}</span>,
                total: (rs) => pul(rs.reduce((a, r) => a + r.stockValue, 0)) },
              { key: "idleDays", label: "Qimirlamagan", right: true, value: (r) => r.idleDays ?? 99999,
                cell: (r) => (r.idleDays == null
                  ? <span className="font-bold text-warn">{t("sotilmagan")}</span>
                  : tt("{n} kun", { n: r.idleDays })) },
              { key: "lastSoldAt", label: "Oxirgi sotuv", right: true,
                cell: (r) => (r.lastSoldAt ?? <span className="text-faint">—</span>) },
              { key: "soldTotal", label: "Jami sotilgan", right: true,
                cell: (r) => son(r.soldTotal),
                total: (rs) => son(rs.reduce((a, r) => a + r.soldTotal, 0)) },
            ]}
          />
        </>
      )}
    </div>
  );
}

function Ipuchi({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-panel rounded-2xl shadow-pop px-4 py-3">
      <p className="font-bold mb-1">{d.nom}</p>
      <p className="font-extrabold tabular-nums">{pul(d.qiymat)}</p>
      <p className="text-sm font-semibold text-muted">{tt("{n} pozitsiya", { n: d.soni })}</p>
    </div>
  );
}
