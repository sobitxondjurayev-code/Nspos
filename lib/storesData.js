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
//
// 2026-09-03: bog'lash NOM bo'yicha emas, `stores.code` (s1/s2/s3)
// bo'yicha. Nom endi ko'rsatish uchun va rahbar Sozlamalarda
// o'zgartiradi — nom o'zgarsa do'kon ikkilanmaydi, kassa yo'qolmaydi.
// `billz_names` — Billz do'kon/kassa nomlaridagi kalit so'zlar
// (`storeOfBillzName`), `kind` — shop | warehouse (`skladId`).
import { demoStores } from "./demoData";
import { registerModule, update, xotiraYangilandi } from "./db";

registerModule("stores", {
  table: "stores",
  select: "id,code,name,kind,is_active,billz_names",
  realtime: true,
  restore: (rows) => qoy(rows),
  apply: ({ new: row }) => { if (row) qoy([row]); },
});

function qoy(rows) {
  for (const row of rows) {
    // Avval kod bo'yicha (barqaror), so'ng nom (migratsiyagacha zaxira)
    const local = demoStores.find((s) => s.id === row.id)
      ?? (row.code ? demoStores.find((s) => s.code === row.code) : null)
      ?? demoStores.find((s) => s.name === row.name);
    const maydonlar = {
      id: row.id, name: row.name, kind: row.kind, code: row.code ?? null,
      billzNames: Array.isArray(row.billz_names) ? row.billz_names : [],
      isActive: row.is_active !== false,
    };
    if (local) Object.assign(local, maydonlar);   // obyektning o'zi yangilanadi
    else demoStores.push({ ...maydonlar, color: "#8b96a8" });   // bazada qo'shilgan yangi do'kon
  }
}

export const listStores = () => [...demoStores];
export const getStore = (id) => demoStores.find((s) => s.id === id) ?? null;
export const storeName = (id) => getStore(id)?.name ?? null;
export const storeByCode = (code) => demoStores.find((s) => s.code === code) ?? null;

// Sklad (markaziy ombor) — `kind = 'warehouse'`, bo'lmasa nomidan.
// Qoldiq salomatligi filial tanlanganda "Skladda bormi" deb shundan
// qaraydi (2026-09-03: filialda 0, Skladda 50 bo'lsa ham "tugagan"
// chiqardi — buyurtma emas, ko'chirish kerak edi).
export const skladId = () =>
  (demoStores.find((s) => s.kind === "warehouse")
    ?? demoStores.find((s) => /sklad|склад|ombor/i.test(s.name ?? "")))?.id ?? null;

// Standart do'kon — biror joyda do'kon tanlanmagan bo'lsa (yangi sotuv,
// xizmat buyurtmasi, import). Ilgari `demoStores[0]` — massiv tartibiga
// bog'liq edi; endi kod bo'yicha, bo'lmasa birinchi ombor bo'lmagan.
export const asosiyDokonId = () =>
  (storeByCode("s1") ?? demoStores.find((s) => s.kind !== "warehouse") ?? demoStores[0])?.id ?? null;

// Billz do'kon/kassa nomi → do'kon id. `billz_names` dagi kalit so'zlar
// nom ichida uchrasa (uzun so'z avval — "nscamera namangan" "nscamera"
// dan oldin), bo'lmasa do'kon nomining o'zi nom ichida bormi.
export function storeOfBillzName(name) {
  const n = String(name ?? "").toLowerCase().trim();
  if (!n) return null;
  const nomzodlar = demoStores.flatMap((s) => (s.billzNames ?? []).map((k) => ({ k: String(k).toLowerCase(), id: s.id })))
    .sort((a, b) => b.k.length - a.k.length);
  for (const { k, id } of nomzodlar) if (k && n.includes(k)) return id;
  const direct = demoStores.find((s) => n.includes(String(s.name ?? "").toLowerCase()));
  return direct?.id ?? null;
}

// Rahbar Sozlamalardan: nom, tur, Billz nomlari. Rad bo'lsa orqaga.
export function updateStore(id, patch) {
  const s = getStore(id);
  if (!s) return Promise.resolve({ ok: false });
  const oldingi = { ...s };
  Object.assign(s, patch);
  const row = {};
  if (patch.name !== undefined) row.name = String(patch.name).trim();
  if (patch.kind !== undefined) row.kind = patch.kind;
  if (patch.billzNames !== undefined) row.billz_names = patch.billzNames.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  return update("stores", id, row, "Do'kon").then((r) => {
    if (r && !r.ok) { Object.assign(s, oldingi); xotiraYangilandi(); }
    else xotiraYangilandi();
    return r;
  });
}
