// ══════════════════════════════════════════════════════════════
// BILLZ SINXRONIZATSIYASI — SERVER YO'LI
// ══════════════════════════════════════════════════════════════
// Nega server: Billz kaliti (`BILLZ_SECRET_TOKEN`) brauzerga tushmasligi
// kerak, va yozish RLS ni chetlab o'tadigan service key bilan boradi.
// `app/api/backup/route.js` bilan bir xil naqsh — ruxsat tekshiruvi ham
// o'sha (Cron siri yoki egasi tokeni).
//
// Ishga tushishi:
//   • har 30 daqiqada — server croni (`scripts/server/06-billz-cron.sh`)
//   • ilova ochilganda — oxirgi yangilanish eskirgan bo'lsa, fonda
//     (`components/BillzAutoSync.jsx`)
//   • qo'lda, har xodim — yon paneldagi "Yangilash" tugmasi
//     (`components/YangilashTugma.jsx`)
//   • qo'lda, rahbar — Sozlamalardagi "Billz'dan yangilash" kartochkasi
//     (u yerda tashxis va to'liq tortish ham bor)
//   • bir martalik to'liq — `npm run billz -- --full` (skript, bu yo'l EMAS)
//
// CRON ORALIG'I: har 30 daqiqada. Ilgari kuniga bir marta edi —
// Vercel'ning Hobby tarifi undan tez ruxsat bermasdi ("Hobby accounts
// are limited to daily cron jobs"). O'z serverimizda bunday cheklov
// yo'q: bitta to'liq sinxronizatsiya ~68 soniya, Billz esa sekundiga
// 2 so'rov beradi — 30 daqiqa bemalol yetadi.
//
// DIQQAT — vaqt cheklovi: chaqiruvchi cron `--max-time 290` bilan
// keladi (`06-billz-cron.sh`), Billz esa sekundiga 2 so'rov beradi.
// Ya'ni bitta chaqiriqda eng ko'pi ~500 so'rov. Cheklov endi
// Vercel'niki emas, o'zimiz qo'yganimiz — lekin BO'LAKLASH baribir
// kerak: uzun so'rov uzilib qolsa ish boshidan boshlanardi. Katalog bunga bemalol sig'adi (652 tovar = 7 so'rov), cheklar
// esa yo'q: har chek uchun alohida so'rov kerak. Shuning uchun cheklar
// BO'LAKLAB olinadi va qayerda to'xtagani `billz_sync_log.cursor_at`
// da qoladi — keyingi chaqiriq o'sha yerdan davom etadi.
import { createClient } from "@supabase/supabase-js";
import { runSync } from "@/lib/billzSync";
import { probe, isConfigured } from "@/lib/billzApi";
import { kimChaqirdi, cronmi, json } from "@/lib/apiAuth";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Bu marshrut SERVERNING O'ZIDA ishlaydi, shuning uchun bazaga
// ICHKI manzil orqali boradi (`NSPOS_REST_INTERNAL`).
//
// Nega: `NEXT_PUBLIC_SUPABASE_URL` endi `https://tizim.enes.uz` —
// u BRAUZER uchun. Server o'sha manzilni ishlatsa, o'ziga tashqi
// internet va TLS orqali aylanib boradi: bekorga sekin, va DNS
// yoki sertifikat buzilsa Billz sinxronizatsiyasi ham to'xtaydi.
const url = process.env.NSPOS_REST_INTERNAL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Funksiya o'chib qolmasin: to'xtashga 20 soniya zaxira qoldiramiz,
// shunda jurnal va javob yozilib ulguradi.
const BUDGET_MS = (maxDuration - 20) * 1000;

// Oxirgi to'liq qarz tortishdan 20 soat o'tganmi
async function debtsModeFor(db) {
  const { data } = await db.from("billz_sync_log")
    .select("finished_at")
    .eq("entity", "debts").eq("mode", "full")
    .not("finished_at", "is", null)
    .order("started_at", { ascending: false }).limit(1);
  const last = data?.[0]?.finished_at ? new Date(data[0].finished_at).getTime() : 0;
  return Date.now() - last > 20 * 3600_000 ? "full" : "light";
}

// —— Kim chaqirdi ————————————————————————————————
// Uch xil chaqiruvchi bor va ularning huquqi BIR XIL EMAS:
//
//   cron   — "authorization: Bearer <CRON_SECRET>" bilan keladi.
//            Cheklovsiz: to'liq tortish ham, uzun oraliq ham undan.
//   rahbar — brauzerdan o'z tokeni bilan. Cheklovsiz (Sozlamalardagi
//            tashxis va "to'liq tortish" tugmalari shu yo'ldan).
//   xodim  — har qanday tizimga kirgan foydalanuvchi. FAQAT standart
//            inkremental yangilash: yon paneldagi "Yangilash" tugmasi.
//
// Nega xodimga ham ochildi (2026-08-24 qarori): ilgari faqat rahbar
// yangilay olardi, ya'ni menejer ekranidagi raqam cron kelguncha
// (30 daqiqagacha) eski turardi va u buni BILMASDI ham. Endi tugma
// hammada, lekin xavfli parametrlar rahbarda qoladi.
//
// Tekshiruv `lib/apiAuth.js` da: ilgari bu yerda Supabase Auth
// chaqirilardi va u olib tashlangandan keyin marshrut 401 emas,
// 500 qaytarardi (o'sha fayldagi izohga qarang).
async function chaqiruvchi(req) {
  if (cronmi(req)) return { tur: "cron", toliq: true };
  const { prof } = await kimChaqirdi(req, []);
  if (!prof) return null;
  return { tur: prof.role === "owner" ? "rahbar" : "xodim", toliq: prof.role === "owner" };
}

// —— Ikki qo'riqchi: Billz bekorga urilmasin ————————————
//
// 1. YAQINDA yangilangan bo'lsa qayta tortilmaydi. Tugma hammada
//    turgani uchun uch xodim ketma-ket bosishi mumkin; Billz esa
//    sekundiga 2 so'rov beradi va shubhali IP'ni bloklaydi.
//    Cron bu qo'riqchidan o'tmaydi — u o'z jadvali bilan yuradi.
//
//    NEGA ATIGI 1 DAQIQA. Darvoza uzunroq bo'lsa (masalan 5 daqiqa)
//    u ASL MAQSADGA qarshi ishlaydi: kassir hozir chek kesadi, menejer
//    Yangilashni bosadi, sahifa qayta yuklanadi va yangi chek YO'Q —
//    chunki server "yaqinda tortilgan" deb Billz'ga umuman bormagan.
//    Ekranda esa hech qanday belgi yo'q: sahifa yangilandi, raqam
//    eski. Bu aynan biz qochadigan jim xato. Bir daqiqa esa faqat
//    ketma-ket bosishni to'xtatadi — o'sha vaqt ichida yangi ma'lumot
//    paydo bo'lishi amalda mumkin emas.
const YAQINDA_MS = 60_000;

// 2. Ayni paytda yurgan sinxronizatsiya ustiga ikkinchisi tushmasin.
//    Bu MODUL o'zgaruvchisi, ya'ni faqat BITTA Node jarayoni bo'lganda
//    to'g'ri ishlaydi. Bizda shunday: sayt VPS'da yagona `nspos`
//    xizmati bo'lib turadi. Ko'p nusxali muhitga ko'chirilsa bu
//    qo'riqchi yetmaydi — u yerda bazadagi qulf kerak bo'ladi.
//    (Cron tomonda ayrim qulf bor: `06-billz-cron.sh` → `flock -n`.)
let ayniPaytda = false;

// Oxirgi muvaffaqiyatli yurish qachon tugagan
async function oxirgiYangilash(db) {
  const { data } = await db.from("billz_sync_log")
    .select("finished_at")
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false }).limit(1);
  return data?.[0]?.finished_at ?? null;
}

export async function GET(req) {
  if (!url || !service) return json({ error: "Server sozlanmagan" }, 500);
  if (!isConfigured()) return json({ error: "BILLZ_SECRET_TOKEN sozlanmagan" }, 500);

  const kim = await chaqiruvchi(req);
  if (!kim) return json({ error: "Ruxsat yo'q" }, 401);

  const q = new URL(req.url).searchParams;
  // Xavfli/qimmat parametrlar faqat rahbar va cronda. Xodim ularni
  // yuborsa JIM e'tiborsiz qoldiriladi — javobdagi `rejim` amalda
  // nima bajarilganini aytadi, ya'ni "so'radim-u bo'lmadi" holati
  // ko'rinib turadi.
  const par = (nom) => (kim.toliq ? q.get(nom) : null);

  const db = createClient(url, service, { auth: { persistSession: false } });

  // Tashxis: qaysi metod ochiq. Sotuvlar kelmasa birinchi shu ko'riladi.
  // Bu Billz'ning 5 ta yo'lini urib ko'radi — xodim tugmasi uni
  // chaqirmaydi.
  if (par("probe") === "1") return json({ ok: true, probe: await probe() });

  if (kim.tur !== "cron") {
    if (ayniPaytda) return json({ ok: true, skipped: true, running: true, rejim: kim.tur });
    const oxirgi = await oxirgiYangilash(db);
    const yosh = oxirgi ? Date.now() - new Date(oxirgi).getTime() : Infinity;
    if (yosh < YAQINDA_MS) {
      return json({ ok: true, skipped: true, freshAt: oxirgi, rejim: kim.tur });
    }
  }

  const startedAt = Date.now();
  const lines = [];

  ayniPaytda = true;
  try {
    // Qarzlarni qanday tortish. To'liq tortish 10 844 yozuv va ~60 s —
    // ilova har ochilganda buni qilish ortiqcha. Shuning uchun oxirgi
    // TO'LIQ tortish 20 soatdan eski bo'lsa to'liq, aks holda yengil
    // (faqat yopilmagan 273 qarz + yangilari). Kunlik cron shu qoida
    // bilan o'zi to'liq rejimga tushadi — alohida sozlash kerak emas.
    const debtsMode = par("debts") ?? (await debtsModeFor(db));

    const out = await runSync(db, {
      debtsMode,
      only: par("only") ? par("only").split(",").map((s) => s.trim()).filter(Boolean) : null,
      full: par("full") === "1",
      link: par("link") === "1",
      dry: par("dry") === "1",
      from: par("from"),
      to: par("to"),
      // Bir chaqiriqda nechta chek. Standart 300 — ~165 soniya,
      // budjetga sig'adi va katalogga ham joy qoladi.
      maxOrders: par("max") ? Number(par("max")) : 300,
      deadline: startedAt + BUDGET_MS,
      log: (m) => lines.push(m),
    });

    return json({
      ok: true,
      tookMs: Date.now() - startedAt,
      rejim: kim.tur,
      ...out,
      log: lines,
    });
  } catch (e) {
    return json({ ok: false, error: e.message, log: lines }, 500);
  } finally {
    // `finally` SHART: xato bo'lganda qulf ochilmasa marshrut
    // butunlay o'lib qolardi — jarayon qayta ishga tushmaguncha
    // hech kim yangilay olmasdi.
    ayniPaytda = false;
  }
}

// Vercel Cron GET yuboradi; tugma ham GET. POST — bir xil.
export const POST = GET;
