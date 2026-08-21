"use client";
import { t, tt } from "@/lib/i18n";
import { ChevronRight, ArrowUpRight, ArrowDownRight } from "lucide-react";
import Sparkline from "@/components/ui/Sparkline";
import { foiz } from "@/lib/format";

// Moliya bo'limidagi barcha sahifalar uchun umumiy ko'rsatkich kartasi.
//
// onOpen berilsa karta bosiladigan bo'ladi: raqam ortidagi yozuvlar
// ochiladi. Jadvallardagi bilan bir xil qoida — yig'ma raqam har doim
// "qayerdan chiqdi?" degan savolga javob bera olishi kerak.
// —— O'zgarish va trend ————————————————————————————
// Ilgari kartochkada faqat RAQAM turardi: "47 481.56". Rahbar uchun
// bu yarim javob — u "bu ko'pmi yoki kammi?" degan savolga javob
// bermaydi. Endi ikkita narsa qo'shildi:
//
//   delta — o'tgan davrga nisbatan o'zgarish (foizda)
//   trend — oxirgi 12 nuqtaning chizig'i
//
// `yaxshi` — o'sish YAXSHIMI yoki YOMONMI. Tushum o'ssa yaxshi,
// xarajat o'ssa yomon. Busiz rang mantiqi teskari bo'lib qolardi:
// xarajat 40 % oshgani YASHIL bo'lib ko'rinardi.
export default function StatCard({
  icon: Icon, label, value, hint, tone = "brand", onOpen,
  delta, deltaLabel, trend, yaxshi = "yuqori",
}) {
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
      <div className="flex items-end justify-between gap-3">
        {/* Katta raqamda `tabular-nums` ATAYLAB yo'q: u har raqamga
            nolning enini beradi va "121" kabi son bo'shashib ko'rinadi.
            Tekislash ustunlarda kerak, alohida raqamda emas. */}
        <p className="text-3xl font-extrabold text-left leading-none">{value}</p>
        {trend?.length > 1 && (
          <Sparkline points={trend} tone={tones[tone]?.split(" ")[1] ?? "text-brand"} />
        )}
      </div>

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {delta != null && Number.isFinite(delta) && Math.abs(delta) >= 0.05 && (() => {
          const osdi = delta > 0;
          const yaxshiy = yaxshi === "yuqori" ? osdi : !osdi;
          const A = osdi ? ArrowUpRight : ArrowDownRight;
          return (
            <span className={`inline-flex items-center gap-0.5 text-sm font-extrabold
              ${yaxshiy ? "text-ok" : "text-danger"}`}>
              <A size={15} />{foiz(Math.abs(delta))}
            </span>
          );
        })()}
        {(deltaLabel || hint) && (
          <p className="text-sm text-muted font-semibold text-left">{deltaLabel ?? hint}</p>
        )}
      </div>
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
