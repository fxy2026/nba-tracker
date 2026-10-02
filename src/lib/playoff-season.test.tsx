import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import type { ScheduleGame } from "./api";
import { selectPlayoffSeason } from "./playoff-season";
import BracketTree from "@/components/BracketTree";
import { LocaleProvider } from "@/components/LocaleProvider";

function game(id = "0042500101", status = 3): ScheduleGame {
  const side = (teamTricode: string, teamId: number, score: number) => ({ teamTricode, teamId, score, teamCity: teamTricode, teamName: teamTricode, teamSlug: "", wins: 0, losses: 0, seed: 1 });
  return { gameId: id, gameStatus: status, gameStatusText: "Final", gameCode: "", gameDateTimeUTC: "2026-04-20T00:00:00Z", homeTeam: side("BOS",1610612738,100), awayTeam: side("NYK",1610612752,90) };
}
afterEach(() => vi.useRealTimers());
it("keeps archive results when a newer season only has unplayed games", () => {
  expect(selectPlayoffSeason([game(), game("0042600101",1)])).toEqual({ season: "2025-26", games: [game()] });
});
it("switches to the first completed game of the newer season without merging repeated matchups", () => {
  const newer = game("0042600101");
  expect(selectPlayoffSeason([game(), newer])).toEqual({ season: "2026-27", games: [newer] });
});
it("deduplicates exact game IDs without mutating input", () => {
  const games = [game(), game()];
  expect(selectPlayoffSeason(games).games).toHaveLength(1);
  expect(games).toHaveLength(2);
});
it("rejects unknown IDs, non-playoff games, invalid scores and non-finals", () => {
  const tie = game(); tie.awayTeam.score = 100;
  const invalid = game(); invalid.homeTeam.score = NaN;
  expect(selectPlayoffSeason([game("9401810012"), game("0022500101"), game("0042500901"), game("0042500101",2), tie, invalid])).toEqual({ season:null, games:[] });
});
it("returns no bracket for empty input", () => expect(selectPlayoffSeason([])).toEqual({season:null,games:[]}));
it.each(["en", "zh"] as const)("renders truthful archive season and preserves exact series links in %s", (locale) => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-02T12:00:00Z"));
  const html = renderToStaticMarkup(<LocaleProvider initialLocale={locale}><BracketTree games={[game("0042400101"),game(),game()]} /></LocaleProvider>);
  expect(html).toContain("2025-26");
  expect(html).toContain(locale === "zh" ? "历史赛果" : "Archived results");
  expect(html).toContain('href="/series/004250010"');
  expect(html).not.toContain('/series/004240010');
  expect(html).toContain('1/7');
  expect(html).not.toContain('2/7');
  expect(html).not.toContain('CHAMPION');
});
it("shows current season without an archive label and hides empty brackets", () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2027-05-01T12:00:00Z"));
  const html = renderToStaticMarkup(createElement(BracketTree,{games:[game(),game("0042600101")]}));
  expect(html).toContain("2026-27"); expect(html).not.toContain("历史赛果");
  expect(renderToStaticMarkup(createElement(BracketTree,{games:[]}))).toBe("");
});

it("invalid newer round/series combinations cannot displace archived results", () => {
  expect(selectPlayoffSeason([game(),game("0042600471"),game("0042600271"),game("0042600321")])).toEqual({season:"2025-26",games:[game()]});
});
