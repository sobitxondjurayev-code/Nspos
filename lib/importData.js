"use client";
// Billz (yoki boshqa tizim) hisobotlarini Excel/CSV dan yuklash.
//
// Billz eksportining ustun nomlari versiyaga qarab o'zgarishi mumkin,
// shuning uchun format qattiq belgilanmagan: fayl o'qilgach, foydalanuvchi
// ustunlarni o'zi moslashtiradi. Nomlar tanish bo'lsa avtomatik topiladi.
import * as XLSX from "xlsx";
import { demoStores } from "./demoData";
import { allProducts, addProduct, updateProduct, genBarcode } from "./productsData";
import { demoCategories, addCategory } from "./productsData";
import { addImportedSale } from "./salesData";

// —— Maydonlar va ularning mumkin bo'lgan nomlari ————————————
// Avtomatik topish uchun: uz / ru / en variantlari
// Ruscha nomlar haqiqiy Billz hisobotlaridan olingan (nskamera.billz.io):
// Каталог      — Наименование, Артикул, Баркод, Категория, Цена поставки, Цена продажи, Кол-во
// Отчет по остаткам — + Магазин, Бренд, Поставщик, Ед. измерения, Маржа
// Продажи по товарам — Магазин, Дата, Наименование, Артикул, Баркод, Категория,
//                      Кол-во проданных, Кол-во возвращенных, Продажи без учета скидки
const F = {
  name: { label: "Tovar nomi", aliases: ["nom", "nomi", "tovar", "mahsulot", "название", "наименование", "товар", "name", "product"] },
  sku: { label: "SKU / Artikul", aliases: ["sku", "artikul", "артикул", "код товара"] },
  // Billz "Баркод" deb yozadi, "Штрихкод" emas
  barcode: { label: "Shtrix-kod", aliases: ["barcode", "баркод", "shtrix", "штрих", "штрихкод", "ean"] },
  category: { label: "Kategoriya", aliases: ["kategoriya", "guruh", "категория", "группа", "category"] },
  // Diqqat: "цена" yolg'iz alias sifatida ishlatilmaydi — u "Цена продажи" ni ham tutib olardi
  costPrice: { label: "Tannarx", aliases: ["tannarx", "цена поставки", "себестоимость", "закупка", "закуп", "cost", "приход"] },
  salePrice: { label: "Sotuv narxi", aliases: ["sotuv narxi", "цена продажи", "narx", "цена", "price"] },
  qty: { label: "Miqdor", aliases: ["miqdor", "soni", "qoldiq", "кол-во проданных", "кол-во", "количество", "остаток", "qty", "quantity"] },
  store: { label: "Do'kon", aliases: ["dokon", "do'kon", "магазин", "store", "склад", "ombor", "филиал"] },
  receiptNo: { label: "Chek raqami", aliases: ["chek", "чек", "продажа", "id транзакции", "номер транзакции", "transaction", "receipt"] },
  date: { label: "Sana", aliases: ["sana", "дата", "date", "vaqt", "время"] },
  cashier: { label: "Kassir", aliases: ["kassir", "кассир", "sotuvchi", "продавец", "пользователь", "user"] },
  total: { label: "Summa", aliases: ["summa", "сумма", "jami", "итого", "продажи без учета скидки", "total", "amount"] },
};

// —— Import turlari ————————————————————————————————
export const IMPORT_TYPES = {
  products: {
    label: "Tovarlar",
    hint: "Katalogni to'ldiradi. Shtrix-kod yoki SKU bo'yicha mavjud tovar topilsa yangilanadi.",
    required: ["name"],
    fields: ["name", "sku", "barcode", "category", "costPrice", "salePrice"],
  },
  stock: {
    label: "Qoldiqlar",
    hint: "Do'konlar kesimida qoldiqni yangilaydi. Tovar shtrix-kod yoki SKU bo'yicha topiladi.",
    required: ["qty"],
    fields: ["barcode", "sku", "name", "store", "qty"],
  },
  sales: {
    label: "Sotuvlar",
    hint: "Cheklar tarixini yuklaydi. Bir chekdagi qatorlar chek raqami bo'yicha birlashtiriladi.",
    required: ["qty"],
    fields: ["receiptNo", "date", "barcode", "sku", "name", "qty", "salePrice", "store", "cashier"],
  },
};

export const fieldLabel = (key) => F[key]?.label ?? key;

// —— Faylni o'qish ————————————————————————————————
export async function parseFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { columns: [], rows: [] };

  // header:1 — birinchi qator sarlavha sifatida emas, oddiy massiv bo'lib keladi
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
  if (!raw.length) return { columns: [], rows: [] };

  // Sarlavha qatori — birinchi to'ldirilgan qator
  const headerIdx = raw.findIndex((r) => r.some((c) => String(c).trim() !== ""));
  const header = raw[headerIdx].map((c, i) => String(c).trim() || `Ustun ${i + 1}`);

  const rows = raw.slice(headerIdx + 1)
    .filter((r) => r.some((c) => String(c).trim() !== ""))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));

  return { columns: header, rows, sheetName: wb.SheetNames[0] };
}

// —— Ustunlarni avtomatik moslashtirish ————————————————
// Ustun nomi ham, alias ham AYNAN shu funksiyadan o'tkaziladi.
// Aks holda "Кол-во" → "кол во" bo'lib, "кол-во" alias'iga mos kelmay qolardi.
const norm = (s) =>
  String(s).toLowerCase().replace(/[^a-zа-яё0-9']/gi, " ").replace(/\s+/g, " ").trim();

export function autoMap(columns, type) {
  const mapping = {};
  const used = new Set();
  const fields = IMPORT_TYPES[type].fields;

  // 1-bosqich: barcha maydonlar bo'yicha AYNAN mos keladiganlarini olamiz.
  // Bu bosqich birinchi bo'lishi shart: aks holda oldinroq turgan maydon
  // qisman moslik bilan keyingi maydonning ustunini o'g'irlab ketardi
  // (masalan "Цена поставки" ni "Цена продажи" o'rniga olib qo'yish).
  for (const field of fields) {
    const aliases = F[field].aliases.map(norm);
    const col = columns.find((c) => !used.has(c) && aliases.includes(norm(c)));
    if (col) { mapping[field] = col; used.add(col); }
  }

  // 2-bosqich: qolganlari uchun qisman moslik.
  // Faqat "ustun nomi alias'ni o'z ichiga oladi" yo'nalishi tekshiriladi —
  // teskarisi "Цена" ustunini "цена поставки" ga bog'lab yuborardi.
  for (const field of fields) {
    if (mapping[field]) continue;
    const aliases = F[field].aliases.map(norm).sort((a, b) => b.length - a.length);
    const col = columns.find((c) =>
      !used.has(c) && aliases.some((a) => a.length >= 4 && norm(c).includes(a))
    );
    if (col) { mapping[field] = col; used.add(col); }
  }

  return mapping;
}

// —— Yordamchilar ————————————————————————————————
const num = (v) => {
  if (typeof v === "number") return v;
  // "1 234,56" yoki "1,234.56" ko'rinishlarini ham tushunadi
  const s = String(v).replace(/\s/g, "").replace(/,(\d{1,2})$/, ".$1").replace(/,/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

const toDate = (v) => {
  if (v instanceof Date && !isNaN(v)) {
    // xlsx sanali katakni UTC yarim tuni sifatida beradi. Uni shundayligicha
    // qoldirsak, manfiy vaqt mintaqasida sana bir kun orqaga surilib ketadi.
    // Shuning uchun UTC komponentlaridan mahalliy sanani qayta yig'amiz.
    if (v.getUTCHours() === 0 && v.getUTCMinutes() === 0 && v.getUTCSeconds() === 0) {
      return new Date(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate(), 12, 0);
    }
    return v;
  }
  const s = String(v).trim();

  // Billz hisobotlari ISO ko'rinishida beradi: 2026-07-19 yoki 2026-07-19 14:35.
  // new Date("2026-07-19") ni ishlatib bo'lmaydi — u UTC yarim tuni deb o'qiladi
  // va manfiy vaqt mintaqalarida bir kun orqaga surilib ketadi.
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2}))?/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3], +(iso[4] || 12), +(iso[5] || 0));

  // 19.07.2026 yoki 19.07.2026 14:35
  const m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 12), +(m[5] || 0));

  const d = new Date(s);
  return isNaN(d) ? null : d;
};

// Kirillchadan lotinchaga o'girish.
// Billz do'konni "Склад" deb yozadi, bizda esa "Sklad" — transliteratsiyasiz
// mos kelmaydi va tovar noto'g'ri do'konga tushib qoladi.
const CYR = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "j", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "x", ц: "c", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i",
  ь: "", э: "e", ю: "yu", я: "ya",
};
const translit = (s) => String(s).toLowerCase().replace(/[а-яё]/g, (c) => CYR[c] ?? c);

// Do'kon nomini mavjud do'konlarga moslashtirish (kirill/lotin farqi hisobga olinadi)
function matchStore(value) {
  const s = translit(norm(value));
  if (!s) return null;
  const key = (st) => translit(norm(st.name));
  const found = demoStores.find((st) => key(st) === s)
    ?? demoStores.find((st) => key(st).includes(s) || s.includes(key(st)));
  return found?.id ?? null;
}

// Tovarni shtrix-kod → SKU → nom tartibida topish
function matchProduct(row, catalog) {
  const bc = String(row.barcode ?? "").trim();
  if (bc) {
    const byBc = catalog.find((p) => p.barcode === bc);
    if (byBc) return byBc;
  }
  const sku = String(row.sku ?? "").trim().toLowerCase();
  if (sku) {
    const bySku = catalog.find((p) => p.sku?.toLowerCase() === sku);
    if (bySku) return bySku;
  }
  const name = norm(row.name ?? "");
  if (name) {
    const byName = catalog.find((p) => norm(p.name) === name);
    if (byName) return byName;
  }
  return null;
}

// Mapping bo'yicha bitta qatorni maydonlarga aylantirish
const readRow = (raw, mapping) =>
  Object.fromEntries(
    Object.entries(mapping).map(([field, col]) => [field, raw[col]])
  );

// —— Ko'rib chiqish: import qilinsa nima bo'lishini oldindan hisoblash ——
export function previewImport(type, rows, mapping, opts = {}) {
  const catalog = allProducts();
  const result = { create: 0, update: 0, skip: 0, errors: [], sample: [] };
  const required = IMPORT_TYPES[type].required;

  rows.forEach((raw, i) => {
    const r = readRow(raw, mapping);

    // Majburiy maydonlar to'ldirilganmi
    const missing = required.filter((f) => String(r[f] ?? "").trim() === "");
    if (missing.length) {
      result.skip++;
      if (result.errors.length < 8) {
        result.errors.push({ line: i + 2, msg: `${missing.map(fieldLabel).join(", ")} bo'sh` });
      }
      return;
    }

    if (type === "products") {
      const found = matchProduct(r, catalog);
      found ? result.update++ : result.create++;
      // Keyingi qatorlarda shu tovar "yangilanadi" deb sanalsin —
      // Billz hisobotida bitta shtrix-kod bir necha qatorda keladi
      if (!found) {
        catalog.push({
          id: "preview", barcode: String(r.barcode ?? "").trim(),
          sku: String(r.sku ?? "").trim(), name: String(r.name ?? "").trim(),
        });
      }
      if (result.sample.length < 5) {
        result.sample.push({
          nom: r.name, sku: r.sku ?? "—", barcode: r.barcode ?? "—",
          tannarx: num(r.costPrice), narx: num(r.salePrice),
          holat: found ? "yangilanadi" : "qo'shiladi",
        });
      }
    } else if (type === "stock") {
      const found = matchProduct(r, catalog);
      if (!found) {
        result.skip++;
        if (result.errors.length < 8) {
          result.errors.push({ line: i + 2, msg: "Katalogdan tovar topilmadi" });
        }
        return;
      }
      const storeId = matchStore(r.store) ?? opts.defaultStore;
      if (!storeId) {
        result.skip++;
        if (result.errors.length < 8) {
          result.errors.push({ line: i + 2, msg: "Do'kon aniqlanmadi" });
        }
        return;
      }
      result.update++;
      if (result.sample.length < 5) {
        result.sample.push({
          nom: found.name, dokon: demoStores.find((s) => s.id === storeId)?.name,
          eski: found.stock[storeId] ?? 0, yangi: num(r.qty), holat: "yangilanadi",
        });
      }
    } else if (type === "sales") {
      const found = matchProduct(r, catalog);
      if (!found) {
        result.skip++;
        if (result.errors.length < 8) {
          result.errors.push({ line: i + 2, msg: "Katalogdan tovar topilmadi" });
        }
        return;
      }
      result.create++;
      if (result.sample.length < 5) {
        result.sample.push({
          chek: r.receiptNo ?? "—", nom: found.name, miqdor: num(r.qty),
          narx: num(r.salePrice) || found.salePrice, holat: "qo'shiladi",
        });
      }
    }
  });

  return result;
}

// —— Haqiqiy import ————————————————————————————————
export function runImport(type, rows, mapping, opts = {}) {
  const catalog = allProducts();
  const stats = { created: 0, updated: 0, skipped: 0 };
  const required = IMPORT_TYPES[type].required;

  const valid = rows.filter((raw) => {
    const r = readRow(raw, mapping);
    const ok = required.every((f) => String(r[f] ?? "").trim() !== "");
    if (!ok) stats.skipped++;
    return ok;
  });

  if (type === "products") {
    for (const raw of valid) {
      const r = readRow(raw, mapping);
      const found = matchProduct(r, catalog);
      const catName = norm(r.category);
      // Kategoriya topilmasa YARATAMIZ — Billz'da o'nlab kategoriya bor,
      // hammasini birinchi kategoriyaga tashlab yuborish katalogni buzadi.
      // "-" yoki bo'sh qiymat esa haqiqatan noma'lum degani.
      let cat = demoCategories.find((c) => norm(c.name) === catName);
      if (!cat && catName && catName !== "-") {
        cat = addCategory(String(r.category).trim());
      }

      const data = {
        name: String(r.name).trim(),
        sku: String(r.sku ?? "").trim(),
        barcode: String(r.barcode ?? "").trim() || genBarcode(),
        categoryId: cat?.id ?? demoCategories[0]?.id ?? null,
        costPrice: num(r.costPrice),
        salePrice: num(r.salePrice),
      };

      if (found) {
        // Narx 0 bo'lsa eskisini saqlab qolamiz — bo'sh katak narxni nolga tushirmasin
        updateProduct(found.id, {
          ...data,
          costPrice: data.costPrice || found.costPrice,
          salePrice: data.salePrice || found.salePrice,
          barcode: String(r.barcode ?? "").trim() || found.barcode,
        });
        stats.updated++;
      } else {
        const created = addProduct({
          ...data,
          stock: Object.fromEntries(demoStores.map((s) => [s.id, 0])),
        });
        // Yangi tovarni lokal katalogga ham qo'shamiz — Billz hisobotida
        // bitta shtrix-kod bir necha qatorda keladi (har do'kon/partiya alohida),
        // aks holda har qatordan yangi nusxa yaratilib ketardi.
        catalog.push(created);
        stats.created++;
      }
    }
  }

  if (type === "stock") {
    // Billz qoldiq hisobotida bitta tovar bitta do'konda BIR NECHA qator
    // bo'lishi mumkin (har import partiyasi alohida, tannarxi har xil).
    // Shuning uchun avval tovar+do'kon bo'yicha yig'amiz, keyin yozamiz —
    // aks holda oxirgi qator oldingilarini o'chirib yuborardi.
    const acc = new Map(); // productId -> { product, stores: { storeId: qty } }
    for (const raw of valid) {
      const r = readRow(raw, mapping);
      const found = matchProduct(r, catalog);
      const storeId = matchStore(r.store) ?? opts.defaultStore;
      if (!found || !storeId) { stats.skipped++; continue; }
      const cur = acc.get(found.id) ?? { product: found, stores: {} };
      cur.stores[storeId] = (cur.stores[storeId] ?? 0) + num(r.qty);
      acc.set(found.id, cur);
    }
    for (const { product, stores } of acc.values()) {
      updateProduct(product.id, { stock: { ...product.stock, ...stores } });
      stats.updated++;
    }
  }

  if (type === "sales") {
    // Bir chekdagi qatorlarni birlashtiramiz
    const groups = new Map();
    for (const raw of valid) {
      const r = readRow(raw, mapping);
      const found = matchProduct(r, catalog);
      if (!found) { stats.skipped++; continue; }

      const at = toDate(r.date) ?? new Date();
      const storeId = matchStore(r.store) ?? opts.defaultStore ?? demoStores[0].id;

      // Chek raqami bo'lsa — o'sha bo'yicha guruhlaymiz.
      // Bo'lmasa (Billz'ning "Продажи по товарам" hisobotida chek raqami yo'q,
      // u kun va tovar kesimida jamlangan) — do'kon va sana bo'yicha guruhlaymiz,
      // ya'ni har do'konning har kuni bitta yig'ma chek bo'lib tushadi.
      const explicit = String(r.receiptNo ?? "").trim();
      const key = explicit || `${storeId}|${at.toISOString().slice(0, 10)}`;

      if (!groups.has(key)) {
        groups.set(key, {
          no: explicit || `IMP-${storeId}-${at.toISOString().slice(0, 10)}`,
          at, storeId,
          cashier: String(r.cashier ?? "").trim() || "Import",
          items: [],
        });
      }
      const qty = num(r.qty) || 1;
      const price = num(r.salePrice) || found.salePrice;
      groups.get(key).items.push({
        productId: found.id, name: found.name, price, qty,
        total: +(price * qty).toFixed(2),
      });
    }

    for (const g of groups.values()) {
      if (!g.items.length) continue;
      addImportedSale(g);
      stats.created++;
    }
  }

  return stats;
}
