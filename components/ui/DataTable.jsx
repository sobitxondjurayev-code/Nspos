"use client";
import { useMemo, useState } from "react";
import { SlidersHorizontal, Download, ChevronsUpDown, ChevronUp, ChevronDown, Info } from "lucide-react";
import { t, tt } from "@/lib/i18n";
import { solishtir } from "@/components/SortTh";
import { useColumns } from "@/components/useColumns";
import ColumnSettings from "@/components/ColumnSettings";
import EmptyState from "@/components/ui/EmptyState";
import { exportRows } from "@/lib/exportXlsx";

// ══════════════════════════════════════════════════════════════
// JADVAL — LOYIHANING STANDARTI KODGA AYLANTIRILGAN
// ══════════════════════════════════════════════════════════════
// CLAUDE.md da yozilgan: "Har jadvalda: sarlavha pin, sana/ism ustuni
// chapda pin, filtr va Jami bo'ladi — bularni har safar aytish shart
// emas."
//
// Amalda esa 35 ta jadvaldan (2026-08-21 da sanaldi):
//   sarlavha pin     17 ta (49 %)
//   chap ustun pin    3 ta ( 9 %)
//   "Jami" qatori     9 ta (26 %)
//   saralash          8 ta (23 %)
//   Excel             8 ta (23 %)
//
// Sabab oddiy: har jadval qo'lda yozilardi, standart esa faqat
// hujjatda turardi. Yangi sahifa yozgan odam uni eslashi kerak edi.
//
// Endi standart SHU YERDA. Jadval `DataTable` orqali chizilsa,
// yuqoridagilarning hammasi o'zi bo'ladi — unutib bo'lmaydi.
//
// ── Ustun ta'rifi ─────────────────────────────────────────────
//   {
//     key:    "amount",
//     label:  "Summa",
//     right:  true,                    // o'ngga tekislash + raqam tekislash
//     cell:   (row) => <b>…</b>,       // ekranda
//     value:  (row) => 1234.5,         // saralash va Excel uchun
//     total:  (rows) => "…",           // "Jami" katagi
//     width:  "10rem",
//     locked: true,                    // "Ustunlar" da yashirib bo'lmaydi
//     hint:   "Qoldiq ÷ kuniga",       // ustun nimani bildiradi (sarlavhada ⓘ, hover'da matn)
//   }
// `value` berilmasa `row[key]` olinadi. `cell` berilmasa `value` chiqadi.

const qiymat = (c, r) => (c.value ? c.value(r) : r[c.key]);

export default function DataTable({
  id,                       // "Ustunlar" sozlamasi kaliti (bo'lmasa tugma chiqmaydi)
  name,                     // Excel fayl nomi (bo'lmasa Excel tugmasi chiqmaydi)
  columns,
  rows,
  rowKey = (r, i) => r.id ?? i,
  pin = true,               // birinchi ustun chapda yopishib turadimi
  limit = 300,
  count,                    // "Jami" yonidagi son — FILTRDAN o'tgan hammasi
  jami = true,              // "Jami" qatori chizilsinmi
  jamiIzoh,                 // "Jami" yonidagi matn (son o'rniga)
  empty = {},               // { icon, title, hint, action }
  onRowClick,
  minWidth = "48rem",
  maxHeight = "70vh",
  boshSort,                 // { key, dir } — boshlang'ich saralash
  ustida,                   // jadval USTIDA turadigan narsa (filtr va h.k.)
  qatorClass,               // (row, i) => "…"
  className = "",
}) {
  const [sort, setSort] = useState(boshSort ?? null);

  // "Ustunlar" sozlamasi — id berilgandagina
  const locked = useMemo(() => columns.filter((c) => c.locked).map((c) => c.key), [columns]);
  const prefs = useColumns(id ?? "__yoq", columns, { locked });
  const cols = id ? prefs.columns : columns;

  const tartiblangan = useMemo(() => {
    if (!sort) return rows;
    const c = columns.find((x) => x.key === sort.key);
    if (!c) return rows;
    return [...rows].sort((a, b) => solishtir(qiymat(c, a), qiymat(c, b), sort.dir));
  }, [rows, sort, columns]);

  const korinadigan = limit ? tartiblangan.slice(0, limit) : tartiblangan;
  const jamiSon = count ?? rows.length;

  const bosSort = (key) =>
    setSort((s) => (s?.key === key
      ? (s.dir === "desc" ? { key, dir: "asc" } : null)
      : { key, dir: "desc" }));

  // Chapdagi ustun pin — gorizontal skrollda ism/sana ko'rinib tursin.
  // Fon SHAFFOFMAS bo'lishi shart, aks holda tagidagi ustunlar
  // ko'rinib, matn ustma-ust tushadi (DAFTAR, 2026-08-06).
  const pinCls = (i) => (pin && i === 0 ? "sticky left-0 bg-panel z-10" : "");
  const pinHead = (i) => (pin && i === 0 ? "sticky left-0 z-30" : "");

  return (
    <div className={className}>
      {(ustida || name || id) && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="min-w-0 grow">{ustida}</div>
          <div className="flex items-center gap-2 shrink-0">
            {id && (
              <button type="button" onClick={prefs.openSettings}
                className="inline-flex items-center gap-2 rounded-xl border border-line font-bold
                           px-3.5 py-2 text-sm hover:border-brand hover:text-brand">
                <SlidersHorizontal size={15} /> {t("Ustunlar")}
              </button>
            )}
            {name && (
              <button type="button" disabled={!rows.length}
                onClick={() => exportRows(name,
                  cols.filter((c) => !c.harakat).map((c) => ({
                    label: t(c.label), get: (r) => qiymat(c, r),
                  })), tartiblangan)}
                className="inline-flex items-center gap-2 rounded-xl border border-line font-bold
                           px-3.5 py-2 text-sm hover:border-brand hover:text-brand disabled:opacity-40">
                <Download size={15} /> {t("Excel")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* `overflow-auto` SHART: sticky faqat skroll qiladigan o'ram
          ichida ishlaydi. `min-w` — telefonda ustunlar siqilib, matn
          har harfda qatorga bo'linib ketmasin (yon tomonga suriladi). */}
      <div className="card overflow-auto" style={{ maxHeight }}>
        <table className="w-full text-[0.9375rem]" style={{ minWidth }}>
          <thead className="sticky top-0 z-20 [&_th]:bg-panel">
            <tr className="text-left text-sm border-b border-line">
              {cols.map((c, i) => {
                const faol = sort?.key === c.key;
                const Icon = !faol ? ChevronsUpDown : sort.dir === "asc" ? ChevronUp : ChevronDown;
                return (
                  <th key={c.key} style={c.width ? { width: c.width } : undefined}
                    className={`px-4 py-4 font-bold whitespace-nowrap ${c.right ? "text-right" : "text-left"} ${pinHead(i)}`}>
                    {/* Harakat ustuni (tugmalar) saralanmaydi — u
                        ma'lumot emas. Bosiladigan sarlavha qo'ysak,
                        bosilib nima bo'lishini hech kim tushunmaydi. */}
                    {c.harakat ? <span className="sr-only">{t(c.label)}</span> : (
                      <button type="button" onClick={() => bosSort(c.key)}
                        title={c.hint ? `${t(c.hint)}\n(${t("Bosing — saralash")})` : t("Bosing — saralash")}
                        className={`inline-flex items-center gap-1.5 hover:text-brand transition-colors
                                    ${c.right ? "flex-row-reverse" : ""} ${faol ? "text-brand" : ""}`}>
                        <span>{t(c.label)}</span>
                        {/* `hint` — ustun nimani bildirishi (2026-09-03: "Qoldiq
                            salomatligi ustunida nima ko'rsatilmoqda?"). Sarlavhada
                            belgi turadi, matn hover'da. Excelga chiqmaydi. */}
                        {c.hint && <Info size={12} className="opacity-50 shrink-0" />}
                        <Icon size={13} className={faol ? "" : "opacity-30"} />
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>

            {/* JAMI — sarlavha bilan BIRGA pin bo'ladi va TEPADA turadi.
                Har ustun uchun alohida katak: ustun ko'chsa jami ham
                ergashadi (ilgari colSpan bilan yozilib, Summa
                ko'chirilganda boshqa ustun tagida qolardi). */}
            {jami && (
              <tr className="border-b-2 border-line [&>th]:py-3.5">
                {cols.map((c, i) => (
                  <th key={c.key}
                    className={`px-4 font-extrabold whitespace-nowrap ${c.right ? "text-right" : "text-left"} ${pinHead(i)}`}>
                    {i === 0 ? (
                      <>
                        <span>{t("JAMI")}</span>
                        <span className="ml-2 text-sm font-semibold text-muted">
                          {jamiIzoh ?? tt("{n} ta", { n: Number(jamiSon).toLocaleString("ru-RU") })}
                        </span>
                      </>
                    ) : null}
                    {c.total ? <span className={i === 0 ? "ml-3" : ""}>{c.total(rows)}</span> : null}
                  </th>
                ))}
              </tr>
            )}
          </thead>

          <tbody>
            {korinadigan.map((r, i) => (
              <tr key={rowKey(r, i)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={`border-b border-line last:border-0 hover:bg-surface/70
                            ${onRowClick ? "cursor-pointer" : ""} ${qatorClass?.(r, i) ?? ""}`}>
                {cols.map((c, ci) => (
                  <td key={c.key}
                    className={`px-4 py-3.5 ${c.right ? "text-right tabular-nums" : ""} ${pinCls(ci)} ${c.cellClass?.(r) ?? ""}`}>
                    {c.cell ? c.cell(r) : qiymat(c, r)}
                  </td>
                ))}
              </tr>
            ))}

            {!rows.length && (
              <EmptyState inTable colSpan={cols.length}
                title={empty.title ?? "Hech narsa topilmadi"}
                hint={empty.hint} icon={empty.icon} action={empty.action} />
            )}
          </tbody>
        </table>

        {/* Kesilgan bo'lsa — JIMGINA emas, aytib qo'yiladi. "Jami" da
            5 000 turib, jadvalda 300 qator bo'lishi eng chalg'ituvchi
            holat: ro'yxat to'liq deb o'ylanadi. */}
        {limit && tartiblangan.length > limit && (
          <p className="px-4 py-4 text-sm text-muted font-semibold border-t border-line">
            {tt("Birinchi {k} tasi ko'rsatildi ({n} tadan) — filtrni toraytiring yoki Excelga chiqaring",
                { k: limit, n: tartiblangan.length.toLocaleString("ru-RU") })}
          </p>
        )}
      </div>

      {id && prefs.open && <ColumnSettings {...prefs.dialogProps} />}
    </div>
  );
}
