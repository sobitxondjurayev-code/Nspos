"use client";
import { t, tt } from "@/lib/i18n";
import { useMemo, useState, useEffect } from "react";
import {
  Check, RotateCcw, Sun, Moon, Monitor, Plus, Pencil, Trash2, UserPlus, Clock,
  KeyRound, Eye, EyeOff, Coins, Wrench, CalendarDays, Shield, Download, Send,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useLang } from "@/components/LangProvider";
import { MODES, DARK_PRESETS, ACCENTS } from "@/lib/themes";
import { LANGS } from "@/lib/i18n";
import { ROLES, can } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";
import { demoStores } from "@/lib/demoData";
import { listStaff, updateStaff, removeStaff } from "@/lib/staffData";
import { listInvites, addInvite, removeInvite } from "@/lib/invitesData";
import { supabase, DEMO_MODE } from "@/lib/db";
import { setInstallerRate } from "@/lib/kpiData";
import { saveRate } from "@/lib/ratesData";
import { getUsdRate, isRateAuto, setRateAuto, refreshUsdRate, getRateDate,
  getServiceNames, setServiceNames, getLedgerStart, setLedgerStart } from "@/lib/companyData";
import NumberField from "@/components/NumberField";
import StaffModal from "@/components/StaffModal";

const MODE_ICONS = { light: Sun, dark: Moon, system: Monitor };
const storeName = (id) => demoStores.find((s) => s.id === id)?.name ?? null;

// Xodimlar boshqaruvi — faqat egasi ko'radi
function StaffManager() {
  const [modal, setModal] = useState(null);   // null | {} | {staff}
  const [tick, setTick] = useState(0);
  const staff = useMemo(() => listStaff(), [tick]);
  const invites = useMemo(() => listInvites(), [tick]);
  const bump = () => setTick((v) => v + 1);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save(data) {
    setErr("");
    if (modal?.staff) {
      updateStaff(modal.staff.id, data);
      // Usta bo'lsa kamera narxini KPI tizimiga ham yozamiz (0 bo'lsa tegmaymiz)
      if (data.role === "installer" && data.cameraRate > 0) {
        setInstallerRate(modal.staff.id, data.cameraRate);
      }
      // Egasi xodim parolini yoki LOGIN (telefon) raqamini o'zgartirsa —
      // auth hisobini ham yangilaymiz (server yo'li, service kalit bilan).
      if (!DEMO_MODE) {
        const patch = { id: modal.staff.id };
        if (data.password && data.password.length >= 6) patch.password = data.password;
        const before = (modal.staff.phone || "").replace(/\D/g, "");
        const after = (data.phone || "").replace(/\D/g, "");
        if (after && after !== before) patch.phone = data.phone;

        if (patch.password || patch.phone) {
          setBusy(true);
          try {
            const { data: sess } = await supabase.auth.getSession();
            const res = await fetch("/api/staff", {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${sess.session?.access_token ?? ""}`,
              },
              body: JSON.stringify(patch),
            });
            const out = await res.json();
            setBusy(false);
            if (!res.ok) { setErr(out.error || t("Saqlanmadi")); return; }
          } catch (e) { setBusy(false); setErr(e.message); return; }
        }
      }
      setModal(null); bump();
      return;
    }
    // Yangi xodim — server yo'li orqali darrov ochiladi (xat yuborilmaydi).
    // Demo rejimda esa shunchaki taklif bo'lib qo'shiladi.
    if (DEMO_MODE) { addInvite(data); setModal(null); bump(); return; }

    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sess.session?.access_token ?? ""}`,
        },
        body: JSON.stringify(data),
      });
      const out = await res.json();
      if (!res.ok) { setErr(out.error || t("Xodim ochilmadi")); setBusy(false); return; }
      // Usta uchun kamera narxini KPI tizimiga yozamiz
      if (out.id && data.role === "installer" && data.cameraRate > 0) {
        setInstallerRate(out.id, data.cameraRate);
      }
      setModal(null); setBusy(false);
      // Yangi profil realtime bilan keladi; darrov ko'rinishi uchun ham yangilaymiz
      setTimeout(bump, 800);
    } catch (e) {
      setErr(e.message); setBusy(false);
    }
  }

  return (
    <div className="card p-7 mb-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-extrabold">{t("Xodimlar va vakolatlar")}</h2>
        <button onClick={() => setModal({})}
          className="flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-5 py-2.5">
          <UserPlus size={18} /> {t("Xodim qo'shish")}
        </button>
      </div>
      <p className="text-sm text-muted font-semibold mb-5">
        {t("Xodimga telefon raqami va parol berasiz — u darrov kira oladi. SMS/tasdiqlash kerak emas.")}
      </p>

      {/* Kutilayotgan takliflar */}
      {invites.length > 0 && (
        <div className="mb-5">
          <p className="text-sm font-bold text-muted mb-3">{t("Kutilayotgan takliflar")}</p>
          <div className="space-y-2">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 bg-warn-soft/40 rounded-xl px-4 py-3">
                <Clock size={18} className="text-warn shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold">{inv.name} <span className="text-muted font-semibold">· {t(ROLES[inv.role]?.label)}</span></p>
                  <p className="text-sm text-muted font-semibold">{inv.email} — {t("ro'yxatdan o'tishi kutilyapti")}</p>
                </div>
                <button onClick={() => { removeInvite(inv.id); bump(); }}
                  className="text-muted hover:text-danger shrink-0"><Trash2 size={18} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Faol xodimlar */}
      <div className="overflow-auto max-h-[70vh] border border-line rounded-xl">
        <table className="w-full text-[0.9375rem]">
          <thead>
            <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-20 text-left text-muted text-sm border-b border-line [&>th]:bg-panel">
              <th className="px-4 py-3 font-bold">{t("Xodim")}</th>
              <th className="px-4 py-3 font-bold">{t("Rol")}</th>
              <th className="px-4 py-3 font-bold">{t("Do'kon")}</th>
              <th className="px-4 py-3 font-bold text-right">{t("Fiksa")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className={`border-b border-line last:border-0 ${s.active === false ? "opacity-50" : ""}`}>
                <td className="px-4 py-3">
                  <p className="font-bold">{s.name}</p>
                  {s.phone && <p className="text-sm text-muted">{s.phone}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className="bg-brand-soft text-brand text-sm font-bold px-3 py-1 rounded-lg">
                    {t(ROLES[s.role]?.label ?? s.role)}
                  </span>
                </td>
                <td className="px-4 py-3 font-semibold">
                  {storeName(s.storeId) ?? <span className="text-muted">{t("Barchasi")}</span>}
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  {s.salary ? `${s.salary} $` : "—"}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => setModal({ staff: s })} className="text-muted hover:text-brand mr-3">
                    <Pencil size={18} />
                  </button>
                  <button onClick={() => { if (confirm(t("Xodim o'chirilsinmi?"))) { removeStaff(s.id); bump(); } }}
                    className="text-muted hover:text-danger"><Trash2 size={18} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {err && <p className="text-danger font-semibold mt-4">{err}</p>}

      {modal && (
        <StaffModal initial={modal.staff ?? null} busy={busy}
          onClose={() => { setModal(null); setErr(""); }} onSave={save} />
      )}
    </div>
  );
}

// Har xodim O'ZINING parolini yangilaydi — o'z sessiyasi orqali
// (Supabase auth.updateUser). Rahbar aralashuvi shart emas.
function PasswordCard() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);   // { ok, text }

  const valid = pw.length >= 6 && pw === pw2;

  async function submit() {
    setMsg(null);
    if (pw.length < 6) { setMsg({ ok: false, text: t("Parol kamida 6 belgidan iborat bo'lsin") }); return; }
    if (pw !== pw2) { setMsg({ ok: false, text: t("Parollar bir xil emas") }); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setPw(""); setPw2(""); setShow(false);
    setMsg({ ok: true, text: t("Parol yangilandi. Keyingi safar shu parol bilan kirasiz.") });
  }

  const field = (label, value, set) => (
    <div>
      <label className="block text-sm font-bold mb-2">{label}</label>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => set(e.target.value)}
        autoComplete="new-password"
        placeholder="••••••••"
        className="w-full rounded-xl border border-line bg-surface px-4 py-3 font-semibold outline-none focus:border-brand"
      />
    </div>
  );

  return (
    <div className="card p-7 mb-6">
      <div className="flex items-center gap-3 mb-1">
        <span className="w-9 h-9 rounded-xl bg-brand-soft text-brand flex items-center justify-center"><KeyRound size={18} /></span>
        <h2 className="text-xl font-extrabold">{t("Parolni yangilash")}</h2>
      </div>
      <p className="text-sm text-muted font-semibold mb-5">
        {t("O'z parolingizni istagan vaqtda o'zgartirasiz — kamida 6 ta belgi.")}
      </p>

      <div className="grid sm:grid-cols-2 gap-4 max-w-xl">
        {field(t("Yangi parol"), pw, setPw)}
        {field(t("Parolni takrorlang"), pw2, setPw2)}
      </div>

      <button type="button" onClick={() => setShow((s) => !s)}
        className="flex items-center gap-2 text-sm font-bold text-muted hover:text-ink mt-3">
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
        {show ? t("Parolni yashirish") : t("Parolni ko'rsatish")}
      </button>

      {msg && <p className={`font-semibold mt-4 ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</p>}

      <button onClick={submit} disabled={!valid || busy}
        className="mt-5 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed">
        {busy ? t("Saqlanmoqda…") : t("Parolni yangilash")}
      </button>
    </div>
  );
}

// Dollar kursi — savdo dollarda, ish haqi so'mda yuriladi. Foyda
// hisobotida ikkalasi bir joyga tushishi uchun kurs kerak.
function UsdRateCard() {
  const [tick, setTick] = useState(0);
  const [rate, setRate] = useState(getUsdRate() ?? 0);
  const [busy, setBusy] = useState(false);
  const auto = isRateAuto();
  const current = getUsdRate();
  const at = getRateDate();
  const bump = () => setTick((v) => v + 1);

  // Avtomat rejimda ochilganda darrov yangilab qo'yamiz
  useEffect(() => {
    if (!auto) return;
    refreshUsdRate().then((r) => { if (r) { setRate(r); bump(); } });
  }, [auto]);

  const fmtAt = at
    ? new Date(at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="card p-7 mb-6">
      <div className="flex items-center gap-3 mb-1">
        <span className="w-9 h-9 rounded-xl bg-brand-soft text-brand flex items-center justify-center">
          <Coins size={18} />
        </span>
        <h2 className="text-xl font-extrabold">{t("Dollar kursi")}</h2>
      </div>
      <p className="text-sm text-muted font-semibold mb-5">
        {t("Savdo dollarda, ish haqi so'mda yuritiladi. Foyda hisobotida ikkalasini birlashtirish uchun kurs kerak.")}
      </p>

      {/* Hozirgi kurs */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <p className="text-3xl font-extrabold">
            {current ? Math.round(current).toLocaleString("ru-RU") : "—"}
            <span className="text-lg text-muted font-bold"> {t("so'm")}</span>
          </p>
          <p className="text-sm text-muted font-semibold mt-1">
            {auto
              ? (fmtAt ? tt("Markaziy bank · yangilangan {d}", { d: fmtAt }) : t("Markaziy bank kursi olinmoqda…"))
              : (fmtAt ? tt("Qo'lda kiritilgan · {d}", { d: fmtAt }) : t("Qo'lda kiritilgan"))}
          </p>
        </div>
        {auto && (
          <button onClick={async () => { setBusy(true); const r = await refreshUsdRate(true); setBusy(false); if (r) setRate(r); bump(); }}
            disabled={busy}
            className="flex items-center gap-2 rounded-xl border border-line font-bold px-5 py-3 hover:border-brand disabled:opacity-40">
            <RotateCcw size={16} /> {busy ? t("Olinmoqda…") : t("Hozir yangilash")}
          </button>
        )}
      </div>

      {/* Rejim */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <button onClick={() => { setRateAuto(true); bump(); }}
          className={`text-left rounded-xl border-2 px-4 py-3 transition-colors ${
            auto ? "border-brand bg-brand-soft" : "border-line hover:border-brand"}`}>
          <p className="font-extrabold">{t("Avtomat")}</p>
          <p className="text-sm text-muted font-semibold">{t("Markaziy bank kursi har kuni o'zi olinadi")}</p>
        </button>
        <button onClick={() => { setRateAuto(false); bump(); }}
          className={`text-left rounded-xl border-2 px-4 py-3 transition-colors ${
            !auto ? "border-brand bg-brand-soft" : "border-line hover:border-brand"}`}>
          <p className="font-extrabold">{t("Qo'lda")}</p>
          <p className="text-sm text-muted font-semibold">{t("O'zingiz yozasiz — masalan bozor kursi")}</p>
        </button>
      </div>

      {!auto && (
        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="block text-sm font-bold mb-2">{t("1 dollar necha so'm")}</span>
            <NumberField value={rate} onChange={setRate} />
          </label>
          <button onClick={() => { saveRate(rate); bump(); }} disabled={!(rate > 0)}
            className="rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-6 py-3 disabled:opacity-40">
            {t("Saqlash")}
          </button>
        </div>
      )}

      {!current && (
        <p className="text-sm font-semibold text-warn mt-4">
          {t("Kurs hali olinmagan — ish haqi foyda hisobotiga qo'shilmayapti.")}
        </p>
      )}
    </div>
  );
}

// Billz'da xizmat alohida bo'lim emas — oddiy tovar kabi sotiladi.
// Qaysi nomlar xizmat ekanini shu yerda belgilaymiz.
// Moliya qaysi kundan boshlab sanalishi. Eski oylardagi tushum
// allaqachon sarflangan — uni bugungi kassa qoldig'iga qo'shish
// balansni yolg'on qiladi, shuning uchun chegara qo'yiladi.
function LedgerStartCard() {
  const [date, setDate] = useState(getLedgerStart());
  const [saved, setSaved] = useState(false);

  return (
    <div className="card p-7 mb-6">
      <div className="flex items-center gap-3 mb-1">
        <span className="w-9 h-9 rounded-xl bg-brand-soft text-brand flex items-center justify-center">
          <CalendarDays size={18} />
        </span>
        <h2 className="text-xl font-extrabold">{t("Hisob qaysi kundan boshlanadi")}</h2>
      </div>
      <p className="text-sm text-muted font-semibold mb-5">
        {t("Kassa qoldig'i, balans va to'plangan ish haqi shu sanadan yig'iladi. Undan oldingi pul harakati umuman sanalmaydi — eski oylardagi tushum allaqachon sarflangan, uni bugungi qoldiqqa qo'shish balansni yolg'on qiladi.")}
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="block text-sm font-bold mb-2">{t("Boshlanish sanasi")}</span>
          <input type="date" value={date}
            onChange={(e) => { setDate(e.target.value); setSaved(false); }}
            className="inp w-52" />
        </label>
        <button onClick={() => { setLedgerStart(date); setSaved(true); }}
          className="rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-6 py-3">
          {t("Saqlash")}
        </button>
        {saved && <span className="font-semibold text-ok">{t("Saqlandi")}</span>}
      </div>
    </div>
  );
}

function ServiceNamesCard() {
  const [text, setText] = useState(getServiceNames().join(", "));
  const [saved, setSaved] = useState(false);

  return (
    <div className="card p-7 mb-6">
      <div className="flex items-center gap-3 mb-1">
        <span className="w-9 h-9 rounded-xl bg-brand-soft text-brand flex items-center justify-center">
          <Wrench size={18} />
        </span>
        <h2 className="text-xl font-extrabold">{t("Servis (o'rnatish) nomlari")}</h2>
      </div>
      <p className="text-sm text-muted font-semibold mb-5">
        {t("Billz'da xizmat oddiy tovar kabi sotiladi. Qaysi nomlar xizmat hisoblanishini shu yerda yozing — hisobotda tovar savdosidan ajratiladi. Vergul bilan ajrating.")}
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <label className="block flex-1 min-w-[15rem]">
          <span className="block text-sm font-bold mb-2">{t("Nomlar")}</span>
          <input value={text} onChange={(e) => { setText(e.target.value); setSaved(false); }}
            className="inp" placeholder="montaj, ustanovka, sozlash" />
        </label>
        <button onClick={() => { setServiceNames(text); setSaved(true); }}
          className="rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-6 py-3">
          {t("Saqlash")}
        </button>
        {saved && <span className="font-semibold text-ok">{t("Saqlandi")}</span>}
      </div>
      <p className="text-sm text-muted font-semibold mt-3">
        {t("Nomning bir qismi yozilsa ham topadi: \"montaj\" — \"montaj 4 kamera\" ni ham qamrab oladi.")}
      </p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ZAXIRA NUSXA
// ══════════════════════════════════════════════════════════════
// Baza Supabase'da, bepul tarifda — u yerda avtomatik zaxira ham,
// "vaqtga qaytarish" ham yo'q. Ya'ni o'chib ketgan yozuvni qaytarib
// bo'lmaydi. Shuning uchun har kecha butun baza faylga yig'ilib
// egasining Telegrami va Google Drive'iga tushadi (Vercel Cron).
// Bu yerdagi tugma esa o'sha ishni qo'lda, shu zahoti bajaradi.
function BackupCard() {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? "";
  }

  async function download() {
    setBusy(true); setRes(null);
    try {
      const r = await fetch("/api/backup?download=1", {
        headers: { authorization: `Bearer ${await token()}` },
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.status);
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `nspos-zaxira-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setRes({ ok: true, text: t("Fayl kompyuteringizga yuklandi") });
    } catch (e) {
      setRes({ ok: false, text: String(e.message ?? e) });
    }
    setBusy(false);
  }

  async function sendNow() {
    setBusy(true); setRes(null);
    try {
      const r = await fetch("/api/backup", { headers: { authorization: `Bearer ${await token()}` } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.status);
      setRes({ ok: true, text: tt("{n} ta yozuv · Telegram: {a} · Drive: {b}", {
        n: Number(j.rows).toLocaleString("ru-RU"), a: t(j.telegram), b: t(j.drive) }) });
    } catch (e) {
      setRes({ ok: false, text: String(e.message ?? e) });
    }
    setBusy(false);
  }

  return (
    <div className="card p-7 mb-6">
      <div className="flex items-center gap-3 mb-1">
        <span className="w-9 h-9 rounded-xl bg-brand-soft text-brand flex items-center justify-center">
          <Shield size={18} />
        </span>
        <h2 className="text-xl font-extrabold">{t("Zaxira nusxa")}</h2>
      </div>
      <p className="text-sm text-muted font-semibold mb-5">
        {t("Har kecha butun baza bitta faylga yig'ilib Telegram va Google Drive'ingizga tushadi. Bu yerdan qo'lda ham olishingiz mumkin — mijozlar, qarzlar, KPI, xarajat, kassa, to'lov rejasi, hammasi bitta faylda.")}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={download} disabled={busy}
          className="flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-dark disabled:opacity-50 text-white font-bold px-6 py-3">
          <Download size={18} /> {t(busy ? "Yig'ilyapti..." : "Faylni yuklab olish")}
        </button>
        <button onClick={sendNow} disabled={busy}
          className="flex items-center gap-2 rounded-xl border border-line font-bold px-6 py-3 hover:border-brand disabled:opacity-50">
          <Send size={18} /> {t("Hozir yuborish")}
        </button>
        {res && (
          <span className={`font-semibold ${res.ok ? "text-ok" : "text-danger"}`}>{res.text}</span>
        )}
      </div>
    </div>
  );
}

function Section({ title, hint, children }) {
  return (
    <div className="card p-7 mb-6">
      <h2 className="text-xl font-extrabold mb-1">{title}</h2>
      {hint && <p className="text-sm text-muted font-semibold mb-5">{hint}</p>}
      {children}
    </div>
  );
}

export default function Settings() {
  const { mode, darkPreset, accent, resolved, setTheme, reset } = useTheme();
  const { lang, setLang } = useLang();
  // Rolni almashtirish — har bir xodim tizimni qanday ko'rishini
  // tekshirish uchun. Supabase ulanganda bu blok olib tashlanadi:
  // rol auth sessiyasidan keladi va foydalanuvchi uni o'zgartira olmaydi.
  const { user, setRole, demo } = useAuth();
  const isOwner = can("staff.manage", user);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-7">
        <h1 className="text-4xl font-extrabold tracking-tight">{t("Sozlamalar")}</h1>
        <button onClick={reset}
          className="flex items-center gap-2 rounded-xl border border-line font-bold px-5 py-3 hover:bg-surface">
          <RotateCcw size={18} /> {t("Standartga qaytarish")}
        </button>
      </div>

      {/* Xodimlar — faqat egasi */}
      {isOwner && <StaffManager />}

      {/* Zaxira nusxa — faqat egasi (butun bazani o'z ichiga oladi) */}
      {isOwner && !demo && <BackupCard />}

      {/* Valyuta kursi va servis sozlamalari — faqat egasi */}
      {isOwner && <UsdRateCard />}
      {isOwner && <LedgerStartCard />}
      {isOwner && <ServiceNamesCard />}

      {/* Parolni yangilash — har bir kirgan xodim o'ziniki uchun */}
      {!demo && <PasswordCard />}

      {/* Rol almashtirgich — faqat demo rejimda (sinash uchun).
          Jonli rejimda rol bazadan keladi va o'zgartirib bo'lmaydi. */}
      {demo && (
      <Section title={t("Rol va huquqlar")}
        hint={t("Har rol tizimning faqat o'ziga kerakli qismini ko'radi. Sinab ko'rish uchun almashtiring.")}>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(ROLES).map(([key, r]) => (
            <button key={key} onClick={() => setRole(key)}
              className={`rounded-2xl border-2 p-5 text-left transition-colors ${
                user.role === key ? "border-brand bg-brand-soft" : "border-line hover:border-brand"}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-extrabold">{t(r.label)}</span>
                {user.role === key && <Check size={18} className="text-brand" />}
              </div>
              <p className="text-sm text-muted font-semibold">{t(r.hint)}</p>
            </button>
          ))}
        </div>
        <p className="text-sm text-muted font-semibold mt-5">
          {t("Diqqat: bu tekshiruv faqat interfeysni boshqaradi. Haqiqiy himoya bazadagi RLS siyosatlarida — schema.sql fayliga qarang.")}
        </p>
      </Section>
      )}

      {/* Rejim */}
      <Section title={t("Ko'rinish rejimi")}
        hint={t("\"Tizim bo'yicha\" tanlansa, qurilma sozlamasiga moslashadi")}>
        <div className="grid grid-cols-3 gap-4">
          {MODES.map((m) => {
            const Icon = MODE_ICONS[m.key];
            const active = mode === m.key;
            return (
              <button key={m.key} onClick={() => setTheme({ mode: m.key })}
                className={`rounded-2xl border-2 p-5 text-left transition-colors ${
                  active ? "border-brand bg-brand-soft" : "border-line hover:border-brand"}`}>
                <div className="flex items-center justify-between mb-2">
                  <Icon size={22} className={active ? "text-brand" : "text-muted"} />
                  {active && <Check size={18} className="text-brand" />}
                </div>
                <p className="font-bold">{t(m.label)}</p>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Qorong'i palitra */}
      <Section title={t("Qorong'i palitra")}
        hint={resolved === "dark"
          ? t("Tanlov darhol qo'llanadi")
          : t("Hozir yorug' rejim yoqilgan — bu tanlov qorong'i rejimga o'tganda ko'rinadi")}>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(DARK_PRESETS).map(([key, p]) => {
            const active = darkPreset === key;
            return (
              <button key={key} onClick={() => setTheme({ darkPreset: key })}
                className={`rounded-2xl border-2 p-5 text-left transition-colors ${
                  active ? "border-brand" : "border-line hover:border-brand"}`}>
                {/* Palitra namunasi */}
                <div className="flex gap-1.5 mb-4">
                  {p.swatch.map((c) => (
                    <span key={c} className="flex-1 h-10 rounded-lg border border-line"
                      style={{ background: c }} />
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <p className="font-bold">{t(p.label)}</p>
                  {active && <Check size={18} className="text-brand" />}
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Asosiy rang */}
      <Section title={t("Asosiy rang")}
        hint={t("Tugmalar, havolalar va grafikdagi asosiy chiziq shu rangda bo'ladi")}>
        <div className="flex gap-4 flex-wrap">
          {Object.entries(ACCENTS).map(([key, a]) => {
            const active = accent === key;
            return (
              <button key={key} onClick={() => setTheme({ accent: key })}
                className={`flex items-center gap-3 rounded-2xl border-2 pl-3 pr-5 py-3 transition-colors ${
                  active ? "border-brand bg-brand-soft" : "border-line hover:border-brand"}`}>
                <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: a.hex }}>
                  {active && <Check size={18} color="#fff" />}
                </span>
                <span className="font-bold">{t(a.label)}</span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Til */}
      <Section title={t("Interfeys tili")}>
        <div className="grid grid-cols-2 gap-4">
          {LANGS.map((l) => {
            const active = lang === l.code;
            return (
              <button key={l.code} onClick={() => setLang(l.code)}
                className={`flex items-center justify-between rounded-2xl border-2 px-5 py-4 transition-colors ${
                  active ? "border-brand bg-brand-soft" : "border-line hover:border-brand"}`}>
                <span className="font-bold">{l.label}</span>
                {active ? <Check size={18} className="text-brand" />
                  : <span className="text-sm font-bold text-muted">{l.short}</span>}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Jonli namuna */}
      <Section title={t("Namuna")} hint={t("Tanlangan ranglar shunday ko'rinadi")}>
        <div className="bg-surface rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <button className="rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-5 py-2.5">
              {t("Asosiy tugma")}
            </button>
            <button className="rounded-xl border border-line bg-panel font-bold px-5 py-2.5">
              {t("Ikkilamchi")}
            </button>
            <span className="bg-brand-soft text-brand text-sm font-bold px-3 py-1.5 rounded-lg">
              {t("Belgi")}
            </span>
          </div>
          <div className="flex gap-6 text-[0.9375rem] font-bold">
            <span className="text-ok">{t("Muvaffaqiyat")}</span>
            <span className="text-warn">{t("Ogohlantirish")}</span>
            <span className="text-danger">{t("Xato")}</span>
            <span className="text-muted">{t("Ikkinchi darajali")}</span>
          </div>
        </div>
      </Section>
    </div>
  );
}
