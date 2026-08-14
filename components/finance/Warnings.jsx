"use client";
// ══════════════════════════════════════════════════════════════
// PUL NAZORATI — ogohlantirishlar kartochkasi
// ══════════════════════════════════════════════════════════════
// Moliya bosh sahifasi va Kassalar sahifasida turadi. Xato bo'lmasa
// umuman ko'rinmaydi — bo'sh "hammasi joyida" kartochkasi ekranni
// egallab, keyin haqiqiy ogohlantirish ham e'tiborsiz qolib ketardi.
import { t, tt } from "@/lib/i18n";
import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useLive } from "@/components/DataProvider";
import { moneyWarnings } from "@/lib/audit";

export default function Warnings() {
  const { user } = useAuth();
  const live = useLive();
  const items = useMemo(() => {
    try { return moneyWarnings(user); } catch { return []; }
  }, [user, live]);

  if (!items.length) return null;
  const errors = items.filter((x) => x.level === "error").length;

  return (
    <div className={`card p-6 mb-7 border-2 ${errors ? "border-danger" : "border-warn"}`}>
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle size={20} className={errors ? "text-danger" : "text-warn"} />
        <p className="text-lg font-extrabold">{t("Tekshirib ko'ring")}</p>
        <span className={`text-sm font-bold px-2.5 py-0.5 rounded-lg ${
          errors ? "bg-danger-soft text-danger" : "bg-warn-soft text-warn"}`}>
          {items.length}
        </span>
        <span className="text-sm text-muted font-semibold">
          {t("hisobdagi nomuvofiqliklar — o'zingiz tuzatasiz")}
        </span>
      </div>
      <div className="space-y-3">
        {items.map((x) => (
          <Link key={x.id} href={x.href}
            className="flex items-start gap-4 rounded-xl bg-surface px-5 py-4 hover:bg-track transition-colors group">
            <div className="min-w-0 flex-1">
              <p className={`font-bold ${x.level === "error" ? "text-danger" : "text-warn"}`}>
                {t(x.title)}
              </p>
              <p className="text-sm text-muted font-semibold">{t(x.detail)}</p>
            </div>
            <span className="flex items-center gap-1 text-sm font-bold text-brand whitespace-nowrap shrink-0 mt-0.5">
              {t(x.action)} <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
