import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPendingBatch } from './pending-batch';
import { readStoredArchives,buildStoredSnapshotIndex,writeNewSnapshots,generateStoredArchives } from './snapshot-store';
import { writeObservedFinals } from './official-game-store';
import { planRecoveryReplay } from '../../src/lib/recovery-replay-plan';
import { replayDataOnce,gitAuthenticationDenied,type ReplayGit,type DataReplayResult } from './replay-git';
const gitCommand:ReplayGit=(directory,args)=>execFileSync('git',['-C',directory,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60_000,maxBuffer:1_048_576});
const dataPath=(path:string)=>/^src\/data\/(?:provider-player-boxes|observed-final-games)\/\d{10}\.json$/.test(path);
const sha=(value:string)=>/^[0-9a-f]{40}$/.test(value);
const fields=(value:string)=>value.split('\0').filter(Boolean);
export type RecoveryPublicationResult=DataReplayResult
 |{ok:true;status:'no-changes'|'published';commit:string}
 |{ok:false;reason:'publication-auth-denied'|'invalid-publication'|'pending-batch-conflict'};
/** Fast path retains the existing single fetch/commit/push. Only a confirmed
 * advancement or uncertain rejected push enters the one-replay path. */
export function publishPendingRecoveryData(options:{repository:string;temporaryRoot:string;baseSha:string;runId:number},git:ReplayGit=gitCommand):RecoveryPublicationResult{
 const {repository,temporaryRoot,baseSha,runId}=options;
 if(!sha(baseSha)||!Number.isSafeInteger(runId)||runId<1)return{ok:false,reason:'invalid-context'};
 let planFailure=false;
 const replay=(candidateSha?:string):RecoveryPublicationResult=>{
  const result=replayDataOnce({repository,temporaryRoot,baseSha,candidateSha,prepareData:latestRoot=>{
   const pending=readPendingBatch(join(temporaryRoot,`nba-player-pending-${runId}`));
   if(pending.context.baseSha!==baseSha||pending.context.runId!==runId)throw Error('Invalid pending context');
   const dataRoot=join(latestRoot,'src/data'),latest=readStoredArchives(dataRoot);
   const schedule:unknown=JSON.parse(readFileSync(join(dataRoot,'schedule-2025-26.json'),'utf8'));
   const plan=planRecoveryReplay({pending,latest,schedule,now:Date.now()});
   if(!plan.ok){planFailure=true;throw Error('Conflicting replay data');}
   const observations=plan.additions.filter(row=>row.kind==='observation').map(row=>row.value);
   const snapshots=plan.additions.filter(row=>row.kind==='snapshot').map(row=>row.value);
   if(observations.length)writeObservedFinals(join(dataRoot,'observed-final-games'),observations);
   if(snapshots.length)writeNewSnapshots(join(dataRoot,'provider-player-boxes'),snapshots,buildStoredSnapshotIndex(latest.generic,latest.verified,latest.quarantined).protectedIds);
   if(plan.additions.length)generateStoredArchives(dataRoot);
   return plan.additions.map(row=>row.path);
  }},git);
  return !result.ok&&planFailure?{ok:false,reason:'pending-batch-conflict'}:result;
 };
 try{
  if(git(repository,['rev-parse','HEAD']).trim()!==baseSha)return{ok:false,reason:'invalid-context'};
  git(repository,['add','--','src/data/provider-player-boxes/','src/data/observed-final-games/','src/data/provider-recovery-state.json']);
  const staged=fields(git(repository,['diff','--cached','--name-status','-z']));
  if(!staged.length)return{ok:true,status:'no-changes',commit:baseSha};
  if(staged.length%2||staged.some((value,index)=>index%2===0?!['A','M'].includes(value):
    value==='src/data/provider-recovery-state.json'?false:!dataPath(value)||staged[index-1]!=='A'))return{ok:false,reason:'invalid-publication'};
  git(repository,['fetch','--no-tags','origin','master']);
  const latest=git(repository,['rev-parse','refs/remotes/origin/master']).trim();if(!sha(latest))return{ok:false,reason:'invalid-publication'};
  if(latest!==baseSha)return replay();
  git(repository,['-c','user.name=github-actions[bot]','-c','user.email=41898282+github-actions[bot]@users.noreply.github.com','commit','-m','Update provider player-stat snapshots']);
  const candidate=git(repository,['rev-parse','HEAD']).trim();if(!sha(candidate))return{ok:false,reason:'invalid-publication'};
  try{git(repository,['push','origin','HEAD:master']);return{ok:true,status:'published',commit:candidate};}
  catch(error){return gitAuthenticationDenied(error)?{ok:false,reason:'publication-auth-denied'}:replay(candidate);}
 }catch(error){return{ok:false,reason:gitAuthenticationDenied(error)?'publication-auth-denied':'invalid-publication'};}
}
