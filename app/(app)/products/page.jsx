"use client";
import { t, tt } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, Barcode, Package, Boxes, Wallet, TrendingUp } from "lucide-react";
import { demoStores, fmtUSD } from "@/lib/demoData";
import {
  demoCategories, listProducts, addProduct, updateProduct, removeProduct, totalQty,
} from "@/lib/productsData";
import ProductModal from "@/components/ProductModal";
import FilterBar, { applyFilters } from "@/components/FilterBar";
import StatsStrip from "@/components/StatsStrip";

export default function Products() {
  const [items, setItems] = useState(listProducts);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");
  const [filters, setFilters] = useState({});
  const [modal, setModal] = useState(null); // null | {mode:'new'} | {mode:'edit', product}

  const refresh = () => setItems(listProducts());

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
    ];
  }, [items]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let rows = items;

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
  }, [items, q, tab, filters, FIELDS]);

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
  function del(p) {
    if (confirm(`"${p.name}" o'chirilsinmi?`)) { removeProduct(p.id); refresh(); }
  }

  const catName = (id) => demoCategories.find((c) => c.id === id)?.name ?? "—";

  return (
    <div>
      <div className="flex items-center justify-between mb-7">
        <h1 className="text-4xl font-extrabold tracking-tight">{t("Tovarlar")}</h1>
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
        {filtered.length} / {items.length} {t("tovar")}
      </p>

      {/* Jadval */}
      <div className="card overflow-hidden">
        <table className="w-full text-[0.9375rem]">
          <thead>
            <tr className="text-left text-muted text-sm border-b border-line">
              <th className="px-6 py-4 font-bold">{t("Tovar")}</th>
              <th className="px-4 py-4 font-bold">{t("Kategoriya")}</th>
              <th className="px-4 py-4 font-bold">{t("Shtrix-kod")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Tannarx")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Sotuv narxi")}</th>
              {demoStores.map((s) => (
                <th key={s.id} className="px-3 py-4 font-bold text-center">{s.name.replace("NScamera ", "")}</th>
              ))}
              <th className="px-4 py-4 font-bold text-center">{t("Jami")}</th>
              <th className="px-4 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const total = totalQty(p);
              return (
                <tr key={p.id} className="border-b border-line last:border-0 hover:bg-surface/70">
                  <td className="px-6 py-4">
                    <p className="font-bold">{p.name}</p>
                    <p className="text-sm text-muted">{p.sku}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className="bg-brand-soft text-brand text-sm font-bold px-3 py-1 rounded-lg">{catName(p.categoryId)}</span>
                  </td>
                  <td className="px-4 py-4 font-mono text-sm text-muted">{p.barcode}</td>
                  <td className="px-4 py-4 text-right font-semibold text-muted">{p.costPrice.toFixed(2)}</td>
                  <td className="px-4 py-4 text-right font-extrabold">{p.salePrice.toFixed(2)} $</td>
                  {demoStores.map((s) => (
                    <td key={s.id} className="px-3 py-4 text-center font-bold">
                      <span className={p.stock[s.id] === 0 ? "text-danger" : ""}>{p.stock[s.id] ?? 0}</span>
                    </td>
                  ))}
                  <td className="px-4 py-4 text-center font-extrabold">{total}</td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setModal({ mode: "edit", product: p })}
                        className="p-2 rounded-lg text-muted hover:bg-brand-soft hover:text-brand"><Pencil size={17} /></button>
                      <button onClick={() => del(p)}
                        className="p-2 rounded-lg text-muted hover:bg-danger-soft hover:text-danger"><Trash2 size={17} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-6 py-12 text-center text-muted font-semibold">{t("Hech narsa topilmadi")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

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
