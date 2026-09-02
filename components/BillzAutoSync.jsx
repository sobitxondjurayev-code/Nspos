"use client";
// ══════════════════════════════════════════════════════════════
// BILLZ — FONDA YANGILASH
// ══════════════════════════════════════════════════════════════
// Vercel'ning Hobby tarifida cron kuniga bir martadan tez ishlay
// olmaydi. Bir kunlik kechikish esa NSPOS uchun ko'p: kassir ertalab
// tovar sotadi, rahbar tushda hisobotga qaraydi va u yerda kechagi
// raqam turadi.
//
// Yechim: ilova ochilganda oxirgi yangilanish sanasi ko'riladi, eskirgan
// bo'lsa fonda `/api/billz/sync` chaqiriladi. Ish kuni davomida kimdir
// baribir ilovani ochadi, ya'ni ma'lumot o'zi yangilanib turadi va
// Pro tarifi talab qilinmaydi.
//
// Ehtiyot choralari:
//   • faqat RAHBAR chaqiradi — server ham shuni talab qiladi (owner),
//     boshqa xodimda har ochilishda 401 chiqib turardi
//   • bir sessiyada bir marta — sahifadan sahifaga o'tishda takrorlanmaydi
//   • boshqa ochiq oyna allaqachon tortayotgan bo'lsa — tegilmaydi
//     (localStorage'dagi belgi), aks holda uch oyna uchta sinxronizatsiya
//     boshlab, Billz'ning 2 so'rov/sek chegarasiga urilardi
import { useEffect, useRef } from "react";
import { supabase, DEMO_MODE } from "@/lib/db";
import { sessiyaOl } from "@/lib/sessiya";
import { useAuth } from "@/components/AuthProvider";
import { can } from "@/lib/auth";

// Qancha vaqtdan keyin eskirgan hisoblanadi
const STALE_MS = 5 * 60 * 1000;       // 5 daqiqa — cron oralig'i bilan bir xil
// Bir vaqtda bitta oyna tortsin. Qulf yon paneldagi qo'lda bosiladigan
// "Yangilash" tugmasi bilan BIR XIL bo'lishi kerak — aks holda fon ishi
// va tugma bir vaqtda ikkita sinxronizatsiya boshlab yuborardi.
// Shuning uchun kalit shu yerdan eksport qilinadi, `YangilashTugma.jsx`
// esa uni import qiladi: satr ikki joyda yozilsa, biri o'zgarganda
// ikkinchisi jimgina moslikdan chiqadi.
export const LOCK_KEY = "nspos.billz.syncing";
export const LOCK_MS = 5 * 60 * 1000;

export default function BillzAutoSync() {
  const { user, demo, ready } = useAuth();
  const started = useRef(false);

  useEffect(() => {
    // `ready` — sessiya hali o'qilyapti. Kutmasak, user null bo'lib
    // turgan bir lahzada "rahbar emas" deb chiqib ketardik va
    // yangilanish hech qachon ishga tushmasdi.
    if (!ready || DEMO_MODE || demo || started.current) return;
    // Server faqat egasiga ruxsat beradi — boshqasi urinib ovora bo'lmasin
    if (!can("staff.manage", user)) return;
    started.current = true;

    (async () => {
      try {
        const lock = Number(localStorage.getItem(LOCK_KEY) || 0);
        if (Date.now() - lock < LOCK_MS) return;

        const { data, error } = await supabase
          .from("billz_sync_log")
          .select("finished_at")
          .not("finished_at", "is", null)
          .order("started_at", { ascending: false })
          .limit(1);
        if (error) return;                       // jadval hali yo'q — jim o'tamiz

        const last = data?.[0]?.finished_at ? new Date(data[0].finished_at).getTime() : 0;
        if (Date.now() - last < STALE_MS) return;

        const token = sessiyaOl()?.token;
        if (!token) return;

        localStorage.setItem(LOCK_KEY, String(Date.now()));
        // Javob kutilmaydi: foydalanuvchi ishlayveradi, ma'lumot esa
        // keyingi ochilishda (yoki realtime orqali) yangi bo'lib keladi.
        await fetch("/api/billz/sync", { headers: { authorization: `Bearer ${token}` } })
          .catch(() => {});
      } catch {
        // Fon ishi — xatosi foydalanuvchini bezovta qilmasligi kerak
      } finally {
        localStorage.removeItem(LOCK_KEY);
      }
    })();
  }, [user, demo, ready]);

  return null;
}
