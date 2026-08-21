"use client";
import { t, tt } from "@/lib/i18n";
import Link from "next/link";
import { CircleCheck, CircleDashed, ChevronRight, Database } from "lucide-react";
import { ANALYSES } from "@/lib/analyses";
import { listDatasets } from "@/lib/datasets";
import { canOpen } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";

const fmtWhen = (iso) => {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
};

// Tahlillar katalogi. Har karta o'z ma'lumoti bor-yo'qligini va
// qachon yangilanganini ko'rsatadi — foydalanuvchi kirishdan oldin
// biladi, ichida "ma'lumot yo'q" degan bo'sh ekran kutmaydi.
export default function Reports() {
  const { user } = useAuth();
  const datasets = listDatasets();
  // Har tahlil alohida ruxsatga ega: rahbar xodimga faqat keraklisini ochadi
  const visible = ANALYSES.filter((a) => canOpen(`/reports/${a.id}`, user));
  const byReport = new Map(datasets.map((d) => [d.reportId, d]));

  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight mb-2">{t("Hisobotlar")}</h1>
      <p className="text-muted font-semibold mb-7">
        {t("Billz'dan yuklangan ma'lumot asosidagi tahlillar. Har biri o'ziga kerakli hisobotni aytadi.")}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {visible.map((a) => {
          const ds = a.source ? byReport.get(a.source.reportId) : null;
          return (
            <Link key={a.id} href={`/reports/${a.id}`}
              className="card p-6 flex items-start gap-4 hover:border-brand transition-colors">
              <span className="w-12 h-12 rounded-xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
                <a.icon size={22} />
              </span>

              <div className="flex-1 min-w-0">
                <p className="text-lg font-extrabold text-ink mb-1">{t(a.label)}</p>
                <p className="text-sm text-muted font-semibold mb-3">{t(a.hint)}</p>

                {a.bazadan ? (
                  // Bazadan ishlaydigan tahlilga fayl kerak emas —
                  // "Ma'lumot yuklanmagan" deb turishi yolg'on bo'lardi.
                  <span className="inline-flex items-center gap-2 text-sm font-bold text-brand">
                    <Database size={16} /> {t("Bazadan — doim yangi")}
                  </span>
                ) : ds ? (
                  <span className="inline-flex items-center gap-2 text-sm font-bold text-ok">
                    <CircleCheck size={16} />
                    {tt("{n} qator · {d}", {
                      n: (ds.rowCount ?? ds.rows?.length ?? 0).toLocaleString("ru-RU"),
                      d: fmtWhen(ds.at),
                    })}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 text-sm font-bold text-muted">
                    <CircleDashed size={16} /> {t("Ma'lumot yuklanmagan")}
                  </span>
                )}
              </div>

              <ChevronRight size={20} className="text-muted shrink-0 mt-3" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
