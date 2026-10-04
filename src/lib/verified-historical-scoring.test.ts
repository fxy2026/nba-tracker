import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { getRecorded2025SeasonSchedule } from "./api";
import { getVerifiedHistoricalScoring, decodeReviewedHistoricalJson, validateHistoricalScoringFacts, type HistoricalScoringReferences } from "./verified-historical-scoring";
import { historicalScoringColumns as columns, historicalScoringFiles as files } from "./verified-historical-scoring-allowlist";
import { buildTakeoverSeries } from "./takeover-series";
const read = (key: keyof typeof files) => JSON.parse(readFileSync(files[key].path, "utf8"));
const game = getRecorded2025SeasonSchedule().flatMap(day => day.games).find(game => game.gameId === "0042500405")!;
const references = (): HistoricalScoringReferences => ({ game: structuredClone(game), box: read("box"), shots: read("shots"), periods: read("periods") });
const row = (facts: ReturnType<typeof read>, order: number, key: typeof columns[number], value: string) => { facts.rows[order - 1][columns.indexOf(key)] = value; };
afterEach(() => vi.unstubAllGlobals());

it("reads only four pinned server files and produces independently reconciled scoring events without fetch", () => {
  const fetch = vi.fn(() => { throw new Error("No provider requests permitted"); }); vi.stubGlobal("fetch", fetch);
  const result = getVerifiedHistoricalScoring(game.gameId);
  expect(result).not.toBeNull();
  expect(result?.coverage).toEqual({ sourceRows: 554, fieldGoalAttempts: 173, freeThrowAttempts: 47, freeThrowMakes: 32, scoreObservations: 110, scoringEvents: 96, playedPlayers: 21,
    actors: { player: 491, team: 48, opaqueReplay: 6, none: 9 } });
  expect(result?.events).toHaveLength(96); expect(new Set(result?.events.map(e => e.eventId)).size).toBe(96);
  expect(result?.events[0]).toMatchObject({ eventId: "nbastatsv3:0042500405:22", sourceOrder: 22, sourceActionNumber: 30, personId: 1641705, points: 2, clock: "PT09M44.00S", scoreHome: 2, scoreAway: 0 });
  expect(result?.events.at(-1)).toMatchObject({ sourceOrder: 551, sourceActionNumber: 768, personId: 1628384, points: 1, clock: "PT00M07.70S", scoreHome: 90, scoreAway: 94, outcomeBasis: "explicit-free-throw-description-and-score-delta" });
  expect(result?.events.filter(e => e.outcomeBasis === "explicit-free-throw-description-and-score-delta")).toHaveLength(32);
  expect(result?.source.captureTime).toBeNull(); expect(result?.source.verifiedOn).toBe("2026-10-04");
  expect(result).not.toHaveProperty("actions"); expect(result).not.toHaveProperty("shots"); expect(result).not.toHaveProperty("boxScore");
  expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result?.events[0])).toBe(true);
  expect(getVerifiedHistoricalScoring(game.gameId)).toBe(result); expect(fetch).not.toHaveBeenCalled();
});
it.each(["0042500204", "0042500312", "0042500404", "../../0042500405", "__proto__", "0022600001", ""])('does not promote an uncovered or unsafe ID %s', id => {
  expect(getVerifiedHistoricalScoring(id)).toBeNull();
});
it("revalidates selected schedule identity even with an already cached immutable result", () => {
  expect(getVerifiedHistoricalScoring(game.gameId)).not.toBeNull();
  for (const mutate of [(g: typeof game) => g.homeTeam.score++, (g: typeof game) => { g.gameStatus = 2; }, (g: typeof game) => { g.gameDateTimeUTC = "2026-06-13T00:30:00Z"; }]) {
    const changed = structuredClone(game); mutate(changed); expect(getVerifiedHistoricalScoring(game.gameId, changed)).toBeNull();
  }
});
it("retains the actual source repeated action numbers, sparse observations and non-player raw IDs", () => {
  const facts = read("facts");
  expect(facts.rows).toHaveLength(554); expect(facts.columns).toEqual(columns);
  expect(facts.rows.every((r: string[], i: number) => r[22] === String(i + 1))).toBe(true);
  expect(facts.rows.length - new Set(facts.rows.map((r: string[]) => r[0])).size).toBe(25);
  expect(facts.rows.filter((r: string[]) => r[13] === "" && r[14] === "")).toHaveLength(444);
  expect(facts.rows.filter((r: string[]) => r[5] === "1610612752" || r[5] === "1610612759")).toHaveLength(48);
  expect(facts.rows.filter((r: string[]) => r[18] === "Instant Replay")).toHaveLength(6);
  expect(facts.rows.filter((r: string[]) => r[18] === "Free Throw").every((r: string[]) => r[11] === "" && r[21] === "0")).toBe(true);
});
it.each(Object.keys(files) as (keyof typeof files)[])("pins exact deployment file bytes before JSON.parse: %s", key => {
  const bytes = readFileSync(files[key].path);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(files[key].sha256);
  expect(decodeReviewedHistoricalJson(bytes, key)).toEqual(read(key));
  const parser = vi.spyOn(JSON, "parse"); parser.mockClear();
  expect(decodeReviewedHistoricalJson(Buffer.concat([bytes, Buffer.from(" ")]), key)).toBeNull();
  expect(parser).not.toHaveBeenCalled(); parser.mockRestore();
});

const corruptions: [string, (f: ReturnType<typeof read>) => void][] = [
  ["wrong game", f => { f.gameId = "0042500404"; }],
  ["changed source commit", f => { f.source.commit = "0".repeat(40); }],
  ["invented capture time", f => { f.source.captureTime = "2026-06-14T00:30:00Z"; }],
  ["new schema", f => { f.schemaVersion = 2; }],
  ["extra column", f => { f.columns.push("madeUp"); }],
  ["missing action", f => { f.rows.splice(20, 1); }],
  ["duplicate actionId", f => row(f, 22, "actionId", "21")],
  ["reordered same-clock rows", f => { [f.rows[0], f.rows[1]] = [f.rows[1], f.rows[0]]; }],
  ["changed original shot number", f => row(f, 22, "actionNumber", "999")],
  ["invalid clock", f => row(f, 22, "clock", "PT99M00S")],
  ["clock reversal", f => row(f, 22, "clock", "PT11M59.99S")],
  ["unverified overtime", f => row(f, 554, "period", "5")],
  ["one-sided score", f => row(f, 22, "scoreAway", "")],
  ["missing scoring observation", f => { row(f, 22, "scoreHome", ""); row(f, 22, "scoreAway", ""); }],
  ["invented score on blank row", f => { row(f, 2, "scoreHome", "1"); row(f, 2, "scoreAway", "0"); }],
  ["replay score reversal", f => { row(f, 168, "scoreHome", "20"); row(f, 168, "scoreAway", "13"); }],
  ["invalid final", f => row(f, 554, "scoreHome", "91")],
  ["wrong team ID", f => row(f, 22, "teamId", "1610612752")],
  ["wrong tricode", f => row(f, 22, "teamTricode", "NYK")],
  ["wrong location", f => row(f, 22, "location", "v")],
  ["team ID as a scorer", f => row(f, 22, "personId", "1610612759")],
  ["opaque replay ID as a scorer", f => row(f, 22, "personId", "214")],
  ["unplayed roster member as a scorer", f => row(f, 22, "personId", "203084")],
  ["wrong scoring player", f => row(f, 22, "personId", "1642844")],
  ["changed FG value", f => row(f, 22, "shotValue", "3")],
  ["fake FT raw result", f => row(f, 38, "shotResult", "Made")],
  ["FT inferred from raw zero value", f => row(f, 38, "description", "Unknown free throw outcome")],
  ["FT outcome conflicts with score", f => row(f, 38, "description", "MISS Anunoby Free Throw 1 of 2")],
  ["FT cumulative player points", f => row(f, 38, "description", "Anunoby Free Throw 1 of 2 (99 PTS)")],
  ["bad quarter end", f => row(f, 127, "scoreHome", "22")],
  ["missing quarter start", f => row(f, 128, "subType", "end")],
  ["altered coordinate", f => row(f, 22, "xLegacy", "42")],
  ["field goal from heave", f => row(f, 396, "isFieldGoal", "1")],
];
it.each(corruptions)("fails structural reconciliation on %s, independently of the byte hash", (_name, mutate) => {
  const facts = read("facts"); mutate(facts); expect(validateHistoricalScoringFacts(facts, references())).toBeNull();
});
it.each(["box player points", "box incomplete", "box wrong historical team", "official quarter points", "shot roster ID", "schedule score", "schedule status", "schedule date", "schedule team", "schedule UTC"])("fails mismatched independent reference: %s", kind => {
  const refs = references();
  // These are mutations of local JSON test fixtures, not provider payloads.
  const box = refs.box as {players:{points:number;team:string}[]};
  const periods = refs.periods as {home:{periodPoints:number[]}};
  const shots = refs.shots as {players:{personId:number}[]};
  if (kind === "box player points") box.players[0].points++;
  if (kind === "box incomplete") box.players.pop();
  if (kind === "box wrong historical team") box.players[0].team = "SAS";
  if (kind === "official quarter points") periods.home.periodPoints[0]++;
  if (kind === "shot roster ID") shots.players[0].personId++;
  if (kind === "schedule score") refs.game.homeTeam.score++;
  if (kind === "schedule status") refs.game.gameStatus = 2;
  if (kind === "schedule date") refs.game.gameCode = "20260614/NYKSAS";
  if (kind === "schedule team") refs.game.homeTeam.teamId++;
  if (kind === "schedule UTC") refs.game.gameDateTimeUTC = "2026-06-13T00:30:00Z";
  expect(validateHistoricalScoringFacts(read("facts"), refs)).toBeNull();
});
it.each([false, true])("reproduces the actual existing chart with complete FT points and 97 steps (%s)", isZh => {
  const result = getVerifiedHistoricalScoring(game.gameId)!; const chart = buildTakeoverSeries(result.events, isZh);
  expect(chart.steps).toBe(97); expect(chart.quarterStarts).toEqual([18, 39, 69].map((index, i) => ({index, label:isZh ? `第${i+2}节` : `Q${i+2}`})));
  expect(chart.scorers.map(s => [s.name,s.total])).toEqual([["Jalen Brunson",45],["Dylan Harper",25],["Victor Wembanyama",19],["Julian Champagnie",14],["Mikal Bridges",14],["Josh Hart",13]]);
  for (const player of chart.scorers) { expect(player.points).toHaveLength(97); expect(player.points[0]).toBe(0); expect(player.points.at(-1)).toBe(player.total); }
});
