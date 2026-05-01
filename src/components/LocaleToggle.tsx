"use client";

import { useLocale } from "./LocaleProvider";
import { Globe } from "lucide-react";

export default function LocaleToggle() {
  const { locale, t, setLocale } = useLocale();

  const toggle = () => {
    setLocale(locale === "zh" ? "en" : "zh");
  };

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors text-xs font-medium"
      title={locale === "zh" ? t.locale.switchToEnglish : t.locale.switchToChinese}
      aria-label={locale === "zh" ? t.locale.switchToEnglish : t.locale.switchToChinese}
    >
      <span className="flex items-center gap-1">
        <Globe size={16} />
        <span>{locale === "zh" ? "EN" : "中"}</span>
      </span>
    </button>
  );
}
