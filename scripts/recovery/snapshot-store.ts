import { existsSync, lstatSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateProviderPlayerSnapshot } from '../../src/lib/provider-player-snapshot';
import type { ProviderBasicSnapshot } from '../../src/lib/provider-player-normalizer';
const safeId = (id: string) => /^\d{10}$/.test(id);
export function readSnapshotDirectory(directory: string): Record<string, ProviderBasicSnapshot> {
  const result: Record<string, ProviderBasicSnapshot> = {};
  const owners = new Set<string>();
  for (const file of readdirSync(directory).sort()) {
    if (!/^\d{10}\.json$/.test(file) || !lstatSync(join(directory,file)).isFile()) throw new Error('Invalid snapshot filename');
    const raw: unknown = JSON.parse(readFileSync(join(directory,file),'utf8'));
    const snapshot = validateProviderPlayerSnapshot(raw);
    if (!snapshot || file !== `${snapshot.game.nbaGameId}.json` || owners.has(snapshot.game.providerMatchId)) throw new Error('Invalid stored snapshot identity');
    owners.add(snapshot.game.providerMatchId);
    // Preserve all saved values exactly; validation is not a rewrite operation.
    result[snapshot.game.nbaGameId] = raw as ProviderBasicSnapshot;
  }
  return result;
}
export function writeNewSnapshots(directory: string, snapshots: ProviderBasicSnapshot[], protectedIds: ReadonlySet<string>) {
  const prior = readSnapshotDirectory(directory);
  const ids = new Set(Object.keys(prior));
  const owners = new Set(Object.values(prior).map(snapshot => snapshot.game.providerMatchId));
  // Validate the entire batch before creating any files. Existing files are
  // immutable here, including when a source later returns empty/partial data.
  for (const raw of snapshots) {
    const snapshot = validateProviderPlayerSnapshot(raw);
    if (!snapshot || !safeId(snapshot.game.nbaGameId) || ids.has(snapshot.game.nbaGameId) || protectedIds.has(snapshot.game.nbaGameId) || owners.has(snapshot.game.providerMatchId)) throw new Error('Snapshot overwrite or invalid batch refused');
    ids.add(snapshot.game.nbaGameId); owners.add(snapshot.game.providerMatchId);
  }
  for (const snapshot of snapshots) writeFileSync(join(directory,`${snapshot.game.nbaGameId}.json`),JSON.stringify(snapshot,null,2)+'\n',{flag:'wx'});
}
export function generateSnapshotAggregate(directory: string, output: string) {
  const snapshots = readSnapshotDirectory(directory);
  if (!Object.keys(snapshots).length && existsSync(output) && Object.keys(JSON.parse(readFileSync(output,'utf8'))).length) throw new Error('Empty archive cannot replace existing snapshots');
  const text = JSON.stringify(snapshots,null,2)+'\n';
  if (existsSync(output) && readFileSync(output,'utf8') === text) return;
  const temporary = `${output}.${randomUUID()}.tmp`;
  try { writeFileSync(temporary,text,{flag:'wx'}); renameSync(temporary,output); }
  finally { if(existsSync(temporary)) unlinkSync(temporary); }
}
