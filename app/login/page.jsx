"use client";
import { t } from "@/lib/i18n";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase, DEMO_MODE } from "@/lib/db";
import { kirish } from "@/lib/sessiya";
import { toCredential, formatPhoneInput } from "@/lib/loginId";

export default function Login() {
  const router = useRouter();
  const [login, setLogin] = useState("");      // telefon yoki email
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);   // ko'z: parolni ko'rsatish/yashirish
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(""); setInfo("");
    if (DEMO_MODE) {
      const savedRole = typeof window !== "undefined" ? localStorage.getItem("nspos-role") : null;
      router.push(savedRole === "installer" ? "/installers" : "/dashboard");
      return;
    }
    if (password.length < 6) { setError(t("Parol kamida 6 belgi bo'lishi kerak")); return; }
    setLoading(true);

    // Telefon bo'lsa ichkarida email'ga o'giriladi, "@" bo'lsa email deb olinadi
    const cred = toCredential(login, password);
    const { error, role } = await kirish(cred.email, cred.password);
    setLoading(false);
    if (error) { setError(t("Telefon yoki parol noto'g'ri")); return; }
    // `router.push` EMAS: `lib/db.js` baza mijozini modul
    // yuklanganda tokendan yaratadi. Yumshoq o'tishda modul
    // qaytadan yuklanmaydi va mijoz eski (bo'sh) token bilan
    // qolib ketardi — sahifa ochiladi, lekin ma'lumot bo'sh.
    const dest = role === "installer" ? "/installers" : "/dashboard";
    window.location.href = dest;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="card w-full max-w-md p-9">
        <div className="flex items-center gap-3 mb-8">
          <span className="w-11 h-11 rounded-xl bg-brand flex items-center justify-center text-white font-extrabold text-2xl">N</span>
          <span className="tracking-[.35em] font-extrabold text-xl">NSPOS</span>
        </div>

        <h1 className="text-2xl font-extrabold mb-1">{t("Tizimga kirish")}</h1>
        <p className="text-muted mb-7">{t("Telefon raqami va parolingiz bilan kiring")}</p>

        <label className="block text-sm font-bold mb-2">{t("Telefon raqami")}</label>
        <input value={login} onChange={(e) => setLogin(formatPhoneInput(e.target.value))}
          type="tel" inputMode="numeric" autoComplete="tel"
          placeholder="+998 90 123 45 67" className="inp mb-5 tracking-wide"
          onKeyDown={(e) => e.key === "Enter" && onSubmit()} />

        <label className="block text-sm font-bold mb-2">{t("Parol")}</label>
        {/* Ko'z tugmasi maydon ICHIDA: parolni ko'rib terish uchun.
            Telefonda xato terish ko'p — "noto'g'ri parol" ning asosiy sababi. */}
        <div className="relative mb-2">
          <input value={password} onChange={(e) => setPassword(e.target.value)}
            type={showPw ? "text" : "password"} autoComplete="current-password"
            placeholder="••••••••" className="inp pr-12"
            onKeyDown={(e) => e.key === "Enter" && onSubmit()} />
          <button type="button" onClick={() => setShowPw((v) => !v)}
            aria-label={t(showPw ? "Parolni yashirish" : "Parolni ko'rsatish")}
            title={t(showPw ? "Parolni yashirish" : "Parolni ko'rsatish")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted hover:text-ink hover:bg-surface transition-colors">
            {showPw ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        {error && <p className="text-danger text-sm font-semibold mt-2">{error}</p>}
        {info && (
          <p className="text-ok text-sm font-semibold mt-2 bg-ok-soft rounded-lg px-3 py-2">{info}</p>
        )}
        {DEMO_MODE && (
          <p className="text-warn text-sm font-semibold mt-2 bg-warn-soft rounded-lg px-3 py-2">
            {t("Demo rejim: Supabase sozlanmagan, istalgan qiymat bilan kirishingiz mumkin.")}
          </p>
        )}

        <button onClick={onSubmit} disabled={loading}
          className="w-full mt-6 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold py-3.5 transition-colors disabled:opacity-60">
          {loading ? t("Kuting…") : t("Kirish")}
        </button>

        <p className="text-muted text-sm font-semibold mt-5 text-center">
          {t("Hisobni rahbaringiz ochadi. Parolni unutsangiz — rahbaringizga ayting.")}
        </p>
      </div>
    </div>
  );
}
