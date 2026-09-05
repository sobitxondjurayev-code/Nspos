"use client";
import { t, tt } from "@/lib/i18n";
import NumberField from "@/components/NumberField";
import { useMemo, useState } from "react";
import { X, Repeat, Calendar, Trash2 } from "lucide-react";
import { EXPENSE_CATEGORIES, EXPENSE_METHODS, SERVICE_CATEGORIES, tannarxgaMi, needsNote, STREET_INSTALLER } from "@/lib/expensesData";
import { KASSAS, kassasOf, walletsOf, isB2bKassa, COMPANY } from "@/lib/kassaData";
import { listStaff } from "@/lib/staffData";
import { getUser, expenseCategoriesOf } from "@/lib/auth";
import { getUsdRate, fromSom } from "@/lib/companyData";
import { MONTHS } from "@/lib/dates";
import DateField from "@/components/DateField";
import { useOyna } from "@/components/ui/Modal";

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// "2026-08" → "Avgust 2026" — maydondagi quruq raqam o'rniga o'qiladigan izoh
const monthName = (v) => {
  if (!v) return "";
  const [y, m] = String(v).split("-");
  return `${MONTHS[Number(m) - 1] ?? m} ${y}`;
};

export default function ExpenseModal({ initial = null, onClose, onSave, onDelete = null }) {
  // Esc bilan yopiladi, fon skrolli qulflanadi (`ui/Modal.jsx`)
  useOyna(onClose);
  // Takrorlanuvchida "from" bor — shu bilan turini aniqlaymiz
  const [mode, setMode] = useState(initial?.from ? "recurring" : "one");
  // Menejer faqat o'z kassasidan xarajat qila oladi, rahbar — hammasidan.
  // Ro'yxat bo'sh bo'lsa (xodimga do'kon biriktirilmagan) forma umuman
  // ochilmaydi: aks holda xarajat kompaniya balansiga yozilib ketardi.
  const allowedKassas = kassasOf(getUser());
  const [kassa, setKassa] = useState(
    initial?.kassa && allowedKassas.includes(initial.kassa)
      ? initial.kassa
      : (allowedKassas.includes("company") ? "company" : allowedKassas[0] ?? null)
  );
  // Xodim faqat rahbar ruxsat bergan turlarni kirita oladi. Ro'yxatga
  // tushmagani umuman ko'rinmaydi — "kiritdim-u, saqlanmadi" degan holat
  // bo'lmasin.
  const allowedCats = useMemo(() => {
    const list = expenseCategoriesOf(getUser());
    // Servis xarajatlari faqat servis hamyoni bor kassada tanlanadi.
    // B2B (optom) kassada servis yo'q — u yerda bu turlar chiqmaydi.
    const hasService = walletsOf(kassa).includes("service");
    const keys = Object.keys(EXPENSE_CATEGORIES)
      .filter((k) => !list || list.includes(k))
      .filter((k) => hasService || !SERVICE_CATEGORIES.includes(k));
    // Tahrirlanayotgan yozuvning turi yopiq bo'lsa ham ko'rinib tursin
    return initial?.category && !keys.includes(initial.category)
      ? [initial.category, ...keys] : keys;
  }, [initial?.category, kassa]);
  const [category, setCategory] = useState(initial?.category ?? allowedCats[0] ?? "other");
  // Do'kon alohida so'ralmaydi — kassa allaqachon aytib turibdi:
  //   do'kon kassasi   → o'sha do'konning xarajati
  //   kompaniya balansi → umumkorxona (hisobotlarda tushum nisbatida
  //                       do'konlarga taqsimlanadi)
  const storeId = kassa === COMPANY ? "all" : kassa;
  // Chiqim HAR DOIM so'mda bo'ladi — rahbar qoidasi. Ilgari bu yerda
  // so'm/USD tugmasi bor edi va kurs olinmagan paytda "Summa (so'm)"
  // deb kiritilgan raqam o'girilmay, o'zi dollar bo'lib saqlanardi
  // (100 000 so'm → 100 000 $). Endi maydon faqat so'm, dollarga esa
  // kiritilgan kundagi kurs bo'yicha o'giriladi — keyin kurs o'zgarsa
  // ham eski xarajat o'zgarmaydi. Ichkarida dollarda saqlanadi,
  // shuning uchun tahrirlashda summa so'mga qaytarib ko'rsatiladi.
  // Tahrirlashda aynan kiritilgan so'm ko'rsatiladi. Eski yozuvlarda u
  // saqlanmagan — ular uchun dollardan qaytarib hisoblanadi (yaxlitlash
  // sababli bir necha so'm farq qilishi mumkin).
  const rate = getUsdRate();
  // So'm yoki dollar. Odatda xarajat so'mda kiritiladi (rahbar qoidasi),
  // lekin import/tovar kabi chiqim dollarda o'ylanadi. Tur almashganda
  // maydon TOZALANADI — aks holda "100 000" bir bosishda 100 000 so'mdan
  // 100 000 dollarga aylanib ketardi (avval shunday xato bo'lgan).
  const [cur, setCur] = useState(initial && initial.amountSom == null ? "usd" : "som");
  const inSom = cur === "som";
  // Tahrirlashda AYNAN kiritilgan raqam ko'rsatiladi: so'mda kiritilgan
  // bo'lsa so'mda, dollarda bo'lsa dollarda. Dollardan so'mga qaytarib
  // hisoblansa 10 000 → 9 985 bo'lib ketardi (companyData.fromSom qoidasi).
  const [amount, setAmount] = useState(
    initial ? String(initial.amountSom ?? initial.amount) : ""
  );
  // Eski yozuvda endi ishlatilmaydigan hamyon bo'lsa (plastik/bank),
  // hech qaysi tugma yonmay qolmasligi uchun naqdga qaytariladi
  const [method, setMethod] = useState(
    initial?.method && EXPENSE_METHODS[initial.method] ? initial.method : "cash"
  );
  const allowedWallets = useMemo(() => walletsOf(kassa), [kassa]);
  // Servis materiallari (mashina gazi, avtol, shurup, samarez, o'rnatish
  // materiali) FAQAT servis pulidan chiqadi — rahbar qoidasi. Shuning
  // uchun bu turlarda hamyon tanlanmaydi, o'zi servisga qotiriladi.
  const forcedService = SERVICE_CATEGORIES.includes(category)
    && allowedWallets.includes("service");
  const wallet = forcedService
    ? "service"
    : (allowedWallets.includes(method) ? method : "cash");
  // Xarajat kimga tegishli. Ro'yxat KASSAGA qarab chiqadi:
  //   optom (B2B) kassa — faqat o'sha do'kon xodimi. Ustalar bu yerda
  //     ishlamaydi, ular servis tomonida.
  //   do'kon (B2C) kassa — o'sha do'kon xodimi + do'koni yo'qlar
  //     (ustalar va retention menejer): xarajat ular uchun qilinadi.
  //   kompaniya balansi — hamma.
  const installers = useMemo(() => {
    const all = listStaff().filter((s) => s.active !== false && s.role !== "owner");
    if (!kassa || kassa === COMPANY) return all;
    if (isB2bKassa(kassa)) return all.filter((s) => s.storeId === kassa);
    return all.filter((s) => s.storeId === kassa || !s.storeId);
  }, [kassa]);
  // Tanlov qiymati: "" — umumiy, "street" — ko'cha ustasi (xodim emas),
  // qolgani xodim id'si
  const [staffId, setStaffId] = useState(
    initial?.staffId ?? (initial?.paidTo ? "street" : ""));
  const isService = SERVICE_CATEGORIES.includes(category);
  // Tovar kelish xarajati (yo'lkira, dostavka) — hamyon QOTIRILMAYDI
  // (istalgan puldan to'lanadi), lekin menejer bu turning boshqacha
  // ekanini bilib turishi kerak: bu pul "xarajat" bo'lib emas,
  // TANNARX bo'lib hisobga tushadi.
  const isTannarx = tannarxgaMi(category);

  const [note, setNote] = useState(initial?.note ?? "");
  const [date, setDate] = useState(initial?.date ?? iso(new Date()));
  const [day, setDay] = useState(String(initial?.day ?? 5));
  const [from, setFrom] = useState(initial?.from ?? iso(new Date()).slice(0, 7));
  const [to, setTo] = useState(initial?.to ?? "");

  // Bazaga 1..28 oralig'ida tushadi — izohda ham aynan shu ko'rsatiladi
  const dayNum = Math.min(28, Math.max(1, Number(day) || 1));
  const raw = Number(amount) || 0;
  // Kurs yo'q bo'lsa umuman saqlanmaydi: so'mni dollarga o'girib
  // bo'lmaydi, raqamni shundoq yozib qo'yish esa hisobotni buzadi
  // Kiritilgan so'm ham saqlanadi — companyData.fromSom() qoidasi
  const som = inSom ? fromSom(raw) : null;
  const amt = inSom ? (som?.amount ?? 0) : +raw.toFixed(2);
  // "Boshqa xarajatlar"da tur hech narsa aytmaydi — nimaga ketgani
  // izohda yozilmasa saqlanmaydi
  const noteRequired = needsNote(category);
  const valid = amt > 0 && (!inSom || !!rate) && !!kassa && (mode === "one" ? !!date : !!from)
    && (!noteRequired || !!note.trim());

  if (!allowedKassas.length) {
    return (
      <div className="fixed inset-0 z-50 bg-overlay/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
        <div className="card w-full max-w-md p-6 sm:p-8 rounded-b-none sm:rounded-2xl max-h-[92vh] overflow-y-auto text-center" onClick={(e) => e.stopPropagation()}>
          <p className="text-xl font-extrabold mb-2">{t("Sizga kassa biriktirilmagan")}</p>
          <p className="text-muted font-semibold mb-6">
            {t("Xarajat qaysi kassadan chiqishi ko'rsatilishi shart. Rahbar Boshqaruv bo'limida sizga do'kon biriktirgach kiritish ochiladi.")}
          </p>
          <button onClick={onClose} className="rounded-xl border border-line font-bold px-6 py-3 hover:bg-surface">
            {t("Yopish")}
          </button>
        </div>
      </div>
    );
  }

  function save() {
    // amount — dollarda (hisobotlar shunda), amountSom/rateUsed esa
    // kiritilgani qanday bo'lsa shundayligicha
    const money = { amount: amt, amountSom: som?.amountSom ?? null, rateUsed: som?.rateUsed ?? null };
    // Ko'cha ustasi xodim emas — id o'rniga ismi matn bo'lib yoziladi
    const who = staffId === "street"
      ? { staffId: null, paidTo: STREET_INSTALLER }
      : { staffId: staffId || null, paidTo: null };
    if (mode === "one") {
      onSave({ kind: "one", data: { date, category, storeId, ...money, ...who, method: wallet, kassa, note: note.trim() } });
    } else {
      onSave({
        kind: "recurring",
        data: { category, storeId, ...money, ...who, method: wallet, kassa, note: note.trim(), day: Number(day) || 1, from, to: to || null },
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-overlay/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-6 sm:p-8 rounded-b-none sm:rounded-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-extrabold">
            {t(initial ? "Xarajatni tahrirlash" : "Yangi xarajat")}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={22} /></button>
        </div>

        {!initial && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            {[
              { k: "one", lbl: "Bir martalik", icon: Calendar },
              { k: "recurring", lbl: "Doimiy (har oy)", icon: Repeat },
            ].map(({ k, lbl, icon: Icon }) => (
              <button key={k} onClick={() => setMode(k)}
                className={`flex items-center justify-center gap-2 rounded-xl py-3 font-bold border-2 transition-colors ${
                  mode === k ? "border-brand bg-brand-soft text-brand" : "border-line hover:border-brand"}`}>
                <Icon size={18} /> {t(lbl)}
              </button>
            ))}
          </div>
        )}

        <label className="block text-sm font-bold mb-2">{t("Kategoriya")}</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="inp mb-4">
          {allowedCats.map((k) => (
            <option key={k} value={k}>{t(EXPENSE_CATEGORIES[k]?.label ?? k)}</option>
          ))}
        </select>

        <label className="block text-sm font-bold mb-2">{t("Summa")}</label>
        <div className="flex gap-2 mb-2">
          {[{ k: "som", lbl: "so'm" }, { k: "usd", lbl: "USD" }].map(({ k, lbl }) => (
            <button key={k} onClick={() => { setCur(k); setAmount(""); }}
              className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${
                cur === k ? "border-brand bg-brand-soft text-brand" : "border-line hover:border-brand"}`}>
              {t(lbl)}
            </button>
          ))}
        </div>
        <NumberField value={amount === "" ? null : Number(amount)} allowEmpty autoFocus
          onChange={(v) => setAmount(v == null ? "" : String(v))}
          className="inp mb-1" placeholder="0.00" />
        {inSom ? (
          <p className={`text-sm font-semibold mb-4 ${rate ? "text-muted" : "text-danger"}`}>
            {rate
              ? (raw > 0
                  ? tt("≈ {n} USD · kurs {r} so'm", { n: amt.toFixed(2), r: Math.round(rate).toLocaleString("ru-RU") })
                  : tt("Kurs {r} so'm bo'yicha dollarga o'giriladi", { r: Math.round(rate).toLocaleString("ru-RU") }))
              : t("Kurs olinmadi — xarajat saqlanmaydi. Sozlamalar bo'limida valyuta kursini yoqing.")}
          </p>
        ) : (
          <p className="text-sm font-semibold mb-4 text-muted">
            {t("Summa dollarda saqlanadi — kurs kerak emas.")}
          </p>
        )}

        {/* Sanalar alohida yumshoq panelda — oldin uchta maydon bir qatorga
            siqilib, oy nomi kesilib qolardi. Endi kun tor maydonda, oylar esa
            yarim kenglikda: "Avgust 2026" to'liq sig'adi. */}
        {mode === "one" ? (
          <div className="rounded-2xl border border-line bg-surface/60 p-5 mb-5">
            <label className="block text-sm font-bold mb-2">{t("Xarajat sanasi")}</label>
            <DateField value={date} onChange={setDate} />
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-surface/60 p-5 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <Repeat size={16} className="text-brand" />
              <p className="text-sm font-extrabold">{t("Doimiy xarajat — har oy o'zi yoziladi")}</p>
            </div>

            <label className="block text-sm font-bold mb-2">{t("To'lov kuni")}</label>
            <div className="flex items-center gap-3 mb-5">
              {/* .inp o'zi w-full — shuning uchun kenglik o'ramchi div'da beriladi */}
              <div className="w-24 shrink-0">
                <input type="number" min="1" max="28" value={day}
                  onChange={(e) => setDay(e.target.value)} className="inp text-center" />
              </div>
              <p className="text-sm text-muted font-semibold">
                {tt("Har oyning {d}-kunida to'lanadi", { d: dayNum })}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold mb-2">{t("Boshlangan oy")}</label>
                <input type="month" value={from} onChange={(e) => setFrom(e.target.value)} className="inp" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold">{t("Tugagan oy")}</label>
                  {to && (
                    <button type="button" onClick={() => setTo("")}
                      className="text-xs font-bold text-brand hover:underline">
                      {t("Tozalash")}
                    </button>
                  )}
                </div>
                <input type="month" value={to} onChange={(e) => setTo(e.target.value)} className="inp" />
              </div>
            </div>
            <p className="text-sm text-muted font-semibold mt-3">
              {to
                ? tt("{a} — {b} oralig'ida har oy hisoblanadi", { a: monthName(from), b: monthName(to) })
                : t("Tugagan oy bo'sh — xarajat hozirgacha davom etadi.")}
            </p>
          </div>
        )}

        {/* Pul qaysi kassadan chiqqani balansga to'g'ridan-to'g'ri ta'sir
            qiladi — shuning uchun hamyondan oldin so'raladi. */}
        <p className="text-sm font-bold mb-2">{t("Qaysi kassadan")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
          {allowedKassas.map((k) => (
            <button key={k} onClick={() => setKassa(k)}
              className={`rounded-xl py-2.5 text-sm font-bold border transition-colors ${
                kassa === k ? "border-brand bg-brand-soft text-brand" : "border-line hover:border-brand"}`}>
              {t(KASSAS[k].label)}
            </button>
          ))}
        </div>

        <p className="text-sm text-muted font-semibold mb-4">
          {kassa === COMPANY
            ? t("Kompaniya xarajati — hisobotlarda do'konlarga tushum nisbatida bo'linadi")
            : t("Xarajat shu do'konga yoziladi")}
        </p>

        <p className="text-sm font-bold mb-2">{t("Qaysi hamyondan")}</p>
        {/* Hamyonlar tanlangan kassaga bog'liq: B2B kassada servis yo'q.
            Servis xarajatida esa hamyon o'zgartirilmaydi. */}
        <div className={`grid gap-2 mb-1 ${allowedWallets.length === 3 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
          {allowedWallets.map((k) => (
            <button key={k} disabled={forcedService && k !== "service"}
              onClick={() => setMethod(k)}
              className={`rounded-xl py-2.5 text-sm font-bold border transition-colors disabled:opacity-40 ${
                wallet === k ? "border-brand bg-brand-soft text-brand" : "border-line hover:border-brand"}`}>
              {t(EXPENSE_METHODS[k])}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted font-semibold mb-4">
          {forcedService
            ? t("Bu tur servis xarajati — puli faqat servis kassasidan chiqadi")
            : "\u00A0"}
        </p>

        {/* —— Qaysi ustaga tegishli ————————————————————
            Mashina gazi, avtol, shurup, samarez ma'lum ustaga ketadi.
            Usta tanlansa, xarajat uning kesimida ham hisoblanadi.
            Ijara/internet kabi umumiy xarajatlarda bo'sh qoladi. */}
        {installers.length > 0 && (
          <>
            <label className="block text-sm font-bold mb-2">
              {t("Kimga")}
              {!isService && <span className="text-muted font-semibold"> · {t("ixtiyoriy")}</span>}
            </label>
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)}
              className={`inp ${isService ? "mb-2" : "mb-7"}`}>
              <option value="">{t("Umumiy — hech kimga bog'liq emas")}</option>
              {/* Ro'yxatda yo'q, chaqirib ishlatiladigan usta */}
              <option value="street">{t(STREET_INSTALLER)}</option>
              {installers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {isService && (
              <p className="text-sm text-muted font-semibold mb-6">
                {t("Bu tur ustaga ketadigan xarajat — kimga ekanini belgilasangiz, kishi kesimidagi hisobda ko'rinadi.")}
              </p>
            )}
          </>
        )}

        {isTannarx && (
          <p className="text-sm font-semibold text-muted bg-surface rounded-xl px-4 py-3 mb-6">
            {t("Bu tur — tovarning o'z narxi: Xarajatlar ro'yxatida ko'rinadi, lekin P&L da \"Xarajat\" emas, TANNARX qatoriga tushadi. Sof foydaga ta'siri bir xil, yalpi marja esa haqiqiy bo'ladi.")}
          </p>
        )}

        <label className="block text-sm font-bold mb-2">
          {t("Izoh")}{noteRequired && <span className="text-danger"> *</span>}
        </label>
        <input value={note} onChange={(e) => setNote(e.target.value)}
          className={`inp ${noteRequired ? "mb-2" : "mb-7"}`}
          placeholder={t(noteRequired ? "Nima uchun ekanini yozing" : "Ixtiyoriy")} />
        {noteRequired && (
          <p className="text-sm font-semibold mb-6 text-muted">
            {t("\"Boshqa\" turida izoh majburiy — aks holda hisobotda nimaga ketgani noma'lum summa qolib ketadi.")}
          </p>
        )}

        <div className="flex gap-3">
          {/* O'chirish shu yerda — xarajatni ochib, "bu keraksiz ekan"
              deb qaror qilinadi. Ro'yxatga qaytib qidirish shart emas. */}
          {onDelete && (
            <button
              onClick={() => { if (confirm(t("Ushbu xarajat o'chirilsinmi?"))) onDelete(); }}
              className="rounded-xl border border-line font-bold px-4 py-3 text-danger hover:border-danger"
              title={t("O'chirish")}>
              <Trash2 size={18} />
            </button>
          )}
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
