import type { Locale, Translations } from "./types";
import zh from "./zh";
import en from "./en";

const dictionaries: Record<Locale, Translations> = { zh, en };

export function getTranslations(locale: Locale): Translations {
  return dictionaries[locale] ?? dictionaries.zh;
}

export type { Locale, Translations };
