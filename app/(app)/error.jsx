"use client";
import { t } from "@/lib/i18n";
import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

// ══════════════════════════════════════════════════════════════
// XATO EKRANI
// ══════════════════════════════════════════════════════════════
// Ilgari biror sahifada xato chiqsa Next.js'ning quruq oq ekrani
// ko'rinardi: "Application error: a client-side exception has occurred".
// Undan na foydalanuvchiga, na menga foyda bor edi — sabab brauzer
// konsolida qolib ketardi.
//
// Endi: butun ilova o'lmaydi, xatoning O'ZI ekranda yoziladi (rasmga
// olib yuborish kifoya) va bitta tugma bilan qayta urinib ko'riladi.
export default function AppError({ error, reset }) {
  useEffect(() => { console.error("NSPOS xato:", error); }, [error]);

  return (
    <div className="card p-10 max-w-2xl mx-auto mt-16">
      <span className="w-14 h-14 rounded-2xl bg-danger-soft text-danger flex items-center justify-center mb-5">
        <AlertTriangle size={26} />
      </span>
      <h1 className="text-2xl font-extrabold mb-2">{t("Bu bo'limda xato chiqdi")}</h1>
      <p className="text-muted font-semibold mb-5">
        {t("Ilova to'xtagani yo'q — boshqa bo'limlar ishlayveradi. Quyidagi yozuvni rasmga olib yuboring, sababi shunda.")}
      </p>

      <pre className="bg-surface border border-line rounded-xl p-4 text-sm font-semibold overflow-auto max-h-60 whitespace-pre-wrap break-words mb-6">
        {String(error?.message || error)}
        {error?.digest ? `\n\ndigest: ${error.digest}` : ""}
      </pre>

      <div className="flex gap-3">
        <button onClick={() => reset()}
          className="flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-6 py-3">
          <RotateCcw size={18} /> {t("Qayta urinish")}
        </button>
        <button onClick={() => location.reload()}
          className="rounded-xl border border-line font-bold px-6 py-3 hover:border-brand">
          {t("Sahifani yangilash")}
        </button>
      </div>
    </div>
  );
}
