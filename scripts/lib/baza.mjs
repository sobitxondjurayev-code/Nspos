// ══════════════════════════════════════════════════════════════
// QAYSI BAZAGA BORYAPMIZ — OGOHLANTIRISH EMAS, TO'SIQ
// ══════════════════════════════════════════════════════════════
// Bu fayl bitta savolga javob beradi: "skript haqiqiy bazaga
// boryaptimi?" — va javob "yo'q" bo'lsa skriptni TO'XTATADI.
//
// —— Nega ogohlantirish yetarli emas ——
// 2026-08-23 da `.env.local` VPS'ga ko'chishdan oldingi Supabase
// manzilida qolib ketgani aniqlandi va `scripts/billz-sync.mjs` ga
// bosh qatorda manbani aytadigan ogohlantirish qo'shildi:
//
//   [   0s] DIQQAT: bu HAQIQIY baza emas (tizim.enes.uz kutilgan edi)
//
// Bu qator 24-avgustdan 28-avgustgacha HAR YURISHDA chiqdi. Hech kim
// to'xtamadi va `.env.local` tuzatilmadi. 28-avgustda tekshirilganda
// eski bazada 9 032 sotuv, haqiqiysida 9 357 edi — ya'ni oradagi besh
// kun davomida kompyuterdan olingan har o'lchov noto'g'ri edi.
//
// Sabog'i: yozib qo'yilgan ogohlantirish — bajarilmaydigan ogohlantirish.
// Xato qimmat bo'lsa, to'siq kerak. Shuning uchun endi skript ishga
// tushmaydi va nima qilish kerakligini aytadi.
//
// —— Chetlab o'tish ——
// Ataylab boshqa bazaga borish kerak bo'lsa (masalan eskisini
// solishtirish yoki mahalliy nusxada sinash) — `--boshqa-baza`
// bayrog'i. Ya'ni "boshqa bazaga boryapman" degan gap BUYRUQDA
// ko'rinib turadi, sozlama faylida yashirinmaydi.

/** Haqiqiy, ishlab turgan baza. Boshqa hammasi — nusxa yoki arxiv. */
export const HAQIQIY_HOST = "tizim.enes.uz";

/** Manzildan faqat hostni ajratadi. Parol yoki kalit hech qachon qaytmaydi. */
export function bazaHost(manzil) {
  if (!manzil) return "(sozlanmagan)";
  try {
    return new URL(manzil).host;
  } catch {
    // `postgres://user:parol@host:5432/nspos` — URL() ba'zan yiqiladi
    return String(manzil).replace(/^[a-z+]+:\/\//, "").split("@").pop().split(/[:/?]/)[0];
  }
}

/** Shu host haqiqiy bazamimi. */
export const haqiqiyMi = (host) => host === HAQIQIY_HOST || host.endsWith(`.${HAQIQIY_HOST}`);

/**
 * Manbani AYTADI va noto'g'ri bo'lsa to'xtatadi.
 *
 * @param  {string}   manzil    baza manzili (URL yoki ulanish satri)
 * @param  {object}   [o]
 * @param  {boolean}  [o.ruxsat]  `--boshqa-baza` berilganmi
 * @param  {function} [o.ayt]     qayerga yozilsin (standart: console.error)
 * @param  {string}   [o.nima]    skript nomi — xato matnida ko'rinadi
 * @returns {string}  host
 */
export function bazaTekshir(manzil, { ruxsat = false, ayt = console.error, nima = "skript" } = {}) {
  const host = bazaHost(manzil);

  if (haqiqiyMi(host)) return host;

  if (ruxsat) {
    // Ataylab. Baribir har qadamda ko'rinib tursin — bu yurishning
    // natijasi haqiqiy baza haqida EMAS.
    ayt(`⚠️  BOSHQA BAZA: ${host} (--boshqa-baza berilgan). Natija haqiqiy bazaga tegishli emas.`);
    return host;
  }

  ayt("");
  ayt(`✋ To'xtadi: ${nima} HAQIQIY bazaga qaramayapti.`);
  ayt("");
  ayt(`   qayerga qaradi : ${host}`);
  ayt(`   kutilgan edi   : ${HAQIQIY_HOST}`);
  ayt("");
  ayt("   `.env.local` da NEXT_PUBLIC_SUPABASE_URL ni tekshiring —");
  ayt("   u `https://tizim.enes.uz` bo'lishi kerak. Kalitlar serverdagi");
  ayt("   /opt/nspos/app/.env.production faylida.");
  ayt("");
  ayt("   Boshqa bazaga ATAYLAB borayotgan bo'lsangiz: --boshqa-baza");
  ayt("");
  process.exit(1);
}
