import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import schedule from "@/data/schedule-2025-26.json";
import first from "@/data/official-period-scores/0042500401.json";
import finalsEvidence from "../../docs/evidence/game-period-scores/finals-2025-26.json";
import remainingEvidence from "../../docs/evidence/game-period-scores/remaining-2025-26.json";
import { getOfficialPeriodScores, validateReviewedPeriodScores } from "./official-period-score-archive";
import { validateOfficialPeriodScores } from "./official-period-score-validation";

const game = (id = "0042500401") => structuredClone(schedule.dates.flatMap(date => date.games).find(game => game.gameId === id)!);
const hash = (raw: unknown) => createHash("sha256").update(JSON.stringify(raw)).digest("hex");
const root = path.join(process.cwd(), "src/data/official-period-scores");
type RuntimeRecord = typeof first & { source: {
  originalPdfCapturedAt?: string | null;
  originalPdfCaptureTimestampStatus?: string;
  verifiedAt?: string;
} };
const readRecord = (id: string): RuntimeRecord => JSON.parse(readFileSync(path.join(root, `${id}.json`), "utf8"));
const evidenceGames = [...finalsEvidence.games, ...remainingEvidence.games];
// An explicit independent approval list catches accidental widening or missing
// records even if runtime imports and the evidence manifest change together.
const approvedIds = [
  "0022500340", "0022500961", "0042500101", "0042500102", "0042500103", "0042500104",
  "0042500105", "0042500106", "0042500107", "0042500111", "0042500112", "0042500113",
  "0042500114", "0042500115", "0042500116", "0042500117", "0042500121", "0042500122",
  "0042500123", "0042500124", "0042500125", "0042500126", "0042500131", "0042500132",
  "0042500133", "0042500134", "0042500135", "0042500136", "0042500137", "0042500141",
  "0042500142", "0042500143", "0042500144", "0042500151", "0042500152", "0042500153",
  "0042500154", "0042500155", "0042500161", "0042500162", "0042500163", "0042500164",
  "0042500165", "0042500166", "0042500171", "0042500172", "0042500173", "0042500174",
  "0042500175", "0042500176", "0042500201", "0042500202", "0042500203", "0042500204",
  "0042500205", "0042500206", "0042500207", "0042500211", "0042500212", "0042500213",
  "0042500214", "0042500221", "0042500222", "0042500223", "0042500224", "0042500231",
  "0042500232", "0042500233", "0042500234", "0042500235", "0042500236", "0042500301",
  "0042500302", "0042500303", "0042500304", "0042500311", "0042500312", "0042500313",
  "0042500314", "0042500315", "0042500316", "0042500317", "0042500401", "0042500402",
  "0042500403", "0042500404", "0042500405",
];
const overtime = [
  { id: "0042500136", away: [32, 19, 30, 23, 6], home: [32, 29, 31, 12, 8], tiedBoundaries: [104] },
  { id: "0042500173", away: [39, 24, 17, 21, 11], home: [32, 20, 23, 26, 7], tiedBoundaries: [101] },
  { id: "0042500205", away: [27, 25, 32, 19, 14], home: [29, 31, 20, 23, 10], tiedBoundaries: [103] },
  { id: "0042500301", away: [16, 32, 35, 18, 3], home: [23, 23, 23, 32, 14], tiedBoundaries: [101] },
  { id: "0042500311", away: [27, 24, 29, 21, 7, 14], home: [27, 17, 29, 28, 7, 7], tiedBoundaries: [101, 108] },
];
afterEach(() => vi.unstubAllGlobals());

describe("all 87 reviewed official period-score archives", () => {
  it("bounds the archive to exactly 87 approved games and matches every evidence row", () => {
    expect(approvedIds).toHaveLength(87);
    expect(finalsEvidence.games).toHaveLength(5);
    expect(remainingEvidence.games).toHaveLength(82);
    expect(evidenceGames.map(game => game.gameId).sort()).toEqual([...approvedIds].sort());
    expect(readdirSync(root).sort()).toEqual(approvedIds.map(id => `${id}.json`).sort());
    for (const source of evidenceGames) {
      const raw = readRecord(source.gameId);
      const result = getOfficialPeriodScores(game(source.gameId));
      expect(result).toEqual(raw);
      expect(result).toMatchObject({ gameId: source.gameId, gameCode: source.gameCode, gameDate: source.gameDate, source: {
        reportUrl: source.source.reportUrl, reportSha256: source.source.reportSha256,
        page: source.source.page, pageCount: source.source.pageCount,
        periodLabelsAsPrinted: source.source.periodLabelsAsPrinted,
        verifiedOn: source.source.verifiedOn,
      } });
      for (const side of ["home", "away"] as const) {
        expect(result![side]).toEqual({ teamId: source[side].teamId, teamTricode: source[side].teamTricode,
          periodPoints: source[side].periodPoints, reportedFinalScore: source[side].reportedFinalScore });
        const sum = result![side].periodPoints.reduce((sum, value) => sum + value, 0);
        expect(sum).toBe(game(source.gameId)[`${side}Team`].score);
        expect(sum).toBe(source[side].periodPointsSum);
        const printed = source[side].sourceLineAsExtracted.trim();
        expect(printed.startsWith(`${source[side].reportedTeamLabel} `)).toBe(true);
        expect(printed.slice(source[side].reportedTeamLabel.length).trim().split(/\s+/).map(Number))
          .toEqual([...result![side].periodPoints, sum]);
      }
      expect(source.identityEvidence.scheduleFile).toBe("src/data/schedule-2025-26.json");
      expect(source.identityEvidence.unchangedPlayerSnapshot).toBe(`src/data/recovered-player-boxes/${source.gameId}.json`);
      expect(path.isAbsolute(source.identityEvidence.unchangedPlayerSnapshot)).toBe(false);
      expect(createHash("sha256").update(readFileSync(source.identityEvidence.scheduleFile)).digest("hex"))
        .toBe(source.identityEvidence.scheduleSha256);
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

  it.each(["0042500406", "0042500108", "0042500305", "0022500001", "0022500341", "__proto__", "constructor", "toString", ""])("returns no archive for unsupported ID %s", gameId => {
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
    for (const source of evidenceGames) expect(getOfficialPeriodScores(game(source.gameId))).not.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});


describe("reviewed approval and canonical game context", () => {
  it("fails closed for every schedule game outside the explicit 87-game approval", () => {
    const known = new Set(approvedIds);
    const games = schedule.dates.flatMap(date => date.games);
    expect(games.filter(canonical => getOfficialPeriodScores(canonical) !== null).map(canonical => canonical.gameId).sort())
      .toEqual([...approvedIds].sort());
    for (const canonical of games) {
      if (!known.has(canonical.gameId)) expect(getOfficialPeriodScores(canonical)).toBeNull();
    }
  });

  it.each(approvedIds)("binds %s to the original schedule identity and reviewed checksum", id => {
    const raw = readRecord(id);
    const canonical = game(id);
    expect(validateReviewedPeriodScores(raw, canonical, hash(raw))).toEqual(raw);
    const changed = structuredClone(raw);
    changed.home.periodPoints[0]++;
    changed.home.periodPoints[1]--;
    expect(validateOfficialPeriodScores(changed, canonical)).not.toBeNull();
    expect(validateReviewedPeriodScores(changed, canonical, hash(raw))).toBeNull();
    expect(validateReviewedPeriodScores(raw, canonical, "0".repeat(64))).toBeNull();
    const changes: Array<(candidate: typeof canonical) => void> = [
      candidate => { candidate.gameStatus = 2; },
      candidate => { candidate.gameCode = `19000101/${candidate.awayTeam.teamTricode}${candidate.homeTeam.teamTricode}`; },
      candidate => { candidate.homeTeam.score++; },
      candidate => { candidate.awayTeam.score++; },
      candidate => { candidate.homeTeam.teamId++; },
      candidate => { candidate.awayTeam.teamId++; },
      candidate => { candidate.homeTeam.teamTricode = "XYZ"; },
      candidate => { candidate.awayTeam.teamTricode = "XYZ"; },
      candidate => { [candidate.homeTeam, candidate.awayTeam] = [candidate.awayTeam, candidate.homeTeam]; },
      candidate => { candidate.gameId = "0042500999"; },
    ];
    for (const change of changes) {
      const mismatched = structuredClone(canonical);
      change(mismatched);
      expect(getOfficialPeriodScores(mismatched)).toBeNull();
      expect(validateOfficialPeriodScores(raw, mismatched)).toBeNull();
      expect(validateReviewedPeriodScores(raw, mismatched, hash(raw))).toBeNull();
    }
  });


  it.each(["0022500340", "0022500961", "0042500311", "0042500401"])("rejects %s even when corrupted raw data and context agree", id => {
    const changes: Array<(raw: RuntimeRecord, canonical: ReturnType<typeof game>) => void> = [
      (raw, canonical) => { raw.home.teamId++; canonical.homeTeam.teamId++; },
      (raw, canonical) => { raw.away.teamId++; canonical.awayTeam.teamId++; },
      (raw, canonical) => {
        raw.home.periodPoints[0]++; raw.home.reportedFinalScore++; canonical.homeTeam.score++;
      },
      (raw, canonical) => {
        raw.gameDate = "2025-01-01";
        raw.gameCode = `20250101/${raw.away.teamTricode}${raw.home.teamTricode}`;
        canonical.gameCode = raw.gameCode;
        raw.source.reportUrl = raw.source.reportUrl.replaceAll(id === "0022500340" ? "20251205" : id === "0022500961" ? "20260313" : id === "0042500311" ? "20260518" : "20260603", "20250101");
      },
      (raw, canonical) => {
        [raw.home, raw.away] = [raw.away, raw.home];
        [canonical.homeTeam, canonical.awayTeam] = [canonical.awayTeam, canonical.homeTeam];
        const dateCode = raw.gameDate.replaceAll("-", "");
        raw.gameCode = `${dateCode}/${raw.away.teamTricode}${raw.home.teamTricode}`;
        canonical.gameCode = raw.gameCode;
        raw.source.reportUrl = `https://statsdmz.nba.com/pdfs/${dateCode}/${dateCode}_${raw.away.teamTricode}${raw.home.teamTricode}${id === "0022500961" ? "_book" : ""}.pdf`;
      },
    ];
    for (const change of changes) {
      const raw = readRecord(id);
      const canonical = game(id);
      change(raw, canonical);
      expect(validateOfficialPeriodScores(raw, canonical)).toBeNull();
      expect(validateReviewedPeriodScores(raw, canonical, hash(raw))).toBeNull();
    }
  });

  it.each(["0022500340", "0022500961", "0042500311", "0042500401"])("rejects %s unreviewed hashes, fields and foreign statistical payloads", id => {
    const changes: Array<(raw: RuntimeRecord) => void> = [
      raw => { raw.source.reportSha256 = "0".repeat(64); },
      raw => { Reflect.set(raw, "events", []); },
      raw => { Reflect.set(raw, "boxScore", {}); },
      raw => { Reflect.set(raw.home, "players", []); },
      raw => { Reflect.set(raw.source, "provider", "BigBallsData"); },
      raw => { Reflect.set(raw.source, "localPdfPath", "/tmp/report.pdf"); },
    ];
    for (const change of changes) {
      const raw = readRecord(id);
      change(raw);
      expect(validateOfficialPeriodScores(raw, game(id))).toBeNull();
    }
  });

  it.each([
    ["0042500401", "9f9db5d37d9e7fd98601568edb1ca8d2e6e55fad28f2145beb076d88dd2b70c7"],
    ["0042500402", "9f2cf39f059d46ea95d3806be7b67cb0b02aabfd1a5258e057274ac641c5559f"],
    ["0042500403", "570286aa474134ae028c3c188927cd72c3fe63e0fea256bb7a9b66103099c08f"],
    ["0042500404", "6883ce1c0f1e4308563d81dc13731a8d466a72073273d407acab2d031b0c3fc5"],
    ["0042500405", "72f8aa8a744257464532ffe5b01831386d9a60ab76b1b4982a99c0d3e92836f5"],
  ])("keeps existing Finals record %s byte-for-byte unchanged", (id, expectedHash) => {
    expect(createHash("sha256").update(readFileSync(path.join(root, `${id}.json`))).digest("hex")).toBe(expectedHash);
    const original = readRecord(id);
    for (const key of ["originalPdfCapturedAt", "originalPdfCaptureTimestampStatus", "verifiedAt"]) {
      expect(Object.hasOwn(original.source, key)).toBe(false);
    }
  });
});

describe("regulation and overtime period contracts", () => {
  it("retains precisely the four OT1 games and the one OT2 game", () => {
    const withOvertime = approvedIds.filter(id => readRecord(id).home.periodPoints.length > 4);
    expect(withOvertime).toEqual(overtime.map(fixture => fixture.id));
    for (const id of approvedIds) {
      const raw = readRecord(id);
      const expectedCount = overtime.find(fixture => fixture.id === id)?.home.length ?? 4;
      expect(raw.home.periodPoints).toHaveLength(expectedCount);
      expect(raw.away.periodPoints).toHaveLength(expectedCount);
      expect(raw.source.periodLabelsAsPrinted).toEqual(["1", "2", "3", "4", "OT1", "OT2"].slice(0, expectedCount));
    }
  });

  it.each(overtime)("preserves every independently reviewed overtime value for $id", fixture => {
    const raw = readRecord(fixture.id);
    expect(raw.home.periodPoints).toEqual(fixture.home);
    expect(raw.away.periodPoints).toEqual(fixture.away);
    expect(validateOfficialPeriodScores(raw, game(fixture.id))).toEqual(raw);
    fixture.tiedBoundaries.forEach((tiedScore, index) => {
      expect(raw.home.periodPoints.slice(0, 4 + index).reduce((sum, points) => sum + points, 0)).toBe(tiedScore);
      expect(raw.away.periodPoints.slice(0, 4 + index).reduce((sum, points) => sum + points, 0)).toBe(tiedScore);
    });
    expect(raw.home.reportedFinalScore).not.toBe(raw.away.reportedFinalScore);
  });

  it.each(overtime)("rejects $id if regulation is not tied despite unchanged final totals", fixture => {
    const raw = readRecord(fixture.id);
    raw.home.periodPoints[3]++;
    raw.home.periodPoints[4]--;
    expect(raw.home.periodPoints.reduce((sum, score) => sum + score, 0)).toBe(raw.home.reportedFinalScore);
    expect(validateOfficialPeriodScores(raw, game(fixture.id))).toBeNull();
  });

  it("rejects double overtime when OT1 does not end tied, even if regulation and finals reconcile", () => {
    const raw = readRecord("0042500311");
    raw.home.periodPoints[4]++;
    raw.home.periodPoints[5]--;
    expect(validateOfficialPeriodScores(raw, game(raw.gameId))).toBeNull();
  });

  it.each(["5", "OT", "OT2", "Q5", "ot1"])("rejects an unprinted OT1 label %s", label => {
    const raw = readRecord("0042500136");
    raw.source.periodLabelsAsPrinted[4] = label;
    expect(validateOfficialPeriodScores(raw, game(raw.gameId))).toBeNull();
  });

  it("rejects duplicated, reordered, missing, sparse or extra overtime periods", () => {
    const changes: Array<(raw: RuntimeRecord) => void> = [
      raw => { raw.source.periodLabelsAsPrinted[5] = "OT1"; },
      raw => { [raw.source.periodLabelsAsPrinted[4], raw.source.periodLabelsAsPrinted[5]] = ["OT2", "OT1"]; },
      raw => { raw.home.periodPoints[4] += raw.home.periodPoints.pop()!; },
      raw => { Reflect.deleteProperty(raw.away.periodPoints, 4); },
      raw => { raw.home.periodPoints.push(0); raw.away.periodPoints.push(0); raw.source.periodLabelsAsPrinted.push("OT3"); },
      raw => { raw.home.periodPoints[4] = -1; raw.home.periodPoints[5] += 8; },
      raw => { raw.home.periodPoints[4] += .5; raw.home.periodPoints[5] -= .5; },
      raw => { Reflect.set(raw.home.periodPoints, 4, "7"); },
    ];
    for (const change of changes) {
      const raw = readRecord("0042500311");
      change(raw);
      expect(validateOfficialPeriodScores(raw, game(raw.gameId))).toBeNull();
    }
  });

  it("does not manufacture a tied final with an extra zero overtime", () => {
    const raw = readRecord("0042500311");
    raw.home.periodPoints = [27, 17, 29, 28, 7, 7];
    raw.away.periodPoints = [...raw.home.periodPoints];
    raw.away.reportedFinalScore = raw.home.reportedFinalScore;
    const canonical = game(raw.gameId);
    canonical.awayTeam.score = canonical.homeTeam.score;
    expect(validateOfficialPeriodScores(raw, canonical)).toBeNull();
  });
});

describe("official report page and book provenance", () => {
  it("accepts the reviewed MEM–DET 19-page book only at its first score-report page", () => {
    const raw = readRecord("0022500961");
    expect(raw.source).toMatchObject({
      page: 1, pageCount: 19,
      reportUrl: "https://statsdmz.nba.com/pdfs/20260313/20260313_MEMDET_book.pdf",
    });
    expect(validateOfficialPeriodScores(raw, game(raw.gameId))).toEqual(raw);
    expect(approvedIds.filter(id => readRecord(id).source.pageCount !== 1)).toEqual(["0022500961"]);
  });

  it.each([
    ["0022500961", "page", 2],
    ["0022500961", "pageCount", 1],
    ["0022500961", "pageCount", 18],
    ["0022500961", "pageCount", 20],
    ["0022500340", "page", 2],
    ["0022500340", "pageCount", 19],
    ["0042500311", "pageCount", 2],
  ] as const)("rejects %s %s=%s", (id, key, value) => {
    const raw = readRecord(id);
    Reflect.set(raw.source, key, value);
    expect(validateOfficialPeriodScores(raw, game(id))).toBeNull();
  });

  it.each(["0022500961", "0022500340", "0042500311", "0042500401"])("rejects %s with an unreviewed report URL form", id => {
    const original = readRecord(id);
    const wrongUrls = [
      original.source.reportUrl.includes("_book.pdf")
        ? original.source.reportUrl.replace("_book.pdf", ".pdf")
        : original.source.reportUrl.replace(".pdf", "_book.pdf"),
      original.source.reportUrl.replace("https://", "http://"),
      original.source.reportUrl.replace("statsdmz.nba.com", "statsdmz.nba.com.example.org"),
      `${original.source.reportUrl}?source=unreviewed`,
      original.source.reportUrl.replace(`${original.away.teamTricode}${original.home.teamTricode}`, `${original.home.teamTricode}${original.away.teamTricode}`),
    ];
    for (const reportUrl of wrongUrls) {
      const raw = structuredClone(original);
      raw.source.reportUrl = reportUrl;
      expect(validateOfficialPeriodScores(raw, game(id))).toBeNull();
    }
  });
});

describe("capture and verification timestamps retain their distinct semantics", () => {
  it("preserves all 82 original capture findings and the text-verification checkpoint", () => {
    const counts: Record<string, number> = {};
    for (const source of remainingEvidence.games) {
      const raw = readRecord(source.gameId);
      expect(raw.source.originalPdfCapturedAt).toBe(source.source.originalPdfCapturedAt);
      expect(raw.source.originalPdfCaptureTimestampStatus).toBe(source.source.originalPdfCaptureTimestampStatus);
      expect(raw.source.verifiedAt).toBe(source.source.verifiedAt);
      expect(raw.source.verifiedAt).toBe("2026-10-03T04:47:39Z");
      expect(raw.source.verifiedOn).toBe("2026-10-03");
      expect(raw.source.verifiedAt).not.toBe(raw.source.originalPdfCapturedAt);
      const status = raw.source.originalPdfCaptureTimestampStatus!;
      counts[status] = (counts[status] ?? 0) + 1;
      if (status === "explicit-original-download-capture-record") {
        expect(typeof raw.source.originalPdfCapturedAt).toBe("string");
        expect(Date.parse(raw.source.originalPdfCapturedAt!)).toBeLessThanOrEqual(Date.parse(raw.source.verifiedAt!));
      } else {
        expect(Object.hasOwn(raw.source, "originalPdfCapturedAt")).toBe(true);
        expect(raw.source.originalPdfCapturedAt).toBeNull();
      }
    }
    expect(counts).toEqual({
      "not-recorded-in-reviewed-local-evidence": 55,
      "retrieval-or-reverification-ambiguous": 11,
      "explicit-original-download-capture-record": 16,
    });
  });

  it.each([
    ["0022500340", null, "not-recorded-in-reviewed-local-evidence"],
    ["0042500102", null, "retrieval-or-reverification-ambiguous"],
    ["0042500101", "2026-10-03T01:46:07.030893+00:00", "explicit-original-download-capture-record"],
  ])("preserves %s original capture precision or explicit null through both validators", (id, capturedAt, status) => {
    const raw = readRecord(id!);
    for (const result of [validateOfficialPeriodScores(raw, game(id!)), validateReviewedPeriodScores(raw, game(id!), hash(raw)), getOfficialPeriodScores(game(id!))]) {
      expect(result?.source).toMatchObject({ originalPdfCapturedAt: capturedAt, originalPdfCaptureTimestampStatus: status });
    }
  });

  it.each([
    ["missing capture field", (raw: RuntimeRecord) => { Reflect.deleteProperty(raw.source, "originalPdfCapturedAt"); }],
    ["missing capture status", (raw: RuntimeRecord) => { Reflect.deleteProperty(raw.source, "originalPdfCaptureTimestampStatus"); }],
    ["missing verification timestamp", (raw: RuntimeRecord) => { Reflect.deleteProperty(raw.source, "verifiedAt"); }],
    ["unknown capture status", (raw: RuntimeRecord) => { raw.source.originalPdfCaptureTimestampStatus = "verified"; }],
    ["invented missing capture", (raw: RuntimeRecord) => { raw.source.originalPdfCapturedAt = raw.source.verifiedAt!; }],
    ["claimed explicit null capture", (raw: RuntimeRecord) => { raw.source.originalPdfCaptureTimestampStatus = "explicit-original-download-capture-record"; }],
    ["verification date masquerading as timestamp", (raw: RuntimeRecord) => { raw.source.verifiedAt = "2026-10-03"; }],
    ["invalid verification timestamp", (raw: RuntimeRecord) => { raw.source.verifiedAt = "not-a-timestamp"; }],
    ["impossible verification calendar date", (raw: RuntimeRecord) => { raw.source.verifiedAt = "2026-02-30T04:47:39Z"; }],
    ["verification timestamp predates game", (raw: RuntimeRecord) => { raw.source.verifiedAt = "2025-01-01T04:47:39Z"; }],
    ["inconsistent verification day", (raw: RuntimeRecord) => { raw.source.verifiedOn = "2026-10-02"; }],
  ] as const)("rejects %s rather than normalizing missing provenance", (_label, change) => {
    const raw = readRecord("0022500340");
    change(raw);
    expect(validateOfficialPeriodScores(raw, game(raw.gameId))).toBeNull();
  });

  it.each([null, "2026-10-03", "invalid", "2026-02-30T01:46:07Z", "2026-10-04T01:46:07Z"])("rejects invalid explicit capture %s", capturedAt => {
    const raw = readRecord("0042500101");
    raw.source.originalPdfCapturedAt = capturedAt;
    expect(validateOfficialPeriodScores(raw, game(raw.gameId))).toBeNull();
  });

  it("does not convert ambiguous re-verification or provider retrieval into an original capture", () => {
    const raw = readRecord("0042500102");
    raw.source.originalPdfCapturedAt = "2026-10-02T09:49:00Z";
    expect(validateOfficialPeriodScores(raw, game(raw.gameId))).toBeNull();
  });
});
