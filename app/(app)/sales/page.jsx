"use client";
import { t, tt } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { Search, Barcode, Plus, Minus, Trash2, ShoppingCart, Receipt, User, X, Undo2 } from "lucide-react";
import { demoStores, demoUser, fmtUSD } from "@/lib/demoData";
import { listProducts, findByBarcode } from "@/lib/productsData";
import { listSales, addSale, addReturn, returnedQtyOf } from "@/lib/salesData";
import { searchCustomers } from "@/lib/customersData";
import { ymd } from "@/lib/dates";
import PaymentModal from "@/components/PaymentModal";
import ReceiptModal from "@/components/ReceiptModal";
import ReturnModal from "@/components/ReturnModal";
import DataTable from "@/components/ui/DataTable";
import Button from "@/components/ui/Button";

const tabs = ["Kassa", "Cheklar tarixi"];

export default function Sales() {
  const [tab, setTab] = useState("Kassa");
  const [storeId, setStoreId] = useState(demoStores[0].id);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState([]);
  const [discountPct, setDiscountPct] = useState("");
  const [products, setProducts] = useState(listProducts);
  const [sales, setSales] = useState(listSales);
  const [payOpen, setPayOpen] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [returnFor, setReturnFor] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [cq, setCq] = useState("");

  const foundCustomers = useMemo(() => (cq.trim() ? searchCustomers(cq).slice(0, 5) : []), [cq]);

  const stockOf = (p) => p.stock[storeId] ?? 0;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s) || p.barcode?.includes(s)
    );
  }, [products, q]);

  // —— Savat ————————————————————————————————————————
  function addToCart(p) {
    const stock = stockOf(p);
    if (stock <= 0) return;
    setCart((c) => {
      const found = c.find((i) => i.productId === p.id);
      if (found) {
        if (found.qty >= stock) return c; // qoldiqdan oshmasin
        return c.map((i) => (i.productId === p.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...c, { productId: p.id, name: p.name, price: p.salePrice, qty: 1, stock }];
    });
  }

  function changeQty(productId, delta) {
    setCart((c) =>
      c.flatMap((i) => {
        if (i.productId !== productId) return [i];
        const qty = i.qty + delta;
        if (qty <= 0) return [];
        if (qty > i.stock) return [i];
        return [{ ...i, qty }];
      })
    );
  }

  const removeItem = (productId) => setCart((c) => c.filter((i) => i.productId !== productId));

  // Shtrix-kod skaneri: Enter bosilganda kod bo'yicha topib savatga qo'shadi
  function onSearchKey(e) {
    if (e.key !== "Enter") return;
    const p = findByBarcode(q.trim());
    if (p) { addToCart(p); setQ(""); }
  }

  const subtotal = +cart.reduce((a, i) => a + i.price * i.qty, 0).toFixed(2);
  const dPct = Math.min(100, Math.max(0, Number(discountPct) || 0));
  const discountAmt = +((subtotal * dPct) / 100).toFixed(2);
  const total = +(subtotal - discountAmt).toFixed(2);

  function confirmPayment({ cash, card, payme, fromBalance, debt }) {
    const sale = addSale({
      storeId, items: cart, discountPct: dPct, cash, card, payme, fromBalance, debt,
      cashier: demoUser.name, customerId: customer?.id ?? null,
    });
    setPayOpen(false);
    setReceipt(sale);
    setCart([]);
    setDiscountPct("");
    setCustomer(null);
    setCq("");
    setProducts(listProducts()); // qoldiqlar yangilandi
    setSales(listSales());
  }

  function confirmReturn({ items, method, reason }) {
    addReturn({ saleId: returnFor.id, items, method, reason });
    setReturnFor(null);
    setProducts(listProducts()); // qoldiq omborga qaytdi
    setSales(listSales());
  }

  const storeName = (id) => demoStores.find((s) => s.id === id)?.name ?? "—";

  // Chek qanday to'langanini bitta belgi bilan ko'rsatamiz
  function payLabel(s) {
    const used = [
      s.cash > 0 && t("Naqd"),
      s.card > 0 && t("Karta"),
      s.payme > 0 && "Payme",
      s.fromBalance > 0 && t("Balans"),
      s.debt > 0 && t("Qarzga"),
    ].filter(Boolean);
    if (used.length === 0) return "—";
    return used.length > 1 ? t("Aralash") : used[0];
  }
  const fmtWhen = (iso) => {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  // Eng oxirgi chek sanasi — sahifa tepasidagi izoh uchun. Ro'yxat
  // sanaga qarab saralangan (salesData), lekin ishonch uchun
  // maksimumini olamiz.
  const lastSale = useMemo(() => {
    let max = null;
    for (const s of sales) {
      const d = ymd(s.at ?? s.date);
      if (d && (!max || d > max)) max = d;
    }
    if (!max) return null;
    const [y, m, dd] = max.split("-");
    return `${dd}.${m}.${y}`;
  }, [sales]);

  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight mb-7">{t("Sotuvlar")}</h1>

      {/* Cheklar Billz'dan bir marta eksport qilib olingan va o'zi
          yangilanmaydi (Billz API bermaydi). Shuning uchun bu bo'lim
          bir kun kelib "0 chek" ko'rsatadi-yu, Moliya bo'limi o'sha
          davr uchun tushum ko'rsatadi — ikkalasi bir-biriga qarshi
          bo'lib qoladi. Sana qo'lda yozilmaydi: eng oxirgi chekdan
          olinadi, ya'ni yangi eksport yuklansa o'zi suriladi
          (2026-08-14). */}
      {lastSale && (
        <p className="card px-5 py-3.5 mb-6 text-sm font-semibold text-muted flex items-center gap-2">
          <Receipt size={16} className="text-warn shrink-0" />
          {tt("Cheklar {d} gacha — undan keyingi savdo Billz'da yuritiladi. Davr bo'yicha tushum va foyda Moliya → Foyda hisobotida (Billz yuklamasidan).",
            { d: lastSale })}
        </p>
      )}

      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="bg-track rounded-2xl p-1.5 flex">
          {tabs.map((tb) => (
            <button key={tb} onClick={() => setTab(tb)} className={`tab-btn ${tab === tb ? "active" : ""}`}>{t(tb)}</button>
          ))}
        </div>
        <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className="card px-4 py-3 font-bold outline-none">
          {demoStores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {tab === "Kassa" ? (
        <div className="grid grid-cols-[1fr_400px] gap-6 items-start">
          {/* Tovarlar */}
          <div>
            <div className="card flex items-center gap-3 px-4 mb-5">
              <Search size={20} className="text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onSearchKey}
                placeholder={t("Tovar nomi yoki shtrix-kod (skaner uchun Enter)...")}
                className="w-full py-3.5 outline-none font-semibold bg-transparent" />
              <Barcode size={20} className="text-muted" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              {filtered.map((p) => {
                const stock = stockOf(p);
                return (
                  <button key={p.id} onClick={() => addToCart(p)} disabled={stock <= 0}
                    className="card p-5 text-left hover:shadow-pop transition-shadow disabled:opacity-50 disabled:cursor-not-allowed">
                    <p className="font-bold leading-tight mb-1 line-clamp-2 min-h-[2.6rem]">{p.name}</p>
                    <p className="text-sm text-muted mb-3">{p.sku}</p>
                    <div className="flex items-end justify-between">
                      <span className="text-xl font-extrabold text-brand">{p.salePrice.toFixed(2)} $</span>
                      <span className={`text-sm font-bold ${stock <= 0 ? "text-danger" : "text-muted"}`}>
                        {tt("{n} dona", { n: stock })}
                      </span>
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="col-span-3 card p-12 text-center text-muted font-semibold">{t("Hech narsa topilmadi")}</div>
              )}
            </div>
          </div>

          {/* Savat */}
          <div className="card p-6 sticky top-6">
            <div className="flex items-center gap-2 mb-5">
              <ShoppingCart size={22} className="text-brand" />
              <h2 className="text-xl font-extrabold flex-1">{t("Savat")}</h2>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="text-sm font-bold text-muted hover:text-danger">
                  {t("Tozalash")}
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <p className="text-muted font-semibold text-center py-12">
                {t("Savat bo'sh.")}<br />{t("Tovarni tanlang yoki shtrix-kodni skanerlang.")}
              </p>
            ) : (
              <div className="space-y-3 max-h-[42vh] overflow-y-auto -mr-2 pr-2">
                {cart.map((i) => (
                  <div key={i.productId} className="bg-surface rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <p className="font-bold leading-tight">{i.name}</p>
                      <button onClick={() => removeItem(i.productId)}
                        className="p-1 rounded-lg text-muted hover:bg-danger-soft hover:text-danger shrink-0">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button onClick={() => changeQty(i.productId, -1)}
                          className="w-8 h-8 rounded-lg bg-panel border border-line flex items-center justify-center hover:border-brand hover:text-brand">
                          <Minus size={15} />
                        </button>
                        <span className="w-8 text-center font-extrabold">{i.qty}</span>
                        <button onClick={() => changeQty(i.productId, 1)} disabled={i.qty >= i.stock}
                          className="w-8 h-8 rounded-lg bg-panel border border-line flex items-center justify-center hover:border-brand hover:text-brand disabled:opacity-40">
                          <Plus size={15} />
                        </button>
                      </div>
                      <span className="font-extrabold">{(i.price * i.qty).toFixed(2)} $</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Mijoz — qarzga sotish uchun shart */}
            <div className="border-t border-dashed border-line mt-5 pt-5">
              {customer ? (
                <div className="flex items-center gap-3 bg-brand-soft rounded-2xl px-4 py-3 mb-5">
                  <User size={18} className="text-brand shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold truncate">{customer.name}</p>
                    <p className="text-sm text-muted truncate">{customer.phone}</p>
                  </div>
                  <button onClick={() => setCustomer(null)} className="text-muted hover:text-danger shrink-0">
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <div className="relative mb-5">
                  <label className="block text-sm font-bold mb-2">{t("Mijoz (ixtiyoriy)")}</label>
                  <input value={cq} onChange={(e) => setCq(e.target.value)}
                    className="inp" placeholder={t("Telefon yoki ism bo'yicha qidirish...")} />
                  {foundCustomers.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-2 card shadow-pop overflow-hidden">
                      {foundCustomers.map((c) => (
                        <button key={c.id} onClick={() => { setCustomer(c); setCq(""); }}
                          className="w-full text-left px-4 py-3 hover:bg-brand-soft border-b border-line last:border-0">
                          <p className="font-bold">{c.name}</p>
                          <p className="text-sm text-muted">{c.phone}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <label className="block text-sm font-bold mb-2">{t("Chegirma (%)")}</label>
              <input type="number" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)}
                className="inp mb-5" placeholder="0" />

              <div className="space-y-2 mb-5">
                <div className="flex justify-between font-semibold">
                  <span className="text-muted">{t("Oraliq summa:")}</span>
                  <span>{fmtUSD(subtotal)}</span>
                </div>
                {discountAmt > 0 && (
                  <div className="flex justify-between font-semibold">
                    <span className="text-muted">{t("Chegirma:")}</span>
                    <span className="text-danger">−{fmtUSD(discountAmt)}</span>
                  </div>
                )}
                <div className="flex justify-between text-2xl font-extrabold pt-1">
                  <span>{t("Jami:")}</span>
                  <span>{fmtUSD(total)}</span>
                </div>
              </div>

              <button disabled={cart.length === 0} onClick={() => setPayOpen(true)}
                className="w-full rounded-xl bg-brand hover:bg-brand-dark text-white font-bold py-4 text-lg disabled:opacity-50">
                {t("To'lovga o'tish")}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Cheklar tarixi */
        <DataTable
          id="sales-list"
          name={t("Cheklar")}
          rows={sales}
          rowKey={(s) => s.id}
          onRowClick={(s) => setReceipt(s)}
          boshSort={{ key: "sana", dir: "desc" }}
          limit={100}
          minWidth="70rem"
          empty={{ icon: Receipt, title: "Hali cheklar yo'q" }}
          columns={[
            { key: "no", label: "Chek", locked: true, value: (s) => s.no,
              cell: (s) => (
                <span className="font-bold flex items-center gap-2">
                  {s.type === "return"
                    ? <Undo2 size={16} className="text-danger" />
                    : <Receipt size={16} className="text-brand" />}
                  {s.no}
                </span>
              ) },
            { key: "sana", label: "Sana", value: (s) => s.at,
              cell: (s) => <span className="font-semibold text-muted">{fmtWhen(s.at)}</span> },
            { key: "dokon", label: "Do'kon", value: (s) => storeName(s.storeId),
              cell: (s) => <span className="font-semibold">{storeName(s.storeId)}</span> },
            { key: "kassir", label: "Kassir", value: (s) => s.cashier,
              cell: (s) => <span className="font-semibold text-muted">{s.cashier}</span> },
            { key: "tovarlar", label: "Tovarlar", right: true,
              value: (s) => s.itemCount ?? s.items.length,
              cell: (s) => <span className="font-bold">{s.itemCount ?? s.items.length}</span>,
              total: (rs) => rs.reduce((a, s) => a + (s.itemCount ?? s.items.length), 0).toLocaleString("ru-RU") },
            { key: "tolov", label: "To'lov", value: (s) => s.type,
              cell: (s) => (
                <span className={`text-sm font-bold px-3 py-1 rounded-lg whitespace-nowrap ${
                  s.type === "return" ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand"}`}>
                  {s.type === "return" ? (s.originalNo ? tt("Qaytarish · {n}", { n: s.originalNo }) : t("Qaytarish"))
                    : s.type === "exchange" ? t("Almashtirish") : payLabel(s)}
                </span>
              ) },
            { key: "summa", label: "Summa", right: true, value: (s) => s.total,
              cell: (s) => <span className={`font-extrabold ${s.type === "return" ? "text-danger" : ""}`}>
                {fmtUSD(s.total)}</span>,
              total: (rs) => fmtUSD(rs.reduce((a, s) => a + s.total, 0)) },
            {
              key: "harakat", label: "Harakat", harakat: true, right: true, width: "8rem",
              cell: (s) => (s.type === "sale" && !s.imported && (
                <span onClick={(e) => e.stopPropagation()}>
                  <Button olcham="kichik" onClick={() => setReturnFor(s)}>Qaytarish</Button>
                </span>
              )),
            },
          ]}
        />
        </div>
      )}

      {payOpen && (
        <PaymentModal total={total} customer={customer}
          onClose={() => setPayOpen(false)} onConfirm={confirmPayment} />
      )}
      {receipt && <ReceiptModal sale={receipt} onClose={() => setReceipt(null)} />}
      {returnFor && (
        <ReturnModal sale={returnFor} onClose={() => setReturnFor(null)} onConfirm={confirmReturn} />
      )}
    </div>
  );
}
