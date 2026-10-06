import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { nextLocalMidnight, observeLocalDay } from "./local-day-clock";

const runtime = vi.hoisted(() => ({ zone: "Asia/Shanghai" }));
vi.mock("./timezone", async original => ({ ...await original<typeof import("./timezone")>(), localTz: () => runtime.zone }));

it.each([
  ["Asia/Shanghai", "2025-12-25T15:59:59Z", "2025-12-25T16:00:00Z"],
  ["Asia/Shanghai", "2025-12-25T16:00:00Z", "2025-12-26T16:00:00Z"],
  ["America/New_York", "2026-03-08T05:00:00Z", "2026-03-09T04:00:00Z"],
  ["America/New_York", "2026-11-01T04:00:00Z", "2026-11-02T05:00:00Z"],
  ["America/New_York", "2026-03-08T06:59:59Z", "2026-03-09T04:00:00Z"],
  ["America/New_York", "2026-11-01T05:59:59Z", "2026-11-02T05:00:00Z"],
  ["Australia/Lord_Howe", "2026-10-03T13:30:00Z", "2026-10-04T13:00:00Z"],
  ["America/Sao_Paulo", "2018-11-03T23:30:00Z", "2018-11-04T03:00:00Z"],
  ["Pacific/Apia", "2011-12-30T09:59:59Z", "2011-12-30T10:00:00Z"],
  ["Pacific/Kiritimati", "2026-12-31T09:59:59Z", "2026-12-31T10:00:00Z"],
  ["Asia/Kathmandu", "2026-10-06T18:14:59Z", "2026-10-06T18:15:00Z"],
])("finds the next actual local boundary in %s at %s", (zone, now, expected) => {
  expect(nextLocalMidnight(new Date(now), zone)).toBe(Date.parse(expected));
});

let browser: EventTarget, page: EventTarget & { visibilityState: string };
let stop: (() => void) | undefined;
beforeEach(() => {
  runtime.zone = "Asia/Shanghai";
  vi.useFakeTimers(); vi.setSystemTime(new Date("2025-12-25T15:59:59Z"));
  browser = new EventTarget(); page = Object.assign(new EventTarget(), { visibilityState: "visible" });
  vi.stubGlobal("window", browser); vi.stubGlobal("document", page);
});
afterEach(() => { stop?.(); stop = undefined; vi.unstubAllGlobals(); vi.useRealTimers(); });

it("keeps one midnight timer, with no per-second polling, and cleans up listeners", () => {
  const change = vi.fn(); stop = observeLocalDay(undefined, change);
  expect(change).toHaveBeenLastCalledWith({ date: "2025-12-25", timeZone: "Asia/Shanghai" });
  expect(vi.getTimerCount()).toBe(1);
  vi.advanceTimersByTime(999); expect(change).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1); expect(change).toHaveBeenLastCalledWith({ date: "2025-12-26", timeZone: "Asia/Shanghai" });
  vi.advanceTimersByTime(12 * 60 * 60 * 1000); expect(change).toHaveBeenCalledTimes(2);
  stop(); expect(vi.getTimerCount()).toBe(0);
  page.dispatchEvent(new Event("visibilitychange"));
  for (const event of ["pageshow", "focus", "online"]) browser.dispatchEvent(new Event(event));
  expect(change).toHaveBeenCalledTimes(2);
});

it.each(["visibilitychange", "pageshow", "focus", "online"])("catches up after a suspended mobile tab via %s and replaces its timer", event => {
  const change = vi.fn(); stop = observeLocalDay(undefined, change);
  page.visibilityState = "hidden";
  vi.setSystemTime(new Date("2025-12-28T03:00:00Z"));
  page.dispatchEvent(new Event("visibilitychange")); expect(change).toHaveBeenCalledTimes(1);
  page.visibilityState = "visible";
  (event === "visibilitychange" ? page : browser).dispatchEvent(new Event(event));
  expect(change).toHaveBeenLastCalledWith({ date: "2025-12-28", timeZone: "Asia/Shanghai" });
  expect(vi.getTimerCount()).toBe(1);
  vi.advanceTimersByTime(13 * 60 * 60 * 1000);
  expect(change).toHaveBeenLastCalledWith({ date: "2025-12-29", timeZone: "Asia/Shanghai" });
});

it.each([undefined, "America/New_York"])("re-resolves the browser zone on wake while preserving explicit zone %s", zone => {
  const change = vi.fn(); stop = observeLocalDay(zone, change);
  runtime.zone = "Pacific/Kiritimati";
  browser.dispatchEvent(new Event("focus"));
  expect(change).toHaveBeenLastCalledWith(zone
    ? { date: "2025-12-25", timeZone: zone }
    : { date: "2025-12-26", timeZone: runtime.zone });
  expect(vi.getTimerCount()).toBe(1);
});

it("leaves one active timer/subscription after React's setup-cleanup-setup cycle", () => {
  const change = vi.fn();
  observeLocalDay(undefined, change)();
  stop = observeLocalDay(undefined, change);
  expect(vi.getTimerCount()).toBe(1);
  vi.advanceTimersByTime(1000); expect(change).toHaveBeenCalledTimes(3);
  browser.dispatchEvent(new Event("pageshow")); expect(change).toHaveBeenCalledTimes(4);
});
