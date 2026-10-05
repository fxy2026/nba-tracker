import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { getReviewedCareerArchive } from "@/lib/player-career-archive";
import PlayerSeasonStats from "./PlayerSeasonStats";

afterEach(() => vi.unstubAllGlobals());

it.each([
  { id: "2544", name: "LeBron James", team: "LAL", gp: 60, min: "33.2", points: "20.9" },
  { id: "201939", name: "Stephen Curry", team: "GSW", gp: 43, min: "30.9", points: "26.6" },
])("server-renders actual reviewed $name season details without a fetch or loading gap", async fixture => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const reviewed = await getReviewedCareerArchive(fixture.id);
  expect(reviewed).not.toBeNull();
  for (const locale of ["en", "zh"] as const) {
    const html = renderToStaticMarkup(createElement(PlayerSeasonStats, {
      playerId: Number(fixture.id), playerName: fixture.name, teamTricode: fixture.team, locale, initialData: reviewed!.data,
    }));
    expect(html).toContain(`data-player-season-stats="${fixture.id}"`);
    expect(html).toContain("2025-26"); expect(html).toContain(fixture.team);
    expect(html).toContain(`>${fixture.gp}</dd>`);
    expect(html).toContain(`>${fixture.min}</dd>`);
    expect(html).toContain(`>${fixture.points}</dd>`);
    expect(html).toContain("data-season-stat=\"STL\"");
    expect(html).toContain("data-season-stat=\"BLK\"");
    for (const kind of ["FG", "FG3", "FT"]) expect(html).toContain(`data-season-shooting="${kind}"`);
    expect(html).toContain("2026-10-03");
    expect(html).toContain("NBA.com");
    expect(html).not.toContain(locale === "zh" ? "正在载入赛季统计" : "Loading season statistics");
  }
  expect(fetcher).not.toHaveBeenCalled();
});
