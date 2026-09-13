"use client";
import { useMemo, useState } from "react";
import { PackageX, ShoppingCart, Truck } from "lucide-react";
import { t, tt } from "@/lib/i18n";
import { pul, son, sana } from "@/lib/format";
import { useLive } from "@/components/DataProvider";
import { useAuth } from "@/components/AuthProvider";
import { can } from "@/lib/auth";
import { reorderList, reorderSummary, storeOptions } from "@/lib/analytics";
import { skladId } from "@/lib/storesData";
import { transferSummary } from "@/lib/transfersData";
import { getReorderDays, setReorderDays, getStockWindow, setStockWindow } from "@/lib/companyData";
import NumberField from "@/components/NumberField";
import DataTable from "@/components/ui/DataTable";
import BillzMuhr from "@/components/BillzMuhr";

// ══════════════════════════════════════════════════════════════
// BUYURTMA TAKLIFI — "nimani, qancha olish kerak"
// ══════════════════════════════════════════════════════════════
// IKKI joydan chiziladi:
//   • Hisobotlar → "Buyurtma taklifi" (alohida karta, rahbar so'radi
//     2026-09-04: zakaz juma kuni beriladi, uni qidirib o'tirmasin)
//   • Hisobotlar → "Qoldiq salomatligi" → "Buyurtma qilish kerak" tabi
//
// Shuning uchun u ALOHIDA komponent: ikkala joyda ham AYNAN shu kod va
// AYNAN `analytics.reorderList()` ishlaydi. Ikkinchi nusxa yozilganda
// ular ertami-kechmi bir-biriga qarshi chiqardi ("bir tushuncha —
// bitta funksiya", CLAUDE.md 2026-08-14).
//
// Do'kon tanlash BU YERDA EMAS — chaqiruvchi beradi (Qoldiq
// salomatligida bitta tanlagich ikkala tabga xizmat qiladi). Kesim
// filtri (kategoriya/brend/yetkazib beruvchi) ham shunday: berilmasa
// butun katalog — "Buyurtma taklifi" kartasi avvalgidek ishlaydi.

// "NScamera Optim" → "Optim" — bo'linma satrida qisqa
const qisqaNom = (n) => String(n ?? "").replace(/^NScamera\s+/i, "");

export function Kartochka({ label, value, hint, rang = "text-ink", icon: Icon }) {
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

export default function ReorderPanel({ storeId = "all", kesim = null }) {
  const live = useLive();
  const { user } = useAuth();
  // Muddatni faqat rahbar o'zgartiradi; boshqalar qiymatni ko'radi
  const rahbar = can("staff.manage", user);
  const [tick, setTick] = useState(0);

  const buyurtma = useMemo(() => reorderList({ storeId, kesim }), [storeId, kesim, live, tick]);
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
  // Sotuv oynasi — "kunlik o'rtacha necha kunlik tarixdan". Sozlamalar
  // → Biznes qoidalari bilan AYNAN bir qiymat (`companyData`), shu yerda
  // ham o'zgartiriladi: rahbar raqamni aynan shu ekranda ko'radi
  // (2026-09-13 fidbegi — "shuni o'zim o'zgartira oladigan qil").
  const oyna = useMemo(() => getStockWindow(), [live, tick]);

  // Muddat `companies` da saqlanadi (`setReorderDays`) — ekran, API va
  // bot bir xil kun bilan hisoblaydi. Kiritilgan zahoti qayta hisob.
  const muddatQoy = (patch) => { setReorderDays(patch); setTick((v) => v + 1); };
  const oynaQoy = (v) => { setStockWindow(v); setTick((x) => x + 1); };

  return (
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
          {/* Raqamlar QOTIRIB yozilmaydi: oyna o'zgargan kuni matn
              jimgina yolg'on bo'lib qolardi. Zaxira oyna — uch barobari
              (`analytics.stockCoverage`), shu yerda ham shundan chiqadi. */}
          {tt("Kunlik o'rtacha — oxirgi {n} kun; {n} kunda sotuv bo'lmasa {m} kunlik oyna (jadvalda \"Oyna\" ustuni).",
              { n: oyna, m: oyna * 3 })}
        </p>
        {rahbar ? (
          <div className="flex flex-wrap items-end gap-4 max-w-xl">
            <label className="block">
              <span className="block text-sm font-bold mb-2">{t("Yetkazish (kun)")}</span>
              <NumberField value={muddat.lead} onChange={(v) => muddatQoy({ lead: v })} />
            </label>
            <label className="block">
              <span className="block text-sm font-bold mb-2">{t("Zaxira (kun)")}</span>
              <NumberField value={muddat.cover} onChange={(v) => muddatQoy({ cover: v })} />
            </label>
            {/* Sotuv tarixi (oyna) — ilgari faqat Sozlamalarda edi va uni
                topib borish kerak bo'lardi. Qiymat O'SHA joyda saqlanadi
                (`stock.windowDays`), ya'ni ikki joyda ikki raqam emas. */}
            <label className="block">
              <span className="block text-sm font-bold mb-2">{t("Sotuv tarixi (kun)")}</span>
              <NumberField value={oyna} onChange={oynaQoy} />
            </label>
            <p className="text-sm font-semibold text-muted pb-3">
              {t("Eng kami 7 kun. Kam qoldiq chegarasi va boshqa qoidalar — Sozlamalar → Biznes qoidalari.")}
            </p>
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
  );
}
