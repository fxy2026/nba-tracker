import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const config = { enabled: true, productionOrigin: "https://nba.xpy.me" };

async function fixture(fail = false) {
  vi.resetModules();
  const loaded = vi.fn();
  const runtime = vi.fn<(props: typeof config) => null>(() => null);
  vi.doMock("@/components/VisitorAnalyticsRuntime", () => {
    loaded();
    if (fail) throw new Error("Optional analytics chunk unavailable");
    return { default: runtime };
  });
  const { default: VisitorAnalytics } = await import("@/components/VisitorAnalytics");
  return { VisitorAnalytics, loaded, runtime };
}

afterEach(() => { vi.doUnmock("@/components/VisitorAnalyticsRuntime"); });

it("does not import the collector at all without the explicit server opt-in and origin", async () => {
  const { VisitorAnalytics, loaded, runtime } = await fixture();
  for (const props of [{}, { ...config, enabled: false }, { enabled: true }, { ...config, productionOrigin: null }, { ...config, productionOrigin: "" }]) {
    expect(renderToStaticMarkup(<VisitorAnalytics {...props} />)).toBe("");
  }
  await vi.dynamicImportSettled();
  expect(loaded).not.toHaveBeenCalled();
  expect(runtime).not.toHaveBeenCalled();
});

it("loads only when enabled, adds no UI, and forwards the exact config", async () => {
  const { VisitorAnalytics, loaded, runtime } = await fixture();
  expect(renderToStaticMarkup(<VisitorAnalytics {...config} />)).toBe("");
  await vi.dynamicImportSettled();
  expect(loaded).toHaveBeenCalledOnce();
  expect(renderToStaticMarkup(<VisitorAnalytics {...config} />)).toBe("");
  expect(runtime.mock.calls.at(-1)?.[0]).toEqual(config);
});

it("does not render a resolved runtime when opt-in is withdrawn during loading", async () => {
  const { VisitorAnalytics, loaded, runtime } = await fixture();
  expect(renderToStaticMarkup(<VisitorAnalytics {...config} />)).toBe("");
  const disabled = <VisitorAnalytics {...config} enabled={false} />;
  expect(renderToStaticMarkup(disabled)).toBe("");
  await vi.dynamicImportSettled();
  expect(loaded).toHaveBeenCalledOnce();
  runtime.mockClear();
  expect(renderToStaticMarkup(disabled)).toBe("");
  expect(runtime).not.toHaveBeenCalled();
});

it("fails closed without UI or a render error if the optional chunk cannot load", async () => {
  const { VisitorAnalytics, loaded, runtime } = await fixture(true);
  expect(renderToStaticMarkup(<VisitorAnalytics {...config} />)).toBe("");
  await vi.dynamicImportSettled();
  expect(renderToStaticMarkup(<VisitorAnalytics {...config} />)).toBe("");
  expect(loaded).toHaveBeenCalledOnce();
  expect(runtime).not.toHaveBeenCalled();
});
