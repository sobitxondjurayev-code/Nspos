import { t } from "@/lib/i18n";
export default function Page() {
  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight mb-6">{t("Marketing")}</h1>
      <div className="card p-10 text-muted font-semibold">
        {t("\"Marketing\" moduli keyingi bosqichda quriladi.")}
      </div>
    </div>
  );
}
