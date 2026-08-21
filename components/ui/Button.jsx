"use client";
import { t } from "@/lib/i18n";

// ══════════════════════════════════════════════════════════════
// TUGMA — bitta ta'rif
// ══════════════════════════════════════════════════════════════
// Ilgari tugma 44 ta faylda qo'lda yozilardi va oltita xil padding
// ishlatilgan edi: px-4 py-2, px-5 py-2, px-5 py-3, px-6 py-3,
// px-7 py-3, px-8 py-3. Ya'ni bir ekranda tugmalar turli bo'yda
// turardi va yangi sahifa yana yangi o'lcham qo'shardi.
//
// Endi uchta o'lcham va to'rtta ko'rinish. Boshqasi kerak bo'lsa —
// shu yerga qo'shiladi, sahifada emas.

const OLCHAM = {
  kichik: "px-3.5 py-2 text-sm gap-1.5",
  o1rta:  "px-5 py-2.5 gap-2",
  katta:  "px-7 py-3.5 text-lg gap-2.5",
};

const KORINISH = {
  // Asosiy harakat — sahifada bittadan ko'p bo'lmasligi kerak
  asosiy:  "bg-brand text-white hover:bg-brand-dark border border-transparent",
  // Odatiy harakat
  oddiy:   "border border-line hover:border-brand hover:text-brand",
  // Xavfli: o'chirish, bekor qilish
  xavfli:  "border border-line text-danger hover:border-danger hover:bg-danger-soft",
  // Fonsiz — jadval ichidagi mayda harakatlar uchun
  yassi:   "border border-transparent hover:bg-surface",
};

export default function Button({
  children, icon: Icon, olcham = "o1rta", korinish = "oddiy",
  className = "", type = "button", ...qolgan
}) {
  return (
    <button type={type}
      className={`inline-flex items-center justify-center rounded-xl font-bold whitespace-nowrap
        transition-colors disabled:opacity-40 disabled:pointer-events-none
        ${OLCHAM[olcham] ?? OLCHAM.o1rta} ${KORINISH[korinish] ?? KORINISH.oddiy} ${className}`}
      {...qolgan}>
      {Icon && <Icon size={olcham === "kichik" ? 15 : olcham === "katta" ? 20 : 17} />}
      {typeof children === "string" ? t(children) : children}
    </button>
  );
}
