"use client";
import { t, tt } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { Wallet, Clock, TriangleAlert, PieChart } from "lucide-react";
import { fmtUSD } from "@/lib/demoData";
import { listDebts, jamiQarz, ochiqQoldiq, muddatiOtganmi } from "@/lib/debtsData";
import { listCustomers } from "@/lib/customersData";
import { billzVaqtMatni } from "@/lib/billzLogData";
import { ymd } from "@/lib/dates";
import { useLive } from "@/components/DataProvider";
import NumberField from "@/components/NumberField";
import DataTable from "@/components/ui/DataTable";

// ══════════════════════════════════════════════════════════════
// QARZDORLAR — JAMI QARZDORLIK VA MUDDAT MATRITSASI
// ══════════════════════════════════════════════════════════════
// Manba: BAZA (`debts` — Billz ko'zgusi, har 5 daqiqada yangilanadi).
// 2026-09-03 gacha Excel "Долги клиентов" yuklamasidan o'qirdi;
// yuklama 24.08 da olib tashlangach sahifa bo'sh qolgan va rahbar
// "tizimda jami qarzdorlik ko'rsatilmayapti" dedi (DAFTAR 17).
//
// "Jami qarzdorlik" — Billz "Jami qarz" bilan BIR XIL ta'rif
// (`debtsData.jamiQarz`): to'liq to'lanmagan qarzlar qoldig'i.
// Kartochka ham, Balans ham, API ham AYNAN shu funksiyani chaqiradi.
// Farq bo'lsa sababi bitta — oxirgi sinxrondan keyingi harakat, va
// o'sha vaqt kartochkada yozib turadi.
//
// Matritsa: har mijoz — bitta qator; ustunlar — to'lov muddatidan
// (Billz `repayment_date`) necha kun O'TGANi bo'yicha guruhlar. Guruh
// kunlarini foydalanuvchi o'zi o'zgartiradi (15/20/30 — uning qarori,
// DAFTAR 7). "Muddati o'tgan" qoidasi kartochka bilan bitta:
// `muddatiOtganmi` — Billz holati `overdue`.

const overdueDays = (due, today) => Math.floor((new Date(today) - new Date(due)) / 86400000);

export default function DebtorsReport() {
  const [q, setQ] = useState("");
  // Uchta chegara — foydalanuvchi o'zgartiradi
  const [cuts, setCuts] = useState([15, 20, 30]);
  const live = useLive();
  const today = ymd(new Date());

  // Guruh ustunlari: [0..c1], [c1+1..c2], [c2+1..c3], [c3+]
  const bucketDefs = useMemo(() => ([
    { label: `${cuts[0]} kungacha`, tone: "text-warn" },
    { label: `${cuts[0] + 1}–${cuts[1]} kun`, tone: "text-warn" },
    { label: `${cuts[1] + 1}–${cuts[2]} kun`, tone: "text-danger" },
    { label: `${cuts[2]}+ kun`, tone: "text-danger" },
  ]), [cuts]);

  const bucketOf = (days) =>
    days <= cuts[0] ? 0 : days <= cuts[1] ? 1 : days <= cuts[2] ? 2 : 3;

  const jami = useMemo(() => jamiQarz(), [live]);

  // —— Mijoz × guruh matritsasi ————————————————————————
  const debtors = useMemo(() => {
    const mijoz = new Map(listCustomers().map((c) => [c.id, c]));
    const map = new Map();

    for (const d of listDebts()) {
      const qoldiq = ochiqQoldiq(d);
      if (!qoldiq) continue;

      // Mijozi bog'lanmagan qarz TASHLANMAYDI — bitta qatorga yig'iladi,
      // aks holda matritsa jamisi kartochka bilan mos kelmaydi.
      const key = d.customerId ?? "unknown";
      const c = d.customerId ? mijoz.get(d.customerId) : null;
      const cur = map.get(key) ?? {
        key,
        name: c?.name ?? (d.customerId ? "Noma'lum mijoz" : "Ro'yxatdan o'tmagan mijozlar"),
        phone: c?.phone ?? "",
        buckets: [0, 0, 0, 0], total: 0, maxOverdue: 0, notDue: 0,
      };
      if (muddatiOtganmi(d, today)) {
        const od = Math.max(1, overdueDays(d.dueDate ?? ymd(d.createdAt), today));
        cur.buckets[bucketOf(od)] += qoldiq;
        cur.total += qoldiq;
        cur.maxOverdue = Math.max(cur.maxOverdue, od);
      } else {
        cur.notDue += qoldiq;
      }
      map.set(key, cur);
    }
    return [...map.values()].filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
  }, [live, cuts, today]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const digits = s.replace(/\D/g, "");
    return debtors.filter((d) => !s || d.name.toLowerCase().includes(s) ||
      (digits && String(d.phone).replace(/\D/g, "").includes(digits)));
  }, [debtors, q]);

  const billz = billzVaqtMatni(jami.billzVaqti);

  return (
    <div>
      {/* Yig'ma kartalar — hammasi `jamiQarz()` dan, Billz bo'linishi bilan */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-4">
        <Karta icon={Wallet} tone="danger" label="Jami qarzdorlik" value={fmtUSD(jami.jami)}
          hint={tt("{n} ta qarz", { n: jami.soni })} />
        <Karta icon={TriangleAlert} tone="danger" label="Muddati o'tgan" value={fmtUSD(jami.muddatiOtgan.summa)}
          hint={tt("{n} ta qarz", { n: jami.muddatiOtgan.soni })} />
        <Karta icon={Clock} tone="ok" label="Muddati kelmagan" value={fmtUSD(jami.muddatiKelmagan.summa)}
          hint={tt("{n} ta qarz", { n: jami.muddatiKelmagan.soni })} />
        <Karta icon={PieChart} tone="warn" label="Qisman to'langan" value={fmtUSD(jami.qismanTolangan.summa)}
          hint={tt("{n} ta qarz", { n: jami.qismanTolangan.soni })} />
      </div>

      {/* Ta'rif va manba OCHIQ yoziladi — raqamga ishonish uchun u
          qayerdan kelgani ko'rinib turishi kerak. */}
      <p className="text-sm text-muted font-semibold mb-6">
        {t("Billz \"Jami qarz\" bilan bir xil ta'rif: to'liq to'lanmagan qarzlar qoldig'i.")}{" "}
        {billz
          ? tt("Billz'dan oxirgi yangilanish: {v}. Farq bo'lsa — shundan keyingi harakat.", { v: billz })
          : t("Billz sinxroni haqida yozuv yo'q.")}
      </p>

      {/* Guruh chegaralari */}
      <div className="card p-6 mb-6">
        <p className="font-extrabold mb-1">{t("Muddat guruhlari (kun)")}</p>
        <p className="text-sm text-muted font-semibold mb-4">
          {t("Qarzning to'lov muddatidan necha kun o'tgani bo'yicha")}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {["Birinchi guruh", "Ikkinchi guruh", "Uchinchi guruh"].map((lbl, i) => (
            <label key={i} className="block">
              <span className="block text-sm font-bold mb-2">{t(lbl)}</span>
              <NumberField value={cuts[i]}
                onChange={(v) => { const next = [...cuts]; next[i] = v; setCuts(next); }} />
            </label>
          ))}
        </div>
      </div>

      <div className="card flex items-center gap-3 px-4 mb-5">
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={t("Nom yoki telefon bo'yicha qidirish...")}
          className="w-full py-3.5 outline-none font-semibold bg-transparent" />
      </div>

      <p className="text-sm text-muted font-semibold mb-4">
        {tt("{n} ta muddati o'tgan qarzdor", { n: shown.length })}
      </p>

      {/* Matritsa: mijoz × muddat guruhi. Muddat guruhlari ro'yxatdan
          yasaladi, ya'ni guruh qo'shilsa ustun ham, "Jami" katagi ham
          o'zi qo'shiladi. */}
      <DataTable
        id="report-debtors"
        name={t("Qarzdorlar")}
        rows={shown}
        rowKey={(d) => d.key}
        count={shown.length}
        limit={300}
        minWidth="56rem"
        boshSort={{ key: "total", dir: "desc" }}
        empty={{ title: "Muddati o'tgan qarzdor yo'q" }}
        columns={[
          { key: "name", label: "Mijoz", locked: true, width: "16rem",
            value: (d) => d.name,
            cell: (d) => (
              <div>
                <p className="font-bold">{d.name}</p>
                {d.phone && <p className="text-sm text-muted">{d.phone}</p>}
              </div>
            ) },
          ...bucketDefs.map((b, i) => ({
            key: `b${i}`, label: b.label, right: true,
            value: (d) => d.buckets[i] ?? 0,
            cell: (d) => (d.buckets[i] > 0
              ? <span className="font-semibold">{fmtUSD(+d.buckets[i].toFixed(2))}</span>
              : <span className="text-muted">—</span>),
            total: (rs) => fmtUSD(+rs.reduce((a, d) => a + (d.buckets[i] ?? 0), 0).toFixed(2)),
          })),
          { key: "notDue", label: "Muddati kelmagan", right: true,
            value: (d) => d.notDue,
            cell: (d) => (d.notDue > 0
              ? <span className="font-semibold text-ok">{fmtUSD(+d.notDue.toFixed(2))}</span>
              : <span className="text-muted">—</span>),
            total: (rs) => fmtUSD(+rs.reduce((a, d) => a + d.notDue, 0).toFixed(2)) },
          { key: "total", label: "Muddati o'tgan jami", right: true,
            cell: (d) => <span className="font-extrabold">{fmtUSD(+d.total.toFixed(2))}</span>,
            total: (rs) => (
              <span className="text-danger">{fmtUSD(+rs.reduce((a, d) => a + d.total, 0).toFixed(2))}</span>
            ) },
        ]}
      />
    </div>
  );
}

const TONE = {
  danger: "bg-danger-soft text-danger",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
};

function Karta({ icon: Icon, tone, label, value, hint }) {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-3">
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${TONE[tone]}`}>
          <Icon size={20} />
        </span>
        <p className="text-sm font-bold text-muted">{t(label)}</p>
      </div>
      <p className={`text-3xl font-extrabold tabular-nums ${tone === "danger" ? "text-danger" : ""}`}>{value}</p>
      {hint && <p className="text-sm text-muted font-semibold mt-1">{hint}</p>}
    </div>
  );
}
