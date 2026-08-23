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
//   • qo'lda — Sozlamalardagi "Billz'dan yangilash" tugmasi
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
// Cron  — "authorization: Bearer <CRON_SECRET>" bilan keladi
// Egasi — brauzerdan o'z tokeni bilan (faqat owner)
//
// Tekshiruv `lib/apiAuth.js` da: ilgari bu yerda Supabase Auth
// chaqirilardi va u olib tashlangandan keyin marshrut 401 emas,
// 500 qaytarardi (o'sha fayldagi izohga qarang).
async function allowed(req) {
  if (cronmi(req)) return true;
  const { prof } = await kimChaqirdi(req, ["owner"]);
  return !!prof;
}

export async function GET(req) {
  if (!url || !service) return json({ error: "Server sozlanmagan" }, 500);
  if (!isConfigured()) return json({ error: "BILLZ_SECRET_TOKEN sozlanmagan" }, 500);
  if (!(await allowed(req))) return json({ error: "Ruxsat yo'q" }, 401);

  const q = new URL(req.url).searchParams;

  // Tashxis: qaysi metod ochiq. Sotuvlar kelmasa birinchi shu ko'riladi.
  if (q.get("probe") === "1") return json({ ok: true, probe: await probe() });

  const db = createClient(url, service, { auth: { persistSession: false } });
  const startedAt = Date.now();
  const lines = [];

  try {
    // Qarzlarni qanday tortish. To'liq tortish 10 844 yozuv va ~60 s —
    // ilova har ochilganda buni qilish ortiqcha. Shuning uchun oxirgi
    // TO'LIQ tortish 20 soatdan eski bo'lsa to'liq, aks holda yengil
    // (faqat yopilmagan 273 qarz + yangilari). Kunlik cron shu qoida
    // bilan o'zi to'liq rejimga tushadi — alohida sozlash kerak emas.
    const debtsMode = q.get("debts") ?? (await debtsModeFor(db));

    const out = await runSync(db, {
      debtsMode,
      only: q.get("only") ? q.get("only").split(",").map((s) => s.trim()).filter(Boolean) : null,
      full: q.get("full") === "1",
      link: q.get("link") === "1",
      dry: q.get("dry") === "1",
      from: q.get("from"),
      to: q.get("to"),
      // Bir chaqiriqda nechta chek. Standart 300 — ~165 soniya,
      // budjetga sig'adi va katalogga ham joy qoladi.
      maxOrders: q.get("max") ? Number(q.get("max")) : 300,
      deadline: startedAt + BUDGET_MS,
      log: (m) => lines.push(m),
    });

    return json({
      ok: true,
      tookMs: Date.now() - startedAt,
      ...out,
      log: lines,
    });
  } catch (e) {
    return json({ ok: false, error: e.message, log: lines }, 500);
  }
}

// Vercel Cron GET yuboradi; tugma ham GET. POST — bir xil.
export const POST = GET;
