"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";
import { canLoadVercelAnalytics, filterVercelAnalyticsEvent } from "@/lib/vercel-analytics";

const subscribe = () => () => {};
const serverSnapshot = () => false;

/** Mounted by the server layout only for Vercel production deployments. */
export default function VercelAnalytics() {
  // Recheck the mount guard on SPA navigation; beforeSend checks again per event.
  usePathname();
  const enabled = useSyncExternalStore(subscribe, canLoadVercelAnalytics, serverSnapshot);
  return enabled ? <Analytics mode="production" debug={false} beforeSend={filterVercelAnalyticsEvent} /> : null;
}
