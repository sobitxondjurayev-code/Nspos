"use client";

// ══════════════════════════════════════════════════════════════
// TREND CHIZIG'I (sparkline)
// ══════════════════════════════════════════════════════════════
// Kartochkadagi raqam "hozir qancha" ni aytadi, lekin "yaxshilanyaptimi
// yoki yomonlashyaptimi" ni aytmaydi. Buning uchun eng kichik va eng
// arzon vosita — o'q va to'rsiz kichkina chiziq.
//
// Recharts ISHLATILMAYDI: u har kartochkaga alohida konteyner,
// o'lchagich va qayta chizish qo'shadi. 40 dan ortiq kartochkada bu
// sezilarli. Bu yerda oddiy SVG — bitta `path`.
//
// Rang: butun chiziq bosiq (de-emphasis), OXIRGI nuqta esa ajratilgan.
// Ko'z avval oxirgi nuqtaga tushadi — u "bugun" degani.
export default function Sparkline({
  points = [], width = 96, height = 28, tone = "text-muted", oxirgiTone,
}) {
  const n = points.length;
  if (n < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;

  // 1px chetdan joy — chiziq qirqilib qolmasin
  const p = 2;
  const x = (i) => p + (i * (width - p * 2)) / (n - 1);
  const y = (v) => height - p - ((v - min) / span) * (height - p * 2);

  const d = points.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const oxirgiX = x(n - 1), oxirgiY = y(points[n - 1]);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}
      className="shrink-0 overflow-visible" aria-hidden="true">
      <path d={d} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className={tone} stroke="currentColor" opacity="0.45" />
      <circle cx={oxirgiX} cy={oxirgiY} r="3"
        className={oxirgiTone ?? tone} fill="currentColor" />
    </svg>
  );
}
