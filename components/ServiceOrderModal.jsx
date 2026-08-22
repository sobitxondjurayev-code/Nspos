"use client";
import { t, tt } from "@/lib/i18n";
import { useState } from "react";
import { X, Plus, Trash2, Wrench, Package } from "lucide-react";
import { demoStores, fmtUSD } from "@/lib/demoData";
import { listProducts } from "@/lib/productsData";
import { listCustomers } from "@/lib/customersData";
import { listInstallers } from "@/lib/staffData";
import { listServiceTypes, computeOrder, STATUSES } from "@/lib/servicesData";
import { useOyna } from "@/components/ui/Modal";

export default function ServiceOrderModal({ initial, onClose, onSave }) {
  // Esc bilan yopiladi, fon skrolli qulflanadi (`ui/Modal.jsx`)
  useOyna(onClose);
  const installers = listInstallers();
  const types = listServiceTypes();
  const catalog = listProducts();
  const clients = listCustomers();

  const [f, setF] = useState(
    initial ?? {
      customerId: clients[0]?.id ?? null,
      address: "",
      storeId: demoStores[0].id,
      installerId: installers[0]?.id ?? null,
      installerPct: installers[0]?.sharePct ?? 30,
      services: [],
      materials: [],
      status: "yangi",
      note: "",
    }
  );

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const calc = computeOrder(f);

  // —— Xizmat qatorlari ————————————————————————
  const addService = () => {
    const free = types.find((x) => !f.services.some((s) => s.typeId === x.id)) ?? types[0];
    set("services", [...f.services, { typeId: free.id, qty: 1, price: free.price }]);
  };
  const setService = (i, patch) =>
    set("services", f.services.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const delService = (i) => set("services", f.services.filter((_, j) => j !== i));

  // Xizmat turi almashsa narx ham yangilanadi
  const changeType = (i, typeId) => {
    const st = types.find((x) => x.id === typeId);
    setService(i, { typeId, price: st?.price ?? 0 });
  };

  // —— Material qatorlari ————————————————————————
  const addMaterial = () => {
    const free = catalog.find((p) => !f.materials.some((m) => m.productId === p.id)) ?? catalog[0];
    if (!free) return;
    set("materials", [...f.materials, { productId: free.id, qty: 1, price: free.salePrice }]);
  };
  const setMaterial = (i, patch) =>
    set("materials", f.materials.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const delMaterial = (i) => set("materials", f.materials.filter((_, j) => j !== i));
  const changeProduct = (i, productId) => {
    const p = catalog.find((x) => x.id === productId);
    setMaterial(i, { productId, price: p?.salePrice ?? 0 });
  };

  // Usta almashsa uning standart ulushi qo'yiladi
  const changeInstaller = (id) => {
    const inst = installers.find((x) => x.id === id);
    setF((p) => ({ ...p, installerId: id, installerPct: inst?.sharePct ?? p.installerPct }));
  };

  const valid = f.address.trim() && f.installerId && f.services.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-overlay/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="card w-full max-w-3xl p-6 sm:p-8 rounded-b-none sm:rounded-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-extrabold">
            {initial ? tt("Buyurtma {n}", { n: initial.no }) : t("Yangi buyurtma")}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={22} /></button>
        </div>

        {/* Asosiy ma'lumot */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-bold mb-2">{t("Mijoz")}</label>
            <select value={f.customerId ?? ""} onChange={(e) => set("customerId", e.target.value || null)}
              className="inp">
              <option value="">{t("— tanlanmagan —")}</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold mb-2">{t("Do'kon")}</label>
            <select value={f.storeId} onChange={(e) => set("storeId", e.target.value)} className="inp">
              {demoStores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <label className="block text-sm font-bold mb-2">{t("Manzil")} *</label>
        <input value={f.address} onChange={(e) => set("address", e.target.value)}
          className="inp mb-4" placeholder={t("Masalan: Chilonzor 12-kvartal, 34-uy")} />

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_160px] gap-4 mb-6">
          <div>
            <label className="block text-sm font-bold mb-2">{t("Usta")} *</label>
            <select value={f.installerId ?? ""} onChange={(e) => changeInstaller(e.target.value)} className="inp">
              {installers.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold mb-2">{t("Usta ulushi")}</label>
            <input type="number" value={f.installerPct}
              onChange={(e) => set("installerPct", Number(e.target.value) || 0)} className="inp" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-2">{t("Holati")}</label>
            <select value={f.status} onChange={(e) => set("status", e.target.value)} className="inp">
              {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{t(v.label)}</option>)}
            </select>
          </div>
        </div>

        {/* Xizmatlar */}
        <div className="flex items-center justify-between mb-3">
          <p className="font-extrabold flex items-center gap-2">
            <Wrench size={18} className="text-brand" /> {t("Xizmatlar")} *
          </p>
          <button onClick={addService} className="text-sm font-bold text-brand hover:underline">
            <Plus size={15} className="inline" /> {t("Qo'shish")}
          </button>
        </div>
        <div className="space-y-2 mb-5">
          {f.services.map((s, i) => {
            const st = types.find((x) => x.id === s.typeId);
            return (
              <div key={i} className="flex items-center gap-2">
                <select value={s.typeId} onChange={(e) => changeType(i, e.target.value)}
                  className="flex-1 bg-surface rounded-lg px-3 py-2.5 font-semibold text-[0.9375rem] outline-none">
                  {types.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                <input type="number" value={s.qty}
                  onChange={(e) => setService(i, { qty: Number(e.target.value) || 0 })}
                  className="w-20 bg-surface rounded-lg px-2 py-2.5 font-bold text-center outline-none" />
                <span className="text-sm text-muted font-semibold w-16">{st ? t(st.unit) : ""}</span>
                <input type="number" value={s.price}
                  onChange={(e) => setService(i, { price: Number(e.target.value) || 0 })}
                  className="w-24 bg-surface rounded-lg px-2 py-2.5 font-bold text-right outline-none" />
                <span className="w-24 text-right font-extrabold">
                  {(s.qty * s.price).toFixed(2)} $
                </span>
                <button onClick={() => delService(i)}
                  className="p-1.5 rounded-lg text-muted hover:bg-danger-soft hover:text-danger">
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
          {f.services.length === 0 && (
            <p className="text-sm text-muted font-semibold">{t("Kamida bitta xizmat qo'shing")}</p>
          )}
        </div>

        {/* Materiallar */}
        <div className="flex items-center justify-between mb-3">
          <p className="font-extrabold flex items-center gap-2">
            <Package size={18} className="text-brand" /> {t("Materiallar")}
          </p>
          <button onClick={addMaterial} className="text-sm font-bold text-brand hover:underline">
            <Plus size={15} className="inline" /> {t("Qo'shish")}
          </button>
        </div>
        <div className="space-y-2 mb-6">
          {f.materials.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <select value={m.productId} onChange={(e) => changeProduct(i, e.target.value)}
                className="flex-1 bg-surface rounded-lg px-3 py-2.5 font-semibold text-[0.9375rem] outline-none">
                {catalog.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="number" value={m.qty}
                onChange={(e) => setMaterial(i, { qty: Number(e.target.value) || 0 })}
                className="w-20 bg-surface rounded-lg px-2 py-2.5 font-bold text-center outline-none" />
              <input type="number" value={m.price}
                onChange={(e) => setMaterial(i, { price: Number(e.target.value) || 0 })}
                className="w-24 bg-surface rounded-lg px-2 py-2.5 font-bold text-right outline-none" />
              <span className="w-24 text-right font-extrabold">{(m.qty * m.price).toFixed(2)} $</span>
              <button onClick={() => delMaterial(i)}
                className="p-1.5 rounded-lg text-muted hover:bg-danger-soft hover:text-danger">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {f.materials.length === 0 && (
            <p className="text-sm text-muted font-semibold">{t("Material sotilmagan")}</p>
          )}
        </div>

        {/* Yakuniy hisob */}
        <div className="bg-surface rounded-2xl p-5 mb-6 space-y-2">
          <div className="flex justify-between font-semibold">
            <span className="text-muted">{t("Xizmatlar")}</span>
            <span>{fmtUSD(calc.servicesTotal)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span className="text-muted">{t("Materiallar")}</span>
            <span>{fmtUSD(calc.materialsTotal)}</span>
          </div>
          <div className="flex justify-between text-lg font-extrabold pt-1 border-t border-dashed border-line">
            <span>{t("Buyurtma summasi")}</span>
            <span>{fmtUSD(calc.total)}</span>
          </div>
          <div className="border-t border-dashed border-line pt-2 mt-2 space-y-2">
            <div className="flex justify-between font-semibold">
              <span className="text-muted">
                {tt("Usta ulushi ({n}% xizmatdan)", { n: f.installerPct })}
              </span>
              <span className="text-warn">−{fmtUSD(calc.installerShare)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span className="text-muted">{t("Material tannarxi")}</span>
              <span className="text-warn">−{fmtUSD(calc.materialsCost)}</span>
            </div>
            <div className="flex justify-between font-extrabold">
              <span>{t("Sof foyda")}</span>
              <span className={calc.profit >= 0 ? "text-ok" : "text-danger"}>{fmtUSD(calc.profit)}</span>
            </div>
          </div>
        </div>

        <label className="block text-sm font-bold mb-2">{t("Izoh")}</label>
        <input value={f.note ?? ""} onChange={(e) => set("note", e.target.value)}
          className="inp mb-7" placeholder={t("Ixtiyoriy")} />

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-line font-bold py-3 hover:bg-surface">
            {t("Bekor qilish")}
          </button>
          <button disabled={!valid} onClick={() => onSave(f)}
            className="flex-1 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold py-3 disabled:opacity-50">
            {t("Saqlash")}
          </button>
        </div>
      </div>
    </div>
  );
}
