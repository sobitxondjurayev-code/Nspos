"use client";
import { t, tt } from "@/lib/i18n";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  Upload, FileSpreadsheet, ArrowRight, ArrowLeft, Check, AlertTriangle, X,
} from "lucide-react";
import { demoStores } from "@/lib/demoData";
import {
  parseFile, autoMap, previewImport, runImport, IMPORT_TYPES, fieldLabel,
} from "@/lib/importData";
import { detectReport } from "@/lib/datasets";

const STEPS = ["Fayl", "Tur", "Ustunlar", "Ko'rib chiqish", "Natija"];

export default function FinanceImport() {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [data, setData] = useState(null);          // { columns, rows }
  const [type, setType] = useState("products");
  const [mapping, setMapping] = useState({});
  const [defaultStore, setDefaultStore] = useState(demoStores[0].id);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  // Bu bo'lim tovar/qoldiq/sotuv katalogini to'ldiradi. Hisobot eksporti
  // (ДДС, Эффективность товаров, ABC…) bu yerga emas, "Ma'lumot yuklash"
  // bo'limiga tashlanadi. Nomlar o'xshash bo'lgani uchun adashish oson —
  // shuning uchun fayl tanilsa, darrov aytamiz.
  const [reportFile, setReportFile] = useState(null);
  const inputRef = useRef(null);

  async function onFile(f) {
    if (!f) return;
    setBusy(true); setError(null);
    try {
      const parsed = await parseFile(f);
      if (!parsed.rows.length) {
        setError(t("Faylda ma'lumot topilmadi"));
      } else {
        setFile(f);
        setData(parsed);
        setReportFile(detectReport(parsed.columns ?? []));
        setStep(1);
      }
    } catch (e) {
      setError(t("Faylni o'qib bo'lmadi. Excel (.xlsx) yoki CSV bo'lishi kerak."));
    }
    setBusy(false);
  }

  function chooseType(k) {
    setType(k);
    setMapping(autoMap(data.columns, k));
    setStep(2);
  }

  function goPreview() {
    setPreview(previewImport(type, data.rows, mapping, { defaultStore }));
    setStep(3);
  }

  function apply() {
    setResult(runImport(type, data.rows, mapping, { defaultStore }));
    setStep(4);
  }

  function restart() {
    setStep(0); setFile(null); setData(null); setMapping({}); setReportFile(null);
    setPreview(null); setResult(null); setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const cfg = IMPORT_TYPES[type];
  const missingRequired = cfg.required.filter((f) => !mapping[f]);

  return (
    <div className="max-w-5xl">
      <h1 className="text-4xl font-extrabold tracking-tight mb-2">{t("Billz'dan yuklash")}</h1>
      <p className="text-muted font-semibold mb-7">
        {t("Billz'dan Excel yoki CSV eksport qiling, ustunlarni moslashtiring va yuklang")}
      </p>

      {/* Bosqichlar */}
      <div className="flex items-center gap-2 mb-7">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm ${
              i === step ? "bg-brand text-white"
                : i < step ? "bg-brand-soft text-brand"
                : "bg-track text-muted"}`}>
              {i < step ? <Check size={15} /> : <span>{i + 1}</span>}
              {t(s)}
            </div>
            {i < STEPS.length - 1 && <ArrowRight size={15} className="text-faint" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="card p-5 mb-6 flex items-start gap-3 bg-danger-soft">
          <AlertTriangle size={20} className="text-danger shrink-0 mt-0.5" />
          <p className="font-bold text-danger">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-danger"><X size={18} /></button>
        </div>
      )}

      {/* 1 — Fayl */}
      {step === 0 && (
        <div className="card p-10">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}
            className="border-2 border-dashed border-line rounded-2xl p-14 text-center hover:border-brand transition-colors">
            <Upload size={44} className="text-brand mx-auto mb-4" />
            <p className="text-xl font-extrabold mb-2">
              {busy ? t("O'qilmoqda...") : t("Faylni bu yerga tashlang")}
            </p>
            <p className="text-muted font-semibold mb-6">{t("yoki kompyuterdan tanlang")}</p>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv"
              onChange={(e) => onFile(e.target.files[0])} className="hidden" />
            <button onClick={() => inputRef.current?.click()}
              className="rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-6 py-3">
              {t("Fayl tanlash")}
            </button>
            <p className="text-sm text-muted font-semibold mt-6">
              {t("Qo'llab-quvvatlanadi: .xlsx, .xls, .csv")}
            </p>
          </div>
        </div>
      )}

      {/* 2 — Tur */}
      {step === 1 && data && (
        <div>
          {/* Hisobot eksporti bu bo'limga emas — adashib tashlansa,
              yuklama hech qayerga tushmaydi va odam sababini bilmaydi. */}
          {reportFile && (
            <div className="card p-6 mb-5 bg-warn-soft flex items-start gap-3">
              <AlertTriangle size={22} className="text-warn shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold mb-1">
                  {tt("Bu fayl — \"{n}\" hisoboti", { n: reportFile.label })}
                </p>
                <p className="text-sm font-semibold text-muted mb-2">
                  {t("Hisobot eksportlari bu bo'limga tushmaydi. Bu yer faqat tovar katalogi, qoldiq va cheklar uchun. Hisobotni \"Ma'lumot yuklash\" bo'limiga tashlang — kassalar, balans va tahlillar o'shandan oziqlanadi.")}
                </p>
                <Link href="/data" className="text-brand font-bold text-sm">
                  {t("Ma'lumot yuklash bo'limiga o'tish")} →
                </Link>
              </div>
            </div>
          )}
          <div className="card p-5 mb-5 flex items-center gap-3">
            <FileSpreadsheet size={22} className="text-brand" />
            <div className="flex-1">
              <p className="font-bold">{file?.name}</p>
              <p className="text-sm text-muted font-semibold">
                {tt("{n} qator, {c} ustun", { n: data.rows.length, c: data.columns.length })}
              </p>
            </div>
            <button onClick={restart} className="text-sm font-bold text-muted hover:text-danger">
              {t("Boshqa fayl")}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(IMPORT_TYPES).map(([k, v]) => (
              <button key={k} onClick={() => chooseType(k)}
                className="card p-6 text-left hover:shadow-pop transition-shadow">
                <p className="text-lg font-extrabold mb-2">{t(v.label)}</p>
                <p className="text-sm text-muted font-semibold">{t(v.hint)}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3 — Ustunlar */}
      {step === 2 && data && (
        <div className="card p-7">
          <h2 className="text-xl font-extrabold mb-1">{t("Ustunlarni moslashtiring")}</h2>
          <p className="text-sm text-muted font-semibold mb-6">
            {t("Tanish nomlar avtomatik topildi. Kerak bo'lsa qo'lda o'zgartiring.")}
          </p>

          <div className="space-y-3 mb-6">
            {cfg.fields.map((f) => {
              const req = cfg.required.includes(f);
              return (
                <div key={f} className="grid grid-cols-[220px_1fr] gap-4 items-center">
                  <label className="font-bold text-[0.9375rem]">
                    {t(fieldLabel(f))}
                    {req && <span className="text-danger"> *</span>}
                  </label>
                  <select value={mapping[f] ?? ""} onChange={(e) =>
                    setMapping((m) => ({ ...m, [f]: e.target.value || undefined }))}
                    className={`inp ${req && !mapping[f] ? "border-danger" : ""}`}>
                    <option value="">{t("— ishlatilmaydi —")}</option>
                    {data.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              );
            })}
          </div>

          {(type === "stock" || type === "sales") && (
            <div className="grid grid-cols-[220px_1fr] gap-4 items-center mb-6 pt-5 border-t border-line">
              <label className="font-bold text-[0.9375rem]">{t("Standart do'kon")}</label>
              <div>
                <select value={defaultStore} onChange={(e) => setDefaultStore(e.target.value)} className="inp">
                  {demoStores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <p className="text-sm text-muted font-semibold mt-2">
                  {t("Faylda do'kon ustuni bo'lmasa yoki nomi topilmasa shu do'kon olinadi")}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(1)}
              className="flex items-center gap-2 rounded-xl border border-line font-bold px-5 py-3 hover:bg-surface">
              <ArrowLeft size={18} /> {t("Orqaga")}
            </button>
            <button disabled={missingRequired.length > 0} onClick={goPreview}
              className="flex-1 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold py-3 disabled:opacity-50">
              {missingRequired.length
                ? tt("{f} ustuni tanlanmagan", { f: missingRequired.map(fieldLabel).join(", ") })
                : t("Ko'rib chiqish")}
            </button>
          </div>
        </div>
      )}

      {/* 4 — Ko'rib chiqish */}
      {step === 3 && preview && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
            <div className="card p-6">
              <p className="text-sm font-bold text-muted mb-2">{t("Qo'shiladi")}</p>
              <p className="text-3xl font-extrabold text-ok">{preview.create}</p>
            </div>
            <div className="card p-6">
              <p className="text-sm font-bold text-muted mb-2">{t("Yangilanadi")}</p>
              <p className="text-3xl font-extrabold text-brand">{preview.update}</p>
            </div>
            <div className="card p-6">
              <p className="text-sm font-bold text-muted mb-2">{t("O'tkazib yuboriladi")}</p>
              <p className={`text-3xl font-extrabold ${preview.skip ? "text-warn" : "text-muted"}`}>
                {preview.skip}
              </p>
            </div>
          </div>

          {preview.errors.length > 0 && (
            <div className="card p-6 mb-6">
              <p className="font-extrabold mb-3 flex items-center gap-2 text-warn">
                <AlertTriangle size={18} /> {t("Muammoli qatorlar")}
              </p>
              <div className="space-y-1.5">
                {preview.errors.map((e, i) => (
                  <p key={i} className="text-sm font-semibold text-muted">
                    {tt("{n}-qator", { n: e.line })}: {e.msg}
                  </p>
                ))}
                {preview.skip > preview.errors.length && (
                  <p className="text-sm font-semibold text-muted">
                    {tt("...va yana {n} ta", { n: preview.skip - preview.errors.length })}
                  </p>
                )}
              </div>
            </div>
          )}

          {preview.sample.length > 0 && (
            <div className="card overflow-auto max-h-[70vh] mb-6">
              <p className="font-extrabold px-6 py-4 border-b border-line">{t("Namuna (birinchi qatorlar)")}</p>
              <table className="w-full text-[0.9375rem]">
                <thead>
                  <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-20 text-left text-muted text-sm border-b border-line [&>th]:bg-panel">
                    {Object.keys(preview.sample[0]).map((k) => (
                      <th key={k} className="px-6 py-3 font-bold capitalize">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((s, i) => (
                    <tr key={i} className="border-b border-line last:border-0">
                      {Object.values(s).map((v, j) => (
                        <td key={j} className="px-6 py-3 font-semibold">{String(v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(2)}
              className="flex items-center gap-2 rounded-xl border border-line font-bold px-5 py-3 hover:bg-surface">
              <ArrowLeft size={18} /> {t("Orqaga")}
            </button>
            <button disabled={preview.create + preview.update === 0} onClick={apply}
              className="flex-1 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold py-3 disabled:opacity-50">
              {t("Importni boshlash")}
            </button>
          </div>
        </div>
      )}

      {/* 5 — Natija */}
      {step === 4 && result && (
        <div className="card p-10 text-center">
          <span className="w-16 h-16 rounded-full bg-ok text-white flex items-center justify-center mx-auto mb-5">
            <Check size={32} />
          </span>
          <h2 className="text-2xl font-extrabold mb-6">{t("Import yakunlandi")}</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8 max-w-lg mx-auto">
            <div>
              <p className="text-3xl font-extrabold text-ok">{result.created}</p>
              <p className="text-sm font-bold text-muted">{t("qo'shildi")}</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-brand">{result.updated}</p>
              <p className="text-sm font-bold text-muted">{t("yangilandi")}</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-muted">{result.skipped}</p>
              <p className="text-sm font-bold text-muted">{t("o'tkazib yuborildi")}</p>
            </div>
          </div>

          <button onClick={restart}
            className="rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-6 py-3">
            {t("Yana yuklash")}
          </button>
        </div>
      )}
    </div>
  );
}
