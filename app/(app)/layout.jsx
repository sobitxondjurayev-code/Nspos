// ── NEGA STATIK EMAS ──────────────────────────────────────────
// Ilova sahifalari BUILD PAYTIDA emas, HAR SO'ROVDA chiziladi.
//
// Ilgari ular statik edi (`○ Static`), ya'ni HTML `next build`
// paytida bir marta yasalib qotib qolardi. Ichida esa o'sha
// paytdagi SANA bor: davr tanlagichi "01.08.2026 – 22.08.2026" deb
// chizadi. Ertasi kuni brauzer 23.08 ni hisoblaydi va React
// "Text content does not match server-rendered HTML" (#425) beradi:
// u SSR natijasini tashlab, hammasini qaytadan chizadi.
//
// Sahifa baribir ishlaydi (React o'zini tuzatadi), lekin bu bekorga
// ish va ekran bir lahza titraydi. Statik HTML bu yerda hech qanday
// foyda ham bermaydi — ma'lumot brauzerda yuklanadi, ya'ni build
// paytidagi HTML doim BO'SH qobiq.
//
// 2026-08-22 da kirgan holatdagi tekshiruv aynan shuni ko'rsatdi:
// /finance/kassa, /finance/plan va /settings da #425.
export const dynamic = "force-dynamic";

import Shell from "@/components/Shell";
import RouteGuard from "@/components/RouteGuard";
import Brauzerda from "@/components/Brauzerda";
import BillzAutoSync from "@/components/BillzAutoSync";
import YuklanmoqdaBanner from "@/components/YuklanmoqdaBanner";

export default function AppLayout({ children }) {
  return (
    <Shell>
      {/* Billz'dan fonda tortish — eskirgan bo'lsa, rahbar ochganda */}
      <BillzAutoSync />
      <Brauzerda>
        {/* Og'ir jadvallar kelguncha — har sahifada bitta ogohlantirish */}
        <YuklanmoqdaBanner />
        <RouteGuard>{children}</RouteGuard>
      </Brauzerda>
    </Shell>
  );
}
