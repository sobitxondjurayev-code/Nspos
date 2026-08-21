"use client";
import { t, tt } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, RefreshCw, MapPin, Upload } from "lucide-react";
import { getAnalysis } from "@/lib/analyses";
import { canOpen } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";
import { listDatasets, loadRows } from "@/lib/datasets";
import DataSourceModal from "@/components/DataSourceModal";
import DatasetDashboard from "@/components/DatasetDashboard";
import AbcReport from "@/components/AbcReport";
import DebtorsReport from "@/components/DebtorsReport";
import StockReport from "@/components/StockReport";
import StockValueReport from "@/components/StockValueReport";
import ImportsReport from "@/components/ImportsReport";
import WriteoffsReport from "@/components/WriteoffsReport";
import ReorderReport from "@/components/ReorderReport";
import ServiceReport from "@/components/ServiceReport";
import ProductProfitReport from "@/components/ProductProfitReport";

const fmtWhen = (iso) => {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function AnalysisPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const analysis = getAnalysis(id);
  const allowed = analysis ? canOpen(`/reports/${analysis.id}`, user) : true;
  const [modal, setModal] = useState(false);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);

  // Bazadan ishlaydigan tahlilga yuklama umuman kerak emas.
  const dataset = analysis?.source
    ? (listDatasets().find((d) => d.reportId === analysis.source.reportId) ?? null)
    : null;

  // Qatorlar ro'yxat bilan birga kelmaydi — tahlil ochilganda tortiladi
  useEffect(() => {
    if (!dataset || dataset.rows) return;
    let alive = true;
    setLoading(true);
    loadRows(dataset.id).then(() => {
      if (!alive) return;
      setLoading(false);
      setTick((v) => v + 1);
    });
    return () => { alive = false; };
  }, [dataset?.id, dataset?.rows]);

  if (analysis && !allowed) {
    return (
      <div className="card p-12 text-center max-w-xl mx-auto mt-16">
        <p className="text-xl font-extrabold mb-2">{t("Bu hisobot sizga ochiq emas")}</p>
        <p className="text-muted font-semibold mb-4">{t("Kerak bo'lsa rahbaringizdan so'rang.")}</p>
        <Link href="/reports" className="text-brand font-bold">{t("Hisobotlarga qaytish")}</Link>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="card p-12 text-center max-w-xl mx-auto mt-16">
        <p className="text-xl font-extrabold mb-2">{t("Tahlil topilmadi")}</p>
        <Link href="/reports" className="text-brand font-bold">{t("Hisobotlarga qaytish")}</Link>
      </div>
    );
  }

  const src = analysis.source;

  // ── Bazadan ishlaydigan tahlil ──────────────────────────────
  // Fayl yuklash bosqichi butunlay o'tkazib yuboriladi: yuklama
  // kutilmaydi, "Ma'lumotni yangilash" tugmasi ko'rsatilmaydi.
  // Aks holda ekranda "Bu tahlil uchun ma'lumot kerak" degan
  // yolg'on turardi — ma'lumot bazada, doim tayyor.
  if (analysis.bazadan) {
    return (
      <div>
        <Link href="/reports" className="inline-flex items-center gap-2 text-muted hover:text-ink font-bold mb-4">
          <ArrowLeft size={18} /> {t("Hisobotlar")}
        </Link>
        <div className="mb-7">
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">{t(analysis.label)}</h1>
          <p className="text-muted font-semibold">{t(analysis.hint)}</p>
        </div>
        {analysis.kind === "productProfit" ? <ProductProfitReport /> : null}
      </div>
    );
  }

  return (
    <div>
      <Link href="/reports" className="inline-flex items-center gap-2 text-muted hover:text-ink font-bold mb-4">
        <ArrowLeft size={18} /> {t("Hisobotlar")}
      </Link>

      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">{t(analysis.label)}</h1>
          <p className="text-muted font-semibold">
            {dataset
              ? tt("{name} · {n} qator · yangilangan {d}", {
                  name: dataset.name,
                  n: (dataset.rowCount ?? dataset.rows?.length ?? 0).toLocaleString("ru-RU"),
                  d: fmtWhen(dataset.at),
                })
              : t(analysis.hint)}
          </p>
        </div>
        <button onClick={() => setModal(true)}
          className="flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-5 py-3 shrink-0">
          <RefreshCw size={18} /> {t(dataset ? "Ma'lumotni yangilash" : "Ma'lumot yuklash")}
        </button>
      </div>

      {/* Ma'lumot yo'q — nima qilish kerakligini shu yerda aytamiz */}
      {!dataset ? (
        <div className="card p-10">
          <div className="max-w-2xl">
            <span className="w-14 h-14 rounded-2xl bg-brand-soft text-brand flex items-center justify-center mb-5">
              <Upload size={26} />
            </span>
            <h2 className="text-2xl font-extrabold mb-2">{t("Bu tahlil uchun ma'lumot kerak")}</h2>
            <p className="text-muted font-semibold mb-6">
              {tt("Billz'dan \"{name}\" hisobotini yuklab olib, shu yerga tashlang.", { name: src.name })}
            </p>

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

            <button onClick={() => setModal(true)}
              className="rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-6 py-3">
              {t("Faylni yuklash")}
            </button>
          </div>
        </div>
      ) : loading || !dataset.rows ? (
        <div className="card p-12 text-center text-muted font-semibold">
          {t("Ma'lumot yuklanmoqda…")}
        </div>
      ) : analysis.kind === "abc" ? (
        <AbcReport analysis={analysis} dataset={dataset} key={tick} />
      ) : analysis.kind === "debtors" ? (
        <DebtorsReport analysis={analysis} dataset={dataset} key={tick} />
      ) : analysis.kind === "stock" ? (
        <StockReport analysis={analysis} dataset={dataset} key={tick} />
      ) : analysis.kind === "stockValue" ? (
        <StockValueReport analysis={analysis} dataset={dataset} key={tick} />
      ) : analysis.kind === "imports" ? (
        <ImportsReport analysis={analysis} dataset={dataset} key={tick} />
      ) : analysis.kind === "writeoffs" ? (
        <WriteoffsReport analysis={analysis} dataset={dataset} key={tick} />
      ) : analysis.kind === "reorder" ? (
        <ReorderReport analysis={analysis} dataset={dataset} key={tick} />
      ) : analysis.kind === "service" ? (
        <ServiceReport analysis={analysis} dataset={dataset} key={tick} />
      ) : (
        <DatasetDashboard dataset={dataset} preset={analysis.preset} key={tick} />
      )}

      {modal && (
        <DataSourceModal analysis={analysis} onClose={() => setModal(false)}
          onDone={() => { setModal(false); setTick((v) => v + 1); }} />
      )}
    </div>
  );
}
