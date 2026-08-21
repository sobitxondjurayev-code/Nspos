"use client";
import { useEffect } from "react";
import { X } from "lucide-react";
import { t } from "@/lib/i18n";

// ══════════════════════════════════════════════════════════════
// OYNA (modal) — bitta ta'rif
// ══════════════════════════════════════════════════════════════
// Ilgari `fixed inset-0 z-50 bg-overlay/50 flex …` 28 ta faylda
// qo'lda yozilardi. Har nusxa biroz boshqacha edi: birida
// `items-center`, birida `items-start`; birida `p-4`, birida `p-6`;
// birida orqa fonni bosganda yopilardi, birida yo'q.
//
// Bu yerda ATAYLAB qo'shilgan uchta narsa ilgari deyarli hech qayerda
// yo'q edi:
//
//   • Esc bilan yopish — klaviatura bilan ishlaydigan odam uchun
//   • Fon skrolli qulflanadi — oyna ochiq turganda orqadagi sahifa
//     surilib ketmasin
//   • Telefonda pastdan chiqadi (`items-end sm:items-center`) va
//     `max-h-[92vh]` bilan chegaralanadi — kichik ekranda oynaning
//     tepasi ham, pastki tugmasi ham ko'rinib tursin
//
// Kenglik: kichik (max-w-md) · o'rta (max-w-2xl) · katta (max-w-5xl)
const KENG = { kichik: "max-w-md", o1rta: "max-w-2xl", katta: "max-w-5xl", tor: "max-w-sm" };

export default function Modal({
  onClose, title, hint, children, footer, keng = "kichik", yopilmasin = false,
}) {
  useEffect(() => {
    const esc = (e) => { if (e.key === "Escape" && !yopilmasin) onClose?.(); };
    document.addEventListener("keydown", esc);
    // Fon skrolli qulflanadi
    const eski = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = eski;
    };
  }, [onClose, yopilmasin]);

  return (
    <div
      className="fixed inset-0 z-50 bg-overlay/50 flex items-end sm:items-center justify-center
                 p-0 sm:p-4 overflow-y-auto"
      onClick={() => !yopilmasin && onClose?.()}>
      <div
        className={`card w-full ${KENG[keng] ?? KENG.kichik} max-h-[92vh] flex flex-col
                    rounded-b-none sm:rounded-b-xl2 my-0 sm:my-8`}
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true">
        {(title || onClose) && (
          <div className="flex items-start justify-between gap-4 p-6 sm:p-7 pb-4 sm:pb-5 shrink-0">
            <div className="min-w-0">
              {title && <h2 className="text-xl sm:text-2xl font-extrabold truncate">{t(title)}</h2>}
              {hint && <p className="text-sm text-muted font-semibold mt-1">{t(hint)}</p>}
            </div>
            {onClose && (
              <button type="button" onClick={onClose} aria-label={t("Yopish")}
                className="shrink-0 text-muted hover:text-ink rounded-lg p-1 -m-1">
                <X size={22} />
              </button>
            )}
          </div>
        )}

        {/* Faqat mazmun suriladi — sarlavha va pastki qator joyida qoladi */}
        <div className="px-6 sm:px-7 pb-6 sm:pb-7 overflow-y-auto grow">{children}</div>

        {footer && (
          <div className="px-6 sm:px-7 py-4 border-t border-line shrink-0
                          flex flex-wrap items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
