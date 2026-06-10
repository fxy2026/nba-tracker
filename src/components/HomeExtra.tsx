"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ScheduleGame } from "@/lib/api";
import RecentHighlights from "./RecentHighlights";

const BracketPlaceholder = () => <div className="skeleton-shimmer rounded-xl" style={{ minHeight: 400 }} />;
const BracketTree = dynamic(() => import("./BracketTree"), { loading: BracketPlaceholder });

/**
 * Perf rebuild:
 *  - Doesn't fetch /api/extra until the placeholder is intersection-visible.
 *  - BracketTree (the heaviest client component on the home page — 100+ DOM
 *    nodes + SVG connectors + projection cascade) is a dynamic() import, so
 *    its bytes stay out of the initial home chunk and only download once
 *    playoff data actually renders it.
 *  - Once data lands the section is content-visibility:auto so the browser
 *    can still skip layout/paint when off-screen.
 */
export default function HomeExtra() {
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState<{ playoffs: ScheduleGame[]; recent: ScheduleGame[] } | null>(null);
  const [error, setError] = useState(false);
  const placeholderRef = useRef<HTMLDivElement>(null);

  // Wait until the placeholder is near the viewport before mounting anything.
  useEffect(() => {
    const el = placeholderRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      // Fallback: still trigger via idle callback so initial paint is unblocked
      const id = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(id);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px 0px 400px 0px" } // start loading 400px before entering viewport
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Fetch only after visible.
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    fetch("/api/extra", { signal: controller.signal })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (!controller.signal.aborted && d) setData(d); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setData((prev) => prev ?? { playoffs: [], recent: [] }); });
    return () => controller.abort();
  }, [visible]);

  if (error) return null;

  // Placeholder until visible — reserves space so the home page doesn't jump
  // when content loads, and gives IntersectionObserver something to watch.
  if (!visible || !data) {
    return (
      <div ref={placeholderRef} className="mt-10 space-y-6" style={{ minHeight: 400 }}>
        {visible && (
          <>
            <div className="h-5 w-32 skeleton-shimmer rounded mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="h-24 skeleton-shimmer rounded-xl" />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  if (data.playoffs.length === 0 && data.recent.length === 0) return null;

  return (
    <div className="mt-10 space-y-10" style={{ contentVisibility: "auto", containIntrinsicSize: "auto 400px" }}>
      {data.playoffs.length > 0 && <BracketTree games={data.playoffs} />}
      {data.recent.length > 0 && <RecentHighlights games={data.recent} />}
    </div>
  );
}
