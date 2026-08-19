"use client";
// ══════════════════════════════════════════════════════════════
// JADVAL USTUNLARI — foydalanuvchi sozlamasi
// ══════════════════════════════════════════════════════════════
// Rahbar Meta Ads Manager'dagidek ustunlarni o'zi tartiblashini
// so'radi: kerakligini oldinga surish, keraksizini yashirish.
//
// Saqlash joyi — brauzer (localStorage). Nega bazada emas:
//   • sozlama SHAXSIY, boshqa xodimga tegishli emas;
//   • u ma'lumot emas, ko'rinish — yo'qolib qolsa hech narsa
//     buzilmaydi, standart tartib qaytadi.
//
// Tuzilma: { order: ["cash", "payme", ...], hidden: ["diff"] }
//   order  — ustun kalitlari kerakli tartibda
//   hidden — yashirilganlari

const KEY = (id) => `nspos-cols:${id}`;

export function loadPrefs(id) {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function savePrefs(id, prefs) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY(id), JSON.stringify(prefs)); } catch {}
}

export function clearPrefs(id) {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(KEY(id)); } catch {}
}

// Sozlamani ustunlar ro'yxatiga qo'llaydi.
//   locked — yashirib bo'lmaydigan kalitlar (masalan "Sana"):
//            ularsiz jadval o'qilmay qoladi.
export function applyPrefs(columns, prefs, { locked = [] } = {}) {
  if (!prefs) return columns;

  const byKey = new Map(columns.map((c) => [c.key, c]));
  const ordered = [];
  for (const k of prefs.order ?? []) {
    if (byKey.has(k)) { ordered.push(byKey.get(k)); byKey.delete(k); }
  }
  // Sozlamadan KEYIN qo'shilgan yangi ustunlar yo'qolib ketmasin.
  // Oxiriga tashlab yubormaymiz ham: ular standart ro'yxatdagi o'z
  // joyiga — chapdagi qo'shnisidan keyin qo'yiladi. Masalan "Servis"
  // ustuni "Servis xarajatlari" dan OLDIN turishi kerak, oxirida emas.
  for (const c of columns) {
    if (!byKey.has(c.key)) continue;
    const idx = columns.indexOf(c);
    let at = idx === 0 ? 0 : ordered.length;
    for (let i = idx - 1; i >= 0; i--) {
      const p = ordered.findIndex((x) => x.key === columns[i].key);
      if (p >= 0) { at = p + 1; break; }
    }
    ordered.splice(at, 0, c);
    byKey.delete(c.key);
  }

  const hidden = new Set((prefs.hidden ?? []).filter((k) => !locked.includes(k)));
  return ordered.filter((c) => !hidden.has(c.key));
}
