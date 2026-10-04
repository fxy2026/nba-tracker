"use client";

import { createContext, useCallback, useContext, useMemo, useEffect, type ReactNode } from "react";
import type { Locale, Translations } from "@/locales/types";
import zh from "@/locales/zh";
import en from "@/locales/en";

const dictionaries: Record<Locale, Translations> = { zh, en };

interface LocaleContextValue {
  locale: Locale;
  t: Translations;
  setLocale: (l: Locale, refreshRoute?: () => void) => void;
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
  // The cookie-derived server locale also owns the client UI. Switching only
  // client consumers would leave them out of sync with server-rendered content.
  const locale = initialLocale;

  useEffect(() => {
    try {
      if (localStorage.getItem("locale") !== locale) {
        localStorage.setItem("locale", locale);
      }
    } catch {
      // Storage is only a best-effort mirror (it can be blocked or full).
    }
  }, [locale]);

  // PERF: setLocale identity is stable across renders. Without useCallback,
  // the context value reference changes on every render even when locale
  // hasn't changed, causing every useLocale() consumer (basically every
  // client component on the site — Navbar, Footer, GamesList, every t.x
  // call) to re-render unnecessarily.
  const setLocale = useCallback((next: Locale, refreshRoute?: () => void) => {
    document.cookie = `locale=${next};path=/;max-age=31536000;SameSite=Lax`;
    try {
      localStorage.setItem("locale", next);
    } catch {
      // Storage failures must not prevent the cookie-backed update.
    }
    // Read the current URL at click time, including after Back/Forward. Admin
    // access lives only in React state: a document reload would discard it.
    // Refresh merges the cookie-derived server locale without remounting that
    // state. Leave public routes on their existing full-reload behavior.
    const pathname = window.location.pathname;
    if (refreshRoute && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
      refreshRoute();
    } else {
      window.location.reload();
    }
  }, []);

  // PERF: memoize the context value so its reference is stable across renders.
  // Only changes when `locale` changes. Without this, every render of
  // LocaleProvider would fan out a re-render to every consumer.
  const value = useMemo<LocaleContextValue>(
    () => ({ locale, t: dictionaries[locale], setLocale }),
    [locale, setLocale]
  );

  return <LocaleContext value={value}>{children}</LocaleContext>;
}

export function useLocale() {
  return useContext(LocaleContext);
}
