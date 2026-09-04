"use client";
// ══════════════════════════════════════════════════════════════
// USTALAR REYTINGINING MANBASI
// ══════════════════════════════════════════════════════════════
// Rahbar fidbegi (2026-09-03): "ustlar bir-birlarini nechta dona
// o'rnatganini ko'rishi kerak, va NPS ko'rinishi kerak; qolgan
// davomat va oyliklar ko'rinmasin".
//
// Nega alohida manba kerak bo'ldi. `kpi_day` va `nps_records` ga
// RLS qo'yilgan: usta faqat O'Z qatorini ko'radi. Siyosatni
// kengaytirib bo'lmaydi — RLS USTUNNI yashira olmaydi, ya'ni qator
// ochilsa `data.olgan` (usta olgan pul) va mijoz telefoni ham
// ochiladi. Shuning uchun bazada ikkita `security definer` ko'rinish
// bor (`scripts/sql/usta-reyting.sql`), ular faqat zararsiz maydonni
// beradi: kamera soni va NPS o'rtachasi.
//
// Ya'ni "faqat shtuk va NPS" cheklovi shu modulda emas, BAZADA.
// Bu modul shunchaki o'qiydi.
//
// Ko'rinish REALTIME bermaydi (`realtime: false`) — Postgres
// publication ko'rinishni qabul qilmaydi. Ma'lumot boshlang'ich
// yuklashda va sahifa yangilanganda keladi; reyting jonli
// tahrirlanadigan jadval emas, bu yetarli.
import { registerModule } from "./db";
import { ymd } from "./dates";

let kunlar = [];      // { staffId, date, cameras }
let baholar = [];     // { staffId, month, avg, count }

registerModule("installer_cameras", {
  table: "installer_cameras", select: "*", realtime: false,
  fromRow: (r) => ({
    staffId: r.staff_id,
    date: String(r.date).slice(0, 10),
    cameras: Number(r.cameras) || 0,
  }),
  restore: (rows) => { kunlar = rows; },
});

registerModule("installer_nps", {
  table: "installer_nps", select: "*", realtime: false,
  fromRow: (r) => ({
    staffId: r.staff_id,
    month: r.month,
    avg: r.nps_avg == null ? null : Number(r.nps_avg),
    count: Number(r.nps_count) || 0,
  }),
  restore: (rows) => { baholar = rows; },
});

// —— Kamera soni ————————————————————————————————
// BITTA funksiya, davr parametri bilan: oylik yig'indi ham shundan
// olinadi (oy chegaralari berilib). Ikkinchi "oylik" funksiya
// yozilmaydi — aks holda ikki joyda ikki xil raqam paydo bo'ladi.
//
// Sana `ymd()` bilan keltiriladi, `String(Date)` bilan EMAS:
// DAFTAR.md 175-182 da aynan shu xato "Ustalar reytingida hamma
// raqam 0" qilgan ("Sat Aug 01 2026…" bilan taqqoslanardi).
export function boardCameras(staffId, from, to) {
  const a = ymd(from), b = ymd(to);
  let n = 0;
  for (const k of kunlar) {
    if (k.staffId !== staffId) continue;
    if (k.date < a || k.date > b) continue;
    n += k.cameras;
  }
  return n;
}

// Oyning boshi va oxiri — "2026-09" → { from, to }
export const monthBounds = (month) => {
  const [y, m] = String(month).split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
};

// —— NPS ————————————————————————————————————————
// `npsData.npsForInstaller` bilan BIR XIL shakl qaytaradi
// ({ avg, count }) — jadval qaysi biridan o'qishidan qat'i nazar
// kod bir xil ko'rinadi.
export function boardNps(staffId, month) {
  const r = baholar.find((x) => x.staffId === staffId && x.month === month);
  return r ? { avg: r.avg, count: r.count } : { avg: null, count: 0 };
}

// Tekshiruv uchun: ko'rinishda umuman qator bormi. Bo'sh bo'lsa
// "hamma nol" bilan "ma'lumot kelmadi" ni ajratib bo'ladi.
export const boardRows = () => kunlar.length;
