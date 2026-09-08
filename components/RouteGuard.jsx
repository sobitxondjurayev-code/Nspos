"use client";
import { t } from "@/lib/i18n";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Lock } from "lucide-react";
import { getUser, canOpen, SECTIONS, ROLES, defaultRouteFor } from "@/lib/auth";

// Menyudan yashirish yetarli emas: manzilni qo'lda yozib kirish mumkin.
// Shuning uchun sahifa ham o'zini tekshiradi.
//
// Diqqat: bu HIMOYA emas, INTERFEYS qorovuli. Ma'lumotni haqiqiy
// himoyalash bazadagi RLS siyosatlari zimmasida (schema.sql).
export default function RouteGuard({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = getUser();
  const allowed = canOpen(pathname, user);

  // Yopiq sahifaga tushib qolsa (mas. kirgach /dashboard), xodimning
  // ruxsati bor birinchi bo'limga jimgina o'tkazamiz — "yopiq" ekrani
  // ko'rinmasin va tsikl bo'lmasin.
  const roleHome = defaultRouteFor(user);
  const dest = (canOpen(roleHome, user) ? roleHome : null)
    || ["/installers", "/kpi", "/dashboard", "/reports", ...SECTIONS.map((s) => s.key)]
      .find((k) => canOpen(k, user));

  useEffect(() => {
    if (!allowed && dest && dest !== pathname) router.replace(dest);
  }, [allowed, dest, pathname, router]);

  if (allowed) return children;

  // Agar ruxsatli bo'limga yo'naltirilayotgan bo'lsa (masalan, usta /dashboard ga tushganda),
  // "yopiq" qulf kartasi ko'rinmasin — jimgina o'tkazilsin.
  if (dest && dest !== pathname) return null;

  return (
    <div className="card p-12 text-center max-w-xl mx-auto mt-16">
      <span className="w-14 h-14 rounded-2xl bg-danger-soft text-danger flex items-center justify-center mx-auto mb-5">
        <Lock size={26} />
      </span>
      <h1 className="text-2xl font-extrabold mb-2">{t("Bu bo'lim sizga yopiq")}</h1>
      <p className="text-muted font-semibold">
        {t("Sizning rolingiz")}: <b>{t(ROLES[user.role]?.label ?? user.role)}</b>.{" "}
        {t("Kerak bo'lsa egasidan huquq so'rang.")}
      </p>
    </div>
  );
}
