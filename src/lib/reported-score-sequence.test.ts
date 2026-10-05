import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import raw from "@/data/reported-score-sequences/0022500961.json";
import schedule from "@/data/schedule-2025-26.json";
import evidence from "../../docs/evidence/reported-score-sequences/0022500961.json";
import type { ScheduleGame } from "./api";
import { validateReportedScoreFacts } from "./reported-score-sequence";
import { getReportedScoreSequence, validateReviewedReportedScoreSequence } from "./reported-score-sequence-archive";

const game = schedule.dates.flatMap(date => date.games).find(game => game.gameId === "0022500961") as ScheduleGame;
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const copy = () => structuredClone(raw);

describe("reviewed MEM–DET factual score archive", () => {
  it("pins the exact independent-review factual file and PDF hashes", () => {
    const bytes = readFileSync("src/data/reported-score-sequences/0022500961.json");
    expect(sha256(bytes)).toBe("97209ef88c46f19cd95ae1664f6e60e9540de81b40e215047c8adf3ca49efe44");
    expect(sha256(bytes)).toBe(evidence.independentReview.factsSha256);
    const sequence = getReportedScoreSequence(game)!;
    expect(sequence.source).toEqual({
      url: "https://statsdmz.nba.com/pdfs/20260313/20260313_MEMDET_book.pdf",
      sha256: "e798bb1ce8dd0d5e035f53af522567c8f5a038577ba3ba27be1bb3afb3afe55e",
      pageCount: 19,
    });
    expect(sequence.reportedScoreRows).toEqual(raw.reportedScoreRows);
    expect(sequence.reportedPeriodEnds).toEqual(raw.reportedPeriodEnds);
  });

  it("reconciles numeric IDs, date, sides, final and URL with canonical local evidence", () => {
    const sequence = getReportedScoreSequence(game)!;
    const identity = evidence.identityReconciliation;
    expect(game.gameCode).toBe("20260313/MEMDET");
    expect(game.gameDateTimeUTC).toBe("2026-03-13T23:30:00Z");
    expect(sequence.home).toEqual({ teamId: 1610612765, teamTricode: "DET", score: 126 });
    expect(sequence.away).toEqual({ teamId: 1610612763, teamTricode: "MEM", score: 110 });
    expect(sequence.home).toEqual(identity.schedule.home);
    expect(sequence.away).toEqual(identity.schedule.away);
    expect(sha256(readFileSync(identity.schedule.path))).toBe(identity.schedule.sha256);
    expect(sha256(readFileSync(identity.existingPlayerBox.path))).toBe(identity.existingPlayerBox.sha256);
    const box = JSON.parse(readFileSync(identity.existingPlayerBox.path, "utf8"));
    expect(box.gameId).toBe(game.gameId);
    expect(box.gameDate).toBe(sequence.gameDate);
    expect(box.reportUrl).toBe(sequence.source.url);
    expect([box.home, box.away, box.homeScore, box.awayScore]).toEqual(["DET", "MEM", 126, 110]);
  });

  it("retains 124 printed timed rows and three unchanged opening possession observations", () => {
    const sequence = getReportedScoreSequence(game)!;
    expect(sequence.kind).toBe("official-gamebook-reported-score-sequence");
    expect(sequence.reportedScoreRows).toHaveLength(124);
    expect([1, 2, 3, 4].map(period => sequence.reportedScoreRows.filter(row => row.period === period).length)).toEqual([33, 30, 29, 32]);
    expect(sequence.reportedScoreRows[0]).toEqual({ period: 1, clockAsPrinted: "11:11", homeScore: 0, awayScore: 2, sourcePage: 9 });
    for (const [index, ordinal] of [34, 64, 93].entries()) {
      const row = sequence.reportedScoreRows[ordinal - 1];
      const precedingEnd = sequence.reportedPeriodEnds[index];
      expect([row.period, row.clockAsPrinted, row.homeScore, row.awayScore]).toEqual([index + 2, "12:00", precedingEnd.homeScore, precedingEnd.awayScore]);
    }
  });

  it("preserves all decimal clocks and repeated-clock source order without deduplication", () => {
    const rows = getReportedScoreSequence(game)!.reportedScoreRows;
    expect(rows.filter(row => row.clockAsPrinted.includes("."))).toHaveLength(12);
    expect(rows.some(row => row.clockAsPrinted === ":06.2")).toBe(true);
    expect(rows.at(-1)?.clockAsPrinted).toBe(":33.1");
    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = `${row.period}/${row.clockAsPrinted}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    expect([...groups.values()].filter(group => group.length > 1)).toHaveLength(17);
    expect(groups.get("1/:31.7")?.map(row => [row.homeScore, row.awayScore])).toEqual([[35, 33], [35, 34], [35, 35]]);
    expect(groups.get("4/03:12")?.map(row => [row.homeScore, row.awayScore])).toEqual([[119, 101], [119, 102], [119, 103]]);
    expect(groups.get("4/10:59")?.map(row => [row.homeScore, row.awayScore])).toEqual([[102, 84], [102, 85]]);
  });

  it("keeps four untimed summaries separate and reconciles every final printed score", () => {
    const sequence = getReportedScoreSequence(game)!;
    expect(sequence.reportedPeriodEnds.map(row => [row.homeScore, row.awayScore, row.sourcePage])).toEqual([[37, 35, 10], [68, 61, 12], [98, 84, 15], [126, 110, 19]]);
    for (const endpoint of sequence.reportedPeriodEnds) {
      expect(Object.keys(endpoint).sort()).toEqual(["awayScore", "homeScore", "period", "sourcePage"]);
      const last = sequence.reportedScoreRows.filter(row => row.period === endpoint.period).at(-1)!;
      expect([last.homeScore, last.awayScore]).toEqual([endpoint.homeScore, endpoint.awayScore]);
    }
    expect(sequence.reportedScoreRows.some(row => row.clockAsPrinted === "00:00")).toBe(false);
  });

  it("rejects plausible but unreviewed changes even when shape/order validation passes", () => {
    const changedScore = copy(); changedScore.reportedScoreRows[41].homeScore = 43;
    const changedClock = copy(); changedClock.reportedScoreRows[4].clockAsPrinted = "09:12";
    const changedPage = copy(); changedPage.reportedScoreRows[15].sourcePage = 10;
    for (const edited of [changedScore, changedClock, changedPage]) {
      expect(validateReportedScoreFacts(edited)).not.toBeNull();
      expect(validateReviewedReportedScoreSequence(edited, game)).toBeNull();
    }
  });

  it.each(["12:01", "13:00", "00:60", "9:12", ":6.2", "PT33.1S", "", 50, null])("rejects invalid printed clock %s", clock => {
    const edited = copy(); Object.assign(edited.reportedScoreRows[0], { clockAsPrinted: clock });
    expect(validateReportedScoreFacts(edited)).toBeNull();
  });

  it("rejects missing, extra, reordered, wrong-period and out-of-page records", () => {
    const missing = copy(); missing.reportedScoreRows.pop();
    const extra = copy(); extra.reportedScoreRows.push(extra.reportedScoreRows[0]);
    const order = copy(); [order.reportedScoreRows[29], order.reportedScoreRows[30]] = [order.reportedScoreRows[30], order.reportedScoreRows[29]];
    const period = copy(); period.reportedScoreRows[0].period = 2;
    const page = copy(); page.reportedScoreRows[0].sourcePage = 13;
    const endpoint = copy(); endpoint.reportedPeriodEnds[1].awayScore = 62;
    for (const edited of [missing, extra, order, period, page, endpoint]) expect(validateReportedScoreFacts(edited)).toBeNull();
  });

  it("rejects expanded event, narrative, provider and fabricated-endpoint fields", () => {
    for (const field of ["description", "sourceLineAsExtracted", "personId", "actionNumber", "x", "y", "scoringEvents"]) {
      const edited = copy(); Object.assign(edited.reportedScoreRows[0], { [field]: "not permitted" });
      expect(validateReportedScoreFacts(edited)).toBeNull();
    }
    const fabricated = copy(); Object.assign(fabricated.reportedPeriodEnds[0], { clockAsPrinted: "00:00" });
    expect(validateReportedScoreFacts(fabricated)).toBeNull();
    expect(validateReportedScoreFacts({ ...raw, playByPlay: [] })).toBeNull();
    expect(validateReportedScoreFacts({ ...raw, liveAvailable: true })).toBeNull();
  });

  it("returns isolated copies without mutating the immutable source", () => {
    const result = getReportedScoreSequence(game)!;
    result.reportedScoreRows[0].awayScore = 900;
    result.home.teamTricode = "XXX";
    expect(getReportedScoreSequence(game)!.reportedScoreRows[0].awayScore).toBe(2);
    expect(getReportedScoreSequence(game)!.home.teamTricode).toBe("DET");
  });

  it("does not fetch a source/provider or manufacture a live feed", () => {
    const fetch = vi.fn(() => { throw new Error("Network must not be used"); });
    vi.stubGlobal("fetch", fetch);
    try {
      const sequence = getReportedScoreSequence(game)!;
      expect(fetch).not.toHaveBeenCalled();
      expect(Object.keys(sequence).sort()).toEqual(["away", "gameDate", "gameId", "home", "kind", "reportedPeriodEnds", "reportedScoreRows", "source"]);
      const loader = readFileSync("src/lib/reported-score-sequence-archive.ts", "utf8");
      expect(loader).not.toMatch(/\b(?:fetch|getGamePlayByPlay|getPlayByPlay|getBoxScore)\s*\(/);
      expect(readFileSync("src/app/game/[id]/_components/ReportedScoreSequence.tsx", "utf8")).not.toMatch(/["']use client["']/);
    } finally { vi.unstubAllGlobals(); }
  });

  it("keeps all 87 player boxes and four career archives byte-identical", () => {
    expect(readdirSync("src/data/recovered-player-boxes").filter(file => file.endsWith(".json")).length).toBeGreaterThanOrEqual(87);
    expect(readdirSync("src/data/player-career-archives").filter(file => file.endsWith(".json"))).toHaveLength(4);
    expect(Object.entries(evidence.preservedArchives)).toHaveLength(91);
    for (const [path, expected] of Object.entries(evidence.preservedArchives)) expect(sha256(readFileSync(path)), path).toBe(expected);
  });
});
