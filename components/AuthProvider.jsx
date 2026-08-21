"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getUser, setUser as applyUser, setUserFromProfile } from "@/lib/auth";
import { supabase, DEMO_MODE } from "@/lib/db";
// DIQQAT: bu ikkisi 2026-08-22 gacha IMPORT QILINMAGAN edi. Fayl
// Supabase Auth'dan o'z tizimimizga o'tkazilganda `supabase.auth.
// getSession()` o'rniga `sessiyaOl()` yozilgan, lekin import
// qo'shilmagan. Natijada BUTUN SAYT brauzerda ochilmasdi:
// "ReferenceError: sessiyaOl is not defined".
//
// Serverdagi tekshiruv buni KO'RMAGAN: `curl` 200 qaytaradi, chunki
// Next.js HTML qobiqni beradi — ishdan chiqish esa brauzerda,
// hidratsiyada bo'ladi. Shu sabab endi chiqarishda haqiqiy brauzer
// ochiladi (`scripts/server/brauzer-tekshir.sh`).
import { sessiyaOl, ozgarishda, chiqish } from "@/lib/sessiya";

const AuthCtx = createContext({ user: getUser(), ready: DEMO_MODE, setRole: () => {}, signOut: () => {} });
export const useAuth = () => useContext(AuthCtx);

// Ikki rejim, bitta interfeys:
//
//   DEMO   — rol brauzerda tanlanadi (sinab ko'rish uchun), localStorage'da
//            saqlanadi. Ma'lumot xotirada.
//   JONLI  — rol Supabase sessiyasidan va `profiles` jadvalidan keladi.
//            Foydalanuvchi uni o'zgartira olmaydi; sahifani qayta
//            yuklab ham aylanib o'tolmaydi, chunki asosiy cheklov
//            bazadagi RLS siyosatlarida.
//
// `ready` muhim: jonli rejimda sessiya aniqlanmaguncha ma'lumot
// so'ralmasligi kerak — aks holda RLS bo'sh natija qaytaradi va
// ilova "ma'lumot yo'q" deb ko'rsatadi.
export default function AuthProvider({ children }) {
  const [user, setUserState] = useState(() => getUser());
  const [ready, setReady] = useState(DEMO_MODE);
  // Jonli rejimda haqiqiy sessiya bormi — DataProvider shunga qarab
  // ma'lumot so'raydi. Sessiyasiz so'rov RLS'dan bo'sh qaytadi va
  // login sahifasida keraksiz xato chiqarardi.
  const [authed, setAuthed] = useState(DEMO_MODE);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (DEMO_MODE) {
      const saved = localStorage.getItem("nspos-role");
      if (saved && saved !== getUser().role) setUserState(applyUser({ role: saved }));
      return;
    }

    let alive = true;

    async function load(session) {
      if (!session) {
        setAuthed(false);
        setReady(true);
        if (pathname !== "/login") router.replace("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, role, store_id, perms")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!alive) return;
      setUserState(setUserFromProfile(profile, session.user.email));
      setAuthed(true);
      setReady(true);
    }

    // Sessiya cookie'dan o'qiladi (`lib/sessiya.js`). Supabase Auth
    // o'rniga o'z tizimimiz — interfeys ataylab o'xshash qilingan.
    load(sessiyaOl());

    // Kirish/chiqishni kuzatamiz
    const bekor = ozgarishda((s) => load(s));
    return () => { alive = false; bekor(); };
  }, [pathname, router]);

  const setRole = (role) => {
    if (!DEMO_MODE) return;          // jonli rejimda rol bazadan
    localStorage.setItem("nspos-role", role);
    setUserState(applyUser({ role }));
  };

  const signOut = async () => {
    if (DEMO_MODE) return;
    await chiqish();
    // TO'LIQ qayta yuklash: `lib/db.js` mijozni modul yuklanganda
    // bir marta yaratadi, ya'ni tokenni almashtirish uchun sahifa
    // qaytadan boshlanishi kerak.
    window.location.href = "/login";
  };

  return (
    <AuthCtx.Provider value={{ user, ready, authed, setRole, signOut, demo: DEMO_MODE }}>
      <div key={user.role} className="contents">{children}</div>
    </AuthCtx.Provider>
  );
}
