"use client";
import { t, tt } from "@/lib/i18n";
import { useState } from "react";
import { X, Banknote, Wallet, Smartphone, PiggyBank } from "lucide-react";
import { fmtUSD } from "@/lib/demoData";

export default function PaymentModal({ total, customer, onClose, onConfirm }) {
  const [cash, setCash] = useState("");
  const [card, setCard] = useState("");
  // Payme — Billz'da faol ishlatiladigan to'lov turi
  const [payme, setPayme] = useState("");
  // Balansdan — mijozning oldindan qoldirgan puli
  const [fromBalance, setFromBalance] = useState("");
  const [debt, setDebt] = useState("");

  const cashN = Number(cash) || 0;
  const cardN = Number(card) || 0;
  const paymeN = Number(payme) || 0;
  // Balansdan mijozdagi mavjud summadan ortiq yechib bo'lmaydi
  const availableBalance = customer?.balance ?? 0;
  const balanceN = customer ? Math.min(Number(fromBalance) || 0, availableBalance) : 0;
  // Qarzga faqat mijoz tanlangan bo'lsa yozish mumkin
  const debtN = customer ? Math.min(Number(debt) || 0, total) : 0;

  // Qarzga yozilgan qism pul bilan qoplanmaydi
  const mustPay = +(total - debtN).toFixed(2);
  const paid = +(cashN + cardN + paymeN + balanceN).toFixed(2);
  const left = +(mustPay - paid).toFixed(2);
  const change = +Math.max(0, paid - mustPay).toFixed(2);
  const enough = paid + 0.001 >= mustPay;

  // Tez tugmalar: qolgan summani tegishli maydonga to'liq yozadi
  const fillCash = () => { setCash(String(+(mustPay - cardN - paymeN - balanceN).toFixed(2))); };
  const fillPayme = () => { setPayme(String(+(mustPay - cashN - cardN - balanceN).toFixed(2))); };
  // Balansdan yechish: kerakli summa yoki bor summa — qaysi kichigi
  const fillBalance = () => {
    const need = +(mustPay - cashN - cardN - paymeN).toFixed(2);
    setFromBalance(String(Math.max(0, Math.min(need, availableBalance))));
  };
  const fillDebt = () => { setDebt(String(+(total - paid).toFixed(2))); };

  return (
    <div className="fixed inset-0 z-50 bg-overlay/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-extrabold">{t("To'lov")}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={22} /></button>
        </div>

        <div className="bg-surface rounded-2xl px-5 py-4 mb-6">
          <p className="text-sm font-bold text-muted">{t("To'lanishi kerak")}</p>
          <p className="text-3xl font-extrabold mt-1">{fmtUSD(total)}</p>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-2 text-sm font-bold">
              <Banknote size={17} className="text-brand" /> {t("Naqd (USD)")}
            </label>
            <button onClick={fillCash} className="text-sm font-bold text-brand hover:underline">{t("To'liq")}</button>
          </div>
          <input type="number" value={cash} onChange={(e) => setCash(e.target.value)}
            className="inp" placeholder="0.00" autoFocus />
        </div>

        {/* Karta olib tashlangan — NScamera'da faqat naqd va Payme ishlatiladi.
            Hisob-kitob mantig'ida `card` maydoni qoldi: eski cheklarda uchraydi. */}

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-2 text-sm font-bold">
              <Smartphone size={17} className="text-brand" /> {t("Payme (USD)")}
            </label>
            <button onClick={fillPayme} className="text-sm font-bold text-brand hover:underline">{t("To'liq")}</button>
          </div>
          <input type="number" value={payme} onChange={(e) => setPayme(e.target.value)}
            className="inp" placeholder="0.00" />
        </div>

        {/* Balansdan — mijozda oldindan to'lov bo'lsa */}
        {availableBalance > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 text-sm font-bold">
                <PiggyBank size={17} className="text-brand" /> {t("Balansdan (USD)")}
              </label>
              <button onClick={fillBalance} className="text-sm font-bold text-brand hover:underline">
                {tt("Balansda {n}", { n: fmtUSD(availableBalance) })}
              </button>
            </div>
            <input type="number" value={fromBalance} onChange={(e) => setFromBalance(e.target.value)}
              className="inp" placeholder="0.00" />
          </div>
        )}

        {/* Qarzga — faqat mijoz tanlanganda */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-2 text-sm font-bold">
              <Wallet size={17} className={customer ? "text-brand" : "text-muted"} /> {t("Qarzga (USD)")}
            </label>
            {customer && (
              <button onClick={fillDebt} className="text-sm font-bold text-brand hover:underline">{t("Qolganini")}</button>
            )}
          </div>
          <input type="number" value={debt} onChange={(e) => setDebt(e.target.value)}
            disabled={!customer} className="inp disabled:bg-surface disabled:text-muted"
            placeholder={customer ? "0.00" : t("Avval mijozni tanlang")} />
          {customer && debtN > 0 && (
            <p className="text-sm font-semibold text-muted mt-2">
              {tt("{name} nomiga {sum} qarz yoziladi", { name: customer.name, sum: fmtUSD(debtN) })}
            </p>
          )}
        </div>

        <div className="border-t border-dashed border-line pt-4 mb-6 space-y-2">
          {debtN > 0 && (
            <div className="flex justify-between font-semibold">
              <span className="text-muted">{t("Pul bilan to'lanadi:")}</span>
              <span className="font-extrabold">{fmtUSD(mustPay)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold">
            <span className="text-muted">{t("Qabul qilindi:")}</span>
            <span className="font-extrabold">{fmtUSD(paid)}</span>
          </div>
          {!enough ? (
            <div className="flex justify-between font-semibold">
              <span className="text-muted">{t("Qoldi:")}</span>
              <span className="font-extrabold text-danger">{fmtUSD(left)}</span>
            </div>
          ) : (
            <div className="flex justify-between font-semibold">
              <span className="text-muted">{t("Qaytim:")}</span>
              <span className="font-extrabold text-ok">{fmtUSD(change)}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-line font-bold py-3 hover:bg-surface">
            {t("Bekor qilish")}
          </button>
          <button disabled={!enough} onClick={() => onConfirm({ cash: cashN, card: cardN, payme: paymeN, fromBalance: balanceN, debt: debtN })}
            className="flex-1 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold py-3 disabled:opacity-50">
            {t("Sotuvni yakunlash")}
          </button>
        </div>
      </div>
    </div>
  );
}
