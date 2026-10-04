import { afterEach, expect, it, vi } from "vitest";
import { getRecorded2025SeasonSchedule, getScheduleAge } from "./api";
import { standingsRecordedFinals } from "./standings-recorded";
import { trajectoryCoverage } from "./trajectory-season";
import { computeStandingsRows, gamesBehind } from "./standings-splits";
import { TEAM_META } from "./teams";

afterEach(() => vi.unstubAllGlobals());
it("independently checks every recorded team's records, splits, averages, streak, order and GB", () => {
  const fetch = vi.fn(() => { throw new Error("Archive must stay local"); }); vi.stubGlobal("fetch", fetch);
  const age = getScheduleAge(), raw = getRecorded2025SeasonSchedule(), before = JSON.stringify(raw);
  const finals = standingsRecordedFinals(raw, "2025-26"), games = finals.flatMap(day => day.games);
  const rows = computeStandingsRows(finals);
  expect(trajectoryCoverage(finals)).toEqual({ finals: 1230, teams: 30, min: 82, max: 82, first: "2025-10-21", last: "2026-04-13" });
  expect(new Set(games.map(g => g.gameId)).size).toBe(1230); expect(rows).toHaveLength(30);
  const expected = Object.values(TEAM_META).map(meta => {
    const appearances = games.filter(g => [g.homeTeam.teamTricode, g.awayTeam.teamTricode].includes(meta.tricode))
      .map(g => {
        const home = g.homeTeam.teamTricode === meta.tricode;
        const own = home ? g.homeTeam : g.awayTeam, other = home ? g.awayTeam : g.homeTeam;
        return { home, won: own.score > other.score, pf: own.score, pa: other.score,
          division: TEAM_META[other.teamTricode].division === meta.division, date: g.gameDateTimeUTC };
      });
    const count = (test: (g: typeof appearances[number]) => boolean) => appearances.filter(test).length;
    const wins = count(g => g.won), losses = count(g => !g.won);
    const ppg = appearances.reduce((n, g) => n + g.pf, 0) / appearances.length;
    const oppg = appearances.reduce((n, g) => n + g.pa, 0) / appearances.length;
    const chronological = appearances.toSorted((a, b) => a.date.localeCompare(b.date));
    const latest = chronological.at(-1)!.won;
    const opposite = chronological.findLastIndex(g => g.won !== latest);
    const streak = `${latest ? "W" : "L"}${chronological.length - 1 - opposite}`;
    return { tricode: meta.tricode, conference: meta.conference, wins, losses, pct: wins / (wins + losses),
      homeW: count(g => g.home && g.won), homeL: count(g => g.home && !g.won),
      roadW: count(g => !g.home && g.won), roadL: count(g => !g.home && !g.won),
      divW: count(g => g.division && g.won), divL: count(g => g.division && !g.won), ppg, oppg, diff: ppg - oppg, streak };
  });
  const sideCounts = expected.flatMap(row => [row.homeW + row.homeL, row.roadW + row.roadL]);
  expect(Math.min(...sideCounts)).toBe(40); expect(Math.max(...sideCounts)).toBe(42);
  for (const row of rows) {
    expect(row).toMatchObject(expected.find(e => e.tricode === row.tricode)!);
    expect(row.wins + row.losses).toBe(82);
    expect(row.homeW + row.homeL + row.roadW + row.roadL).toBe(82);
  }
  for (const conference of ["East", "West"]) {
    const sorted = expected.filter(r => r.conference === conference).sort((a, b) => b.pct - a.pct || b.wins - a.wins || b.diff - a.diff);
    const actual = rows.filter(r => r.conference === conference);
    expect(actual.map(r => r.tricode)).toEqual(sorted.map(r => r.tricode));
    for (const [i, row] of actual.entries()) {
      const leader = sorted[0], team = sorted[i];
      const gb = i === 0 ? "-" : Math.max(0, (leader.wins - team.wins + team.losses - leader.losses) / 2).toFixed(1);
      expect(gamesBehind(actual[0], row)).toBe(gb);
    }
  }
  const total = (key: "wins" | "losses" | "homeW" | "homeL" | "roadW" | "roadL" | "divW" | "divL") => rows.reduce((sum, r) => sum + r[key], 0);
  expect(total("wins")).toBe(1230); expect(total("losses")).toBe(1230);
  expect(total("homeW")).toBe(total("roadL")); expect(total("homeL")).toBe(total("roadW")); expect(total("divW")).toBe(total("divL"));
  expect(JSON.stringify(raw)).toBe(before); expect(getScheduleAge()).toBe(age); expect(fetch).not.toHaveBeenCalled();
});

it("filters mixed seasons, nonregular games, nonfinals, unknown teams and invalid final scores before coverage and standings", () => {
  const raw = getRecorded2025SeasonSchedule(), finals = standingsRecordedFinals(raw, "2025-26"), sample = finals[0].games[0];
  const extra = [
    ...["0022600001", "0012509999", "0042509999", "0052509999", "0062509999"].map(gameId => ({ ...sample, gameId })),
    ...[1, 2].map(gameStatus => ({ ...sample, gameId: "0022509998", gameStatus })),
    ...["homeTeam", "awayTeam"].map(side => ({ ...sample, gameId: "0022509997", [side]: { ...sample[side as "homeTeam" | "awayTeam"], teamTricode: "EXH" } })),
    ...[[0, 0], [100, 100], [-1, 100], [NaN, 100], [Infinity, 100], [110.5, 100], [100, NaN]].map(([home, away]) => ({ ...sample, gameId: "0022509996", homeTeam: { ...sample.homeTeam, score: home }, awayTeam: { ...sample.awayTeam, score: away } })),
  ];
  const mixed = [...raw, { gameDate: "10/21/2026", games: extra }];
  expect(standingsRecordedFinals(mixed, "2025-26")).toEqual(finals);
  expect(trajectoryCoverage(standingsRecordedFinals(mixed, "2025-26"))).toEqual(trajectoryCoverage(finals));
  expect(computeStandingsRows(standingsRecordedFinals(mixed, "2025-26"))).toEqual(computeStandingsRows(finals));
  expect(standingsRecordedFinals([{ gameDate: "10/21/2026", games: extra }], "2024-25")).toEqual([]);
});
