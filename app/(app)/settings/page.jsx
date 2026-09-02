"use client";
import { t, tt } from "@/lib/i18n";
import { useMemo, useState, useEffect } from "react";
import {
  Check, RotateCcw, Sun, Moon, Monitor, Plus, Pencil, Trash2, UserPlus, Clock,
  KeyRound, Eye, EyeOff, Coins, Wrench, CalendarDays, Shield, Download, Send,
  RefreshCw, Stethoscope, TriangleAlert,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useLang } from "@/components/LangProvider";
import { MODES, DARK_PRESETS, ACCENTS } from "@/lib/themes";
import { LANGS } from "@/lib/i18n";
import { ROLES, can } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";
import { useLive } from "@/components/DataProvider";
import { demoStores } from "@/lib/demoData";
import { listStaff, updateStaff, removeStaff, reloadStaff } from "@/lib/staffData";
import { listInvites, addInvite, removeInvite } from "@/lib/invitesData";
import { supabase, DEMO_MODE } from "@/lib/db";
import { sessiyaOl } from "@/lib/sessiya";
import { setInstallerRate, getPlan, monthKey } from "@/lib/kpiData";
import { saveRate } from "@/lib/ratesData";
import { getUsdRate, isRateAuto, setRateAuto, refreshUsdRate, getRateDate,
  getServiceNames, setServiceNames, getLedgerStart, setLedgerStart } from "@/lib/companyData";
import NumberField from "@/components/NumberField";
import StaffModal from "@/components/StaffModal";

const MODE_ICONS = { light: Sun, dark: Moon, system: Monitor };
const storeName = (id) => demoStores.find((s) => s.id === id)?.name ?? null;

// Ustaning shu oydagi kamera narxi (so'm/dona). Oyliq shundan yig'iladi,
// shuning uchun tahrir oynasi ham hozirgi narxni ko'rsatib turadi —
// aks holda 0 chiqib, rahbar qo'ygan narx bekor qilinganday tuyulardi.
const cameraRateOf = (id) =>
  Number(getPlan(id, monthKey(new Date()), "installer")?.rate) || 0;

// Xodimlar boshqaruvi.
//
// Egasi — barcha xodimlar, barcha rol va vakolat bilan.
// Menejer — faqat USTALAR (`onlyInstallers`): do'kon menejeri kundalik
// ishni ustalar bilan yuritadi, yangi usta kelganda unga login/parolni
// o'zi ochadi va unutilgan parolni o'zi tiklaydi. Menejer ustaning
// oyligini, ruxsatlarini va rolini ko'rmaydi ham, o'zgartira ham
// olmaydi — cheklovning o'zi serverda (app/api/staff/route.js).
function StaffManager({ onlyInstallers = false }) {
  const [modal, setModal] = useState(null);   // null | {} | {staff}
  const [tick, setTick] = useState(0);
  // `live` bo'lmasa ro'yxat bir marta — ma'lumot kelishidan OLDIN —
  // hisoblanardi va ekranda demo xodimlar (Bahodir Qosimov, Sanjar
  // Umarov...) qotib qolardi. Haqiqiy 11 ta usta hech qachon
  // ko'rinmasdi. Yuklash tugaganda `live` o'zgaradi va ro'yxat
  // qayta yig'iladi.
  const live = useLive();
  const staff = useMemo(() => {
    const list = listStaff();
    return onlyInstallers ? list.filter((s) => s.role === "installer") : list;
  }, [tick, live, onlyInstallers]);
  const invites = useMemo(() => (onlyInstallers ? [] : listInvites()), [tick, live, onlyInstallers]);
  const bump = () => setTick((v) => v + 1);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Menejer `profiles` ga to'g'ridan-to'g'ri yoza olmaydi (RLS faqat
  // rahbarda) — uning har qanday o'zgarishi server yo'lidan o'tadi.
  const viaApi = onlyInstallers;

  async function call(method, body) {
    // `token`, `access_token` EMAS. Supabase sessiyasida `access_token`
    // bo'lardi, o'z sessiyamizda esa `token` (lib/sessiya.js). Nom
    // qolib ketgani uchun sarlavha doim `Bearer undefined` ketardi va
    // server har safar 401 qaytarardi — menejer ustaga login ocholmay
    // turgan sabablarning biri shu edi (2026-08-24).
    const res = await fetch("/api/staff", {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessiyaOl()?.token ?? ""}`,
      },
      body: JSON.stringify(body),
    });
    return { res, out: await res.json() };
  }

  async function save(data) {
    setErr("");
    if (modal?.staff) {
      if (!viaApi) updateStaff(modal.staff.id, data);
      // Usta bo'lsa kamera narxini KPI tizimiga ham yozamiz (0 bo'lsa tegmaymiz)
      if (data.role === "installer" && data.cameraRate > 0) {
        setInstallerRate(modal.staff.id, data.cameraRate);
      }
      // Parol, LOGIN (telefon) yoki ism o'zgarsa — auth hisobini ham
      // yangilaymiz (server yo'li, service kalit bilan).
      if (!DEMO_MODE) {
        const patch = { id: modal.staff.id };
        if (data.password && data.password.length >= 6) patch.password = data.password;
        const before = (modal.staff.phone || "").replace(/\D/g, "");
        const after = (data.phone || "").replace(/\D/g, "");
        if (after && after !== before) patch.phone = data.phone;
        // Ismni ham shu yo'ldan yuboramiz — menejer profiles ga yoza olmaydi
        if (viaApi && data.name && data.name !== modal.staff.name) patch.name = data.name;

        if (patch.password || patch.phone || patch.name) {
          setBusy(true);
          try {
            const { res, out } = await call("PATCH", patch);
            if (!res.ok) { setBusy(false); setErr(out.error || t("Saqlanmadi")); return; }
          } catch (e) { setBusy(false); setErr(e.message); return; }
          if (viaApi) await reloadStaff();
          setBusy(false);
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
      const { res, out } = await call("POST", data);
      if (!res.ok) { setErr(out.error || t("Xodim ochilmadi")); setBusy(false); return; }
      // Usta uchun kamera narxini KPI tizimiga yozamiz
      if (out.id && data.role === "installer" && data.cameraRate > 0) {
        setInstallerRate(out.id, data.cameraRate);
      }
      // Yangi qator realtime bilan kelmasligi mumkin (menejer boshqaning
      // profilini ko'rmaydi) — ro'yxatni o'zimiz qayta o'qiymiz.
      await reloadStaff();
      setModal(null); setBusy(false); bump();
    } catch (e) {
      setErr(e.message); setBusy(false);
    }
  }

  return (
    <div className="card p-7 mb-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-extrabold">
          {t(onlyInstallers ? "Ustalar — login va parol" : "Xodimlar va vakolatlar")}
        </h2>
        <button onClick={() => setModal({})}
          className="flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-5 py-2.5">
          <UserPlus size={18} /> {t(onlyInstallers ? "Usta qo'shish" : "Xodim qo'shish")}
        </button>
      </div>
      <p className="text-sm text-muted font-semibold mb-5">
        {t(onlyInstallers
          ? "Ustaga telefon raqami va parol berasiz — u darrov kira oladi va o'z KPI'sini ko'radi. Parolni unutsa shu yerdan yangisini yozib berasiz."
          : "Xodimga telefon raqami va parol berasiz — u darrov kira oladi. SMS/tasdiqlash kerak emas.")}
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
              <th className="px-4 py-3 font-bold">{t(onlyInstallers ? "Usta" : "Xodim")}</th>
              {!onlyInstallers && <th className="px-4 py-3 font-bold">{t("Rol")}</th>}
              {!onlyInstallers && <th className="px-4 py-3 font-bold">{t("Do'kon")}</th>}
              <th className="px-4 py-3 font-bold text-right">
                {t(onlyInstallers ? "Kamera narxi" : "Fiksa")}
              </th>
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
                {!onlyInstallers && (
                  <td className="px-4 py-3">
                    <span className="bg-brand-soft text-brand text-sm font-bold px-3 py-1 rounded-lg">
                      {t(ROLES[s.role]?.label ?? s.role)}
                    </span>
                  </td>
                )}
                {!onlyInstallers && (
                  <td className="px-4 py-3 font-semibold">
                    {storeName(s.storeId) ?? <span className="text-muted">{t("Barchasi")}</span>}
                  </td>
                )}
                <td className="px-4 py-3 text-right font-semibold">
                  {onlyInstallers
                    ? (cameraRateOf(s.id)
                        ? `${cameraRateOf(s.id).toLocaleString("ru-RU")} ${t("so'm")}`
                        : "—")
                    : (s.salary ? `${s.salary} $` : "—")}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => setModal({ staff: { ...s, cameraRate: cameraRateOf(s.id) } })}
                    className="text-muted hover:text-brand mr-3">
                    <Pencil size={18} />
                  </button>
                  {/* O'chirish — faqat rahbar: yozuv ketsa KPI tarixi ham
                      ketadi, bazada esa zaxiraga qaytarish yo'q */}
                  {!onlyInstallers && (
                    <button onClick={() => { if (confirm(t("Xodim o'chirilsinmi?"))) { removeStaff(s.id); bump(); } }}
                      className="text-muted hover:text-danger"><Trash2 size={18} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {err && <p className="text-danger font-semibold mt-4">{err}</p>}

      {modal && (
        <StaffModal initial={modal.staff ?? null} busy={busy}
          lockRole={onlyInstallers ? "installer" : null}
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
    // Supabase Auth o'rniga o'z yo'limiz. Parol xeshi bazada
    // yasaladi (`crypt`), ya'ni ochiq parol hech qayerda saqlanmaydi.
    const r = await fetch("/api/parol", {
      method: "POST",
      headers: { "content-type": "application/json",
                 authorization: `Bearer ${sessiyaOl()?.token ?? ""}` },
      body: JSON.stringify({ parol: pw }),
    });
    const error = r.ok ? null : { message: (await r.json().catch(() => ({}))).xato ?? "Xato" };
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
    return sessiyaOl()?.token ?? "";
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

// ══════════════════════════════════════════════════════════════
// BILLZ'DAN YANGILASH
// ══════════════════════════════════════════════════════════════
// Ilgari katalog va sotuvlar Billz'dan QO'LDA Excel bilan kelardi
// (/data sahifasi). Endi API bor: tovar, qoldiq, mijoz va cheklar
// o'zi tortiladi. Bu tugma o'shani shu zahoti ishga tushiradi —
// masalan yangi tovar kiritilib, darrov NSPOS'da ko'rish kerak bo'lsa.
//
// Kalit serverda turadi (BILLZ_SECRET_TOKEN), shuning uchun tortish
// brauzerda emas, /api/billz/sync da bajariladi.
function BillzCard() {
  const [busy, setBusy] = useState(null);      // "sync" | "probe" | null
  const [res, setRes] = useState(null);
  const [log, setLog] = useState([]);

  // Oxirgi yangilanish — jurnal jadvalidan. RLS menejer va egasiga
  // o'qishga ruxsat beradi, shuning uchun to'g'ridan-to'g'ri o'qiymiz.
  useEffect(() => {
    if (!supabase) return;
    supabase.from("billz_sync_log")
      .select("entity,finished_at,fetched,inserted,error,no_store,exhausted")
      .order("started_at", { ascending: false }).limit(40)
      .then(({ data }) => setLog(data ?? []));
  }, [res]);

  const last = useMemo(() => {
    const seen = new Map();
    for (const r of log) if (!seen.has(r.entity)) seen.set(r.entity, r);
    return [...seen.values()];
  }, [log]);

  async function token() {
    return sessiyaOl()?.token ?? "";
  }

  async function call(query, kind) {
    setBusy(kind); setRes(null);
    try {
      const r = await fetch(`/api/billz/sync${query}`, {
        headers: { authorization: `Bearer ${await token()}` },
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.status);
      setRes(j);
    } catch (e) {
      setRes({ ok: false, error: String(e.message ?? e) });
    }
    setBusy(null);
  }

  const fmt = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  const LABEL = {
    categories: t("Kategoriyalar"), suppliers: t("Ta'minotchilar"),
    products: t("Tovar va qoldiq"), customers: t("Mijozlar"), orders: t("Sotuvlar"),
    debts: t("Qarzlar"), moslik: t("Billz bilan moslik"),
  };

  return (
    <div className="card p-7 mb-6">
      <div className="flex items-center gap-3 mb-1">
        <span className="w-9 h-9 rounded-xl bg-brand-soft text-brand flex items-center justify-center">
          <RefreshCw size={18} />
        </span>
        <h2 className="text-xl font-extrabold">{t("Billz'dan yangilash")}</h2>
      </div>
      <p className="text-sm text-muted font-semibold mb-5">
        {t("Tovar, qoldiq, mijoz va cheklar Billz'dan avtomatik tortiladi — har kecha va ilova ochilganda. Bu yerdan qo'lda ham yangilashingiz mumkin.")}
      </p>

      {last.length > 0 && (
        <div className="overflow-auto border border-line rounded-xl mb-5">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="text-left text-muted border-b border-line">
                <th className="px-4 py-2.5 font-bold">{t("Bo'lim")}</th>
                <th className="px-4 py-2.5 font-bold">{t("Oxirgi marta")}</th>
                <th className="px-4 py-2.5 font-bold text-right">{t("Olindi")}</th>
                {/* "Yozildi" emas, "Yangi": ustun `inserted` ni ko'rsatadi va u
                    endi faqat HAQIQATAN yangi qatorni sanaydi. Ilgari
                    o'zgargani ham shu yerga qo'shilardi va jadval
                    hech narsa qo'shilmagan kunda ham son ko'rsatardi. */}
                <th className="px-4 py-2.5 font-bold text-right">{t("Yangi")}</th>
                {/* Tashlab ketilgani ham ko'rinsin: ilgari jadval faqat
                    "nechta yozildi" deb turardi va do'koni tanilmagani
                    uchun yozilmagan cheklar hech qayerda bilinmasdi. */}
                <th className="px-4 py-2.5 font-bold text-right">{t("Tashlandi")}</th>
              </tr>
            </thead>
            <tbody>
              {last.map((r) => (
                <tr key={r.entity} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 font-bold">{LABEL[r.entity] ?? r.entity}</td>
                  <td className="px-4 py-2 font-semibold">
                    {fmt(r.finished_at)}
                    {r.exhausted === false && (
                      <span className="ml-2 text-warn font-bold">{t("· chala")}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-semibold text-right">{r.error ? "—" : (r.fetched ?? 0)}</td>
                  <td className="px-4 py-2 font-semibold text-right">
                    {r.error
                      ? <span className="text-danger">{t("xato")}</span>
                      : (r.inserted ?? 0)}
                  </td>
                  <td className="px-4 py-2 font-semibold text-right">
                    {r.no_store > 0
                      ? <span className="text-danger font-bold">{r.no_store}</span>
                      : <span className="text-muted">0</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => call("", "sync")} disabled={!!busy}
          className="flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-dark disabled:opacity-50 text-white font-bold px-6 py-3">
          <RefreshCw size={18} className={busy === "sync" ? "animate-spin" : ""} />
          {t(busy === "sync" ? "Tortilyapti..." : "Hozir yangilash")}
        </button>
        <button onClick={() => call("?probe=1", "probe")} disabled={!!busy}
          className="flex items-center gap-2 rounded-xl border border-line font-bold px-6 py-3 hover:border-brand disabled:opacity-50">
          <Stethoscope size={18} /> {t("Ulanishni tekshirish")}
        </button>
      </div>

      {res?.probe && (
        <div className="mt-5 flex flex-wrap gap-2">
          {Object.entries(res.probe).map(([k, v]) => (
            <span key={k}
              className={`text-sm font-bold px-3 py-1.5 rounded-lg ${
                v.ok && !v.empty ? "bg-ok-soft text-ok"
                : v.forbidden || !v.ok ? "bg-danger-soft text-danger"
                : "bg-warn-soft text-warn"}`}>
              {LABEL[k] ?? k}
              <span className="opacity-70 ml-1.5">{v.ok ? v.count : t("yopiq")}</span>
            </span>
          ))}
        </div>
      )}

      {res?.stages && (
        <p className="mt-4 font-semibold text-ok">
          {Object.entries(res.stages)
            .filter(([, v]) => !v.error)
            .map(([k, v]) => `${LABEL[k] ?? k}: ${v.inserted ?? 0}`)
            .join(" · ") || t("Yangilik yo'q")}
        </p>
      )}

      {(res?.error || res?.warnings?.length > 0) && (
        <div className="mt-4 flex items-start gap-2 text-danger">
          <TriangleAlert size={18} className="shrink-0 mt-0.5" />
          <div className="font-semibold">
            {res.error && <p>{res.error}</p>}
            {(res.warnings ?? []).map((w, i) => <p key={i}>{w}</p>)}
          </div>
        </div>
      )}
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
  // Menejer ustalar bilan ishlaydi — unga faqat usta logini bo'limi
  const canInstallers = !isOwner && can("staff.installers", user);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-7">
        <h1 className="text-4xl font-extrabold tracking-tight">{t("Sozlamalar")}</h1>
        <button onClick={reset}
          className="flex items-center gap-2 rounded-xl border border-line font-bold px-5 py-3 hover:bg-surface">
          <RotateCcw size={18} /> {t("Standartga qaytarish")}
        </button>
      </div>

      {/* Xodimlar — egasi hammasini, menejer faqat ustalarni */}
      {isOwner && <StaffManager />}
      {canInstallers && <StaffManager onlyInstallers />}

      {/* Zaxira nusxa — faqat egasi (butun bazani o'z ichiga oladi) */}
      {isOwner && !demo && <BackupCard />}

      {/* Billz sinxronizatsiyasi — faqat egasi (server kaliti bilan ishlaydi) */}
      {isOwner && !demo && <BillzCard />}

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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
