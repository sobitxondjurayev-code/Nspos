"use client";
import { t, tt } from "@/lib/i18n";
import NumberField from "@/components/NumberField";
import { useMemo, useState } from "react";
import { X, ArrowDownLeft, ArrowUpRight, Send } from "lucide-react";
import { fmtUSD } from "@/lib/demoData";
import { KASSAS, WALLETS, KASSA_CATEGORIES, walletsOf, COMPANY } from "@/lib/kassaData";
import { EXPENSE_CATEGORIES, SERVICE_CATEGORIES, needsNote } from "@/lib/expensesData";
import { getUser, expenseCategoriesOf } from "@/lib/auth";
import { getUsdRate, fromSom } from "@/lib/companyData";
import DateField from "@/components/DateField";

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Bitta oyna uch ish uchun: kirim, chiqim va rahbarga o'tkazma.
// `mode` tashqaridan beriladi — o'tkazmada kategoriya so'ralmaydi,
// chunki u xarajat emas, kassadan kassaga ko'chish.
// canIncome — qo'lda KIRIM qilish huquqi. Menejerda yo'q: kassa kirimi
// kunlik jadvaldan avtomat keladi, qo'lda qo'shilsa o'sha pul ikki marta
// sanaladi va raqamni istagancha ko'tarish mumkin bo'lib qoladi.
export default function KassaModal({ kassa, mode = "in", balance, canIncome = true, onClose, onSave }) {
  const [kind, setKind] = useState(canIncome ? mode : (mode === "transfer" ? mode : "out"));
  const wallets = walletsOf(kassa);
  const [wallet, setWallet] = useState("cash");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(null);
  const [date, setDate] = useState(iso(new Date()));
  const [note, setNote] = useState("");

  const isTransfer = kind === "transfer";

  // Chiqim turlari kassaga qarab boshqacha:
  //   kompaniya balansi — rahbarning yirik chiqimlari (import, tovar
  //     keltirish, shaxsiy xarajat, ish haqi)
  //   do'kon kassasi    — do'konning kundalik xarajatlari (ijara,
  //     internet, tushlik, mashina gazi…), va faqat rahbar o'sha
  //     xodimga ruxsat berganlari
  const cats = useMemo(() => {
    if (kind !== "out") return KASSA_CATEGORIES.in;
    if (kassa === COMPANY) return KASSA_CATEGORIES.out;
    const allowed = expenseCategoriesOf(getUser());
    const hasService = wallets.includes("service");
    return Object.fromEntries(
      Object.entries(EXPENSE_CATEGORIES)
        .filter(([k]) => !allowed || allowed.includes(k))
        .filter(([k]) => hasService || !SERVICE_CATEGORIES.includes(k))
        .map(([k, c]) => [k, c.label])
    );
  }, [kind, kassa, wallets.join()]);
  // Ro'yxat kassaga/turga qarab o'zgaradi — tanlangan tur ro'yxatdan
  // tushib qolsa, birinchisiga qaytariladi
  const catKeys = Object.keys(cats);
  const activeCat = category && catKeys.includes(category) ? category : catKeys[0];

  // Servis materiallari faqat servis pulidan chiqadi
  const forcedService = kind === "out" && SERVICE_CATEGORIES.includes(activeCat)
    && wallets.includes("service");
  const activeWallet = forcedService ? "service" : (wallets.includes(wallet) ? wallet : "cash");

  // Kassadan CHIQIM so'mda kiritiladi — pul jonli so'mda chiqadi va
  // menejer so'mda o'ylaydi (rahbar qoidasi). Kirim va rahbarga
  // o'tkazma esa hisob valyutasida, dollarda qoladi. Ichkarida
  // hammasi dollarda saqlanadi, shuning uchun so'm shu yerda
  // bugungi kurs bo'yicha o'giriladi.
  const rate = getUsdRate();
  const inSom = kind === "out";
  const raw = Number(amount) || 0;
  // So'mda kiritilganda o'girish companyData.fromSom() zimmasida:
  // u kiritilgan so'm va kursni ham qaytaradi, shunda raqam yo'qolmaydi
  const som = inSom ? fromSom(raw) : null;
  const amt = inSom ? (som?.amount ?? 0) : raw;
  const have = balance?.[activeWallet] ?? 0;
  // Yo'q pulni chiqarib bo'lmaydi — kassa minusga tushsa hisobot yolg'on
  const tooMuch = (kind === "out" || isTransfer) && amt > have;
  // "Boshqa kirim/chiqim"da tur hech narsa aytmaydi — sababi izohda
  // yozilmasa saqlanmaydi. O'tkazmada kategoriya yo'q, shart ham yo'q.
  const noteRequired = !isTransfer && needsNote(activeCat);
  const valid = amt > 0 && !tooMuch && (!inSom || !!rate)
    && (!noteRequired || !!note.trim());

  const title = isTransfer ? "Rahbarga o'tkazish" : kind === "out" ? "Kassadan chiqim" : "Kassaga kirim";

  // Menejerga izoh: kirim qayerdan kelishini bilib tursin
  const incomeNote = !canIncome && !isTransfer;

  // Kirim dollarda, chiqim so'mda — tur almashganda maydon tozalanadi,
  // aks holda "100" bir bosishda 100 $ dan 100 so'mga aylanib qoladi
  const pickKind = (k) => { setKind(k); setCategory(null); setAmount(""); };

  return (
    <div className="fixed inset-0 z-50 bg-overlay/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-8 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-2xl font-extrabold">{t(title)}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={22} /></button>
        </div>
        <p className="text-muted font-semibold mb-2">{t(KASSAS[kassa].label)}</p>
        {incomeNote && (
          <p className="text-sm text-muted font-semibold mb-6 bg-surface rounded-xl px-4 py-3">
            {t("Kassa kirimi kunlik jadvaldan o'zi tushadi — bu yerdan faqat chiqim kiritiladi.")}
          </p>
        )}
        {!incomeNote && <div className="mb-4" />}

        {!isTransfer && canIncome && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            {[
              { k: "in", lbl: "Kirim", icon: ArrowDownLeft },
              { k: "out", lbl: "Chiqim", icon: ArrowUpRight },
            ].map(({ k, lbl, icon: Icon }) => (
              <button key={k} onClick={() => pickKind(k)}
                className={`flex items-center justify-center gap-2 rounded-xl py-3 font-bold border-2 transition-colors ${
                  kind === k
                    ? k === "in" ? "border-ok bg-ok-soft text-ok" : "border-danger bg-danger-soft text-danger"
                    : "border-line hover:border-brand"}`}>
                <Icon size={18} /> {t(lbl)}
              </button>
            ))}
          </div>
        )}

        <p className="text-sm font-bold mb-2">{t("Qaysi hamyondan")}</p>
        <div className={`grid gap-2 mb-1 ${wallets.length === 3 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
          {wallets.map((k) => (
            <button key={k} disabled={forcedService && k !== "service"}
              onClick={() => setWallet(k)}
              className={`rounded-xl py-2.5 text-sm font-bold border transition-colors disabled:opacity-40 ${
                activeWallet === k ? "border-brand bg-brand-soft text-brand" : "border-line hover:border-brand"}`}>
              {t(WALLETS[k])}
            </button>
          ))}
        </div>
        {forcedService && (
          <p className="text-sm text-muted font-semibold mt-1">
            {t("Servis xarajati — puli faqat servis kassasidan chiqadi")}
          </p>
        )}
        <p className="text-sm text-muted font-semibold mb-4">
          {inSom && rate
            ? tt("Hozir hamyonda: {n} ≈ {s} so'm", {
                n: fmtUSD(have), s: Math.round(have * rate).toLocaleString("ru-RU") })
            : tt("Hozir hamyonda: {n}", { n: fmtUSD(have) })}
        </p>

        <label className="block text-sm font-bold mb-2">
          {t(inSom ? "Summa (so'm)" : "Summa (USD)")}
        </label>
        <NumberField value={amount === "" ? null : Number(amount)} allowEmpty autoFocus
          onChange={(v) => setAmount(v == null ? "" : String(v))}
          className="inp mb-1" placeholder="0.00" />
        {inSom && (
          <p className={`text-sm font-semibold mb-1 ${rate ? "text-muted" : "text-danger"}`}>
            {rate
              ? (raw > 0
                  ? tt("≈ {n} USD · kurs {r} so'm", { n: amt.toFixed(2), r: Math.round(rate).toLocaleString("ru-RU") })
                  : tt("Kurs {r} so'm bo'yicha dollarga o'giriladi", { r: Math.round(rate).toLocaleString("ru-RU") }))
              : t("Kurs olinmadi — chiqim saqlanmaydi. Sozlamalar bo'limida valyuta kursini yoqing.")}
          </p>
        )}
        {tooMuch
          ? <p className="text-sm text-danger font-bold mb-4">
              {tt("Hamyonda {n} bor — bundan ko'pini chiqarib bo'lmaydi", { n: fmtUSD(have) })}
            </p>
          : <div className="mb-4" />}

        {!isTransfer && (
          <>
            <label className="block text-sm font-bold mb-2">{t("Nima uchun")}</label>
            <select value={activeCat ?? ""} onChange={(e) => setCategory(e.target.value)} className="inp mb-4">
              {catKeys.map((k) => (
                <option key={k} value={k}>{t(cats[k])}</option>
              ))}
            </select>
          </>
        )}

        <label className="block text-sm font-bold mb-2">{t("Sana")}</label>
        <DateField value={date} onChange={setDate} className="mb-4" />

        <label className="block text-sm font-bold mb-2">
          {t("Izoh")}{noteRequired && <span className="text-danger"> *</span>}
        </label>
        <input value={note} onChange={(e) => setNote(e.target.value)}
          className="inp mb-2"
          placeholder={t(noteRequired ? "Nima uchun ekanini yozing" : "Ixtiyoriy")} />
        {noteRequired && (
          <p className="text-sm text-muted font-semibold mb-3">
            {t("\"Boshqa\" turida izoh majburiy — aks holda hisobotda nimaga ketgani noma'lum summa qolib ketadi.")}
          </p>
        )}

        {isTransfer && (
          <p className="text-sm text-muted font-semibold mb-5">
            {t("O'tkazma darrov kompaniya balansiga tushmaydi — rahbar tasdiqlaguncha \"yo'lda\" turadi.")}
          </p>
        )}
        {!isTransfer && <div className="mb-5" />}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-line font-bold py-3 hover:bg-surface">
            {t("Bekor qilish")}
          </button>
          <button disabled={!valid}
            onClick={() => onSave({
              kind, wallet: activeWallet, amount: amt, category: activeCat, date,
              // Kiritilgan so'm ham beriladi: aks holda ro'yxatda summa
              // dollardan qaytarib hisoblanadi va 10 000 → 9 985 bo'lib
              // ko'rinadi. Xarajatlar oynasida bu allaqachon shunday.
              amountSom: som?.amountSom ?? null,
              rateUsed: som?.rateUsed ?? null,
              note: note.trim(),
            })}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold py-3 disabled:opacity-50">
            {isTransfer ? <><Send size={18} /> {t("O'tkazish")}</> : t("Saqlash")}
          </button>
        </div>
      </div>
    </div>
  );
}
