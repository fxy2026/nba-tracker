import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { getTranslations } from "@/locales";
const state = vi.hoisted(() => ({ locale: "en", age: vi.fn(() => 0) }));
vi.mock("@/lib/api", () => ({ getPlayerIndex: vi.fn(async () => []), getScheduleAge: state.age }));
vi.mock("@/lib/locale", () => ({ getLocale: async () => state.locale }));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: state.locale, t: getTranslations(state.locale as "en" | "zh") }) }));
import Draft from "@/app/draft/2026/page";
import Recap from "@/app/season/2025-26/page";
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
it.each(["en", "zh"])("draft and frozen recap omit unrelated warm schedule clock in %s", async locale => {
  state.locale = locale;
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ picks: [] }) })));
  for (const Page of [Draft, Recap]) {
    const html = renderToStaticMarkup(await Page());
    expect(html).not.toMatch(/Schedule cache loaded|赛程缓存载入于|刚刚更新|Just now|Data freshness/);
  }
  expect(state.age).not.toHaveBeenCalled();
  for (const path of ["src/app/draft/2026/page.tsx", "src/app/season/2025-26/page.tsx"]) {
    expect(readFileSync(path, "utf8")).not.toContain("getScheduleAge");
  }
});
