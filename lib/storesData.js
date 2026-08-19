"use client";
// ══════════════════════════════════════════════════════════════
// DO'KONLAR — DEMO VA BAZA O'RTASIDAGI KO'PRIK
// ══════════════════════════════════════════════════════════════
// Demo rejimda do'kon id'lari "s1"/"s2"/"s3". Bazada esa UUID.
// Agar har modul o'zi moslashtirsa, 15 joyda bir xil xato takrorlanadi.
//
// Shuning uchun almashtirish BITTA joyda bo'ladi: bazadan do'konlar
// kelganda demoStores massividagi OBYEKTLARNING o'zi (nusxasi emas)
// yangilanadi. Shu tufayli modul yuklanish paytida
// `demoStores.filter(...)` qilib qo'ygan joylar ham yangi id'ni ko'radi.
import { demoStores } from "./demoData";
import { registerModule } from "./db";

// Nomi bo'yicha moslaymiz — seed skripti aynan shu nomlarni yozadi
registerModule("stores", {
  table: "stores",
  select: "id,name,kind,is_active",
  restore(rows) {
    for (const row of rows) {
      const local = demoStores.find((s) => s.name === row.name);
      if (local) {
        local.id = row.id;          // obyektning o'zi yangilanadi
        local.kind = row.kind;
      } else {
        // Bazada qo'shilgan yangi do'kon
        demoStores.push({ id: row.id, name: row.name, kind: row.kind, color: "#8b96a8" });
      }
    }
  },
});

export const listStores = () => [...demoStores];
export const getStore = (id) => demoStores.find((s) => s.id === id) ?? null;
export const storeName = (id) => getStore(id)?.name ?? null;
