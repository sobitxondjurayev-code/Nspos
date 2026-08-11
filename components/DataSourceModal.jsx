"use client";
import { t, tt } from "@/lib/i18n";
import { useRef, useState } from "react";
import { X, Upload, MapPin, CircleCheck, TriangleAlert } from "lucide-react";
import { readWorkbook, detectReport, profile, replaceDataset } from "@/lib/datasets";
import { findColumn } from "@/lib/analyses";

// Tahlilga kerakli ma'lumotni yangilash oynasi.
//
// Ikki qismdan iborat: YO'RIQNOMA (Billz'ning qayeridan olish) va
// YUKLASH. Yo'riqnoma birinchi turadi — foydalanuvchi ko'pincha
// "qaysi faylni olay?" degan joyda qoladi, "qanday yuklay?" degan
// joyda emas.
export default function DataSourceModal({ analysis, onClose, onDone }) {
  const fileRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const src = analysis.source;

  async function handleFiles(files) {
    setError(null);
    const file = files?.[0];
    if (!file) return;
    try {
      const sheets = await readWorkbook(file);
      if (!sheets.length) { setError(t("Faylda ma'lumot topilmadi")); return; }
      const sheet = sheets.reduce((a, b) => (b.rows.length > a.rows.length ? b : a));

      // Kerakli ustunlar bormi. Har shart bir nechta variantni qabul
      // qiladi: bitta tahlil Billz'ning ikki xil hisobotidan ishlashi
      // mumkin va ularda ustun nomlari farq qiladi.
      const missing = (src.needs ?? [])
        .filter((alts) => !findColumn(sheet.header, alts))
        .map((alts) => alts.join(" yoki "));
      if (missing.length) {
        setError(tt("Bu fayl mos kelmadi — {n} ustuni topilmadi. Yo'riqnomadagi hisobotni yuklang.",
          { n: missing.join("; ") }));
        return;
      }

      setPending({
        fileName: file.name, sheetName: sheet.sheetName,
        header: sheet.header, rows: sheet.rows,
        report: detectReport(sheet.header),
        profile: profile(sheet.header, sheet.rows),
      });
    } catch (e) {
      setError(tt("Faylni o'qib bo'lmadi: {m}", { m: e.message }));
    }
  }

  async function save() {
    setSaving(true);
    // Tahlil qaysi hisobotga tayansa — o'sha nom bilan saqlanadi,
    // shunda keyingi safar eskisi almashtiriladi, ikkilanmaydi
    await replaceDataset(src.reportId, {
      name: src.name,
      reportId: src.reportId,
      reportLabel: pending.report?.label ?? src.name,
      header: pending.header,
      rows: pending.rows,
      sheetName: pending.sheetName,
      fileName: pending.fileName,
    });
    setSaving(false);
    onDone?.();
  }

  return (
    <div className="fixed inset-0 z-50 bg-overlay/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-2xl p-8 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-extrabold mb-1">{t("Ma'lumotni yangilash")}</h2>
            <p className="text-muted font-semibold">{t(analysis.label)}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={22} /></button>
        </div>

        {/* Qayerdan olish */}
        <div className="bg-brand-soft rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={18} className="text-brand" />
            <p className="font-extrabold text-brand">{src.where}</p>
          </div>
          <ol className="space-y-2">
            {src.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-[0.9375rem] font-semibold">
                <span className="w-6 h-6 rounded-lg bg-brand text-white text-sm font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                {t(s)}
              </li>
            ))}
          </ol>
        </div>

        {/* Yuklash */}
        {!pending ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
              drag ? "border-brand bg-brand-soft" : "border-line hover:border-brand"}`}>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={(e) => handleFiles(e.target.files)} />
            <Upload size={26} className="mx-auto text-brand mb-3" />
            <p className="font-extrabold mb-1">{t("Faylni shu yerga tashlang")}</p>
            <p className="text-sm text-muted font-semibold">{t("yoki bosib tanlang")}</p>
          </div>
        ) : (
          <div className="border border-line rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <CircleCheck size={20} className="text-ok" />
              <p className="font-extrabold">{pending.fileName}</p>
            </div>
            <p className="text-muted font-semibold mb-4">
              {tt("{n} qator", { n: pending.rows.length })} ·{" "}
              {tt("{n} ustun", { n: pending.header.length })}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setPending(null)}
                className="flex-1 rounded-xl border border-line font-bold py-3 hover:bg-surface">
                {t("Boshqa fayl")}
              </button>
              <button onClick={save} disabled={saving}
                className="flex-1 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold py-3 disabled:opacity-60">
                {t(saving ? "Saqlanmoqda…" : "Yangilash")}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 mt-5 text-danger">
            <TriangleAlert size={20} className="shrink-0 mt-0.5" />
            <p className="font-semibold">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
