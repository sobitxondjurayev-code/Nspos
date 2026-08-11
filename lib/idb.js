"use client";
// ══════════════════════════════════════════════════════════════
// BRAUZER XOTIRASI (IndexedDB)
// ══════════════════════════════════════════════════════════════
// Yuklangan hisobotlar shu yerga saqlanadi — sahifa yangilanganda ham
// turadi va baza (Supabase) sozlanmagan bo'lsa ham ishlaydi.
//
// Nega localStorage emas: localStorage ~5 MB bilan cheklangan, 17 000
// qatorli hisobot sig'maydi. IndexedDB yuzlab MB ko'taradi.
//
// Bu faqat SHU brauzerda saqlaydi. Boshqa qurilmadagi xodim ko'rishi
// uchun ma'lumot bazaga ham yoziladi (datasets jadvali). Ya'ni:
//   IndexedDB — tez, offline, har doim ishlaydi
//   Supabase  — qurilmalar orasida bo'lishish uchun

const DB_NAME = "nspos";
const STORE = "datasets";
const VERSION = 1;

let dbPromise = null;

function open() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);      // xato bo'lsa xotirasiz ishlaymiz
  });
  return dbPromise;
}

function tx(mode, fn) {
  return open().then((db) => {
    if (!db) return null;
    return new Promise((resolve) => {
      const t = db.transaction(STORE, mode);
      const store = t.objectStore(STORE);
      const result = fn(store);
      t.oncomplete = () => resolve(result?.result ?? result ?? true);
      t.onerror = () => resolve(null);
    });
  });
}

export const idbPut = (item) => tx("readwrite", (s) => s.put(item));
export const idbDelete = (id) => tx("readwrite", (s) => s.delete(id));
export const idbGetAll = () =>
  tx("readonly", (s) => s.getAll()).then((r) => (Array.isArray(r) ? r : (r?.result ?? [])));
