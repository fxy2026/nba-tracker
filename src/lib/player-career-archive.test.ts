import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import lebron from "@/data/player-career-archives/2544-2026-10-03.json";
import jokic from "@/data/player-career-archives/203999-2026-10-03.json";
import curry from "@/data/player-career-archives/201939-2026-10-03.json";
import giannis from "@/data/player-career-archives/203507-2026-10-03.json";
import { getReviewedCareerArchive, validateReviewedCareerArchive } from "./player-career-archive";
import { validateCareerArchive } from "./player-career-archive-validation";
import { normalizePlayerCareerData } from "./player-career-data";
import { careerSourceUrl, normalizeCareerProvenance } from "./player-career-provenance";
import { coversArchivedCareer } from "./player-career-coverage";
const hash = (raw: unknown) => createHash("sha256").update(JSON.stringify(raw)).digest("hex");
const edited = (change: (value: typeof lebron) => void) => { const copy = structuredClone(lebron); change(copy); return copy; };

describe("independently reviewed official career archives", () => {
  it.each([["2544", lebron, 23, "2003-04"], ["203999", jokic, 11, "2015-16"], ["201939", curry, 17, "2009-10"], ["203507", giannis, 13, "2013-14"]] as const)("loads complete dated %s snapshot locally", async (id, raw, seasons, first) => {
    const archive = await getReviewedCareerArchive(id);
    expect(archive?.data).toEqual(raw.data);
    expect(archive?.data.careerSeasons).toHaveLength(seasons);
    expect(archive?.data.careerSeasons[0].SEASON_ID).toBe(first);
    expect(archive?.data.provenance).toMatchObject({ source: "nba-com", retrievalKind: "archived-browser-capture", coverage: { firstSeason: first, lastSeason: "2025-26", seasonCount: seasons } });
    expect(archive?.data.provenance).not.toHaveProperty("retrievedAt");
    expect(archive?.data.provenance).not.toHaveProperty("updatedAt");
    expect(archive?.data.stale).toBe(true);
    expect(careerSourceUrl(archive!.data.provenance!)).toBe(raw.source.url);
    expect(createHash("sha256").update(readFileSync(raw.evidence.path)).digest("hex")).toBe(raw.evidence.sha256);
  });

  it("uses directly captured Overall rates and averages, including source rounding", () => {
    expect(lebron.data.careerAverage).toMatchObject({ GP: 1622, MIN: 37.6, PTS: 26.8, REB: 7.5 });
    expect(jokic.data.careerAverage).toMatchObject({ GP: 810, MIN: 32, PTS: 22.2, AST: 7.5 });
    expect(jokic.data.careerShooting).toEqual({ source: "nba-browser-overall", FG_PCT: .561, FG3_PCT: .362, FT_PCT: .825 });
    expect(curry.data.careerAverage).toMatchObject({ GP: 1069, MIN: 34, PTS: 24.8, AST: 6.3 });
    expect(giannis.data.careerAverage).toMatchObject({ GP: 895, MIN: 32.7, PTS: 24.1, AST: 5 });
    expect(curry.data.careerShooting).toEqual({ source: "nba-browser-overall", FG_PCT: .471, FG3_PCT: .422, FT_PCT: .912 });
    expect(giannis.data.careerShooting).toEqual({ source: "nba-browser-overall", FG_PCT: .554, FG3_PCT: .285, FT_PCT: .691 });
  });

  it.each([[curry, "GSW"], [giannis, "MIL"]] as const)("preserves the reviewed historical teams for $0.player.name", (raw, team) => {
    expect(new Set(raw.data.careerSeasons.map(row => row.TEAM_ABBREVIATION))).toEqual(new Set([team]));
    const evidence = JSON.parse(readFileSync(raw.evidence.path, "utf8"));
    const minutes = evidence.totals.columns.indexOf("MIN");
    const summedMinutes = evidence.totals.seasonRows.reduce((sum: number, row: string[]) => sum + Number(row[minutes]), 0);
    const overallMinutes = Number(evidence.totals.overall[minutes]);
    // Preserve the captured Overall value even when source rounding differs.
    expect(summedMinutes - overallMinutes).toBe(raw.player.nbaId === "201939" ? 1 : 0);
    if (raw.player.nbaId === "201939") expect(overallMinutes).toBe(36305);
  });

  it.each([
    [lebron, "2544", "5f7b73768c91111508da248e55f8070eab71ea8ff5d39fea5c93238a8eea343b"],
    [jokic, "203999", "70b8b255c97d7a74160c7493d46dc3ef7b11c561164ad0c08d55061940a4682f"],
    [curry, "201939", "8f84c64775d19545806ccdd1480a42e4d2ed47b2dc420ee56c85bf6c7d56a716"],
    [giannis, "203507", "b73fb099aef69b35649c1f4481f40907aa9d8fef0fad4b600e04cca26b80057f"],
  ] as const)("pins the independently approved bytes for $1", (raw, id, approvedHash) => {
    expect(hash(raw)).toBe(approvedHash);
    expect(validateReviewedCareerArchive(raw, id, approvedHash)?.data).toEqual(raw.data);
    const changed = structuredClone(raw);
    changed.data.careerSeasons[0].PTS += .1;
    expect(validateReviewedCareerArchive(changed, id, approvedHash)).toBeNull();
    expect(validateReviewedCareerArchive(raw, id === "201939" ? "203507" : "201939", approvedHash)).toBeNull();
  });

  it.each(["0002544", "2544/other", "203999", "1", "__proto__"])("does not lend a LeBron archive to identity %s", id => {
    expect(validateCareerArchive(lebron, id)).toBeNull();
  });
  it.each(["1", "0002544", "__proto__"])("unknown registry identity %s returns no archive", async id => expect(await getReviewedCareerArchive(id)).toBeNull());

  it.each([
    (x: typeof lebron) => { x.schemaVersion = 2; },
    (x: typeof lebron) => { x.player.nbaId = "203999"; },
    (x: typeof lebron) => { x.player.name = "Another Player"; },
    (x: typeof lebron) => { x.source.url = "https://evil.example/2544"; },
    (x: typeof lebron) => { x.source.percentageUnit = "percent"; },
    (x: typeof lebron) => { x.evidence.sha256 = "missing"; },
    (x: typeof lebron) => { x.data.careerSeasons[0].GP = 1.5; },
    (x: typeof lebron) => { x.data.careerSeasons[0].SEASON_ID = "2003-99"; },
    (x: typeof lebron) => { x.data.careerSeasons[0].FG_PCT = 50; },
    (x: typeof lebron) => { x.data.careerSeasons[1] = x.data.careerSeasons[0]; },
    (x: typeof lebron) => { x.data.careerSeasons.reverse(); },
    (x: typeof lebron) => { x.data.careerAverage.GP--; },
    (x: typeof lebron) => { x.data.provenance.coverage.seasonCount--; },
    (x: typeof lebron) => { x.data.provenance.capturedAt = "2026-02-30T00:00:00.000Z"; },
    (x: typeof lebron) => { x.data.stale = false; },
  ])("fails closed on malformed archive %#", change => expect(validateCareerArchive(edited(change), "2544")).toBeNull());

  it.each([null, undefined, BigInt(1), {}, []])("rejects absent or unserializable reviewed payload %s", raw => {
    expect(validateReviewedCareerArchive(raw, "2544", hash(lebron))).toBeNull();
  });

  it("rejects a plausible changed value unless its exact content was independently reviewed", () => {
    const changed = edited(x => { x.data.careerSeasons[0].PTS = 22; });
    expect(validateCareerArchive(changed, "2544")).not.toBeNull();
    expect(validateReviewedCareerArchive(changed, "2544", hash(lebron))).toBeNull();
  });

  it("keeps older captured coverage valid without claiming a later season or fresh timestamp", () => {
    const older = edited(x => {
      x.data.careerSeasons.pop();
      x.data.careerAverage.GP -= 60;
      x.data.provenance.coverage.lastSeason = "2024-25";
      x.data.provenance.coverage.rowCount--;
      x.data.provenance.coverage.seasonCount--;
    });
    // Shape validation does not pretend today's date updates the record.
    // The production allowlist hash still rejects this unreviewed modification.
    expect(validateCareerArchive(older, "2544")?.data.provenance).toMatchObject({ capturedAt: lebron.data.provenance.capturedAt, coverage: { lastSeason: "2024-25" } });
    expect(validateReviewedCareerArchive(older, "2544", hash(lebron))).toBeNull();
  });

  it("preserves traded team/TOT rows without double counting game coverage", () => {
    const split = edited(x => {
      const total = x.data.careerSeasons[0]; total.TEAM_ABBREVIATION = "TOT";
      x.data.careerSeasons.splice(1, 0, { ...total, TEAM_ABBREVIATION: "CLE", GP: 50, GS: 50 }, { ...total, TEAM_ABBREVIATION: "LAL", GP: 29, GS: 29 });
      x.data.provenance.coverage.rowCount += 2;
    });
    const parsed = validateCareerArchive(split, "2544")!;
    expect(parsed.data.careerSeasons).toHaveLength(25);
    expect(coversArchivedCareer(parsed.data, normalizePlayerCareerData(lebron.data)!)).toBe(true);
  });

  it("rejects incomplete, empty, and older live coverage; permits complete updated coverage", () => {
    const data = normalizePlayerCareerData(lebron.data)!;
    expect(coversArchivedCareer({ careerSeasons: [] }, data)).toBe(false);
    expect(coversArchivedCareer({ careerSeasons: data.careerSeasons.slice(1) }, data)).toBe(false);
    expect(coversArchivedCareer({ careerSeasons: data.careerSeasons.map((r, i) => i === 22 ? { ...r, GP: 59, GS: 59 } : r) }, data)).toBe(false);
    expect(coversArchivedCareer({ careerSeasons: data.careerSeasons.map(r => ({ ...r, PTS: r.PTS + .1 })) }, data)).toBe(true);
  });

  it.each([
    { ...lebron.data, careerShooting: null },
    { ...lebron.data, careerShooting: { ...lebron.data.careerShooting, FG_PCT: 50.7 } },
    { ...lebron.data, careerAverage: undefined },
    { ...lebron.data, careerAverage: null },
  ])("rejects malformed or missing declared archived Overall values %#", raw => {
    expect(normalizePlayerCareerData(raw)).toBeNull();
  });

  it("rejects mixed live/browser provenance and never forwards arbitrary source claims", () => {
    expect(normalizePlayerCareerData({ ...lebron.data, provenance: { source: "nba-stats", providerPlayerId: "2544", scope: "regular-season", retrievalKind: "api-response", retrievedAt: "2026-10-03T03:20:00.000Z" } })).toBeNull();
    expect(normalizePlayerCareerData({ ...lebron.data, careerShooting: { ...lebron.data.careerShooting, source: "nba-career-totals" } })).toBeNull();
    expect(normalizeCareerProvenance({ ...lebron.data.provenance, verifiedAt: "today", retrievedAt: "today", sourceUrl: "evil" })).toEqual(lebron.data.provenance);
  });
});
