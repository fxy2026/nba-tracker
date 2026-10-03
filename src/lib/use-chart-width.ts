"use client";

import { useEffect, useState } from "react";

// Observe the rendered SVG, including when an empty chart becomes available.
// On narrow cards SVG units equal CSS pixels; wider cards retain their original
// desktop geometry. Callback refs also detach correctly on conditional unmount.
export function useChartWidth(desktopWidth: number) {
  const [element, ref] = useState<SVGSVGElement | null>(null);
  const [width, setWidth] = useState(desktopWidth);
  useEffect(() => {
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(entries => {
      const next = entries[0]?.contentRect.width;
      if (next && Number.isFinite(next) && next > 0) setWidth(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return { ref, width, mobile: width < 480 };
}
