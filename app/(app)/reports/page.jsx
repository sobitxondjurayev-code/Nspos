"use client";
import { t, tt } from "@/lib/i18n";
import Link from "next/link";
import { ChevronRight, Database } from "lucide-react";
import { ANALYSES } from "@/lib/analyses";
import { canOpen } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";

// Faqat Billz API orqali bazaga keladigan tahlillar. Excel eksporti
// qo'lda yangilanadigan va eskirib qoladigan manba bo'lgani uchun
// 2026-08-24 dan foydalanuvchi oqimidan chiqarildi.
export default function Reports() {
  const { user } = useAuth();
  // Har tahlil alohida ruxsatga ega: rahbar xodimga faqat keraklisini ochadi
  const visible = ANALYSES.filter((a) => a.bazadan && canOpen(`/reports/${a.id}`, user));

  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight mb-2">{t("Hisobotlar")}</h1>
      <p className="text-muted font-semibold mb-7">
        {t("Billz API'dan avtomatik yangilanadigan tahlillar. Excel fayl yuklash talab qilinmaydi.")}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {visible.map((a) => {
          return (
            <Link key={a.id} href={`/reports/${a.id}`}
              className="card p-6 flex items-start gap-4 hover:border-brand transition-colors">
              <span className="w-12 h-12 rounded-xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
                <a.icon size={22} />
              </span>

              <div className="flex-1 min-w-0">
                <p className="text-lg font-extrabold text-ink mb-1">{t(a.label)}</p>
                <p className="text-sm text-muted font-semibold mb-3">{t(a.hint)}</p>

                <span className="inline-flex items-center gap-2 text-sm font-bold text-brand">
                  <Database size={16} /> {t("Bazadan — doim yangi")}
                </span>
              </div>

              <ChevronRight size={20} className="text-muted shrink-0 mt-3" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
