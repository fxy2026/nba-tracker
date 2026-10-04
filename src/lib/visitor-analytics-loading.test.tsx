import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import VisitorAnalytics from "@/components/VisitorAnalytics";

it("never loads the retired collector, even with previously valid production configuration", async () => {
  const loaded = vi.fn();
  vi.doMock("@/components/VisitorAnalyticsRuntime", () => { loaded(); return { default: () => null }; });
  for (const props of [{}, { enabled: true, productionOrigin: "https://nba.xpy.me" }, { enabled: false }]) {
    expect(renderToStaticMarkup(<VisitorAnalytics {...props} />)).toBe("");
  }
  await vi.dynamicImportSettled();
  expect(loaded).not.toHaveBeenCalled();
  vi.doUnmock("@/components/VisitorAnalyticsRuntime");
});
