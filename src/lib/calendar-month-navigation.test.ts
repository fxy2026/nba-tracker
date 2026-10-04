import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, it, vi } from "vitest";
import { calendarMonthHref, offsetCalendarMonth, selectedCalendarMonth } from "./calendar-month-navigation";

it.each(["2026-11", "2024-02", "1000-01", "9999-12"])("selects one valid month %s", month => {
  expect(selectedCalendarMonth(new URLSearchParams({ month }), "2026-10")).toBe(month);
});
it.each(["", "month=", "month=2026-1", "month=2026-13", "month=0000-01", "month=2026-11&month=2026-12", "month=2026-11&month=2026-11", "month=javascript%3Aalert(1)"])("rejects ambiguous or invalid month query %s", query => {
  expect(selectedCalendarMonth(new URLSearchParams(query), "2026-10")).toBe("2026-10");
});
it("moves in both directions across year boundaries without date or DST arithmetic", () => {
  expect(offsetCalendarMonth("2026-12", 1)).toBe("2027-01");
  expect(offsetCalendarMonth("2026-01", -1)).toBe("2025-12");
  expect(offsetCalendarMonth("2024-03", -1)).toBe("2024-02");
  expect(offsetCalendarMonth("2026-03", 3)).toBe("2026-06");
  expect(offsetCalendarMonth("9999-12", 1)).toBeNull();
  expect(offsetCalendarMonth("1000-01", -1)).toBeNull();
  expect(offsetCalendarMonth("2026-13", 1)).toBeNull();
  expect(offsetCalendarMonth("2026-11", 0.5)).toBeNull();
});
it("changes only month while preserving path, duplicate unrelated query values, timezone and hash", () => {
  const location = new URL("https://example.test/calendar?locale=zh&tz=Asia%2FShanghai&tag=a&month=bad&tag=b&month=2026-10#schedule");
  expect(calendarMonthHref(location, "2026-11")).toBe("/calendar?locale=zh&tz=Asia%2FShanghai&tag=a&month=2026-11&tag=b#schedule");
  expect(calendarMonthHref(location, "javascript:alert(1)")).toBeNull();
});

it("installed Next native replacement preserves router state and updates its canonical URL with null state", () => {
  // Execute the installed framework's small documented history adapter, not a
  // permissive mock that would miss the __NA early-return/canonical-URL trap.
  const require = createRequire(import.meta.url);
  const source = readFileSync(require.resolve("next/dist/client/components/app-router.js"), "utf8");
  const copyStart = source.indexOf("function copyNextJsInternalHistoryState(data)");
  const copyEnd = source.indexOf("\nfunction Head(", copyStart);
  const replaceStart = source.indexOf("window.history.replaceState = function replaceState(");
  const replaceEnd = source.indexOf("\n        /**", replaceStart);
  expect(copyStart).toBeGreaterThan(-1); expect(copyEnd).toBeGreaterThan(copyStart);
  expect(replaceStart).toBeGreaterThan(-1); expect(replaceEnd).toBeGreaterThan(replaceStart);
  const tree = { calendar: true };
  const window = { history: { state: { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: tree }, replaceState: vi.fn<(data: unknown, unused: string, url: string) => void>() } };
  const nativeReplace = vi.fn();
  const restoreCanonicalUrl = vi.fn();
  const install = new Function("window", "originalReplaceState", "applyUrlFromHistoryPushReplace", `${source.slice(copyStart, copyEnd)}\n${source.slice(replaceStart, replaceEnd)}`);
  install(window, nativeReplace, restoreCanonicalUrl);
  window.history.replaceState(null, "", "/calendar?month=2026-11");
  expect(restoreCanonicalUrl).toHaveBeenCalledExactlyOnceWith("/calendar?month=2026-11");
  expect(nativeReplace).toHaveBeenCalledExactlyOnceWith({ __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: tree }, "", "/calendar?month=2026-11");
  restoreCanonicalUrl.mockClear();
  window.history.replaceState(window.history.state, "", "/calendar?month=2026-12");
  expect(restoreCanonicalUrl).not.toHaveBeenCalled(); // copying state would break the fix
});
