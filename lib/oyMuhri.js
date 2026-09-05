"use client";
// ══════════════════════════════════════════════════════════════
// OY MUHRI — yopilgan oy raqami o'zgarmaydi (DAFTAR 20 K)
// ══════════════════════════════════════════════════════════════
// Moliyaning asosiy marosimi — oy yopish. Rahbar oyni yopganda P&L,
// qarz, kassa, ombor va kapital raqamlari `oy_muhri` ga MUHRLANADI.
// Hisob keyin o'zgarsa (kech kiritilgan xarajat, Billz'da tuzatilgan
// chek, kurs) muhr o'zgarmaydi — farq `audit` → `oy-muhri` da ochiq
// turadi. Ya'ni ekrandagi jonli raqam va muhr bir-biriga qarama-qarshi
// bo'lishi MUMKIN, va aynan shu farq rahbarga kerak: "avgustni 27 244 $
// deb yopgan edim, hozir 27 900 — nima o'zgardi?"
//
// Muhr ekrandagi raqamni ALMASHTIRMAYDI (P&L jonli hisobdan chiqadi):
// almashtirsa xato yashirinardi. U taqqoslash uchun turadi.
import { syncTable } from "./sync";
import { getUser } from "./auth";
import { profitAndLoss, foydaPulKoprigi } from "./pnlData";
import { jamiQarz, qarzHolati } from "./debtsData";
import { balanceSheet } from "./balanceData";
import { kassaBalances, kassaIds } from "./kassaData";
import { oyKursi } from "./ratesData";
import { ymd } from "./dates";

let muhrlar = [];

const sync = syncTable("oy_muhri", {
  table: "oy_muhri",
  order: { column: "oy", ascending: false },
  get: () => muhrlar,
  set: (v) => { muhrlar = v; },
  sort: (a, b) => (a.oy < b.oy ? 1 : -1),
  fromRow: (r) => ({
    id: r.id, oy: r.oy,
    kurs: r.kurs == null ? null : Number(r.kurs),
    savdo: Number(r.savdo), tannarx: Number(r.tannarx), yalpiFoyda: Number(r.yalpi_foyda),
    xarajat: Number(r.xarajat), sofFoyda: Number(r.sof_foyda),
    qarz: Number(r.qarz), ombor: Number(r.ombor), kassa: Number(r.kassa), kapital: Number(r.kapital),
    tafsilot: r.tafsilot ?? {},
    yopgan: r.yopgan ?? null,
    at: r.created_at ?? null,
  }),
  toRow: (m) => ({
    oy: m.oy, kurs: m.kurs,
    savdo: m.savdo, tannarx: m.tannarx, yalpi_foyda: m.yalpiFoyda,
    xarajat: m.xarajat, sof_foyda: m.sofFoyda,
    qarz: m.qarz, ombor: m.ombor, kassa: m.kassa, kapital: m.kapital,
    tafsilot: m.tafsilot ?? {},
    yopgan: m.yopgan ?? null,
  }),
});

export const listMuhrlar = () => [...muhrlar].sort((a, b) => (a.oy < b.oy ? 1 : -1));
export const muhr = (oy) => muhrlar.find((m) => m.oy === oy) ?? null;

// Oy chegaralari (mahalliy vaqt)
export function oyOraligi(oy) {
  const [y, m] = String(oy).split("-").map(Number);
  return { from: new Date(y, m - 1, 1, 0, 0, 0, 0), to: new Date(y, m, 0, 23, 59, 59, 999) };
}
export const otganOy = (now = new Date()) => {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// Oyning HOZIRGI hisobi — muhr bilan shu solishtiriladi. Formula
// qayta yozilmaydi: P&L, qarz, kassa, balans o'z funksiyalaridan.
export function oyHisobi(oy) {
  const { from, to } = oyOraligi(oy);
  const p = profitAndLoss(from, to);
  const k = foydaPulKoprigi(from, to);
  const bal = kassaBalances(to);
  const kassa = +kassaIds().reduce((s, id) => s + (bal[id]?.total ?? 0), 0).toFixed(2);
  const b = balanceSheet(to);
  const q = qarzHolati(to);
  return {
    oy,
    kurs: oyKursi(oy).rate ?? null,
    savdo: p.revenue.goods, tannarx: p.cogs.total, yalpiFoyda: p.grossProfit,
    xarajat: +(p.expenses.total + p.expenses.installerShare).toFixed(2),
    sofFoyda: p.netProfit,
    qarz: q.jami, ombor: b.inventory.cost, kassa, kapital: b.equity,
    tafsilot: {
      pnl: { gross: p.revenue.gross, returns: p.revenue.returns, payroll: p.expenses.payroll,
             opex: p.expenses.opex, soliq: p.soliq, tannarxsiz: p.cogs.tannarxsiz,
             // Tovar kelish xarajati (yo'lkira) — `tannarx` ichida.
             // Muhrda alohida saqlanadi: keyin "tannarx nega oshgan"
             // degan savolga javob shu qatordan topiladi.
             kelish: p.cogs.kelish },
      koprik: { kutilgan: k.kutilgan, haqiqiy: k.haqiqiy, izohlanmagan: k.izohlanmagan },
      qarzHozir: jamiQarz().jami,
      qarzSoni: q.soni,
      kapitalTafsilot: b.kapitalTafsilot ?? null,
      izohlanmagan: b.izohlanmagan ?? null,
      omborIzoh: "muhrlash paytidagi qoldiq (ombor tarixi yo'q)",
      yopilganKun: ymd(new Date()),
    },
  };
}

// Oyni yopish — bir marta. Mavjud muhr ustiga yozilmaydi (o'chirish yo'q).
export function oyniYop(oy) {
  if (muhr(oy)) return { ok: false, sabab: "Bu oy allaqachon yopilgan" };
  const h = oyHisobi(oy);
  const row = { id: "muhr-" + Date.now().toString(36), ...h, yopgan: getUser()?.id ?? null, at: new Date().toISOString() };
  muhrlar = [row, ...muhrlar];
  sync.created(row);
  return { ok: true, muhr: row };
}

// Muhr bilan hozirgi hisob farqi — audit `oy-muhri` va Balans sahifasi
export function muhrFarqi(m) {
  const h = oyHisobi(m.oy);
  const farq = (k) => +((h[k] ?? 0) - (m[k] ?? 0)).toFixed(2);
  const out = { sofFoyda: farq("sofFoyda"), qarz: farq("qarz"), kassa: farq("kassa"), savdo: farq("savdo") };
  out.bor = Object.values(out).some((v) => Math.abs(v) > 0.01);
  return out;
}
