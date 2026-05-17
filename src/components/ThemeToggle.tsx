"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

// Read the theme that the inline ThemeScript already applied (no flash).
function readInitialTheme(): "dark" | "light" {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export default function ThemeToggle() {
  const { t } = useLocale();
  // SSR-safe initial: defaults to dark, hydrated useEffect syncs to actual.
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(readInitialTheme());
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem("theme", next); } catch {}
    if (next === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    // Keep meta theme-color in sync — affects Android Chrome address bar + iOS PWA status bar
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", next === "light" ? "#F8FAFC" : "#060912");
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
