"use client";
import { ResponsiveContainer } from "recharts";
import { t } from "@/lib/i18n";
import EmptyState from "@/components/ui/EmptyState";

// ══════════════════════════════════════════════════════════════
// GRAFIK O'RAMI
// ══════════════════════════════════════════════════════════════
// Har grafik uchun bir xil bo'lishi kerak bo'lgan narsalar. Ilgari
// ularning ba'zisi bir grafikda bor, boshqasida yo'q edi:
//
//   sarlavha            — 5/5 da bor edi
//   tushuntirish        — 2/5
//   O'Q BELGISI         — 0/5 (Y o'qida "USD mi, dona mi" yozilmagan)
//   bo'sh ma'lumot      — 3 xil xatti-harakat; ikki grafik ma'lumot
//                         yo'q paytda NOL CHIZIG'I chizardi — bu
//                         "savdo nol" degan yolg'on
//   balandlik           — qotirilgan (h-[27.5rem]), telefonda ekran
//                         yarmini egallardi
//
// Endi hammasi shu yerda. Grafik yozgan odam ularni eslashi shart emas.
export default function ChartCard({
  title, hint, oq,            // oq — Y o'qi nimani o'lchaydi: "USD", "dona"
  children,
  bosh = false,               // ma'lumot bormi (false bo'lsa grafik chizilmaydi)
  boshMatn = "Bu davrda ma'lumot yo'q",
  boshIzoh,
  ustida,                     // sarlavha yonidagi boshqaruv (masalan tumbler)
  balandlik = "h-56 sm:h-72 lg:h-[21rem]",
  className = "",
}) {
  return (
    <div className={`card p-5 sm:p-7 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-extrabold">{t(title)}</h2>
          {hint && <p className="text-sm text-muted font-semibold mt-1">{t(hint)}</p>}
        </div>
        {ustida}
      </div>

      {bosh ? (
        // Ma'lumot yo'q bo'lsa GRAFIK CHIZILMAYDI. Nol bilan to'ldirilgan
        // seriya "hammasi nol" degan ma'noni beradi — bu "ma'lumot yo'q"
        // dan butunlay boshqa gap va rahbarni chalg'itadi.
        <EmptyState kichik title={boshMatn} hint={boshIzoh} />
      ) : (
        <>
          {oq && (
            <p className="text-xs font-bold text-muted mb-1.5 uppercase tracking-wide">{t(oq)}</p>
          )}
          <div className={balandlik}>
            <ResponsiveContainer width="100%" height="100%">
              {children}
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
