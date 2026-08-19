"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getUser, setUser as applyUser, setUserFromProfile } from "@/lib/auth";
import { supabase, DEMO_MODE } from "@/lib/db";

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

    supabase.auth.getSession().then(({ data }) => load(data.session));

    // Kirish/chiqish yoki tokenning yangilanishini kuzatamiz
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => load(session));
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [pathname, router]);

  const setRole = (role) => {
    if (!DEMO_MODE) return;          // jonli rejimda rol bazadan
    localStorage.setItem("nspos-role", role);
    setUserState(applyUser({ role }));
  };

  const signOut = async () => {
    if (DEMO_MODE) return;
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <AuthCtx.Provider value={{ user, ready, authed, setRole, signOut, demo: DEMO_MODE }}>
      <div key={user.role} className="contents">{children}</div>
    </AuthCtx.Provider>
  );
}
