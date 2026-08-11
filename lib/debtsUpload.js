// ══════════════════════════════════════════════════════════════
// BILLZ QARZ HISOBOTI ("Отчет по долгам")
// ══════════════════════════════════════════════════════════════
// Manba: Billz → Клиенты ro'yxati → pastdagi "Скачать". Diqqat: bu
// hisobot "Отчеты" bo'limida YO'Q, uni izlab topish oson emas.
//
// Ustunlari: ID транзакции | Магазин | Дата создания | ID долга |
//   Сумма долга | Сумма погашений | Остаток долга | Пользователь |
//   Клиент | Статус долга | Погашения | Срок погашения | Контактный номер
//
// Nega kerak: nasiya sotuv bilan birga o'z-o'zidan yozilmaydi. Usiz
// foydada nasiya ko'rinadi (Сводный uni tushum deb sanaydi), balansda
// esa debitor qarzdorlik ko'rinmay qoladi — ya'ni pul "yo'qoladi".
//
// Bazadagi eski qarzlar (22-iyulgacha) qisman modellashtirilgan edi:
// berilgani haqiqiy, qaytish sanalari esa taxminiy. Yuklama esa to'liq
// haqiqiy — shuning uchun u bor bo'lsa, o'sha ishlatiladi.
import { listDatasets } from "./datasets";
import { listCustomers } from "./customersData";
import { storeOfKassaName } from "./kassaIncome";

const REPORT_ID = "client_debts";

const num = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const x = parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(x) ? x : 0;
};

// "2026-08-05 20:53:25" yoki Date → ISO
const at = (v) => {
  if (v instanceof Date) return v.toISOString();
  const s = String(v ?? "").trim().replace(" ", "T");
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const clean = (v) => String(v ?? "").trim();

// Yuklangan qarzlar. debtsData kutgan shaklda qaytariladi, shunda
// balans, muddat guruhlari va debitor ro'yxati o'zgarishsiz ishlaydi.
export function uploadedDebts() {
  const ds = listDatasets().find((d) => d.reportId === REPORT_ID);
  if (!ds || !ds.rows?.length) return { ready: false, rows: [] };

  // Mijozni nom bo'yicha bog'laymiz. Topilmasa ham qarz yoziladi —
  // aks holda balansdagi debitor qarzdorlik kam chiqib ketardi.
  const byName = new Map();
  for (const c of listCustomers()) {
    const k = clean(c.name).toLowerCase();
    if (k && !byName.has(k)) byName.set(k, c);
  }

  const rows = [];
  for (const r of ds.rows) {
    const amount = num(r["Сумма долга"]);
    if (!(amount > 0)) continue;

    // To'langan summani "Сумма погашений" dan emas, QOLDIQdan
    // chiqaramiz: remainingOf() = amount − to'langan formulasi bilan
    // Billz aytgan "Остаток долга" ga tiyinigacha mos tushsin. Ikkalasini
    // alohida yaxlitlaganda 80 ta qarzda 3 tiyin farq to'plangan edi.
    const left = num(r["Остаток долга"]);
    const paid = +(amount - left).toFixed(2);
    const name = clean(r["Клиент"]);
    const createdAt = at(r["Дата создания"]);
    const status = clean(r["Статус долга"]);

    rows.push({
      id: "bd-" + clean(r["ID долга"]),
      no: "QZ-" + clean(r["ID долга"]),
      customerId: byName.get(name.toLowerCase())?.id ?? null,
      customerName: name,
      phone: clean(r["Контактный номер"]).replace(/;/g, "").trim(),
      saleId: clean(r["ID транзакции"]) || null,
      storeId: storeOfKassaName(r["Магазин"]),
      amount,
      createdAt,
      dueDate: at(r["Срок погашения"]),
      // "Погашен" bo'lsa yopilgan deb belgilaymiz
      closedAt: status === "Погашен" ? createdAt : null,
      // Billz to'lovlarni bittalab bermaydi — faqat yig'indisini.
      // Shuning uchun bitta yig'ma to'lov yoziladi: remainingOf()
      // shundan "Остаток долга" ni to'g'ri chiqaradi.
      payments: paid > 0
        ? [{ id: "bp-" + clean(r["ID долга"]), amount: +paid.toFixed(2), at: createdAt, method: "cash", kind: "payment" }]
        : [],
      status,
      source: "billz",
    });
  }
  return { ready: rows.length > 0, rows, at: ds.at ?? null };
}
