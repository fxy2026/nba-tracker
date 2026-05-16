"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animate a number toward `target`. Starts from 0 on mount, then animates
 * from previous value on subsequent target changes (great for live scores).
 * Respects `prefers-reduced-motion`.
 */
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") return target;
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? target : 0;
  });
  const rafRef = useRef<number | undefined>(undefined);
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !isFinite(target)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(target);
      return;
    }
    const start = performance.now();
    const from = valueRef.current;
    const step = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return value;
}
