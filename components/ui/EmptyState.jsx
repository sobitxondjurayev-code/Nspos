"use client";
import { t } from "@/lib/i18n";

// ══════════════════════════════════════════════════════════════
// BO'SH HOLAT — bitta ko'rinish
// ══════════════════════════════════════════════════════════════
// Ilgari 8 xil variant bor edi (`py-12 text-center`, `card p-10`,
// `card p-12 max-w-xl mx-auto mt-16` va h.k.), matnlari ham har xil:
// "Hech narsa topilmadi", "Hali cheklar yo'q", "Menejer yo'q"…
// Ba'zisida ikonka bor, ba'zisida yo'q, harakat tugmasi deyarli
// hech qayerda yo'q edi.
//
// Bo'sh ekran — foydalanuvchi uchun eng noqulay lahza: u nima
// qilishni bilmaydi. Shuning uchun uchta narsa bo'lishi kerak:
// NIMA yo'q, NEGA yo'q va NIMA QILISH kerak.
//
// Ikki joyda ishlatiladi:
//   <EmptyState .../>                  — kartochka ichida yoki alohida
//   <EmptyState inTable colSpan={7} />  — jadval ichida (<td> bo'lib)
export default function EmptyState({
  icon: Icon, title, hint, action, inTable = false, colSpan = 1, kichik = false,
}) {
  const body = (
    <div className={`text-center ${kichik ? "py-8" : "py-14"}`}>
      {Icon && (
        <span className="inline-flex w-14 h-14 rounded-2xl bg-surface items-center justify-center mb-4">
          <Icon size={26} className="text-muted" />
        </span>
      )}
      <p className="font-extrabold text-lg">{t(title)}</p>
      {hint && (
        <p className="text-sm text-muted font-semibold mt-1.5 max-w-md mx-auto">{t(hint)}</p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );

  if (!inTable) return body;
  return (
    <tr>
      <td colSpan={colSpan} className="px-5">{body}</td>
    </tr>
  );
}
