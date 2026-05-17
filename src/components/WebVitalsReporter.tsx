"use client";

import { useReportWebVitals } from "next/web-vitals";

// Core Web Vitals + Next.js perf metrics emitted to:
//   1. console.log (always, dev + prod) — so anyone with devtools open can
//      see real numbers from their own session.
//   2. localStorage rolling buffer — last 50 metrics kept under
//      `nba-tracker-vitals` for ad-hoc inspection.
//
// No backend call yet; we don't want to ship analytics-PII overhead. If a
// dashboard endpoint shows up later, this is the single place to plug it.
const STORAGE_KEY = "nba-tracker-vitals";
const MAX_ENTRIES = 50;

interface VitalEntry {
  name: string;
  value: number;
  rating?: string;
  id: string;
  delta: number;
  ts: number;
  path: string;
}

function persist(entry: VitalEntry) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr: VitalEntry[] = raw ? JSON.parse(raw) : [];
    arr.unshift(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(0, MAX_ENTRIES)));
  } catch { /* quota / disabled — ignore */ }
}

// Pretty-format the value: ms for timing metrics, raw for layout shift.
function fmt(name: string, value: number): string {
  if (name === "CLS") return value.toFixed(3);
  return `${Math.round(value)}ms`;
}

// Color-code by browser-supplied rating ("good" / "needs-improvement" / "poor")
function ratingColor(rating?: string): string {
  if (rating === "good") return "color: #22C55E; font-weight: bold;";
  if (rating === "needs-improvement") return "color: #F59E0B; font-weight: bold;";
  if (rating === "poor") return "color: #EF4444; font-weight: bold;";
  return "color: #94A3B8;";
}

export default function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    const entry: VitalEntry = {
      name: metric.name,
      value: metric.value,
      rating: (metric as { rating?: string }).rating,
      id: metric.id,
      delta: metric.delta,
      ts: Date.now(),
      path: typeof window !== "undefined" ? window.location.pathname : "",
    };

    persist(entry);

    // Devtools-friendly log line. Filter by typing "vitals" in console filter.
    // Format: [vitals] LCP 1234ms good  /standings
    if (typeof console !== "undefined") {
      console.log(
        `%c[vitals] %c${entry.name} ${fmt(entry.name, entry.value)} %c${entry.rating ?? ""}%c  ${entry.path}`,
        "color: #3B82F6;",
        "color: #FFFFFF; font-weight: bold;",
        ratingColor(entry.rating),
        "color: #94A3B8;"
      );
    }
  });

  return null;
}
