// ══════════════════════════════════════════════════════════════
// BILLZ SINXRONIZATSIYASI — SERVER YO'LI
// ══════════════════════════════════════════════════════════════
// Nega server: Billz kaliti (`BILLZ_SECRET_TOKEN`) brauzerga tushmasligi
// kerak, va yozish RLS ni chetlab o'tadigan service key bilan boradi.
// `app/api/backup/route.js` bilan bir xil naqsh — ruxsat tekshiruvi ham
// o'sha (Cron siri yoki egasi tokeni).
//
// Ishga tushishi:
//   • har kuni 03:00 UTC (08:00 Toshkent) — Vercel Cron (vercel.json)
//   • ilova ochilganda — oxirgi yangilanish eskirgan bo'lsa, fonda
//     (`components/BillzAutoSync.jsx`)
//   • qo'lda — Sozlamalardagi "Billz'dan yangilash" tugmasi
//   • bir martalik to'liq — `npm run billz -- --full` (skript, bu yo'l EMAS)
//
// NEGA CRON KUNIGA BIR MARTA: Vercel'ning Hobby tarifida cron kuniga
// bir martadan tez ishlay olmaydi — `*/30 * * * *` yozilsa deploy
// XATO BERADI ("Hobby accounts are limited to daily cron jobs").
// Kun davomida yangilik ilova ochilganda tortiladi; bu 5-10 kishilik
// jamoa uchun yetarli va Pro tarifi talab qilmaydi. Pro'ga o'tilsa
// vercel.json dagi jadvalni "*/30 * * * *" ga o'zgartirish kifoya.
//
// DIQQAT — vaqt cheklovi: Vercel funksiyasi 300 soniya ishlaydi, Billz
// esa sekundiga 2 so'rov beradi. Ya'ni bitta chaqiriqda eng ko'pi ~500
// so'rov. Katalog bunga bemalol sig'adi (652 tovar = 7 so'rov), cheklar
// esa yo'q: har chek uchun alohida so'rov kerak. Shuning uchun cheklar
// BO'LAKLAB olinadi va qayerda to'xtagani `billz_sync_log.cursor_at`
// da qoladi — keyingi chaqiriq o'sha yerdan davom etadi.
import { createClient } from "@supabase/supabase-js";
import { runSync } from "@/lib/billzSync";
import { probe, isConfigured } from "@/lib/billzApi";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

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

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json" },
  });
}

// —— Kim chaqirdi ————————————————————————————————
// Cron  — Vercel "authorization: Bearer <CRON_SECRET>" bilan keladi
// Egasi — brauzerdan o'z tokeni bilan (faqat owner)
async function allowed(req) {
  const auth = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (CRON_SECRET && auth === CRON_SECRET) return true;
  if (!auth) return false;
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: { user } } = await admin.auth.getUser(auth);
  if (!user) return false;
  const { data: prof } = await admin.from("profiles").select("role").eq("id", user.id).single();
  return prof?.role === "owner";
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
