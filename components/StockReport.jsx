"use client";
import { t, tt } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { fmtUSD } from "@/lib/demoData";
import FilterBar, { applyFilters } from "@/components/FilterBar";
import SortTh, { useSort } from "@/components/SortTh";
import ExportButton from "@/components/ExportButton";
import TotalsRow from "@/components/TotalsRow";
import { numberOf, textOf } from "@/lib/datasets";
import ColumnSettings from "@/components/ColumnSettings";
import { useColumns } from "@/components/useColumns";
import { SlidersHorizontal } from "lucide-react";

// ══════════════════════════════════════════════════════════════
// OMBOR QOPLAMASI
// ══════════════════════════════════════════════════════════════
// Savol oddiy: "qaysi tovar necha kunga yetadi va qayerda pul qotib
// qolgan?" Billz'ning "Эффективность товаров" hisoboti buni to'g'ridan
// to'g'ri bermaydi — u faqat davr ichidagi HARAKATLARNI beradi.
// Shuning uchun qoldiqni o'zimiz yig'amiz:
//
//   qoldiq = boshlang'ich + import + kirim transfer + qaytgan
//            − sotilgan − hisobdan chiqarilgan − chiqim transfer
//
// Tezlik esa davr uzunligiga bo'linadi (davr ustun nomidan olinadi:
// "Продажи товаров 2026-01-01 - 2026-07-22"). Qoplama = qoldiq / tezlik.
//
// Segmentlar rahbar qaror qabul qilishi uchun: nimani buyurtma qilish
// kerak, qayerda ortiqcha pul turibdi, nima umuman sotilmayapti.

const SEGMENTS = {
  // Tovar sotildi va tugadi — eng shoshilinch holat: har kuni sotilishi
  // mumkin bo'lgan tovar javondan yo'q, ya'ni sotuv yo'qotilyapti.
  out:    { label: "Tugagan",      hint: "Qoldiq yo'q — sotuv to'xtagan, zudlik bilan keltiring", bg: "bg-danger", text: "text-white" },
  low:    { label: "Tugayapti",    hint: "14 kundan kam qoldi — buyurtma bering", bg: "bg-danger-soft", text: "text-danger" },
  ok:     { label: "Normal",       hint: "14–90 kun — sog'lom zaxira",            bg: "bg-ok-soft",     text: "text-ok" },
  excess: { label: "Ortiqcha",     hint: "90 kundan ko'p — pul qotgan",           bg: "bg-warn-soft",   text: "text-warn" },
  dead:   { label: "Qimirlamagan", hint: "Sotuv ham, transfer ham bo'lmagan",     bg: "bg-track",       text: "text-muted" },
};

// Ustunni guruh + kichik ustun nomi bo'yicha topamiz.
// Sarlavha birlashtirilgan: "Продажи товаров 2026-01-01 - 2026-07-22 · Кол-во"
const pick = (header, group, sub) =>
  header.find((h) => h.startsWith(group) && h.endsWith(sub)) ?? null;

// Davr uzunligi ustun nomidagi sanalardan: "... 2026-01-01 - 2026-07-22 · ..."
function periodDays(header) {
  for (const h of header) {
    const m = h.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
    if (!m) continue;
    const days = Math.round((new Date(m[2]) - new Date(m[1])) / 86400000);
    if (days > 0) return days;
  }
  return 90;   // topilmasa — ehtiyotkor taxmin
}

export default function StockReport({ dataset }) {
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({});
  const [tab, setTab] = useState("all");
  // Boshlang'ich saralash — eng ko'p pul qotgani yuqorida
  // Maqsad: tovar necha kunga yetib tursin. Kiritilsa — shuncha kunga
  // yetmaydiganlar qoladi va har biriga qancha zakaz kerakligi chiqadi.
  const [goal, setGoal] = useState("");
  // Tovar buyurtmadan keyin necha kunda yetib keladi
  const [lead, setLead] = useState("");
  const { sort, toggle, sortRows } = useSort("money", "desc");

  const { header, rows } = dataset;
  const days = useMemo(() => periodDays(header), [header]);

  const cols = useMemo(() => ({
    name:  header.find((h) => h === "Наименование") ?? header.find((h) => h.includes("Наименование")),
    store: header.find((h) => h.includes("Магазин")),
    cat:   header.find((h) => h.includes("Категория")),
    brand: header.find((h) => h.includes("Бренд")),
    supplier: header.find((h) => h.includes("Поставщик")),
    open:  pick(header, "Остаток на", "Кол-во"),
    imp:   pick(header, "Импорт товара", "Кол-во"),
    tin:   pick(header, "Входящий трансфер", "Кол-во"),
    ret:   pick(header, "Возвраты товаров", "Кол-во"),
    sale:  pick(header, "Продажи товаров", "Кол-во"),
    wo:    pick(header, "Списания товаров", "Кол-во"),
    tout:  pick(header, "Исходящий трансфер", "Кол-во"),
    // Dona tannarxi uchun manbalar. Qisqa davr olinsa (masalan 15 kun)
    // import ham, sotuv ham bo'lmasligi mumkin — o'shanda narx 0 chiqib,
    // "bog'langan pul" 0.00 bo'lib ko'rinardi. Shuning uchun boshlang'ich
    // qoldiq va transfer summalari ham zaxira sifatida ishlatiladi.
    impCost:  header.find((h) => h.startsWith("Импорт товара") && h.includes("цене поставки")),
    saleCost: header.find((h) => h.startsWith("Продажи товаров") && h.includes("цене поставки")),
    openCost: header.find((h) => h.startsWith("Остаток на") && h.includes("цене поставки")),
    toutCost: header.find((h) => h.startsWith("Исходящий трансфер") && h.includes("цене поставки")),
    tinCost:  header.find((h) => h.startsWith("Входящий трансфер") && h.includes("цене поставки")),
    // Haqiqiy tushum — CHEGIRMALI summa. Billz ikkita beradi: e'lon
    // narxidagi va chegirma qo'llangandan keyingi. Kassaga tushgani —
    // ikkinchisi (tekshirildi: 614 sotuvdan 556 tasida u pastroq).
    saleRev:  header.find((h) => h.startsWith("Продажи товаров") && h.includes("скидк")),
    saleList: header.find((h) => h.startsWith("Продажи товаров")
                              && h.includes("Сумма продажи") && !h.includes("скидк")),
  }), [header]);

  const items = useMemo(() => {
    const n = (r, c) => (c ? numberOf(r, c) : 0);
    return rows.map((r) => {
      const sold = n(r, cols.sale);
      const tout = n(r, cols.tout);
      const stock = n(r, cols.open) + n(r, cols.imp) + n(r, cols.tin) + n(r, cols.ret)
                  - sold - n(r, cols.wo) - tout;
      // Dona tannarxi — qaysi manba topilsa o'sha (import → sotuv →
      // boshlang'ich qoldiq → transfer). Bittasi ham bo'lmasa 0.
      const openQty = n(r, cols.open), tinQty = n(r, cols.tin);
      const rate = (sum, qty) => (qty > 0 && n(r, sum) > 0 ? n(r, sum) / qty : 0);
      const unit = rate(cols.impCost, n(r, cols.imp))
                || rate(cols.saleCost, sold)
                || rate(cols.openCost, openQty)
                || rate(cols.toutCost, tout)
                || rate(cols.tinCost, tinQty);
      // TEZLIK = sotuv + chiquvchi transfer. Sklad hech qachon sotmaydi —
      // undan tovar do'konlarga transfer bilan chiqadi. Faqat sotuvni
      // hisoblasak, butun sklad "sotilmagan" bo'lib ko'rinardi (aslida
      // tovar harakatda). Transfer ham talab belgisi: do'kon so'ragan.
      const moved = sold + tout;
      const perDay = moved / days;
      const cover = perDay > 0 ? stock / perDay : null;   // null = qimirlamagan
      // Qoldiq nolga tushgan bo'lsa — TUGAGAN. Ilgari bunday qatorlar
      // jadvaldan butunlay olib tashlanardi ("qoldiq yo'q, tahlil qilishga
      // narsa yo'q" deb). Aslida aynan shular eng muhimi: tovar sotilib
      // tugagan, endi sotuv yo'qotilyapti — buyurtma zarur.
      const seg = stock <= 0 && moved > 0 ? "out"
        : moved === 0 ? "dead" : cover < 14 ? "low" : cover <= 90 ? "ok" : "excess";
      // Sotuvdan tushum va foyda (davr ichida)
      const revenue = n(r, cols.saleRev) || n(r, cols.saleList);
      const soldCost = n(r, cols.saleCost);
      const profit = sold > 0 ? revenue - soldCost : 0;
      return {
        name: textOf(r, cols.name), store: textOf(r, cols.store), category: textOf(r, cols.cat),
        brand: textOf(r, cols.brand) || "—", supplier: textOf(r, cols.supplier) || "—",
        stock, sold, tout, moved, perDay, cover, unit, money: stock * unit, seg,
        revenue, profit,
        margin: revenue > 0 ? (profit / revenue) * 100 : 0,
        soldPerDay: sold / days,
      };
    // Butunlay bo'sh qator chiqarilmaydi: qoldiq ham, harakat ham yo'q —
    // bu tovar bu davrda umuman bo'lmagan. Qoldig'i tugaganlari esa
    // QOLADI (yuqoridagi "out" holati).
    }).filter((x) => x.stock > 0 || x.moved > 0);
  }, [rows, cols, days]);

  // Do'kon va kategoriya — mavjud qiymatlardan ochiluvchi ro'yxat
  const FIELDS = useMemo(() => {
    const uniq = (k) => [...new Set(items.map((x) => x[k]).filter((v) => v && v !== "—"))].sort();
    const selects = [
      { key: "store", label: "Do'kon" },
      { key: "category", label: "Kategoriya" },
      { key: "brand", label: "Brend" },
      { key: "supplier", label: "Yetkazib beruvchi" },
    ].map((f) => ({ ...f, type: "select",
      options: uniq(f.key).slice(0, 40).map((v) => ({ value: v, label: v })) }))
      .filter((f) => f.options.length > 1);

    // Son oraliqlari — bir nechta shartni birga qo'llash uchun.
    // "Sotilgani 100 dan ko'p" + "foydasi 500 dan ko'p" kabi.
    const ranges = [
      { key: "sold", label: "Sotilgan (dona)" },
      { key: "profit", label: "Foyda ($)" },
      { key: "revenue", label: "Sotuv summasi ($)" },
      { key: "stock", label: "Qoldiq (dona)" },
      { key: "money", label: "Bog'langan pul ($)" },
      { key: "cover", label: "Necha kunga yetadi" },
    ].map((f) => ({ ...f, type: "range" }));

    return [...selects, ...ranges];
  }, [items]);

  const summary = useMemo(() => {
    const s = { all: { n: 0, money: 0 } };
    for (const k of Object.keys(SEGMENTS)) s[k] = { n: 0, money: 0, qty: 0 };
    for (const x of items) {
      s.all.n++; s.all.money += x.money;
      s[x.seg].n++; s[x.seg].money += x.money; s[x.seg].qty += x.stock;
    }
    return s;
  }, [items]);

  // Filtrlangan ro'yxat (saralashsiz) — jami raqamlar shundan hisoblanadi
  const goalDays = Number(goal) > 0 ? Number(goal) : null;
  const leadDays = Number(lead) > 0 ? Number(lead) : 0;

  // —— Ustunlar ————————————————————————————————————
  // "#" va "Tovar" doim chapda qoladi (ularsiz jadval o'qilmaydi),
  // qolganini rahbar o'zi tartiblaydi va yashiradi.
  //   cell  — qatordagi katak      total — JAMI qatoridagi katak
  const ALL_COLS = useMemo(() => [
    { key: "store", label: "Do'kon", sortKey: "store",
      cellClass: () => "font-semibold text-muted", cell: (x) => x.store },
    { key: "stock", label: "Qoldiq", sortKey: "stock", align: "right",
      cellClass: () => "font-extrabold", cell: (x) => x.stock.toLocaleString("ru-RU"),
      total: (tt0) => ({ value: tt0.stock.toLocaleString("ru-RU") }) },
    { key: "sold", label: "Sotilgan", sortKey: "sold", align: "right",
      cellClass: () => "font-semibold", cell: (x) => x.sold.toLocaleString("ru-RU"),
      total: (tt0) => ({ value: tt0.sold.toLocaleString("ru-RU") }) },
    { key: "revenue", label: "Sotuv summasi", sortKey: "revenue", align: "right",
      cellClass: () => "font-semibold text-muted",
      cell: (x) => (x.revenue > 0 ? fmtUSD(Math.round(x.revenue)) : "—"),
      total: (tt0) => ({ value: fmtUSD(Math.round(tt0.revenue)) }) },
    { key: "profit", label: "Foyda", sortKey: "profit", align: "right",
      cellClass: (x) => (x.profit > 0 ? "font-semibold text-ok" : "font-semibold text-muted"),
      cell: (x) => (x.sold > 0 ? fmtUSD(Math.round(x.profit)) : "—"),
      total: (tt0) => ({ value: fmtUSD(Math.round(tt0.profit)), className: tt0.profit > 0 ? "text-ok" : "" }) },
    { key: "tout", label: "Transfer", sortKey: "tout", align: "right",
      cellClass: () => "font-semibold text-muted",
      cell: (x) => (x.tout > 0 ? x.tout.toLocaleString("ru-RU") : "—"),
      total: (tt0) => ({ value: tt0.tout > 0 ? tt0.tout.toLocaleString("ru-RU") : "—" }) },
    { key: "perDay", label: "Kuniga", sortKey: "perDay", align: "right",
      cellClass: () => "font-semibold text-muted",
      cell: (x) => (x.perDay > 0 ? x.perDay.toFixed(1) : "—"),
      total: (tt0) => ({ value: tt0.perDay > 0 ? tt0.perDay.toFixed(1) : "—" }) },
    { key: "cover", label: "Necha kunga yetadi", sortKey: "cover", align: "right",
      cellClass: (x) => `font-extrabold ${SEGMENTS[x.seg].text}`,
      cell: (x) => (x.cover == null ? "—" : x.cover > 999 ? "999+" : Math.round(x.cover)),
      total: (tt0) => ({ value: tt0.cover == null ? "—" : Math.round(tt0.cover) }) },
    { key: "money", label: "Bog'langan pul", sortKey: "money", align: "right",
      cellClass: () => "font-semibold",
      cell: (x) => fmtUSD(Math.round(x.money)),
      total: (tt0) => ({ value: fmtUSD(Math.round(tt0.money)) }) },
    // Faqat "necha kunga yetsin" kiritilganda ma'noga ega
    ...(goalDays ? [{ key: "need", label: "Zakaz kerak", sortKey: "need", align: "right",
      cellClass: () => "font-extrabold text-brand",
      cell: (x) => x.need.toLocaleString("ru-RU"),
      total: (tt0) => ({ value: tt0.need.toLocaleString("ru-RU"), className: "text-brand" }) }] : []),
    { key: "seg", label: "Holat", sortKey: "seg",
      cell: (x) => (
        <span className={`text-sm font-bold px-3 py-1 rounded-lg ${SEGMENTS[x.seg].bg} ${SEGMENTS[x.seg].text}`}>
          {t(SEGMENTS[x.seg].label)}
        </span>
      ) },
  ], [goalDays]);
  const colPrefs = useColumns("report-stock", ALL_COLS);
  const tableCols = colPrefs.columns;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = applyFilters(items, FIELDS, filters)
      .filter((x) => (tab === "all" ? true : x.seg === tab))
      .filter((x) => !needle || x.name.toLowerCase().includes(needle));
    if (!goalDays) return list.map((x) => ({ ...x, need: null, dryDays: 0 }));

    // Buyurtma tovar YETIB KELGAN kundagi holatdan hisoblanadi:
    //   kelgandagi qoldiq = qoldiq − yetkazish kunlari × kunlik sotuv
    //   kerak            = maqsad × kunlik sotuv − kelgandagi qoldiq
    //
    // Kelgandagi qoldiq manfiy bo'lolmaydi. Misol: tovar 35 kunda keladi,
    // qoldiq 15 kunga yetadi, kuniga 2 dona ketadi. Javon 20 kun bo'sh
    // turadi — o'sha 20 kunning "sotuvi" ni buyurtmaga qo'shish xato,
    // chunki u sotuv umuman bo'lmaydi. Shuning uchun nolda kesiladi.
    return list
      .map((x) => {
        const atArrival = Math.max(0, x.stock - leadDays * x.perDay);
        return {
          ...x,
          need: Math.max(0, Math.round(goalDays * x.perDay - atArrival)),
          dryDays: x.cover != null && x.cover < leadDays ? Math.round(leadDays - x.cover) : 0,
        };
      })
      .filter((x) => x.need > 0);
  }, [items, FIELDS, filters, tab, q, goalDays, leadDays]);

  const sales = useMemo(() => filtered.reduce((a, x) => ({
    qty: a.qty + x.sold, revenue: a.revenue + x.revenue, profit: a.profit + x.profit,
  }), { qty: 0, revenue: 0, profit: 0 }), [filtered]);

  const shown = useMemo(() => sortRows(filtered), [filtered, sort]);

  // Jadval ostidagi JAMI qatori. Diqqat: jadvalda 300 tasi ko'rsatiladi,
  // jami esa FILTRDAN o'tgan hammasi bo'yicha hisoblanadi — aks holda
  // "675 ta pozitsiya" deb turib, 300 tasining yig'indisi chiqardi.
  const totals = useMemo(() => {
    const t0 = { stock: 0, sold: 0, revenue: 0, profit: 0, tout: 0, perDay: 0, money: 0, need: 0, dryN: 0 };
    for (const x of filtered) {
      t0.stock += x.stock; t0.sold += x.sold; t0.revenue += x.revenue;
      t0.profit += x.profit; t0.tout += x.tout; t0.perDay += x.perDay; t0.money += x.money;
      t0.need += x.need ?? 0;
      if (x.dryDays > 0) t0.dryN += 1;
    }
    // Umumiy qoplama: jami qoldiq ÷ jami kunlik sotuv. O'rtacha emas,
    // og'irlikka qarab — bitta sekin tovar butun rasmni buzmasin.
    t0.cover = t0.perDay > 0 ? t0.stock / t0.perDay : null;
    return t0;
  }, [filtered]);

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
      {/* Ombor holati */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
        {card(t("Omborda bog'langan pul"), fmtUSD(Math.round(summary.all.money)),
          tt("{n} ta pozitsiya", { n: summary.all.n }))}
        {card(t("Qimirlamagan tovar"), fmtUSD(Math.round(summary.dead.money)),
          tt("{n} poz · sotuv ham, transfer ham yo'q", { n: summary.dead.n }),
          "text-muted")}
        {card(t("Ortiqcha zaxira"), fmtUSD(Math.round(summary.excess.money)),
          tt("{n} pozitsiya · 90 kundan ortiq", { n: summary.excess.n }), "text-warn")}
        {card(t("Tugayotgan tovar"), String(summary.low.n),
          t("14 kundan kam qoldi — buyurtma bering"), "text-danger")}
      </div>

      {/* Shu davrdagi sotuv va foyda — tanlangan filtr bo'yicha */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        {card(t("Sotilgan (davr)"), Math.round(sales.qty).toLocaleString("ru-RU"),
          tt("kuniga o'rtacha {n} dona", { n: (sales.qty / days).toFixed(1) }))}
        {card(t("Sotuvdan tushum"), fmtUSD(Math.round(sales.revenue)),
          t("Chegirma qo'llangandan keyin"))}
        {card(t("Foyda"), fmtUSD(Math.round(sales.profit)),
          tt("marja {n}%", { n: sales.revenue > 0 ? ((sales.profit / sales.revenue) * 100).toFixed(1) : 0 }),
          "text-ok")}
      </div>

      <div className="card p-5 mb-6 text-sm font-semibold text-muted">
        {tt("Tezlik {d} kunlik davr bo'yicha: sotuv + boshqa do'konga transfer. Sklad sotmaydi — undan tovar transfer bilan chiqadi, shuning uchun u ham hisobga olinadi.", { d: days })}
      </div>

      <FilterBar
        tabs={[
          { key: "all", label: "Barchasi", count: summary.all.n },
          ...Object.entries(SEGMENTS).map(([k, s]) => ({ key: k, label: s.label, count: summary[k].n })),
        ]}
        activeTab={tab} onTab={setTab}
        search={{ value: q, onChange: setQ, placeholder: "Tovar nomi bo'yicha qidirish..." }}
        fields={FIELDS} filters={filters} onChange={setFilters}
        extraCount={(goalDays ? 1 : 0) + (leadDays ? 1 : 0)}
        extra={
          /* Zakaz hisoblagich: "80 kunga yetsin" desangiz — yetmaydiganlari
             qoladi va har biriga qancha olish kerakligi chiqadi
             (maqsad × kunlik sotuv − hozirgi qoldiq). */
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <div>
              <p className="font-bold text-[0.9375rem]">{t("Zakaz hisoblagich")}</p>
              <p className="text-sm text-muted font-semibold">
                {t("Kun kiritsangiz — yetmaydiganlari va zakaz miqdori chiqadi")}
              </p>
            </div>
            <label className="block">
              <span className="block text-sm font-bold mb-1.5">{t("Necha kunda keladi")}</span>
              <input type="number" min="0" value={lead} inputMode="numeric"
                onChange={(e) => setLead(e.target.value)}
                className="inp text-center w-32" placeholder={t("kun")} />
            </label>
            <label className="block">
              <span className="block text-sm font-bold mb-1.5">{t("Necha kunga yetsin")}</span>
              <input type="number" min="1" value={goal} inputMode="numeric"
                onChange={(e) => setGoal(e.target.value)}
                className="inp text-center w-32" placeholder={t("kun")} />
            </label>
            {goalDays ? (
              <>
                <div>
                  <p className="text-sm font-bold text-brand">
                    {tt("{n} ta pozitsiya {d} kunga yetmaydi · jami {q} dona zakaz kerak", {
                      n: filtered.length.toLocaleString("ru-RU"), d: goalDays,
                      q: totals.need.toLocaleString("ru-RU") })}
                  </p>
                  {leadDays > 0 && totals.dryN > 0 && (
                    <p className="text-sm font-bold text-danger">
                      {tt("Shundan {n} tasi zakaz yetib kelguncha tugaydi — javon bo'sh turadi", {
                        n: totals.dryN.toLocaleString("ru-RU") })}
                    </p>
                  )}
                </div>
                <button onClick={() => setGoal("")}
                  className="text-sm font-bold text-muted hover:text-ink underline">
                  {t("Tozalash")}
                </button>
              </>
            ) : (
              <p className="text-sm text-muted font-semibold max-w-md">
                {t("Masalan: 35 kunda keladi, 80 kunga yetsin. Yetib kelguncha tugaydigan tovarga bo'sh kunlar qo'shilmaydi — u kunlarda sotuv bo'lmaydi.")}
              </p>
            )}
          </div>
        }
      />

      <ExportButton name="Ombor qoplamasi" rows={shown}
        note={goalDays
          ? tt("{n} ta pozitsiya {d} kunga yetmaydi · jami {q} dona zakaz kerak", {
              n: shown.length.toLocaleString("ru-RU"), d: goalDays,
              q: totals.need.toLocaleString("ru-RU") })
          : tt("{n} ta pozitsiya · filtr va saralash bilan", { n: shown.length })}
        columns={[
          { label: "Tovar", get: (x) => x.name },
          { label: "Do'kon", get: (x) => x.store },
          { label: "Kategoriya", get: (x) => x.category },
          { label: "Brend", get: (x) => x.brand },
          { label: "Yetkazib beruvchi", get: (x) => x.supplier },
          { label: "Qoldiq", get: (x) => x.stock },
          { label: "Sotilgan", get: (x) => x.sold },
          { label: "Sotuv summasi ($)", get: (x) => Math.round(x.revenue) },
          { label: "Foyda ($)", get: (x) => Math.round(x.profit) },
          { label: "Transfer", get: (x) => x.tout },
          { label: "Kuniga", get: (x) => +x.perDay.toFixed(2) },
          { label: "Necha kunga yetadi", get: (x) => (x.cover == null ? "" : Math.round(x.cover)) },
          { label: "Bog'langan pul ($)", get: (x) => Math.round(x.money) },
          ...(goalDays ? [{ label: `Zakaz kerak (${goalDays} kunga)`, get: (x) => x.need }] : []),
          { label: "Holat", get: (x) => SEGMENTS[x.seg].label },
        ]} />

      <div className="flex justify-end mb-3">
        <button onClick={colPrefs.openSettings}
          className="flex items-center gap-2 rounded-xl border border-line px-4 py-2 font-bold hover:border-brand hover:text-brand transition-colors">
          <SlidersHorizontal size={16} /> {t("Ustunlar")}
        </button>
      </div>

      <div className="card overflow-auto max-h-[70vh]">
        <table className="w-full text-[0.9375rem] whitespace-nowrap">
          <thead className="sticky top-0 z-20">
            <tr className="text-left text-muted text-sm border-b border-line [&>th]:bg-panel">
              <th className="px-5 py-4 font-bold">#</th>
              <SortTh label="Tovar" sortKey="name" sort={sort} onSort={toggle} className="px-5" />
              {tableCols.map((c) => (
                <SortTh key={c.key} label={c.label} sortKey={c.sortKey} sort={sort} onSort={toggle}
                  align={c.align} />
              ))}
            </tr>
            {/* "#" va "Tovar" — qo'zg'almas ikki ustun, JAMI yozuvi shularga */}
            <TotalsRow count={filtered.length} span={2}
              cells={tableCols.map((c) => (c.total ? c.total(totals) : null))} />
          </thead>
          <tbody>
            {shown.slice(0, 300).map((x, i) => (
              <tr key={`${x.name}-${x.store}-${i}`} className={`border-b border-line last:border-0 ${i % 2 ? "bg-surface/30" : ""}`}>
                <td className="px-5 py-3.5 font-semibold text-muted tabular-nums">{i + 1}</td>
                <td className="px-5 py-3.5 font-bold max-w-xs truncate" title={x.name}>{x.name}</td>
                {tableCols.map((c) => (
                  <td key={c.key}
                    className={`px-3 py-3.5 ${c.align === "right" ? "text-right" : ""} ${c.cellClass?.(x) ?? ""}`}>
                    {c.cell(x)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length > 300 && (
          <p className="px-5 py-4 text-sm text-muted font-semibold border-t border-line">
            {tt("Eng ko'p pul bog'langan 300 tasi ko'rsatildi ({n} tadan)", { n: shown.length })}
          </p>
        )}
      </div>

      {colPrefs.open && <ColumnSettings {...colPrefs.dialogProps} />}
    </div>
  );
}
