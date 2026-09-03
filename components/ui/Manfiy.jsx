"use client";
import { t } from "@/lib/i18n";
import { MANFIY_SABAB } from "@/lib/format";

// ══════════════════════════════════════════════════════════════
// MANFIY RAQAM — SABABI BILAN
// ══════════════════════════════════════════════════════════════
// Rahbar (2026-09-03): "Nima uchun tizimda '-' ishorali sonlar bor?"
// Minus haqiqiy holat (kassa minusda, avans, zarar, kamomad…), lekin
// ekranda faqat raqam turardi — sabab yo'q. Endi manfiy katak qizil,
// ostida nuqtali chiziq (DAFTAR 3: izohli joy ko'rinib tursin) va
// hover'da sabab. Musbat bo'lsa hech narsa o'zgarmaydi — bola shunchaki
// chiziladi.
//
//   <Manfiy v={qoldiq} sabab="kassaQoldi">{fmtUSD(qoldiq)}</Manfiy>
//
// `sabab` — `MANFIY_SABAB` kaliti (bir sabab, bitta matn) yoki tayyor matn.
export default function Manfiy({ v, sabab, className = "", children }) {
  if (!(Number(v) < 0)) return <>{children}</>;
  const matn = MANFIY_SABAB[sabab] ?? sabab ?? "";
  return (
    <span title={t(matn)}
      className={`text-danger underline decoration-dotted decoration-danger/60 underline-offset-4 cursor-help ${className}`}>
      {children}
    </span>
  );
}
