import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTranslations } from "@/locales";

type Effect = { dependencies?: readonly unknown[]; cleanup?: () => void };
const hooks = vi.hoisted(() => ({ cursor: 0, slots: [] as unknown[], effects: new Map<number, Effect>(), pending: [] as (() => void)[], writes: 0, locale: "en" as "en" | "zh" }));
const same = (left: readonly unknown[] | undefined, right: readonly unknown[] | undefined) => !!left && !!right && left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
vi.mock("react", async original => {
  const react = await original<typeof import("react")>();
  return { ...react,
    useState: <T,>(initial: T | (() => T)) => {
      const index = hooks.cursor++;
      if (!(index in hooks.slots)) hooks.slots[index] = typeof initial === "function" ? (initial as () => T)() : initial;
      return [hooks.slots[index] as T, (value: T | ((previous: T) => T)) => { hooks.writes++; hooks.slots[index] = typeof value === "function" ? (value as (previous: T) => T)(hooks.slots[index] as T) : value; }];
    },
    useRef: <T,>(initial: T) => { const index = hooks.cursor++; if (!(index in hooks.slots)) hooks.slots[index] = { current: initial }; return hooks.slots[index]; },
    useCallback: <T,>(callback: T, dependencies?: readonly unknown[]) => {
      const index = hooks.cursor++; const previous = hooks.slots[index] as { callback: T; dependencies?: readonly unknown[] } | undefined;
      if (!previous || !same(previous.dependencies, dependencies)) hooks.slots[index] = { callback, dependencies };
      return (hooks.slots[index] as { callback: T }).callback;
    },
    useEffect: (callback: () => void | (() => void), dependencies?: readonly unknown[]) => {
      const index = hooks.cursor++; const previous = hooks.effects.get(index);
      if (!previous || !same(previous.dependencies, dependencies)) hooks.pending.push(() => { previous?.cleanup?.(); hooks.effects.set(index, { dependencies, cleanup: callback() || undefined }); });
    },
  };
});
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: hooks.locale, t: getTranslations(hooks.locale) }) }));
import AdminPage from "../page";
import AnalyticsOverview, { AnalyticsContent } from "./AnalyticsOverview";
import type { VisitorAnalytics } from "./AnalyticsOverview";
import OperationsStatus from "./OperationsStatus";

function render(component: () => ReactNode) {
  hooks.cursor = 0; const tree = component(); const pending = hooks.pending.splice(0); pending.forEach(effect => effect()); return tree;
}
function unmount() { for (const effect of hooks.effects.values()) effect.cleanup?.(); hooks.effects.clear(); }
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as ReactElement<Record<string, unknown>>;
  return [element, ...elements(element.props.children as ReactNode)];
}
function find(tree: ReactNode, predicate: (element: ReactElement<Record<string, unknown>>) => boolean) {
  const result = elements(tree).find(predicate); if (!result) throw new Error("Element not found"); return result;
}
function hasText(node: ReactNode, text: string): boolean { if (typeof node === "string") return node.includes(text); if (Array.isArray(node)) return node.some(child => hasText(child, text)); if (node && typeof node === "object" && "props" in node) return hasText((node as ReactElement<{ children: ReactNode }>).props.children, text); return false; }
function click(element: ReactElement<Record<string, unknown>>) { (element.props.onClick as () => void)(); }
function change(element: ReactElement<Record<string, unknown>>, value: string) { (element.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } }); }
function submit(tree: ReactNode) { return (find(tree, node => node.type === "form").props.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({ preventDefault() {} }); }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function response(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status }); }
function report(days: 7 | 30): VisitorAnalytics { return { status: "unconfigured", timezone: "Asia/Shanghai", metric: "daily-browser", collectedSince: null, generatedAt: "2026-10-04T08:00:00Z", range: { days, from: days === 7 ? "2026-09-28" : "2026-09-05", to: "2026-10-04" }, today: null, period: null, series: null, pages: null, referrers: null, devices: null, limited: false }; }
async function flush() { for (let index = 0; index < 12; index++) await Promise.resolve(); }
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => { hooks.cursor = 0; hooks.slots = []; hooks.effects.clear(); hooks.pending = []; hooks.writes = 0; hooks.locale = "en"; fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { unmount(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("real admin component auth callbacks", () => {
  it("deduplicates repeated login, signs out with cleared credentials, and supports a fresh login", async () => {
    const pending = deferred<Response>(); fetchMock.mockReturnValueOnce(pending.promise);
    let tree = render(AdminPage); change(find(tree, node => node.props.id === "admin-password"), "test-only-password"); tree = render(AdminPage);
    const first = submit(tree); const repeated = submit(tree); expect(fetchMock).toHaveBeenCalledTimes(1);
    pending.resolve(response({ success: true })); await first; await repeated; tree = render(AdminPage);
    expect(elements(tree).some(node => node.type === AnalyticsOverview)).toBe(true);
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual(["/api/admin"]);
    click(find(tree, node => node.type === "button" && hasText(node, "Sign out")));
    tree = render(AdminPage); expect(find(tree, node => node.props.id === "admin-password").props.value).toBe("");
    fetchMock.mockResolvedValueOnce(response({ success: true })); change(find(tree, node => node.props.id === "admin-password"), "new-test-password"); await submit(render(AdminPage));
    expect(elements(render(AdminPage)).some(node => node.type === AnalyticsOverview)).toBe(true); expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("keeps HTTP-200 failed authentication on the login screen and exposes the error", async () => {
    fetchMock.mockResolvedValueOnce(response({ success: false })); let tree = render(AdminPage); change(find(tree, node => node.props.id === "admin-password"), "test"); await submit(render(AdminPage)); tree = render(AdminPage);
    expect(find(tree, node => node.props.id === "admin-auth-error").props.children).toMatch(/wasn't confirmed/); expect(elements(tree).some(node => node.type === AnalyticsOverview)).toBe(false);
  });
  it("aborts interrupted login and ignores a late success", async () => {
    const pending = deferred<Response>(); fetchMock.mockReturnValueOnce(pending.promise); let tree = render(AdminPage); change(find(tree, node => node.props.id === "admin-password"), "test"); tree = render(AdminPage); const login = submit(tree);
    const signal = fetchMock.mock.calls[0][1]?.signal; unmount(); const writes = hooks.writes; pending.resolve(response({ success: true })); await login;
    expect(signal?.aborted).toBe(true); expect(hooks.writes).toBe(writes); expect(elements(render(AdminPage)).some(node => node.type === AnalyticsOverview)).toBe(false);
  });
  it("shows the actual server failure and leaves another login possible", async () => {
    fetchMock.mockResolvedValueOnce(response({ error: "Admin not configured" }, 503)); let tree = render(AdminPage); change(find(tree, node => node.props.id === "admin-password"), "test"); await submit(render(AdminPage)); tree = render(AdminPage);
    expect(find(tree, node => node.props.id === "admin-auth-error").props.children).toBe("Admin not configured"); expect(find(tree, node => node.type === "button" && node.props.type === "submit").props.disabled).toBe(false);
  });
});

describe("real analytics component async flows", () => {
  it("keeps the newest range when the old request finishes later and repeated current-range clicks do nothing", async () => {
    const seven = deferred<Response>(); const thirty = deferred<Response>(); fetchMock.mockReturnValueOnce(seven.promise).mockReturnValueOnce(thirty.promise);
    const component = () => AnalyticsOverview({ password: "test", onUnauthorized: vi.fn() }); let tree = render(component);
    expect(fetchMock).toHaveBeenCalledTimes(1); click(find(tree, node => node.type === "button" && node.props.children === "30 days")); tree = render(component);
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true); expect(fetchMock).toHaveBeenCalledTimes(2);
    thirty.resolve(response(report(30))); await flush(); tree = render(component); expect((find(tree, node => node.type === AnalyticsContent).props.data as VisitorAnalytics).range.days).toBe(30);
    seven.resolve(response(report(7))); await flush(); tree = render(component); expect((find(tree, node => node.type === AnalyticsContent).props.data as VisitorAnalytics).range.days).toBe(30);
    click(find(tree, node => node.type === "button" && node.props.children === "30 days")); render(component); expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("ignores an old unauthorized response after unmount, as with logout or navigation", async () => {
    const pending = deferred<Response>(); const unauthorized = vi.fn(); fetchMock.mockReturnValueOnce(pending.promise); render(() => AnalyticsOverview({ password: "test", onUnauthorized: unauthorized }));
    unmount(); const writes = hooks.writes; pending.resolve(response({ error: "Unauthorized" }, 401)); await flush(); expect(unauthorized).not.toHaveBeenCalled(); expect(hooks.writes).toBe(writes);
  });
  it("asks for authentication only on a current unauthorized response", async () => {
    const unauthorized = vi.fn(); fetchMock.mockResolvedValueOnce(response({ error: "Unauthorized" }, 401)); render(() => AnalyticsOverview({ password: "test", onUnauthorized: unauthorized })); await flush(); expect(unauthorized).toHaveBeenCalledOnce();
  });
  it("preserves the backend unavailable DTO on HTTP 503 instead of treating it as an empty success", async () => {
    fetchMock.mockResolvedValueOnce(response({ ...report(7), status: "unavailable" }, 503)); const component = () => AnalyticsOverview({ password: "test", onUnauthorized: vi.fn() }); render(component); await flush(); const tree = render(component);
    expect((find(tree, node => node.type === AnalyticsContent).props.data as VisitorAnalytics).status).toBe("unavailable");
  });
  it("can retry a network failure without running provider-health requests", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(response(report(7))); const component = () => AnalyticsOverview({ password: "test", onUnauthorized: vi.fn() }); render(component); await flush(); let tree = render(component);
    click(find(tree, node => node.type === "button" && hasText(node, "Try again"))); render(component); await flush(); tree = render(component);
    expect(elements(tree).some(node => node.type === AnalyticsContent)).toBe(true); expect(fetchMock.mock.calls.map(call => call[0])).toEqual(["/api/admin/analytics?days=7", "/api/admin/analytics?days=7"]);
  });
});


describe("runtime-status request isolation", () => {
  it("makes one protected local-stats request and ignores a late result after logout", async () => {
    const pending = deferred<Response>(); fetchMock.mockReturnValueOnce(pending.promise); const unauthorized = vi.fn(); render(() => OperationsStatus({ password: "test", onUnauthorized: unauthorized }));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/stats"); expect(fetchMock.mock.calls[0][1]?.headers).toEqual({ "x-admin-password": "test" });
    unmount(); const writes = hooks.writes; pending.resolve(response({ error: "Unauthorized" }, 401)); await flush(); expect(unauthorized).not.toHaveBeenCalled(); expect(hooks.writes).toBe(writes);
  });
});


it("returns from a stalled login with an accessible timeout error and supports a successful retry", async () => {
  vi.useFakeTimers(); fetchMock.mockReturnValueOnce(new Promise(() => {})).mockResolvedValueOnce(response({ success: true }));
  let tree = render(AdminPage); change(find(tree, node => node.props.id === "admin-password"), "test"); const login = submit(render(AdminPage));
  await vi.advanceTimersByTimeAsync(8000); await login; tree = render(AdminPage);
  expect(find(tree, node => node.props.id === "admin-auth-error").props.children).toContain("timed out");
  expect(find(tree, node => node.type === "button" && node.props.type === "submit").props.disabled).toBe(false);
  await submit(tree); tree = render(AdminPage); expect(elements(tree).some(node => node.type === AnalyticsOverview)).toBe(true);
});
