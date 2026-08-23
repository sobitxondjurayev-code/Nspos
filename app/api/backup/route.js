// ══════════════════════════════════════════════════════════════
// KUNLIK ZAXIRA — SERVER YO'LI
// ══════════════════════════════════════════════════════════════
// Nega kerak: baza o'z serverimizda turibdi. `05-zaxira.sh` har kecha
// `pg_dump` qiladi, lekin u nusxa SERVERNING O'ZIDA qoladi — disk
// yonsa yoki server yo'qolsa, zaxira ham u bilan ketadi. Shuning
// uchun butun baza bitta faylga yig'ilib, EGASIGA TEGISHLI joyga
// (Telegram va Google Drive) — ya'ni serverdan TASHQARIGA yuboriladi.
//
// Nima yig'iladi: faqat NSPOS'ning o'zida yashaydigan ma'lumot emas,
// hammasi — mijozlar, qarzlar, KPI, xarajat, kassa, to'lov rejasi.
// Qarz va mijozlarni Billz'dan qayta yuklash mumkin, qolganini esa
// hech qayerdan tiklab bo'lmaydi.
//
// Ishga tushishi:
//   • har kecha — server croni, 03:15 Toshkent
//     (`scripts/server/12-zaxira-tashqi.sh`)
//   • qo'lda    — Sozlamalardagi "Zaxira" tugmasi (egasi bosadi)
import { createClient } from "@supabase/supabase-js";
import { BACKUP_TABLES } from "@/lib/backupTables";
import { kimChaqirdi, cronmi, json } from "@/lib/apiAuth";

export const maxDuration = 60;

// Bu marshrut SERVERNING O'ZIDA ishlaydi, shuning uchun bazaga
// ICHKI manzil orqali boradi (`NSPOS_REST_INTERNAL`).
//
// Nega: `NEXT_PUBLIC_SUPABASE_URL` endi `https://tizim.enes.uz` —
// u BRAUZER uchun. Server o'sha manzilni ishlatsa, o'ziga tashqi
// internet va TLS orqali aylanib boradi: bekorga sekin, va DNS
// yoki sertifikat buzilsa Billz sinxronizatsiyasi ham to'xtaydi.
const url = process.env.NSPOS_REST_INTERNAL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_CHAT_ID;
const DRIVE_HOOK = process.env.DRIVE_BACKUP_URL;   // Google Apps Script veb-ilova

// Jadvallar ro'yxati `lib/backupTables.js` da — bitta joyda, chunki u
// tiklash yo'liga va tekshiruvga ham kerak (ikki nusxa ajralib ketadi).
const TABLES = BACKUP_TABLES;

const iso = (d) => d.toISOString().slice(0, 10);

// —— Kim chaqirdi ————————————————————————————————
// Cron  — "authorization: Bearer <CRON_SECRET>" bilan keladi
// Egasi — brauzerdan o'z tokeni bilan (faqat owner)
//
// Tekshiruv `lib/apiAuth.js` da (2026-08-24): ilgari bu yerda
// Supabase Auth chaqirilardi, u esa olib tashlangan — rahbar
// qo'lda zaxira ololmasdi. Cron ishlab turgani buni yashirgan.
async function allowed(req) {
  if (cronmi(req)) return true;
  const { prof } = await kimChaqirdi(req, ["owner"]);
  return !!prof;
}

// —— Bazani o'qish ————————————————————————————————
// Katta jadvallar sahifama-sahifa olinadi: PostgREST bir so'rovda
// hammasini bermaydi va jimgina 1000 tada kesib qo'yadi.
async function dumpTable(admin, table) {
  const rows = [];
  const step = 1000;
  for (let from = 0; ; from += step) {
    const { data, error } = await admin.from(table).select("*").range(from, from + step - 1);
    if (error) return { error: error.message };
    rows.push(...(data ?? []));
    if (!data || data.length < step) break;
    if (rows.length > 200_000) break;     // ehtiyot chegara
  }
  return { rows };
}

async function buildBackup() {
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const out = { takenAt: new Date().toISOString(), tables: {} };
  const missing = [];
  for (const t of TABLES) {
    const r = await dumpTable(admin, t);
    if (r.error) { missing.push(`${t}: ${r.error}`); continue; }
    out.tables[t] = r.rows;
  }
  out.skipped = missing;
  out.counts = Object.fromEntries(Object.entries(out.tables).map(([k, v]) => [k, v.length]));
  return out;
}

// —— Yuborish ————————————————————————————————————
async function toTelegram(buf, name, caption) {
  if (!TG_TOKEN || !TG_CHAT) return "sozlanmagan";
  const form = new FormData();
  form.append("chat_id", TG_CHAT);
  form.append("caption", caption);
  form.append("document", new Blob([buf], { type: "application/json" }), name);
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendDocument`, {
    method: "POST", body: form,
  });
  const j = await res.json().catch(() => ({}));
  return j.ok ? "yuborildi" : `xato: ${j.description ?? res.status}`;
}

async function toDrive(text, name) {
  if (!DRIVE_HOOK) return "sozlanmagan";
  const res = await fetch(DRIVE_HOOK, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, content: text }),
  });
  return res.ok ? "yuborildi" : `xato: ${res.status}`;
}

export async function GET(req) {
  if (!url || !service) return json({ error: "Server sozlanmagan" }, 500);
  if (!(await allowed(req))) return json({ error: "Ruxsat yo'q" }, 401);

  const wantFile = new URL(req.url).searchParams.get("download") === "1";
  const data = await buildBackup();
  const text = JSON.stringify(data);
  const name = `nspos-zaxira-${iso(new Date())}.json`;

  // Tugma bosilganda — faylning o'zi qaytadi
  if (wantFile) {
    return new Response(text, {
      headers: {
        "content-type": "application/json",
        "content-disposition": `attachment; filename="${name}"`,
      },
    });
  }

  const total = Object.values(data.counts).reduce((a, b) => a + b, 0);
  const caption = `NSPOS zaxira · ${iso(new Date())}\n${total.toLocaleString("ru-RU")} ta yozuv`;
  const [tg, drive] = await Promise.all([
    toTelegram(Buffer.from(text), name, caption),
    toDrive(text, name),
  ]);

  return json({ ok: true, name, rows: total, counts: data.counts, telegram: tg, drive, skipped: data.skipped });
}

export const POST = GET;
