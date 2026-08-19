"use client";
// ══════════════════════════════════════════════════════════════
// PUL ZINAPOYASI (kaskad)
// ══════════════════════════════════════════════════════════════
// Rahbar daftarda chizgan ko'rinish: yuqorida hozir bor pul, keyin
// har to'lov uni bir pog'ona pastga tushiradi, oxirida nima qolishi.
// Jadval "qancha" degan savolga javob beradi, bu esa "shundan keyin
// nima qoladi" degan savolga — ikkalasi ham kerak.
//
// Recharts ishlatilmadi: kaskad ustunlari manfiy qoldiqqa tushganda
// stacked bar ikkiga bo'linib ketadi (musbat va manfiy stack alohida).
// Oddiy CSS ustunlar bunda ham to'g'ri chiziladi.
import { t, tt } from "@/lib/i18n";
import { fmtUSD } from "@/lib/demoData";

// Ustun ko'p bo'lsa o'qib bo'lmaydi: eng kattalari qoladi, qolgani
// bitta ustunga yig'iladi. Nechtasi yig'ilgani izohda ko'rinadi —
// jimgina kesib tashlansa, jami noto'g'ri ko'ringan bo'lardi.
const MAX_STEPS = 8;

// bare — kartochka ichida ko'rsatilyapti: o'zining ramkasi va sarlavhasi
// kerak emas, aks holda kartochka ichida ikkinchi kartochka bo'lib qoladi.
export default function PayoutWaterfall({ start = 0, items = [], bare = false }) {
  // Kassada pul bo'lmasa zinapoyaning ma'nosi yo'q: hamma pog'ona
  // nolning ostida, butun maydon qizil bo'lib ketadi va hech narsa
  // aytmaydi. Bunday paytda ro'yxatning o'zi yetarli.
  if (!items.length || start <= 0) return null;

  // —— Qadamlarni tayyorlash ————————————————————————
  let steps = items.map((p) => ({ id: p.id, label: p.title, amount: p.amount }));
  if (steps.length > MAX_STEPS) {
    const sorted = [...steps].sort((a, b) => b.amount - a.amount);
    const top = sorted.slice(0, MAX_STEPS - 1);
    const rest = sorted.slice(MAX_STEPS - 1);
    steps = [
      ...steps.filter((s) => top.some((x) => x.id === s.id)),
      {
        id: "rest",
        label: tt("Yana {n} ta to'lov", { n: rest.length }),
        amount: +rest.reduce((a, x) => a + x.amount, 0).toFixed(2),
      },
    ];
  }

  // Har ustunning yuqori va quyi chegarasi: pul qayerdan qayerga tushdi
  const cols = [{ kind: "start", label: "Hozir bor", from: 0, to: start, amount: start }];
  let run = start;
  for (const s of steps) {
    const next = +(run - s.amount).toFixed(2);
    cols.push({ kind: "out", id: s.id, label: s.label, from: run, to: next, amount: -s.amount });
    run = next;
  }
  cols.push({ kind: "end", label: "Qoladi", from: 0, to: run, amount: run });

  // O'lchov: eng yuqori va eng past nuqta (nolni ham qamrab oladi —
  // pul yetmasa ustun nolning ostiga tushishi kerak)
  const ys = cols.flatMap((c) => [c.from, c.to]);
  const top = Math.max(0, ...ys);
  const bottom = Math.min(0, ...ys);
  const span = top - bottom || 1;
  const pct = (v) => ((top - v) / span) * 100;   // yuqoridan foizda

  const zero = pct(0);

  return (
    <div className={bare ? "" : "card p-7 mb-7"}>
      <h2 className={bare ? "text-lg font-extrabold mb-1" : "text-2xl font-extrabold mb-1"}>
        {t("Pul qayerga ketadi")}
      </h2>
      <p className="text-sm text-muted font-semibold mb-6">
        {t("Chapda hozir bor pul, har pog'ona — bitta to'lov, o'ngda hammasidan keyin qoladigani")}
      </p>

      {/* pt-7 — eng yuqoridagi ustunning summasi ustunning tepasida
          yoziladi; joy qoldirilmasa gorizontal skroll uni kesib tashlaydi
          (overflow-x: auto vertikalni ham kesadi) */}
      <div className="overflow-x-auto pt-7">
        <div className="min-w-[40rem]">
          {/* Ustunlar */}
          <div className="relative flex items-stretch gap-2 h-[16.25rem]">
            {/* Nol chizig'i — pul minusga tushsa ko'rinib tursin */}
            <div className="absolute left-0 right-0 border-t border-dashed border-line pointer-events-none"
              style={{ top: `${zero}%` }} />

            {cols.map((c, i) => {
              const hi = Math.max(c.from, c.to);
              const lo = Math.min(c.from, c.to);
              const tone =
                c.kind === "out" ? "bg-danger"
                  : c.kind === "start" ? "bg-brand"
                    : c.to >= 0 ? "bg-ok" : "bg-danger";
              return (
                <div key={c.id ?? c.kind + i} className="relative flex-1 min-w-0" title={c.label}>
                  <div className={`absolute left-1 right-1 rounded-lg ${tone}`}
                    style={{
                      top: `${pct(hi)}%`,
                      // Juda kichik summa ham ko'rinib tursin
                      height: `max(6px, ${((hi - lo) / span) * 100}%)`,
                    }} />
                  {/* Summa ustunning tepasida. whitespace-nowrap: uzun
                      raqam ("−10 000.00 USD") ikki qatorga bo'linib
                      yarmi ko'rinmay qolmasin. */}
                  <div className="absolute left-0 right-0 text-center whitespace-nowrap"
                    style={{ top: `calc(${pct(hi)}% - 22px)` }}>
                    <span className={`text-sm font-extrabold ${
                      c.kind === "out" ? "text-danger"
                        : c.kind === "start" ? "text-brand"
                          : c.to >= 0 ? "text-ok" : "text-danger"}`}>
                      {/* Oxirgi ustun minusga tushsa ham belgisi ko'rinsin —
                          "1 900" bilan "−1 900" farqi bu yerda hal qiluvchi */}
                      {c.kind === "out" || c.amount < 0 ? "−" : ""}{fmtUSD(Math.abs(c.amount))}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Nomlar */}
          <div className="flex items-start gap-2 mt-3">
            {cols.map((c, i) => (
              <div key={(c.id ?? c.kind + i) + "-lbl"} className="flex-1 min-w-0 text-center">
                <p className={`text-sm font-bold leading-tight break-words ${
                  c.kind === "out" ? "text-muted" : ""}`}>
                  {t(c.label)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
