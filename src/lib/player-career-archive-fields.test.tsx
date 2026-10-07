import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import lebron from "@/data/player-career-archives/2544-2026-10-03.json";
import jokic from "@/data/player-career-archives/203999-2026-10-03.json";
import curry from "@/data/player-career-archives/201939-2026-10-03.json";
import giannis from "@/data/player-career-archives/203507-2026-10-03.json";
import { SeasonStatsContent } from "@/components/player/PlayerSeasonStats";
import { normalizePlayerCareerData, type CareerSeasonRow } from "./player-career-data";
import { validateCareerArchive } from "./player-career-archive-validation";
import { validateReviewedCareerArchive } from "./player-career-archive";
import { careerSeasonStats } from "./player-season-stats";

const archives = [lebron, jokic, curry, giannis];
const restoredFields = ["FGM", "FG3M", "FTM", "GS", "TOV", "PF", "OREB", "DREB"] as const;
// The Per Game source keeps GP/GS as season counts. AGE is not a career-stat field.
const sourceFields = {
  SEASON_ID: "Season", TEAM_ABBREVIATION: "TEAM", GP: "GP", GS: "GS",
  MIN: "MIN", PTS: "PTS", FGM: "FGM", FGA: "FGA", FG_PCT: "FG%",
  FG3M: "3PM", FG3A: "3PA", FG3_PCT: "3P%", FTM: "FTM", FTA: "FTA", FT_PCT: "FT%",
  OREB: "OREB", DREB: "DREB", REB: "REB", AST: "AST", STL: "STL", BLK: "BLK", TOV: "TOV", PF: "PF",
} as const;
type CapturedTable = { columns: string[]; seasonRows: string[][]; overall: string[]; capturedAt: string; originalCaptureSha256: string };
const contentHash = (raw: unknown) => createHash("sha256").update(JSON.stringify(raw)).digest("hex");

describe("all season fields retained from the existing reviewed Per Game evidence", () => {
  it.each(archives)("matches every season/team cell for $player.name", record => {
    const bytes = readFileSync(record.evidence.path);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(record.evidence.sha256);
    const evidence = JSON.parse(bytes.toString("utf8")) as { "per-game": CapturedTable; totals: CapturedTable };
    const source = evidence["per-game"];
    expect(source.capturedAt).toBe(record.data.provenance.capturedAt);
    expect(source.originalCaptureSha256).toBe(record.evidence.perGameCaptureSha256);
    expect(evidence.totals.originalCaptureSha256).toBe(record.evidence.totalsCaptureSha256);
    const sourceRows = new Map(source.seasonRows.map(cells => [
      `${cells[source.columns.indexOf("Season")]}:${cells[source.columns.indexOf("TEAM")]}`, cells,
    ]));
    expect(sourceRows.size).toBe(source.seasonRows.length);
    expect(sourceRows.size).toBe(record.data.careerSeasons.length);
    for (const row of record.data.careerSeasons) {
      const cells = sourceRows.get(`${row.SEASON_ID}:${row.TEAM_ABBREVIATION}`)!;
      expect(cells).toBeDefined();
      expect(Object.keys(row).sort()).toEqual(Object.keys(sourceFields).sort());
      for (const [key, label] of Object.entries(sourceFields)) {
        const sourceCell = cells[source.columns.indexOf(label)];
        const value = row[key as keyof typeof sourceFields];
        const context = `${record.player.nbaId} ${row.SEASON_ID} ${row.TEAM_ABBREVIATION} ${key}`;
        if (key === "SEASON_ID" || key === "TEAM_ABBREVIATION") {
          expect(value, context).toBe(sourceCell);
        } else {
          // Fail rather than coercing an empty/missing cell to an invented zero.
          expect(sourceCell, context).toMatch(/^\d+(?:\.\d+)?$/);
          if (key.endsWith("_PCT")) expect(value, context).toBeCloseTo(Number(sourceCell) / 100, 12);
          else expect(value, context).toBe(Number(sourceCell));
        }
      }
    }
    expect(validateCareerArchive(record, record.player.nbaId)?.data).toEqual(record.data);
    // Career rates and averages remain the independently displayed Overall row.
    for (const key of ["GP", "MIN", "PTS", "REB", "AST", "STL", "BLK"] as const) {
      expect(record.data.careerAverage[key]).toBe(Number(source.overall[source.columns.indexOf(key)]));
    }
    for (const key of ["FG_PCT", "FG3_PCT", "FT_PCT"] as const) {
      expect(record.data.careerShooting[key]).toBeCloseTo(Number(source.overall[source.columns.indexOf(sourceFields[key])]) / 100, 12);
    }
  });

  it.each(archives)("renders all eight restored fields for every $player.name season in both locales", record => {
    const archive = validateCareerArchive(record, record.player.nbaId)!;
    for (const row of archive.data.careerSeasons) {
      for (const locale of ["en", "zh"] as const) {
        const html = renderToStaticMarkup(createElement(SeasonStatsContent, {
          playerId: Number(record.player.nbaId), rows: [careerSeasonStats(row)], locale,
          provenance: archive.data.provenance,
        }));
        for (const key of ["GS", "TOV", "PF", "OREB", "DREB"] as const) {
          const rendered = html.match(new RegExp(`data-season-stat="${key}"[^>]*>[\\s\\S]*?<dd[^>]*>([^<]+)</dd>`));
          expect(rendered?.[1]).toBe(row[key]!.toFixed(key === "GS" ? 0 : 1));
        }
        for (const kind of ["FG", "FG3", "FT"] as const) {
          const section = html.match(new RegExp(`data-season-shooting="${kind}"[^>]*>[\\s\\S]*?</dl>`))?.[0];
          expect(section).toBeDefined();
          const values = [...section!.matchAll(/<dd[^>]*>([^<]+)<\/dd>/g)].map(match => match[1]);
          expect(values).toEqual([row[`${kind}M`]!.toFixed(1), row[`${kind}A`]!.toFixed(1)]);
        }
        expect(html).toContain(`dateTime="${record.data.provenance.capturedAt}"`);
        expect(html).not.toContain("Retrieved by this API");
      }
    }
  });

  it.each(archives)("rejects edits to every restored $player.name field against its approved content hash", record => {
    const approvedHash = contentHash(record);
    for (const key of restoredFields) {
      const changed = structuredClone(record);
      changed.data.careerSeasons[0][key] += 1;
      expect(validateReviewedCareerArchive(changed, record.player.nbaId, approvedHash)).toBeNull();
    }
  });

  it.each(restoredFields)("keeps zero, null, and missing %s distinct for other/legacy rows", key => {
    const row: CareerSeasonRow = { ...lebron.data.careerSeasons[0] };
    row[key] = 0;
    expect(normalizePlayerCareerData({ careerSeasons: [row] })?.careerSeasons[0][key]).toBe(0);
    row[key] = null;
    expect(normalizePlayerCareerData({ careerSeasons: [row] })?.careerSeasons[0][key]).toBeNull();
    delete row[key];
    expect(normalizePlayerCareerData({ careerSeasons: [row] })?.careerSeasons[0]).not.toHaveProperty(key);
  });
});
