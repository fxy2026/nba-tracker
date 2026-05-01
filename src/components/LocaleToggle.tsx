"use client";

import { useLocale } from "./LocaleProvider";
import { Globe } from "lucide-react";

export default function LocaleToggle() {
  const { locale, setLocale } = useLocale();

  const toggle = () => {
    setLocale(locale === "zh" ? "en" : "zh");
  };

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors text-xs font-medium"
      title={locale === "zh" ? "Switch to English" : "切换到中文"}
      aria-label={locale === "zh" ? "Switch to English" : "切换到中文"}
    >
      <span className="flex items-center gap-1">
        <Globe size={16} />
        <span>{locale === "zh" ? "EN" : "中"}</span>
      </span>
    </button>
  );
}
