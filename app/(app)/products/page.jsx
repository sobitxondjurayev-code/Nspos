"use client";
import { t, tt } from "@/lib/i18n";
import BillzMuhr from "@/components/BillzMuhr";
import { useMemo, useState } from "react";
import { Plus, Search, Pencil, Archive, ArchiveRestore, Barcode, Package, Boxes, Wallet, TrendingUp } from "lucide-react";
import { demoStores, fmtUSD } from "@/lib/demoData";
import {
  demoCategories, listProducts, listArchived, addProduct, updateProduct,
  archiveProduct, restoreProduct, totalQty,
} from "@/lib/productsData";
import ProductModal from "@/components/ProductModal";
import FilterBar, { applyFilters } from "@/components/FilterBar";
import StatsStrip from "@/components/StatsStrip";
import DataTable from "@/components/ui/DataTable";
import Button from "@/components/ui/Button";
import Manfiy from "@/components/ui/Manfiy";
import { useLive } from "@/components/DataProvider";
import { useAuth } from "@/components/AuthProvider";
import { sana } from "@/lib/format";

export default function Products() {
  const [tick, setTick] = useState(0);
  const live = useLive();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");
  const [filters, setFilters] = useState({});
  const [modal, setModal] = useState(null); // null | {mode:'new'} | {mode:'edit', product}

  // `useLive` — bazadan kelgan yoki boshqa xodim o'zgartirgan tovar
  // darrov ko'rinsin (ilgari `useState(listProducts)` bilan sahifa
  // yuklanish paytidagi ro'yxatda qotib qolardi)
  const items = useMemo(() => listProducts(), [tick, live]);
  const arxiv = useMemo(() => listArchived(), [tick, live]);
  const refresh = () => setTick((v) => v + 1);

  // Filtr maydonlari: `get` — yozuvdan solishtiriladigan qiymatni oladi
  const FIELDS = useMemo(() => [
    { key: "category", type: "select", label: "Kategoriya",
      options: demoCategories.map((c) => ({ value: c.id, label: c.name })),
      get: (p) => p.categoryId },
    { key: "store", type: "select", label: "Qoldiq bor do'kon",
      options: demoStores.map((s) => ({ value: s.id, label: s.name })),
      get: () => null },   // pastda alohida ishlanadi
    { key: "salePrice", type: "range", label: "Sotuv narxi", get: (p) => p.salePrice },
    { key: "costPrice", type: "range", label: "Tannarx", get: (p) => p.costPrice },
    { key: "stock", type: "range", label: "Umumiy qoldiq", get: (p) => totalQty(p) },
    { key: "brand", type: "text", label: "Brend", placeholder: "Nomi bo'yicha", get: (p) => p.brand },
  ], []);

  // Qoldiq holati bo'yicha tablar — Billz'dagi kabi sanoq bilan
  const stockTabs = useMemo(() => {
    const zero = items.filter((p) => totalQty(p) <= 0).length;
    const low = items.filter((p) => totalQty(p) > 0 && totalQty(p) <= 3).length;
    return [
      { key: "all", label: "Barchasi", count: items.length },
      { key: "in", label: "Qoldiqda bor", count: items.length - zero },
      { key: "low", label: "Kam qoldiq", count: low },
      { key: "zero", label: "Qoldiq yo'q", count: zero },
      // Arxiv: rahbar/menejer arxivlagan yoki Billz'da yo'q bo'lib qolgan
      // (`is_active = false`). Ro'yxatda ko'rinmaydi, tarixda qoladi.
      { key: "arxiv", label: "Arxiv", count: arxiv.length },
    ];
  }, [items, arxiv]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let rows = tab === "arxiv" ? arxiv : items;

    if (tab === "in") rows = rows.filter((p) => totalQty(p) > 0);
    else if (tab === "low") rows = rows.filter((p) => totalQty(p) > 0 && totalQty(p) <= 3);
    else if (tab === "zero") rows = rows.filter((p) => totalQty(p) <= 0);

    // Do'kon filtri: shu do'konda qoldig'i bor tovarlar
    if (filters.store && filters.store !== "all") {
      rows = rows.filter((p) => (p.stock?.[filters.store] ?? 0) > 0);
    }

    rows = applyFilters(rows, FIELDS.filter((f) => f.key !== "store"), filters);

    return rows.filter((p) =>
      !s || p.name.toLowerCase().includes(s) ||
      p.sku?.toLowerCase().includes(s) || p.barcode?.includes(s)
    );
  }, [items, arxiv, q, tab, filters, FIELDS]);

  // Billz'dagi kabi: nomlar soni, dona, tannarx va sotuv narxidagi qiymat
  const stats = useMemo(() => {
    let units = 0, cost = 0, retail = 0;
    for (const p of filtered) {
      const q = totalQty(p);
      if (q <= 0) continue;             // manfiy qoldiq qiymatni buzadi
      units += q;
      cost += q * (p.costPrice ?? 0);
      retail += q * (p.salePrice ?? 0);
    }
    return [
      { label: "Nomlar soni", icon: Package,
        value: filtered.length.toLocaleString("ru-RU"), unit: "ta" },
      { label: "Tovar birliklari", icon: Boxes,
        value: units.toLocaleString("ru-RU"), unit: "dona" },
      { label: "Tannarx bo'yicha summa", icon: Wallet,
        value: fmtUSD(+cost.toFixed(2)) },
      { label: "Sotuv narxi bo'yicha summa", icon: TrendingUp,
        tone: "bg-ok-soft text-ok", value: fmtUSD(+retail.toFixed(2)),
        hint: tt("Potensial foyda {n}", { n: fmtUSD(+(retail - cost).toFixed(2)) }) },
    ];
  }, [filtered]);

  function save(data) {
    if (modal.mode === "edit") updateProduct(modal.product.id, data);
    else addProduct(data);
    setModal(null); refresh();
  }
  // O'chirish EMAS — arxiv (2026-09-03). Baza va sotuv tarixi qoladi,
  // ro'yxatdan chiqadi, "Arxiv" tabidan qaytariladi.
  function arxivla(p) {
    if (confirm(tt("\"{n}\" arxivga olinsinmi? Ro'yxatdan chiqadi, tarixi qoladi; \"Arxiv\" tabidan qaytarish mumkin.", { n: p.name }))) {
      archiveProduct(p.id, user?.id ?? null); refresh();
    }
  }
  function qaytar(p) { restoreProduct(p.id); refresh(); }

  const catName = (id) => demoCategories.find((c) => c.id === id)?.name ?? "—";

  return (
    <div>
      <div className="flex items-center justify-between mb-7">
        <h1 className="text-4xl font-extrabold tracking-tight">{t("Tovarlar")}</h1>
        <BillzMuhr entity="products" className="mb-4" />
        <button onClick={() => setModal({ mode: "new" })}
          className="flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-5 py-3">
          <Plus size={20} /> {t("Yangi tovar")}
        </button>
      </div>

      <StatsStrip items={stats} filtered={filtered.length !== items.length} />

      <FilterBar
        tabs={stockTabs} activeTab={tab} onTab={setTab}
        search={{ value: q, onChange: setQ,
          placeholder: "Nomi, SKU yoki shtrix-kod bo'yicha qidirish..." }}
        fields={FIELDS} filters={filters} onChange={setFilters}
      />

      <p className="text-sm text-muted font-semibold mb-4">
        {filtered.length} / {tab === "arxiv" ? arxiv.length : items.length} {t("tovar")}
        {tab === "arxiv" && ` · ${t("Arxivdagi tovar sotuvda ko'rinmaydi, hisobotlarda o'tgan sotuvi qoladi. Billz'da yo'q bo'lib qolgani sinxronda o'zi shu yerga tushadi.")}`}
      </p>

      {/* Jadval */}
      <DataTable
        id="products-list"
        name={t("Tovarlar")}
        rows={filtered}
        rowKey={(p) => p.id}
        boshSort={{ key: "nom", dir: "asc" }}
        limit={200}
        minWidth="72rem"
        empty={{ icon: Package, title: "Hech narsa topilmadi",
                 hint: "Qidiruv yoki filtrni tozalab ko'ring" }}
        columns={[
          { key: "nom", label: "Tovar", locked: true, value: (p) => p.name,
            cell: (p) => (
              <>
                <p className="font-bold">{p.name}</p>
                <p className="text-sm text-muted">{p.sku}</p>
              </>
            ) },
          { key: "kategoriya", label: "Kategoriya", value: (p) => catName(p.categoryId),
            cell: (p) => <span className="bg-brand-soft text-brand text-sm font-bold px-3 py-1 rounded-lg whitespace-nowrap">
              {catName(p.categoryId)}</span> },
          { key: "barcode", label: "Shtrix-kod", value: (p) => p.barcode,
            cell: (p) => <span className="font-mono text-sm text-muted">{p.barcode}</span> },
          /* Ilgari bu ikki ustun `toFixed(2)` bilan chizilardi: tannarx
             VALYUTASIZ ("197.00"), sotuv narxi esa minglik ajratgichsiz
             ("1234.50 $"). Endi ikkalasi ham umumiy formatlovchidan. */
          { key: "cost", label: "Tannarx", right: true, value: (p) => p.costPrice,
            cell: (p) => <span className="font-semibold text-muted">{fmtUSD(p.costPrice)}</span> },
          { key: "price", label: "Sotuv narxi", right: true, value: (p) => p.salePrice,
            cell: (p) => <span className="font-extrabold">{fmtUSD(p.salePrice)}</span> },
          ...demoStores.map((st) => ({
            key: `st-${st.id}`, label: st.name.replace("NScamera ", ""), right: true,
            value: (p) => p.stock[st.id] ?? 0,
            cell: (p) => <span className={`font-bold ${(p.stock[st.id] ?? 0) <= 0 ? "text-danger" : ""}`}>
              <Manfiy v={p.stock[st.id] ?? 0} sabab="xizmatQoldiq">{p.stock[st.id] ?? 0}</Manfiy></span>,
            total: (rs) => rs.reduce((a, p) => a + (p.stock[st.id] ?? 0), 0).toLocaleString("ru-RU"),
          })),
          { key: "jami", label: "Jami", right: true, value: (p) => totalQty(p),
            cell: (p) => <span className="font-extrabold">{totalQty(p)}</span>,
            total: (rs) => rs.reduce((a, p) => a + totalQty(p), 0).toLocaleString("ru-RU") },
          ...(tab === "arxiv" ? [{
            key: "arxivSabab", label: "Arxiv", value: (p) => (p.archivedAt ? sana(p.archivedAt) : "Billz'da yo'q"),
            cell: (p) => (p.archivedAt
              ? <span className="text-sm font-semibold text-muted">{tt("{d} da arxivlangan", { d: sana(p.archivedAt) })}</span>
              : <span className="text-sm font-semibold text-warn">{t("Billz'da yo'q bo'lib qolgan")}</span>),
          }] : []),
          {
            key: "harakat", label: "Harakat", harakat: true, right: true, width: "7rem",
            cell: (p) => (
              <span className="flex justify-end gap-1">
                {tab === "arxiv" ? (
                  p.archivedAt ? (
                    <Button olcham="kichik" korinish="yassi" icon={ArchiveRestore}
                      onClick={() => qaytar(p)} title={t("Ro'yxatga qaytarish")}
                      className="text-muted hover:text-ok" />
                  ) : null
                ) : (
                  <>
                    <Button olcham="kichik" korinish="yassi" icon={Pencil}
                      onClick={() => setModal({ mode: "edit", product: p })}
                      className="text-muted hover:text-brand" />
                    <Button olcham="kichik" korinish="yassi" icon={Archive}
                      onClick={() => arxivla(p)} title={t("Arxivga olish")}
                      className="text-muted hover:text-danger" />
                  </>
                )}
              </span>
            ),
          },
        ]}
      />

      {modal && (
        <ProductModal
          initial={modal.mode === "edit" ? modal.product : null}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
    </div>
  );
}
