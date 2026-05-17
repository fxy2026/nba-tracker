"use client";

import { useEffect } from "react";

// Registers /sw.js on every page after first paint. No UI — side effect
// only. The SW handles offline caching; OnlineStatus banner handles UI.
// Disabled in dev (Next.js HMR conflicts with cached responses).
export default function SwRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    // Defer registration to idle so it doesn't compete with LCP work.
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
        // Common in private windows / disabled storage — silent fail is fine.
        console.warn("[sw] registration failed:", err);
      });
    };

    if ("requestIdleCallback" in window) {
      (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(register);
    } else {
      setTimeout(register, 2000);
    }
  }, []);

  return null;
}
