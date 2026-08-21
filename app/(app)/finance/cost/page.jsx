"use client";
import { t, tt } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { Plus, Trash2, ArrowLeft, Package, CheckCircle2, Truck } from "lucide-react";
import { demoStores, fmtUSD } from "@/lib/demoData";
import { listProducts } from "@/lib/productsData";
import {
  listShipments, getShipment, addShipment, updateShipment, removeShipment,
  computeLanded, applyShipment, COST_TYPES,
} from "@/lib/shipmentsData";
import { invoiceFromShipment } from "@/lib/suppliersData";
import StatCard from "@/components/finance/StatCard";
import DataTable from "@/components/ui/DataTable";
import Button from "@/components/ui/Button";

const fmtDay = (iso) => {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
};

/* ——— Partiya tahriri va tannarx hisobi ——————————————— */
function ShipmentEditor({ id, onBack, onChanged }) {
  const [tick, setTick] = useState(0);
  const shipment = useMemo(() => getShipment(id), [id, tick]);
  const calc = useMemo(() => (shipment ? computeLanded(shipment) : null), [shipment, tick]);
  const catalog = listProducts();

  if (!shipment) return null;
  const locked = shipment.status === "applied";

  const bump = () => { setTick((v) => v + 1); onChanged?.(); };

  const setField = (patch) => { updateShipment(id, patch); bump(); };

  const addItem = () => {
    const free = catalog.find((p) => !shipment.items.some((i) => i.productId === p.id)) ?? catalog[0];
    setField({ items: [...shipment.items, { productId: free.id, qty: 1, unitPrice: free.costPrice }] });
  };
  const setItem = (idx, patch) =>
    setField({ items: shipment.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) });
  const delItem = (idx) => setField({ items: shipment.items.filter((_, i) => i !== idx) });

  const addCost = () => setField({ costs: [...shipment.costs, { type: "freight", amount: 0 }] });
  const setCost = (idx, patch) =>
    setField({ costs: shipment.costs.map((c, i) => (i === idx ? { ...c, ...patch } : c)) });
  const delCost = (idx) => setField({ costs: shipment.costs.filter((_, i) => i !== idx) });

  function apply() {
    if (!confirm(t("Tannarx katalogga yoziladi va qoldiq omborga kiritiladi. Davom etamizmi?"))) return;
    applyShipment(id);
    // Partiya summasi kreditor qarzga aylanadi: yetkazib beruvchiga
    // 30 kunlik faktura ochiladi (Moliya → Yetkazib beruvchilar).
    invoiceFromShipment(getShipment(id), calc.grandTotal);
    bump();
  }

  return (
    <div>
      <button onClick={onBack}
        className="flex items-center gap-2 text-muted hover:text-ink font-bold mb-5">
        <ArrowLeft size={18} /> {t("Partiyalar ro'yxati")}
      </button>

      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">{shipment.no}</h1>
          <p className="text-muted font-semibold mt-1">{shipment.supplier}</p>
        </div>
        <span className={`flex items-center gap-1.5 font-bold px-4 py-2 rounded-xl ${
          locked ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}>
          {locked ? <><CheckCircle2 size={17} /> {t("Qo'llangan")}</> : <><Truck size={17} /> {t("Qoralama")}</>}
        </span>
      </div>

      {/* Asosiy ma'lumot */}
      <div className="card p-6 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div>
          <label className="block text-sm font-bold mb-2">{t("Sana")}</label>
          <input type="date" value={shipment.date} disabled={locked}
            onChange={(e) => setField({ date: e.target.value })} className="inp" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">{t("Yetkazib beruvchi")}</label>
          <input value={shipment.supplier} disabled={locked}
            onChange={(e) => setField({ supplier: e.target.value })} className="inp" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">{t("Qaysi omborga kiradi")}</label>
          <select value={shipment.storeId} disabled={locked}
            onChange={(e) => setField({ storeId: e.target.value })} className="inp">
            {demoStores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
        {/* Tovarlar */}
        <div className="card overflow-auto max-h-[70vh]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-line">
            <p className="font-extrabold">{t("Partiyadagi tovarlar")}</p>
            {!locked && (
              <button onClick={addItem}
                className="flex items-center gap-1.5 text-sm font-bold text-brand hover:underline">
                <Plus size={16} /> {t("Tovar qo'shish")}
              </button>
            )}
          </div>

          <table className="w-full text-[0.9375rem]">
            <thead>
              <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-20 text-left text-muted text-sm border-b border-line [&>th]:bg-panel">
                <th className="px-6 py-3 font-bold">{t("Tovar")}</th>
                <th className="px-3 py-3 font-bold text-center w-20">{t("Soni")}</th>
                <th className="px-3 py-3 font-bold text-right w-28">{t("Sof narx")}</th>
                <th className="px-3 py-3 font-bold text-right w-28">{t("Xarajat ulushi")}</th>
                <th className="px-6 py-3 font-bold text-right w-32">{t("Tannarx")}</th>
                {!locked && <th className="w-10"></th>}
              </tr>
            </thead>
            <tbody>
              {calc.rows.map((r, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="px-6 py-3">
                    {locked ? (
                      <p className="font-bold">{r.product?.name ?? "—"}</p>
                    ) : (
                      <select value={r.productId} onChange={(e) => setItem(i, { productId: e.target.value })}
                        className="w-full bg-transparent font-bold outline-none">
                        {catalog.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {locked ? <span className="font-bold">{r.qty}</span> : (
                      <input type="number" value={r.qty}
                        onChange={(e) => setItem(i, { qty: Number(e.target.value) || 0 })}
                        className="w-full bg-surface rounded-lg px-2 py-1.5 font-bold text-center outline-none" />
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {locked ? <span className="font-semibold">{r.unitPrice.toFixed(2)}</span> : (
                      <input type="number" value={r.unitPrice}
                        onChange={(e) => setItem(i, { unitPrice: Number(e.target.value) || 0 })}
                        className="w-full bg-surface rounded-lg px-2 py-1.5 font-semibold text-right outline-none" />
                    )}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-muted">
                    +{r.costShare.toFixed(2)}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <p className="font-extrabold">{r.landedUnit.toFixed(2)} $</p>
                    <p className="text-sm text-warn font-bold">+{r.markup}%</p>
                  </td>
                  {!locked && (
                    <td className="pr-4">
                      <button onClick={() => delItem(i)}
                        className="p-1.5 rounded-lg text-muted hover:bg-danger-soft hover:text-danger">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {calc.rows.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-muted font-semibold">
                  {t("Hali tovar qo'shilmagan")}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Xarajatlar va yakun */}
        <div>
          <div className="card p-6 mb-5">
            <div className="flex items-center justify-between mb-4">
              <p className="font-extrabold">{t("Import xarajatlari")}</p>
              {!locked && (
                <button onClick={addCost} className="text-sm font-bold text-brand hover:underline">
                  <Plus size={16} className="inline" /> {t("Qo'shish")}
                </button>
              )}
            </div>

            <div className="space-y-3 mb-4">
              {shipment.costs.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  {locked ? (
                    <span className="flex-1 font-semibold text-[0.9375rem]">{t(COST_TYPES[c.type]?.label ?? c.type)}</span>
                  ) : (
                    <select value={c.type} onChange={(e) => setCost(i, { type: e.target.value })}
                      className="flex-1 bg-surface rounded-lg px-3 py-2 font-semibold text-sm outline-none">
                      {Object.entries(COST_TYPES).map(([k, v]) =>
                        <option key={k} value={k}>{t(v.label)}</option>)}
                    </select>
                  )}
                  {locked ? (
                    <span className="font-bold w-24 text-right">{Number(c.amount).toFixed(2)}</span>
                  ) : (
                    <input type="number" value={c.amount}
                      onChange={(e) => setCost(i, { amount: Number(e.target.value) || 0 })}
                      className="w-24 bg-surface rounded-lg px-2 py-2 font-bold text-right outline-none" />
                  )}
                  {!locked && (
                    <button onClick={() => delCost(i)}
                      className="p-1.5 rounded-lg text-muted hover:bg-danger-soft hover:text-danger">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
              {shipment.costs.length === 0 && (
                <p className="text-sm text-muted font-semibold">{t("Xarajat kiritilmagan")}</p>
              )}
            </div>

            <div className="border-t border-dashed border-line pt-4 space-y-2">
              <div className="flex justify-between font-semibold">
                <span className="text-muted">{t("Tovarlar qiymati")}</span>
                <span>{fmtUSD(calc.totalValue)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-muted">{t("Xarajatlar")}</span>
                <span className="text-warn">+{fmtUSD(calc.totalCosts)}</span>
              </div>
              <div className="flex justify-between text-lg font-extrabold pt-1">
                <span>{t("Partiya tannarxi")}</span>
                <span>{fmtUSD(calc.grandTotal)}</span>
              </div>
              {calc.totalValue > 0 && (
                <p className="text-sm text-muted font-semibold pt-1">
                  {tt("Xarajatlar tovar qiymatining {n}% ini tashkil qiladi", {
                    n: ((calc.totalCosts / calc.totalValue) * 100).toFixed(1),
                  })}
                </p>
              )}
            </div>
          </div>

          {locked ? (
            <div className="card p-5 bg-ok-soft">
              <p className="font-bold text-ok mb-1">{t("Tannarx qo'llangan")}</p>
              <p className="text-sm font-semibold text-muted">
                {t("Katalogdagi tannarx yangilandi va qoldiq omborga kiritildi")}
              </p>
            </div>
          ) : (
            <button disabled={calc.rows.length === 0} onClick={apply}
              className="w-full rounded-xl bg-brand hover:bg-brand-dark text-white font-bold py-4 disabled:opacity-50">
              {t("Tannarxni qo'llash")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ——— Partiyalar ro'yxati ——————————————————————————— */
export default function FinanceCost() {
  const [openId, setOpenId] = useState(null);
  const [tick, setTick] = useState(0);
  const bump = () => setTick((v) => v + 1);

  const shipments = useMemo(() => listShipments(), [tick]);

  const totals = useMemo(() => {
    let value = 0, costs = 0, drafts = 0;
    for (const s of shipments) {
      const c = computeLanded(s);
      value += c.totalValue; costs += c.totalCosts;
      if (s.status === "draft") drafts++;
    }
    return { value: +value.toFixed(2), costs: +costs.toFixed(2), drafts };
  }, [shipments, tick]);

  function create() {
    const s = addShipment({
      date: new Date().toISOString().slice(0, 10),
      supplier: "",
      storeId: "s3",
    });
    bump();
    setOpenId(s.id);
  }

  function del(s) {
    if (!confirm(tt("{n} partiyasi o'chirilsinmi?", { n: s.no }))) return;
    removeShipment(s.id);
    bump();
  }

  if (openId) {
    return <ShipmentEditor id={openId} onBack={() => { setOpenId(null); bump(); }} onChanged={bump} />;
  }

  const storeName = (id) => demoStores.find((s) => s.id === id)?.name ?? "—";

  return (
    <div>
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">{t("Import va tannarx")}</h1>
          <p className="text-muted font-semibold mt-1">
            {t("Bojxona va yetkazib berish xarajatlari tovar qiymatiga qarab taqsimlanadi")}
          </p>
        </div>
        <button onClick={create}
          className="flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-5 py-3">
          <Plus size={20} /> {t("Yangi partiya")}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
        <StatCard icon={Package} label="Partiyalar qiymati" value={fmtUSD(totals.value)} />
        <StatCard icon={Truck} label="Import xarajatlari" tone="amber" value={fmtUSD(totals.costs)}
          hint={totals.value > 0
            ? tt("Tovar qiymatining {n}% i", { n: ((totals.costs / totals.value) * 100).toFixed(1) })
            : null} />
        <StatCard icon={CheckCircle2} label="Qo'llanmagan partiyalar" tone="amber"
          value={tt("{n} ta", { n: totals.drafts })} hint={t("Tannarx hali yozilmagan")} />
      </div>

      <DataTable
        id="cost-shipments"
        name={t("Import partiyalari")}
        rows={shipments}
        rowKey={(s) => s.id}
        onRowClick={(s) => setOpenId(s.id)}
        boshSort={{ key: "qiymat", dir: "desc" }}
        minWidth="66rem"
        jamiIzoh={tt("{n} ta partiya", { n: shipments.length })}
        empty={{ title: "Hali partiya yo'q",
                 hint: "Import partiyasi qo'shilsa, bojxona va yetkazish xarajati tannarxga taqsimlanadi" }}
        columns={[
          { key: "no", label: "Partiya", locked: true, value: (s) => s.no,
            cell: (s) => (
              <>
                <p className="font-bold">{s.no}</p>
                <p className="text-sm text-muted">{fmtDay(s.date)}</p>
              </>
            ) },
          { key: "supplier", label: "Yetkazib beruvchi", value: (s) => s.supplier || "—",
            cell: (s) => <span className="font-semibold">{s.supplier || "—"}</span> },
          { key: "ombor", label: "Ombor", value: (s) => storeName(s.storeId),
            cell: (s) => <span className="font-semibold text-muted">{storeName(s.storeId)}</span> },
          { key: "soni", label: "Tovarlar", right: true, value: (s) => computeLanded(s).totalQty,
            cell: (s) => <span className="font-bold">{computeLanded(s).totalQty}</span>,
            total: (rs) => rs.reduce((a, s) => a + computeLanded(s).totalQty, 0) },
          { key: "qiymat", label: "Qiymati", right: true, value: (s) => computeLanded(s).totalValue,
            cell: (s) => <span className="font-extrabold">{fmtUSD(computeLanded(s).totalValue)}</span>,
            total: (rs) => fmtUSD(rs.reduce((a, s) => a + computeLanded(s).totalValue, 0)) },
          { key: "xarajat", label: "Xarajatlar", right: true, value: (s) => computeLanded(s).totalCosts,
            cell: (s) => <span className="font-semibold text-warn">+{fmtUSD(computeLanded(s).totalCosts)}</span>,
            total: (rs) => <span className="text-warn">+{fmtUSD(rs.reduce((a, s) => a + computeLanded(s).totalCosts, 0))}</span> },
          { key: "holat", label: "Holati", value: (s) => (s.status === "applied" ? 1 : 0),
            cell: (s) => (
              <span className={`text-sm font-bold px-3 py-1 rounded-lg whitespace-nowrap ${
                s.status === "applied" ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}>
                {s.status === "applied" ? t("Qo'llangan") : t("Qoralama")}
              </span>
            ) },
          {
            key: "harakat", label: "Harakat", harakat: true, right: true, width: "5rem",
            cell: (s) => (s.status !== "applied" && (
              <span onClick={(e) => e.stopPropagation()}>
                <Button olcham="kichik" korinish="yassi" icon={Trash2}
                  onClick={() => del(s)} className="text-muted hover:text-danger" />
              </span>
            )),
          },
        ]}
      />
    </div>
  );
}
