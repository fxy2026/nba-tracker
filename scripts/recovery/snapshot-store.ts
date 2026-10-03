import { readObservedFinalDirectory } from './official-game-store';
import { createScheduleProjectionRevision } from './schedule-projection-revision';
import { observedFinalsToSchedule, mergeObservedFinalSchedule } from '../../src/lib/observed-final-schedule';
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
  if(existsSync(output)){
    const previous=Object.keys(JSON.parse(readFileSync(output,'utf8')));
    // Protect every previously generated identity, even when other new files
    // remain. A validated move to a stronger/quarantined store is explicit.
    if(previous.some(id=>!Object.hasOwn(snapshots,id)&&!movedIds.has(id)))throw new Error('Archive entries cannot be removed without a validated migration');
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
    if(!box||box.gameId!==id)throw new Error('Invalid verified snapshot');
    if(box.providerMatchId!==null){
      if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(box.providerMatchId)||owners.has(box.providerMatchId.toLowerCase()))throw new Error('Invalid verified snapshot');
      owners.add(box.providerMatchId.toLowerCase());
    }
    result[id]=box;
  }
  return result;
}
export function readStoredArchives(root='src/data'){
  const generic=readSnapshotDirectory(join(root,'provider-player-boxes'));
  const observed=readObservedFinalDirectory(join(root,'observed-final-games'));
  const archivedSchedule=JSON.parse(readFileSync(join(root,'schedule-2025-26.json'),'utf8'));
  assertObservedIdentityReferences(observed, archivedSchedule, generic);
  const schedule={...archivedSchedule,dates:mergeObservedFinalSchedule(archivedSchedule.dates,observedFinalsToSchedule(observed))};
  const verified=readVerifiedSnapshotDirectory(join(root,'recovered-player-boxes'),schedule);
  const quarantined=readQuarantinedSnapshots(join(root,'quarantined-player-boxes'),join(root,'player-box-quarantine.json'));
  assertResolvedHistory(root, verified);
  buildStoredSnapshotIndex(generic,verified,quarantined);
  return{generic,verified,quarantined,observed};
}
/** A new identity cannot silently attach a known player snapshot or baked game
 * to different teams, scores or dates. Existing observations remain immutable. */
export function assertObservedIdentityReferences(
  observed: ReturnType<typeof readObservedFinalDirectory>, schedule: unknown,
  generic: Record<string, ProviderBasicSnapshot>,
) {
  if (!record(schedule) || !Array.isArray(schedule.dates)) throw new Error('Invalid schedule reference');
  const games = new Map<string, Record<string, unknown>>();
  for (const day of schedule.dates) {
    if (!record(day) || !Array.isArray(day.games)) throw new Error('Invalid schedule reference');
    for (const game of day.games) if (record(game) && typeof game.gameId === 'string') games.set(game.gameId, game);
  }
  for (const [id, value] of Object.entries(observed)) {
    const game = value.game, prior = games.get(id), box = generic[id]?.game;
    if (prior && (prior.gameCode !== game.gameCode || prior.gameStatus !== 3
      || !record(prior.homeTeam) || !record(prior.awayTeam)
      || prior.homeTeam.teamId !== game.home.teamId || prior.awayTeam.teamId !== game.away.teamId
      || prior.homeTeam.score !== game.home.score || prior.awayTeam.score !== game.away.score)) throw new Error('Observed identity conflicts with saved schedule');
    if (box && (box.season !== game.season || box.gameDate !== game.gameDate
      || box.home.tricode !== game.home.tricode || box.away.tricode !== game.away.tricode
      || box.home.score !== game.home.score || box.away.score !== game.away.score)) throw new Error('Observed identity conflicts with saved player snapshot');
  }
}
export function generateStoredArchives(root='src/data'){
  // Read and validate all inputs and cross-directory identities before writing
  // either artifact. Bad data never yields a partial "successful" new build.
  const {generic,verified,quarantined,observed}=readStoredArchives(root);
  writeGeneratedAggregate(generic,join(root,'provider-player-boxes.json'),new Set([...Object.keys(verified),...Object.keys(quarantined)]));
  writeGeneratedAggregate(verified,join(root,'recovered-player-boxes.json'));
  writeGeneratedAggregate(observed,join(root,'observed-final-games.json'));
  // Derived at every build/test/dev entrypoint, after validation. A corrected
  // baked schedule or newly observed final gets a fresh shared-cache key.
  const schedule=JSON.parse(readFileSync(join(root,'schedule-2025-26.json'),'utf8'));
  const revision=createScheduleProjectionRevision(schedule,observed);
  const revisionFile=join(root,'schedule-projection-revision.json');
  const text=JSON.stringify(revision)+'\n';
  if(!existsSync(revisionFile)||readFileSync(revisionFile,'utf8')!==text)writeFileSync(revisionFile,text);
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
      if(kind==='verified'&&record.provider==='NBA official final report'&&match===null&&identity?.gameId===id){existing.add(id);continue;}
      if(!identity||(kind==='verified'?identity.gameId:identity.nbaGameId)!==id||typeof match!=='string'||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(match)||existingMatches.has(match.toLowerCase()))throw new Error('Conflicting stored provider identity');
      existing.add(id);existingMatches.set(match.toLowerCase(),id);
    }
  }
  return {existing,protectedIds,existingMatches};
}


function canonicalHash(value:unknown):string {
 const text=JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
 return createHash('sha256').update(text).digest('hex');
}
/** Resolved originals remain immutable evidence; they are never rendered or
 * added as a second active owner of the same game/provider match. */
export function assertResolvedHistory(root:string,verified:Record<string,RecoveredPlayerBox>){
 const supplemented=assertSupplementedHistory(root,verified);
 const path=join(root,'resolved-player-box-quarantine.json');
 const mixed=Object.values(verified).filter(box=>box.provider==='BigBallsData + NBA official final report'&&!supplemented.has(box.gameId));
 if(!existsSync(path)){if(mixed.length)throw new Error('Mixed-source recovery needs resolution history');return;}
 const registry:unknown=JSON.parse(readFileSync(path,'utf8'));
 if(!record(registry))throw new Error('Invalid resolution registry');
 const originals=readSnapshotDirectory(join(root,'resolved-player-box-originals'));
 if(Object.keys(registry).length!==Object.keys(originals).length||mixed.length!==Object.keys(registry).length)throw new Error('Resolution history coverage mismatch');
 for(const[id,original]of Object.entries(originals)){
  const entry=registry[id];const box=verified[id];
  if(!record(entry)||!record(entry.originalQuarantineMetadata)||!record(entry.resolution)||!box||box.provider!=='BigBallsData + NBA official final report')throw new Error('Unbound resolved original');
  const prior=entry.originalQuarantineMetadata,resolution=entry.resolution;
  if(prior.status!=='unresolved'||prior.identityCorrectionApplied!==false||
   prior.sourceFileSha256!==createHash('sha256').update(readFileSync(join(root,'resolved-player-box-originals',`${id}.json`))).digest('hex')||
   prior.sourceStoredSnapshotSha256!==canonicalHash(original)||JSON.stringify(prior.game)!==JSON.stringify(original.game)||
   resolution.status!=='resolved-with-independent-official-record'||resolution.identityAliasEstablished!==false||
   resolution.recoveredSnapshotSha256!==canonicalHash(box)||resolution.originalRecordCount!==original.players.length||
   box.providerMatchId!==original.game.providerMatchId||box.reportUrl!==resolution.officialReportUrl||
   resolution.officialReportSha256!==prior.officialReportSha256||resolution.officialReportUrl!==prior.officialReportUrl||
   resolution.providerPlayerIdForOfficialRow!==null)throw new Error('Resolved evidence changed or misbound');
  if(typeof resolution.resolvedOn!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(resolution.resolvedOn)||!Number.isFinite(Date.parse(resolution.resolvedOn))||
   !Array.isArray(entry.preservedRows)||entry.preservedRows.length!==resolution.providerRowsPreserved||!record(resolution.replacement))throw new Error('Invalid resolved provenance');
  const indices=new Set<number>();
  for(const mapping of entry.preservedRows){
   if(!record(mapping)||typeof mapping.sourceIndex!=='number'||!Number.isSafeInteger(mapping.sourceIndex)||mapping.sourceIndex<0||indices.has(mapping.sourceIndex))throw new Error('Invalid preserved row index');
   const source=original.players[mapping.sourceIndex],target=box.players[mapping.sourceIndex];
   if(!source||!target||target.source||mapping.name!==source.name||mapping.providerPlayerId!==source.providerPlayerId||mapping.team!==target.team||mapping.all16StatsStarterMinutesVerified!==true||mapping.originalRowSha256!==canonicalHash(source))throw new Error('Preserved player binding mismatch');
   const {team,minutes,...fields}=target;
   if(team!==mapping.team||canonicalHash({...fields,team:null,minutesRounded:minutes})!==canonicalHash(source))throw new Error('Original provider values changed');
   indices.add(mapping.sourceIndex);
  }
  const replacement=resolution.replacement;
  if(typeof replacement.sourceIndex!=='number'||!Number.isSafeInteger(replacement.sourceIndex)||replacement.sourceIndex<0||indices.has(replacement.sourceIndex))throw new Error('Invalid replacement index');
  const rejected=original.players[replacement.sourceIndex],independent=box.players[replacement.sourceIndex];
  if(!rejected||!independent||replacement.originalProviderRecordSha256!==canonicalHash(rejected)||replacement.identityAliasEstablished!==false||
    replacement.independentOfficialName!==independent.name||independent.source!=='NBA official final report'||
    !Array.isArray(prior.missingOfficialPlayedNames)||!prior.missingOfficialPlayedNames.includes(independent.name))throw new Error('Independent official replacement mismatch');
  const official=box.players.filter(player=>player.source==='NBA official final report');
  if(official.length!==1||official.length!==resolution.officialRowsAdded||box.players.length!==original.players.length||box.players.length-official.length!==resolution.providerRowsPreserved||
    official.some(player=>player.providerPlayerId!==null||player.officialSource?.reportSha256!==resolution.officialReportSha256))throw new Error('Resolved source attribution mismatch');
 }
}

/** Missing provider rows are additions, not identity replacements. Preserve the
 * previously verified partial box byte-for-byte outside the active store. */
export function assertSupplementedHistory(root:string,verified:Record<string,RecoveredPlayerBox>):Set<string>{
 const path=join(root,'supplemented-player-box-history.json');
 const active=Object.values(verified).filter(box=>box.sourceSupplement);
 if(!existsSync(path)){if(active.length)throw new Error('Supplement history missing');return new Set();}
 const registry:unknown=JSON.parse(readFileSync(path,'utf8'));
 if(!record(registry)||Object.keys(registry).length!==active.length)throw new Error('Supplement history coverage mismatch');
 const directory=join(root,'supplemented-player-box-originals');
 const files=readdirSync(directory).sort();
 if(files.length!==active.length)throw new Error('Supplement original count mismatch');
 const ids=new Set<string>();
 for(const file of files){
  if(!/^\d{10}\.json$/.test(file)||!lstatSync(join(directory,file)).isFile())throw new Error('Invalid supplement original filename');
  const id=file.slice(0,-5),entry=registry[id],box=verified[id];
  if(!record(entry)||!box?.sourceSupplement||entry.status!=='completed-with-independent-official-supplement')throw new Error('Unbound supplement original');
  const bytes=readFileSync(join(directory,file)),original:unknown=JSON.parse(bytes.toString());
  if(!record(original)||original.gameId!==id||original.provider!=='BigBallsData'||original.sourceSupplement!==undefined||!record(original.playedCoverage)||!Array.isArray(original.players)
   ||entry.originalFileSha256!==createHash('sha256').update(bytes).digest('hex')||entry.originalSnapshotSha256!==canonicalHash(original)
   ||entry.supplementedSnapshotSha256!==canonicalHash(box)||canonicalHash(entry.sourceSupplement)!==canonicalHash(box.sourceSupplement))throw new Error('Supplement original or binding changed');
  const supplement=box.sourceSupplement,coverage=original.playedCoverage;
  if(coverage.officialPlayedPlayerCount!==supplement.officialPlayedPlayerCount||coverage.reportUrl!==supplement.reportUrl||coverage.reportSha256!==supplement.reportSha256
   ||!Array.isArray(coverage.missingOfficialPlayedPlayers)||coverage.missingOfficialPlayedPlayers.length!==supplement.addedOfficialPlayerNames.length
   ||original.players.length!==supplement.originalProviderPlayerCount)throw new Error('Supplement does not close original missing coverage');
  for(let index=0;index<original.players.length;index++)if(canonicalHash(original.players[index])!==canonicalHash(box.players[index]))throw new Error('Previously verified player changed');
  const added=box.players.slice(original.players.length);
  if(added.length!==coverage.missingOfficialPlayedPlayers.length||added.some(player=>player.source!=='NBA official final report'||player.providerPlayerId!==null
   ||!(coverage.missingOfficialPlayedPlayers as unknown[]).some((missing:unknown)=>record(missing)&&missing.officialName===player.name&&missing.team===player.team)))throw new Error('Supplemented identity not independently supported');
  const expected={...original,provider:'BigBallsData + NBA official final report',players:[...original.players,...added],sourceSupplement:supplement};
  Reflect.deleteProperty(expected,'playedCoverage');
  if(canonicalHash(expected)!==canonicalHash(box))throw new Error('Original box metadata changed');
  ids.add(id);
 }
 return ids;
}
