"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  DEFAULT_LANG,
  LANG_STORAGE_KEY,
  translate,
  UI_LANGS,
  type UILang,
} from "@/lib/i18n";

interface I18nContextValue {
  lang: UILang;
  setLang: (l: UILang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<UILang>(DEFAULT_LANG);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LANG_STORAGE_KEY) as UILang | null;
      if (stored && UI_LANGS.includes(stored)) setLangState(stored);
    } catch {}
  }, []);

  // Keep <html lang> in sync.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: UILang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, l);
    } catch {}
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang]
  );

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Safe fallback if used outside a provider (e.g. during isolated render).
    return {
      lang: DEFAULT_LANG,
      setLang: () => {},
      t: (key, vars) => translate(DEFAULT_LANG, key, vars),
    };
  }
  return ctx;
}
