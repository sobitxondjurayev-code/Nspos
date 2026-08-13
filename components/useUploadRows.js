"use client";
// ══════════════════════════════════════════════════════════════
// YUKLAMA QATORLARINI TORTIB OLISH
// ══════════════════════════════════════════════════════════════
// Yuklamalar ro'yxati ilova ochilganda keladi, QATORLARSIZ — beshta
// hisobotda 17 000 dan ortiq qator bor va ularni har safar tortish
// ortiqcha (lib/datasets.js dagi izohga qarang).
//
// Natijada hisobot sahifasi qatorlarni o'zi so'ramasa, hisob bo'sh
// ma'lumot ustida yuriladi va ekranda 0 turadi. Shuning uchun yuklamaga
// tayanadigan har sahifa shu hookni chaqiradi:
//
//   const rows = useUploadRows(["summary", "pnl"]);
//   const p = useMemo(() => profitAndLoss(from, to), [range, rows]);
//
// Qaytgan qiymat — qatorlar kelganda o'zgaradigan belgi. Uni useMemo
// bog'lamiga qo'shish shart, aks holda hisob eski (bo'sh) holatda
// qotib qoladi.
import { useEffect, useState } from "react";
import { listDatasets, loadRows } from "@/lib/datasets";
import { useLive } from "@/components/DataProvider";

export default function useUploadRows(reportIds) {
  const live = useLive();
  const [tick, setTick] = useState(0);
  const key = reportIds.join(",");

  useEffect(() => {
    const want = key.split(",");
    const pending = listDatasets().filter((d) => want.includes(d.reportId) && !d.rows);
    if (!pending.length) return;
    let alive = true;
    Promise.all(pending.map((d) => loadRows(d.id)))
      .then(() => { if (alive) setTick((v) => v + 1); });
    return () => { alive = false; };
    // `live` bog'lamda: ilova endi ochilganda yuklamalar ro'yxati hali
    // kelmagan bo'ladi — o'shanda hech narsa topilmay, qatorlar hech
    // qachon tortilmasdi.
  }, [key, live]);

  return `${tick}|${live}`;
}
