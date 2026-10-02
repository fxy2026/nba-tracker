import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CountUpNumber from "@/components/CountUpNumber";
afterEach(() => vi.unstubAllGlobals());
it.each([false, true])("matches SSR and first client render with reduced motion %s", reduced => {
  vi.stubGlobal("window", undefined);
  const props = { value: 10.1, decimals: 1, prefix: "+", suffix: " PPG", className: "score" };
  const server = renderToStaticMarkup(createElement(CountUpNumber, props));
  vi.stubGlobal("window", { matchMedia: () => ({ matches: reduced }) });
  const client = renderToStaticMarkup(createElement(CountUpNumber, props));
  expect(client).toBe(server); expect(client).toContain("+10.1 PPG");
});
it.each([0, -2, 100])("retains values, formatting and span semantics for %s", value => {
  const html = renderToStaticMarkup(createElement(CountUpNumber, { value, decimals: 1, stripTrailingZero: true }));
  expect(html).toBe(`<span class="">${value}</span>`);
});
