import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateProviderPlayerSnapshot } from '../../src/lib/provider-player-snapshot';
import { isQuarantinedProviderIdentity } from '../../src/lib/provider-identity-quarantine';
import type { ProviderBasicSnapshot, ProviderPlayerLine } from '../../src/lib/provider-player-normalizer';

const MAX_FILES = 40;
const MAX_BYTES = 2_000_000;
const playerFields = ['providerPlayerId','name','team','minutesRounded','points','rebounds','assists','fieldGoalsMade','fieldGoalsAttempted','threePointersMade','threePointersAttempted','freeThrowsMade','freeThrowsAttempted','offensiveRebounds','defensiveRebounds','steals','blocks','turnovers','fouls','plusMinus','starter'] as const;
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const fail = (): never => { throw new Error('Invalid pending recovery batch'); };
type BatchContext = { baseSha: string; runId: number };
type BatchManifest = BatchContext & { version: 1; files: { name: string; sha256: string }[] };

/** Explicit projection prevents unrelated response fields, environment, or logs
 * from entering the temporary recovery artifact. This is not a new data source. */
export function projectPendingSnapshot(raw: unknown): ProviderBasicSnapshot {
  const valid = validateProviderPlayerSnapshot(raw);
  if (!valid || valid.players.length > 100) return fail();
  const players = valid.players.map(player => {
    if (player.name.length > 120 || /[\u0000-\u001f\u007f]/.test(player.name)
      || isQuarantinedProviderIdentity(player.providerPlayerId, player.name)) return fail();
    return Object.fromEntries(playerFields.map(key => [key, player[key]])) as unknown as ProviderPlayerLine;
  });
  return { ...valid, players };
}

/** Create once before publication. Never contains raw upstream bodies or keys. */
export function writePendingBatch(directory: string, raw: unknown[], context: BatchContext, protectedIds: ReadonlySet<string>): void {
  if (!/^[0-9a-f]{40}$/.test(context.baseSha) || !Number.isSafeInteger(context.runId) || context.runId < 1
    || raw.length < 1 || raw.length > MAX_FILES) return fail();
  const snapshots = raw.map(projectPendingSnapshot);
  if (snapshots.some(snapshot => protectedIds.has(snapshot.game.nbaGameId))) return fail();
  if (new Set(snapshots.map(s => s.game.nbaGameId)).size !== snapshots.length
    || new Set(snapshots.map(s => s.game.providerMatchId)).size !== snapshots.length) return fail();
  const files = snapshots.map(snapshot => ({ name: `${snapshot.game.nbaGameId}.json`, text: JSON.stringify(snapshot, null, 2) + '\n' }));
  const manifest: BatchManifest = { version: 1, baseSha: context.baseSha, runId: context.runId,
    files: files.map(file => ({ name: file.name, sha256: hash(file.text) })) };
  const metadata = JSON.stringify(manifest, null, 2) + '\n';
  if (files.reduce((sum, file) => sum + Buffer.byteLength(file.text), Buffer.byteLength(metadata)) > MAX_BYTES) return fail();
  mkdirSync(directory); // Existing directories, including symlinks, are refused.
  for (const file of files) writeFileSync(join(directory, file.name), file.text, { flag: 'wx' });
  // Written last: an interrupted capture lacks a valid manifest and is rejected.
  writeFileSync(join(directory, 'manifest.json'), metadata, { flag: 'wx' });
}

/** Validate a downloaded/captured bundle before considering any data-only replay. */
export function readPendingBatch(directory: string): { context: BatchContext; snapshots: ProviderBasicSnapshot[] } {
  if (!lstatSync(directory).isDirectory()) return fail();
  const names = readdirSync(directory).sort();
  if (!names.includes('manifest.json') || names.length < 2 || names.length > MAX_FILES + 1) return fail();
  let size = 0;
  for (const name of names) {
    if (name !== 'manifest.json' && !/^\d{10}\.json$/.test(name)) return fail();
    const stat = lstatSync(join(directory, name));
    if (!stat.isFile() || (size += stat.size) > MAX_BYTES) return fail();
  }
  const manifest = JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8')) as BatchManifest;
  if (!manifest || Object.keys(manifest).sort().join(',') !== 'baseSha,files,runId,version'
    || manifest.version !== 1 || !/^[0-9a-f]{40}$/.test(manifest.baseSha)
    || !Number.isSafeInteger(manifest.runId) || manifest.runId < 1 || !Array.isArray(manifest.files)
    || manifest.files.length !== names.length - 1) return fail();
  const seen = new Set<string>(), owners = new Set<string>();
  const snapshots = manifest.files.map(file => {
    if (!file || Object.keys(file).sort().join(',') !== 'name,sha256' || !/^\d{10}\.json$/.test(file.name)
      || seen.has(file.name) || !names.includes(file.name) || !/^[0-9a-f]{64}$/.test(file.sha256)) return fail();
    seen.add(file.name);
    const text = readFileSync(join(directory, file.name), 'utf8');
    if (hash(text) !== file.sha256) return fail();
    const snapshot = projectPendingSnapshot(JSON.parse(text));
    if (file.name !== `${snapshot.game.nbaGameId}.json` || owners.has(snapshot.game.providerMatchId)
      || JSON.stringify(snapshot, null, 2) + '\n' !== text) return fail();
    owners.add(snapshot.game.providerMatchId);
    return snapshot;
  });
  return { context: { baseSha: manifest.baseSha, runId: manifest.runId }, snapshots };
}
