"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

// Read the theme that the inline ThemeScript already applied (no flash).
function readInitialTheme(): "dark" | "light" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export default function ThemeToggle() {
  const { t } = useLocale();
  // SSR-safe initial: defaults to light, hydrated useEffect syncs to actual.
  const [theme, setTheme] = useState<"dark" | "light">("light");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(readInitialTheme());
  }, []);

  const toggle = () => {
    const next = readInitialTheme() === "dark" ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem("theme", next); } catch {}
    document.documentElement.setAttribute("data-theme", next);
    // Keep meta theme-color in sync — affects Android Chrome address bar + iOS PWA status bar
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
      meta.setAttribute("content", next === "light" ? "#F8FAFC" : "#060912");
    });
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
