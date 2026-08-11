"use client";
import { t } from "@/lib/i18n";

// Moliya bo'limidagi barcha sahifalar uchun umumiy ko'rsatkich kartasi
export default function StatCard({ icon: Icon, label, value, hint, tone = "brand" }) {
  const tones = {
    brand: "bg-brand-soft text-brand",
    green: "bg-ok-soft text-ok",
    amber: "bg-warn-soft text-warn",
    red: "bg-danger-soft text-danger",
  };
  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-3">
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${tones[tone]}`}>
          <Icon size={20} />
        </span>
        <p className="text-sm font-bold text-muted">{t(label)}</p>
      </div>
      <p className="text-3xl font-extrabold">{value}</p>
      {hint && <p className="text-sm text-muted font-semibold mt-1">{hint}</p>}
    </div>
  );
}
