"use client";
import { t } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { Lock, Unlock, CheckCircle2 } from "lucide-react";
import { demoStores, demoUser, fmtUSD } from "@/lib/demoData";
import {
  listShifts, activeShift, openShift, closeShift, shiftSummary, shiftStores,
} from "@/lib/shiftsData";
import { OpenShiftModal, CloseShiftModal } from "@/components/ShiftModal";

const pad = (n) => String(n).padStart(2, "0");
const fmtDay = (iso) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};
const fmtTime = (iso) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function FinanceShifts() {
  const [openFor, setOpenFor] = useState(null);
  const [closeFor, setCloseFor] = useState(null);
  const [tick, setTick] = useState(0);
  const bump = () => setTick((v) => v + 1);

  const shifts = useMemo(() => listShifts(), [tick]);
  const active = useMemo(
    () => shiftStores.map((s) => ({ store: s, shift: activeShift(s.id) })),
    [tick]
  );

  const storeName = (id) => demoStores.find((s) => s.id === id)?.name ?? "—";

  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight mb-7">{t("Smenalar")}</h1>

      {/* Har do'kon uchun joriy holat */}
      <div className="grid grid-cols-2 gap-5 mb-7">
        {active.map(({ store, shift }) => {
          const s = shift ? shiftSummary(shift) : null;
          return (
            <div key={store.id} className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="w-3.5 h-3.5 rounded-full" style={{ background: store.color }} />
                  <p className="text-lg font-extrabold">{store.name}</p>
                </div>
                <span className={`flex items-center gap-1.5 text-sm font-bold px-3 py-1 rounded-lg ${
                  shift ? "bg-ok-soft text-ok" : "bg-track text-muted"}`}>
                  {shift ? <Unlock size={14} /> : <Lock size={14} />}
                  {shift ? t("Ochiq") : t("Yopiq")}
                </span>
              </div>

              {shift ? (
                <>
                  <div className="bg-surface rounded-2xl p-4 mb-4 space-y-1.5 text-[0.9375rem]">
                    <div className="flex justify-between font-semibold">
                      <span className="text-muted">{t("Ochilgan")}</span>
                      <span className="font-bold">{fmtTime(shift.openedAt)} · {shift.cashier}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span className="text-muted">{t("Naqd sotuvlar")}</span>
                      <span className="font-bold">{fmtUSD(s.salesCash)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span className="text-muted">{t("Payme sotuvlar")}</span>
                      <span className="font-bold">{fmtUSD(s.salesPayme)}</span>
                    </div>
                    {s.salesCard > 0 && (
                      <div className="flex justify-between font-semibold">
                        <span className="text-muted">{t("Karta sotuvlar")}</span>
                        <span className="font-bold">{fmtUSD(s.salesCard)}</span>
                      </div>
                    )}
                    <div className="border-t border-dashed border-line pt-1.5 mt-1.5 flex justify-between font-semibold">
                      <span className="text-muted">{t("Kassada bo'lishi kerak")}</span>
                      <span className="font-extrabold">{fmtUSD(s.expectedCash)}</span>
                    </div>
                  </div>
                  <button onClick={() => setCloseFor({ shift, store })}
                    className="w-full rounded-xl bg-brand hover:bg-brand-dark text-white font-bold py-3">
                    {t("Smenani yopish")}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-muted font-semibold mb-4">{t("Smena ochilmagan")}</p>
                  <button onClick={() => setOpenFor(store)}
                    className="w-full rounded-xl border border-line font-bold py-3 hover:bg-surface">
                    {t("Smenani ochish")}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <h2 className="text-2xl font-extrabold mb-4">{t("Smenalar tarixi")}</h2>
      <div className="card overflow-hidden">
        <table className="w-full text-[0.9375rem]">
          <thead>
            <tr className="text-left text-muted text-sm border-b border-line">
              <th className="px-6 py-4 font-bold">{t("Smena")}</th>
              <th className="px-4 py-4 font-bold">{t("Do'kon")}</th>
              <th className="px-4 py-4 font-bold">{t("Kassir")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Tushum")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Kutilgan naqd")}</th>
              <th className="px-4 py-4 font-bold text-right">{t("Sanalgan")}</th>
              <th className="px-6 py-4 font-bold text-right">{t("Farq")}</th>
            </tr>
          </thead>
          <tbody>
            {shifts.filter((sh) => sh.closedAt).map((sh) => {
              const s = shiftSummary(sh);
              return (
                <tr key={sh.id} className="border-b border-line last:border-0 hover:bg-surface/70">
                  <td className="px-6 py-4">
                    <p className="font-bold">{sh.no}</p>
                    <p className="text-sm text-muted">
                      {fmtDay(sh.openedAt)} · {fmtTime(sh.openedAt)}–{fmtTime(sh.closedAt)}
                    </p>
                  </td>
                  <td className="px-4 py-4 font-semibold">{storeName(sh.storeId)}</td>
                  <td className="px-4 py-4 font-semibold text-muted">{sh.cashier}</td>
                  <td className="px-4 py-4 text-right font-extrabold">{fmtUSD(s.revenue)}</td>
                  <td className="px-4 py-4 text-right font-semibold text-muted">{fmtUSD(s.expectedCash)}</td>
                  <td className="px-4 py-4 text-right font-semibold">{fmtUSD(sh.countedCash)}</td>
                  <td className="px-6 py-4 text-right font-extrabold">
                    {s.diff === 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-ok">
                        <CheckCircle2 size={16} /> {t("To'g'ri")}
                      </span>
                    ) : s.diff > 0 ? (
                      <span className="text-warn">+{fmtUSD(s.diff)}</span>
                    ) : (
                      <span className="text-danger">−{fmtUSD(Math.abs(s.diff))}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {openFor && (
        <OpenShiftModal store={openFor} cashier={demoUser.name}
          onClose={() => setOpenFor(null)}
          onOpen={(cash) => {
            openShift({ storeId: openFor.id, cashier: demoUser.name, openingCash: cash });
            setOpenFor(null); bump();
          }} />
      )}
      {closeFor && (
        <CloseShiftModal shift={closeFor.shift} store={closeFor.store}
          onClose={() => setCloseFor(null)}
          onCloseShift={(counted, note) => {
            closeShift(closeFor.shift.id, counted, note);
            setCloseFor(null); bump();
          }} />
      )}
    </div>
  );
}
