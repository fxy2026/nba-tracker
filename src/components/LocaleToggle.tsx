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
      className="p-2 rounded-lg text-text-secondary hover:text-accent hover:bg-bg-hover transition-colors text-xs font-medium cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
      title={locale === "zh" ? t.locale.switchToEnglish : t.locale.switchToChinese}
      aria-label={locale === "zh" ? t.locale.switchToEnglish : t.locale.switchToChinese}
    >
      <span className="flex items-center gap-1.5">
        <Globe size={15} />
        <span className="font-mono font-bold">{locale === "zh" ? "EN" : "中"}</span>
      </span>
    </button>
  );
}
