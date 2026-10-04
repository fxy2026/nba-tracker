import { afterEach, expect, it, vi } from "vitest";
import { Analytics } from "@vercel/analytics/next";
import { filterVercelAnalyticsEvent } from "@/lib/vercel-analytics";
const state = vi.hoisted(() => ({ enabled: false, pathname: vi.fn() }));
vi.mock("react", async importOriginal => ({ ...await importOriginal<typeof import("react")>(), useSyncExternalStore: () => state.enabled }));
vi.mock("next/navigation", () => ({ usePathname: state.pathname }));
vi.mock("@vercel/analytics/next", () => ({ Analytics: () => null }));
import VercelAnalytics from "./VercelAnalytics";
afterEach(() => { state.enabled = false; state.pathname.mockClear(); });
it("does not mount the provider when the client privacy/public-route guard fails", () => {
  expect(VercelAnalytics()).toBeNull();
  expect(state.pathname).toHaveBeenCalledOnce();
});
it("uses the official Next component with a stable privacy callback and production mode", () => {
  state.enabled = true;
  const result = VercelAnalytics();
  expect(result?.type).toBe(Analytics);
  expect(result?.props).toEqual({ mode: "production", debug: false, beforeSend: filterVercelAnalyticsEvent });
  state.enabled = false;
  expect(VercelAnalytics()).toBeNull();
});
