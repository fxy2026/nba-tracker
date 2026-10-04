// Offline metadata derivation only. Never reads shot packs, fetches providers or
// changes basketball records. Run manually after reviewed archive changes:
//   node scripts/generate-admin-coverage.mjs
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sha256 = value => createHash("sha256").update(value).digest("hex");
const count = value => { assert(Number.isSafeInteger(value) && value >= 0); return value; };
const days = values => {
  const dates = values.map(value => {
    assert(typeof value === "string" && Number.isFinite(Date.parse(value)));
    const day = value.slice(0, 10);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(day) && new Date(day).toISOString().slice(0, 10) === day);
    return day;
  }).sort();
  assert(dates.length > 0);
  return { first: dates[0], last: dates.at(-1) };
};

export function createAdminCoverageManifest(root = process.cwd()) {
  function section(build) {
    const inputs = [];
    const read = path => {
      const bytes = readFileSync(join(root, path));
      inputs.push([path, sha256(bytes)]);
      return bytes;
    };
    const json = path => JSON.parse(read(path).toString("utf8"));
    return { ...build(read, json), inputsSha256: sha256(JSON.stringify(inputs.sort(([a], [b]) => a.localeCompare(b)))) };
  }
  function careers(read, official) {
    const path = official ? "src/lib/player-career-archive.ts" : "src/lib/historical-career-archive.ts";
    const allowlist = read(path).toString("utf8");
    // Only the explicit immutable allowlist is eligible, not every JSON on disk.
    // Fail closed if its literal-entry format changes; never evaluate source code.
    const entries = [...allowlist.matchAll(/^  "?(\d+)"?: \{([\s\S]*?)^  \},/gm)];
    assert(entries.length > 0 && entries.length === [...allowlist.matchAll(/    read: \(\) =>/g)].length);
    assert.equal(new Set(entries.map(entry => entry[1])).size, entries.length);
    return entries.map(([, id, block]) => {
      const file = block.match(/["'](?:@\/|src\/)(data\/(?:player|historical)-career-archives\/[^"']+\.json)["']/)?.[1];
      assert(file);
      const bytes = read(`src/${file}`);
      const raw = JSON.parse(bytes.toString("utf8"));
      assert.equal(sha256(JSON.stringify(raw)), block.match(/\bsha256: "([a-f0-9]{64})"/)?.[1]);
      if (official) {
        assert(block.includes("reviewed: true"));
        assert.equal(raw.player.nbaId, id);
        assert.equal(raw.data.provenance.source, "nba-com");
        assert.equal(raw.data.provenance.scope, "regular-season");
        assert.equal(sha256(read(raw.evidence.path)), raw.evidence.sha256);
      } else {
        assert.equal(sha256(bytes), block.match(/\bsourceSha256: "([a-f0-9]{64})"/)?.[1]);
        assert.equal(raw.player.nbaPlayerId, Number(id));
        assert.equal(raw.sourceStatus, "secondary_source");
        assert.equal(raw.officialNbaVerified, false);
        assert(raw.rows.every(row => ["Regular Season", "Playoffs"].includes(row.seasonType)));
      }
      return raw;
    });
  }
  return {
    schemaVersion: 1,
    identities: section((_read, json) => {
      const raw = json("src/data/player-identity/official-all-player-identities.compact.json");
      assert.equal(raw.source.sourceType, "official-nba");
      assert.equal(raw.columns[0], "personId");
      const ids = new Set(raw.rows.map(row => count(row[0])));
      assert.equal(ids.size, raw.rows.length);
      return { source: "nba-common-all-players", playerIds: ids.size, sourceRetrievedOn: days([raw.source.retrievedDate]) };
    }),
    nbaCareers: section((read) => {
      const rows = careers(read, true);
      return { source: "nba-com-reviewed", players: rows.length, regularSeasonRows: rows.reduce((sum, row) => sum + row.data.careerSeasons.length, 0), sourceCapturedOn: days(rows.map(row => row.data.provenance.capturedAt)) };
    }),
    secondaryCareers: section((read) => {
      const archives = careers(read, false), rows = archives.flatMap(archive => archive.rows);
      return { source: "secondary-source-reviewed", players: archives.length, seasonTypeRows: rows.length, regularSeasonRows: rows.filter(row => row.seasonType === "Regular Season").length, playoffRows: rows.filter(row => row.seasonType === "Playoffs").length, officialNbaVerified: false, sourceRetrievedOn: days(archives.map(archive => archive.retrievedAt)) };
    }),
    shots: section((_read, json) => {
      const root = "src/data/historical-shot-archive/";
      const index = json(`${root}catalog-index.json`), packs = index.summaries;
      assert.equal(index.schemaVersion, 1);
      assert.equal(index.stagedArchiveCount, packs.length);
      assert.equal(new Set(packs.map(pack => `${pack.season}:${pack.seasonType}`)).size, packs.length);
      const seasons = [...new Set(packs.map(pack => pack.season))].sort();
      assert(seasons.length > 0);
      const manifests = packs.map(pack => {
        const manifest = json(`${root}${pack.file.replace("summaries/", "manifests/").replace(".json.gz", "-manifest.json")}`);
        assert.equal(manifest.output.sha256, pack.sha256);
        assert.equal(manifest.quality.csvRows, pack.fga);
        assert.equal(manifest.quality.playersWithShots, pack.playersWithShots);
        assert.equal(manifest.quality.officialCoverage, "not-officially-reconciled");
        return manifest;
      });
      return { source: "third-party-shot-archive", players: count(index.playerCount), packs: packs.length, seasons: seasons.length, firstSeason: seasons[0], lastSeason: seasons.at(-1), playerSeasonTypeEntries: packs.reduce((sum, pack) => sum + count(pack.playersWithShots), 0), acceptedAttempts: packs.reduce((sum, pack) => sum + count(pack.fga), 0), quarantinedRows: manifests.reduce((sum, manifest) => sum + count(manifest.quality.quarantinedRowCount ?? 0), 0), packsWithControlMismatches: packs.filter(pack => pack.qualityFlags.includes("one-or-more-official-control-mismatches")).length, sourceCapturedOn: null, localVerifiedOn: days(manifests.map(manifest => (manifest.source ?? manifest.provenance).metadataVerifiedAt)) };
    }),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync("src/data/admin-archive-coverage.json", `${JSON.stringify(createAdminCoverageManifest(), null, 2)}\n`);
}
