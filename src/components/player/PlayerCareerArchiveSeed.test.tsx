import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/components/LocaleProvider";
import { getReviewedCareerArchive } from "@/lib/player-career-archive";
import PlayerStatsBundle from "./PlayerStatsBundle";
import PlayerAdvancedStats from "./PlayerAdvancedStats";

afterEach(() => vi.unstubAllGlobals());

it.each([
  { id: "2544", name: "LeBron James", team: "LAL", firstSeason: "2003-04" },
  { id: "201939", name: "Stephen Curry", team: "GSW", firstSeason: "2009-10" },
  { id: "203999", name: "Nikola Jokić", team: "DEN", firstSeason: "2015-16" },
  { id: "203507", name: "Giannis Antetokounmpo", team: "MIL", firstSeason: "2013-14" },
])("renders the reviewed $name career and advanced panels before any request", async fixture => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const archive = await getReviewedCareerArchive(fixture.id);
  expect(archive).not.toBeNull();
  const props = { playerId: Number(fixture.id), playerName: fixture.name, teamTricode: fixture.team, initialData: archive!.data };
  for (const locale of ["en", "zh"] as const) {
    const career = renderToStaticMarkup(<LocaleProvider initialLocale={locale}>{createElement(PlayerStatsBundle, props)}</LocaleProvider>);
    expect(career).toContain("<table");
    expect(career).toContain(fixture.firstSeason);
    expect(career).toContain("2025-26");
    expect(career).toContain("2026-10-03");
    expect(career).toContain("NBA.com");
    expect(career).not.toContain("skeleton-shimmer");
    expect(career).toContain(locale === "en" ? "Checking live sources." : "正在检查实时来源。");
    expect(career).not.toContain(locale === "en" ? "Live sources are unavailable or returned incomplete history." : "实时来源暂不可用或返回的历史不完整。");
    expect(career).not.toContain(locale === "en" ? "Retry live sources after 30 seconds." : "可在 30 秒后重试实时来源。");
    expect(career).toMatch(/<button[^>]*disabled=""[^>]*>(?:Checking…|检查中…)<\/button>/);
    const advanced = renderToStaticMarkup(<LocaleProvider initialLocale={locale}>{createElement(PlayerAdvancedStats, props)}</LocaleProvider>);
    expect(advanced).toContain("2025-26");
    expect(advanced).toContain("TS%");
    expect(advanced).not.toContain("skeleton-shimmer");
  }
  expect(fetcher).not.toHaveBeenCalled();
});

it("does not leak another player's archive into either career panel", async () => {
  const archive = await getReviewedCareerArchive("2544");
  const props = { playerId: 1629029, playerName: "Luka Dončić", teamTricode: "LAL", initialData: archive!.data };
  for (const component of [PlayerStatsBundle, PlayerAdvancedStats]) {
    const html = renderToStaticMarkup(createElement(component, props));
    expect(html).toContain("skeleton-shimmer");
    expect(html).not.toContain("2003-04");
  }
});

it("passes the already reviewed page data to every current-profile career consumer", () => {
  const page = readFileSync("src/app/player/[id]/page.tsx", "utf8");
  for (const component of ["PlayerSeasonStats", "PlayerStatsBundle", "PlayerAdvancedStats"]) {
    const invocation = page.match(new RegExp(`<${component}\\b[^>]*>`))?.[0];
    expect(invocation).toContain("initialData={careerArchive?.data}");
  }
});
