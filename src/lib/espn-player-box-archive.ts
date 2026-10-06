import "server-only";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import manifest from "@/data/espn-player-boxes/manifest.json";
import { isPlayerBoxQuarantined } from "./player-box-quarantine";
import { espnBoxApiUrl, validateEspnPlayerBox, type EspnBoxIdentity } from "./espn-player-box";

export const ESPN_BOX_COMPRESSED_LIMIT = 64 * 1024;
export const ESPN_BOX_DECODED_LIMIT = 128 * 1024;
export interface EspnBoxArchiveEntry {
  gameId: string; eventId: string; file: string; sha256: string; compressedSha256: string;
  bytes: number; uncompressedBytes: number; sourceRawSha256: string; sourceUrl: string; retrievedAt: string;
}
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const sha = (v: unknown) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
function validEntry(entry: EspnBoxArchiveEntry, game: EspnBoxIdentity): boolean {
  return entry.gameId === game.gameId && /^00225\d{5}$/.test(entry.gameId) && /^[1-9]\d{0,11}$/.test(entry.eventId)
    && entry.file === `${entry.gameId}.json.gz` && sha(entry.sha256) && sha(entry.compressedSha256) && sha(entry.sourceRawSha256)
    && Number.isSafeInteger(entry.bytes) && entry.bytes > 0 && entry.bytes <= ESPN_BOX_COMPRESSED_LIMIT
    && Number.isSafeInteger(entry.uncompressedBytes) && entry.uncompressedBytes > 0 && entry.uncompressedBytes <= ESPN_BOX_DECODED_LIMIT
    && entry.sourceUrl === espnBoxApiUrl(entry.eventId) && Number.isFinite(Date.parse(entry.retrievedAt));
}
export function decodeEspnPlayerBox(bytes: Buffer, entry: EspnBoxArchiveEntry, game: EspnBoxIdentity) {
  try {
    if (!validEntry(entry, game) || bytes.byteLength !== entry.bytes || bytes.byteLength > ESPN_BOX_COMPRESSED_LIMIT || hash(bytes) !== entry.compressedSha256) return null;
    const decoded = gunzipSync(bytes, { maxOutputLength: ESPN_BOX_DECODED_LIMIT });
    if (decoded.byteLength !== entry.uncompressedBytes || hash(decoded) !== entry.sha256) return null;
    const box = validateEspnPlayerBox(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decoded)), game);
    return box && box.game.espnEventId === entry.eventId && box.source.rawSha256 === entry.sourceRawSha256
      && box.source.apiUrl === entry.sourceUrl && box.retrievedAt === entry.retrievedAt ? box : null;
  } catch { return null; }
}
/** Only small, explicitly listed factual projections enter this server route. */
export async function getEspnPlayerBox(game: EspnBoxIdentity) {
  if (game.gameStatus !== 3 || isPlayerBoxQuarantined(game.gameId)) return null;
  const matches = manifest.filter(entry => entry.gameId === game.gameId);
  if (matches.length !== 1) return null;
  const entry = matches[0];
  if (!validEntry(entry, game) || manifest.filter(row => row.eventId === entry.eventId).length !== 1) return null;
  try {
    // The basename comes from the validated catalog; request paths are never read.
    const file = await open(join(process.cwd(), "src/data/espn-player-boxes", entry.file), constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size !== entry.bytes || stat.size > ESPN_BOX_COMPRESSED_LIMIT) return null;
      const buffer = Buffer.alloc(entry.bytes + 1);
      let size = 0;
      while (size < buffer.byteLength) {
        const { bytesRead } = await file.read(buffer, size, buffer.byteLength - size, null);
        if (!bytesRead) break;
        size += bytesRead;
      }
      return decodeEspnPlayerBox(buffer.subarray(0, size), entry, game);
    } finally { await file.close(); }
  } catch { return null; }
}
