"use client";

import { useEffect } from "react";
import { recordVisit, type RecentKind } from "@/lib/recentlyViewed";

// Mount on detail pages to record a visit. No UI — just side effect on
// mount. Wrapped in useEffect so SSR doesn't touch localStorage.
export default function RecentVisitTracker({ kind, id, label }: {
  kind: RecentKind;
  id: string;
  label: string;
}) {
  useEffect(() => {
    recordVisit(kind, id, label);
  }, [kind, id, label]);
  return null;
}
