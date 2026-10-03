import { join } from 'node:path';
import { writePendingBatch } from './pending-batch';
import { readStoredArchives, buildStoredSnapshotIndex, writeNewSnapshots } from './snapshot-store';
import { RECOVERY_DAILY_LIMIT } from "../../src/lib/recovery-run-budget";
import { readFileSync,writeFileSync,renameSync,appendFileSync } from 'node:fs';
import { currentSeason } from '../../src/lib/constants';
import { createOfficialRecoveryScheduleLoader } from '../../src/lib/recovery-official-schedule-client';
import { planCurrentRecovery, readObservedRetries, updateObservedRetries } from '../../src/lib/recovery-current-queue';
import { writeObservedFinals } from './official-game-store';
import { createRecoveryProviderClient } from '../../src/lib/recovery-provider-client';
import { verifyKnownProviderSnapshots } from '../../src/lib/recovery-verification';
import { runPlayoffMetadataDiagnostic } from '../../src/lib/recovery-diagnostic-run';
import { recoverFinalsSample } from '../../src/lib/recovery-finals-sample';
import { runRecoveryBatch } from '../../src/lib/recovery-batch';
import { validRecoveryKickoffContext, RECOVERY_KICKOFF_PATH, RECOVERY_KICKOFF_REQUEST_LIMIT } from '../../src/lib/recovery-kickoff';

async function main(){
  const mode=process.env.RECOVERY_MODE;
  if(mode!=='verify'&&mode!=='backfill'&&mode!=='diagnose'&&mode!=='restore')throw new Error('Invalid recovery mode');
  const key=process.env.BIGBALLSDATA_API_KEY;
  if(!key){console.log('Provider secret is not configured; no requests made.');if(mode!=='backfill')throw new Error('Verification requires configured secret');return;}
  if(process.env.GITHUB_REPOSITORY!=='fxy2026/nba-tracker'||process.env.GITHUB_REF!=='refs/heads/master'||process.env.GITHUB_RUN_ATTEMPT!=='1')throw new Error('Invalid ingestion context');
  const allowance=Number(process.env.RECOVERY_MAX_REQUESTS),requested=Number(process.env.RECOVERY_REQUEST_LIMIT),expiresAt=process.env.RECOVERY_EXPIRES_AT??'';
  if(!Number.isSafeInteger(allowance)||allowance<1||allowance>RECOVERY_DAILY_LIMIT||!Number.isSafeInteger(requested)||requested<1||requested>RECOVERY_DAILY_LIMIT)throw new Error('Invalid request bound');
  const kickoff=process.env.GITHUB_EVENT_NAME==='push';
  if(kickoff){
    const eventPath=process.env.GITHUB_EVENT_PATH;
    if(mode!=='backfill'||process.env.RECOVERY_KICKOFF_ADMITTED!=='true'||requested!==RECOVERY_KICKOFF_REQUEST_LIMIT||allowance!==RECOVERY_KICKOFF_REQUEST_LIMIT||!eventPath
      ||!validRecoveryKickoffContext(JSON.parse(readFileSync(eventPath,'utf8')),JSON.parse(readFileSync(RECOVERY_KICKOFF_PATH,'utf8')),{repository:process.env.GITHUB_REPOSITORY??'',ref:process.env.GITHUB_REF??'',sha:process.env.GITHUB_SHA??'',attempt:Number(process.env.GITHUB_RUN_ATTEMPT),now:new Date().toISOString()}))throw new Error('Invalid kickoff bounds');
  }else if(!['schedule','workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME??''))throw new Error('Invalid ingestion event');
  const maxRequests=Math.min(allowance,requested,kickoff?RECOVERY_KICKOFF_REQUEST_LIMIT:mode==='backfill'?RECOVERY_DAILY_LIMIT:mode==='restore'?1:3);
  const read=(path:string):unknown=>JSON.parse(readFileSync(path,'utf8'));
  const {generic:prior,verified,quarantined,observed}=readStoredArchives();
  if(mode==='verify'){
    const client=createRecoveryProviderClient({apiKey:key,maxRequests,expiresAt});
    const checked=await verifyKnownProviderSnapshots(verified,client);
    const summary=`Provider verification passed: ${checked.games} known games, ${checked.players} players, ${checked.requests} requests; no data writes.\n`;
    console.log(summary.trim());if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);return;
  }
  if(mode==='diagnose'){
    const client=createRecoveryProviderClient({apiKey:key,maxRequests,expiresAt});
    const result=await runPlayoffMetadataDiagnostic(read('src/data/schedule-2025-26.json'),client);
    const summary=JSON.stringify({type:'bounded-provider-metadata',...result});
    console.log(summary);if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary+'\n');return;
  }
  const state=read('src/data/provider-recovery-state.json');
  if(!prior||typeof prior!=='object'||Array.isArray(prior)||!verified||typeof verified!=='object'||Array.isArray(verified)||!state||typeof state!=='object'||Array.isArray(state))throw new Error('Invalid existing snapshots');
  const {existing,protectedIds:verifiedIds,existingMatches}=buildStoredSnapshotIndex(prior,verified,quarantined);
  const cursor='cursor'in state&&typeof state.cursor==='string'?state.cursor:null;
  const archive=read('src/data/schedule-2025-26.json');
  const selectedSeason=currentSeason(),retries=readObservedRetries('observedRetries'in state?state.observedRetries:undefined);
  // This is the only official request; diagnostic/verification modes returned
  // above and restore does not instantiate a schedule loader.
  const discovery=mode==='backfill'?await createOfficialRecoveryScheduleLoader().load({mode,expectedSeason:selectedSeason}):null;
  const now=new Date().toISOString();
  const plan=discovery?planCurrentRecovery({archive,observed,discovery,currentSeason:selectedSeason,existingIds:existing,historicalCursor:kickoff?null:cursor,retries,now}):null;
  const sourceSummary=discovery?`Official final discovery: ${discovery.status}; ${plan?.newObservationCount??0} new identities selected.\n`:'';
  if(sourceSummary){console.log(sourceSummary.trim());if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,sourceSummary);}
  if(plan&&!plan.targets.length){console.log('No eligible unarchived games; saved identities and snapshots retained.');return;}
  const client=createRecoveryProviderClient({apiKey:key,maxRequests,expiresAt});
  const result=mode==='restore'?await recoverFinalsSample(archive,client,existing,existingMatches):await runRecoveryBatch(plan!.targets,client,maxRequests,verifiedIds,existingMatches);
  const write=(path:string,value:unknown)=>{const temp=`${path}.tmp`;writeFileSync(temp,JSON.stringify(value,null,2)+'\n',{flag:'wx'});renameSync(temp,path);};
  if(result.accepted.length||(plan?.newObservationCount??0)>0){
    const root=process.env.RUNNER_TEMP,runId=Number(process.env.GITHUB_RUN_ID),baseSha=process.env.GITHUB_SHA??'';
    if(!root)throw new Error('Missing temporary capture directory');
    writePendingBatch(join(root,`nba-player-pending-${runId}`),result.accepted,{baseSha,runId},verifiedIds,plan?.observations??[]);
    if(plan)writeObservedFinals('src/data/observed-final-games',plan.observations);
    writeNewSnapshots('src/data/provider-player-boxes',result.accepted,verifiedIds);
  }
  const diagnostics={requests:result.requests,accepted:result.accepted.length,withheld:result.rejected.slice(0,40)};
  if(result.requests>0||(plan?.newObservationCount??0)>0){
    const nextCursor=plan?(result.cursor&&plan.historicalIds.has(result.cursor)?result.cursor:cursor):(result.cursor??cursor);
    const observedRetries=plan?updateObservedRetries(retries,result,plan.observedIds,existing,now):retries;
    write('src/data/provider-recovery-state.json',{version:2,cursor:nextCursor,observedRetries,lastRunAt:new Date().toISOString(),lastBatch:diagnostics});
  }
  const summary=`Provider recovery: ${result.requests} requests, ${result.accepted.length} accepted, ${result.rejected.length} withheld.\n`;
  console.log(summary.trim());
  for(const row of diagnostics.withheld)console.log(`Withheld ${row.gameId}: ${row.reason}`);
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary+result.rejected.map(r=>`- ${r.gameId}: ${r.reason}`).join('\n')+'\n');
}
void main().catch(()=>{console.error('Ingestion stopped safely; no credentials or upstream bodies are logged.');process.exitCode=1;});
