"use client";
import { t, tt } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { X, Wallet } from "lucide-react";
import NumberField from "@/components/NumberField";
import DateField from "@/components/DateField";
import { fmtUSD } from "@/lib/demoData";
import { KASSAS, WALLETS, kassaIds, walletsOf, COMPANY } from "@/lib/kassaData";
import { PAYOUT_CATEGORIES } from "@/lib/payoutsData";
import { getUsdRate } from "@/lib/companyData";

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Rahbarning daftaridagi bitta qator: kimga, qancha, qachon.
// Valyuta tanlanadi — import va tovar dollarda, ish haqi so'mda
// o'ylanadi. Ichkarida baribir dollarda saqlanadi, so'm esa kiritilgani
// bo'yicha yoziladi (keyin kurs o'zgarsa eski reja o'zgarmasin).
// dueDate — yangi to'lov uchun oldindan qo'yiladigan sana (jadvalda
// kun ustidan ochilganda o'sha kun qo'yiladi, qayta tanlash shart emas)
export default function PayoutModal({ initial = null, dueDate: preset = null, balances = {}, onClose, onSave }) {
  const rate = getUsdRate();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [cur, setCur] = useState(initial?.amountSom != null ? "som" : "usd");
  const [amount, setAmount] = useState(
    initial ? String(initial.amountSom != null ? initial.amountSom : initial.amount) : ""
  );
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? preset ?? iso(new Date()));
  const [kassa, setKassa] = useState(initial?.kassa ?? COMPANY);
  const [wallet, setWallet] = useState(initial?.wallet ?? "cash");
  const [category, setCategory] = useState(initial?.category ?? "goods");
  const [note, setNote] = useState(initial?.note ?? "");

  const kassas = useMemo(() => kassaIds(), []);
  const wallets = useMemo(() => walletsOf(kassa), [kassa]);
  const activeWallet = wallets.includes(wallet) ? wallet : "cash";

  const raw = Number(amount) || 0;
  const inSom = cur === "som";
  const amt = inSom ? (rate ? +(raw / rate).toFixed(2) : 0) : +raw.toFixed(2);
  const have = balances?.[kassa]?.[activeWallet] ?? 0;

  const valid = !!title.trim() && amt > 0 && !!dueDate && (!inSom || !!rate);

  function save() {
    onSave({
      title: title.trim(),
      amount: amt,
      // So'mda kiritilgan bo'lsa aynan kiritilgan raqam saqlanadi
      amountSom: inSom ? raw : null,
      rateUsed: inSom ? rate : null,
      dueDate, kassa, wallet: activeWallet, category, note: note.trim(),
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-overlay/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-8 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-extrabold">
            {t(initial ? "To'lovni tahrirlash" : "Yangi to'lov rejasi")}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={22} /></button>
        </div>

        <label className="block text-sm font-bold mb-2">{t("Kimga to'lanadi")} *</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus
          className="inp mb-4" placeholder={t("Ism, firma yoki maqsad")} />

        <label className="block text-sm font-bold mb-2">{t("Summa")} *</label>
        <div className="flex gap-2 mb-2">
          {[{ k: "usd", lbl: "USD" }, { k: "som", lbl: "so'm" }].map(({ k, lbl }) => (
            <button key={k} onClick={() => { setCur(k); setAmount(""); }}
              className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${
                cur === k ? "border-brand bg-brand-soft text-brand" : "border-line hover:border-brand"}`}>
              {t(lbl)}
            </button>
          ))}
        </div>
        <NumberField value={amount === "" ? null : Number(amount)} allowEmpty
          onChange={(v) => setAmount(v == null ? "" : String(v))}
          className="inp mb-1" placeholder="0.00" />
        {inSom && (
          <p className={`text-sm font-semibold mb-4 ${rate ? "text-muted" : "text-danger"}`}>
            {rate
              ? (raw > 0
                  ? tt("≈ {n} USD · kurs {r} so'm", { n: amt.toFixed(2), r: Math.round(rate).toLocaleString("ru-RU") })
                  : tt("Kurs {r} so'm bo'yicha dollarga o'giriladi", { r: Math.round(rate).toLocaleString("ru-RU") }))
              : t("Kurs olinmagan — so'mda saqlab bo'lmaydi. Sozlamalarda valyuta kursini yoqing.")}
          </p>
        )}
        {!inSom && rate && raw > 0 && (
          <p className="text-sm text-muted font-semibold mb-4">
            {tt("≈ {s} so'm", { s: Math.round(raw * rate).toLocaleString("ru-RU") })}
          </p>
        )}
        {(!inSom && (!rate || raw <= 0)) && <div className="mb-4" />}

        <label className="block text-sm font-bold mb-2">{t("Qachon to'lanadi")} *</label>
        <DateField value={dueDate} onChange={setDueDate} className="mb-4" />

        <label className="block text-sm font-bold mb-2">{t("Nima uchun")}</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="inp mb-4">
          {Object.entries(PAYOUT_CATEGORIES).map(([k, lbl]) => (
            <option key={k} value={k}>{t(lbl)}</option>
          ))}
        </select>

        <label className="block text-sm font-bold mb-2">{t("Qaysi kassadan")}</label>
        <select value={kassa} onChange={(e) => setKassa(e.target.value)} className="inp mb-3">
          {kassas.map((k) => (
            <option key={k} value={k}>{t(KASSAS[k]?.label ?? k)}</option>
          ))}
        </select>

        <div className={`grid gap-2 mb-1 ${wallets.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
          {wallets.map((w) => (
            <button key={w} onClick={() => setWallet(w)}
              className={`rounded-xl py-2.5 text-sm font-bold border transition-colors ${
                activeWallet === w ? "border-brand bg-brand-soft text-brand" : "border-line hover:border-brand"}`}>
              {t(WALLETS[w])}
            </button>
          ))}
        </div>
        {/* Pul yetishmasligi taqiq emas — reja kelajakka yoziladi, o'sha
            kungacha pul tushishi mumkin. Lekin ko'rinib tursin. */}
        <p className={`text-sm font-semibold mb-5 flex items-center gap-1.5 ${
          amt > have ? "text-warn" : "text-muted"}`}>
          <Wallet size={15} />
          {amt > have
            ? tt("Hozir bu hamyonda {n} bor — yetmaydi, lekin reja qolaveradi", { n: fmtUSD(have) })
            : tt("Hozir bu hamyonda: {n}", { n: fmtUSD(have) })}
        </p>

        <label className="block text-sm font-bold mb-2">{t("Izoh")}</label>
        <input value={note} onChange={(e) => setNote(e.target.value)}
          className="inp mb-7" placeholder={t("Ixtiyoriy")} />

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-line font-bold py-3 hover:bg-surface">
            {t("Bekor qilish")}
          </button>
          <button disabled={!valid} onClick={save}
            className="flex-1 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold py-3 disabled:opacity-50">
            {t("Saqlash")}
          </button>
        </div>
      </div>
    </div>
  );
}
