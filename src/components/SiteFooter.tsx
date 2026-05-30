"use client";

import { useI18n } from "@/components/LanguageProvider";

export default function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-ink-700/60">
      <div className="mx-auto flex max-w-8xl flex-col gap-1 px-5 py-8 text-sm text-parchment-400 sm:px-8">
        <p className="font-display text-base text-parchment-200">{t("footer.title")}</p>
        <p>{t("footer.tagline")}</p>
        <p className="text-parchment-400/70">{t("footer.source")}</p>
      </div>
    </footer>
  );
}
