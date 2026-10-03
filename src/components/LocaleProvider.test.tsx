import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Locale, Translations } from "@/locales/types";
import { getTranslations } from "@/locales";

// Execute real provider effects and toggle handlers with deterministic hooks.
// Browser storage, cookies, and reload are mocks; no browser or network is used.
const runtime = vi.hoisted(() => ({
  effects: [] as (() => void)[], context: undefined as unknown,
}));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useEffect: (effect: () => void) => { runtime.effects.push(effect); },
  useMemo: (create: () => unknown) => create(),
  useCallback: (callback: unknown) => callback,
  useContext: () => runtime.context,
}));
import { LocaleProvider } from "./LocaleProvider";
import LocaleToggle from "./LocaleToggle";

type Value = { locale: Locale; t: Translations; setLocale: (next: Locale) => void };
const storage = { getItem: vi.fn(), setItem: vi.fn() };
const reload = vi.fn();
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
  reload.mockReset(); cookieWrite.mockReset();
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", { location: { reload } });
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
