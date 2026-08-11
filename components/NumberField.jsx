"use client";
import { useEffect, useRef, useState } from "react";

// ══════════════════════════════════════════════════════════════
// RAQAM MAYDONI — mingliklar ajratilgan holda
// ══════════════════════════════════════════════════════════════
// Oddiy <input type="number"> ajratkich ko'rsatolmaydi: 2000000 deb
// turadi va nolni sanashga to'g'ri keladi. Shuning uchun text maydon
// ishlatiladi, formatlash o'zimizda.
//
// Asosiy qiyinchilik — KURSOR. Matnni qayta formatlaganda kursor
// oxiriga sakrab ketadi va o'rtaga raqam qo'shib bo'lmaydi. Yechim:
// kursorgacha nechta RAQAM borligini sanab qo'yamiz va formatdan
// keyin o'sha raqamdan keyingi joyga qaytaramiz.

const NBSP = " ";

// 1234567.5 → "1 234 567.5"
function format(raw) {
  if (raw === "" || raw == null) return "";
  const neg = String(raw).trim().startsWith("-");
  const digits = String(raw).replace(/[^\d.]/g, "");
  const [int, ...rest] = digits.split(".");
  // Boshidagi keraksiz nollarni olib tashlaymiz: "020" → "20", "0" qoladi
  const cleanInt = (int || "").replace(/^0+(?=\d)/, "");
  const grouped = cleanInt.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const frac = rest.length ? "." + rest.join("") : "";
  return (neg ? "-" : "") + grouped + frac;
}

// Kursorgacha nechta raqam bor
const digitsBefore = (text, pos) => (text.slice(0, pos).match(/[\d.]/g) ?? []).length;

// N-raqamdan keyingi joy
function caretAfterDigits(text, n) {
  if (n <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i++) {
    if (/[\d.]/.test(text[i])) seen++;
    if (seen === n) return i + 1;
  }
  return text.length;
}

export default function NumberField({
  value, onChange, className = "inp", placeholder = "", allowEmpty = false, ...rest
}) {
  const ref = useRef(null);
  const caret = useRef(null);
  const [text, setText] = useState(() => format(value ?? ""));

  // Tashqaridan qiymat o'zgarsa moslaymiz, lekin foydalanuvchi
  // yozayotgan paytda tegmaymiz
  useEffect(() => {
    if (document.activeElement === ref.current) return;
    setText(format(value ?? ""));
  }, [value]);

  useEffect(() => {
    if (caret.current == null || !ref.current) return;
    const pos = caretAfterDigits(text, caret.current);
    ref.current.setSelectionRange(pos, pos);
    caret.current = null;
  }, [text]);

  function handle(e) {
    const el = e.target;
    caret.current = digitsBefore(el.value, el.selectionStart ?? el.value.length);

    // Faqat raqam, nuqta va minus qoladi. Vergul ham nuqta deb qabul
    // qilinadi — klaviaturada ikkalasi ham ishlatiladi.
    const cleaned = el.value.replace(/,/g, ".").replace(/[^\d.-]/g, "");
    setText(format(cleaned));

    const n = parseFloat(cleaned.replace(/[^\d.-]/g, ""));
    if (cleaned === "" || cleaned === "-") onChange(allowEmpty ? null : 0);
    else onChange(Number.isFinite(n) ? n : 0);
  }

  return (
    <input
      ref={ref} type="text" inputMode="decimal" className={className}
      value={text} placeholder={placeholder}
      onChange={handle}
      onBlur={() => setText(format(value ?? ""))}
      {...rest}
    />
  );
}
