import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import en from "@/locales/en";
import zh from "@/locales/zh";

const state = vi.hoisted(() => ({ locale: "en", result: {} as Record<string, unknown> }));
vi.mock("@/lib/usePlayerCareer", () => ({ usePlayerCareer: () => state.result }));
vi.mock("@/components/LocaleProvider", () => ({
  useLocale: () => ({ locale: state.locale, t: state.locale === "zh" ? zh : en }),
}));
vi.mock("@/components/player/PlayerRankBadges", () => ({ default: () => null }));
import PlayerStatsBundle from "@/components/player/PlayerStatsBundle";

const row = { SEASON_ID: "2024-25", TEAM_ABBREVIATION: "LAL", GP: 70, MIN: 30, PTS: 20, REB: 5, AST: 6, STL: 1, BLK: 0, FG_PCT: .5, FG3_PCT: null, FT_PCT: .8 };
it.each(["en", "zh"])("keeps opaque season and career labels but scrolls the full comparison label in %s", locale => {
  state.locale = locale;
  state.result = { data: { careerSeasons: [row, { ...row, SEASON_ID: "2025-26", PTS: 30 }] }, loading: false, error: false, stale: false, retry: vi.fn() };
  const html = renderToStaticMarkup(createElement(PlayerStatsBundle, { playerId: 2544, playerName: "LeBron James", teamTricode: "LAL" }));
  const cells = [...html.matchAll(/<(?:td|th)\b[^>]*career-table-sticky[^>]*>[\s\S]*?<\/(?:td|th)>/g)].map(match => match[0]);
  expect(cells).toHaveLength(4); // Header, two seasons and career only.
  expect(cells.every(cell => !/colSpan|colspan|bg-accent\/5|bg-bg-secondary\/50/.test(cell))).toBe(true);
  expect(cells.filter(cell => cell.includes("career-table-sticky-best"))).toHaveLength(1);
  expect(cells.filter(cell => cell.includes("career-table-sticky-total"))).toHaveLength(1);
  const comparison = html.match(/<td\b[^>]*colSpan="4"[^>]*>[\s\S]*?<\/td>/)?.[0];
  expect(comparison).toBeDefined();
  expect(comparison).not.toContain("sticky");
  expect(comparison).toContain(`2025-26 · ${locale === "zh" ? zh.playerStats.vsCareerAvg : en.playerStats.vsCareerAvg}`);
  expect(comparison).not.toMatch(/truncate|line-clamp|aria-hidden/);
  const rows = [...html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)].map(match => match[0]);
  expect(rows).toHaveLength(5);
  const career = rows[3];
  expect(career).toContain(">140</td>");
  expect(career).toContain(">25.0</td>");
  expect(rows[4]).toContain("+5.0");
});
it("uses opaque theme surfaces under layered sticky labels", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const rule = (selector: string) => css.match(new RegExp(`\\.${selector} \\{([^}]+)\\}`))?.[1];
  expect(rule("career-table-sticky")).toContain("position: sticky;");
  expect(rule("career-table-sticky")).toContain("z-index: 1;");
  expect(rule("career-table-sticky")).toContain("background-color: var(--bg-card);");
  expect(rule("career-table-sticky-best")).toContain("color-mix(in srgb, var(--accent) 5%, var(--bg-card))");
  expect(rule("career-table-sticky-total")).toContain("background-color: var(--bg-secondary);");
  for (const token of ["--bg-card", "--bg-secondary", "--accent"]) {
    const values = [...css.matchAll(new RegExp(`${token}: (#[a-fA-F0-9]{6});`, "g"))];
    expect(values.length).toBeGreaterThanOrEqual(2); // Opaque dark and light theme endpoints.
  }
});
