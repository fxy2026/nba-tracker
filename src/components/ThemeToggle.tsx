"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

export default function ThemeToggle() {
  const { t } = useLocale();
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    setTimeout(() => {
      const stored = localStorage.getItem("theme");
      if (stored === "light") {
        setTheme("light");
        document.documentElement.setAttribute("data-theme", "light");
      }
    }, 0);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    if (next === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  };

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-lg text-text-secondary hover:text-accent-amber hover:bg-bg-hover transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
      title={theme === "dark" ? t.theme.switchToLight : t.theme.switchToDark}
      aria-label={theme === "dark" ? t.theme.switchToLight : t.theme.switchToDark}
    >
      <span className="relative transition-transform hover:rotate-12">
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </span>
    </button>
  );
}
