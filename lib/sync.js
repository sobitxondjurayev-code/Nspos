"use client";
// ══════════════════════════════════════════════════════════════
// MODULLARNI BAZAGA ULASH UCHUN YORDAMCHI
// ══════════════════════════════════════════════════════════════
// 15 ta modulning har birida bir xil uchta ish takrorlanardi:
//   - bazadan kelgan qatorlarni xotiraga joylash
//   - realtime hodisasini xotiraga qo'llash
//   - o'zgartirishni bazaga yuborish va vaqtinchalik id'ni almashtirish
//
// Shu uchtasi mana bu yerga yig'ilgan. Modul faqat "qaysi jadval,
// qatorni qanday o'giraman, xotiram qayerda" deb aytadi.
import { registerModule, insert, update as dbUpdate, remove as dbRemove } from "./db";

/**
 * @param {string} name  modul nomi (xato xabarlarida ko'rinadi)
 * @param {object} cfg
 *   table    — Supabase jadvali
 *   select   — ustunlar; bolali jadvallar uchun "*, sale_items(*)"
 *   get/set  — modulning xotirasiga kirish
 *   fromRow  — (row) => item
 *   toRow    — (item) => row
 *   sort     — ixtiyoriy solishtiruvchi
 *   realtime — boshqa xodimning o'zgarishini kuzatish (default true)
 * @returns {{created, changed, deleted}} mutatsiyalarda chaqiriladigan funksiyalar
 */
export function syncTable(name, cfg) {
  // readTable berilsa o'qish o'shandan, yozish esa baribir `table` ga
  const { table, readTable, select, get, set, fromRow, toRow, sort, order, realtime = true } = cfg;
  const arrange = (list) => (sort ? [...list].sort(sort) : list);

  registerModule(name, {
    table, readTable, select, order, realtime,
    fromRow,
    restore: (rows) => set(arrange(rows)),
    apply: ({ eventType, new: row, old }) => {
      if (eventType === "DELETE") return set(get().filter((x) => x.id !== old.id));
      const item = fromRow(row);
      set(arrange([...get().filter((x) => x.id !== item.id), item]));
    },
  });

  // Bazaga tushayotgan yangi yozuvlar: vaqtinchalik id → haqiqiy id
  // va'dasi. Yozuv saqlanib ulgurmasdan turib o'zgartirilsa (masalan
  // "Yangi to'lov" darrov "To'lash" bilan to'lansa), yangilanish shu
  // va'dani kutadi. Busiz baza "invalid input syntax for type uuid:
  // p-3-..." deb rad etardi va yozuv bazada eski holicha qolib ketardi —
  // ekranda to'langan, bazada rejada. Foydalanuvchi uni ikkinchi marta
  // to'lardi va pul ikki marta kassadan chiqardi (2026-08-13).
  const creating = new Map();

  return {
    // Xotira allaqachon yangilangan; baza haqiqiy id qaytarsa almashtiramiz
    created: (item) => {
      const pr = insert(table, toRow(item), name).then((r) => {
        if (r?.data) set(get().map((x) => (x.id === item.id ? { ...x, id: r.data.id } : x)));
        return r;
      });
      creating.set(item.id, pr.then((r) => r?.data?.id ?? item.id));
      pr.finally(() => creating.delete(item.id));
      return pr;
    },
    changed: (item) => {
      if (!item) return null;
      const pending = creating.get(item.id);
      return pending
        ? pending.then((id) => dbUpdate(table, id, toRow(item), name))
        : dbUpdate(table, item.id, toRow(item), name);
    },
    deleted: (id) => {
      const pending = creating.get(id);
      return pending ? pending.then((real) => dbRemove(table, real, name)) : dbRemove(table, id, name);
    },
  };
}

// Bola jadvallar uchun (chek qatorlari, qarz to'lovlari, xizmat ishlari).
// Ular ota yozuv bilan birga o'qiladi, lekin alohida yoziladi.
export function childWriter(table, name) {
  return {
    created: (row) => insert(table, row, name),
    deleted: (id) => dbRemove(table, id, name),
  };
}
