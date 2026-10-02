import { existsSync, lstatSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
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

export function readQuarantinedSnapshots(directory:string,metadataFile:string):Record<string,ProviderBasicSnapshot> {
  const snapshots=readSnapshotDirectory(directory);
  const metadata:unknown=JSON.parse(readFileSync(metadataFile,'utf8'));
  if(!metadata||typeof metadata!=='object'||Array.isArray(metadata))throw new Error('Invalid quarantine metadata');
  const entries=metadata as Record<string,Record<string,unknown>>;
  if(Object.keys(entries).length!==Object.keys(snapshots).length)throw new Error('Quarantine registry mismatch');
  for(const[id,snapshot]of Object.entries(snapshots)){
    const entry=entries[id];if(!entry||entry.status!=='unresolved'||entry.reason!=='unresolved-player-identity'||entry.identityCorrectionApplied!==false)throw new Error('Invalid quarantine classification');
    const hash=createHash('sha256').update(readFileSync(join(directory,`${id}.json`))).digest('hex');
    if(hash!==entry.sourceFileSha256||JSON.stringify(entry.game)!==JSON.stringify(snapshot.game))throw new Error('Quarantined original changed');
  }
  return snapshots;
}

export function buildStoredSnapshotIndex(prior:Record<string,unknown>,verified:Record<string,unknown>,quarantined:Record<string,unknown>) {
  const existing=new Set<string>();const protectedIds=new Set([...Object.keys(verified),...Object.keys(quarantined)]);const existingMatches=new Map<string,string>();
  for(const [group,kind] of [[prior,'generic'],[verified,'verified'],[quarantined,'generic']] as const){
    for(const [id,raw] of Object.entries(group)){
      if(!safeId(id)||existing.has(id)||!raw||typeof raw!=='object')throw new Error('Overlapping stored game identity');
      const record=raw as Record<string,unknown>;
      const identity=kind==='verified'?record:record.game as Record<string,unknown>|undefined;
      const match=identity?.providerMatchId;
      if(!identity||(kind==='verified'?identity.gameId:identity.nbaGameId)!==id||typeof match!=='string'||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(match)||existingMatches.has(match.toLowerCase()))throw new Error('Conflicting stored provider identity');
      existing.add(id);existingMatches.set(match.toLowerCase(),id);
    }
  }
  return {existing,protectedIds,existingMatches};
}
