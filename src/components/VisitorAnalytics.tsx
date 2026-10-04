"use client";

import { lazy, Suspense } from "react";
import type { VisitorCollectorConfig } from "@/lib/visitor-analytics-client";

// Keep the collector and finite route allowlist out of the shared layout chunk.
// Analytics is best effort: a missing optional chunk must not break the page.
const Runtime = lazy(() => import("./VisitorAnalyticsRuntime").catch(() => ({ default: () => null })));

/** No UI or storage. The server must explicitly enable this production-only collector. */
export default function VisitorAnalytics({ enabled = false, productionOrigin = null }: VisitorCollectorConfig) {
  if (!enabled || !productionOrigin) return null;
  return <Suspense fallback={null}><Runtime enabled={enabled} productionOrigin={productionOrigin} /></Suspense>;
}
