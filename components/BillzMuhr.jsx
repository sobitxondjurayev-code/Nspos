"use client";
import { CheckCircle2, Clock, TriangleAlert } from "lucide-react";
import { t, tt } from "@/lib/i18n";
import { useLive } from "@/components/DataProvider";
import { listSinxronJurnal, sinxronBosqich, billzVaqtMatni } from "@/lib/billzLogData";

// ══════════════════════════════════════════════════════════════
// BILLZ MUHRI — "Billz: 23:30 · mos ✓"
// ══════════════════════════════════════════════════════════════
// Billz ma'lumoti turgan har sahifada turadi (DAFTAR 17 tamoyili:
// tizim Billz'ni KO'RSATADI, qayta hisoblamaydi). Ikki savolga javob:
//   1. ko'zgu QACHON yangilangan — oxirgi tugagan sinxron vaqti;
//   2. ko'zgu Billz bilan MOSMI — farq detektori (`billz_sync_log`,
//      `entity='moslik'`) nima degan.
//
// Ranglar: 15 daqiqagacha — yashil (cron 5 daqiqada yuradi), 60
// daqiqagacha — sariq, undan eski yoki farq bor — qizil. Bo'sh
// (huquq yo'q yoki jurnal yo'q) bo'lsa HECH NARSA ko'rsatilmaydi —
// soxta yashil "mos ✓" eng ishonarli yolg'on bo'lardi (CLAUDE.md
// 2026-08-21: bo'sh ro'yxat "hammasi joyida" degani emas).
//
// `entity` berilsa o'sha bosqichning vaqti (masalan "products"),
// bo'lmasa eng oxirgi tugagan bosqich.
export default function BillzMuhr({ entity = null, className = "" }) {
  useLive();
  const jurnal = listSinxronJurnal().filter((x) => x.entity !== "moslik" && x.finishedAt);
  const oxirgi = entity
    ? sinxronBosqich(entity)?.finishedAt ?? null
    : jurnal.reduce((m, x) => (!m || x.finishedAt > m ? x.finishedAt : m), null);
  if (!oxirgi) return null;

  const daqiqa = Math.max(0, Math.floor((Date.now() - new Date(oxirgi).getTime()) / 60_000));
  const moslik = sinxronBosqich("moslik");
  const farq = moslik?.warnings?.farq ?? [];
  const holat = farq.length ? "farq" : daqiqa >= 60 ? "eski" : daqiqa >= 15 ? "kech" : "yangi";

  const rang = {
    yangi: "bg-ok-soft text-ok",
    kech: "bg-warn-soft text-warn",
    eski: "bg-danger-soft text-danger",
    farq: "bg-danger-soft text-danger",
  }[holat];
  const Icon = holat === "yangi" ? CheckCircle2 : holat === "kech" ? Clock : TriangleAlert;

  const matn =
    holat === "farq" ? tt("{n} ta farq", { n: farq.length })
    : holat === "yangi" && moslik && !moslik.error ? t("mos ✓")
    : daqiqa >= 60 ? tt("{n} soat oldin", { n: Math.floor(daqiqa / 60) })
    : tt("{n} daqiqa oldin", { n: daqiqa });

  const izoh = farq.length
    ? farq.map((f) => `${f.nima}: Billz ${f.billz}, bu yerda ${f.nspos}`).join("\n")
    : t("Billz'dan oxirgi yangilanish vaqti va ko'zgu Billz bilan mosligi");

  return (
    <span title={izoh}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${rang} ${className}`}>
      <Icon size={13} />
      {`Billz: ${billzVaqtMatni(oxirgi)} · ${matn}`}
    </span>
  );
}
