"use client";

import { useEffect, useState, memo } from "react";
import { ChevronUp } from "lucide-react";

export default memo(function BackToTop() {
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
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Keep button mounted; toggle visibility via class so React doesn't churn the DOM
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed bottom-20 sm:bottom-8 right-4 z-40 w-11 h-11 rounded-full bg-accent-gradient text-white shadow-xl shadow-accent/30 ring-1 ring-white/20 flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer ${
        visible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none translate-y-2"
      }`}
      aria-label="Back to top"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      title="Back to top (press T)"
    >
      <ChevronUp size={20} strokeWidth={2.5} />
    </button>
  );
});
