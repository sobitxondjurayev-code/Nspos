"use client";
import { useMemo, useState } from "react";
import { Boxes, PackageX, TriangleAlert, Snowflake } from "lucide-react";
import { t, tt } from "@/lib/i18n";
import { pul, son } from "@/lib/format";
import { useLive } from "@/components/DataProvider";
import { stockCoverage, coverageLevel } from "@/lib/analytics";
import { categoryName } from "@/lib/categoriesData";
import { listStores } from "@/lib/storesData";
import { sozlama } from "@/lib/companyData";
import DataTable from "@/components/ui/DataTable";
import MultiSelect from "@/components/ui/MultiSelect";
import FilterBar, { applyFilters } from "@/components/FilterBar";

// ══════════════════════════════════════════════════════════════
// OMBOR QOPLAMASI — qaysi tovar necha kunga yetadi
// ══════════════════════════════════════════════════════════════
// 2026-09-03 (rahbar fidbegi): bu bo'lim Hisobotlardan YO'QOLIB
// qolgan edi. Sabab kodda: `reports/page.jsx` faqat `bazadan: true`
// bo'lgan tahlilni chizadi, bu esa 24.08 da Excel yuklash bilan
// birga oqimdan chiqib ketgan. Hisoblagichning O'ZI esa o'sha
// kundan beri bazadan ishlaydi (`analytics.stockCoverage`) — ya'ni
// ma'lumot bor edi, unga eshik yo'q edi.
//
// "Qoldiq salomatligi" dan farqi: u faqat CHORA ko'rish kerak
// bo'lganini ko'rsatadi (buyurtma + o'lik qoldiq). Bu yerda esa
// BUTUN katalog turadi — "shu tovar qanchaga yetadi?" degan savolga
// javob har tovar uchun bor.
//
// Formula `stockCoverage` da, bu yerda QAYTA yozilmaydi
// (CLAUDE.md: bir tushuncha — bitta funksiya).
//
// Filtrlar (2026-09-04): do'kon — HISOB PARAMETRI (qoldiq va sotuv
// shu do'konlar bo'yicha yig'iladi), shuning uchun kartochkalar
// tepasida turadi. Holat — sanoqli tablar (bir o'lchov — bitta
// boshqaruv, panelda select yo'q). Qolgani — tayyor qatorlarni
// saralaydigan FILTR, `FilterBar` panelida: har ustunning o'z filtri.

const RANG = {
  out:      { matn: "Tugagan",   cls: "bg-danger-soft text-danger" },
  critical: { matn: "Kritik",    cls: "bg-danger-soft text-danger" },
  low:      { matn: "Kam",       cls: "bg-warn-soft text-warn" },
  ok:       { matn: "Yetarli",   cls: "bg-track text-muted" },
  none:     { matn: "Sotuv yo'q", cls: "bg-track text-muted" },
};

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

// Filtr variantlari — ro'yxatda HAQIQATDA uchragan qiymatlar, alifbo tartibida
const variantlar = (rows, key) =>
  [...new Set(rows.map((r) => r[key]).filter(Boolean))].sort()
    .map((v) => ({ value: v, label: v }));

export default function StockReport() {
  // `null` = barcha do'kon, aks holda id massivi (MultiSelect qoidasi)
  const [storeIds, setStoreIds] = useState(null);
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({});
  const live = useLive();

  // Qisqa oyna — `stockCoverage` bilan BIR XIL manbadan (sozlama).
  // Qotirib yozilsa sozlama o'zgargan kuni "zaxira oyna" belgisi
  // jimgina yolg'on ko'rsatardi.
  const oyna = sozlama("stock.windowDays", 30);

  const barcha = useMemo(() => stockCoverage({ storeIds }).map((r) => ({
    ...r,
    id: r.product.id,
    name: r.product.name,
    category: categoryName(r.product.categoryId) ?? "Kategoriyasiz",
    // Bo'sh brend/ta'minotchi ham TANLANADIGAN variant — aks holda
    // brendsiz 118 tovarni filtr bilan ajratib bo'lmasdi
    brand: r.product.brand || "Brendsiz",
    supplier: r.product.supplier || "Yetkazib beruvchisiz",
    daraja: coverageLevel(r.daysLeft, r),
  })), [storeIds, live]);

  // "Skladda" ustuni — `stockCoverage` filial tanlanganda `skladda`ni
  // beradi, aks holda null. Sklad qoidasi shu yerda TAKRORLANMAYDI:
  // qatorlarning o'zidan bilinadi (bitta manba).
  const filial = useMemo(() => barcha.some((r) => r.skladda != null), [barcha]);

  // `storeOptions` emas: u modul yuklanganda muzlatilgan nusxa, bazadan
  // keyin kelgan do'kon unga tushmaydi
  const doKonlar = useMemo(
    () => listStores().map((s) => ({ value: s.id, label: s.name })), [live]);

  const FIELDS = useMemo(() => {
    const brend = variantlar(barcha, "brand");
    const taminot = variantlar(barcha, "supplier");
    return [
      { key: "category", label: "Kategoriya", type: "multi", get: (r) => r.category,
        options: variantlar(barcha, "category") },
      // Bitta variantli filtr ma'nosiz — ko'rsatilmaydi
      ...(brend.length > 1 ? [{ key: "brand", label: "Brend", type: "multi",
        get: (r) => r.brand, options: brend }] : []),
      ...(taminot.length > 1 ? [{ key: "supplier", label: "Yetkazib beruvchi", type: "select",
        get: (r) => r.supplier, options: taminot }] : []),
      { key: "stock", label: "Qoldiq (dona)", type: "range", get: (r) => r.stock },
      { key: "daysLeft", label: "Necha kunga yetadi", type: "range", get: (r) => r.daysLeft ?? 0 },
      // Hech sotilmagan tovar — eng o'lik qoldiq: "90 kundan ko'p" filtriga
      // TUSHADI, "10 kungacha" ga tushmaydi (`Infinity` `|| 0` dan omon qoladi)
      { key: "idleDays", label: "Qimirlamagan (kun)", type: "range",
        get: (r) => r.idleDays ?? Infinity },
      // Ustun bilan BIR XIL formula: tannarx katalog → chek → noma'lum.
      // `stockCoverage.stockValue` (faqat katalog tannarxi) bu yerda ishlatilmaydi.
      { key: "stockValue", label: "Qoldiq qiymati ($)", type: "range",
        get: (r) => (r.tannarx == null ? 0 : r.stock * r.tannarx) },
      { key: "tannarx", label: "Tannarx", type: "select",
        get: (r) => (r.tannarx != null ? "bor" : "yoq"),
        options: [{ value: "bor", label: "Tannarxi bor" }, { value: "yoq", label: "Tannarxi yo'q" }] },
      // Sotuvsiz qatorda `oyna` uzun oyna bo'lib turadi — u "zaxira" EMAS,
      // ikkala variantga ham tushmaydi (uning o'z "Sotuv yo'q" tabi bor)
      { key: "oyna", label: "Oyna", type: "select",
        get: (r) => (r.avgDaily <= 0 ? null : r.oyna !== oyna ? "zaxira" : "qisqa"),
        options: [{ value: "qisqa", label: "Qisqa oyna" }, { value: "zaxira", label: "Zaxira oyna" }] },
    ];
  }, [barcha, oyna]);

  // Qidiruv + panel filtrlari — TAB dan oldin: tab sanoqlari shu ro'yxatdan,
  // ya'ni har tab sanog'i o'sha tab bosilganda ko'rinadigan songa teng
  const filtrlangan = useMemo(() => {
    const s = q.trim().toLowerCase();
    const byName = s ? barcha.filter((r) => r.name.toLowerCase().includes(s)) : barcha;
    return applyFilters(byName, FIELDS, filters);
  }, [barcha, q, filters, FIELDS]);

  const tabs = useMemo(() => [
    { key: "all", label: "Barchasi", count: filtrlangan.length },
    ...Object.entries(RANG).map(([k, v]) => ({
      key: k, label: v.matn, count: filtrlangan.filter((r) => r.daraja === k).length,
    })),
  ], [filtrlangan]);

  const rows = useMemo(
    () => (tab === "all" ? filtrlangan : filtrlangan.filter((r) => r.daraja === tab)),
    [filtrlangan, tab]);

  // Kartochkalar. Pul yig'indisiga TANNARXI NOMA'LUM qator kirmaydi —
  // 0 yozilsa "qoldiqda pul yo'q" degan yolg'on bo'lardi
  // (CLAUDE.md 2026-09-03).
  const yig = useMemo(() => {
    const tugagan = rows.filter((r) => r.tugagan);
    const kritik = rows.filter((r) => !r.tugagan && r.daysLeft != null && r.daysLeft <= 7);
    const tannarxsiz = rows.filter((r) => r.stock > 0 && r.tannarx == null);
    const qiymat = rows
      .filter((r) => r.stock > 0 && r.tannarx != null)
      .reduce((a, r) => a + r.stock * r.tannarx, 0);
    return { tugagan: tugagan.length, kritik: kritik.length, tannarxsiz: tannarxsiz.length, qiymat };
  }, [rows]);

  const cols = useMemo(() => [
    { key: "name", label: "Tovar", locked: true, width: "20rem",
      cell: (r) => <span className="font-bold">{r.name}</span> },
    { key: "category", label: "Kategoriya",
      cell: (r) => <span className="font-semibold text-muted">{r.category}</span> },
    { key: "stock", label: "Qoldiq", right: true,
      hint: "Tanlangan do'konlardagi dona yig'indisi. Hech biri tanlanmasa — hamma do'kon.",
      cell: (r) => <span className="font-semibold">{son(r.stock)}</span>,
      total: (rs) => son(rs.reduce((a, r) => a + r.stock, 0)) },
    ...(filial ? [{ key: "skladda", label: "Skladda", right: true,
      hint: "Filialda tugagan bo'lsa-yu Skladda bo'lsa — buyurtma emas, KO'CHIRISH kerak.",
      cell: (r) => <span className="font-semibold text-muted">{son(r.skladda ?? 0)}</span>,
      total: (rs) => son(rs.reduce((a, r) => a + (r.skladda ?? 0), 0)) }] : []),
    { key: "avgDaily", label: "Kuniga", right: true,
      hint: "Kunlik o'rtacha sotuv. Qisqa oynada sotuv bo'lmasa uch barobar uzun oynadan olinadi — bunday qator \"zaxira oyna\" deb belgilanadi.",
      cell: (r) => (
        <span className="font-semibold text-muted">
          {r.avgDaily.toFixed(2)}
          {r.avgDaily > 0 && r.oyna !== oyna && (
            <span className="block text-xs">{tt("{n} kunlik oyna", { n: r.oyna })}</span>
          )}
        </span>
      ) },
    { key: "daysLeft", label: "Necha kunga yetadi", right: true,
      hint: "Qoldiq ÷ kunlik sotuv.",
      value: (r) => (r.daysLeft == null ? Infinity : r.daysLeft),
      cell: (r) => (
        <span className={`font-extrabold ${
          r.tugagan || (r.daysLeft != null && r.daysLeft <= 7) ? "text-danger"
            : r.daysLeft != null && r.daysLeft <= 21 ? "text-warn" : "text-muted"}`}>
          {r.daysLeft == null ? "—" : son(r.daysLeft)}
        </span>
      ) },
    { key: "daraja", label: "Holat",
      cell: (r) => {
        const g = RANG[r.daraja] ?? RANG.none;
        return <span className={`text-sm font-bold px-3 py-1 rounded-lg ${g.cls}`}>{t(g.matn)}</span>;
      } },
    { key: "idleDays", label: "Qimirlamagan (kun)", right: true,
      hint: "Oxirgi sotuvdan beri o'tgan kun. Hech sotilmagan bo'lsa — \"—\" (filtrda u \"cheksiz\" hisoblanadi: \"90 dan\" ichiga tushadi).",
      value: (r) => r.idleDays ?? -1,
      cell: (r) => <span className="font-semibold text-muted">{r.idleDays == null ? "—" : son(r.idleDays)}</span> },
    { key: "stockValue", label: "Qoldiq qiymati", right: true,
      hint: "Qoldiq × tannarx. Tannarxi noma'lum tovar yig'indiga KIRMAYDI (0 deb yozilmaydi).",
      value: (r) => (r.tannarx == null ? 0 : r.stock * r.tannarx),
      cell: (r) => (r.tannarx == null
        ? <span className="font-semibold text-muted">{t("tannarx yo'q")}</span>
        : <span className="font-semibold">{pul(r.stock * r.tannarx)}</span>),
      total: (rs) => pul(rs.filter((r) => r.tannarx != null)
        .reduce((a, r) => a + r.stock * r.tannarx, 0)) },
  ], [filial, oyna]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        {/* `.inp` `w-full` — flex qatorda eni cheklanmasa butun qatorni oladi */}
        <MultiSelect className="w-full sm:w-72" options={doKonlar} value={storeIds}
          onChange={setStoreIds} allLabel="Barcha do'konlar" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kartochka label="Tovar" value={son(rows.length)} icon={Boxes}
          hint={tt("{n} ta katalogda", { n: son(barcha.length) })} />
        <Kartochka label="Tugagan" value={son(yig.tugagan)} rang="text-danger" icon={PackageX}
          hint={t("qoldiq yo'q, lekin sotilyapti")} />
        <Kartochka label="7 kundan kam qoldi" value={son(yig.kritik)} rang="text-warn" icon={TriangleAlert}
          hint={t("buyurtma bermasa tugaydi")} />
        <Kartochka label="Qoldiq qiymati" value={pul(yig.qiymat)} icon={Snowflake}
          hint={yig.tannarxsiz > 0
            ? tt("{n} ta tovarning tannarxi noma'lum — kirmadi", { n: son(yig.tannarxsiz) })
            : t("tannarx bo'yicha")} />
      </div>

      <FilterBar
        tabs={tabs} activeTab={tab} onTab={setTab}
        search={{ value: q, onChange: setQ, placeholder: "Tovar nomi bo'yicha qidirish..." }}
        fields={FIELDS} filters={filters} onChange={setFilters} />

      <DataTable
        id="ombor-qoplamasi"
        name="Ombor qoplamasi"
        columns={cols}
        rows={rows}
        count={rows.length}
        empty={{ icon: Boxes, title: "Tovar topilmadi",
                 hint: "Filtrni tozalab ko'ring yoki boshqa do'konni tanlang." }}
      />
    </div>
  );
}
