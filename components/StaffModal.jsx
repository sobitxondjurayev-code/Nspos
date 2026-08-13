"use client";
import { t } from "@/lib/i18n";
import { useState, useEffect } from "react";
import { X, Eye } from "lucide-react";
import NumberField from "@/components/NumberField";
import { ROLES, SECTIONS, canOpen } from "@/lib/auth";
import { EXPENSE_CATEGORIES } from "@/lib/expensesData";
import { ANALYSES } from "@/lib/analyses";
import { demoStores } from "@/lib/demoData";
import { formatPhoneInput } from "@/lib/loginId";

// Rol standarti bo'yicha qaysi bo'limlar ochiq — boshlang'ich holat
const roleDefaults = (r) =>
  Object.fromEntries(SECTIONS.map((s) => [s.key, canOpen(s.key, { role: r })]));

// Xodim qo'shish / tahrirlash oynasi.
// Yangi xodimda EMAIL so'raladi — u taklif bo'lib yoziladi va xodim
// o'sha email bilan ro'yxatdan o'tadi. Mavjud xodimda email
// o'zgartirilmaydi (u auth hisobiga bog'langan).
//
// `lockRole` berilsa oyna faqat shu rol uchun ishlaydi: rol tanlash,
// do'kon, ko'rish huquqlari va ish haqi shartlari umuman ko'rinmaydi.
// Menejer ustaga login ochganda shu ko'rinish chiqadi — u faqat ism,
// raqam, parol va kamera narxini belgilaydi.
export default function StaffModal({ initial = null, busy = false, lockRole = null, onClose, onSave }) {
  const isEdit = !!initial;
  const full = !lockRole;
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [role, setRole] = useState(lockRole ?? initial?.role ?? "cashier");
  const [storeId, setStoreId] = useState(initial?.storeId ?? "");
  const [salary, setSalary] = useState(initial?.salary ?? 0);
  const [salesPct, setSalesPct] = useState(initial?.salesPct ?? 0);
  const [servicePct, setServicePct] = useState(initial?.servicePct ?? 0);
  const [cameraRate, setCameraRate] = useState(initial?.cameraRate ?? 0);
  const [password, setPassword] = useState("");
  // Har xodimga alohida bo'lim ruxsatlari
  const [perms, setPerms] = useState(() =>
    initial?.perms?.sections
      ? { ...roleDefaults(initial.role), ...initial.perms.sections }
      : roleDefaults(initial?.role ?? "cashier"));
  // Qaysi xarajat turlarini kirita oladi. Bo'sh massiv — hech biri,
  // null — cheklov yo'q (hammasi). Rahbar uchun umuman so'ralmaydi.
  const [expCats, setExpCats] = useState(() =>
    Array.isArray(initial?.perms?.expenseCategories)
      ? initial.perms.expenseCategories
      : null);
  // Rol o'zgarsa — saqlangan ruxsat bo'lmasa, yangi rol standartiga moslaymiz
  useEffect(() => {
    if (!initial?.perms) setPerms(roleDefaults(role));
  }, [role]);

  const phoneDigits = phone.replace(/\D/g, "");
  // Telefon (login) har doim kerak. Yangi xodimda parol ham shart;
  // tahrirda parol ixtiyoriy (bo'sh qoldirilsa o'zgarmaydi).
  const valid = name.trim() && phoneDigits.length >= 9 &&
    (isEdit ? (!password || password.length >= 6)
            : password.length >= 6);

  function save() {
    // Cheklangan ko'rinishda faqat login ma'lumoti va kamera narxi
    // yuboriladi — ish haqi va ruxsatlar rahbarnikiligicha qoladi.
    if (!full) {
      onSave({ name: name.trim(), phone: phone.trim(), role, cameraRate, password });
      return;
    }
    onSave({
      name: name.trim(), phone: phone.trim(),
      role, storeId: storeId || null, salary, salesPct, servicePct, cameraRate,
      perms: { sections: perms, expenseCategories: expCats },
      password,
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-overlay/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-8 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-extrabold">
            {full ? t(isEdit ? "Xodimni tahrirlash" : "Yangi xodim")
                  : t(isEdit ? "Usta logini" : "Yangi usta")}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={22} /></button>
        </div>

        <label className="block text-sm font-bold mb-2">{t("F.I.O")}</label>
        <input value={name} onChange={(e) => setName(e.target.value)}
          className="inp mb-4" placeholder={t("Ism familiya")} autoFocus />

        <label className="block text-sm font-bold mb-2">{t("Telefon raqami")} — {t("login")}</label>
        <input value={phone} onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
          type="tel" inputMode="numeric" autoComplete="tel"
          className="inp mb-1 tracking-wide" placeholder="+998 90 123 45 67" />
        <p className="text-sm text-muted font-semibold mb-4">
          {t(isEdit
            ? "Bu raqam xodimning logini. O'zgartirsangiz — xodim yangi raqam bilan kiradi."
            : "Shu raqam va parol bilan xodim darrov kiradi. SMS/tasdiqlash kerak emas.")}
        </p>

        <label className="block text-sm font-bold mb-2">
          {t(isEdit ? "Yangi parol" : "Parol")}
        </label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="text"
          className="inp mb-1" placeholder={t(isEdit ? "Bo'sh qoldirsangiz o'zgarmaydi" : "Kamida 6 belgi")} />
        <p className="text-sm text-muted font-semibold mb-4">
          {t(isEdit
            ? "Parolni tiklash uchun yangi parol yozing va saqlang. Keyin xodimga ayting."
            : "Shu parolni xodimga aytasiz. U keyin o'zi o'zgartira oladi.")}
        </p>

        {/* Vakolat */}
        {full && (<>
        <label className="block text-sm font-bold mb-2">{t("Rol va vakolat")}</label>
        <div className="grid grid-cols-1 gap-2 mb-4">
          {Object.entries(ROLES).map(([key, r]) => (
            <button key={key} onClick={() => setRole(key)}
              className={`text-left rounded-xl border-2 px-4 py-3 transition-colors ${
                role === key ? "border-brand bg-brand-soft" : "border-line hover:border-brand"}`}>
              <p className="font-extrabold">{t(r.label)}</p>
              <p className="text-sm text-muted font-semibold">{t(r.hint)}</p>
            </button>
          ))}
        </div>

        <label className="block text-sm font-bold mb-2">{t("Do'kon")}</label>
        <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className="inp mb-1">
          <option value="">{t("Barcha do'konlar")}</option>
          {demoStores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <p className="text-sm text-muted font-semibold mb-4">
          {t("Do'kon tanlansa — xodim faqat o'sha do'kon ma'lumotini ko'radi.")}
        </p>
        </>)}

        {/* Ko'rish huquqlari — har xodimga alohida bo'lim ruxsatlari */}
        {full && role !== "owner" && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Eye size={18} className="text-brand" />
              <p className="font-extrabold">{t("Ko'rish huquqlari")}</p>
            </div>
            <p className="text-sm text-muted font-semibold mb-3">
              {t("Xodim qaysi bo'limlarni ko'radi. O'chirilgani unga umuman ko'rinmaydi.")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SECTIONS.map((s) => (
                <label key={s.key}
                  className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 cursor-pointer transition-colors ${
                    perms[s.key] ? "border-brand bg-brand-soft" : "border-line hover:border-brand"}`}>
                  <input type="checkbox" checked={!!perms[s.key]}
                    onChange={(e) => setPerms((p) => ({ ...p, [s.key]: e.target.checked }))}
                    className="w-4 h-4 accent-brand shrink-0" />
                  <span className="font-semibold text-sm">{t(s.label)}</span>
                </label>
              ))}
            </div>

            {/* Xarajat bo'limi ochiq bo'lsa — qaysi turlarni kirita
                olishini alohida belgilaymiz. Do'kon menejeri ijara yoki
                shaxsiy xarajat kiritmasligi kerak; u faqat o'ziga
                tegishlisini yuritadi. */}
            {perms["/finance/expenses"] && (
              <div className="mt-4 ml-1 pl-4 border-l-2 border-line">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-bold text-sm">{t("Qaysi xarajatni kirita oladi")}</p>
                  <button type="button"
                    onClick={() => setExpCats(expCats === null ? [] : null)}
                    className="text-xs font-bold text-brand hover:underline">
                    {t(expCats === null ? "Tanlab belgilash" : "Hammasi ochiq")}
                  </button>
                </div>
                <p className="text-sm text-muted font-semibold mb-3">
                  {t(expCats === null
                    ? "Hozir barcha turlar ochiq. Cheklash uchun \"Tanlab belgilash\" ni bosing."
                    : "Faqat belgilangan turlarni kirita oladi. Xarajat oynasida boshqasi ko'rinmaydi.")}
                </p>
                {expCats !== null && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.entries(EXPENSE_CATEGORIES).map(([key, c]) => {
                      const on = expCats.includes(key);
                      return (
                        <label key={key}
                          className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 cursor-pointer transition-colors ${
                            on ? "border-brand bg-brand-soft" : "border-line hover:border-brand"}`}>
                          <input type="checkbox" checked={on}
                            onChange={(e) => setExpCats((list) =>
                              e.target.checked ? [...list, key] : list.filter((x) => x !== key))}
                            className="w-4 h-4 accent-brand shrink-0" />
                          <span className="font-semibold text-sm">{t(c.label)}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Hisobotlar ichidagi tahlillar — bo'lim ochiq bo'lsa,
                qaysi tahlilni ko'rishini alohida tanlash mumkin */}
            {perms["/reports"] && (
              <div className="mt-4 ml-1 pl-4 border-l-2 border-line">
                <p className="font-bold text-sm mb-1">{t("Qaysi hisobotlarni ko'radi")}</p>
                <p className="text-sm text-muted font-semibold mb-3">
                  {t("Belgilanmagani ro'yxatda ko'rinmaydi. Hech biri belgilanmasa — hammasi ochiq.")}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ANALYSES.map((a) => {
                    const key = `/reports/${a.id}`;
                    // Alohida belgilanmagan bo'lsa — bo'lim ruxsatiga ergashadi
                    const on = perms[key] ?? true;
                    return (
                      <label key={key}
                        className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 cursor-pointer transition-colors ${
                          on ? "border-brand bg-brand-soft" : "border-line hover:border-brand"}`}>
                        <input type="checkbox" checked={on}
                          onChange={(e) => setPerms((p) => ({ ...p, [key]: e.target.checked }))}
                          className="w-4 h-4 accent-brand shrink-0" />
                        <span className="font-semibold text-sm">{t(a.label)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ish haqi shartlari — rahbarniki. Menejer ustaga login ochganda
            bu bo'lim ko'rinmaydi (u boshqaning oyligini ko'rmaydi ham). */}
        {full && (<>
        <p className="font-extrabold mb-3">{t("Ish haqi shartlari")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <label className="block">
            <span className="block text-sm font-bold mb-2">{t("Fiksa ($)")}</span>
            <NumberField value={salary} onChange={setSalary} />
          </label>
          <label className="block">
            <span className="block text-sm font-bold mb-2">{t("Sotuvdan %")}</span>
            <NumberField value={salesPct} onChange={setSalesPct} />
          </label>
          <label className="block">
            <span className="block text-sm font-bold mb-2">{t("Xizmatdan %")}</span>
            <NumberField value={servicePct} onChange={setServicePct} />
          </label>
        </div>
        </>)}

        {/* Usta uchun: har kamera uchun to'lov (shu ustaga alohida) */}
        {role === "installer" && (
          <div className="rounded-xl bg-brand-soft/40 border border-brand/20 p-4 mb-7">
            <label className="block">
              <span className="block text-sm font-bold mb-2">{t("Kamera narxi (so'm/dona)")}</span>
              <NumberField value={cameraRate} onChange={setCameraRate} />
              <span className="block text-sm text-muted font-semibold mt-2">
                {t("Har o'rnatilgan kamera uchun shu ustaga to'lanadigan summa. Oyligi = kamera soni × shu narx + davomat.")}
              </span>
            </label>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-line font-bold py-3 hover:bg-surface">
            {t("Bekor qilish")}
          </button>
          <button disabled={!valid || busy} onClick={save}
            className="flex-1 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold py-3 disabled:opacity-50">
            {busy ? t("Ochilmoqda…") : t(isEdit ? "Saqlash" : (full ? "Xodim ochish" : "Usta ochish"))}
          </button>
        </div>
      </div>
    </div>
  );
}
