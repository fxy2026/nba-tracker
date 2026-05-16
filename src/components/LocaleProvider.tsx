"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { Locale, Translations } from "@/locales/types";
import zh from "@/locales/zh";
import en from "@/locales/en";

const dictionaries: Record<Locale, Translations> = { zh, en };

interface LocaleContextValue {
  locale: Locale;
  t: Translations;
  setLocale: (l: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "zh",
  t: zh,
  setLocale: () => {},
});

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // Hydration: server SSR'd with cookie-derived initialLocale; localStorage is
  // the source of truth on the client. Runs once and only when divergence exists.
  useEffect(() => {
    const stored = localStorage.getItem("locale");
    if (stored === "en" || stored === "zh") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored !== locale) setLocaleState(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    localStorage.setItem("locale", next);
    document.cookie = `locale=${next};path=/;max-age=31536000;SameSite=Lax`;
    // Reload so server components re-render with new locale
    window.location.reload();
  };

  return (
    <LocaleContext value={{ locale, t: dictionaries[locale], setLocale }}>
      {children}
    </LocaleContext>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
