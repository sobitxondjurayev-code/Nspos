"use client";
import { t, tt } from "@/lib/i18n";
import BillzMuhr from "@/components/BillzMuhr";
import { useMemo, useState } from "react";
import { Search, Wallet, ArrowDownToLine, ArrowUpFromLine, CheckCircle2 } from "lucide-react";
import { fmtUSD } from "@/lib/demoData";
import { listCustomers } from "@/lib/customersData";
import { debtorRowsDavr, jamiQarz, debtCollections, jadvalHozirgiQarz } from "@/lib/debtsData";
import { billzVaqtMatni } from "@/lib/billzLogData";
import { addOperation } from "@/lib/financeData";
import DebtPaymentModal from "@/components/DebtPaymentModal";
import StatCard from "@/components/finance/StatCard";
import { useLive } from "@/components/DataProvider";
import DataTable from "@/components/ui/DataTable";
import Button from "@/components/ui/Button";
import PeriodPicker, { usePeriod } from "@/components/ui/PeriodPicker";

// ══════════════════════════════════════════════════════════════
// QARZDORLIK — davr bo'yicha oqim + hozirgi holat
// ══════════════════════════════════════════════════════════════
// Rahbar (2026-09-03): davr tanlansa HAMMA ustun o'sha davr bo'yicha
// (CLAUDE.md 2026-08-06). Lekin "Jami qarzdorlik" — Billz "Jami qarz",
// HOZIRGI holat (DAFTAR 17), davrga bog'liq emas. Shuning uchun ikki
// tur ustun ALOHIDA nomlanadi va sarlavhasida ko'rinib turadi:
//   davr:   Berilgan · To'langan · Ochilgan · Yopilgan  (createdAt /
//           to'lov sanasi / closedAt davr ichida)
//   hozir:  Hozirgi qarzi · Eng eski
// Qator — davrda harakati bor YOKI hozir ochiq qarzi bor mijoz.
export default function FinanceDebts() {
  const [q, setQ] = useState("");
  const [payFor, setPayFor] = useState(null);
  const [tick, setTick] = useState(0);
  const live = useLive();
  const davr = usePeriod("Oy");

  // QARZ BO'YICHA, mijoz bo'yicha emas: mijozi bog'lanmagan qarz
  // "Ro'yxatdan o'tmagan mijozlar" qatoriga yig'iladi (`debtorRowsDavr`).
  const hamma = useMemo(
    () => debtorRowsDavr(davr.range.from, davr.range.to),
    [davr.range, tick, live]
  );
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const digits = s.replace(/\D/g, "");
    return hamma.filter(({ customer: c }) =>
      !s || c.name.toLowerCase().includes(s) || (digits && String(c.phone ?? "").replace(/\D/g, "").includes(digits)));
  }, [q, hamma]);

  // Jami qarzdorlik — Billz "Jami qarz" bilan bir xil ta'rif
  // (`jamiQarz`): Balans, Hisobotlar va API ham shu funksiyani o'qiydi.
  const jami = useMemo(() => jamiQarz(), [tick, live]);
  // Davrda to'langan — pul oqimi va balans bilan BITTA funksiya
  const tolangan = useMemo(() => debtCollections(davr.range.from, davr.range.to), [davr.range, tick, live]);
  const berilgan = useMemo(() => ({
    summa: +hamma.reduce((a, r) => a + r.berilgan, 0).toFixed(2),
    soni: hamma.reduce((a, r) => a + r.berilganSoni, 0),
  }), [hamma]);
  const yopilgan = useMemo(() => hamma.reduce((a, r) => a + r.yopilganSoni, 0), [hamma]);
  const overdue = hamma.filter((r) => r.oldestOpenDays > 30).length;
  const billz = billzVaqtMatni(jami.billzVaqti) ?? "—";

  function handlePaid({ amount, method, customerId }) {
    const c = listCustomers().find((x) => x.id === customerId);
    addOperation({
      category: "debt", amount, method,
      note: tt("{name} qarz to'lovi", { name: c?.name ?? "" }), customerId,
    });
    setTick((v) => v + 1);
  }

  const hozir = (s) => `${t(s)} · ${t("hozir")}`;

  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight mb-7">{t("Qarzdorlik")}</h1>
      <BillzMuhr entity="debts" className="mb-4" />

      <PeriodPicker {...davr} />

      {/* Snapshot kartochkalari "hozir" deb belgilanadi — davr almashganda
          ular o'zgarmaydi, chunki Billz "Jami qarz" hozirgi holat */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-5 mb-6">
        <StatCard icon={Wallet} label={hozir("Jami qarzdorlik")} tone="red" value={fmtUSD(jami.jami)}
          hint={tt("{n} ta qarz · Billz: {v}", { n: jami.soni, v: billz })} />
        <StatCard icon={Wallet} label={hozir("30 kundan oshgan")} tone="amber" value={tt("{n} ta", { n: overdue })}
          hint={t("Muddati o'tgan qarzdorlar")} />
        <StatCard icon={ArrowUpFromLine} label="Davrda berilgan" tone="red" value={fmtUSD(berilgan.summa)}
          hint={tt("{n} ta yangi qarz", { n: berilgan.soni })} />
        <StatCard icon={ArrowDownToLine} label="Davrda to'langan" tone="green" value={fmtUSD(tolangan.total)}
          hint={tt("{n} ta to'lov", { n: tolangan.count })} />
        <StatCard icon={CheckCircle2} label="Davrda yopilgan" tone="green" value={tt("{n} ta", { n: yopilgan })}
          hint={t("To'liq to'langan qarzlar")} />
      </div>

      <div className="card flex items-center gap-3 px-4 mb-5">
        <Search size={20} className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={t("Qarzdorni ism yoki telefon bo'yicha qidirish...")}
          className="w-full py-3.5 outline-none font-semibold bg-transparent" />
      </div>

      {/* Jadval standarti `DataTable` da: sarlavha pin, chap ustun pin,
          "Jami", saralash, "Ustunlar", Excel — hammasi o'zi bo'ladi.
          Jami "Hozirgi qarzi" xom yig'indidan (DAFTAR 17.4), moslik
          `qarz-jadval` uni kartochka bilan solishtiradi. */}
      <DataTable
        id="finance-debts-davr"
        name={t("Qarzdorlik")}
        rows={rows}
        rowKey={(r) => r.customer.id}
        count={rows.length}
        boshSort={{ key: "hozirgiQarz", dir: "desc" }}
        minWidth="62rem"
        empty={{ icon: Wallet, title: "Bu davrda harakat yo'q",
                 hint: "Davrni kengaytiring yoki Billz'dan qarzlarni yangilang" }}
        columns={[
          {
            key: "nom", label: "Qarzdor", locked: true,
            value: (r) => r.customer.name,
            cell: (r) => (
              <>
                <p className="font-bold">{r.customer.name}</p>
                <p className="text-sm text-muted">{r.customer.phone}</p>
              </>
            ),
          },
          {
            key: "hozirgiQarz", label: "Hozirgi qarzi", right: true,
            hint: "Billz \"Jami qarz\" — hozirgi holat, davrga bog'liq emas",
            value: (r) => r.hozirgiQarz,
            cell: (r) => (r.hozirgiQarz > 0
              ? <span className="font-extrabold text-danger">{fmtUSD(r.hozirgiQarz)}</span>
              : <span className="text-faint">—</span>),
            total: (rs) => <span className="text-danger">{fmtUSD(jadvalHozirgiQarz(rs))}</span>,
          },
          {
            key: "kun", label: "Eng eski", right: true,
            hint: "Eng eski ochiq qarz necha kunlik — hozirga nisbatan",
            value: (r) => r.oldestOpenDays,
            cell: (r) => (r.oldestOpenDays > 0
              ? <span className={`font-bold ${r.oldestOpenDays > 30 ? "text-danger" : "text-warn"}`}>
                  {tt("{n} kun", { n: r.oldestOpenDays })}
                </span>
              : <span className="text-faint">—</span>),
          },
          {
            key: "berilgan", label: "Davrda berilgan", right: true,
            hint: "Tanlangan davrda ochilgan qarzlar summasi",
            value: (r) => r.berilgan,
            cell: (r) => (r.berilgan > 0 ? <span className="font-bold text-danger">{fmtUSD(r.berilgan)}</span> : <span className="text-faint">—</span>),
            total: (rs) => <span className="text-danger">{fmtUSD(rs.reduce((a, r) => a + r.berilgan, 0))}</span>,
          },
          {
            key: "tolangan", label: "Davrda to'langan", right: true,
            hint: "Tanlangan davrda tushgan to'lovlar (tovar qaytarish sanalmaydi)",
            value: (r) => r.tolangan,
            cell: (r) => (r.tolangan > 0 ? <span className="font-bold text-ok">{fmtUSD(r.tolangan)}</span> : <span className="text-faint">—</span>),
            total: (rs) => <span className="text-ok">{fmtUSD(rs.reduce((a, r) => a + r.tolangan, 0))}</span>,
          },
          {
            key: "ochilgan", label: "Ochilgan", right: true,
            hint: "Davrda ochilgan qarzlar soni",
            value: (r) => r.berilganSoni,
            cell: (r) => (r.berilganSoni ? son(r.berilganSoni) : <span className="text-faint">—</span>),
            total: (rs) => son(rs.reduce((a, r) => a + r.berilganSoni, 0)),
          },
          {
            key: "yopilgan", label: "Yopilgan", right: true,
            hint: "Davrda to'liq to'langan (yopilgan) qarzlar soni",
            value: (r) => r.yopilganSoni,
            cell: (r) => (r.yopilganSoni ? <span className="font-bold text-ok">{son(r.yopilganSoni)}</span> : <span className="text-faint">—</span>),
            total: (rs) => son(rs.reduce((a, r) => a + r.yopilganSoni, 0)),
          },
          {
            key: "harakat", label: "Harakat", harakat: true, right: true, width: "8rem",
            cell: (r) => (r.customer.id === "unknown" || r.hozirgiQarz <= 0 ? null : (
              <Button olcham="kichik" korinish="asosiy" onClick={() => setPayFor(r.customer)}>
                To'lash
              </Button>
            )),
          },
        ]}
      />

      {payFor && (
        <DebtPaymentModal customer={payFor} onClose={() => setPayFor(null)} onPaid={handlePaid} />
      )}
    </div>
  );
}

const son = (n) => Number(n).toLocaleString("ru-RU");
