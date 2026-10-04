import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Locale, Translations } from "@/locales/types";
import { getTranslations } from "@/locales";

// Execute real provider effects and toggle handlers with deterministic hooks.
// Browser storage, cookies, and router operations are mocks; no browser or network is used.
const runtime = vi.hoisted(() => ({
  effects: [] as (() => void)[], context: undefined as unknown, refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: runtime.refresh }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: cookie.split(";")[0]?.split("=")[1] }) }) }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useEffect: (effect: () => void) => { runtime.effects.push(effect); },
  useMemo: (create: () => unknown) => create(),
  useCallback: (callback: unknown) => callback,
  useContext: () => runtime.context,
}));
import { LocaleProvider } from "./LocaleProvider";
import LocaleToggle from "./LocaleToggle";
import { getLocale } from "@/lib/locale";

type Value = { locale: Locale; t: Translations; setLocale: (next: Locale, refreshRoute?: () => void) => void };
const storage = { getItem: vi.fn(), setItem: vi.fn() };
const reload = vi.fn();
const location = { pathname: "/", reload };
const cookieWrite = vi.fn();
let cookie: string;
function render(initialLocale: Locale) {
  const tree = LocaleProvider({ initialLocale, children: null }) as ReactElement<{ value: Value }>;
  runtime.context = tree.props.value;
  return tree.props.value;
}
function flushEffects() { runtime.effects.splice(0).forEach(effect => effect()); }
function toggle() {
  const button = LocaleToggle();
  button.props.onClick();
}
beforeEach(() => {
  runtime.effects = []; runtime.context = undefined; cookie = "";
  storage.getItem.mockReset().mockReturnValue(null); storage.setItem.mockReset();
  reload.mockReset(); cookieWrite.mockReset(); runtime.refresh.mockReset(); location.pathname = "/";
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", { location });
  vi.stubGlobal("document", {
    get cookie() { return cookie; },
    set cookie(value: string) { cookie = value; cookieWrite(value); },
  });
});
afterEach(() => { vi.unstubAllGlobals(); });

for (const locale of ["en", "zh"] as const) {
  const next = locale === "en" ? "zh" : "en";
  describe(`cookie-backed ${locale} locale`, () => {
    it.each([next, "invalid", null])("keeps SSR and hydrated UI consistent with stored %s", stored => {
      storage.getItem.mockReturnValue(stored);
      expect(render(locale).locale).toBe(locale);
      flushEffects();
      expect(render(locale)).toMatchObject({ locale, t: getTranslations(locale) });
      expect(storage.setItem).toHaveBeenCalledWith("locale", locale);
      expect(reload).not.toHaveBeenCalled(); expect(cookieWrite).not.toHaveBeenCalled();
    });
    it("does not rewrite an already synchronized mirror", () => {
      storage.getItem.mockReturnValue(locale);
      render(locale); flushEffects();
      expect(storage.setItem).not.toHaveBeenCalled();
    });
    it.each(["read", "write", "access"])("tolerates storage %s failure at hydration and toggle", failure => {
      const error = new DOMException("Storage unavailable", "SecurityError");
      if (failure === "read") storage.getItem.mockImplementation(() => { throw error; });
      if (failure === "write") storage.setItem.mockImplementation(() => { throw error; });
      if (failure === "access") {
        Object.defineProperty(globalThis, "localStorage", { configurable: true, get: () => { throw error; } });
      }
      render(locale);
      expect(flushEffects).not.toThrow();
      expect(render(locale).locale).toBe(locale);
      expect(toggle).not.toThrow();
      expect(cookie).toBe(`locale=${next};path=/;max-age=31536000;SameSite=Lax`);
      expect(reload).toHaveBeenCalledTimes(1);
      expect(cookieWrite.mock.invocationCallOrder[0]).toBeLessThan(reload.mock.invocationCallOrder[0]);
      // An intentionally pending reload must not flip only the client UI.
      expect(render(locale).locale).toBe(locale);
      expect(render(next)).toMatchObject({ locale: next, t: getTranslations(next) });
      flushEffects();
      expect(reload).toHaveBeenCalledTimes(1);
    });
    it("toggles via the real control and keeps pending/repeated clicks on the same target", () => {
      render(locale); flushEffects(); storage.setItem.mockClear();
      toggle();
      expect(storage.setItem).toHaveBeenCalledExactlyOnceWith("locale", next);
      expect(cookieWrite.mock.invocationCallOrder[0]).toBeLessThan(storage.setItem.mock.invocationCallOrder[0]);
      expect(storage.setItem.mock.invocationCallOrder[0]).toBeLessThan(reload.mock.invocationCallOrder[0]);
      render(locale); toggle();
      expect(cookieWrite).toHaveBeenNthCalledWith(2, `locale=${next};path=/;max-age=31536000;SameSite=Lax`);
      expect(reload).toHaveBeenCalledTimes(2); // One explicit reload per click, never an effect loop.
      expect(render(next).locale).toBe(next); flushEffects();
      expect(reload).toHaveBeenCalledTimes(2);
    });
  });
}

describe("admin-only locale refresh", () => {
  it.each(["en", "zh"] as const)("preserves the public privacy fragment through repeated %s locale switches", async locale => {
    const privacyLocation = Object.assign(new URL("https://nba.example/about#visitor-statistics"), { reload });
    vi.stubGlobal("window", { location: privacyLocation });
    let currentLocale = locale;
    for (let click = 0; click < 3; click++) {
      render(currentLocale);
      toggle();
      expect(privacyLocation.href).toBe("https://nba.example/about#visitor-statistics");
      expect(reload).toHaveBeenCalledTimes(click + 1);
      expect(runtime.refresh).not.toHaveBeenCalled();
      currentLocale = currentLocale === "en" ? "zh" : "en";
      expect(await getLocale()).toBe(currentLocale);
    }
  });

  it.each(["/admin", "/admin/", "/admin/operations"])("refreshes %s after writing only the existing locale preference", pathname => {
    location.pathname = pathname;
    render("zh"); flushEffects(); storage.setItem.mockClear();
    toggle();
    expect(cookieWrite).toHaveBeenCalledExactlyOnceWith("locale=en;path=/;max-age=31536000;SameSite=Lax");
    expect(storage.setItem).toHaveBeenCalledExactlyOnceWith("locale", "en");
    expect(runtime.refresh).toHaveBeenCalledExactlyOnceWith();
    expect(cookieWrite.mock.invocationCallOrder[0]).toBeLessThan(storage.setItem.mock.invocationCallOrder[0]);
    expect(storage.setItem.mock.invocationCallOrder[0]).toBeLessThan(runtime.refresh.mock.invocationCallOrder[0]);
    expect(reload).not.toHaveBeenCalled();
  });

  it.each(["/", "/news", "/administrator", "/admin-tools", "/team/admin", "/ADMIN"])("keeps document reload on public route %s", pathname => {
    location.pathname = pathname;
    render("zh"); toggle();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(runtime.refresh).not.toHaveBeenCalled();
  });

  it("retains the reload fallback for a caller without a route refresh callback", () => {
    location.pathname = "/admin";
    render("zh").setLocale("en");
    expect(cookie).toBe("locale=en;path=/;max-age=31536000;SameSite=Lax");
    expect(reload).toHaveBeenCalledTimes(1);
    expect(runtime.refresh).not.toHaveBeenCalled();
  });

  it.each(["zh", "en"] as const)("keeps pending and repeated %s switches consistent until the server locale arrives", async locale => {
    location.pathname = "/admin";
    const next = locale === "zh" ? "en" : "zh";
    render(locale); flushEffects();
    toggle();
    // No optimistic dictionary or document reload while a refresh is pending.
    expect(render(locale)).toMatchObject({ locale, t: getTranslations(locale) });
    toggle();
    expect(cookieWrite.mock.calls).toEqual([
      [`locale=${next};path=/;max-age=31536000;SameSite=Lax`],
      [`locale=${next};path=/;max-age=31536000;SameSite=Lax`],
    ]);
    expect(runtime.refresh).toHaveBeenCalledTimes(2);
    const serverLocale = await getLocale();
    expect(serverLocale).toBe(next);
    const value = render(serverLocale); flushEffects();
    expect(value.t.admin.login).toBe(getTranslations(serverLocale).admin.login);
    expect(LocaleToggle().props["aria-label"]).toBe(next === "en" ? value.t.locale.switchToChinese : value.t.locale.switchToEnglish);
    toggle();
    expect(await getLocale()).toBe(locale);
    expect(render(await getLocale())).toMatchObject({ locale, t: getTranslations(locale) });
    expect(runtime.refresh).toHaveBeenCalledTimes(3);
    expect(reload).not.toHaveBeenCalled();
  });

  it("uses the current route after an interrupted refresh and Back/Forward, without queued retries", () => {
    location.pathname = "/admin";
    const { setLocale } = render("zh"); flushEffects();
    setLocale("en", runtime.refresh); // Leave this request unresolved, as when navigation interrupts it.
    location.pathname = "/news";
    setLocale("zh", runtime.refresh);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(runtime.refresh).toHaveBeenCalledTimes(1);
    location.pathname = "/admin"; // Browser Back: same stable provider callback.
    setLocale("en", runtime.refresh);
    expect(runtime.refresh).toHaveBeenCalledTimes(2);
    location.pathname = "/news"; // Browser Forward does not trigger an effect retry.
    flushEffects();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(runtime.refresh).toHaveBeenCalledTimes(2);
  });

  it.each(["read", "write", "access"])("still refreshes admin when locale storage %s is blocked", failure => {
    location.pathname = "/admin";
    const error = new DOMException("Storage unavailable", "SecurityError");
    if (failure === "read") storage.getItem.mockImplementation(() => { throw error; });
    if (failure === "write") storage.setItem.mockImplementation(() => { throw error; });
    if (failure === "access") Object.defineProperty(globalThis, "localStorage", { configurable: true, get: () => { throw error; } });
    render("zh");
    expect(flushEffects).not.toThrow(); expect(toggle).not.toThrow();
    expect(cookie).toBe("locale=en;path=/;max-age=31536000;SameSite=Lax");
    expect(runtime.refresh).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });
});
