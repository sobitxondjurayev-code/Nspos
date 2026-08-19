"use client";
import * as XLSX from "xlsx";

// ══════════════════════════════════════════════════════════════
// JADVALNI EXCELGA YUKLASH
// ══════════════════════════════════════════════════════════════
// Ekrandagi jadval nimani ko'rsatayotgan bo'lsa — o'shani beradi:
// filtr, qidiruv va saralash qo'llangan holicha. Rahbar ko'pincha
// natijani hamkasbiga yuborishi yoki o'zi ustida ishlashi kerak.

const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * @param {string} name    fayl nomi (sanasiz)
 * @param {Array}  columns [{ label, get(row) }]
 * @param {Array}  rows
 */
export function exportRows(name, columns, rows) {
  if (!rows?.length) return false;
  const data = rows.map((r, i) =>
    Object.fromEntries([
      ["#", i + 1],
      ...columns.map((c) => [c.label, c.get(r)]),
    ]));

  const ws = XLSX.utils.json_to_sheet(data);
  // Ustun kengligini mazmunga moslaymiz — aks holda hammasi tor chiqadi
  const head = ["#", ...columns.map((c) => c.label)];
  ws["!cols"] = head.map((h) => {
    const longest = data.reduce((mx, row) => Math.max(mx, String(row[h] ?? "").length), h.length);
    return { wch: Math.min(Math.max(longest + 2, 8), 42) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Hisobot");
  XLSX.writeFile(wb, `${name} ${stamp()}.xlsx`);
  return true;
}
