"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { setLang as applyLang, getLang, LANGS } from "@/lib/i18n";

const LangCtx = createContext({ lang: "uz", setLang: () => {} });
export const useLang = () => useContext(LangCtx);

export default function LangProvider({ children }) {
  // Server har doim "uz" bilan chizadi; saqlangan til mount'dan keyin qo'llanadi.
  const [lang, setLangState] = useState("uz");

  useEffect(() => {
    const saved = localStorage.getItem("nspos-lang");
    // Faqat mavjud til qo'llanadi — rus olib tashlangan, saqlangan "ru"
    // bo'lsa ham o'zbekcha qoladi.
    const valid = LANGS.some((l) => l.code === saved);
    if (valid && saved !== getLang()) {
      applyLang(saved);
      setLangState(saved);
    }
  }, []);

  const setLang = (l) => {
    applyLang(l);
    localStorage.setItem("nspos-lang", l);
    setLangState(l);
  };

  // key={lang} — til o'zgarganda butun daraxt qayta chiziladi,
  // aks holda t() natijalari eski qolib ketardi.
  return (
    <LangCtx.Provider value={{ lang, setLang }}>
      <div key={lang} className="contents">{children}</div>
    </LangCtx.Provider>
  );
}
