"use client";
import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { getUser, canOpen, defaultRouteFor } from "@/lib/auth";

// Ilova qobig'i: kompyuterda yon menyu doim ochiq (sticky), telefonda esa
// yashirin — yuqoridagi menyu tugmasi bosilganda chapdan chiqadigan panel.
export default function Shell({ children }) {
  const [open, setOpen] = useState(false);
  const user = getUser();
  const homeHref = canOpen("/dashboard", user) ? "/dashboard" : defaultRouteFor(user);

  return (
    <div className="flex">
      <Sidebar mobileOpen={open} onClose={() => setOpen(false)} />

      <div className="flex-1 min-w-0">
        {/* Mobil yuqori panel — faqat kichik ekranda */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 bg-panel border-b border-line px-4 py-3">
          <button onClick={() => setOpen(true)} aria-label="Menyu"
            className="w-10 h-10 rounded-xl border border-line flex items-center justify-center text-ink">
            <Menu size={20} />
          </button>
          <Link href={homeHref} className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center text-white font-extrabold">N</span>
            <span className="tracking-[.3em] font-extrabold">NSPOS</span>
          </Link>
        </div>

        <main className="px-4 sm:px-6 lg:px-10 py-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
