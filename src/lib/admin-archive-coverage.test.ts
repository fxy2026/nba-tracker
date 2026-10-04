import { readFileSync, statSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import manifest from "@/data/admin-archive-coverage.json";
import { createAdminCoverageManifest } from "../../scripts/generate-admin-coverage.mjs";
import { getAdminArchiveCoverage, parseAdminArchiveCoverage } from "./admin-archive-coverage";

const keys = ["identities", "nbaCareers", "secondaryCareers", "shots"] as const;

describe("source-aware admin archive metadata", () => {
  it("matches reviewed allowlists, source hashes and catalog/manifests without reading shot packs", () => {
    // A changed allowlist, source byte, count or provenance date requires a
    // deliberate metadata regeneration, even when its total count stays equal.
    expect(createAdminCoverageManifest()).toEqual(manifest);
    expect(statSync("src/data/admin-archive-coverage.json").size).toBeLessThan(4096);
    const runtimeSource = readFileSync("src/lib/admin-archive-coverage.ts", "utf8");
    expect(runtimeSource).not.toMatch(/node:fs|node:zlib|historical-career-archive|historical-shot-archive/);
    expect(runtimeSource.match(/from "@\/data\//g)).toHaveLength(1);
  });

  it("keeps identity, official careers, secondary careers and shot archive scopes distinct", () => {
    const coverage = getAdminArchiveCoverage();
    expect(coverage.identities).toMatchObject({ status: "available", data: { source: "nba-common-all-players", playerIds: 5238 } });
    expect(coverage.nbaCareers).toMatchObject({ status: "available", data: { source: "nba-com-reviewed", players: 4, regularSeasonRows: 64 } });
    expect(coverage.secondaryCareers).toMatchObject({ status: "available", data: { source: "secondary-source-reviewed", players: 8, seasonTypeRows: 252, regularSeasonRows: 133, playoffRows: 119, officialNbaVerified: false } });
    expect(coverage.shots).toMatchObject({ status: "available", data: { source: "third-party-shot-archive", players: 2840, packs: 60, seasons: 30, firstSeason: "1996-97", lastSeason: "2025-26", playerSeasonTypeEntries: 20421, acceptedAttempts: 6328070, quarantinedRows: 1, packsWithControlMismatches: 2 } });
    expect(JSON.stringify(coverage)).not.toContain("inputsSha256");
  });

  it("does not turn a new report date into new source capture or local verification dates", () => {
    const before = getAdminArchiveCoverage();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
      expect(getAdminArchiveCoverage()).toEqual(before);
      expect(before.identities.data?.sourceRetrievedOn).toEqual({ first: "2026-10-03", last: "2026-10-03" });
      expect(before.nbaCareers.data?.sourceCapturedOn).toEqual({ first: "2026-10-03", last: "2026-10-03" });
      expect(before.secondaryCareers.data?.sourceRetrievedOn).toEqual({ first: "2026-10-04", last: "2026-10-04" });
      expect(before.shots.data?.sourceCapturedOn).toBeNull();
      expect(before.shots.data?.localVerifiedOn).toEqual({ first: "2026-10-03", last: "2026-10-04" });
    } finally { vi.useRealTimers(); }
  });

  it.each(keys)("isolates missing %s metadata without manufacturing a zero", key => {
    const raw: Record<string, unknown> = structuredClone(manifest);
    delete raw[key];
    const coverage = parseAdminArchiveCoverage(raw);
    expect(coverage[key]).toEqual({ status: "unavailable", data: null });
    for (const other of keys.filter(other => other !== key)) expect(coverage[other].status).toBe("available");
  });

  it.each([
    ["identities", "playerIds", -1], ["identities", "playerIds", "5238"], ["identities", "playerIds", 1.5], ["identities", "playerIds", Infinity],
    ["identities", "sourceRetrievedOn", { first: "2026-02-30", last: "2026-03-01" }],
    ["nbaCareers", "source", "secondary-source-reviewed"], ["nbaCareers", "sourceCapturedOn", null],
    ["secondaryCareers", "officialNbaVerified", true], ["secondaryCareers", "seasonTypeRows", 253],
    ["shots", "packsWithControlMismatches", 61], ["shots", "sourceCapturedOn", "2026-10-04"],
    ["shots", "firstSeason", "1996-99"], ["shots", "packs", 121], ["shots", "inputsSha256", "unreviewed"],
    ["shots", "localVerifiedOn", { first: "2026-10-04", last: "2026-10-03" }],
  ] as const)("isolates invalid %s.%s", (key, field, value) => {
    const raw = structuredClone(manifest) as unknown as Record<string, Record<string, unknown>>;
    raw[key][field] = value;
    const coverage = parseAdminArchiveCoverage(raw);
    expect(coverage[key]).toEqual({ status: "unavailable", data: null });
    expect(keys.filter(other => other !== key).every(other => coverage[other].status === "available")).toBe(true);
  });

  it.each([undefined, null, [], {}, { ...manifest, schemaVersion: 2 }])("rejects an absent or unknown report schema", raw => {
    expect(Object.values(parseAdminArchiveCoverage(raw))).toEqual(keys.map(() => ({ status: "unavailable", data: null })));
  });
});
