import { Manrope } from "next/font/google";
import "./globals.css";

// Shrift build paytida yuklab olinadi va o'z domenimizdan beriladi.
// `variable` — CSS o'zgaruvchisi, `globals.css` dagi `--font-ui` shuni
// oladi. `display: swap` — shrift kelguncha matn ko'rinib turadi.
const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});
import ThemeProvider from "@/components/ThemeProvider";
import LangProvider from "@/components/LangProvider";
import AuthProvider from "@/components/AuthProvider";
import DataProvider from "@/components/DataProvider";

export const metadata = {
  title: "NSPOS — Do'kon boshqaruv tizimi",
  description: "Retail do'konlar uchun POS, ombor, mijozlar va hisobotlar",
};

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning — tema klassi klientda qo'yiladi
    <html lang="uz" className={manrope.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <LangProvider>
            <AuthProvider>
              <DataProvider>{children}</DataProvider>
            </AuthProvider>
          </LangProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
