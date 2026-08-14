"use client";
// ══════════════════════════════════════════════════════════════
// PUL NAZORATI — ilova ichidagi ogohlantirishlar
// ══════════════════════════════════════════════════════════════
// `scripts/tekshir.mjs` bilan bir xil tekshiruvlar, faqat brauzerda:
// menejer va rahbar xatoni men aytishimni kutmasdan o'zi ko'radi va
// tuzatadi.
//
// Har ogohlantirish uch narsani aytadi: NIMA bo'lgan, QANCHA pulga
// tegishli va QAYERGA borib tuzatish kerak. Sababi ko'rsatilmasa,
// ogohlantirish "nimadir xato" degan bezovtalikdan boshqa narsa emas.
import { KASSAS, WALLETS, kassaIds, kassaBalances, listOps, unclosedDays, COMPANY,
  kassasOf } from "./kassaData";
import { listPayouts } from "./payoutsData";
import { listAllDays } from "./kpiData";
import { listStaff } from "./staffData";
import { getUsdRate } from "./companyData";

const money = (n) => `${(+n).toFixed(2)} USD`;

// user — kim ko'ryapti. Menejerga faqat O'Z kassasiga tegishlisi
// chiqadi: boshqa do'konning muammosini u tuzata olmaydi.
export function moneyWarnings(user) {
  const out = [];
  const isOwner = user?.role === "owner";
  const mine = kassasOf(user);
  const seen = (kassa) => isOwner || mine.includes(kassa);

  // 1) Kurs qo'yilmagan — so'mdagi xarajat umuman saqlanmaydi
  if (!getUsdRate()) {
    out.push({
      id: "rate", level: "error",
      title: "Valyuta kursi qo'yilmagan",
      detail: "So'mda kiritilgan xarajat saqlanmaydi va oylik dollarga o'girilmaydi.",
      action: "Sozlamalarda kursni yoqing", href: "/settings",
    });
  }

  // 2) Manfiy hamyon — kassadan bor puldan ko'p chiqarilgan
  const bal = kassaBalances(new Date());
  for (const k of kassaIds()) {
    if (!seen(k)) continue;
    for (const w of Object.keys(WALLETS)) {
      const v = bal[k]?.[w] ?? 0;
      if (v >= -0.01) continue;
      out.push({
        id: `neg-${k}-${w}`, level: "error",
        title: `${KASSAS[k]?.label ?? k} · ${WALLETS[w]} minusda: ${money(v)}`,
        detail: "Kassada bo'lganidan ko'p pul chiqarilgan. Odatda xarajat noto'g'ri kassaga yozilgan yoki kun yopilgandan keyin kiritilgan.",
        action: "Kunma-kun ko'rish", href: `/finance/kassa/${k}`,
      });
    }
  }

  // 3) Yopilmagan kunlar — pul topshirilmagan yoki tekshirilmagan
  for (const k of kassaIds()) {
    if (KASSAS[k]?.main || !seen(k)) continue;
    const days = unclosedDays(k);
    if (!days.length) continue;
    out.push({
      id: `unclosed-${k}`, level: "warn",
      title: `${KASSAS[k]?.label ?? k}: ${days.length} kun yopilmagan`,
      detail: `Eng eskisi ${days[0]}. Yopilmagan kunning puli topshirilganmi yoki yo'qmi — bilinmaydi.`,
      action: "Kunlarni ochish", href: `/finance/kassa/${k}`,
    });
  }

  // 4) To'langan reja kassa yozuviga bog'lanmagan — "rejaga qaytarish"
  //    chiqimni o'chira olmaydi, ya'ni pul ikki marta chiqib ketishi mumkin
  if (isOwner) {
    const unlinked = listPayouts().filter((p) => p.status === "paid" && !p.opId);
    if (unlinked.length) {
      out.push({
        id: "unlinked", level: "warn",
        title: `${unlinked.length} ta to'lov kassa yozuviga bog'lanmagan`,
        detail: unlinked.slice(0, 3).map((p) => `${p.title} · ${money(p.amount)}`).join(" · "),
        action: "Pul rejasini ochish", href: "/finance/plan",
      });
    }
  }

  // 5) Ikkilangan chiqim — bir xil summa, bir xil izoh, bir necha marta
  const byKey = new Map();
  for (const o of listOps()) {
    if (o.kind !== "out") continue;
    if (!seen(o.kassa)) continue;
    const key = `${o.kassa}|${o.wallet}|${o.amount}|${o.note ?? ""}`;
    byKey.set(key, [...(byKey.get(key) ?? []), o]);
  }
  for (const [, list] of byKey) {
    if (list.length < 2) continue;
    const o = list[0];
    out.push({
      id: `dup-${o.kassa}-${o.amount}-${o.note}`, level: "warn",
      title: `Bir xil chiqim ${list.length} marta: ${o.note || "izohsiz"} · ${money(o.amount)}`,
      detail: `Sanalari: ${list.map((x) => x.date).join(", ")}. Agar bu bitta to'lov bo'lsa, ortiqchasi o'chirilsin.`,
      action: "Pul rejasini ochish", href: "/finance/plan",
    });
  }

  // 6) Do'koni yo'q xodim kiritgan kirim — pul hech qaysi kassaga tushmaydi
  if (isOwner) {
    const staff = new Map(listStaff().map((s) => [s.id, s]));
    const lost = new Map();
    for (const d of listAllDays()) {
      const s = staff.get(d.staffId);
      // Do'koni yo'q YOKI do'koni kassa emas (masalan Sklad) — ikkala
      // holatda ham pul hech qaysi kassa balansiga tushmaydi
      if (!s || s.role === "installer") continue;
      if (s.storeId && kassaIds().includes(s.storeId)) continue;
      const sum = (Number(d.cash) || 0) + (Number(d.payme) || 0);
      if (sum <= 0) continue;
      lost.set(s.id, { name: s.name, sum: (lost.get(s.id)?.sum ?? 0) + sum });
    }
    for (const [id, x] of lost) {
      out.push({
        id: `nostore-${id}`, level: "error",
        title: `${x.name}: ${money(x.sum)} hech qaysi kassaga tushmagan`,
        detail: "Xodimning do'koni yo'q yoki uning do'konida kassa yuritilmaydi — kiritgan kunlik kirimi kassa balansiga qo'shilmaydi.",
        action: "Xodimga do'kon biriktirish", href: "/management",
      });
    }
  }

  return out;
}
