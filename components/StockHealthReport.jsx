"use client";
import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { PackageX, ShoppingCart, Snowflake, TriangleAlert, Truck } from "lucide-react";
import { t, tt } from "@/lib/i18n";
import { pul, son } from "@/lib/format";
import { useTheme } from "@/components/ThemeProvider";
import { useLive } from "@/components/DataProvider";
import { useAuth } from "@/components/AuthProvider";
import { can } from "@/lib/auth";
import { reorderList, reorderSummary, deadStock, storeOptions } from "@/lib/analytics";
import { skladId } from "@/lib/storesData";
import { transferSummary } from "@/lib/transfersData";
import { sana } from "@/lib/format";
import BillzMuhr from "@/components/BillzMuhr";

// "NScamera Optim" → "Optim" — bo'linma satrida qisqa
const qisqaNom = (n) => String(n ?? "").replace(/^NScamera\s+/i, "");
import { getReorderDays, setReorderDays } from "@/lib/companyData";
import NumberField from "@/components/NumberField";
import DataTable from "@/components/ui/DataTable";
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

function Kartochka({ label, value, hint, rang = "text-ink", icon: Icon }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon size={16} className="text-muted" />}
        <p className="text-sm font-bold text-muted">{t(label)}</p>
      </div>
      <p className={`text-2xl sm:text-3xl font-extrabold tabular-nums ${rang}`}>{value}</p>
      {hint && <p className="text-sm font-semibold text-muted mt-1">{hint}</p>}
    </div>
  );
}

export default function StockHealthReport() {
  const [bolim, setBolim] = useState("reorder");
  const [storeId, setStoreId] = useState("all");
  const { chart } = useTheme();
  const live = useLive();
  const { user } = useAuth();
  // Muddatni faqat rahbar o'zgartiradi; boshqalar qiymatni ko'radi
  const rahbar = can("staff.manage", user);
  const [tick, setTick] = useState(0);

  const buyurtma = useMemo(() => reorderList({ storeId }), [storeId, live, tick]);
  const olik = useMemo(() => deadStock({ storeId }), [storeId, live]);
  // Filial tanlanganmi (Sklad emas, "Barcha" emas) — "Skladda" ustuni shunda
  const sklad = skladId();
  const filial = storeId !== "all" && !!sklad && storeId !== sklad;
  // "Barcha do'konlar" — Qoldiq YIG'INDI; nimadan yig'ilgani katakda
  // ko'rinsin (rahbar 2026-09-03: "yig'indi ko'rinishi kerak emasmi?")
  const bolinma = (r) => storeOptions.filter((s) => s.id !== "all")
    .map((s) => `${qisqaNom(s.name)} ${son(r.stockByStore?.[s.id] ?? 0)}`).join(" · ");

  // Transferlar — Billz `/v2/transfer` ko'zgusi, oxirgi 30 kun ("Kuniga"
  // ustuni bilan bitta davr). Filial tanlanganda — O'SHA filialga
  // kelganlar; "Barcha" — hamma yo'nalish. Rahbar (2026-09-03):
  // "skladdan qancha transfer bo'layotgani ko'rinmayapti".
  const transfer = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 86400000);
    return transferSummary(from, to, storeId === "all" ? {} : { toStoreId: storeId });
  }, [storeId, live]);
  // Kartochkalar — API va bot bilan BITTA yig'indi (`reorderSummary`)
  const yig = useMemo(() => reorderSummary(buyurtma), [buyurtma]);
  const muddat = yig.muddat;

  // Muddat `companies` da saqlanadi (`setReorderDays`) — ekran, API va
  // bot bir xil kun bilan hisoblaydi. Kiritilgan zahoti qayta hisob.
  const muddatQoy = (patch) => { setReorderDays(patch); setTick((v) => v + 1); };

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
        <>
          <div className={`grid grid-cols-2 ${filial ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-4 mb-6`}>
            {/* Faqat oxirgi 30 kunda sotilganlar. 90 kunlik zaxira oyna
                orqali "sotilyapti" bo'lib chiqqanlar (30 kundan beri
                sotilmagan) ALOHIDA aytiladi va pulga kirmaydi — 02.09 da
                43 dan 25 tasi shunday edi (DAFTAR 17). */}
            <Kartochka label="Tugab qolgan, lekin sotilyapti" value={son(yig.tugagan)}
              icon={PackageX} rang="text-danger"
              hint={yig.sokin
                ? tt("+{n} tasi tugagan, lekin 30 kundan beri sotilmagan", { n: son(yig.sokin) })
                : t("Tovar yo'q — sotuv yo'qotilmoqda")} />
            <Kartochka label="Kuniga yo'qotilayotgan foyda" value={pul(yig.yoqotishKun)} rang="text-danger"
              hint={tt("Oyiga taxminan {n}", { n: pul(yig.yoqotishKun * 30) })
                + (yig.tannarxsiz ? " · " + tt("{n} ta tovar tannarxsiz — hisobga kirmadi", { n: son(yig.tannarxsiz) }) : "")} />
            <Kartochka label="Buyurtma ro'yxati" value={son(yig.buyurtma)}
              hint={tt("Tugaganlar + {n} kunda tugaydiganlar", { n: muddat.lead })} />
            {/* Filial tanlanganda: qanchasi Skladdan ko'chirish bilan yopiladi
                (2026-09-03 — ilgari filialda 0 bo'lsa "buyurtma" derdi,
                Skladda turgan bo'lsa ham) */}
            {filial && (
              <Kartochka label="Skladdan ko'chirish kerak" value={son(yig.kochirishKerak)}
                icon={Truck} rang="text-brand"
                hint={yig.kochirishKerak
                  ? tt("{n} dona Skladda bor — buyurtma emas, ko'chirish", { n: son(yig.kochirishDona) })
                  : t("Skladda bu tovarlar yo'q")} />
            )}
          </div>

          {/* Formulani YASHIRMAYMIZ — raqamga ishonish uchun uni
              qanday chiqarilgani ko'rinib turishi kerak. Muddatni
              rahbar O'ZI belgilaydi (2026-09-02 qarori): Billz'da
              yetkazish muddati yozilmaydi, avtomat 14+30 taxmin edi. */}
          <div className="card p-5 mb-6 bg-surface">
            <p className="font-bold mb-1">{t("Buyurtma miqdori qanday hisoblanadi")}</p>
            <p className="text-sm font-semibold text-muted mb-3">
              {tt("kunlik o'rtacha sotuv × ({a} kun yetkazish + {b} kun zaxira) − hozirgi qoldiq", { a: muddat.lead, b: muddat.cover })}
              {". "}
              {t("Kunlik o'rtacha — oxirgi 30 kun; 30 kunda sotuv bo'lmasa 90 kunlik oyna (jadvalda \"Oyna\" ustuni).")}
            </p>
            {rahbar ? (
              <div className="grid grid-cols-2 gap-4 max-w-md">
                <label className="block">
                  <span className="block text-sm font-bold mb-2">{t("Yetkazish (kun)")}</span>
                  <NumberField value={muddat.lead} onChange={(v) => muddatQoy({ lead: v })} />
                </label>
                <label className="block">
                  <span className="block text-sm font-bold mb-2">{t("Zaxira (kun)")}</span>
                  <NumberField value={muddat.cover} onChange={(v) => muddatQoy({ cover: v })} />
                </label>
              </div>
            ) : (
              <p className="text-sm font-semibold text-muted">{t("Muddatni rahbar belgilaydi.")}</p>
            )}
          </div>

          {/* ── TRANSFERLAR (Billz) ── oxirgi 30 kun, yo'nalish bo'yicha.
              Tovar kesimi yo'q: Billz API transfer qatorlarini bermaydi
              (DAFTAR 18) — sarlavha (dona, tannarx, sana) bor. */}
          <div className="card p-5 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
              <p className="font-bold flex items-center gap-2">
                <Truck size={16} className="text-brand" />
                {t(storeId === "all" ? "Transferlar — oxirgi 30 kun" : "Bu do'konga kelgan transferlar — oxirgi 30 kun")}
              </p>
              <BillzMuhr entity="transfers" className="sm:ml-auto" />
            </div>
            <p className="text-sm font-semibold text-muted mb-3">
              {transfer.soni
                ? tt("{n} ta transfer · {d} dona · tannarxda {s} · sotuv narxida {r}", {
                    n: son(transfer.soni), d: son(transfer.dona), s: pul(transfer.supplyTotal), r: pul(transfer.retailTotal) })
                : t("Bu davrda transfer yo'q (yoki Billz'dan hali tortilmagan)")}
              {" · "}
              {t("Billz transferning tovar qatorlarini API orqali bermaydi — shuning uchun yo'nalish va summa ko'rinadi, tovar nomi emas.")}
            </p>
            {transfer.routes.length > 0 && (
              <DataTable
                id="transfer-routes"
                name={t("Transferlar")}
                rows={transfer.routes}
                rowKey={(r) => r.key}
                pin={false}
                minWidth="40rem"
                maxHeight="24rem"
                columns={[
                  { key: "yol", label: "Yo'nalish", locked: true,
                    value: (r) => `${r.fromName} → ${r.toName}`,
                    cell: (r) => <span className="font-bold">{qisqaNom(r.fromName)} → {qisqaNom(r.toName)}</span> },
                  { key: "soni", label: "Transfer", right: true, hint: "Necha marta yuborilgan",
                    cell: (r) => son(r.soni), total: (rs) => son(rs.reduce((a, r) => a + r.soni, 0)) },
                  { key: "dona", label: "Dona", right: true, hint: "Yuborilgan dona (Billz)",
                    cell: (r) => son(r.dona), total: (rs) => son(rs.reduce((a, r) => a + r.dona, 0)) },
                  { key: "donaQabul", label: "Qabul", right: true, hint: "Qabul qilingan dona; farq bo'lsa Billz'da belgilangan",
                    cell: (r) => (r.farqli
                      ? <span className="font-bold text-warn" title={t("Farqli transferlar bor")}>{son(r.donaQabul)} ⚠</span>
                      : son(r.donaQabul)),
                    total: (rs) => son(rs.reduce((a, r) => a + r.donaQabul, 0)) },
                  { key: "supplyTotal", label: "Tannarxda", right: true, hint: "Billz tannarx summasi",
                    cell: (r) => pul(r.supplyTotal), total: (rs) => pul(rs.reduce((a, r) => a + r.supplyTotal, 0)) },
                  { key: "retailTotal", label: "Sotuv narxida", right: true, hint: "Billz sotuv narxi summasi",
                    cell: (r) => pul(r.retailTotal), total: (rs) => pul(rs.reduce((a, r) => a + r.retailTotal, 0)) },
                  { key: "oxirgi", label: "Oxirgi", right: true, value: (r) => r.oxirgi ?? "",
                    cell: (r) => (r.oxirgi ? sana(r.oxirgi) : "—") },
                ]}
              />
            )}
          </div>

          <DataTable
            id="reorder-db"
            name={t("Buyurtma ro'yxati")}
            rows={buyurtma}
            rowKey={(r) => r.product.id}
            minWidth="66rem"
            empty={{ icon: ShoppingCart, title: "Buyurtma qilinadigan tovar yo'q",
                     hint: "Hamma tovarning qoldig'i kamida 14 kunga yetadi." }}
            qatorClass={(r) => (r.tugagan && !r.sokin ? "bg-danger/5" : r.sokin ? "bg-warn/5" : "")}
            columns={[
              { key: "name", label: "Tovar", locked: true, width: "20rem",
                value: (r) => r.product.name,
                cell: (r) => (
                  <span className="font-bold flex items-center gap-2">
                    {r.tugagan && <PackageX size={15} className="text-danger shrink-0" />}
                    {r.product.name}
                  </span>
                ) },
              { key: "stock", label: storeId === "all" ? "Qoldiq (jami)" : "Qoldiq", right: true,
                hint: storeId === "all"
                  ? "Billz joriy qoldig'i — HAMMA do'kon (Sklad ham) yig'indisi; ostida bo'linma"
                  : "Billz joriy qoldig'i — tanlangan do'kon",
                cell: (r) => (
                  <>
                    {r.stock <= 0 ? <span className="font-extrabold text-danger">0</span> : son(r.stock)}
                    {storeId === "all" && (
                      <span className="block text-xs font-semibold text-muted whitespace-nowrap">{bolinma(r)}</span>
                    )}
                  </>
                ),
                total: (rs) => son(rs.reduce((a, r) => a + r.stock, 0)) },
              ...(filial ? [{
                key: "skladda", label: "Skladda", right: true,
                hint: "Sklad (markaziy ombor) qoldig'i — Billz. Filialda tugagan bo'lsa avval shundan ko'chiriladi",
                value: (r) => r.skladda ?? 0,
                cell: (r) => (r.skladda > 0
                  ? <span className="font-bold text-brand">{son(r.skladda)}</span>
                  : <span className="text-faint">0</span>),
                total: (rs) => son(rs.reduce((a, r) => a + (r.skladda ?? 0), 0)),
              }] : []),
              { key: "avgDaily", label: "Kuniga", right: true,
                hint: "Kunlik o'rtacha sotuv: oxirgi 30 kunda sotilgan dona ÷ 30 (30 kunda sotilmagan bo'lsa 90 kun ÷ 90)",
                cell: (r) => son(r.avgDaily, 2) },
              // Tezlik qaysi oynadan — 90 bo'lsa tovar 30 kundan beri sotilmagan
              { key: "oyna", label: "Oyna", right: true,
                hint: "Tezlik qaysi davrdan hisoblangan: 30 kun — oxirgi oyda sotilgan; 90 kun — oxirgi oyda sotilmagan, zaxira oyna (raqam taxminiyroq)",
                cell: (r) => (r.oyna === 30
                  ? <span className="text-muted">{tt("{n} kun", { n: 30 })}</span>
                  : <span className="font-bold text-warn">{tt("{n} kun", { n: r.oyna })}</span>) },
              { key: "lastSoldAt", label: "Oxirgi sotuv", right: true,
                hint: "Oxirgi marta qachon sotilgan (Billz cheklari bo'yicha)",
                value: (r) => r.lastSoldAt ?? "",
                cell: (r) => (r.lastSoldAt ?? <span className="text-faint">—</span>) },
              { key: "daysLeft", label: "Yetadi", right: true, value: (r) => r.daysLeft ?? 9999,
                hint: "Qoldiq necha kunga yetadi: qoldiq ÷ kunlik o'rtacha",
                cell: (r) => (r.tugagan
                  ? <span className="font-bold text-danger">{t("tugagan")}</span>
                  : r.daysLeft == null ? <span className="text-faint">—</span>
                  : tt("{n} kun", { n: r.daysLeft })) },
              { key: "buyurtma", label: filial ? "Buyurtma / ko'chirish" : "Buyurtma", right: true,
                hint: filial
                  ? "Kerak = kuniga × (yetkazish + zaxira) − qoldiq. Skladda bor qismi KO'CHIRISH, qolgani buyurtma"
                  : "Kuniga × (yetkazish + zaxira kuni) − qoldiq — kamida 1",
                value: (r) => r.buyurtma,
                cell: (r) => (r.kochirish > 0
                  ? <span className="whitespace-nowrap">
                      <span className="font-extrabold text-brand">{tt("ko'chirish {n}", { n: son(r.kochirish) })}</span>
                      {r.buyurtmaQoldiq > 0 && <span className="block text-xs font-semibold text-muted">{tt("+ buyurtma {n}", { n: son(r.buyurtmaQoldiq) })}</span>}
                    </span>
                  : <span className="font-extrabold text-brand">{son(r.buyurtma)}</span>),
                total: (rs) => son(rs.reduce((a, r) => a + r.buyurtma, 0)) },
              { key: "kunlikYoqotish", label: "Yo'qotish/kun", right: true,
                hint: "Tugagan tovarda kuniga yo'qotilayotgan foyda: kuniga × (narx − tannarx). Faqat 30 kun oynasi va tannarxi ma'lum tovar uchun",
                // `null` Excelga bo'sh tushadi (ilgari −1 chiqardi — rahbarning
                // "minus qayerdan?" savolining bir manbai, 2026-09-03)
                value: (r) => r.kunlikYoqotish ?? null,
                // `null` — hisoblanmadi (30 kundan beri sotilmagan yoki
                // tannarx noma'lum); sabab yozib turadi, 0 emas.
                cell: (r) => (r.kunlikYoqotish > 0
                  ? <span className="font-bold text-danger">{pul(r.kunlikYoqotish)}</span>
                  : r.kunlikYoqotish == null
                    ? <span className="text-xs font-semibold text-warn">{t(r.sokin ? "30 kundan beri sotilmagan" : "tannarx yo'q")}</span>
                    : <span className="text-faint">—</span>),
                total: (rs) => pul(rs.reduce((a, r) => a + (r.kunlikYoqotish ?? 0), 0)) },
              { key: "stockValue", label: "Qoldiq puli", right: true, cell: (r) => pul(r.stockValue),
                hint: "Qoldiq × tannarx — qoldiqqa bog'langan pul",
                total: (rs) => pul(rs.reduce((a, r) => a + r.stockValue, 0)) },
            ]}
          />
        </>
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
