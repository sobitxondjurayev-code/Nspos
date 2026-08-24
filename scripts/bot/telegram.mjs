// ══════════════════════════════════════════════════════════════
// TELEGRAM — eng kichik mijoz
// ══════════════════════════════════════════════════════════════
// Kutubxona ishlatilmaydi: kerak bo'lgani atigi to'rt metod va Node
// 18 dan beri `fetch` o'zida bor. Yangi bog'liqlik esa serverda
// yangilanib turishi kerak bo'lgan yana bitta narsa.
//
// —— Nega webhook emas, long-polling ——
// Webhook uchun tashqaridan kiradigan HTTPS yo'l ochish kerak
// (nginx + sertifikat + yo'lni sir tutish). Long-polling'da esa
// bog'lanishni BOT o'zi boshlaydi — serverga tashqaridan hech kim
// kira olmaydi. Bot faqat o'qiydigan API'ga tegadi, ya'ni ochiq
// yo'l qo'shishning ma'nosi yo'q.

// Telegram bitta xabarga 4096 belgi beradi. Chegaraga tegib
// ketmaslik uchun biroz pastroqda kesamiz.
const BOLAK = 3800;

export function telegram(token) {
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN berilmagan");

  // `timeoutMs` — TARMOQ kutish muddati. U long-polling muddatidan
  // KATTA bo'lishi shart: `getUpdates` 25 soniya jimgina ushlab
  // turadi va bu normal holat, uzilish emas.
  async function chaqir(metod, tana = {}, timeoutMs = 40_000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/${metod}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(tana),
        signal: ctrl.signal,
      });
      const j = await res.json().catch(() => ({}));
      if (!j.ok) throw new Error(`${metod}: ${j.description ?? `HTTP ${res.status}`}`);
      return j.result;
    } finally {
      clearTimeout(t);
    }
  }

  // Uzun javob bo'laklarga bo'linadi. Kesish JOYI muhim: raqamlar
  // jadvali qator o'rtasidan kesilsa o'qib bo'lmaydi, shuning uchun
  // faqat yangi qator bo'yicha bo'linadi.
  function bolakla(matn) {
    if (matn.length <= BOLAK) return [matn];
    const out = [];
    let joriy = "";
    for (const qator of matn.split("\n")) {
      // Bitta qatorning o'zi chegaradan uzun bo'lsa — majburan kesamiz
      if (qator.length > BOLAK) {
        if (joriy) { out.push(joriy); joriy = ""; }
        for (let i = 0; i < qator.length; i += BOLAK) out.push(qator.slice(i, i + BOLAK));
        continue;
      }
      if (joriy.length + qator.length + 1 > BOLAK) { out.push(joriy); joriy = qator; }
      else joriy = joriy ? `${joriy}\n${qator}` : qator;
    }
    if (joriy) out.push(joriy);
    return out;
  }

  return {
    getMe: () => chaqir("getMe", {}, 15_000),

    // Ishga tushganda webhook o'chiriladi: agar u qachondir
    // qo'yilgan bo'lsa, `getUpdates` "409 Conflict" beradi va bot
    // birorta xabar ololmaydi.
    webhookOchir: () => chaqir("deleteWebhook", { drop_pending_updates: false }, 15_000),

    // "yozmoqda…" belgisi. Birinchi so'rovda API butun bazani
    // o'qiydi va javob bir necha soniya kechikadi — belgisiz bu
    // "bot o'lgan" bo'lib ko'rinadi.
    yozmoqda: (chatId) => chaqir("sendChatAction", { chat_id: chatId, action: "typing" }, 10_000),

    yangiliklar: (ofset, kutish = 25) =>
      chaqir("getUpdates", {
        offset: ofset, timeout: kutish, allowed_updates: ["message"],
      }, (kutish + 15) * 1000),

    async yubor(chatId, matn) {
      for (const bolak of bolakla(matn)) {
        await chaqir("sendMessage", {
          chat_id: chatId,
          text: bolak,
          disable_web_page_preview: true,
        }, 20_000);
      }
    },
  };
}
