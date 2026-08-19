import "./globals.css";
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
    <html lang="uz" suppressHydrationWarning>
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
