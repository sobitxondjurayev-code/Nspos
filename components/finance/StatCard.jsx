"use client";
import { t } from "@/lib/i18n";
import { ChevronRight } from "lucide-react";

// Moliya bo'limidagi barcha sahifalar uchun umumiy ko'rsatkich kartasi.
//
// onOpen berilsa karta bosiladigan bo'ladi: raqam ortidagi yozuvlar
// ochiladi. Jadvallardagi bilan bir xil qoida — yig'ma raqam har doim
// "qayerdan chiqdi?" degan savolga javob bera olishi kerak.
export default function StatCard({ icon: Icon, label, value, hint, tone = "brand", onOpen }) {
  const tones = {
    brand: "bg-brand-soft text-brand",
    green: "bg-ok-soft text-ok",
    amber: "bg-warn-soft text-warn",
    red: "bg-danger-soft text-danger",
  };

  const body = (
    <>
      <div className="flex items-center gap-3 mb-3">
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${tones[tone]}`}>
          <Icon size={20} />
        </span>
        <p className="text-sm font-bold text-muted flex-1 text-left">{t(label)}</p>
        {onOpen && <ChevronRight size={18} className="text-muted shrink-0" />}
      </div>
      <p className="text-3xl font-extrabold text-left">{value}</p>
      {hint && <p className="text-sm text-muted font-semibold mt-1 text-left">{hint}</p>}
    </>
  );

  if (!onOpen) return <div className="card p-6">{body}</div>;

  return (
    <button onClick={onOpen}
      className="card p-6 w-full text-left hover:border-brand transition-colors">
      {body}
    </button>
  );
}
