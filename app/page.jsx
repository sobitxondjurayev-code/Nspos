// Bu sahifaga NAVBAT KELMAYDI: `/` yo'naltirishi `next.config.mjs`
// dagi `redirects()` da, ya'ni HTTP darajasida bajariladi.
//
// Ilgari yo'naltirish shu yerda edi va sahifa statik bo'lgani uchun
// Next uni mijoz tomonida ham qayta ishlab, o'z router'ida hook
// tartibini buzardi (React #310, "Application error"). Fayl zaxira
// sifatida qoldirilgan: sozlamadagi yo'naltirish olib tashlansa,
// `/` baribir ishlaydi.
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function Home() {
  redirect("/dashboard");
}
