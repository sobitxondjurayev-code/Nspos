"use client";
import { t, tt } from "@/lib/i18n";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  Upload, FileSpreadsheet, Trash2, ChevronRight, CircleCheck, TriangleAlert,
} from "lucide-react";
import {
  readWorkbook, detectReport, profile, listDatasets, replaceDataset, removeDataset,
} from "@/lib/datasets";

const fmtWhen = (iso) => {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function DataUpload() {
  const fileRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [pending, setPending] = useState(null);   // o'qilgan, lekin saqlanmagan
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  const datasets = listDatasets();

  async function handleFiles(files) {
    setError(null);
    const file = files?.[0];
    if (!file) return;
    try {
      const sheets = await readWorkbook(file);
      if (!sheets.length) { setError(t("Faylda ma'lumot topilmadi")); return; }

      // Billz odatda bitta varaq beradi; ko'p bo'lsa eng kattasini olamiz
      const sheet = sheets.reduce((a, b) => (b.rows.length > a.rows.length ? b : a));
      const report = detectReport(sheet.header);

      setPending({
        fileName: file.name,
        sheetName: sheet.sheetName,
        header: sheet.header,
        rows: sheet.rows,
        report,
        profile: profile(sheet.header, sheet.rows),
      });
    } catch (e) {
      setError(tt("Faylni o'qib bo'lmadi: {m}", { m: e.message }));
    }
  }

  const [saving, setSaving] = useState(false);

  async function confirm() {
    setSaving(true);
    await replaceDataset(pending.report?.id ?? null, {
      name: pending.report?.label ?? pending.sheetName ?? pending.fileName,
      reportId: pending.report?.id ?? null,
      reportLabel: pending.report?.label ?? null,
      header: pending.header,
      rows: pending.rows,
      sheetName: pending.sheetName,
      fileName: pending.fileName,
    });
    setSaving(false);
    setPending(null);
    setTick((v) => v + 1);
  }

  const typeLabel = { money: "pul", number: "raqam", date: "sana", percent: "foiz", text: "matn" };

  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight mb-2">{t("Ma'lumot yuklash")}</h1>
      <p className="text-muted font-semibold mb-7">
        {t("Billz'dan Excel yuklab oling va shu yerga tashlang — tizim uni o'qib, dashboard yasaydi")}
      </p>

      {/* Tashlash maydoni */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        className={`card p-12 text-center cursor-pointer transition-colors mb-6 ${
          drag ? "border-brand bg-brand-soft" : "hover:border-brand"}`}>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
          onChange={(e) => handleFiles(e.target.files)} />
        <span className="w-14 h-14 rounded-2xl bg-brand-soft text-brand flex items-center justify-center mx-auto mb-4">
          <Upload size={26} />
        </span>
        <p className="text-xl font-extrabold mb-1">{t("Excel faylni shu yerga tashlang")}</p>
        <p className="text-muted font-semibold">{t("yoki bosib tanlang · .xlsx, .xls, .csv")}</p>
      </div>

      {error && (
        <div className="card p-5 mb-6 flex items-start gap-3 border-danger/40">
          <TriangleAlert size={20} className="text-danger shrink-0 mt-0.5" />
          <p className="font-semibold">{error}</p>
        </div>
      )}

      {/* Tasdiqlashdan oldingi ko'rinish */}
      {pending && (
        <div className="card p-7 mb-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-2xl font-extrabold mb-1">
                {pending.report?.label ?? t("Notanish hisobot")}
              </h2>
              <p className="text-muted font-semibold">
                {pending.fileName} · {tt("{n} qator", { n: pending.rows.length })} ·{" "}
                {tt("{n} ustun", { n: pending.header.length })}
              </p>
            </div>
            {pending.report ? (
              <span className="flex items-center gap-2 bg-ok-soft text-ok font-bold px-4 py-2 rounded-xl">
                <CircleCheck size={18} /> {t("Tanildi")}
              </span>
            ) : (
              <span className="flex items-center gap-2 bg-warn-soft text-warn font-bold px-4 py-2 rounded-xl">
                <TriangleAlert size={18} /> {t("Tanilmadi — baribir ishlaydi")}
              </span>
            )}
          </div>

          {/* Ustunlar tahlili */}
          <p className="text-sm font-bold text-muted mb-3">{t("Aniqlangan ustunlar")}</p>
          <div className="flex flex-wrap gap-2 mb-6">
            {pending.profile.columns.map((c) => (
              <span key={c.key}
                className={`text-sm font-bold px-3 py-1.5 rounded-lg ${
                  c.type === "money" ? "bg-ok-soft text-ok"
                  : c.type === "date" ? "bg-brand-soft text-brand"
                  : c.type === "number" || c.type === "percent" ? "bg-warn-soft text-warn"
                  : "bg-track text-muted"}`}>
                {c.label}
                <span className="opacity-60 ml-1.5">{t(typeLabel[c.type] ?? c.type)}</span>
              </span>
            ))}
          </div>

          {/* Dastlabki qatorlar */}
          <div className="overflow-auto max-h-[50vh] border border-line rounded-xl mb-6">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-20 text-left text-muted border-b border-line [&>th]:bg-panel">
                  {pending.header.slice(0, 8).map((h) => (
                    <th key={h} className="px-4 py-3 font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pending.rows.slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    {pending.header.slice(0, 8).map((h) => (
                      <td key={h} className="px-4 py-2.5 font-semibold">
                        {String(r[h] ?? "").slice(0, 40)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 justify-end">
            <button onClick={() => setPending(null)}
              className="rounded-xl border border-line font-bold px-6 py-3 hover:bg-surface">
              {t("Bekor qilish")}
            </button>
            <button onClick={confirm} disabled={saving}
              className="rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-6 py-3 disabled:opacity-60">
              {t(saving ? "Saqlanmoqda…" : "Saqlash")}
            </button>
          </div>
        </div>
      )}

      {/* Yuklangan to'plamlar */}
      <h2 className="text-2xl font-extrabold mb-4">{t("Yuklangan hisobotlar")}</h2>

      {datasets.length === 0 ? (
        <div className="card p-10 text-center text-muted font-semibold">
          {t("Hali hech narsa yuklanmagan")}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {datasets.map((d) => (
            <div key={d.id} className="card p-5 flex items-start gap-4">
              <span className="w-11 h-11 rounded-xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
                <FileSpreadsheet size={20} />
              </span>
              <Link href={`/data/${d.id}`} className="flex-1 min-w-0">
                <p className="font-extrabold text-ink truncate">{d.name}</p>
                <p className="text-sm text-muted font-semibold">
                  {tt("{n} qator", { n: d.rowCount ?? d.rows?.length ?? 0 })} · {fmtWhen(d.at)}
                </p>
                <p className="text-sm text-muted truncate">{d.fileName}</p>
              </Link>
              <button onClick={async () => { await removeDataset(d.id); setTick((v) => v + 1); }}
                className="text-muted hover:text-danger shrink-0">
                <Trash2 size={18} />
              </button>
              <Link href={`/data/${d.id}`} className="text-muted hover:text-brand shrink-0">
                <ChevronRight size={20} />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
