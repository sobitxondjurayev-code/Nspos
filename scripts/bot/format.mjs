// ══════════════════════════════════════════════════════════════
// JAVOBNI O'QISHLI QILISH
// ══════════════════════════════════════════════════════════════
// Bu yerda HISOB YO'Q — faqat API bergan raqamni matnga o'girish.
// Bir dona qo'shish yoki foizni qayta hisoblash ham yozilmaydi:
// aks holda Telegram'dagi raqam bir kun saytdagidan farq qilib
// qoladi va qaysi biri to'g'riligi bilinmaydi.
//
// —— Nega ustunlar tekislanmaydi ——
// Telegram matnni oddiy (proportsional) shrift bilan chizadi, ya'ni
// bo'sh joy bilan tekislangan jadval baribir qiyshiq chiqadi.
// Shuning uchun "nom — qiymat" ko'rinishidagi ro'yxat ishlatiladi:
// u har shriftda bir xil o'qiladi.

const raqam = (n, kasr = 2) => Number(n ?? 0).toLocaleString("ru-RU",
  { minimumFractionDigits: kasr, maximumFractionDigits: kasr });

export const pul = (n) => `${raqam(n)} $`;
const foiz = (n) => `${raqam(n, 1)}%`;
const dona = (n) => Number(n ?? 0).toLocaleString("ru-RU");
const sana = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join(".") : "—");

// Bo'sh ro'yxat "hammasi joyida" degani emas — buni ochiq aytamiz,
// aks holda "qarzdor yo'q" bilan "ma'lumot kelmadi" bir xil ko'rinadi.
const royxat = (arr, chiz, bosh = "  yo'q") =>
  (arr?.length ? arr.map(chiz).join("\n") : bosh);

export function xulosa(d) {
  const q = [];
  q.push(`NSPOS — ${sana(d.sana)}`);
  q.push("");
  q.push("BUGUN");
  q.push(`  tushum: ${pul(d.bugun?.tushum)}`);
  q.push(`  sof foyda: ${pul(d.bugun?.sof_foyda)}`);
  q.push("");
  q.push("SHU OY");
  q.push(`  tushum: ${pul(d.shu_oy?.tushum)}`);
  q.push(`  yalpi foyda: ${pul(d.shu_oy?.yalpi_foyda)}`);
  q.push(`  sof foyda: ${pul(d.shu_oy?.sof_foyda)} (marja ${foiz(d.shu_oy?.marja_foiz)})`);
  q.push("");
  q.push(`Ochiq qarz: ${pul(d.ochiq_qarz)}`);
  q.push(`  90 kundan eski: ${pul(d.qarz_90_kundan_eski)}`);
  q.push(`Tugagan tovar: ${dona(d.tugagan_tovar)} ta`);
  q.push(`Kuniga yo'qotilayotgan foyda: ${pul(d.kuniga_yoqotilayotgan_foyda)}`);
  if (d.xatolar?.length) {
    q.push("");
    q.push(`XATO (${d.xatolar.length}):`);
    q.push(d.xatolar.map((x) => `  · ${x}`).join("\n"));
    q.push("");
    q.push("Tafsilot: /ogohlantirish");
  }
  return q.join("\n");
}

export function savdo(d) {
  const t = d.tushum ?? {};
  const x = d.xarajat ?? {};
  return [
    `SAVDO ${sana(d.davr?.dan)} — ${sana(d.davr?.gacha)}`,
    "",
    `Tushum: ${pul(t.jami)}`,
    `  tovar: ${pul(t.tovar)}`,
    `  xizmat: ${pul(t.xizmat)}`,
    `  qaytarilgan: ${pul(t.qaytarilgan)}`,
    `  chegirma: ${pul(t.chegirma)}`,
    "",
    `Tannarx: ${pul(d.tannarx)}`,
    `Yalpi foyda: ${pul(d.yalpi_foyda)} (marja ${foiz(d.yalpi_marja_foiz)})`,
    "",
    `Xarajat: ${pul(x.jami)}`,
    `  oylik: ${pul(x.oylik)}`,
    `  usta ulushi: ${pul(x.usta_ulushi)}`,
    `  doimiy: ${pul(x.doimiy)}`,
    "",
    `SOF FOYDA: ${pul(d.sof_foyda)} (marja ${foiz(d.sof_marja_foiz)})`,
  ].join("\n");
}

export function kassa(d) {
  const q = [`KASSA — ${sana(d.sana)}`, ""];
  q.push(royxat(d.hamyonlar, (h) => [
    `${h.kassa}: ${pul(h.jami)}`,
    `  naqd ${pul(h.naqd)} · Payme/karta ${pul(h.payme_karta)}`
      + (h.servis ? ` · servis ${pul(h.servis)}` : "")
      + (h.yolda ? `\n  yo'lda: ${pul(h.yolda)}` : ""),
  ].join("\n"), "  hamyon yo'q"));
  q.push("", `JAMI: ${pul(d.jami)}`);
  if (d.yolda_jami) q.push(`Yo'lda: ${pul(d.yolda_jami)} — ${d.izoh}`);
  return q.join("\n");
}

export function qarz(d) {
  return [
    `QARZ — ochiq ${pul(d.ochiq_qarz)}, ${dona(d.qarzdor_soni)} qarzdor`,
    d.muddat_kun ? `Muddati o'tgan (${d.muddat_kun} kundan): ${pul(d.muddati_otgan?.summa)} (${dona(d.muddati_otgan?.soni)} ta)` : "",
    d.shubhali ? `Shubhali (${d.shubhali.kun}+ kun): ${pul(d.shubhali.summa)} (${dona(d.shubhali.soni)} ta)` : "",
    d.top10 ? `Top-10 mijoz: ${pul(d.top10.summa)} — ${d.top10.ulush} %` + (d.dso_kun ? ` · DSO ${dona(d.dso_kun)} kun` : "") : "",
    "",
    "Yosh guruhlari (berilgan kundan):",
    royxat(d.yosh_guruhlari, (g) => `  ${g.guruh}: ${pul(g.summa)} (${dona(g.qarz_soni)} ta)`),
    "",
    "Birinchi qo'ng'iroq:",
    royxat(d.birinchi_qongiroq, (r) =>
      `  · ${r.mijoz} — ${pul(r.qarz)}\n    ${r.telefon ?? "telefon yo'q"} · ${dona(r.eng_eski_kun)} kun`),
  ].join("\n");
}

export function tovarFoyda(d) {
  const q = [
    `FOYDA (${d.kesim}) ${sana(d.davr?.dan)} — ${sana(d.davr?.gacha)}`,
    "",
    `Tushum: ${pul(d.jami?.tushum)} · Foyda: ${pul(d.jami?.foyda)}`,
    "",
  ];
  if (d.zararda?.length) {
    q.push(`ZARARDA (${d.zararda.length}):`);
    q.push(d.zararda.slice(0, 10).map((r) => `  · ${r.nom}: ${pul(r.foyda)} (${dona(r.dona)} dona)`).join("\n"));
    q.push("");
  }
  q.push("Eng ko'p foyda:");
  q.push(royxat((d.qatorlar ?? []).slice(0, 15), (r) =>
    `  · ${r.nom}\n    foyda ${pul(r.foyda)} · tushum ${pul(r.tushum)} · ${dona(r.dona)} dona · marja ${foiz(r.marja_foiz)}`));
  return q.join("\n");
}

export function qoldiq(d) {
  const o = d.olik_qoldiq ?? {};
  const q = [
    "QOLDIQ",
    "",
    `Buyurtma qilish kerak: ${dona(d.buyurtma_qilish_kerak)} pozitsiya`,
    `  shundan tugagan, lekin sotilyapti: ${dona(d.tugagan_lekin_sotilyapti)}`,
    `  kuniga yo'qotilayotgan foyda: ${pul(d.kuniga_yoqotilayotgan_foyda)}`,
    "",
    "Birinchi buyurtma:",
    royxat((d.buyurtma ?? []).slice(0, 12), (r) =>
      `  · ${r.tovar}\n    qoldiq ${dona(r.qoldiq)} · ${dona(r.necha_kunga_yetadi)} kunga yetadi`
      + ` · ${dona(r.buyurtma_miqdori)} dona kerak`),
    "",
    `O'lik qoldiq: ${pul(o.summa)} (${dona(o.pozitsiya)} pozitsiya)`,
    royxat(o.guruhlar, (g) => `  ${g.guruh}: ${pul(g.summa)} (${dona(g.soni)} ta)`, "  yo'q"),
  ];
  if (d.izoh) q.push("", d.izoh);
  return q.join("\n");
}

export function mijoz(d) {
  const q = [
    `MIJOZ — ${dona(d.odam)} odam, ${pul(d.jami_qoldirgan_puli)}`,
    "",
    "Segmentlar:",
    royxat(d.segmentlar, (s) =>
      `  · ${s.segment}: ${dona(s.odam)} odam, ${pul(s.puli)}`
      + (s.nima_qilish ? `\n    ${s.nima_qilish}` : "")),
    "",
    "Eng qimmatli:",
    royxat((d.eng_qimmatli ?? []).slice(0, 10), (r) =>
      `  · ${r.mijoz} — ${pul(r.puli)} (${dona(r.xarid)} xarid, oxirgisi ${dona(r.oxirgi_xarid_kun_oldin)} kun oldin)`),
  ];
  if (d.izoh) q.push("", d.izoh);
  return q.join("\n");
}

export function ogohlantirish(d) {
  const n = d.nomuvofiqlik ?? [];
  const m = d.malumot_xatolari ?? [];
  if (!n.length && !m.length) return "OGOHLANTIRISH\n\nHammasi joyida — nomuvofiqlik ham, ma'lumot xatosi ham yo'q.";
  const q = [`OGOHLANTIRISH — ${n.length + m.length} ta`, ""];
  if (n.length) {
    q.push("Raqamlar bir-biriga to'g'ri kelmadi:");
    q.push(n.map((r) => `  ${r.daraja === "xato" ? "XATO" : "ogoh"} · ${r.tekshiruv}\n    ${r.matn}`).join("\n"));
    q.push("");
  }
  if (m.length) {
    q.push("Ma'lumotdagi xato:");
    q.push(m.map((r) => `  · ${r.matn}`).join("\n"));
  }
  return q.join("\n");
}

export const YORDAM = [
  "NSPOS boti — faqat o'qiydi, hech narsa o'zgartirmaydi.",
  "",
  "/xulosa — bugungi va shu oygi holat",
  "/savdo — foyda va zarar (P&L)",
  "    /savdo bugun · kecha · hafta · oy",
  "    /savdo 2026-08-01 2026-08-23",
  "/kassa — qaysi hamyonda qancha pul bor",
  "/qarz — ochiq qarz va kimga qo'ng'iroq qilish",
  "/tovar — nima foyda keltirdi",
  "    /tovar kategoriya · brend · dokon",
  "/qoldiq — nimani buyurtma qilish kerak",
  "/mijoz — mijoz segmentlari (RFM)",
  "/ogohlantirish — raqamlarda xato bormi",
  "/yangila — ma'lumotni qaytadan o'qish",
  "",
  "Raqamlar sayt bilan bir xil funksiyadan chiqadi: tizim.enes.uz",
].join("\n");
