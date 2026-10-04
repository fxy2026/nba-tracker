"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createBrowserPageviewAdapter, createPageviewCollector, type VisitorCollectorConfig } from "@/lib/visitor-analytics-client";

/** No UI or storage. The server must explicitly enable this production-only collector. */
export default function VisitorAnalytics({ enabled = false, productionOrigin = null }: VisitorCollectorConfig) {
  const pathname = usePathname();
  const collector = useRef<ReturnType<typeof createPageviewCollector> | null>(null);

  useEffect(() => {
    if (!enabled || !productionOrigin || pathname === null) return;
    collector.current ??= createPageviewCollector(createBrowserPageviewAdapter());
    const config = { enabled, productionOrigin };
    let stop = collector.current.observe(pathname, config);
    // A restored bfcache document is a new visible navigation without a React
    // render. Ordinary App Router Back/Forward updates usePathname above.
    const restored = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      stop();
      stop = collector.current!.observe(window.location.pathname, config, true);
    };
    window.addEventListener("pageshow", restored);
    return () => {
      stop();
      window.removeEventListener("pageshow", restored);
    };
  }, [enabled, productionOrigin, pathname]);

  return null;
}
