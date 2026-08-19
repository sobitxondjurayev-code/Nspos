// ══════════════════════════════════════════════════════════════
// BILLZ MIJOZLAR HISOBOTI ("Отчет по клиентам")
// ══════════════════════════════════════════════════════════════
// Manba: Billz → Отчеты → Клиенты → "Клиенты".
//
// Nega kerak: mijozlar ro'yxati statik faylda 22-iyulda qotib qolgan
// edi. Undan keyin qo'shilgan mijozlar ilovaga tanish emas — qarz
// hisoboti yuklanganda ularning 19 tasi (870.89 USD) "Ro'yxatdan
// o'tmagan mijozlar" qatoriga tushib ketardi, ya'ni kimga qo'ng'iroq
// qilish kerakligi ko'rinmasdi.
//
// Diqqat: bu hisobotda QARZ ustuni yo'q. Qarz alohida hisobotdan
// keladi (debtsUpload.js) — ular ism bo'yicha bog'lanadi.
import { listDatasets } from "./datasets";
import { storeOfKassaName } from "./kassaIncome";

const REPORT_ID = "clients";

const num = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const x = parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(x) ? x : 0;
};
const clean = (v) => String(v ?? "").trim();

const at = (v) => {
  if (v instanceof Date) return v.toISOString();
  const s = clean(v).replace(" ", "T");
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

// customersData kutgan shaklda qaytaradi — qolgan kod o'zgarmaydi.
export function uploadedCustomers() {
  const ds = listDatasets().find((d) => d.reportId === REPORT_ID);
  if (!ds || !ds.rows?.length) return { ready: false, rows: [] };

  const rows = [];
  let i = 0;
  for (const r of ds.rows) {
    const name = clean(r["ФИО клиента"]);
    if (!name) continue;

    const purchases = num(r["Общая сумма покупок (всего)"]);
    const storeId = storeOfKassaName(r["Магазин регистрации"]);
    i += 1;

    rows.push({
      id: "mu" + i,
      name,
      phone: clean(r["Телефон"]),
      storeId,
      // Xulq profili xarid hajmiga qarab taxmin qilinadi — statik
      // ro'yxatdagi bilan bir xil qoida
      profile: purchases > 3000 ? "sekin" : purchases > 500 ? "orta" : "tez",
      cashback: +(purchases * 0.01).toFixed(2),
      createdAt: at(r["Дата регистрации"]),
      billzPurchases: purchases,
      billzDebt: 0,
      billzDueDate: null,
      salesCount: num(r["Продажи (всего)"]),
      itemsBought: num(r["Кол-во купленных товаров (всего)"]),
      returning: clean(r["Возвращающийся клиент"]) === "Да",
      // Oldindan to'lov balansi Billz'da yuritilmaydi
      balance: 0,
      groups: purchases > 5000 ? ["g2"] : /usta|дукон|dokon|дўкон/i.test(name) ? ["g1"] : ["g3"],
      tags: [
        ...(purchases > 1000 ? ["t2"] : []),
        storeId === "s2" ? "t3" : "t4",
      ],
      source: "billz",
    });
  }
  return { ready: rows.length > 0, rows, at: ds.at ?? null };
}
