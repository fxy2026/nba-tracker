import { existsSync, lstatSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { validateRecoveredPlayerBox, type RecoveredPlayerBox, type RecoveredScheduleIdentity } from '../../src/lib/recovered-player-box';
import { validateProviderPlayerSnapshot } from '../../src/lib/provider-player-snapshot';
import type { ProviderBasicSnapshot } from '../../src/lib/provider-player-normalizer';
const safeId = (id: string) => /^\d{10}$/.test(id);
export function readSnapshotDirectory(directory: string): Record<string, ProviderBasicSnapshot> {
  const result: Record<string, ProviderBasicSnapshot> = {};
  const owners = new Set<string>();
  for (const file of readdirSync(directory).sort()) {
    if(file === '.gitkeep' && lstatSync(join(directory,file)).isFile() && lstatSync(join(directory,file)).size === 0) continue;
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
function writeGeneratedAggregate(snapshots:Record<string,unknown>,output:string,movedIds:ReadonlySet<string>=new Set()) {
  if(!Object.keys(snapshots).length&&existsSync(output)){
    const previous=Object.keys(JSON.parse(readFileSync(output,'utf8')));
    if(previous.some(id=>!movedIds.has(id)))throw new Error('Empty archive cannot replace existing snapshots');
  }
  const text=JSON.stringify(snapshots,null,2)+'\n';
  if(existsSync(output)&&readFileSync(output,'utf8')===text)return;
  const temporary=`${output}.${randomUUID()}.tmp`;
  try{writeFileSync(temporary,text,{flag:'wx'});renameSync(temporary,output);}
  finally{if(existsSync(temporary))unlinkSync(temporary);}
}
export function generateSnapshotAggregate(directory:string,output:string){
  writeGeneratedAggregate(readSnapshotDirectory(directory),output);
}
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
export function readVerifiedSnapshotDirectory(directory:string,schedule:unknown):Record<string,RecoveredPlayerBox>{
  if(!record(schedule)||!Array.isArray(schedule.dates))throw new Error('Invalid schedule reference');
  const games=new Map<string,unknown>();
  for(const day of schedule.dates){if(!record(day)||!Array.isArray(day.games))throw new Error('Invalid schedule day');for(const game of day.games){if(record(game)&&typeof game.gameId==='string')games.set(game.gameId,game);}}
  const result:Record<string,RecoveredPlayerBox>={};const owners=new Set<string>();
  for(const file of readdirSync(directory).sort()){
    if(!/^\d{10}\.json$/.test(file)||!lstatSync(join(directory,file)).isFile())throw new Error('Invalid verified snapshot filename');
    const id=file.slice(0,-5),game=games.get(id),raw:unknown=JSON.parse(readFileSync(join(directory,file),'utf8'));
    if(!record(game)||typeof game.gameCode!=='string'||typeof game.gameStatus!=='number'||!record(game.homeTeam)||!record(game.awayTeam)||typeof game.homeTeam.teamTricode!=='string'||typeof game.awayTeam.teamTricode!=='string'||typeof game.homeTeam.score!=='number'||typeof game.awayTeam.score!=='number')throw new Error('Missing verified schedule identity');
    const box=validateRecoveredPlayerBox(raw,game as unknown as RecoveredScheduleIdentity);
    if(!box||box.gameId!==id||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(box.providerMatchId)||owners.has(box.providerMatchId.toLowerCase()))throw new Error('Invalid verified snapshot');
    owners.add(box.providerMatchId.toLowerCase());result[id]=box;
  }
  return result;
}
export function readStoredArchives(root='src/data'){
  const generic=readSnapshotDirectory(join(root,'provider-player-boxes'));
  const verified=readVerifiedSnapshotDirectory(join(root,'recovered-player-boxes'),JSON.parse(readFileSync(join(root,'schedule-2025-26.json'),'utf8')));
  const quarantined=readQuarantinedSnapshots(join(root,'quarantined-player-boxes'),join(root,'player-box-quarantine.json'));
  buildStoredSnapshotIndex(generic,verified,quarantined);
  return{generic,verified,quarantined};
}
export function generateStoredArchives(root='src/data'){
  // Read and validate all inputs and cross-directory identities before writing
  // either artifact. Bad data never yields a partial "successful" new build.
  const {generic,verified,quarantined}=readStoredArchives(root);
  writeGeneratedAggregate(generic,join(root,'provider-player-boxes.json'),new Set([...Object.keys(verified),...Object.keys(quarantined)]));
  writeGeneratedAggregate(verified,join(root,'recovered-player-boxes.json'));
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
