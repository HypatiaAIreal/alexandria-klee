"use client";

import { useI18n } from "@/components/LanguageProvider";
import { UI_LANGS, type UILang } from "@/lib/i18n";

const SHORT: Record<UILang, string> = { en: "EN", de: "DE", es: "ES" };

export default function LanguageSelector() {
  const { lang, setLang, t } = useI18n();
  return (
    <div
      className="flex items-center gap-0.5 rounded-md border border-ink-700 bg-ink-850 p-0.5"
      role="group"
      aria-label={t("nav.language")}
    >
      {UI_LANGS.map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`rounded px-2 py-1 font-mono text-xs transition-colors ${
            lang === l
              ? "bg-ochre/20 text-ochre"
              : "text-parchment-400 hover:text-parchment-100"
          }`}
        >
          {SHORT[l]}
        </button>
      ))}
    </div>
  );
}
