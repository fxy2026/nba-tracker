import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getTranslations } from "@/locales";
const runtime = vi.hoisted(() => ({ copied: false, locale: "en" as "en" | "zh", toast: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: () => [runtime.copied, (value: boolean) => { runtime.copied = value; }] }));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: runtime.locale, t: getTranslations(runtime.locale) }) }));
vi.mock("@/components/ToastProvider", () => ({ useToast: () => ({ toast: runtime.toast }) }));
import ExportStandings from "./ExportStandings";
const writeText = vi.fn();
const teams = (prefix: string) => Array.from({ length: 15 }, (_, i) => ({ tricode: `${prefix}${i + 1}`, wins: 60 - i, losses: 22 + i }));
function render(archive = true, season = "2025-26") {
  return ExportStandings({ east: teams("E"), west: teams("W"), season, archive }) as ReactElement<{ onClick: () => void }>;
}
async function click(archive = true, season = "2025-26") {
  render(archive, season).props.onClick(); await Promise.resolve(); await Promise.resolve();
}
beforeEach(() => {
  runtime.copied = false; runtime.locale = "en"; runtime.toast.mockReset(); writeText.mockReset().mockResolvedValue(undefined);
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));
  vi.stubGlobal("navigator", { clipboard: { writeText } });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it.each(["en", "zh"] as const)("copies only mock clipboard, requested archive year, exact top eight and scope/caveats in %s", async locale => {
  runtime.locale = locale; await click();
  expect(writeText).toHaveBeenCalledOnce(); const text = writeText.mock.calls[0][0] as string;
  expect(text).toContain("2025-26"); expect(text).not.toContain("2026-27");
  for (const prefix of ["E", "W"]) {
    for (let i = 1; i <= 8; i++) expect(text).toContain(`${i}. ${prefix}${i} ${61 - i}-${21 + i}`);
    for (let i = 9; i <= 15; i++) expect(text).not.toContain(`${prefix}${i} `);
  }
  expect(text.split("\n").filter(line => /^\s*\d+\./.test(line))).toHaveLength(16);
  expect(text).toMatch(locale === "en" ? /top.?8|top eight/i : /前\s*8/);
  expect(text).toMatch(locale === "en" ? /computed/i : /计算/);
  expect(text).toMatch(locale === "en" ? /local/i : /本地/);
  expect(text).toMatch(locale === "en" ? /not live/i : /非实时|不是实时/);
  expect(text).toMatch(locale === "en" ? /official.*tiebreak/i : /官方.*同胜率/);
  expect(runtime.toast).toHaveBeenCalledExactlyOnceWith(getTranslations(locale).export.copied);
  expect(renderToStaticMarkup(render())).toContain(getTranslations(locale).export.copied);
  vi.advanceTimersByTime(2000); expect(runtime.copied).toBe(false);
});
it("uses supplied current year rather than a frozen constant and omits archive provenance", async () => {
  await click(false, "2027-28"); const text = writeText.mock.calls[0][0] as string;
  expect(text).toContain("2027-28"); expect(text).not.toContain("2025-26"); expect(text).not.toMatch(/local.*recorded|archive/i);
});
it.each(["en", "zh"] as const)("warns on mock clipboard rejection without claiming success in %s", async locale => {
  runtime.locale = locale; writeText.mockRejectedValue(new Error("Permission denied")); await click();
  expect(writeText).toHaveBeenCalledOnce(); expect(runtime.copied).toBe(false);
  expect(runtime.toast).toHaveBeenCalledExactlyOnceWith(getTranslations(locale).export.clipboardError, "warning");
  expect(vi.getTimerCount()).toBe(0);
});
it("handles absent clipboard support without uncaught error or success feedback", async () => {
  vi.stubGlobal("navigator", {}); await click();
  expect(writeText).not.toHaveBeenCalled(); expect(runtime.copied).toBe(false);
  expect(runtime.toast).toHaveBeenCalledExactlyOnceWith(getTranslations("en").export.clipboardError, "warning");
});
it("handles a synchronously throwing clipboard mock without success feedback", async () => {
  writeText.mockImplementation(() => { throw new Error("Clipboard blocked"); }); await click();
  expect(writeText).toHaveBeenCalledOnce(); expect(runtime.copied).toBe(false);
  expect(runtime.toast).toHaveBeenCalledExactlyOnceWith(getTranslations("en").export.clipboardError, "warning");
});
