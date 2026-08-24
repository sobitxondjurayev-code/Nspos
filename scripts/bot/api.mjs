// ══════════════════════════════════════════════════════════════
// NSPOS API MIJOZI — bot faqat shu orqali ma'lumot oladi
// ══════════════════════════════════════════════════════════════
// ── ENG MUHIM QOIDA ──
// Bot BAZAGA ULANMAYDI. U `scripts/api/server.mjs` ga HTTP orqali
// murojaat qiladi. Sabab uch qavat:
//   1. API faqat GET qabul qiladi — yozish yo'li umuman yo'q
//   2. API'ning baza roli faqat SELECT huquqiga ega
//   3. Botda baza paroli yo'q, faqat HTTP tokeni bor
// Ya'ni bot xato yozilgan taqdirda ham hech narsani buza olmaydi.
//
// Ikkinchi sabab — raqamlar bir joydan chiqsin: API ekrandagi
// funksiyalarni chaqiradi. Bot o'zi hisoblasa, bir kun Telegram'da
// bir raqam, saytda boshqa raqam bo'lib qolardi.
//
// Manzil `127.0.0.1` — o'z ichidagi yo'l: DNS ham, sertifikat ham,
// tashqi tarmoq ham kerak emas (`scripts/server/10-ichki.sh` dagi
// mulohaza bilan bir xil).

export function nsposApi(baza, token) {
  return async function ol(yol, parametr = {}) {
    const u = new URL(yol, baza);
    for (const [k, v] of Object.entries(parametr)) {
      if (v !== null && v !== undefined) u.searchParams.set(k, v);
    }

    // Muddat uzun: API birinchi so'rovda butun bazani xotiraga
    // o'qiydi (~31 000 qator). Keyingi so'rovlar keshdan keladi.
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 120_000);
    let res;
    try {
      res = await fetch(u, {
        headers: { authorization: `Bearer ${token}` },
        signal: ctrl.signal,
      });
    } catch (e) {
      throw new Error(e.name === "AbortError"
        ? "API javob bermadi (2 daqiqa kutildi)"
        : `API'ga ulanib bo'lmadi: ${e.message}`);
    } finally {
      clearTimeout(t);
    }

    const matn = await res.text();
    let javob;
    try {
      javob = JSON.parse(matn);
    } catch {
      throw new Error(`API JSON emas, ${res.status} qaytardi`);
    }
    // API xatoni doim `xato` maydonida beradi (server.mjs `javob()`)
    if (!res.ok) throw new Error(javob.xato ?? `API ${res.status}`);
    return javob;
  };
}
