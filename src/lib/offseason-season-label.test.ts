import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const state = vi.hoisted(() => ({ locale: "en" }));
vi.mock("@/lib/locale", () => ({ getLocale: async () => state.locale }));
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it.each([
  ["2026-09-30T12:00:00Z", "en", "Champions"],
  ["2026-10-02T12:00:00Z", "en", "Champions"],
  ["2026-10-02T12:00:00Z", "zh", "总冠军"],
])("keeps archive label and recap link aligned after season rollover %s", async (now, locale, label) => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date(now)); state.locale = locale;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
  const { SEASON_SNAPSHOT } = await import("./season-snapshot");
  const { default: Hero } = await import("@/components/OffseasonHero");
  const html = renderToStaticMarkup(await Hero());
  const plain = html.replace(/<[^>]+>/g, "");
  expect(plain).toContain(`${SEASON_SNAPSHOT.season} ${label}`);
  expect(plain).not.toContain(`2026-27 ${label}`);
  expect(html.match(/href="\/season\/2025-26"/g)).toHaveLength(2);
});
