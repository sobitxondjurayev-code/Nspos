"use client";
import { t } from "@/lib/i18n";
import { useState } from "react";
import { X, Star } from "lucide-react";

// NPS baho qo'shish/tahrirlash oynasi.
// Mijoz, telefon, qaysi usta o'rnatgani, 1–10 baho va izoh.
export default function NpsModal({ installers = [], initial = null, onClose, onSave }) {
  const isEdit = !!initial;
  const today = new Date().toISOString().slice(0, 10);
  const [customerName, setCustomerName] = useState(initial?.customerName ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [installerId, setInstallerId] = useState(initial?.installerId ?? (installers[0]?.id ?? ""));
  const [installedDate, setInstalledDate] = useState(initial?.installedDate ?? today);
  const [score, setScore] = useState(initial?.score ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [productScore, setProductScore] = useState(initial?.productScore ?? 0);
  const [productComment, setProductComment] = useState(initial?.productComment ?? "");

  const valid = customerName.trim() && installerId && score >= 1 && score <= 10;

  function save() {
    onSave({
      customerName: customerName.trim(), phone: phone.trim(),
      installerId, installedDate: installedDate || null,
      score, comment: comment.trim(),
      productScore: productScore || null, productComment: productComment.trim(),
    });
  }

  const scoreColor = (n) =>
    n <= 5 ? "bg-danger text-white border-danger"
      : n <= 7 ? "bg-warn text-white border-warn"
      : "bg-ok text-white border-ok";

  return (
    <div className="fixed inset-0 z-50 bg-overlay/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-8 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-extrabold">{t(isEdit ? "Bahoni tahrirlash" : "NPS baho qo'shish")}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={22} /></button>
        </div>

        <label className="block text-sm font-bold mb-2">{t("Mijoz ismi")}</label>
        <input value={customerName} onChange={(e) => setCustomerName(e.target.value)}
          className="inp mb-4" placeholder={t("F.I.O")} autoFocus />

        <label className="block text-sm font-bold mb-2">{t("Telefon raqami")}</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel"
          className="inp mb-4" placeholder="+998 90 123 45 67" />

        <label className="block text-sm font-bold mb-2">{t("Qaysi usta o'rnatgan")}</label>
        <select value={installerId} onChange={(e) => setInstallerId(e.target.value)} className="inp mb-4">
          {installers.length === 0 && <option value="">{t("Usta yo'q")}</option>}
          {installers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <label className="block text-sm font-bold mb-2">{t("O'rnatilgan sana")}</label>
        <input type="date" value={installedDate} onChange={(e) => setInstalledDate(e.target.value)}
          className="inp mb-1" />
        <p className="text-sm text-muted font-semibold mb-4">
          {t("Kamera qaysi kuni o'rnatilgan. To'ldirilgan sana avtomat yoziladi.")}
        </p>

        {/* Usta bahosi — reyting shu baho bo'yicha hisoblanadi */}
        <label className="block text-sm font-bold mb-2">{t("Usta bahosi (1–10)")}</label>
        <div className="grid grid-cols-10 gap-1.5 mb-3">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button key={n} onClick={() => setScore(n)}
              className={`h-11 rounded-lg border-2 font-extrabold transition-colors ${
                score === n ? scoreColor(n) : "border-line text-muted hover:border-brand"}`}>
              {n}
            </button>
          ))}
        </div>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2}
          className="inp mb-6 resize-none" placeholder={t("Usta izohi — o'rnatish sifati, xushmuomilalik...")} />

        {/* Mahsulot bahosi — kamera/mahsulotdan mamnunlik */}
        <label className="block text-sm font-bold mb-2">{t("Mahsulot bahosi (1–10)")}</label>
        <div className="grid grid-cols-10 gap-1.5 mb-3">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button key={n} onClick={() => setProductScore(productScore === n ? 0 : n)}
              className={`h-11 rounded-lg border-2 font-extrabold transition-colors ${
                productScore === n ? scoreColor(n) : "border-line text-muted hover:border-brand"}`}>
              {n}
            </button>
          ))}
        </div>
        <textarea value={productComment} onChange={(e) => setProductComment(e.target.value)} rows={2}
          className="inp mb-6 resize-none" placeholder={t("Mahsulot izohi — kamera sifati, ishlashi...")} />

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-line font-bold py-3 hover:bg-surface">
            {t("Bekor qilish")}
          </button>
          <button disabled={!valid} onClick={save}
            className="flex-1 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold py-3 disabled:opacity-50">
            {t(isEdit ? "Saqlash" : "Qo'shish")}
          </button>
        </div>
      </div>
    </div>
  );
}
