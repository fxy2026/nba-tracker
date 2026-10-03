import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import schedule from "@/data/schedule-2025-26.json";
import first from "@/data/official-period-scores/0042500401.json";
import evidence from "../../docs/evidence/game-period-scores/finals-2025-26.json";
import { getOfficialPeriodScores, validateReviewedPeriodScores } from "./official-period-score-archive";
import { validateOfficialPeriodScores } from "./official-period-score-validation";

const game = (id = "0042500401") => structuredClone(schedule.dates.flatMap(date => date.games).find(game => game.gameId === id)!);
const hash = (raw: unknown) => createHash("sha256").update(JSON.stringify(raw)).digest("hex");
const root = path.join(process.cwd(), "src/data/official-period-scores");
afterEach(() => vi.unstubAllGlobals());

describe("reviewed official Finals periods", () => {
  it("bounds the archive to the five reviewed Finals and matches every evidence row", () => {
    expect(readdirSync(root).sort()).toEqual(evidence.games.map(game => `${game.gameId}.json`).sort());
    for (const source of evidence.games) {
      const raw = JSON.parse(readFileSync(path.join(root, `${source.gameId}.json`), "utf8"));
      const result = getOfficialPeriodScores(game(source.gameId));
      expect(result).toEqual(raw);
      expect(result).toMatchObject({ gameId: source.gameId, gameCode: source.gameCode, gameDate: source.gameDate, source: {
        reportUrl: source.source.reportUrl, reportSha256: source.source.reportSha256,
        page: 1, pageCount: 1, periodLabelsAsPrinted: ["1", "2", "3", "4"],
      } });
      for (const side of ["home", "away"] as const) {
        expect(result![side]).toEqual({ teamId: source[side].teamId, teamTricode: source[side].teamTricode,
          periodPoints: source[side].periodPoints, reportedFinalScore: source[side].reportedFinalScore });
        const sum = result![side].periodPoints.reduce((sum, value) => sum + value, 0);
        expect(sum).toBe(game(source.gameId)[`${side}Team`].score);
        expect(sum).toBe(source[side].periodPointsSum);
        const printed = source[side].sourceLineAsExtracted.trim().split(/\s+/);
        expect(printed[0]).toBe(source[side].reportedTeamLabel);
        expect(printed.slice(1).map(Number)).toEqual([...result![side].periodPoints, sum]);
      }
      expect(createHash("sha256").update(readFileSync(source.identityEvidence.unchangedPlayerSnapshot)).digest("hex"))
        .toBe(source.identityEvidence.unchangedPlayerSnapshotSha256);
    }
  });

  it("uses the official local date even when UTC tipoff is the following day", () => {
    const canonical = game();
    expect(canonical.gameDateTimeUTC.slice(0, 10)).toBe("2026-06-04");
    expect(getOfficialPeriodScores(canonical)?.gameDate).toBe("2026-06-03");
  });

  it.each([null, undefined, [], {}, "", 0, false])("rejects malformed/empty input %j", raw => {
    expect(validateOfficialPeriodScores(raw, game())).toBeNull();
    expect(validateReviewedPeriodScores(raw, game(), hash(first))).toBeNull();
  });

  const mutations: [string, (raw: typeof first) => void][] = [
    ["schema", raw => { raw.schemaVersion++; }],
    ["kind", raw => { raw.kind = "box-score"; }],
    ["game ID", raw => { raw.gameId = "0042500402"; }],
    ["season", raw => { raw.season = "2026-27"; }],
    ["game date", raw => { raw.gameDate = "2026-06-04"; }],
    ["invalid date", raw => { raw.gameDate = "2026-02-30"; }],
    ["game code", raw => { raw.gameCode = "20260603/SASNYK"; }],
    ["status", raw => { raw.gameStatus = 2; }],
    ["swapped sides", raw => { [raw.home, raw.away] = [raw.away, raw.home]; }],
    ["team ID", raw => { raw.home.teamId = raw.away.teamId; }],
    ["team tricode", raw => { raw.home.teamTricode = "BOS"; }],
    ["final", raw => { raw.home.reportedFinalScore++; }],
    ["home sum", raw => { raw.home.periodPoints[0]++; }],
    ["away sum", raw => { raw.away.periodPoints[0]++; }],
    ["empty periods", raw => { raw.home.periodPoints = []; }],
    ["mismatched lengths", raw => { raw.away.periodPoints.pop(); }],
    ["extra period", raw => { raw.home.periodPoints.push(0); raw.away.periodPoints.push(0); raw.source.periodLabelsAsPrinted.push("5"); }],
    ["negative", raw => { raw.home.periodPoints[0] = -1; }],
    ["fractional", raw => { raw.home.periodPoints[0] += .5; raw.home.periodPoints[1] -= .5; }],
    ["NaN", raw => { raw.home.periodPoints[0] = NaN; }],
    ["infinite", raw => { raw.home.periodPoints[0] = Infinity; }],
    ["unsafe integer", raw => { raw.home.periodPoints[0] = Number.MAX_SAFE_INTEGER + 1; }],
    ["string score", raw => { Reflect.set(raw.home.periodPoints, 0, "27"); }],
    ["null score", raw => { Reflect.set(raw.home.periodPoints, 0, null); }],
    ["missing score", raw => { Reflect.deleteProperty(raw.home.periodPoints, 0); raw.home.periodPoints[1] += 27; }],
    ["missing team", raw => { Reflect.deleteProperty(raw, "away"); }],
    ["missing source", raw => { Reflect.deleteProperty(raw, "source"); }],
    ["untrusted URL", raw => { raw.source.reportUrl = "https://example.com/report.pdf"; }],
    ["other game report", raw => { raw.source.reportUrl = raw.source.reportUrl.replaceAll("20260603", "20260605"); }],
    ["source hash", raw => { raw.source.reportSha256 = "unknown"; }],
    ["publisher", raw => { raw.source.publisher = "Other"; }],
    ["page", raw => { raw.source.page = 2; }],
    ["page count", raw => { raw.source.pageCount = 0; }],
    ["verification date", raw => { raw.source.verifiedOn = "2026-02-30"; }],
    ["verification predates game", raw => { raw.source.verifiedOn = "2026-06-02"; }],
    ["duplicate label", raw => { raw.source.periodLabelsAsPrinted[1] = "1"; }],
    ["empty labels", raw => { raw.source.periodLabelsAsPrinted = []; }],
    ["missing label", raw => { Reflect.deleteProperty(raw.source.periodLabelsAsPrinted, 0); }],
  ];
  it.each(mutations)("rejects %s without repairing or guessing", (_name, change) => {
    const raw = structuredClone(first);
    change(raw);
    expect(validateOfficialPeriodScores(raw, game())).toBeNull();
    expect(validateReviewedPeriodScores(raw, game(), hash(first))).toBeNull();
  });

  it("rejects internally consistent but unreviewed redistributed quarters", () => {
    const raw = structuredClone(first);
    raw.home.periodPoints[0]++; raw.home.periodPoints[1]--;
    expect(validateOfficialPeriodScores(raw, game())).not.toBeNull();
    expect(validateReviewedPeriodScores(raw, game(), hash(first))).toBeNull();
    expect(validateReviewedPeriodScores(first, game(), "0".repeat(64))).toBeNull();
    const circular: Record<string, unknown> = {}; circular.self = circular;
    expect(validateReviewedPeriodScores(circular, game(), hash(first))).toBeNull();
  });

  it("preserves explicit zero quarters when the contract and finals reconcile", () => {
    const raw = structuredClone(first);
    raw.home.periodPoints = [0, 55, 21, 19];
    expect(validateOfficialPeriodScores(raw, game())?.home.periodPoints[0]).toBe(0);
    expect(validateReviewedPeriodScores(raw, game(), hash(first))).toBeNull();
  });

  it.each(["0042500406", "0042500301", "0022500961", "__proto__", "constructor", ""])("returns no archive for unsupported ID %s", gameId => {
    expect(getOfficialPeriodScores({ ...game(), gameId })).toBeNull();
  });
  it.each([0, 1, 2, 4])("rejects non-final schedule status %s", gameStatus => {
    expect(getOfficialPeriodScores({ ...game(), gameStatus })).toBeNull();
  });
  it.each(["score", "teamId", "teamTricode", "date", "teamOrder"])("rejects canonical schedule %s mismatch", field => {
    const canonical = game();
    if (field === "score") canonical.homeTeam.score++;
    if (field === "teamId") canonical.homeTeam.teamId++;
    if (field === "teamTricode") canonical.homeTeam.teamTricode = "BOS";
    if (field === "date") canonical.gameCode = "20260604/NYKSAS";
    if (field === "teamOrder") [canonical.homeTeam, canonical.awayTeam] = [canonical.awayTeam, canonical.homeTeam];
    expect(getOfficialPeriodScores(canonical)).toBeNull();
  });
  it("never fetches during visitor archive reads", () => {
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected provider call"); }));
    for (const source of evidence.games) expect(getOfficialPeriodScores(game(source.gameId))).not.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
