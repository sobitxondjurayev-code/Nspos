"use client";
// ══════════════════════════════════════════════════════════════
// MA'LUMOT TO'PLAMLARI (DATASET)
// ══════════════════════════════════════════════════════════════
// NSPOS Billz'ni takrorlamaydi. Billz do'konda ishlaydi, bu yerga esa
// undan Excel yuklanadi va dashboard chiqadi.
//
// ASOSIY QARO'R: har hisobot uchun alohida jadval yasamaymiz.
// Billz'da 15 dan ortiq hisobot bor va ular vaqti-vaqti bilan
// o'zgaradi — har biriga jadval yozsak, har o'zgarishda baza
// migratsiyasi kerak bo'lardi.
//
// Buning o'rniga: qatorlar JSONB bo'lib saqlanadi, ustunlar esa
// YUKLASH PAYTIDA tahlil qilinadi (raqammi, sanami, matnmi). Shu
// tahlildan dashboard AVTOMATIK yig'iladi.
//
// Natija: notanish hisobot yuklansa ham ishlaydi — raqamli ustunlar
// yig'indi bo'ladi, sana ustuni grafik bo'ladi, matn ustunlari filtr
// bo'ladi. Tanish hisobotlar uchun esa pastdagi REPORTS ro'yxatida
// aniqroq sozlama beriladi.
import * as XLSX from "xlsx";

// —— Ustun turini aniqlash ————————————————————————
const isBlank = (v) => v == null || String(v).trim() === "";

const asNumber = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/\s| /g, "").replace(",", ".");
  if (!/^-?\d*\.?\d+%?$/.test(s)) return null;
  return parseFloat(s);
};

const asDate = (v) => {
  if (v instanceof Date && !isNaN(v)) return v;
  const s = String(v).trim();
  // 2026-07-22, 2026-07-22 14:38:01, 22.07.2026
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})([ T](\d{2}):(\d{2}))?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[5] ?? 0), +(m[6] ?? 0));
  m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
};

// Pul ustunini nomidan taxmin qilamiz — grafikda va yig'indida
// "USD" bilan ko'rsatish uchun
const MONEY = /summa|сумма|выручка|tushum|доход|прибыл|foyda|цена|narx|оплат|to'lov|долг|qarz|стоимост|tannarx|себестоимост|расход|xarajat|скидк|chegirma/i;
const PCT = /%|процент|foiz|доля|ulush|рентабельн|марж|marja/i;

// RAQAMGA O'XSHAGAN, LEKIN RAQAM EMAS ustunlar.
// Shtrix-kod, artikul, chek raqami — bular belgilar, ularni qo'shib
// bo'lmaydi. Aks holda "Баркод: 35 608 000 048 754 100" degan
// ma'nosiz yig'indi chiqadi. Bunday ustunlar filtr va qidiruv uchun
// qoladi, lekin ko'rsatkich sifatida taklif qilinmaydi.
const IDENT = /баркод|штрих|barcode|артикул|artikul|sku|^id$|id транзакции|id импорта|номер|raqam|чек|телефон|telefon|инн|код/i;

// Har ustunni namuna qatorlar bo'yicha tekshiramiz
function profileColumn(name, values) {
  const filled = values.filter((v) => !isBlank(v));
  if (!filled.length) return { key: name, label: name, type: "text", empty: true };

  const nums = filled.filter((v) => asNumber(v) !== null).length;
  const dates = filled.filter((v) => asDate(v) !== null).length;

  // 80% chegara: bitta-ikkita buzuq katak turni o'zgartirmasin
  if (dates / filled.length >= 0.8 && nums / filled.length < 0.8) {
    return { key: name, label: name, type: "date" };
  }
  if (nums / filled.length >= 0.8) {
    // Belgi ustuni bo'lsa — raqam emas, matn kabi ishlanadi
    if (IDENT.test(name)) {
      const uniq = new Set(filled.map((v) => String(v).trim()));
      return {
        key: name, label: name, type: "ident",
        distinct: uniq.size,
        filterable: uniq.size > 1 && uniq.size <= 60,
        options: uniq.size <= 60 ? [...uniq].sort() : null,
      };
    }
    return {
      key: name, label: name,
      type: PCT.test(name) ? "percent" : MONEY.test(name) ? "money" : "number",
    };
  }
  // Takrorlanuvchi matn — filtr uchun qulay (do'kon, kategoriya, kassir)
  const uniq = new Set(filled.map((v) => String(v).trim()));
  return {
    key: name, label: name, type: "text",
    distinct: uniq.size,
    // 1 dan ko'p, lekin 60 tadan kam bo'lsa — ro'yxatli filtr bo'la oladi
    filterable: uniq.size > 1 && uniq.size <= 60,
    options: uniq.size <= 60 ? [...uniq].sort() : null,
  };
}

// —— Faylni o'qish ————————————————————————————————
export async function readWorkbook(file) {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  return wb.SheetNames.map((sheetName) => {
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      header: 1, defval: "", blankrows: false,
    });
    // Sarlavha qatorini topish. Ikki mezon kerak:
    //   1. To'ldirilgan katak ko'p bo'lsin (Billz tepaga hisobot nomi
    //      va davrni yozib qo'yadi — ular kalta qator bo'ladi)
    //   2. Kataklar MATN bo'lsin. "Tovar samaradorligi" hisobotida
    //      sarlavha ikki qatorli va ma'lumot qatorlari undan ko'proq
    //      to'ldirilgan — faqat 1-mezon bilan raqamli qator sarlavha
    //      deb olinib, butun fayl buzilardi.
    // Matnli sarlavhaga o'xshaydimi
    const isHeaderRow = (r) => {
      if (!r) return false;
      const filled = r.filter((c) => !isBlank(c));
      if (filled.length < 2) return false;
      const texty = filled.filter((c) => asNumber(c) === null && asDate(c) === null).length;
      return texty / filled.length >= 0.7;
    };
    const filledCount = (r) => (r ?? []).filter((c) => !isBlank(c)).length;

    // 1) Avval IKKI QATORLI sarlavhani qidiramiz. "Tovar samaradorligi"da
    //    yuqori qator guruh nomi ("Продажи товаров") — bo'sh kataklari ko'p,
    //    pastki qator esa ustun nomlari ("Кол-во") — zichroq to'lgan.
    //    Diqqat: eng ko'p to'lgan qatorni tanlash bu yerda XATO bo'ladi —
    //    u pastki qatorni oladi va guruh nomlari yo'qoladi, natijada
    //    "Сумма продажи" o'n bir marta takrorlanib ma'lumot ustma-ust tushadi.
    let headerIdx = -1, twoRow = false;
    for (let i = 0; i < Math.min(raw.length, 10); i++) {
      if (!isHeaderRow(raw[i]) || !isHeaderRow(raw[i + 1])) continue;
      const gaps = raw[i].filter((c) => isBlank(c)).length;
      if (gaps >= 2 && filledCount(raw[i + 1]) > filledCount(raw[i])) {
        headerIdx = i; twoRow = true; break;
      }
    }

    // 2) Aks holda — eng ko'p to'lgan matnli qator (bir qatorli sarlavha).
    //    Billz tepaga hisobot nomi va davrni yozib qo'yadi — ular kalta.
    if (headerIdx < 0) {
      headerIdx = 0;
      let best = -1;
      for (let i = 0; i < Math.min(raw.length, 10); i++) {
        if (!isHeaderRow(raw[i])) continue;
        if (filledCount(raw[i]) > best) { best = filledCount(raw[i]); headerIdx = i; }
      }
    }

    const top = raw[headerIdx] ?? [];
    const next = raw[headerIdx + 1] ?? [];

    const width = Math.max(top.length, twoRow ? next.length : 0);
    // Guruh nomi faqat o'z blokining BIRINCHI katagida turadi
    // ("Продажи товаров" → keyingi uch ustun bo'sh). Uni oldinga
    // tarqatmasak, "Сумма продажи" o'n bir marta takrorlanib, barcha
    // guruhlar bitta ustunga tushib qolardi — ma'lumotning yarmi yo'qolardi.
    let group = "";
    // Takrorlanadigan nomlar: ДДС eksportida "Сумма ИЗ (USD)" ikki marta
    // keladi (ikkinchisi boshqa valyuta uchun, doim bo'sh). Nom bir xil
    // bo'lsa qator obyektida keyingisi oldingisini bosib ketardi va
    // haqiqiy summa yo'qolardi — shuning uchun raqam qo'shib ajratamiz.
    const seen = new Map();
    const header = Array.from({ length: width }, (_, i) => {
      const a = String(top[i] ?? "").trim();
      const b = twoRow ? String(next[i] ?? "").trim() : "";
      if (a) group = a;
      const g = a || (b ? group : "");
      const base = [g, b].filter(Boolean).join(" · ") || `Ustun ${i + 1}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      return n === 1 ? base : `${base} (${n})`;
    });

    const dataStart = headerIdx + (twoRow ? 2 : 1);
    const rows = raw.slice(dataStart)
      .filter((r) => r.some((c) => !isBlank(c)))
      .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
    return { sheetName, header, rows };
  }).filter((s) => s.rows.length > 0);
}

// —— To'plamni tahlil qilish ————————————————————————
export function profile(header, rows) {
  const sample = rows.slice(0, 400);
  const columns = header.map((h) => profileColumn(h, sample.map((r) => r[h])));
  return {
    columns,
    rowCount: rows.length,
    dateColumn: columns.find((c) => c.type === "date")?.key ?? null,
    moneyColumns: columns.filter((c) => c.type === "money").map((c) => c.key),
    numberColumns: columns.filter((c) => c.type === "number").map((c) => c.key),
    filterColumns: columns.filter((c) => c.filterable).map((c) => c.key),
    labelColumn: columns.find((c) => c.type === "text" && c.distinct > 5)?.key
      ?? columns.find((c) => c.type === "text")?.key ?? null,
    identColumns: columns.filter((c) => c.type === "ident").map((c) => c.key),
  };
}

// —— Tanish Billz hisobotlari ————————————————————————
// Sarlavhalardan tanib olamiz. Tanilsa nom chiroyli chiqadi va
// dashboard sozlamasi aniqroq bo'ladi. Tanilmasa ham ishlaydi.
export const REPORTS = [
  { id: "clients", label: "Mijozlar",
    match: ["ФИО клиента", "Общая сумма покупок"], key: "ФИО клиента" },
  { id: "abc_clients", label: "Mijozlar ABC tahlili",
    match: ["ФИО клиента", "ABC"], key: "ФИО клиента" },
  { id: "transactions", label: "Tranzaksiyalar",
    match: ["ID транзакции", "Тип транзакции"], key: "ID транзакции" },
  // Billz'ning "Отчет по долгам" faylida aynan shu ikki ustun bor:
  // "Остаток долга" va "Клиент". Fayl tepasida uchta sarlavha qatori
  // bo'ladi (hisobot nomi va sanalar) — readWorkbook ularni o'zi
  // o'tkazib yuboradi, ustunlar 5-qatordan boshlanadi.
  { id: "client_debts", label: "Mijozlar qarzi",
    match: ["Остаток долга", "Клиент"], key: "Клиент" },
  { id: "seller_products", label: "Sotuvchi × tovar",
    match: ["Продавец", "Кол-во проданных", "Наименование"], key: "Продавец" },
  { id: "product_sales", label: "Tovar bo'yicha sotuvlar",
    match: ["Наименование", "Кол-во проданных"], key: "Наименование" },
  { id: "sellers", label: "Sotuvchilar bo'yicha",
    match: ["Продавец", "Выручка"], key: "Продавец" },
  { id: "stock", label: "Qoldiqlar",
    match: ["Наименование товара", "Цена поставки"], key: "Наименование товара" },
  { id: "imports", label: "Importlar",
    match: ["ID импорта"], key: "ID импорта" },
  { id: "writeoffs", label: "Hisobdan chiqarishlar",
    match: ["Причина списания"], key: "Наименование" },
  // Billz "Эффективность товаров" eksportida "Оборачиваемость" ustuni
  // YO'Q — hisobot ikki qatorli sarlavha bilan keladi va harakatlar
  // guruhlarga bo'linadi. Shuning uchun aynan shu guruhlar bo'yicha
  // aniqlaymiz (birlashtirilgan nom: "Продажи товаров … · Кол-во").
  { id: "efficiency", label: "Tovar samaradorligi",
    match: ["Продажи товаров", "Остаток на", "Списания товаров"], key: "Наименование" },
  // "ЧИСТАЯ ПРИБЫЛЬ" bo'yicha qidirish XATO edi: u ustun nomi emas,
  // "Тип" ustunining ichidagi QATOR qiymati. Shuning uchun hisobot hech
  // qachon tanilmasdi. Haqiqiy sarlavha: Магазин | Тип | Всего | oylar.
  { id: "pnl", label: "Foyda va zarar",
    match: ["Магазин", "Тип", "Всего"], key: null },
  // ДДС eksportining haqiqiy ustuni "Тип денежной операции" — ilgari
  // "Тип операции" deb yozilgani uchun fayl tanilmasdi.
  { id: "cashflow", label: "Pul oqimi (ДДС)",
    match: ["Касса", "Тип транзакции", "Сумма"], key: null },
  // "Сводный отчет" — kunlik yakun. Bu ro'yxatda yo'q edi, holbuki
  // P&L uchun eng kerakli manba: kun va do'kon kesimida tushum, sof
  // tushum va YALPI FOYDA bor. Tannarx o'shandan chiqadi:
  // tannarx = sof tushum − yalpi foyda.
  { id: "summary", label: "Kunlik yakun (Сводный)",
    match: ["Дата", "Магазин", "Выручка", "Валовая прибыль"], key: null },
];

const norm = (s) => String(s).toLowerCase().replace(/[^a-zа-яё0-9]/gi, "");

// Aynan tenglik emas, ICHIDA BORLIGI tekshiriladi: Billz ustunlarga
// izoh qo'shib yuboradi ("Общая сумма покупок (всего)") va aynan
// solishtirish shu sababdan ishlamay qolardi.
export function detectReport(header) {
  const cols = header.map(norm);
  const has = (m) => cols.some((c) => c.includes(norm(m)));

  let best = null, bestScore = 0;
  for (const r of REPORTS) {
    if (!r.match.every(has)) continue;
    // Bir nechta hisobot mos kelsa — sharti ko'prog'i aniqroq
    if (r.match.length > bestScore) { best = r; bestScore = r.match.length; }
  }
  return best;
}

// —— Qiymatlarni o'qish (dashboard hisoblari uchun) ————————
export const numberOf = (row, key) => asNumber(row?.[key]) ?? 0;
export const dateOf = (row, key) => asDate(row?.[key]);
export const textOf = (row, key) => String(row?.[key] ?? "").trim();

// —— Yuklangan to'plamlar ————————————————————————————
// Uch qatlamli saqlash:
//   1. Xotira (RAM) — sahifa ochiq turganda
//   2. IndexedDB   — sahifa yangilanganda ham turadi, SQL kerak emas
//   3. Supabase    — qurilmalar orasida bo'lishish (datasets jadvali)
import { supabase, DEMO_MODE, registerModule } from "./db";
import { idbPut, idbDelete, idbGetAll } from "./idb";

let datasets = [];
let seq = 0;

export const listDatasets = () => [...datasets].sort((a, b) => (a.at < b.at ? 1 : -1));
export const getDataset = (id) => datasets.find((d) => d.id === id) ?? null;

// Ilova ochilganda brauzer xotirasidan tiklaymiz. Baza (agar bor bo'lsa)
// ham yuklaydi — bir xil hisobot ikkalasida bo'lsa, brauzerdagisi
// ustun turadi (u to'liq qatorlari bilan keladi).
export async function loadLocal() {
  const saved = await idbGetAll();
  if (!saved?.length) return;
  const byId = new Map(datasets.map((d) => [d.id, d]));
  for (const d of saved) byId.set(d.id, d);
  datasets = [...byId.values()];
}

// Ro'yxat ilova ochilganda yuklanadi — lekin QATORLARSIZ.
// 17 000 qatorli beshta hisobotni birdan tortib olish ortiqcha:
// qatorlar faqat dashboard ochilganda kerak bo'ladi.
registerModule("datasets", {
  table: "datasets",
  select: "id,name,report_id,report_label,file_name,sheet_name,header,profile,row_count,created_at",
  order: { column: "created_at", ascending: false },
  fromRow: (r) => ({
    id: r.id, name: r.name,
    reportId: r.report_id, reportLabel: r.report_label,
    fileName: r.file_name, sheetName: r.sheet_name,
    header: r.header, profile: r.profile,
    rowCount: r.row_count,
    rows: null,                 // hali yuklanmagan
    at: r.created_at,
  }),
  restore(list) { datasets = list; },
});

// Dashboard ochilganda qatorlarni tortamiz.
// Brauzer xotirasida allaqachon bo'lsa (rows to'la) — bazaga bormaymiz.
export async function loadRows(id) {
  const d = getDataset(id);
  if (!d || d.rows || DEMO_MODE) return d;

  const { data, error } = await supabase
    .from("dataset_chunks").select("seq,rows").eq("dataset_id", id).order("seq");
  if (error) { console.error("[datasets]", error.message); return d; }

  const rows = data.flatMap((c) => c.rows);
  datasets = datasets.map((x) => (x.id === id ? { ...x, rows } : x));
  return getDataset(id);
}

const CHUNK = 1000;

export async function addDataset({ name, reportId, reportLabel, header, rows, sheetName, fileName }) {
  const pf = profile(header, rows);
  const local = {
    id: "ds-" + (++seq) + "-" + Date.now().toString(36),
    name, reportId, reportLabel, sheetName, fileName,
    header, rows, profile: pf, rowCount: rows.length,
    at: new Date().toISOString(),
  };
  datasets = [local, ...datasets];
  // Har doim brauzer xotirasiga saqlaymiz — sahifa yangilanganda ham
  // tursin, baza bo'lmasa ham ishlasin
  idbPut(local);

  if (DEMO_MODE) return local;

  const { data, error } = await supabase.from("datasets").insert({
    name, report_id: reportId, report_label: reportLabel,
    file_name: fileName, sheet_name: sheetName,
    header, profile: pf, row_count: rows.length,
  }).select("id").single();
  // Jadval yo'q yoki xato — brauzerdagi nusxa yetarli, ishlayveradi
  if (error) { console.error("[datasets]", error.message); return local; }

  // Vaqtinchalik id'ni bazadagi id'ga almashtiramiz (brauzerda ham)
  datasets = datasets.map((x) => (x.id === local.id ? { ...x, id: data.id } : x));
  idbDelete(local.id);
  idbPut({ ...local, id: data.id });

  for (let i = 0; i * CHUNK < rows.length; i++) {
    const slice = rows.slice(i * CHUNK, (i + 1) * CHUNK);
    const { error: e2 } = await supabase.from("dataset_chunks")
      .insert({ dataset_id: data.id, seq: i, rows: slice });
    if (e2) { console.error("[datasets] bo'lak", i, e2.message); break; }
  }
  return getDataset(data.id) ?? local;
}

export async function removeDataset(id) {
  datasets = datasets.filter((d) => d.id !== id);
  idbDelete(id);
  if (!DEMO_MODE) await supabase.from("datasets").delete().eq("id", id);
}

// Bir xil hisobot qayta yuklansa — eskisi almashtiriladi.
// Aks holda ro'yxat bir xil nomdagi to'plamlar bilan to'lib ketadi.
export async function replaceDataset(reportId, payload) {
  if (reportId) {
    for (const old of datasets.filter((d) => d.reportId === reportId)) {
      await removeDataset(old.id);
    }
  }
  return addDataset(payload);
}
