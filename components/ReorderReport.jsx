"use client";
import { t, tt } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { fmtUSD } from "@/lib/demoData";
import DataTable from "@/components/ui/DataTable";
import { eskiUstunlar } from "@/components/ui/eskiUstun";
import FilterBar, { applyFilters } from "@/components/FilterBar";
import ExportButton from "@/components/ExportButton";
import NumberField from "@/components/NumberField";
import { numberOf, textOf } from "@/lib/datasets";
import { AlertTriangle, SlidersHorizontal } from "lucide-react";

// ══════════════════════════════════════════════════════════════
// BUYURTMA TAKLIFI
// ══════════════════════════════════════════════════════════════
// "Nimani, qancha buyurtma qilish kerak?" — ombor qoplamasidagi
// ma'lumotdan chiqadigan amaliy javob.
//
// KOMPANIYA darajasida hisoblanadi, do'kon bo'yicha emas: do'konlar
// orasidagi transfer — ichki harakat, yangi tovar kelishi emas.
// Shuning uchun tezlik faqat SOTUVdan olinadi, qoldiq esa barcha
// do'konlardan yig'iladi.
//
//   kerak = kunlik sotuv × (yetkazib berish muddati + zaxira kunlari)
//           − hozirgi qoldiq
//
// Yetib kelguncha tugaydiganlari — shoshilinch.

const col = (header, ...names) =>
  header.find((h) => names.some((n) => h.toLowerCase().includes(n.toLowerCase()))) ?? null;
const pick = (header, group, sub) =>
  header.find((h) => h.startsWith(group) && h.endsWith(sub)) ?? null;

function periodDays(header) {
  for (const h of header) {
    const m = h.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
    if (!m) continue;
    const d = Math.round((new Date(m[2]) - new Date(m[1])) / 86400000);
    if (d > 0) return d;
  }
  return 90;
}

export default function ReorderReport({ dataset }) {
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({});
  const [lead, setLead] = useState(30);      // yetkazib berish muddati
  const [target, setTarget] = useState(45);  // shundan keyingi zaxira
  const [onlyUrgent, setOnlyUrgent] = useState(false);
  // Saralash endi `DataTable` ichida — `useSort` olib tashlandi.
  // Ikki joyda saralash bo'lsa ular bir-birini bosadi va "nega
  // bosganimda tartib o'zgarmadi?" degan savol tug'iladi.

  // —— Ustunlar ————————————————————————————————————
  // "Tovar" doim chapda; qolganini rahbar o'zi tartiblaydi.
  const ALL_COLS = useMemo(() => [
    { key: "category", label: "Kategoriya", sortKey: "category",
      cellClass: () => "font-semibold text-muted", cell: (x) => x.category },
    { key: "stock", label: "Qoldiq", sortKey: "stock", align: "right",
      cellClass: () => "font-semibold",
      cell: (x) => Math.round(x.stock).toLocaleString("ru-RU"),
      total: (v) => ({ value: Math.round(v.stock).toLocaleString("ru-RU") }) },
    { key: "perDay", label: "Kuniga", sortKey: "perDay", align: "right",
      cellClass: () => "font-semibold text-muted", cell: (x) => x.perDay.toFixed(1),
      total: (v) => ({ value: v.perDay.toFixed(1) }) },
    { key: "cover", label: "Necha kunga yetadi", sortKey: "cover", align: "right",
      cellClass: (x) => `font-extrabold ${x.urgent ? "text-danger" : "text-muted"}`,
      cell: (x) => (x.cover == null ? "—" : Math.round(x.cover)),
      // Umumiy qoplama: jami qoldiq ÷ jami kunlik sotuv
      total: (v) => ({ value: v.perDay > 0 ? Math.round(v.stock / v.perDay) : "—" }) },
    { key: "need", label: "Buyurtma (dona)", sortKey: "need", align: "right",
      cellClass: () => "font-extrabold text-brand",
      cell: (x) => x.need.toLocaleString("ru-RU"),
      total: (v) => ({ value: v.need.toLocaleString("ru-RU"), className: "text-brand" }) },
    { key: "cost", label: "Summa", sortKey: "cost", align: "right",
      cellClass: () => "font-semibold", cell: (x) => fmtUSD(Math.round(x.cost)),
      total: (v) => ({ value: fmtUSD(Math.round(v.cost)) }) },
    { key: "urgent", label: "Holat", sortKey: "urgent",
      cell: (x) => (
        <span className={`text-sm font-bold px-3 py-1 rounded-lg ${
          x.urgent ? "bg-danger-soft text-danger" : "bg-track text-muted"}`}>
          {t(x.urgent ? "Shoshilinch" : "Normal")}
        </span>
      ) },
  ], []);
  // Jadval `DataTable` orqali chiziladi: sarlavha pin, CHAP USTUN
  // PIN, saralash, "Jami", "Ustunlar" va Excel — hammasi o'zi.
  // Ilgari bularning faqat bir qismi bor edi va har biri qo'lda
  // yozilgandi.
  //
  // Tovar nomi BIRINCHI ustun — chapda yopishib turadigan aynan
  // o'sha bo'lishi kerak. Tartib raqami ("#") olib tashlandi: u
  // saralanadigan jadvalda ma'no tashimaydi (saralasangiz raqamlar
  // aralashib ketadi).
  const jadvalCols = useMemo(() => ([
    { key: "name", label: "Tovar", locked: true, width: "18rem",
      cell: (x) => <span className="font-bold">{x.name}</span> },
    ...eskiUstunlar(ALL_COLS, { jami: () => tot }),
  ]), [ALL_COLS, tot]);


  const { header, rows } = dataset;
  const days = useMemo(() => periodDays(header), [header]);

  const cols = useMemo(() => ({
    name:     header.find((h) => h === "Наименование") ?? col(header, "Наименование"),
    category: col(header, "Категория"),
    brand:    col(header, "Бренд"),
    supplier: col(header, "Поставщик"),
    open: pick(header, "Остаток на", "Кол-во"),
    imp:  pick(header, "Импорт товара", "Кол-во"),
    tin:  pick(header, "Входящий трансфер", "Кол-во"),
    ret:  pick(header, "Возвраты товаров", "Кол-во"),
    sale: pick(header, "Продажи товаров", "Кол-во"),
    wo:   pick(header, "Списания товаров", "Кол-во"),
    tout: pick(header, "Исходящий трансфер", "Кол-во"),
    impCost:  header.find((h) => h.startsWith("Импорт товара") && h.includes("цене поставки")),
    saleCost: header.find((h) => h.startsWith("Продажи товаров") && h.includes("цене поставки")),
    openCost: header.find((h) => h.startsWith("Остаток на") && h.includes("цене поставки")),
  }), [header]);

  // Mahsulot bo'yicha yig'amiz (do'konlar birlashtiriladi)
  const { products, skipped } = useMemo(() => {
    const n = (r, c) => (c ? numberOf(r, c) : 0);
    const map = new Map();
    for (const r of rows) {
      const name = textOf(r, cols.name);
      if (!name) continue;
      const sale = n(r, cols.sale), tout = n(r, cols.tout);
      const stock = n(r, cols.open) + n(r, cols.imp) + n(r, cols.tin) + n(r, cols.ret)
                  - sale - n(r, cols.wo) - tout;
      const rate = (sum, qty) => (qty > 0 && n(r, sum) > 0 ? n(r, sum) / qty : 0);
      const unit = rate(cols.impCost, n(r, cols.imp))
                || rate(cols.saleCost, sale)
                || rate(cols.openCost, n(r, cols.open));
      const p = map.get(name) ?? {
        name, stock: 0, sold: 0, unit: 0,
        category: textOf(r, cols.category) || "—",
        brand: textOf(r, cols.brand) || "—",
        supplier: textOf(r, cols.supplier) || "—",
      };
      p.stock += stock; p.sold += sale; p.unit = p.unit || unit;
      map.set(name, p);
    }
    const all = [...map.values()];
    // Manfiy qoldiq — ombor xatosi yoki xizmat (masalan "montaj").
    // Bunday yozuv uchun buyurtma taklif qilish ma'nosiz.
    return { products: all.filter((p) => p.stock >= 0), skipped: all.filter((p) => p.stock < 0) };
  }, [rows, cols]);

  const items = useMemo(() => products.map((p) => {
    const perDay = p.sold / days;
    const cover = perDay > 0 ? p.stock / perDay : null;

    // Tovar yetib kelgan KUNDAGI qoldiq. Nolga tushib bo'lgan bo'lsa
    // manfiy bo'lolmaydi: bo'sh javondan sotib bo'lmaydi.
    //
    // Nega muhim: 35 kunda keladigan, 15 kunlik qoldig'i bor tovarga
    // "35 + 45 kunlik ehtiyoj − qoldiq" desak, javon bo'sh turgan 20
    // kunning sotuvini ham buyurtmaga qo'shib yuborardik. U sotuv
    // bo'lmaydi — mijoz kutmaydi, ketadi. Shuning uchun buyurtma faqat
    // KELGANDAN KEYINGI davrga beriladi.
    const atArrival = Math.max(0, p.stock - perDay * lead);
    const need = Math.max(0, Math.ceil(perDay * target - atArrival));

    // Necha kun bo'sh turadi — shoshilinchlik darajasi shundan
    const dryDays = cover != null && cover < lead ? Math.round(lead - cover) : 0;
    return { ...p, perDay, cover, need, dryDays, cost: need * p.unit,
      urgent: dryDays > 0 };
  }), [products, days, lead, target]);

  const FIELDS = useMemo(() => {
    const uniq = (k) => [...new Set(items.map((x) => x[k]).filter((v) => v && v !== "—"))].sort();
    return [
      { key: "category", label: "Kategoriya" },
      { key: "brand", label: "Brend" },
      { key: "supplier", label: "Yetkazib beruvchi" },
    ].map((f) => ({ ...f, type: "select",
      options: uniq(f.key).slice(0, 40).map((v) => ({ value: v, label: v })) }))
      .filter((f) => f.options.length > 1)
      .concat([
        { key: "need", label: "Buyurtma (dona)" },
        { key: "cost", label: "Summa ($)" },
        { key: "cover", label: "Necha kunga yetadi" },
        { key: "perDay", label: "Kuniga sotiladi" },
      ].map((f) => ({ ...f, type: "range" })));
  }, [items]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return applyFilters(items, FIELDS, filters)
      // Faqat haqiqatan buyurtma kerak bo'lganlar. sold >= 2 — tasodifiy
      // bitta sotuv bo'yicha buyurtma bermaslik uchun.
      .filter((x) => x.need > 0 && x.sold >= 2)
      .filter((x) => (onlyUrgent ? x.urgent : true))
      .filter((x) => !needle || x.name.toLowerCase().includes(needle));
  }, [items, FIELDS, filters, q, onlyUrgent]);

  const shown = filtered;

  const tot = useMemo(() => filtered.reduce((a, x) => ({
    n: a.n + 1, cost: a.cost + x.cost, need: a.need + x.need,
    stock: a.stock + x.stock, perDay: a.perDay + x.perDay,
    urgentN: a.urgentN + (x.urgent ? 1 : 0), urgentCost: a.urgentCost + (x.urgent ? x.cost : 0),
  }), { n: 0, cost: 0, need: 0, stock: 0, perDay: 0, urgentN: 0, urgentCost: 0 }), [filtered]);

  if (!cols.sale || !cols.open) {
    return (
      <div className="card p-10 text-center">
        <p className="font-extrabold mb-2">{t("Hisobot mos kelmadi")}</p>
        <p className="text-muted font-semibold">
          {t("Bu tahlil uchun Billz'ning \"Эффективность товаров\" hisoboti kerak.")}
        </p>
      </div>
    );
  }

  const card = (title, value, hint, cls = "") => (
    <div className="card p-6">
      <p className="text-sm font-bold text-muted mb-2">{title}</p>
      <p className={`text-3xl font-extrabold ${cls}`}>{value}</p>
      <p className="text-sm text-muted font-semibold mt-1">{hint}</p>
    </div>
  );

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        {card(t("Buyurtma kerak"), String(tot.n),
          tt("{q} dona · {n} kunlik sotuvga qarab", { q: Math.round(tot.need).toLocaleString("ru-RU"), n: days }))}
        {card(t("Buyurtma summasi"), fmtUSD(Math.round(tot.cost)), t("Tannarx bo'yicha taxminiy"))}
        {card(t("Shoshilinch"), String(tot.urgentN),
          tt("Yetib kelguncha ({n} kun) tugaydi", { n: lead }), "text-danger")}
        {card(t("Shoshilinch summasi"), fmtUSD(Math.round(tot.urgentCost)),
          t("Avval shularni bering"), "text-danger")}
      </div>

      {/* Sozlash — har biznesda muddat boshqacha */}
      <div className="card p-6 mb-6">
        <p className="font-extrabold mb-1">{t("Hisob sozlamalari")}</p>
        <p className="text-sm text-muted font-semibold mb-5">
          {t("Kerak = kunlik sotuv × (yetkazib berish + zaxira) − hozirgi qoldiq")}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 items-end">
          <label className="block">
            <span className="block text-sm font-bold mb-2">{t("Yetkazib berish muddati (kun)")}</span>
            <NumberField value={lead} onChange={(v) => setLead(Math.max(0, v || 0))} />
          </label>
          <label className="block">
            <span className="block text-sm font-bold mb-2">{t("Zaxira (kun)")}</span>
            <NumberField value={target} onChange={(v) => setTarget(Math.max(0, v || 0))} />
          </label>
          <label className="flex items-center gap-3 rounded-xl border-2 border-line px-4 py-3 cursor-pointer hover:border-brand">
            <input type="checkbox" checked={onlyUrgent} onChange={(e) => setOnlyUrgent(e.target.checked)}
              className="w-4 h-4 accent-brand" />
            <span className="font-semibold text-sm">{t("Faqat shoshilinchlari")}</span>
          </label>
        </div>
      </div>

      {skipped.length > 0 && (
        <div className="card p-5 mb-6 flex items-start gap-3 border-warn/40">
          <span className="w-9 h-9 rounded-xl bg-warn-soft text-warn flex items-center justify-center shrink-0">
            <AlertTriangle size={18} />
          </span>
          <div>
            <p className="font-bold">{tt("{n} ta yozuv hisobga olinmadi", { n: skipped.length })}</p>
            <p className="text-sm text-muted font-semibold">
              {t("Qoldig'i manfiy — bu xizmat yoki ombor xatosi:")}{" "}
              {skipped.slice(0, 3).map((x) => x.name).join(", ")}
            </p>
          </div>
        </div>
      )}

      <FilterBar
        search={{ value: q, onChange: setQ, placeholder: "Tovar nomi bo'yicha qidirish..." }}
        fields={FIELDS} filters={filters} onChange={setFilters}
      />

      <ExportButton name="Buyurtma taklifi" rows={shown}
        note={tt("{n} ta tovar · {s} summa", { n: shown.length, s: fmtUSD(Math.round(tot.cost)) })}
        columns={[
          { label: "Tovar", get: (x) => x.name },
          { label: "Kategoriya", get: (x) => x.category },
          { label: "Brend", get: (x) => x.brand },
          { label: "Hozirgi qoldiq", get: (x) => Math.round(x.stock) },
          { label: "Kuniga sotiladi", get: (x) => +x.perDay.toFixed(2) },
          { label: "Necha kunga yetadi", get: (x) => (x.cover == null ? "" : Math.round(x.cover)) },
          { label: "BUYURTMA (dona)", get: (x) => x.need },
          { label: "Summa ($)", get: (x) => Math.round(x.cost) },
          { label: "Holat", get: (x) => (x.urgent ? "Shoshilinch" : "Normal") },
        ]} />

      <DataTable
        id="report-reorder"
        name={t("Buyurtma ro'yxati")}
        rows={shown}
        rowKey={(x) => x.name}
        count={shown.length}
        limit={300}
        minWidth="62rem"
        boshSort={{ key: "cover", dir: "asc" }}
        columns={jadvalCols}
        empty={{ title: "Buyurtma qilinadigan tovar yo'q",
                 hint: "Filtrni kengaytiring yoki boshqa davrni tanlang." }}
      />

    </div>
  );
}
