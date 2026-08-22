// ══════════════════════════════════════════════════════════════
// ESKI USTUN TA'RIFINI `DataTable` GA O'GIRISH
// ══════════════════════════════════════════════════════════════
// Hisobot komponentlari (StockReport, ReorderReport, ImportsReport…)
// jadvalni QO'LDA chizardi. Ustun ta'rifi ularda bir xil shaklda:
//
//   { key, label, sortKey, align, cellClass, cell, total }
//
// `DataTable` esa boshqacha kutadi:
//
//   { key, label, right, value, cell, total }
//
// Farqlari:
//   align: "right"  →  right: true
//   cellClass       →  `cell` ichiga o'raladi
//   total(jami)     →  eski `total` YIG'MA OBYEKTNI oladi va
//                      `{ value, className }` qaytaradi; DataTable
//                      esa qatorlar ro'yxatini beradi va katakning
//                      o'zini kutadi
//
// Shu farqlar yettita faylda takrorlanmasin deb shu yerda.
export function eskiUstunlar(cols, { jami } = {}) {
  return cols.map((c) => ({
    key: c.key,
    label: c.label,
    right: c.align === "right",
    // Saralash uchun xom qiymat. `sortKey` berilgan bo'lsa o'sha
    // maydon, aks holda kalitning o'zi.
    value: (r) => r[c.sortKey ?? c.key],
    cell: (r) => {
      const kl = c.cellClass?.(r);
      const ich = c.cell(r);
      return kl ? <span className={kl}>{ich}</span> : ich;
    },
    ...(c.total
      ? {
          // Eski `total` yig'ma obyektni oladi, DataTable qatorlarni
          // beradi — shuning uchun yig'ma tashqaridan uzatiladi.
          total: () => {
            const n = c.total(typeof jami === "function" ? jami() : jami);
            return n?.className
              ? <span className={n.className}>{n.value}</span>
              : n?.value ?? n;
          },
        }
      : {}),
  }));
}
