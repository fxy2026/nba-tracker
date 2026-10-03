"use client";

import { useEffect, useState, memo } from "react";
import { ChevronUp } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
  });
}

export default memo(function BackToTop() {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Perf: rAF-throttle + only setState on transition. Previously fired
    // setState on every scroll event; mount/unmount churned the DOM.
    let ticking = false;
    let lastVisible = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const next = window.scrollY > 400;
        if (next !== lastVisible) {
          lastVisible = next;
          setVisible(next);
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Keyboard shortcut: press 'T' to scroll to top
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "t" && !e.ctrlKey && !e.metaKey) {
        scrollToTop();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Complementary display rules leave only one keyboard target at each breakpoint.
  // Mobile stays in document flow so it never obscures charts or table cells.
  return (
    <>
      <div className="flex justify-center px-4 py-4 sm:hidden">
        <button
          type="button"
          onClick={scrollToTop}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-bg-secondary px-4 text-sm font-medium text-text-primary cursor-pointer hover:bg-bg-tertiary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <ChevronUp size={18} aria-hidden="true" />
          {isZh ? "回到顶部" : "Back to top"}
        </button>
      </div>
    <button
      type="button"
      onClick={scrollToTop}
      className={`bottom-8 fixed right-4 z-40 w-11 h-11 rounded-full bg-accent-gradient text-white shadow-xl shadow-accent/30 ring-1 ring-white/20 hidden sm:flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer ${
        visible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none translate-y-2"
      }`}
      aria-label={isZh ? "回到顶部" : "Back to top"}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      title={isZh ? "回到顶部（按 T）" : "Back to top (press T)"}
    >
      <ChevronUp size={20} strokeWidth={2.5} aria-hidden="true" />
    </button>
    </>
  );
});
