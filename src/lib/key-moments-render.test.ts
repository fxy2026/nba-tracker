import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { getTranslations } from "@/locales";
import KeyMoments from "@/components/KeyMoments";
import type { PlayAction } from "@/components/PlayByPlay";
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: "en", t: getTranslations("en") }) }));
const row = (scoreHome: string, scoreAway: string, actionNumber: number, clock: string): PlayAction => ({ scoreHome, scoreAway, actionNumber, clock, period: 1, teamTricode: "DET", actionType: "2pt", shotResult: "Made", subType: "", description: "", personId: 1, playerNameI: "A. Player", isFieldGoal: 1 });
const run = [row("0", "0", 1, "12:00"), row("2", "0", 2, "11:00"), row("4", "0", 3, "10:00"), row("6", "0", 4, "9:00"), row("8", "0", 5, "8:00")];
it("renders the verified8-0 run rather than the old inflated12-0", () => {
  const html = renderToStaticMarkup(createElement(KeyMoments, { actions: run }));
  expect(html).toContain("DET goes on a 8-0 run");
  expect(html).not.toContain("12-0 run");
  expect(html).toContain("0-8");
});
it("does not fabricate a lead change across a missing score or unexplained score jump", () => {
  const unknown = row("", "", 6, "7:00");
  const later = row("8", "20", 7, "6:00");
  expect(renderToStaticMarkup(createElement(KeyMoments, { actions: [...run, unknown, later] }))).not.toContain("Lead change!");
  expect(renderToStaticMarkup(createElement(KeyMoments, { actions: [...run, later] }))).not.toContain("Lead change!");
});
it("rejects one-sided missing scores without showing a fictional20-0", () => {
  const html = renderToStaticMarkup(createElement(KeyMoments, { actions: [row("20", "", 1, "1:00")] }));
  expect(html).toBe("");
});
