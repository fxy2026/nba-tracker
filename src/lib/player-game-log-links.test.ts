vi.mock("server-only", () => ({}));
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import schedule from "@/data/schedule-2025-26.json";
import { getPlayerGameLogArchive } from "./player-game-log-archive";
import { parseEspnPlayerGameLog } from "./espn-player-game-log";
import { normalizePlayerGameLog } from "./player-game-log-data";
import { resolveEspnPlayerLogGame, withEspnPlayerLogGamePages, withNbaPlayerLogGamePages } from "./player-game-log-links";
const rawLog = (playerId = 2544) => JSON.parse(gunzipSync(readFileSync(`src/data/player-game-log-archives/${playerId}-2025-26.json.gz`)).toString());
const raw = rawLog(), identity = { playerId: 2544, season: "2025-26", seasonType: "Regular Season" as const };
const parsed = parseEspnPlayerGameLog(raw, identity, "1966", "2026-10-05T08:00:00Z")!;
const row = parsed.rows.find(row => row.id === "espn:401810844")!;
const event = raw.events["401810844"];
const game = schedule.dates.flatMap(day => day.games).find(game => game.gameId === "0022500989")!;

describe("verified player-log internal navigation", () => {
  it.each([[2544, 60], [201939, 43]] as const)("resolves every current regular row for %s without changing stats or source identity", async (playerId, count) => {
    const data = await getPlayerGameLogArchive(playerId, "2025-26", "Regular Season");
    expect(data?.rows).toHaveLength(count);
    expect(data?.rows.every(row => /^00225\d{5}$/.test(row.internalGameId ?? ""))).toBe(true);
    expect(data?.rows.every(row => row.nbaGameId === null && row.id.startsWith("espn:") && row.plusMinus === null)).toBe(true);
    expect(data?.source.provider).toBe("ESPN");
    expect(normalizePlayerGameLog(data, { ...identity, playerId })).not.toBeNull();
  });
  it("preserves the phase and actual supported coverage", async () => {
    const playoffs = await getPlayerGameLogArchive(2544, "2025-26", "Playoffs");
    expect(playoffs?.rows).toHaveLength(10); expect(playoffs?.rows.every(row => row.internalGameId?.startsWith("00425"))).toBe(true);
    const preseason = await getPlayerGameLogArchive(201939, "2025-26", "Pre Season");
    expect(preseason?.rows).toHaveLength(4); expect(preseason?.rows.filter(row => row.internalGameId)).toHaveLength(1);
  });
  it.each([[2544, "2024-25"], [201939, "2024-25"], [977, "2015-16"], [893, "1997-98"], [893, "2002-03"]] as const)("keeps unsupported %s / %s rows local", async (id, season) => {
    const data = await getPlayerGameLogArchive(id, season, "Regular Season");
    expect(data!.rows.length).toBeGreaterThan(0); expect(data?.rows.every(row => row.internalGameId === null)).toBe(true);
  });
  it("corrects the previously wrong playoff crosswalk using exact regular identity", () => {
    expect(resolveEspnPlayerLogGame(event, row, identity)).toBe("0022500989");
    expect(resolveEspnPlayerLogGame(event, row, { ...identity, seasonType: "Playoffs" })).toBeNull();
    expect(resolveEspnPlayerLogGame(event, row, identity, [{ ...game, gameId: "0042500173" }])).toBeNull();
  });
  it("fails closed on duplicate candidates, missing coverage and wrong phase or season", () => {
    expect(resolveEspnPlayerLogGame(event, row, identity, [game, { ...game, gameId: "0022500990" }])).toBeNull();
    expect(resolveEspnPlayerLogGame(event, row, identity, [])).toBeNull();
    expect(resolveEspnPlayerLogGame(event, row, { ...identity, season: "2024-25" })).toBeNull();
    expect(resolveEspnPlayerLogGame(event, row, identity, [{ ...game, gameStatus: 1 }])).toBeNull();
  });
  it.each([
    { homeTeamScore: "93" }, { awayTeamScore: "101" }, { homeTeamId: "13", awayTeamId: "10" },
    { gameDate: "2026-03-17T01:31:00Z" }, { gameDate: "2026-03-18T01:30:00Z" },
    { id: "401000000" }, { atVs: "vs" }, { gameResult: "L" }, { leagueAbbreviation: "WNBA" },
  ])("rejects changed provider evidence %j", changes => {
    expect(resolveEspnPlayerLogGame({ ...event, ...changes }, row, identity)).toBeNull();
  });
  it("rejects NBA team-ID, date-code, and orientation mismatches", () => {
    expect(resolveEspnPlayerLogGame(event, row, identity, [{ ...game, homeTeam: { ...game.homeTeam, teamId: 1610612747 } }])).toBeNull();
    expect(resolveEspnPlayerLogGame(event, row, identity, [{ ...game, gameCode: "20260315/LALHOU" }])).toBeNull();
    expect(resolveEspnPlayerLogGame(event, { ...row, home: !row.home }, identity)).toBeNull();
  });
  it.each([[2544, "401810664", "0022500809"], [201939, "401809240", "0022500011"], [201939, "401809237", "0022500006"]] as const)("accepts only the explicitly reviewed timestamp fingerprint %s / %s", (playerId, espnId, nbaId) => {
    const source = rawLog(playerId), id = { ...identity, playerId };
    const data = parseEspnPlayerGameLog(source, id, String(playerId), "2026-10-05T08:00:00Z")!;
    const r = data.rows.find(row => row.id === `espn:${espnId}`)!, e = source.events[espnId];
    expect(resolveEspnPlayerLogGame(e, r, id)).toBe(nbaId);
    expect(resolveEspnPlayerLogGame({ ...e, gameDate: new Date(Date.parse(e.gameDate) + 60000).toISOString() }, r, id)).toBeNull();
    expect(resolveEspnPlayerLogGame({ ...e, homeTeamScore: String(Number(e.homeTeamScore) + 1) }, r, id)).toBeNull();
    expect(resolveEspnPlayerLogGame({ ...e, id: "499999999" }, { ...r, id: "espn:499999999" }, id)).toBeNull();
  });
  it("does not promote an NBA-shaped ID without available canonical coverage", () => {
    const data = { ...parsed, rows: [{ ...row, id: "nba:0022500989", nbaGameId: "0022500989" }] };
    expect(withNbaPlayerLogGamePages(data).rows[0].internalGameId).toBe("0022500989");
    expect(withNbaPlayerLogGamePages({ ...data, rows: [{ ...data.rows[0], nbaGameId: "0022500000" }] }).rows[0].internalGameId).toBeNull();
    expect(withNbaPlayerLogGamePages({ ...data, rows: [{ ...data.rows[0], wl: "L" }] }).rows[0].internalGameId).toBeNull();
  });
  it("normalizes only correctly scoped canonical targets and leaves missing raw evidence unlinked", () => {
    expect(normalizePlayerGameLog({ ...parsed, rows: [{ ...row, internalGameId: "401810844" }] }, identity)).toBeNull();
    expect(normalizePlayerGameLog({ ...parsed, rows: [{ ...row, internalGameId: "0042500173" }] }, identity)).toBeNull();
    expect(withEspnPlayerLogGamePages(parsed, {}).rows.every(row => row.internalGameId === null)).toBe(true);
  });
});
