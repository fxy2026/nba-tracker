// Offline only. Compile with the installed TypeScript compiler, then invoke:
// node <compiled>/scripts/import-espn-player-boxes.js <collection-root> <app-root>
// Public capture bytes and metadata must already exist. No network is used.
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { gzipSync } from "node:zlib";
import { espnBoxApiUrl, parseEspnPlayerBox, type EspnBoxIdentity } from "../src/lib/espn-player-box";

const [sourceArg, appArg] = process.argv.slice(2);
if (!sourceArg || !appArg || process.argv.length !== 4) throw new Error("Usage: import-espn-player-boxes <collection-root> <app-root>");
const source = resolve(sourceArg), app = resolve(appArg), directory = join(app, "src/data/espn-player-boxes");
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const read = (path: string, maxBytes: number) => {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.size > maxBytes) throw new Error("Invalid or oversized input file");
  const bytes = readFileSync(path);
  if (bytes.byteLength !== stat.size) throw new Error("Input changed while reading");
  return bytes;
};
const schedule = JSON.parse(read(join(app, "src/data/schedule-2025-26.json"), 8 * 1024 * 1024).toString("utf8"));
const mapping: Record<string, string> = JSON.parse(read(join(app, "scripts/archive-data/espn-id-map.json"), 1024 * 1024).toString("utf8"));
const metadata = read(join(source, "fetch-manifest.jsonl"), 16 * 1024 * 1024).toString("utf8").trim().split("\n").map(line => JSON.parse(line));
// Recheck current protected stores at import time; never replace newly reviewed data.
const protectedIds = new Set(readdirSync(join(app, "src/data/recovered-player-boxes")).filter(name => /^\d{10}\.json$/.test(name)).map(name => name.slice(0, 10)));
const quarantined = JSON.parse(read(join(app, "src/data/player-box-quarantine.json"), 1024 * 1024).toString("utf8"));
for (const id of Object.keys(quarantined)) protectedIds.add(id);
const games: EspnBoxIdentity[] = schedule.dates.flatMap((day: { games: EspnBoxIdentity[] }) => day.games)
  .filter((game: EspnBoxIdentity) => /^00225\d{5}$/.test(game.gameId) && game.gameStatus === 3
    && [game.homeTeam.teamId, game.awayTeam.teamId].includes(1610612755));
if (games.length !== 82 || new Set(games.map(game => game.gameId)).size !== 82) throw new Error("Unexpected PHI regular-season scope");
const prepared = [], eventIds = new Set<string>();
for (const game of games.sort((a, b) => a.gameId.localeCompare(b.gameId))) {
  if (protectedIds.has(game.gameId)) continue;
  const eventId = mapping[game.gameId];
  if (!/^[1-9]\d{0,11}$/.test(eventId) || eventIds.has(eventId) || Object.values(mapping).filter(value => value === eventId).length !== 1) throw new Error("Ambiguous source game mapping");
  eventIds.add(eventId);
  const capturePath = `raw/espn/summaries/2026/${eventId}.json`;
  const captures = metadata.filter(row => row.path === capturePath && row.httpStatus === 200);
  const capture = captures.at(-1);
  const raw = read(join(source, capturePath), 2 * 1024 * 1024);
  if (!capture || capture.url !== espnBoxApiUrl(eventId) || capture.bytes !== raw.byteLength || capture.sha256 !== hash(raw)) throw new Error("Raw capture provenance mismatch");
  const box = parseEspnPlayerBox(JSON.parse(raw.toString("utf8")), game, { eventId, retrievedAt: capture.retrievedAt, rawSha256: capture.sha256 });
  if (!box) throw new Error(`Invalid source box for ${game.gameId}`);
  const decoded = Buffer.from(JSON.stringify(box) + "\n"), compressed = gzipSync(decoded, { level: 9 });
  if (decoded.byteLength > 128 * 1024 || compressed.byteLength > 64 * 1024) throw new Error("Projection exceeds runtime bound");
  const entry = { gameId: game.gameId, eventId, file: `${game.gameId}.json.gz`, sha256: hash(decoded), compressedSha256: hash(compressed),
    bytes: compressed.byteLength, uncompressedBytes: decoded.byteLength, sourceRawSha256: capture.sha256, sourceUrl: capture.url, retrievedAt: capture.retrievedAt };
  prepared.push({ entry, compressed, players: box.players.length, excluded: box.excluded });
}
if (prepared.length > 79) throw new Error("Batch would exceed approved 79-game scope");
const manifestPath = join(directory, "manifest.json");
const previous = existsSync(manifestPath) ? JSON.parse(read(manifestPath, 1024 * 1024).toString("utf8")) as { gameId: string; eventId: string; file: string }[] : [];
if (!Array.isArray(previous) || new Set(previous.map(row => row.gameId)).size !== previous.length || new Set(previous.map(row => row.eventId)).size !== previous.length) throw new Error("Invalid prior catalog");
// Validate the entire additions-only plan before writing. Identical reruns are no-ops.
for (const { entry, compressed } of prepared) {
  const prior = previous.find(row => row.gameId === entry.gameId);
  if (prior && JSON.stringify(prior) !== JSON.stringify(entry)) throw new Error("Existing archive provenance would change");
  if (previous.some(row => row.eventId === entry.eventId && row.gameId !== entry.gameId)) throw new Error("Existing source event already owned");
  const target = join(directory, entry.file);
  if (existsSync(target) && !read(target, 64 * 1024).equals(compressed)) throw new Error("Existing archive bytes would change");
}
const next = [...previous, ...prepared.filter(({ entry }) => !previous.some(row => row.gameId === entry.gameId)).map(({ entry }) => entry)].sort((a, b) => a.gameId.localeCompare(b.gameId));
mkdirSync(directory, { recursive: true });
for (const { entry, compressed } of prepared) if (!existsSync(join(directory, entry.file))) writeFileSync(join(directory, entry.file), compressed, { flag: "wx" });
const catalog = JSON.stringify(next, null, 2) + "\n";
if (!existsSync(manifestPath) || readFileSync(manifestPath, "utf8") !== catalog) {
  const temporary = `${manifestPath}.pending`;
  writeFileSync(temporary, catalog, { flag: "wx" });
  renameSync(temporary, manifestPath);
}
console.log(JSON.stringify({ games: prepared.length, playedRows: prepared.reduce((sum, row) => sum + row.players, 0),
  dnp: prepared.reduce((sum, row) => sum + row.excluded.dnp, 0), participationUnverified: prepared.reduce((sum, row) => sum + row.excluded.participationUnverified, 0),
  compressedBytes: prepared.reduce((sum, row) => sum + row.compressed.byteLength, 0), manifestBytes: Buffer.byteLength(catalog), protectedIds: protectedIds.size }));
