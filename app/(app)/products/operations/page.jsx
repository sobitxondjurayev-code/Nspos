"use client";
import { t, tt } from "@/lib/i18n";
import { useMemo, useState } from "react";
import {
  Plus, Trash2, ArrowLeft, ArrowRightLeft, ClipboardCheck, Tag, PackageMinus,
  CheckCircle2, AlertTriangle,
} from "lucide-react";
import { demoStores, fmtUSD } from "@/lib/demoData";
import { listProducts } from "@/lib/productsData";
import {
  listOperations, getOperation, addOperation, updateOperation, removeOperation,
  computeOperation, applyOperation, warehouseSummary, OP_TYPES, WRITEOFF_REASONS,
} from "@/lib/warehouseData";
import StatCard from "@/components/finance/StatCard";

const ICONS = {
  transfer: ArrowRightLeft,
  inventory: ClipboardCheck,
  revaluation: Tag,
  writeoff: PackageMinus,
};

const fmtDay = (iso) => {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
};

/* ——— Operatsiya tahriri ——————————————————————————— */
function OperationEditor({ id, onBack, onChanged }) {
  const [tick, setTick] = useState(0);
  const op = useMemo(() => getOperation(id), [id, tick]);
  const calc = useMemo(() => (op ? computeOperation(op) : null), [op, tick]);
  const catalog = listProducts();

  if (!op) return null;
  const cfg = OP_TYPES[op.type];
  const locked = op.status === "applied";
  const Icon = ICONS[op.type];

  const bump = () => { setTick((v) => v + 1); onChanged?.(); };
  const setField = (patch) => { updateOperation(id, patch); bump(); };

  function addItem() {
    const free = catalog.find((p) => !op.items.some((i) => i.productId === p.id)) ?? catalog[0];
    if (!free) return;
    const base = { productId: free.id };
    if (op.type === "inventory") base.countedQty = free.stock[op.fromStoreId] ?? 0;
    else if (op.type === "revaluation") base.newSalePrice = free.salePrice;
    else { base.qty = 1; if (op.type === "writeoff") base.reason = WRITEOFF_REASONS[0]; }
    setField({ items: [...op.items, base] });
  }
  const setItem = (idx, patch) =>
    setField({ items: op.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) });
  const delItem = (idx) => setField({ items: op.items.filter((_, i) => i !== idx) });

  // Tovar almashsa, turga qarab standart qiymatlar yangilanadi
  function changeProduct(idx, productId) {
    const p = catalog.find((x) => x.id === productId);
    const patch = { productId };
    if (op.type === "inventory") patch.countedQty = p?.stock[op.fromStoreId] ?? 0;
    if (op.type === "revaluation") patch.newSalePrice = p?.salePrice ?? 0;
    setItem(idx, patch);
  }

  function apply() {
    if (!confirm(t("Operatsiya qo'llansa qoldiq va narxlar o'zgaradi. Davom etamizmi?"))) return;
    const res = applyOperation(id);
    if (!res) alert(t("Qo'llab bo'lmadi: qoldiq yetarli emas"));
    bump();
  }

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-muted hover:text-ink font-bold mb-5">
        <ArrowLeft size={18} /> {t("Operatsiyalar ro'yxati")}
      </button>

      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight flex items-center gap-3">
            <Icon size={32} className="text-brand" /> {op.no}
          </h1>
          <p className="text-muted font-semibold mt-1">{t(cfg.label)} · {t(cfg.hint)}</p>
        </div>
        <span className={`flex items-center gap-1.5 font-bold px-4 py-2 rounded-xl ${
          locked ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}>
          {locked ? <><CheckCircle2 size={17} /> {t("Qo'llangan")}</> : t("Qoralama")}
        </span>
      </div>

      {/* Sarlavha maydonlari */}
      <div className="card p-6 mb-6 grid grid-cols-3 gap-5">
        {cfg.needsFrom && (
          <div>
            <label className="block text-sm font-bold mb-2">
              {op.type === "transfer" ? t("Qayerdan") : t("Do'kon")}
            </label>
            <select value={op.fromStoreId ?? ""} disabled={locked}
              onChange={(e) => {
                const from = e.target.value;
                // Transferda "qayerga" bilan bir xil bo'lib qolmasin — aks holda
                // operatsiya o'zidan o'ziga bo'lib, hech narsa o'zgarmaydi
                const to = op.type === "transfer" && op.toStoreId === from
                  ? demoStores.find((s) => s.id !== from)?.id ?? null
                  : op.toStoreId;
                setField({ fromStoreId: from, toStoreId: to });
              }} className="inp">
              {demoStores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        {cfg.needsTo && (
          <div>
            <label className="block text-sm font-bold mb-2">{t("Qayerga")}</label>
            <select value={op.toStoreId ?? ""} disabled={locked}
              onChange={(e) => setField({ toStoreId: e.target.value })} className="inp">
              {demoStores.filter((s) => s.id !== op.fromStoreId)
                .map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        <div className={cfg.needsFrom && cfg.needsTo ? "" : "col-span-2"}>
          <label className="block text-sm font-bold mb-2">{t("Izoh")}</label>
          <input value={op.note ?? ""} disabled={locked}
            onChange={(e) => setField({ note: e.target.value })}
            className="inp" placeholder={t("Ixtiyoriy")} />
        </div>
      </div>

      {calc.blocked && (
        <div className="card p-5 mb-6 flex items-center gap-3 bg-danger-soft">
          <AlertTriangle size={20} className="text-danger shrink-0" />
          <p className="font-bold text-danger">
            {t("Ba'zi tovarlarda qoldiq yetarli emas — operatsiyani qo'llab bo'lmaydi")}
          </p>
        </div>
      )}

      <div className="grid grid-cols-[1fr_320px] gap-6 items-start">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-line">
            <p className="font-extrabold">{t("Tovarlar")}</p>
            {!locked && (
              <button onClick={addItem} className="flex items-center gap-1.5 text-sm font-bold text-brand hover:underline">
                <Plus size={16} /> {t("Tovar qo'shish")}
              </button>
            )}
          </div>

          <table className="w-full text-[0.9375rem]">
            <thead>
              <tr className="text-left text-muted text-sm border-b border-line">
                <th className="px-6 py-3 font-bold">{t("Tovar")}</th>
                {op.type === "revaluation" ? (
                  <>
                    <th className="px-3 py-3 font-bold text-right w-28">{t("Eski narx")}</th>
                    <th className="px-3 py-3 font-bold text-right w-28">{t("Yangi narx")}</th>
                    <th className="px-3 py-3 font-bold text-right w-24">{t("O'zgarish")}</th>
                  </>
                ) : op.type === "inventory" ? (
                  <>
                    <th className="px-3 py-3 font-bold text-center w-28">{t("Tizimda")}</th>
                    <th className="px-3 py-3 font-bold text-center w-28">{t("Sanoqda")}</th>
                    <th className="px-3 py-3 font-bold text-center w-24">{t("Farq")}</th>
                  </>
                ) : (
                  <>
                    <th className="px-3 py-3 font-bold text-center w-28">{t("Qoldiq")}</th>
                    <th className="px-3 py-3 font-bold text-center w-24">{t("Miqdor")}</th>
                    {op.type === "writeoff" && <th className="px-3 py-3 font-bold w-40">{t("Sabab")}</th>}
                  </>
                )}
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
                      <select value={r.productId} onChange={(e) => changeProduct(i, e.target.value)}
                        className="w-full bg-transparent font-bold outline-none">
                        {catalog.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    )}
                  </td>

                  {op.type === "revaluation" ? (
                    <>
                      <td className="px-3 py-3 text-right font-semibold text-muted">{r.oldPrice.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right">
                        {locked ? <span className="font-extrabold">{r.newPrice.toFixed(2)}</span> : (
                          <input type="number" value={r.newSalePrice}
                            onChange={(e) => setItem(i, { newSalePrice: Number(e.target.value) || 0 })}
                            className="w-full bg-surface rounded-lg px-2 py-1.5 font-bold text-right outline-none" />
                        )}
                      </td>
                      <td className={`px-3 py-3 text-right font-extrabold ${
                        r.deltaPct > 0 ? "text-ok" : r.deltaPct < 0 ? "text-danger" : "text-muted"}`}>
                        {r.deltaPct > 0 ? "+" : ""}{r.deltaPct}%
                      </td>
                    </>
                  ) : op.type === "inventory" ? (
                    <>
                      <td className="px-3 py-3 text-center font-semibold text-muted">{r.current}</td>
                      <td className="px-3 py-3 text-center">
                        {locked ? <span className="font-bold">{r.counted}</span> : (
                          <input type="number" value={r.countedQty}
                            onChange={(e) => setItem(i, { countedQty: Number(e.target.value) || 0 })}
                            className="w-full bg-surface rounded-lg px-2 py-1.5 font-bold text-center outline-none" />
                        )}
                      </td>
                      <td className={`px-3 py-3 text-center font-extrabold ${
                        r.diff > 0 ? "text-ok" : r.diff < 0 ? "text-danger" : "text-muted"}`}>
                        {r.diff > 0 ? "+" : ""}{r.diff}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className={`px-3 py-3 text-center font-semibold ${
                        r.enough === false ? "text-danger" : "text-muted"}`}>{r.current}</td>
                      <td className="px-3 py-3 text-center">
                        {locked ? <span className="font-bold">{r.qty}</span> : (
                          <input type="number" value={r.qty}
                            onChange={(e) => setItem(i, { qty: Number(e.target.value) || 0 })}
                            className={`w-full rounded-lg px-2 py-1.5 font-bold text-center outline-none ${
                              r.enough === false ? "bg-danger-soft text-danger" : "bg-surface"}`} />
                        )}
                      </td>
                      {op.type === "writeoff" && (
                        <td className="px-3 py-3">
                          {locked ? <span className="font-semibold">{t(r.reason ?? "")}</span> : (
                            <select value={r.reason ?? WRITEOFF_REASONS[0]}
                              onChange={(e) => setItem(i, { reason: e.target.value })}
                              className="w-full bg-surface rounded-lg px-2 py-1.5 font-semibold text-sm outline-none">
                              {WRITEOFF_REASONS.map((x) => <option key={x} value={x}>{t(x)}</option>)}
                            </select>
                          )}
                        </td>
                      )}
                    </>
                  )}

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

        {/* Yakun */}
        <div>
          <div className="card p-6 mb-5 space-y-3">
            <div className="flex justify-between font-semibold">
              <span className="text-muted">{t("Tovar turlari")}</span>
              <span className="font-bold">{calc.rows.length}</span>
            </div>
            {op.type !== "revaluation" && (
              <div className="flex justify-between font-semibold">
                <span className="text-muted">{t("Jami miqdor")}</span>
                <span className="font-bold">{calc.totalQty}</span>
              </div>
            )}
            <div className="border-t border-dashed border-line pt-3 flex justify-between">
              <span className="text-muted font-semibold">
                {op.type === "revaluation" ? t("Qoldiq qiymati o'zgarishi")
                  : op.type === "inventory" ? t("Farq qiymati")
                  : t("Tannarxdagi qiymat")}
              </span>
              <span className={`font-extrabold ${
                calc.totalValue < 0 ? "text-danger" : calc.totalValue > 0 ? "text-ok" : ""}`}>
                {fmtUSD(calc.totalValue)}
              </span>
            </div>
          </div>

          {locked ? (
            <div className="card p-5 bg-ok-soft">
              <p className="font-bold text-ok mb-1">{t("Operatsiya qo'llangan")}</p>
              <p className="text-sm font-semibold text-muted">
                {tt("{d} da bajarilgan", { d: fmtDay(op.appliedAt) })}
              </p>
            </div>
          ) : (
            <button disabled={calc.rows.length === 0 || calc.blocked} onClick={apply}
              className="w-full rounded-xl bg-brand hover:bg-brand-dark text-white font-bold py-4 disabled:opacity-50">
              {t("Operatsiyani qo'llash")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ——— Ro'yxat ——————————————————————————————————— */
export default function WarehouseOperations() {
  const [openId, setOpenId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [tick, setTick] = useState(0);
  const bump = () => setTick((v) => v + 1);

  const ops = useMemo(() => listOperations(), [tick]);
  const sum = useMemo(() => warehouseSummary(), [tick]);

  const rows = ops.filter((o) => filter === "all" || o.type === filter);
  const storeName = (id) => demoStores.find((s) => s.id === id)?.name ?? "—";

  function create(type) {
    const cfg = OP_TYPES[type];
    const op = addOperation({
      type,
      fromStoreId: cfg.needsFrom ? demoStores[0].id : null,
      toStoreId: cfg.needsTo ? demoStores[2].id : null,
    });
    bump();
    setOpenId(op.id);
  }

  function del(o) {
    if (!confirm(tt("{n} o'chirilsinmi?", { n: o.no }))) return;
    removeOperation(o.id);
    bump();
  }

  if (openId) {
    return <OperationEditor id={openId} onBack={() => { setOpenId(null); bump(); }} onChanged={bump} />;
  }

  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight mb-2">{t("Ombor operatsiyalari")}</h1>
      <p className="text-muted font-semibold mb-7">
        {t("Transfer, inventarizatsiya, qayta baholash va hisobdan chiqarish")}
      </p>

      <div className="grid grid-cols-4 gap-5 mb-7">
        <StatCard icon={ClipboardCheck} label="Qoralama operatsiyalar" tone="amber"
          value={tt("{n} ta", { n: sum.draftCount })} hint={t("Hali qo'llanmagan")} />
        <StatCard icon={CheckCircle2} label="Qo'llangan operatsiyalar"
          value={tt("{n} ta", { n: sum.appliedCount })} />
        <StatCard icon={AlertTriangle} label="Inventarizatsiya kamomadi" tone="red"
          value={fmtUSD(sum.shrinkage)} hint={t("Tannarxda")} />
        <StatCard icon={PackageMinus} label="Hisobdan chiqarilgan" tone="red"
          value={fmtUSD(sum.writtenOff)} hint={t("Tannarxda")} />
      </div>

      {/* Yangi operatsiya tugmalari */}
      <div className="grid grid-cols-4 gap-4 mb-7">
        {Object.entries(OP_TYPES).map(([k, v]) => {
          const Icon = ICONS[k];
          return (
            <button key={k} onClick={() => create(k)}
              className="card p-5 text-left hover:shadow-pop transition-shadow">
              <Icon size={24} className="text-brand mb-3" />
              <p className="font-extrabold mb-1">{t(v.label)}</p>
              <p className="text-sm text-muted font-semibold">{t(v.hint)}</p>
            </button>
          );
        })}
      </div>

      {/* Filtrlar */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <button onClick={() => setFilter("all")}
          className={`rounded-xl px-5 py-2.5 font-bold border transition-colors ${
            filter === "all" ? "bg-brand text-white border-brand" : "bg-panel border-line hover:border-brand"}`}>
          {t("Barchasi")} <span className="opacity-70">{ops.length}</span>
        </button>
        {Object.entries(OP_TYPES).map(([k, v]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`rounded-xl px-5 py-2.5 font-bold border transition-colors ${
              filter === k ? "bg-brand text-white border-brand" : "bg-panel border-line hover:border-brand"}`}>
            {t(v.label)} <span className="opacity-70">{ops.filter((o) => o.type === k).length}</span>
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-[0.9375rem]">
          <thead>
            <tr className="text-left text-muted text-sm border-b border-line">
              <th className="px-6 py-4 font-bold">{t("Operatsiya")}</th>
              <th className="px-4 py-4 font-bold">{t("Turi")}</th>
              <th className="px-4 py-4 font-bold">{t("Do'kon")}</th>
              <th className="px-4 py-4 font-bold">{t("Muallif")}</th>
              <th className="px-4 py-4 font-bold text-center">{t("Tovarlar")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Qiymati")}</th>
              <th className="px-4 py-4 font-bold">{t("Holati")}</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const c = computeOperation(o);
              const Icon = ICONS[o.type];
              return (
                <tr key={o.id} onClick={() => setOpenId(o.id)}
                  className="border-b border-line last:border-0 hover:bg-surface/70 cursor-pointer">
                  <td className="px-6 py-4">
                    <p className="font-bold">{o.no}</p>
                    <p className="text-sm text-muted">{fmtDay(o.at)}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-2 font-semibold">
                      <Icon size={16} className="text-brand" /> {t(OP_TYPES[o.type].label)}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-semibold text-muted">
                    {o.type === "transfer"
                      ? `${storeName(o.fromStoreId)} → ${storeName(o.toStoreId)}`
                      : o.fromStoreId ? storeName(o.fromStoreId) : t("Barcha do'konlar")}
                  </td>
                  <td className="px-4 py-4 font-semibold text-muted">{o.author}</td>
                  <td className="px-4 py-4 text-center font-bold">{o.items.length}</td>
                  <td className={`px-4 py-4 text-right font-extrabold ${
                    c.totalValue < 0 ? "text-danger" : ""}`}>{fmtUSD(c.totalValue)}</td>
                  <td className="px-4 py-4">
                    <span className={`text-sm font-bold px-3 py-1 rounded-lg whitespace-nowrap ${
                      o.status === "applied" ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}>
                      {o.status === "applied" ? t("Qo'llangan") : t("Qoralama")}
                    </span>
                  </td>
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    {o.status !== "applied" && (
                      <button onClick={() => del(o)}
                        className="p-2 rounded-lg text-muted hover:bg-danger-soft hover:text-danger">
                        <Trash2 size={17} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-6 py-12 text-center text-muted font-semibold">
                {t("Bu turdagi operatsiya yo'q")}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
