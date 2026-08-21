"use client";
import { useEffect, useState } from "react";

// ══════════════════════════════════════════════════════════════
// FAQAT BRAUZERDA CHIZILADI
// ══════════════════════════════════════════════════════════════
// Nega kerak (2026-08-22):
//
// Ilova sahifalari serverda BO'SH chiziladi — ma'lumot brauzerda
// yuklanadi (modul xotirasi + PostgREST). Brauzer esa hidratsiya
// paytida allaqachon ma'lumot olgan bo'lishi mumkin: bootstrap tez
// tugasa, birinchi chizishda raqamlar bor bo'ladi.
//
// Natijada server "0" yozgan joyda brauzer "12 426" yozadi va React
// "Text content does not match server-rendered HTML" (#425) beradi:
// u serverdan kelgan HTML ni BUTUNLAY tashlab, hammasini qaytadan
// chizadi. Sahifa ishlaydi, lekin bu bekorga ish va ekran titraydi.
//
// /finance/kassa, /finance/plan va /settings da aynan shu bo'lgan.
//
// Yechim: serverda umuman chizmaymiz. Yo'qotadigan narsa yo'q —
// serverdagi HTML baribir bo'sh qobiq edi.
export default function Brauzerda({ children, orin = null }) {
  const [tayyor, setTayyor] = useState(false);
  useEffect(() => setTayyor(true), []);
  return tayyor ? children : orin;
}
