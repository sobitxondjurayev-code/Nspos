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
//
// ── BAZA RAD ETSA XOTIRA ORQAGA QAYTADI (2026-09-03) ──
// Yozuv modeli "xotira avval, baza fonda". Ilgari baza rad etsa
// (RLS, sessiya) xotira yangi holatda qolaverardi: ekranda saqlangan
// ko'rinardi, F5 da yo'qolardi — xodim "saqlash ishlamayapti" derdi,
// lekin qachon va nima yo'qolganini bilmasdi. Endi har modul uchun
// baza TASDIQLAGAN oxirgi holat eslab qolinadi (`tasdiq`) va rad
// bo'lsa xotira o'shanga qaytadi, ekran qayta chiziladi
// (`xotiraYangilandi` → `useLive`), toast sababini aytadi.
import {
  registerModule, insert, update as dbUpdate, remove as dbRemove, bumpData, xotiraYangilandi,
  supabase, DEMO_MODE, dbXabar, xatoMatni,
} from "./db";

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

  // `bumpData()` — xotira o'zgarganini keshlarga bildiradi (`db.dataVersion`).
  // U AYNAN shu yerda turadi: qatorlar almashadigan yagona joy shu, ya'ni
  // yangi modul qo'shilganda kesh tozalashni qayta eslash kerak emas.
  const qoy = (list) => { set(list); bumpData(); };

  // Baza tasdiqlagan oxirgi holat: bazadan kelgan qatorlar va
  // muvaffaqiyatli yozuvlar. Rad bo'lganda shunga qaytiladi.
  const tasdiq = new Map();
  const eslab = (list) => { for (const x of list) tasdiq.set(x.id, x); };

  // Rad etilgan yozuvni orqaga qaytarish: tasdiqlangan holat bo'lsa
  // o'sha, bo'lmasa (yangi yozuv edi) — ro'yxatdan chiqariladi.
  const orqaga = (id) => {
    const oldingi = tasdiq.get(id);
    qoy(oldingi
      ? arrange(get().map((x) => (x.id === id ? oldingi : x)))
      : get().filter((x) => x.id !== id));
    xotiraYangilandi();
  };
  const radMi = (r) => r && !r.ok;

  registerModule(name, {
    table, readTable, select, order, realtime,
    fromRow,
    restore: (rows) => { const l = arrange(rows); eslab(l); qoy(l); },
    apply: ({ eventType, new: row, old }) => {
      if (eventType === "DELETE") { tasdiq.delete(old.id); return qoy(get().filter((x) => x.id !== old.id)); }
      const item = fromRow(row);
      tasdiq.set(item.id, item);
      qoy(arrange([...get().filter((x) => x.id !== item.id), item]));
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
      bumpData();
      const pr = insert(table, toRow(item), name).then((r) => {
        if (r?.data) {
          const yangi = { ...item, id: r.data.id };
          set(get().map((x) => (x.id === item.id ? { ...x, id: r.data.id } : x)));
          tasdiq.set(r.data.id, yangi);
        } else if (radMi(r)) {
          orqaga(item.id);
        }
        return r;
      });
      creating.set(item.id, pr.then((r) => r?.data?.id ?? item.id));
      pr.finally(() => creating.delete(item.id));
      return pr;
    },
    changed: (item) => {
      if (!item) return null;
      bumpData();
      const pending = creating.get(item.id);
      const yoz = (id) => dbUpdate(table, id, toRow(item), name).then((r) => {
        if (r?.ok) tasdiq.set(id, { ...item, id });
        else if (radMi(r)) orqaga(id);
        return r;
      });
      return pending ? pending.then(yoz) : yoz(item.id);
    },
    deleted: (id) => {
      bumpData();
      const ochir = (real) => dbRemove(table, real, name).then((r) => {
        if (r?.ok) tasdiq.delete(real);
        else if (radMi(r)) {
          // O'chirish rad etildi (RLS 0 qator) — qator bazada turibdi,
          // ekranga ham qaytarib qo'yamiz
          const oldingi = tasdiq.get(real);
          if (oldingi && !get().some((x) => x.id === real)) {
            qoy(arrange([...get(), oldingi]));
            xotiraYangilandi();
          }
        }
        return r;
      });
      const pending = creating.get(id);
      return pending ? pending.then(ochir) : ochir(id);
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

// ══════════════════════════════════════════════════════════════
// BOLA QATORLARNI TO'LIQ QAYTA YOZISH (xizmat ishlari, ombor
// operatsiyasi qatorlari, partiya tovarlari/xarajatlari)
// ══════════════════════════════════════════════════════════════
// Tartib: AVVAL yangi qatorlar yoziladi, KEYIN eskilari o'chiriladi.
// Ilgari uchala modulda teskari edi va xato umuman tekshirilmasdi:
// insert RLS'da rad bo'lsa (kassir, usta) eski qatorlar allaqachon
// o'chib bo'lgan — buyurtma/operatsiya BO'SH qolardi, hech kim
// bilmasdi (2026-09-03). Bola jadvallarda unique cheklov yo'q,
// vaqtinchalik ikkilanish xavfsiz.
//
// @returns {Promise<boolean>} saqlandimi
export async function bolaQatorlar(table, parentCol, parentId, rows, nom) {
  if (DEMO_MODE) return true;
  let yangi = [];
  if (rows.length) {
    const { data, error } = await supabase.from(table).insert(rows).select("id");
    if (error) { console.error(`[db] ${nom}:`, error.message); dbXabar(`${nom}: ${xatoMatni(error)}`); return false; }
    yangi = (data ?? []).map((r) => r.id);
  }
  let q = supabase.from(table).delete().eq(parentCol, parentId);
  if (yangi.length) q = q.not("id", "in", `(${yangi.join(",")})`);
  const { error } = await q;
  if (error) { console.error(`[db] ${nom}:`, error.message); dbXabar(`${nom}: ${xatoMatni(error)}`); return false; }
  return true;
}
