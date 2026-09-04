"use client";
import { t } from "@/lib/i18n";
import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, X, ChevronUp } from "lucide-react";
import MultiSelect from "@/components/ui/MultiSelect";

// ══════════════════════════════════════════════════════════════
// UMUMIY FILTR PANELI
// ══════════════════════════════════════════════════════════════
// Billz'dagi naqsh: yuqorida sanoqli tablar, ostida qidiruv va
// ochiladigan "Filtrlar" paneli, panel ichida "Tozalash / Qo'llash".
//
// Nega alohida komponent: har bo'limda o'z filtri bo'lsa, ular
// bir-biridan farq qila boshlaydi — bittasida sana chapda, boshqasida
// o'ngda, uchinchisida "tozalash" yo'q. Bitta komponent hammasini
// bir xil qiladi va yangi bo'lim qo'shilganda tayyor keladi.
//
// Muhim tafsilot: qidiruv DARHOL ishlaydi (har harfda), qolgan
// filtrlar esa "Qo'llash" bosilganda. Aks holda 6 800 mijozli
// ro'yxatda har bosishda qayta hisoblash sekinlashtiradi.

// Bitta maydonni chizadi
function Field({ field, value, onChange }) {
  const set = (v) => onChange(field.key, v);

  if (field.type === "select") {
    return (
      <label className="block">
        <span className="block text-sm font-bold mb-2">{t(field.label)}</span>
        <select className="inp" value={value ?? "all"} onChange={(e) => set(e.target.value)}>
          <option value="all">{t(field.anyLabel ?? "Barchasi")}</option>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>{t(o.label)}</option>
          ))}
        </select>
      </label>
    );
  }

  // Bir nechta qiymat: `null` = barchasi, aks holda kalitlar massivi
  // (CLAUDE.md 2026-09-02). `<label>` O'RAMASIZ — aks holda sarlavha
  // bosilganda popover ochiladi va ichidagi checkbox label'lari ichma-ich
  // bo'ladi; sarlavhani MultiSelect o'zi chizadi.
  if (field.type === "multi") {
    return (
      <div>
        <MultiSelect label={field.label} options={field.options} value={value ?? null}
          onChange={set} allLabel={field.anyLabel ?? "Barchasi"} />
      </div>
    );
  }

  if (field.type === "range") {
    const v = value ?? {};
    return (
      <label className="block">
        <span className="block text-sm font-bold mb-2">{t(field.label)}</span>
        <div className="flex items-center gap-2">
          <input type="number" className="inp" placeholder={t("dan")}
            value={v.min ?? ""} onChange={(e) => set({ ...v, min: e.target.value })} />
          <span className="text-muted font-bold">—</span>
          <input type="number" className="inp" placeholder={t("gacha")}
            value={v.max ?? ""} onChange={(e) => set({ ...v, max: e.target.value })} />
        </div>
      </label>
    );
  }

  if (field.type === "dateRange") {
    const v = value ?? {};
    return (
      <label className="block">
        <span className="block text-sm font-bold mb-2">{t(field.label)}</span>
        <div className="flex items-center gap-2">
          <input type="date" className="inp"
            value={v.from ?? ""} onChange={(e) => set({ ...v, from: e.target.value })} />
          <span className="text-muted font-bold">—</span>
          <input type="date" className="inp"
            value={v.to ?? ""} onChange={(e) => set({ ...v, to: e.target.value })} />
        </div>
      </label>
    );
  }

  // text
  return (
    <label className="block">
      <span className="block text-sm font-bold mb-2">{t(field.label)}</span>
      <input className="inp" placeholder={t(field.placeholder ?? "")}
        value={value ?? ""} onChange={(e) => set(e.target.value)} />
    </label>
  );
}

// Filtr to'ldirilganmi — belgidagi sanoq uchun
const isSet = (v) =>
  v != null && v !== "" && v !== "all" &&
  (typeof v !== "object" || Object.values(v).some((x) => x !== "" && x != null));

export const activeCount = (filters) => Object.values(filters ?? {}).filter(isSet).length;

// Filtrlarni ro'yxatga qo'llash uchun umumiy yordamchi.
// Har maydon uchun `get` beriladi: yozuvdan solishtiriladigan qiymatni oladi.
export function applyFilters(rows, fields, filters) {
  if (!filters) return rows;
  return rows.filter((row) =>
    fields.every((f) => {
      const v = filters[f.key];
      if (!isSet(v)) return true;
      const cell = f.get ? f.get(row) : row[f.key];

      if (f.type === "select") return String(cell) === String(v);
      if (f.type === "multi") return Array.isArray(v) && v.some((x) => String(x) === String(cell));
      if (f.type === "range") {
        const n = Number(cell) || 0;
        if (v.min !== "" && v.min != null && n < Number(v.min)) return false;
        if (v.max !== "" && v.max != null && n > Number(v.max)) return false;
        return true;
      }
      if (f.type === "dateRange") {
        const d = String(cell ?? "").slice(0, 10);
        if (!d) return false;
        if (v.from && d < v.from) return false;
        if (v.to && d > v.to) return false;
        return true;
      }
      return String(cell ?? "").toLowerCase().includes(String(v).toLowerCase());
    })
  );
}

export default function FilterBar({
  search,                 // { value, onChange, placeholder }
  tabs, activeTab, onTab, // [{ key, label, count }]
  fields = [],            // filtr maydonlari
  filters = {}, onChange, // qo'llangan qiymatlar
  actions,                // o'ngdagi qo'shimcha tugmalar
  extra,                  // panel ichidagi qo'shimcha boshqaruv (hisobotga xos)
  extraCount = 0,         // shu boshqaruv ishlayotgan bo'lsa — tugmadagi sanoqqa qo'shiladi
}) {
  const [open, setOpen] = useState(false);
  // Filtr DARHOL qo'llanadi. Avval "Qo'llash" tugmasi bor edi va uni
  // bosmagan odam "filtr ishlamayapti" deb o'ylardi — shuning uchun
  // har o'zgarish shu zahoti kuchga kiradi (Meta/Google reklamadagidek).
  const [draft, setDraft] = useState(filters);
  const n = useMemo(() => activeCount(filters) + extraCount, [filters, extraCount]);

  // Ro'yxatdan yo'qolgan tanlov (arxivlangan tovar, boshqa davr, boshqa
  // do'kon) O'ZI tozalanadi — aks holda jadval jimgina bo'sh qolardi
  // (CLAUDE.md 2026-09-02). Bitta joyda, hamma sahifa uchun: sahifaga
  // alohida `useEffect` yozilmaydi. Hech narsa o'zgarmasa `onChange`
  // chaqirilmaydi (halqa bo'lmasin); o'zgarsa `draft` ham birga — u faqat
  // panel ochilganda sinxronlanadi, busiz ochiq panel eskisini ko'rsatardi.
  useEffect(() => {
    let next = null;
    for (const f of fields) {
      if (!f.options || (f.type !== "select" && f.type !== "multi")) continue;
      const v = filters?.[f.key];
      if (!isSet(v)) continue;
      const bor = new Set(f.options.map((o) => String(o.value)));
      if (f.type === "multi") {
        if (!Array.isArray(v)) continue;
        const qoldi = v.filter((x) => bor.has(String(x)));
        if (qoldi.length === v.length) continue;
        (next ??= { ...filters })[f.key] = qoldi.length ? qoldi : null;
      } else if (!bor.has(String(v))) {
        (next ??= { ...filters })[f.key] = "all";
      }
    }
    if (next) { setDraft(next); onChange?.(next); }
  }, [fields, filters, onChange]);

  const openPanel = () => { setDraft(filters); setOpen((v) => !v); };
  const change = (k, v) => {
    setDraft((d) => {
      const next = { ...d, [k]: v };
      onChange?.(next);
      return next;
    });
  };
  const reset = () => { setDraft({}); onChange?.({}); };

  return (
    <div className="mb-6">
      {/* Sanoqli tablar */}
      {tabs?.length > 0 && (
        <div className="bg-track rounded-2xl p-1.5 flex w-fit mb-4 flex-wrap">
          {tabs.map((tb) => (
            <button key={tb.key} onClick={() => onTab?.(tb.key)}
              className={`tab-btn ${activeTab === tb.key ? "active" : ""}`}>
              {t(tb.label)}
              {tb.count != null && (
                <span className={`ml-2 text-sm font-bold ${
                  activeTab === tb.key ? "opacity-70" : "text-muted"}`}>{tb.count}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Qidiruv + filtr tugmasi */}
      <div className="flex items-center gap-3">
        {search && (
          // Ikonka va matn ustma-ust tushmasligi uchun flex qator:
          // absolute joylashtirish o'rniga ikonka alohida ustun.
          <div className="flex items-center gap-3 flex-1 rounded-xl border border-line bg-panel px-4
                          focus-within:border-brand focus-within:ring-4 focus-within:ring-brand-soft">
            <Search size={18} className="text-muted shrink-0" />
            <input value={search.value} onChange={(e) => search.onChange(e.target.value)}
              placeholder={t(search.placeholder ?? "Qidirish...")}
              className="flex-1 min-w-0 bg-transparent py-3 outline-none font-semibold" />
            {search.value && (
              <button onClick={() => search.onChange("")}
                className="text-muted hover:text-ink shrink-0">
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {fields.length > 0 && (
          <button onClick={openPanel}
            className={`flex items-center gap-2 rounded-xl border px-5 py-3 font-bold transition-colors ${
              open || n > 0 ? "border-brand bg-brand-soft text-brand" : "border-line hover:border-brand"}`}>
            {open ? <ChevronUp size={18} /> : <SlidersHorizontal size={18} />}
            {t("Filtrlar")}
            {n > 0 && (
              <span className="bg-brand text-white text-sm font-bold rounded-lg px-2 py-0.5">{n}</span>
            )}
          </button>
        )}

        {actions}
      </div>

      {/* Ochiladigan panel */}
      {open && (
        <div className="card p-6 mt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
            {fields.map((f) => (
              <Field key={f.key} field={f} value={draft[f.key]} onChange={change} />
            ))}
          </div>

          {/* Hisobotga xos boshqaruv — o'z kartochkasini egallab turmasin
              deb shu panel ichida turadi. */}
          {extra && <div className="border-t border-line pt-5 mb-6">{extra}</div>}
          <div className="flex items-center gap-3 justify-between">
            <p className="text-sm text-muted font-semibold">
              {t("O'zgarishlar darhol qo'llanadi — bir nechta shartni birga qo'ysangiz bo'ladi")}
            </p>
            <div className="flex gap-3 shrink-0">
              <button onClick={reset}
                className="rounded-xl border border-line font-bold px-6 py-3 hover:bg-surface">
                {t("Filtrlarni tozalash")}
              </button>
              <button onClick={() => setOpen(false)}
                className="rounded-xl bg-brand hover:bg-brand-dark text-white font-bold px-6 py-3">
                {t("Yopish")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
