"use client";
import { t, tt } from "@/lib/i18n";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDataset, loadRows } from "@/lib/datasets";
import DatasetDashboard from "@/components/DatasetDashboard";

export default function DatasetPage() {
  const { id } = useParams();
  // Qatorlar ro'yxat bilan birga tortilmaydi (17 000 qator ×
  // bir necha hisobot og'ir bo'lardi) — dashboard ochilganda olinadi
  const [ready, setReady] = useState(() => !!getDataset(id)?.rows);

  useEffect(() => {
    if (ready) return;
    let alive = true;
    loadRows(id).then(() => alive && setReady(true));
    return () => { alive = false; };
  }, [id, ready]);

  const dataset = getDataset(id);

  if (!dataset) {
    return (
      <div className="card p-12 text-center max-w-xl mx-auto mt-16">
        <p className="text-xl font-extrabold mb-2">{t("To'plam topilmadi")}</p>
        <p className="text-muted font-semibold mb-7">
          {t("Sahifa yangilangan bo'lsa, yuklangan fayl xotiradan o'chgan bo'lishi mumkin.")}
        </p>
        <Link href="/data"
          className="inline-block rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-6 py-3">
          {t("Qaytadan yuklash")}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link href="/data" className="inline-flex items-center gap-2 text-muted hover:text-ink font-bold mb-4">
        <ArrowLeft size={18} /> {t("Yuklangan hisobotlar")}
      </Link>

      <h1 className="text-4xl font-extrabold tracking-tight mb-2">{dataset.name}</h1>
      <p className="text-muted font-semibold mb-7">
        {tt("{n} qator", { n: dataset.rowCount ?? dataset.rows?.length ?? 0 })} · {dataset.fileName}
      </p>

      {dataset.rows
        ? <DatasetDashboard dataset={dataset} />
        : <div className="card p-12 text-center text-muted font-semibold">
            {t("Qatorlar yuklanmoqda…")}
          </div>}
    </div>
  );
}
