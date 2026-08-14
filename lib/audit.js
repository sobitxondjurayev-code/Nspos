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
  negativeDays, kassasOf } from "./kassaData";
import { listPayouts } from "./payoutsData";
import { listAllDays } from "./kpiData";
import { listStaff } from "./staffData";
import { expensesInRange, STREET_INSTALLER } from "./expensesData";
import { ymd } from "./dates";
import { getUsdRate, getLedgerStart } from "./companyData";

// Sana "YYYY-MM-DD" ko'rinishida solishtiriladi (DAFTAR 4-bo'lim:
// Date'ni String() qilib kesish "Sat Aug 0" beradi va taqqoslash buziladi)
const iso = (d) => ymd(d);

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

  // 2) Manfiy hamyon. Sababi IKKI XIL bo'ladi va ular butunlay boshqa
  //    narsa — shuning uchun matni ham boshqacha:
  //
  //    a) Biror kunning O'ZIDA chiqim kirimdan oshgan (negativeDays) —
  //       kirim to'liq yozilmagan yoki xarajat boshqa kassaga tushgan.
  //       Bu haqiqiy tekshiruv talab qiladi.
  //    b) Bunday kun yo'q, lekin qoldiq baribir minus — demak kassa
  //       o'zida bo'lganidan KO'P TOPSHIRGAN: pul yo'qolmagan, u
  //       kompaniya balansida turibdi (odatda xarajat kun yopilgandan
  //       keyin kiritilgani uchun). Keyingi topshirishda shuncha kam
  //       berilsa, o'zi tekislanadi.
  const bal = kassaBalances(new Date());
  for (const k of kassaIds()) {
    if (!seen(k)) continue;
    const yomonKunlar = negativeDays(k);
    for (const w of Object.keys(WALLETS)) {
      const v = bal[k]?.[w] ?? 0;
      if (v >= -0.01) continue;
      const kunlar = yomonKunlar.filter((d) => d.wallet === w);
      const kunlarJami = +kunlar.reduce((s, d) => s + d.amount, 0).toFixed(2);
      const ortiqcha = +(v - kunlarJami).toFixed(2);   // topshirilgan ortiqcha qism
      const izoh = [];
      if (kunlar.length) {
        izoh.push(`${money(kunlarJami)} — o'sha kuni kassada bo'lganidan ko'p chiqim bo'lgan (${kunlar.map((d) => d.date).join(", ")}): kirim to'liq yozilmagan yoki xarajat boshqa kassaga tushgan.`);
      }
      if (ortiqcha < -0.01) {
        izoh.push(`${money(ortiqcha)} — pul yo'qolmagan: kassa o'zida bo'lganidan ko'p topshirgan, u kompaniya balansida turibdi (odatda xarajat kun yopilgandan keyin kiritilgan). Keyingi topshirishda shuncha kam berilsa tekislanadi.`);
      }
      out.push({
        id: `neg-${k}-${w}`, level: kunlar.length ? "error" : "warn",
        title: `${KASSAS[k]?.label ?? k} · ${WALLETS[w]} minusda: ${money(v)}`,
        detail: izoh.join(" "),
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
    // FAQAT hisob boshidan: undan oldingi pul harakati umuman
    // sanalmaydi (kelishuv, DAFTAR 1-bo'lim). Davrsiz olinganda
    // 30–31 iyulda kiritilgan 567 $ "kassaga tushmagan" bo'lib
    // ekranda qizil xato bo'lib turardi (2026-08-14).
    for (const d of listAllDays(getLedgerStart(), iso(new Date()))) {
      const s = staff.get(d.staffId);
      // Do'koni yo'q YOKI do'koni kassa emas (masalan Sklad) — ikkala
      // holatda ham pul hech qaysi kassa balansiga tushmaydi
      if (!s || s.role === "installer") continue;
      if (s.storeId && kassaIds().includes(s.storeId)) continue;
      const sum = (Number(d.cash) || 0) + (Number(d.payme) || 0) + (Number(d.service) || 0);
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

  // 7) Usta puli IKKI MARTA hisoblangan
  //    Qoida (2026-08-13): usta olgan pul BITTA manbadan — KPI
  //    jadvalidagi "olgan" ustuni. U avtomat ravishda "Oylik" turidagi
  //    xarajat bo'lib qo'shiladi. Menejer o'sha pulni Xarajatlar
  //    bo'limiga QO'LDA ham kiritsa, bir xil pul ikki marta chiqadi:
  //    servis hamyoni minusga tushadi, usta esa "ko'p olgan" bo'lib
  //    ko'rinadi. Belgi: bir xil usta, bir xil kun, bir xil summa.
  {
    const rows = expensesInRange(new Date(getLedgerStart() + "T00:00:00"), new Date());
    const key = (e) => `${e.staffId}|${e.date}|${e.amount.toFixed(2)}`;
    const fromKpi = new Set(rows.filter((e) => e.source === "installer").map(key));
    const staff = new Map(listStaff().map((s) => [s.id, s]));
    const dubl = rows.filter((e) => e.source !== "installer" && e.category === "salary"
      && e.staffId && staff.get(e.staffId)?.role === "installer" && fromKpi.has(key(e)));
    for (const e of dubl) {
      if (!seen(e.kassa)) continue;
      out.push({
        id: `dubl-${e.id}`, level: "error",
        title: `${staff.get(e.staffId)?.name ?? "Usta"}: ${money(e.amount)} ikki marta hisoblangan (${e.date})`,
        detail: "Bu pul KPI jadvalidagi \"olgan\" ustunida allaqachon bor va u yerdan avtomat xarajat bo'lib chiqadi. Xarajatlardagi qo'lda kiritilgan nusxasi o'chirilsin.",
        action: "Xarajatni ochish", href: `/finance/expenses?edit=${e.id}`,
      });
    }
  }

  // 8) Oylik berilgan, lekin KIMGA berilgani bog'lanmagan
  //    Izohda ismi yozilgani yetarli emas: hisob xodim bo'yicha
  //    yuritiladi (kim qancha ishlab topdi, qancha oldi, qancha
  //    qoldi). Bog'lanmagan yozuv hech kimning balansiga tushmaydi —
  //    natijada balansdagi "to'lanmagan ish haqi" ham, xodim
  //    kartochkasidagi qarz ham noto'g'ri bo'ladi.
  //    "Ko'cha usta" ataylab qo'yilgan qiymat (hisobi yo'q usta) —
  //    u ogohlantirilmaydi.
  {
    const bogsiz = expensesInRange(new Date(getLedgerStart() + "T00:00:00"), new Date())
      .filter((e) => e.category === "salary" && e.source !== "installer"
        && !e.staffId && e.paidTo !== STREET_INSTALLER);
    if (bogsiz.length && isOwner) {
      const jami = +bogsiz.reduce((s, e) => s + e.amount, 0).toFixed(2);
      out.push({
        id: `nostaff-oylik`, level: "warn",
        title: `${bogsiz.length} ta oylik to'lovi xodimga bog'lanmagan: ${money(jami)}`,
        detail: bogsiz.slice(0, 3).map((e) => `${e.date} · ${e.note || "izohsiz"} · ${money(e.amount)}`).join(" · ")
          + " — yozuvni ochib, \"Kimga\" maydonida xodimni tanlang, shunda uning oylik balansiga tushadi.",
        action: "Xarajatlarni ochish", href: "/finance/expenses",
      });
    }
  }

  return out;
}
