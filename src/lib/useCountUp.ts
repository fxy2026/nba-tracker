"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Render the same target on the server and first client render, then animate
 * from the displayed value on subsequent target changes (great for live scores).
 * Respects `prefers-reduced-motion`.
 */
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(target);
  const rafRef = useRef<number | undefined>(undefined);
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const from = valueRef.current;
    if (Object.is(from, target)) return;
    if (reduced || !Number.isFinite(durationMs) || durationMs <= 0 || !Number.isFinite(target) || !Number.isFinite(from)) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let cancelled = false;
    const step = (now: number) => {
      if (cancelled) return;
      const elapsed = now - start;
      const t = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      cancelled = true;
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return value;
}
