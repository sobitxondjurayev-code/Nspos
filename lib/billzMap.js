// ══════════════════════════════════════════════════════════════
// BILLZ → NSPOS O'GIRISH
// ══════════════════════════════════════════════════════════════
// Sof funksiyalar: kiruvchi — Billz javobidagi obyekt va `ctx`
// (id'lar jadvali), chiquvchi — Supabase qatori. Tarmoq ham, baza ham
// bu yerda yo'q, shuning uchun serverdagi yo'l ham (`app/api/billz/sync`),
// bir martalik skript ham (`scripts/billz-sync.mjs`) AYNAN shu
// o'girishni ishlatadi. Ikki joyda ikki xil o'girish yozilsa, ikki xil
// raqam chiqadi va qaysi biri to'g'riligi bilinmay qoladi.

// —— VALYUTA: nega retail_currency o'qilmaydi ————————————
// Billz bir tovarning narxini har do'kon uchun alohida saqlaydi va
// `retail_currency` do'konga qarab "USD" yoki "UZS" bo'lib chiqadi —
// RAQAM esa bir xil. Tekshirildi (19.08.2026): DS-KIS902-S →
// Namangan 260 USD, Optim 260 USD, Sklad 260 UZS. Agar UZS yorlig'iga
// ishonib kursga bo'linsa, 260 $ tovar 0.02 $ bo'lib ketardi.
// Shuning uchun: RAQAM olinadi, yorliq E'TIBORGA OLINMAYDI.
// NSPOS ham dollarda yuritadi (companies.currency = USD).
// Bu qaror `lib/audit.js` dagi IKKI tekshiruv bilan mahkamlangan —
// narx birdan 11 880 barobar o'zgarsa darrov bilinadi:
//   · `billz-price-som`  — katalog narxi (`products.sale_price`)
//   · `savdo-narx-som`   — chek qatori (`sale_items.price/cost_price`)
// Ikkinchisi shart: tushum katalogdan emas, chek qatorlaridan
// hisoblanadi — katalog toza turgani holda P&L buzilishi mumkin.

const num = (v) => (Number.isFinite(+v) ? +v : 0);
const clean = (v) => (v === undefined || v === null ? "" : String(v).trim());
const money = (v) => Math.round(num(v) * 100) / 100;
// Qarz summasi 4 xona bilan — Billz shunday yuritadi (188.035; "Jami
// qarz" 47 634.4218). 2 xonaga yaxlitlansa 387 qarz yig'indisi Billz
// ekranidan 7 tiyin farq qiladi (DAFTAR 17). Ustun `numeric(14,4)`.
const pul4 = (v) => Math.round(num(v) * 10000) / 10000;

/** Billz sanasi ("2026-08-19 08:23:05", UTC) → ISO */
export function billzTime(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s || s.startsWith("0001-01-01")) return null;
  // Zonasiz kelsa UTC deb o'qiladi — Billz shunday beradi
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(" ", "T") + "Z";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Bo'sh UUID ("0000…0") ham, bo'sh satr ham — yo'q degani */
export const uuid = (v) => {
  const s = clean(v);
  return !s || s === "00000000-0000-0000-0000-000000000000" ? null : s;
};

/** Telefonni taqqoslash uchun bir ko'rinishga keltiradi: faqat raqamlar */
export const phoneKey = (v) => {
  const d = clean(v).replace(/\D/g, "");
  if (!d) return "";
  return d.length > 9 ? d.slice(-9) : d;   // 998 90 123 45 67 → 901234567
};

// ══════════════════════════════════════════════════════════════
// DO'KONLAR
// ══════════════════════════════════════════════════════════════
// Billz "Склад" (ruscha), NSPOS "Sklad" (lotincha) — nom bir xil emas.
// Shuning uchun moslash normallashtirilgan nom bo'yicha, qo'lda
// yozilgan sinonimlar bilan.
const SHOP_ALIASES = {
  "sklad": "sklad", "склад": "sklad", "ombor": "sklad",
};
const shopKey = (name) => {
  const k = clean(name).toLowerCase().replace(/\s+/g, " ");
  return SHOP_ALIASES[k] ?? k;
};

/**
 * Billz do'konlari ↔ NSPOS `stores`.
 * @returns {{ byBillz: Map<string,string>, unmatched: object[] }}
 */
export function matchStores(billzShops, nsposStores) {
  const byKey = new Map(nsposStores.map((s) => [shopKey(s.name), s.id]));
  // 2026-09-03: avval `stores.billz_names` (rahbar Sozlamalarda yozadi),
  // uzun kalit avval; nom bo'yicha moslash — zaxira
  const kalitlar = nsposStores.flatMap((s) => (s.billz_names ?? []).map((k) => ({ k: String(k).toLowerCase(), id: s.id })))
    .sort((a, b) => b.k.length - a.k.length);
  const byBillz = new Map();
  const unmatched = [];
  for (const sh of billzShops) {
    const nom = clean(sh.name).toLowerCase();
    const id = kalitlar.find(({ k }) => k && nom.includes(k))?.id ?? byKey.get(shopKey(sh.name));
    if (id) byBillz.set(sh.id, id);
    else unmatched.push({ billz_id: sh.id, name: sh.name });
  }
  return { byBillz, unmatched };
}

// ══════════════════════════════════════════════════════════════
// KATEGORIYA
// ══════════════════════════════════════════════════════════════
// Billz kategoriyalari daraxt (`subRows`), NSPOS'da esa tekis ro'yxat
// (`categories` jadvalida parent yo'q). Daraxtni yoyamiz; nomsiz
// tugunlar (Billz'da uchraydi) tashlanadi — ular NSPOS'da
// `unique (company_id, name)` ni buzardi.
export function flattenCategories(nodes, out = []) {
  for (const n of nodes ?? []) {
    if (clean(n.name)) out.push({ id: n.id, name: clean(n.name) });
    if (n.subRows?.length) flattenCategories(n.subRows, out);
  }
  return out;
}

export const categoryRow = (c, ctx) => ({
  company_id: ctx.companyId,
  billz_id: c.id,
  name: c.name,
});

// ══════════════════════════════════════════════════════════════
// TA'MINOTCHI
// ══════════════════════════════════════════════════════════════
export const supplierRow = (s, ctx) => ({
  company_id: ctx.companyId,
  billz_id: s.id,
  name: clean(s.name) || "Nomsiz",
  phone: (s.phone_numbers ?? [])[0] ?? null,
  note: s.external_id ? `Billz #${s.external_id}` : null,
});

// ══════════════════════════════════════════════════════════════
// TOVAR
// ══════════════════════════════════════════════════════════════

/**
 * Sotuv narxi. Barcha do'konlarda bir xil bo'lishi kutiladi; farq
 * chiqsa eng ko'p uchragani olinadi (bitta do'konda unutilgan eski
 * narx butun hisobotni buzmasin).
 */
export function retailPrice(p) {
  const vals = (p.shop_prices ?? []).map((x) => num(x.retail_price)).filter((v) => v > 0);
  if (!vals.length) return 0;
  const freq = new Map();
  for (const v of vals) freq.set(v, (freq.get(v) ?? 0) + 1);
  return money([...freq.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0]);
}

/**
 * Tannarx. Yuqoridagi `supply_price` DOIM 0 bo'lib chiqadi (tekshirildi),
 * haqiqiy raqam `product_supplier_stock[]` ichida: har do'kon uchun
 * o'sha yerdagi qoldiqning kirim narxi oralig'i (min…max).
 *
 * Qoldiq bo'yicha o'rtacha olinadi — bu tannarxning aynan o'zi
 * (o'rtacha tortilgan qiymat). Qoldiq yo'q bo'lsa oddiy o'rtacha.
 */
export function supplyPrice(p) {
  const rows = (p.product_supplier_stock ?? [])
    .map((x) => ({ qty: num(x.measurement_value), cost: num(x.min_supply_price) }))
    .filter((x) => x.cost > 0);
  if (!rows.length) return money(p.supply_price);

  const withQty = rows.filter((x) => x.qty > 0);
  const use = withQty.length ? withQty : rows.map((x) => ({ ...x, qty: 1 }));
  const qty = use.reduce((a, x) => a + x.qty, 0);
  return money(use.reduce((a, x) => a + x.cost * x.qty, 0) / qty);
}

/**
 * @param {object} p     Billz `/v2/products` qatori
 * @param {object} ctx   { companyId, categoryIdByBillz }
 */
// Tovar nomi XIZMATmi. Qoida `companyData.isServiceName()` bilan bir
// xil: nom ichida kalit so'z UCHRASA yetadi ("montaj 4 kamera" ham
// xizmat). Ro'yxat `ctx.servisNomlari` da — `buildContext` uni
// `companies.service_names` dan oladi.
export const servisNomi = (name, ctx) => {
  const s = clean(name).toLowerCase();
  if (!s) return false;
  return (ctx?.servisNomlari ?? []).some((k) => s.includes(k));
};

export function productRow(p, ctx) {
  const cat = (p.categories ?? []).find((c) => clean(c.name));
  // Ta'minotchi ikki joyda bo'lishi mumkin: alohida `suppliers[]` yoki
  // qoldiq qatorlari ichida. Qaysi biri to'lgan bo'lsa — o'shani olamiz.
  const supplier =
    clean((p.suppliers ?? []).map((x) => x.name ?? x.supplier_name).find(Boolean)) ||
    clean((p.product_supplier_stock ?? []).map((x) => x.supplier_name).find(Boolean)) ||
    null;

  return {
    company_id: ctx.companyId,
    billz_id: p.id,
    name: clean(p.name) || clean(p.sku) || "Nomsiz",
    sku: clean(p.sku) || null,
    barcode: clean(p.barcode) || null,
    category_id: cat ? ctx.categoryIdByBillz.get(cat.id) ?? null : null,
    brand: clean(p.brand_name) || null,
    supplier,
    sale_price: retailPrice(p),
    cost_price: supplyPrice(p),
    // O'lchov birligi: kabel metrlab, kamera donalab sotiladi —
    // birliksiz qoldiqdagi "2 790" nimani bildirishi noma'lum.
    unit: clean(p.measurement_unit?.short_name) || clean(p.measurement_unit?.name) || null,
    description: clean(p.description) || null,
    is_variative: !!p.is_variative,
    // XIZMAT TOVARI (montaj). Billz'da xizmat alohida tur emas — u
    // oddiy tovar bo'lib sotiladi, shuning uchun NOM bo'yicha
    // ajratiladi (`companies.service_names`, Sozlamalarda tahrirlanadi).
    //
    // Ilgari bu ustun sinxronizatsiyada UMUMAN yozilmasdi: `is_service`
    // sxemada bor edi-yu, montaj oddiy tovar bo'lib kirar va qoldig'i
    // minusga tushib ketardi. Hisobotlar uni "manfiy qoldiq" evristikasi
    // bilan chetlab o'tardi — ya'ni aynan shu ustun uchun yaratilgan
    // holat to'rt joyda qo'lda qayta yozilgan edi.
    is_service: servisNomi(p.name, ctx),
    is_active: true,
    updated_at: billzTime(p.updated_at) ?? new Date().toISOString(),
  };
}

/**
 * Qoldiq. DIQQAT: Billz faqat qoldig'i bor do'konlarni qaytaradi —
 * ro'yxatda yo'q do'kon "0" degani, "o'zgarmadi" emas. Shuning uchun
 * qatorlar HAMMA do'kon uchun yasaladi, aks holda sotilib tugagan
 * tovar bazada eski qoldig'i bilan qolib ketardi.
 */
export function stockRows(p, ctx) {
  const have = new Map(
    (p.shop_measurement_values ?? []).map((s) => [s.shop_id, num(s.active_measurement_value)])
  );
  const out = [];
  for (const [billzShopId, storeId] of ctx.storeByBillz) {
    out.push({ store_id: storeId, qty: have.get(billzShopId) ?? 0, _billzProductId: p.id });
  }
  return out;
}

// ══════════════════════════════════════════════════════════════
// MIJOZ
// ══════════════════════════════════════════════════════════════
export function customerRow(c, ctx) {
  const name = [clean(c.first_name), clean(c.middle_name), clean(c.last_name)]
    .filter(Boolean).join(" ");
  return {
    company_id: ctx.companyId,
    billz_id: c.id,
    // Billz UI'da mijoz aynan shu raqam bilan qidiriladi
    billz_external_id: clean(c.external_id) || null,
    name: name || clean(c.external_id) || "Nomsiz",
    phone: (c.phone_numbers ?? [])[0] ?? null,
    // Billz `balance` — oldindan to'lov (NSPOS'da ham shunday).
    // Cashback alohida metodda, u hozir huquq talab qiladi.
    balance: money(c.balance),
    // "Qaytib kelmagan mijozlar" tahlili shu ikki sanadan chiqadi
    first_purchase_at: billzTime(c.first_transaction_date),
    last_purchase_at: billzTime(c.last_transaction_date),
    created_at: billzTime(c.created_at) ?? undefined,
  };
}

// ══════════════════════════════════════════════════════════════
// CHEK
// ══════════════════════════════════════════════════════════════

// To'lov turlari Billz'da erkin nomlanadi (kompaniya o'zi yozadi).
// NScamera'da ikkitasi ishlatiladi — "Наличные" va "Payme" (800 ta chek
// bo'yicha tekshirildi, 19.08.2026). Boshqa nom chiqsa u jimgina naqdga
// qo'shilib ketmasligi kerak: tanilmagani `unknown` ga tushadi va
// sinxronizatsiya hisobotida ko'rinadi.
const PAYMENT_KINDS = [
  ["payme",   /payme|paycom/i],
  ["card",    /карт|card|uzcard|humo|terminal|plastik|p2p|click|uzum/i],
  ["debt",    /долг|debt|nasiya|насия|qarz|кредит/i],
  ["cash",    /налич|cash|naqd|нақд/i],
];

export function paymentKind(name) {
  const s = clean(name);
  for (const [kind, re] of PAYMENT_KINDS) if (re.test(s)) return kind;
  return null;
}

/**
 * Chekdagi pul taqsimoti.
 *
 * Billz to'lovlarni `order_detail.order_payments[]` da beradi:
 *   { company_payment_type: { name: "Наличные" }, paid_amount, returned_amount }
 *
 * Qarz esa ALOHIDA va u OBYEKT (raqam emas!):
 *   order.debt = { amount: 50.59, paid_amount: 0, status: "unpaid", ... }
 * 800 chekdan 328 tasida shunday. `Number(obyekt)` → NaN, ya'ni oddiy
 * qo'shishda qarz jimgina 0 bo'lib ketardi va "Jami tushum" nasiyaga
 * sotilgan summaga kam chiqardi.
 *
 * @returns {{ cash, card, payme, from_balance, debt, unknown: object[] }}
 */
export function splitPayments(order) {
  const d = order.order_detail ?? {};
  const out = { cash: 0, card: 0, payme: 0, from_balance: 0, debt: 0, unknown: [] };

  // Sodiqlik balansi va sertifikat — alohida maydonlarda
  out.from_balance = money(num(d.loyalty_payment) + num(d.gift_card_payment));

  // Qarz: obyekt ham, raqam ham bo'lishi mumkin
  out.debt = money(typeof order.debt === "object" && order.debt
    ? order.debt.amount
    : order.debt ?? d.debt ?? 0);

  const list = d.order_payments ?? d.payments ?? order.payments ?? [];
  for (const p of list) {
    // Qaytarilgan qism ayriladi: qaytarish chekida `paid_amount` musbat
    // qolib, `returned_amount` to'ladi
    const amount = money(num(p.paid_amount ?? p.amount ?? p.price) - num(p.returned_amount));
    if (!amount) continue;
    const nm = p.company_payment_type?.name ?? p.payment_sub_type_name
      ?? p.name ?? p.payment_type_name ?? p.type;
    const kind = paymentKind(nm);
    if (kind === "debt") { out.debt = money(out.debt + amount); continue; }
    if (kind) out[kind] = money(out[kind] + amount);
    else out.unknown.push({ name: clean(nm) || "(nomsiz)", amount });
  }

  return out;
}

/** Billz chek turi → NSPOS `sale_type` */
// Billz turni KATTA harf bilan beradi: "SALE" | "RETURN" | "EXCHANGE"
// (800 chekda: 679 / 104 / 17). NSPOS'dagi `sale_type` enum bilan bir xil
// ma'no, faqat yozilishi boshqacha.
export function saleType(order) {
  const t = clean(order.order_type).toLowerCase();
  if (/return|возврат|qaytar|refund/.test(t)) return "return";
  if (/exchange|обмен|almash/.test(t)) return "exchange";
  // Tur ko'rsatilmasa: manfiy summa — qaytarish
  return money(order.order_detail?.total_price) < 0 ? "return" : "sale";
}

/**
 * O'chirilgan chek — hisobotga kirmasligi kerak.
 *
 * DIQQAT: `deleted_at` bo'sh bo'lganda RAQAM `0` bo'lib keladi, satr emas.
 * `String(0)` → "0", u esa JavaScript'da rost (truthy) — shuning uchun
 * oddiy `!!deleted_at` tekshiruvi HAMMA chekni o'chirilgan deb qabul
 * qildi va birinchi sinovda 85 tadan 85 tasi tashlab yuborildi.
 * Bo'sh sana Billz'da uch xil ko'rinishda uchraydi: 0, "" va "0001-01-01".
 */
export const isDeleted = (order) => {
  if (order.deleted === true) return true;
  const at = order.deleted_at;
  if (at === undefined || at === null || at === 0) return false;
  const s = String(at).trim();
  return !!s && s !== "0" && !s.startsWith("0001-01-01");
};

/**
 * @param {object} order  `/v3/order-search` yoki `/v2/order/:id` qatori
 * @param {object} ctx    { companyId, storeByBillz, customerIdByBillz }
 */
export function saleRow(order, ctx) {
  const d = order.order_detail ?? {};
  const pay = splitPayments(order);
  const seller = mainSeller(order);
  const type = saleType(order);
  const sign = type === "return" ? -1 : 1;
  const total = money(Math.abs(d.total_price ?? 0)) * sign;

  // CHEGIRMA/YAXLITLASH. Billz chek darajasida chegirma maydonini
  // bermaydi, lekin `rounding_operations` orqali summani yaxlitlaydi —
  // shuning uchun qatorlar yig'indisi chek summasidan bir necha tiyinga
  // farq qiladi. O'sha farqni chegirma deb yozamiz: shunda
  // `subtotal − discount = total` aynan to'g'ri chiqadi va hisobotlarda
  // "qatorlar chek summasiga teng emas" ogohlantirishi chiqmaydi.
  // DIQQAT: qatorlar AYNAN `saleItemRows` dagidek yaxlitlanadi (avval har
  // qator, keyin yig'indi). Avval yig'ib, keyin yaxlitlansa natija bir-ikki
  // tiyinga farq qiladi va "qatorlar chek summasiga teng emas" degan soxta
  // ogohlantirish chiqadi (9 032 chekdan 5 tasida aynan shunday bo'ldi).
  const itemsTotal = (d.order_items ?? []).reduce((a, it) => {
    const neg = type === "return" || it.is_returned === true
      || num(it.total_price) < 0 || num(it.sale_price ?? it.price) < 0;
    return money(a + Math.abs(money(it.total_price)) * (neg ? -1 : 1));
  }, 0);
  const discount = money(itemsTotal - total);

  // TANILMAGAN TO'LOV — endi yo'qolmaydi.
  // Ilgari `pay.unknown` faqat sinxronizatsiya hisobotida sanalardi va
  // bazaga UMUMAN yozilmasdi: chek summasi joyida turgani holda
  // naqd+karta+payme+balans+qarz undan kam bo'lib qolardi. Farqni
  // ko'rsatadigan hech narsa yo'q edi — na ustun, na tekshiruv.
  // Endi u o'z ustuniga tushadi va `moslik.js` → `tolov-taqsimot`
  // yig'indini chek summasiga solishtiradi.
  //
  // Nega naqdga qo'shilmaydi: noto'g'ri hamyonga yozilgan pul
  // yo'qolgan puldan yomonroq — kassa solishtiruvida u "menejer
  // naqdni kam yozibdi" bo'lib chiqadi va aybi odamga tushadi.
  const unknownPaid = money((pay.unknown ?? []).reduce((a, u) => a + num(u.amount), 0));

  return {
    row: {
      company_id: ctx.companyId,
      billz_id: order.id,
      store_id: ctx.storeByBillz.get(uuid(d.shop_id) ?? "") ?? null,
      no: clean(order.order_number) || clean(order.id).slice(0, 12),
      type,
      // Mijoz id'si `order_detail.customer_id` da. `order_detail.customer`
      // obyektida esa FAQAT ism va telefon bor — id yo'q, `order.customer_id`
      // esa bo'sh satr bo'lib keladi. Buni bilmasak hamma chek mijozsiz
      // yozilib, qarzdorlik va mijoz kesimidagi hisobot bo'sh chiqadi.
      customer_id: ctx.customerIdByBillz.get(
        uuid(d.customer_id) ?? uuid(order.customer_id) ?? uuid(d.customer?.id) ?? "") ?? null,
      // Sotuv vaqti — `sold_at`/`finished_at`. `created_at_utc` esa savat
    // OCHILGAN payt: bir chekda ular bir soatgacha farq qildi
    // (13:31 vs 14:32) va kunlik hisobot chegarasida chek noto'g'ri
    // kunga tushib ketardi.
    sold_at: billzTime(order.sold_at) ?? billzTime(order.finished_at)
      ?? billzTime(order.created_at_utc) ?? billzTime(order.created_at) ?? billzTime(order._date),
      subtotal: itemsTotal || total,
      discount,
      total,
      cash: pay.cash * sign,
      card: pay.card * sign,
      payme: pay.payme * sign,
      from_balance: pay.from_balance * sign,
      debt: pay.debt * sign,
      unknown_paid: unknownPaid * sign,
      // Tarixiy chek: qoldiqqa TEGMAYDI. Qoldiq alohida
      // `/v2/products` dan keladi — ikki marta kamaytirilmasin.
      imported: true,
      billz_user_id: seller?.id ?? uuid(d.user?.id) ?? uuid(d.user_id),
      billz_user_name: seller?.name
        || clean(d.user?.name)
        || [clean(d.user?.first_name), clean(d.user?.last_name)].filter(Boolean).join(" ")
        || null,
    },
    // Ota chek (qaytarishda) — id yechilgandan keyin yoziladi
    parentBillzId: uuid(order.parent_id),
    unknownPayments: pay.unknown,
  };
}

/**
 * Chek qatorlari. NSPOS `sale_items.product_id` MAJBURIY (not null),
 * shuning uchun tovari topilmagan qator `pending` ga tushadi: avval
 * tovar yaratiladi, keyin qator yoziladi. Jimgina tashlab ketilsa
 * chek summasi qatorlar yig'indisiga teng bo'lmay qolardi.
 */
export function saleItemRows(order, saleId, ctx) {
  const items = order.order_detail?.order_items ?? [];
  const type = saleType(order);
  const rows = [];
  const missing = [];

  for (const it of items) {
    // ISHORA QATOR DARAJASIDA. ALMASHUV chekida bir vaqtda ham
    // qaytarilgan, ham yangi tovar bo'ladi va chek summasi — ikkalasining
    // AYIRMASI. Butun chekka bitta ishora qo'yilsa qaytarilganlar ham
    // musbat bo'lib qo'shilib ketadi: 3 ta almashuvda qatorlar 30 / 148 /
    // 45.82 chiqdi, chek esa 18 / 16 / 4.18 edi.
    const negative = type === "return" || it.is_returned === true
      || num(it.total_price) < 0 || num(it.sale_price ?? it.price) < 0;
    const sign = negative ? -1 : 1;
    const billzProductId = uuid(it.product_id) ?? uuid(it.product?.id);
    const productId = billzProductId ? ctx.productIdByBillz.get(billzProductId) ?? null : null;
    // MIQDOR. Qaytarish chekida `measurement_value` NOL bo'lib keladi,
    // haqiqiy dona esa `returned_measurement_value` da. Buni bilmasak
    // qaytarilgan tovar "0 dona, −75 $" bo'lib yozilardi va tovar
    // kesimidagi hisobot qaytarishlarni umuman ko'rmasdi.
    const qty = num(it.measurement_value) || num(it.returned_measurement_value)
      || num(it.amount) || 1;

    // NARX. Qaytarishda Billz narxni ham, summani ham MANFIY beradi.
    // Bizda ishora bitta joyda — miqdorda. Narx doim musbat birlik
    // narxi bo'lib qoladi, aks holda qty × price ijobiy chiqib,
    // qatorlar yig'indisi chek summasiga teng bo'lmay qolardi.
    const price = Math.abs(money(it.sale_price ?? it.price ?? it.retail_price));
    const total = money(it.total_price ?? price * qty);

    // TANNARX. Billz chek qatorida uni BERMAYDI — `supply_price` ham
    // qatorda, ham `product` ichida 0 bo'lib keladi (tekshirildi).
    // Shuning uchun katalogdagi joriy tannarx olinadi: bu tarixiy
    // aniq raqam emas, lekin 0 dan cheksiz yaxshi — 0 bo'lsa o'sha
    // savdo bo'yicha foyda 100% bo'lib ko'rinardi.
    const cost = Math.abs(money(it.supply_price)) || Math.abs(money(it.product?.supply_price))
      || money(ctx.costByBillzProduct?.get(billzProductId));

    rows.push({
      sale_id: saleId,
      billz_id: uuid(it.id),
      billz_product_id: billzProductId,
      product_id: productId,
      // Qator nomi BO'SH keladi, haqiqiy nom `product.name` da
      name: clean(it.product?.name) || clean(it.name) || clean(it.sku) || "Nomsiz",
      qty: Math.abs(qty) * sign,
      price,
      cost_price: cost,
      total: Math.abs(total) * sign,
    });
    if (!productId && billzProductId) missing.push(billzProductId);
  }

  return { rows, missing };
}

/**
 * Chek qatoridagi sotuvchi. Billz har TOVARGA alohida sotuvchi biriktiradi
 * (`order_items[].sellers[]`) — bir chekni ikki kassir birga rasmiylashtirishi
 * mumkin. NSPOS'da esa sotuvchi chek darajasida (`cashier_id`), shuning uchun
 * chekdagi eng ko'p uchragan sotuvchi olinadi.
 */
export function mainSeller(order) {
  const count = new Map();
  for (const it of order.order_detail?.order_items ?? []) {
    for (const sl of it.sellers ?? []) {
      const id = uuid(sl.seller_id);
      if (!id) continue;
      const name = clean(sl.seller?.name)
        || [clean(sl.seller?.first_name), clean(sl.seller?.last_name)].filter(Boolean).join(" ");
      const cur = count.get(id) ?? { id, name, n: 0 };
      cur.n++;
      count.set(id, cur);
    }
  }
  if (!count.size) {
    const u = order.order_detail?.user;
    const id = uuid(order.order_detail?.user_id) ?? uuid(u?.id);
    return id ? { id, name: clean(u?.name) || [clean(u?.first_name), clean(u?.last_name)].filter(Boolean).join(" ") } : null;
  }
  return [...count.values()].sort((a, b) => b.n - a.n)[0];
}

// ══════════════════════════════════════════════════════════════
// USTIGA YOZISHDAN SAQLASH
// ══════════════════════════════════════════════════════════════
// Billz qoldig'i tugagan tovarning tannarxini 0 deb qaytaradi
// (`product_supplier_stock` bo'sh bo'lib qoladi — tekshirildi:
// 40 tadan 2 tasi shunday). Uni ustiga yozsak, bazadagi haqiqiy
// tannarx yo'qoladi va o'sha tovar bo'yicha butun tarixdagi foyda
// 100% bo'lib ko'rinadi. Shuning uchun NOL — "bilmayman" degani,
// "bepul" degani emas: eski qiymat saqlanadi.
const keepIfZero = ["cost_price", "sale_price"];

/**
 * @param {object|null} existing  bazadagi qator (bo'lmasa null)
 * @param {object} incoming       Billz'dan yasalgan qator
 */
export function mergeProduct(existing, incoming) {
  if (!existing) return incoming;
  const out = { ...incoming };
  for (const k of keepIfZero) {
    if (!num(out[k]) && num(existing[k])) out[k] = money(existing[k]);
  }
  // Billz'da bo'sh qolgan matn maydonlari eski qiymatni o'chirmasin
  for (const k of ["sku", "barcode", "brand", "category_id", "supplier", "unit", "description"]) {
    if (!out[k] && existing[k]) out[k] = existing[k];
  }
  return out;
}

const laterOf = (a, b) => {
  if (!a) return b ?? null;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
};
const earlierOf = (a, b) => {
  if (!a) return b ?? null;
  if (!b) return a;
  return Date.parse(a) <= Date.parse(b) ? a : b;
};

/** Mijozda ham xuddi shunday: telefon o'chib ketmasin */
export function mergeCustomer(existing, incoming) {
  if (!existing) return incoming;
  const out = { ...incoming };
  if (!out.phone && existing.phone) out.phone = existing.phone;
  if (!out.name && existing.name) out.name = existing.name;
  // Xarid sanalari IKKI manbadan keladi: Billz (`last_transaction_date`)
  // va NSPOS'ning o'z cheklari (`refresh_customer_stats()`). Ular bir xil
  // bo'lmaydi. Bittasini ikkinchisi ustiga yozsa, har sinxronizatsiyada
  // qiymat u yoqdan-bu yoqqa sakraydi va 2 111 mijoz sababsiz qayta
  // yozilaveradi. Shuning uchun: oxirgi xarid — KECHROG'I, birinchi
  // xarid — ERTAROG'I. Bu `refresh_customer_stats()` dagi
  // greatest()/least() bilan bir xil qoida, ya'ni ikkalasi bir joyda
  // to'xtaydi.
  out.last_purchase_at = laterOf(out.last_purchase_at, existing.last_purchase_at);
  out.first_purchase_at = earlierOf(out.first_purchase_at, existing.first_purchase_at);
  // store_id NSPOS'ning o'z ma'lumoti — Billz uni bermaydi
  if (existing.store_id) out.store_id = existing.store_id;
  return out;
}

// ══════════════════════════════════════════════════════════════
// QARZ
// ══════════════════════════════════════════════════════════════
// Billz qarzni sotuvdan alohida yuritadi (`/v1/debt`). NSPOS'da ham
// shunday: `debts` — berilgan qarz, `debt_payments` — har qaytish.
// "Balans" emas, HODISA ko'rinishida saqlanadi (schema.sql 7-bo'lim),
// chunki faqat shunda "o'rtacha necha kunda qaytadi" hisoblanadi.

/** Billz status → qarz yopilganmi */
const CLOSED_STATUSES = new Set(["fully_paid", "paid", "closed"]);

// ══════════════════════════════════════════════════════════════
// TRANSFER — sklad ↔ filial ko'chirish (sarlavha darajasida)
// ══════════════════════════════════════════════════════════════
// Do'kon `ctx.storeByBillz` orqali bog'lanadi; bog'lanmasa nom qoladi
// (`from_name`/`to_name`) — yo'qolmasin, hisobotda nom bilan chiqadi.
export function transferRow(t, ctx) {
  return {
    company_id: ctx.companyId,
    billz_id: t.id,
    external_id: Number.isFinite(+t.external_id) ? +t.external_id : null,
    name: clean(t.name) || null,
    from_store_id: ctx.storeByBillz.get(t.departure_shop_id) ?? null,
    to_store_id: ctx.storeByBillz.get(t.arrival_shop_id) ?? null,
    from_name: clean(t.departure_shop?.name) || null,
    to_name: clean(t.arrival_shop?.name) || null,
    qty: num(t.total_loaded_measurement_value),
    qty_arrived: num(t.total_arrived_measurement_value),
    retail_total: num(t.total_retail_price),
    supply_total: num(t.total_supply_price),
    status_id: clean(t.status_id) || null,
    differs: String(t.differs) === "true",
    created_by: clean(t.created_by?.name) || null,
    accepted_by: clean(t.accepted_by?.name) || null,
    comment: clean(t.comment) || null,
    created_at: billzTime(t.created_at) ?? new Date().toISOString(),
    accepted_at: billzTime(t.accepted_at),
    updated_at: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════
// XARID HUJJATI — Billz supplier-order → supplier_invoices (DAFTAR 20 E)
// ══════════════════════════════════════════════════════════════
// Sarlavha darajasida (qatorlar API'da 403). `amount` — TANNARXDA
// (`total_supply_price`): balansdagi ta'minotchi qarzi shundan.
// To'langani Billz'niki (`total_paid_amount`) — qayta hisoblanmaydi.
export function supplierOrderRow(o, ctx) {
  const sana = billzTime(o.accepting_date) ?? billzTime(o.created_at) ?? new Date().toISOString();
  return {
    company_id: ctx.companyId,
    billz_id: o.id,
    supplier_id: ctx.supplierByBillz?.get(o.supplier_id) ?? null,
    supplier_name: clean(o.supplier?.name) || null,
    store_id: ctx.storeByBillz.get(o.shop_id) ?? null,
    amount: num(o.total_supply_price),
    supply_total: num(o.total_supply_price),
    retail_total: num(o.total_retail_price),
    qty: num(o.total_accepted_measurement_value ?? o.total_measurement_value),
    paid_amount: num(o.total_paid_amount),
    status_id: clean(o.status_id) || null,
    invoice_date: String(sana).slice(0, 10),
    due_date: o.payment_date ? String(billzTime(o.payment_date) ?? "").slice(0, 10) || null : null,
    note: [clean(o.name), o.invoice_number && String(o.invoice_number) !== "0" ? `hisob-faktura ${o.invoice_number}` : null]
      .filter(Boolean).join(" · ") || null,
    accepted_at: billzTime(o.accepting_date),
    source: "billz",
    updated_at: new Date().toISOString(),
  };
}

export function debtRow(d, ctx) {
  const amount = pul4(d.amount);
  const paid = pul4(d.paid_amount);
  const closed = CLOSED_STATUSES.has(clean(d.status).toLowerCase());
  return {
    company_id: ctx.companyId,
    billz_id: d.id,
    // YORLIQ SINXRONNING O'ZI YOZADI. Ilgari bu ustun yozilmasdi va
    // baza uni default `'nspos'` qilardi; `listDebts()` esa faqat
    // `'billz'` ni sanardi — 20.08 dan keyin kelgan 150 qarz (20 180 $)
    // ekranda umuman ko'rinmadi (DAFTAR 17). Bir martalik backfill
    // (`billz-debts.sql`) keyingi qatorlarni qamrab ololmaydi.
    source: "billz",
    customer_id: ctx.customerIdByBillz.get(uuid(d.customer?.id) ?? "") ?? null,
    sale_id: ctx.saleIdByBillzOrder?.get(uuid(d.order_id) ?? "") ?? null,
    store_id: ctx.storeByBillz.get(uuid(d.shop?.id) ?? "") ?? null,
    amount,
    paid_amount: paid,
    status: clean(d.status) || null,
    comment: clean(d.comment) || null,
    issued_at: billzTime(d.created_at),
    // Billz'da bu `repayment_date` — "qachongacha qaytarilsin"
    due_date: (billzTime(d.repayment_date) ?? "").slice(0, 10) || null,
    // Yopilgan sana — oxirgi to'lov vaqti; u bo'lmasa `updated_at`
    closed_at: closed ? (lastPaymentAt(d) ?? billzTime(d.updated_at)) : null,
  };
}

// Billz to'lov satri: "19-08-2026 18:38:31 Наличные: 2.500000"
//                     kun-oy-yil soat  usul      summa
// VAQT MAHALLIY (Toshkent, +5): o'sha yozuvda `updated_at` 13:38:31Z
// turibdi, satrda esa 18:38:31. UTC'ga o'girilmasa to'lov besh soat
// keyinga surilib, kunlik hisobotda boshqa kunga tushib ketardi.
const PAYMENT_LINE = /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\s+(.+?):\s*([\d.]+)\s*$/;
const TASHKENT_OFFSET_MS = 5 * 3600_000;

export function parseDebtPayment(line) {
  const m = String(line ?? "").match(PAYMENT_LINE);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, mi, ss, method, amount] = m;
  const local = Date.UTC(+yyyy, +mm - 1, +dd, +hh, +mi, +ss);
  return {
    at: new Date(local - TASHKENT_OFFSET_MS).toISOString(),
    method: clean(method),
    amount: pul4(amount),
  };
}

function lastPaymentAt(d) {
  let last = null;
  for (const line of d.payments ?? []) {
    const p = parseDebtPayment(line);
    if (p && (!last || p.at > last)) last = p.at;
  }
  return last;
}

/**
 * Qarz to'lovlari. Billz to'lovga ID BERMAYDI — shuning uchun satrning
 * o'zi takrorlanmaslik kaliti bo'ladi (`billz_key`).
 *
 * "Системная оплата" — pul kelgani emas, TOVAR QAYTGANI uchun qarz
 * kamaygani. Sxemada bu `kind = 'return'`; aralashtirilsa kassaga
 * tushmagan pul tushgan bo'lib ko'rinardi.
 */
export function debtPaymentRows(d, debtId) {
  const rows = [];
  const seen = new Set();
  for (const line of d.payments ?? []) {
    const p = parseDebtPayment(line);
    if (!p) continue;
    const key = String(line);
    if (seen.has(key)) continue;      // bir xil satr ikki marta kelsa
    seen.add(key);

    const system = /систем|system/i.test(p.method);
    rows.push({
      debt_id: debtId,
      billz_key: key,
      amount: p.amount,
      paid_at: p.at,
      // TANILMAGAN USUL — `cash` EMAS, `unknown`.
      // Ilgari bu yerda `?? "cash"` turardi: Billz'da yangi to'lov turi
      // ochilsa qarz to'lovi jimgina NAQD bo'lib yozilardi. Kassa
      // solishtiruvi (`kassaIncome.flowFromDb`) faqat naqd va payme'ni
      // sanaydi, ya'ni pul kassaga tushmagan bo'lsa ham tushgan bo'lib
      // ko'rinardi va kamomad menejer zimmasiga o'tardi.
      // Endi u alohida turadi va `audit.js` → `qarz-nomalum-usul`
      // buni ekranga chiqaradi.
      //
      // ESKI QATORLAR QAYTA YOZILMAYDI: `syncDebts` mavjud `billz_key`
      // ni umuman qayta ko'rmaydi. Bu ataylab — o'sha idempotentlik
      // qarz to'lovlari ikkilanmasligining kafolati. Tarixda qolgan
      // `cash` yozuvlari joyida turadi.
      method: paymentKind(p.method) ?? (system ? "return" : "unknown"),
      kind: system ? "return" : "payment",
    });
  }
  return rows;
}
