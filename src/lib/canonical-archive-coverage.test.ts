import { expect, it } from "vitest";
import archive from "@/data/schedule-2025-26.json";
import finals from "@/data/season-2025-26-final.json";
import aliases from "@/data/archive-game-aliases.json";
import { isRegular, isPlayoff, isCountedSeason } from "./games";

const games = archive.dates.flatMap(day => day.games);
it("the completed archive exposes all 1230 regular games and 85 playoff games exactly once", () => {
  expect(games).toHaveLength(1327);
  expect(games.filter(g => isRegular(g.gameId))).toHaveLength(1230);
  expect(games.filter(g => isPlayoff(g.gameId))).toHaveLength(85);
  expect(games.filter(g => Object.hasOwn(aliases, g.gameId))).toEqual([]);
  expect(new Set(games.map(g => g.gameId)).size).toBe(games.length);
  expect(new Set(games.map(g => `${g.gameCode}|${g.awayTeam.score}|${g.homeTeam.score}`)).size).toBe(games.length);
});
it("regular-season standings inputs cover 82 games per team and match the independent final archive", () => {
  const records = new Map<string, { games: number; wins: number; points: number }>();
  for (const g of games.filter(g => isRegular(g.gameId))) {
    expect(isCountedSeason(g.gameId)).toBe(true);
    for (const [team, opponent] of [[g.homeTeam, g.awayTeam], [g.awayTeam, g.homeTeam]]) {
      const record = records.get(team.teamTricode) ?? { games: 0, wins: 0, points: 0 };
      record.games++; record.wins += Number(team.score > opponent.score); record.points += team.score;
      records.set(team.teamTricode, record);
    }
    const source = finals.finishedGames.find(row => row.gameId === g.gameId)!;
    expect(source).toBeDefined();
    expect([g.gameCode, g.awayTeam.score, g.homeTeam.score]).toEqual([`${source.gameDate.replaceAll("-", "")}/${source.awayTricode}${source.homeTricode}`, source.awayScore, source.homeScore]);
  }
  expect(records.size).toBe(30);
  for (const record of records.values()) expect(record.games).toBe(82);
});

it("preserves every physical final and all 87 recovered box files byte-for-byte", async () => {
  const { createHash } = await import("node:crypto");
  const { readFile, readdir } = await import("node:fs/promises");
  const { default: baseline } = await import("./fixtures/pre-synthetic-identity-baseline.json");
  const physical = archive.dates.flatMap(day => day.games.map(game =>
    `${day.gameDate}|${game.gameCode}|${game.awayTeam.score}|${game.homeTeam.score}`)).sort();
  expect(physical).toEqual(baseline.physicalFinals);
  const directory = new URL("../data/recovered-player-boxes/", import.meta.url);
  const files = (await readdir(directory)).filter(file => file.endsWith(".json")).sort();
  const preserved = Object.keys(baseline.recoveredBoxSha256).sort();
  expect(preserved).toHaveLength(87);
  expect(files).toEqual(expect.arrayContaining(preserved));
  for (const file of preserved) {
    const hash = createHash("sha256").update(await readFile(new URL(file, directory))).digest("hex");
    expect(hash, file).toBe(baseline.recoveredBoxSha256[file as keyof typeof baseline.recoveredBoxSha256]);
  }
});

it("binds all 67 canonical identities and legacy aliases to explicit official evidence", async () => {
  const { default: evidence } = await import("../../scripts/archive-data/synthetic-identity-corrections.json");
  const { default: espn } = await import("../../scripts/archive-data/espn-id-map.json");
  const { default: legacySeasons } = await import("../data/archive-game-seasons.json");
  expect(evidence.mappings).toHaveLength(67);
  for (const row of evidence.mappings) {
    expect(aliases[row.from as keyof typeof aliases]).toBe(row.to);
    expect(legacySeasons[row.from as keyof typeof legacySeasons]).toBe("2025-26");
    expect(espn[row.to as keyof typeof espn]).toBe(row.espnEventId);
    expect(Object.hasOwn(espn, row.from)).toBe(false);
    const game = games.find(game => game.gameId === row.to)!;
    expect(game).toBeDefined();
    expect(game.gameStatus).toBe(3);
    expect([game.awayTeam.teamId, game.homeTeam.teamId, game.gameDateTimeUTC]).toEqual([
      row.verified.awayTeamId, row.verified.homeTeamId, row.verified.gameDateTimeUTC,
    ]);
    expect(row.officialGameUrl).toMatch(new RegExp(`^https://www\\.nba\\.com/game/.+-${row.to}$`));
    expect(row.htmlSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(row.sourcePath).toBe("props.pageProps.game");
  }
  const changedUtc = evidence.mappings.filter(row => row.original.game.gameDateTimeUTC !== row.verified.gameDateTimeUTC);
  expect(changedUtc.map(row => row.to)).toEqual(["0022500809"]);
  expect(changedUtc[0].verified.gameDateTimeUTC).toBe("2026-02-21T03:00:00Z");
});
