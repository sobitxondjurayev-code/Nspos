"use client";
import { t, tt } from "@/lib/i18n";
import { useMemo, useState } from "react";
import {
  Plus, CalendarDays, Wrench, Coins, TrendingUp, Users, Pencil, Trash2, Search,
} from "lucide-react";
import { demoStores, fmtUSD } from "@/lib/demoData";
import { PERIODS, periodRange, fmtDate } from "@/lib/dates";
import DateRangePicker from "@/components/DateRangePicker";
import { listCustomers } from "@/lib/customersData";
import { getStaff } from "@/lib/staffData";
import {
  listOrders, addOrder, updateOrder, removeOrder, computeOrder,
  ordersInRange, servicesSummary, installerStats,
  listServiceTypes, addServiceType, updateServiceType, removeServiceType,
  STATUSES,
} from "@/lib/servicesData";
import ServiceOrderModal from "@/components/ServiceOrderModal";
import StatCard from "@/components/finance/StatCard";

const tabs = ["Buyurtmalar", "Ustalar KPI", "Xizmat turlari"];

const pad = (n) => String(n).padStart(2, "0");
const fmtWhen = (iso) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const TONES = {
  brand: "bg-brand-soft text-brand",
  warn: "bg-warn-soft text-warn",
  ok: "bg-ok-soft text-ok",
  muted: "bg-track text-muted",
};

/* ——— Buyurtmalar ——————————————————————————————— */
function OrdersTab({ range, tick, bump }) {
  const [modal, setModal] = useState(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const clients = listCustomers();
    return ordersInRange(range.from, range.to)
      .filter((o) => status === "all" || o.status === status)
      .filter((o) => {
        if (!s) return true;
        const c = clients.find((x) => x.id === o.customerId);
        return o.no.toLowerCase().includes(s)
          || o.address.toLowerCase().includes(s)
          || (c?.name.toLowerCase().includes(s) ?? false);
      });
  }, [range, q, status, tick]);

  const counts = useMemo(() => {
    const all = ordersInRange(range.from, range.to);
    const c = { all: all.length };
    for (const k of Object.keys(STATUSES)) c[k] = all.filter((o) => o.status === k).length;
    return c;
  }, [range, tick]);

  const clientName = (id) => listCustomers().find((c) => c.id === id)?.name ?? "—";

  function save(data) {
    if (modal.mode === "edit") updateOrder(modal.order.id, data);
    else addOrder(data);
    setModal(null); bump();
  }
  function del(o) {
    if (!confirm(tt("{n} buyurtmasi o'chirilsinmi?", { n: o.no }))) return;
    removeOrder(o.id); bump();
  }

  return (
    <div>
      <div className="flex gap-3 mb-5">
        <div className="card flex items-center gap-3 px-4 flex-1">
          <Search size={20} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={t("Raqam, manzil yoki mijoz bo'yicha qidirish...")}
            className="w-full py-3.5 outline-none font-semibold bg-transparent" />
        </div>
        <button onClick={() => setModal({ mode: "new" })}
          className="flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-5 py-3">
          <Plus size={20} /> {t("Yangi buyurtma")}
        </button>
      </div>

      {/* Holat filtrlari */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <button onClick={() => setStatus("all")}
          className={`rounded-xl px-5 py-2.5 font-bold border transition-colors ${
            status === "all" ? "bg-brand text-white border-brand" : "bg-panel border-line hover:border-brand"}`}>
          {t("Barchasi")} <span className="opacity-70">{counts.all}</span>
        </button>
        {Object.entries(STATUSES).map(([k, v]) => (
          <button key={k} onClick={() => setStatus(k)}
            className={`rounded-xl px-5 py-2.5 font-bold border transition-colors ${
              status === k ? "bg-brand text-white border-brand" : "bg-panel border-line hover:border-brand"}`}>
            {t(v.label)} <span className="opacity-70">{counts[k]}</span>
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-[0.9375rem]">
          <thead>
            <tr className="text-left text-muted text-sm border-b border-line">
              <th className="px-6 py-4 font-bold">{t("Buyurtma")}</th>
              <th className="px-4 py-4 font-bold">{t("Mijoz va manzil")}</th>
              <th className="px-4 py-4 font-bold">{t("Usta")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Xizmat")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Material")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Jami")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Usta ulushi")}</th>
              <th className="px-4 py-4 font-bold">{t("Holati")}</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const c = computeOrder(o);
              const st = STATUSES[o.status];
              return (
                <tr key={o.id} onClick={() => setModal({ mode: "edit", order: o })}
                  className="border-b border-line last:border-0 hover:bg-surface/70 cursor-pointer">
                  <td className="px-6 py-4">
                    <p className="font-bold">{o.no}</p>
                    <p className="text-sm text-muted">{fmtWhen(o.at)}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-bold">{clientName(o.customerId)}</p>
                    <p className="text-sm text-muted">{o.address}</p>
                  </td>
                  <td className="px-4 py-4 font-semibold">{getStaff(o.installerId)?.name ?? "—"}</td>
                  <td className="px-4 py-4 text-right font-semibold">{fmtUSD(c.servicesTotal)}</td>
                  <td className="px-4 py-4 text-right font-semibold text-muted">
                    {c.materialsTotal > 0 ? fmtUSD(c.materialsTotal) : "—"}
                  </td>
                  <td className="px-4 py-4 text-right font-extrabold">{fmtUSD(c.total)}</td>
                  <td className="px-4 py-4 text-right font-semibold text-warn">{fmtUSD(c.installerShare)}</td>
                  <td className="px-4 py-4">
                    <span className={`text-sm font-bold px-3 py-1 rounded-lg whitespace-nowrap ${TONES[st.tone]}`}>
                      {t(st.label)}
                    </span>
                  </td>
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setModal({ mode: "edit", order: o })}
                        className="p-2 rounded-lg text-muted hover:bg-brand-soft hover:text-brand"><Pencil size={17} /></button>
                      <button onClick={() => del(o)}
                        className="p-2 rounded-lg text-muted hover:bg-danger-soft hover:text-danger"><Trash2 size={17} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-6 py-12 text-center text-muted font-semibold">
                {t("Bu davrda buyurtma yo'q")}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <ServiceOrderModal
          initial={modal.mode === "edit" ? modal.order : null}
          onClose={() => setModal(null)} onSave={save} />
      )}
    </div>
  );
}

/* ——— Ustalar KPI ——————————————————————————————— */
function InstallersTab({ range, tick }) {
  const rows = useMemo(() => installerStats(range.from, range.to), [range, tick]);
  const total = rows.reduce((a, r) => a + r.servicesTotal, 0);

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-[0.9375rem]">
        <thead>
          <tr className="text-left text-muted text-sm border-b border-line">
            <th className="px-6 py-4 font-bold">{t("Usta")}</th>
            <th className="px-4 py-4 font-bold text-center">{t("Buyurtmalar")}</th>
            <th className="px-4 py-4 font-bold text-right">{t("Xizmat daromadi")}</th>
            <th className="px-4 py-4 font-bold text-right">{t("O'rtacha buyurtma")}</th>
            <th className="px-4 py-4 font-bold text-right">{t("Ulushi")}</th>
            <th className="px-6 py-4 font-bold text-right">{t("Hissasi")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.installer.id} className="border-b border-line last:border-0 hover:bg-surface/70">
              <td className="px-6 py-4">
                <p className="font-bold">{r.installer.name}</p>
                <p className="text-sm text-muted">{r.installer.phone}</p>
              </td>
              <td className="px-4 py-4 text-center font-bold">{r.orders}</td>
              <td className="px-4 py-4 text-right font-extrabold">{fmtUSD(r.servicesTotal)}</td>
              <td className="px-4 py-4 text-right font-semibold text-muted">{fmtUSD(r.avgCheck)}</td>
              <td className="px-4 py-4 text-right font-semibold text-warn">{fmtUSD(r.share)}</td>
              <td className="px-6 py-4 text-right font-bold">
                {total > 0 ? `${((r.servicesTotal / total) * 100).toFixed(1)}%` : "—"}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={6} className="px-6 py-12 text-center text-muted font-semibold">
              {t("Bu davrda bajarilgan buyurtma yo'q")}
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ——— Xizmat turlari ——————————————————————————— */
function TypesTab({ tick, bump }) {
  const types = useMemo(() => listServiceTypes(), [tick]);
  const [draft, setDraft] = useState({ name: "", price: "", unit: "dona" });

  function add() {
    if (!draft.name.trim() || !(Number(draft.price) > 0)) return;
    addServiceType({ name: draft.name.trim(), price: Number(draft.price), unit: draft.unit });
    setDraft({ name: "", price: "", unit: "dona" });
    bump();
  }

  return (
    <div>
      <div className="card p-6 mb-6">
        <p className="font-extrabold mb-4">{t("Yangi xizmat turi")}</p>
        <div className="flex gap-3">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="inp flex-1" placeholder={t("Xizmat nomi")} />
          <input type="number" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            className="inp w-32" placeholder={t("Narxi")} />
          <select value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
            className="inp w-36">
            {["dona", "metr", "komplekt", "chiqish", "soat"].map((u) =>
              <option key={u} value={u}>{t(u)}</option>)}
          </select>
          <button onClick={add}
            className="rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-6">
            {t("Qo'shish")}
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-[0.9375rem]">
          <thead>
            <tr className="text-left text-muted text-sm border-b border-line">
              <th className="px-6 py-4 font-bold">{t("Xizmat")}</th>
              <th className="px-4 py-4 font-bold">{t("O'lchov")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Narxi")}</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {types.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0 hover:bg-surface/70">
                <td className="px-6 py-4">
                  <input defaultValue={s.name}
                    onBlur={(e) => { updateServiceType(s.id, { name: e.target.value }); bump(); }}
                    className="w-full bg-transparent font-bold outline-none" />
                </td>
                <td className="px-4 py-4 font-semibold text-muted">{t(s.unit)}</td>
                <td className="px-4 py-4 text-right">
                  <input type="number" defaultValue={s.price}
                    onBlur={(e) => { updateServiceType(s.id, { price: Number(e.target.value) || 0 }); bump(); }}
                    className="w-24 bg-surface rounded-lg px-2 py-1.5 font-extrabold text-right outline-none" />
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => { removeServiceType(s.id); bump(); }}
                    className="p-2 rounded-lg text-muted hover:bg-danger-soft hover:text-danger">
                    <Trash2 size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Services() {
  const [tab, setTab] = useState(tabs[0]);
  const [period, setPeriod] = useState("Oy");
  const [range, setRange] = useState(() => periodRange("Oy"));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const bump = () => setTick((v) => v + 1);

  const sum = useMemo(() => servicesSummary(range.from, range.to), [range, tick]);

  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight mb-7">{t("Xizmatlar")}</h1>

      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="bg-track rounded-2xl p-1.5 flex">
          {PERIODS.map((p) => (
            <button key={p} onClick={() => { setPeriod(p); setRange(periodRange(p)); }}
              className={`tab-btn ${period === p ? "active" : ""}`}>{t(p)}</button>
          ))}
        </div>
        <div className="relative">
          <button onClick={() => setPickerOpen((v) => !v)}
            className="card flex items-center gap-4 px-5 py-3 font-bold">
            <CalendarDays size={20} className="text-brand" />
            <span className="text-right leading-tight">
              {fmtDate(range.from)}<br />{fmtDate(range.to)}
            </span>
          </button>
          {pickerOpen && (
            <DateRangePicker from={range.from} to={range.to}
              onApply={(f, tt2) => { setPeriod(null); setRange({ from: f, to: tt2 }); setPickerOpen(false); }}
              onClose={() => setPickerOpen(false)} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <StatCard icon={Wrench} label="Bajarilgan buyurtmalar" value={tt("{n} ta", { n: sum.count })} />
        <StatCard icon={Coins} label="Xizmat daromadi" tone="green" value={fmtUSD(sum.servicesTotal)}
          hint={sum.materialsTotal > 0
            ? tt("Material: {n}", { n: fmtUSD(sum.materialsTotal) }) : null} />
        <StatCard icon={Users} label="Ustalar ulushi" tone="amber" value={fmtUSD(sum.installerShare)} />
        <StatCard icon={TrendingUp} label="Sof foyda" tone="green" value={fmtUSD(sum.profit)}
          hint={t("Material tannarxi va usta ulushi chegirilgan")} />
      </div>

      <div className="bg-track rounded-2xl p-1.5 flex w-fit mb-6">
        {tabs.map((tb) => (
          <button key={tb} onClick={() => setTab(tb)}
            className={`tab-btn ${tab === tb ? "active" : ""}`}>{t(tb)}</button>
        ))}
      </div>

      {tab === "Buyurtmalar" && <OrdersTab range={range} tick={tick} bump={bump} />}
      {tab === "Ustalar KPI" && <InstallersTab range={range} tick={tick} />}
      {tab === "Xizmat turlari" && <TypesTab tick={tick} bump={bump} />}
    </div>
  );
}
