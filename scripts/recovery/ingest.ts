import { readSnapshotDirectory, readQuarantinedSnapshots, buildStoredSnapshotIndex, writeNewSnapshots } from './snapshot-store';
import { RECOVERY_DAILY_LIMIT } from "../../src/lib/recovery-run-budget";
import { readFileSync,writeFileSync,renameSync,appendFileSync } from 'node:fs';
import { selectRecoveryTargets } from '../../src/lib/recovery-target-selection';
import { createRecoveryProviderClient } from '../../src/lib/recovery-provider-client';
import { verifyKnownProviderSnapshots } from '../../src/lib/recovery-verification';
import { runPlayoffMetadataDiagnostic } from '../../src/lib/recovery-diagnostic-run';
import { recoverFinalsSample } from '../../src/lib/recovery-finals-sample';
import { runRecoveryChunks } from '../../src/lib/recovery-chunks';

async function main(){
  const mode=process.env.RECOVERY_MODE;
  if(mode!=='verify'&&mode!=='backfill'&&mode!=='diagnose'&&mode!=='restore')throw new Error('Invalid recovery mode');
  const key=process.env.BIGBALLSDATA_API_KEY;
  if(!key){console.log('Provider secret is not configured; no requests made.');if(mode!=='backfill')throw new Error('Verification requires configured secret');return;}
  if(process.env.GITHUB_REPOSITORY!=='fxy2026/nba-tracker'||process.env.GITHUB_REF!=='refs/heads/master'||process.env.GITHUB_RUN_ATTEMPT!=='1')throw new Error('Invalid ingestion context');
  const allowance=Number(process.env.RECOVERY_MAX_REQUESTS),requested=Number(process.env.RECOVERY_REQUEST_LIMIT),expiresAt=process.env.RECOVERY_EXPIRES_AT??'';
  if(!Number.isSafeInteger(allowance)||allowance<1||allowance>RECOVERY_DAILY_LIMIT||!Number.isSafeInteger(requested)||requested<1||requested>RECOVERY_DAILY_LIMIT)throw new Error('Invalid request bound');
  if(process.env.GITHUB_EVENT_NAME==='push'&&(mode!=='backfill'||requested!==120))throw new Error('Invalid kickoff bounds');
  const maxRequests=Math.min(allowance,requested,mode==='backfill'?RECOVERY_DAILY_LIMIT:mode==='restore'?1:3);
  const read=(path:string):unknown=>JSON.parse(readFileSync(path,'utf8'));
  const verified=read('src/data/recovered-player-boxes.json');
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
  const quarantined=readQuarantinedSnapshots('src/data/quarantined-player-boxes','src/data/player-box-quarantine.json');
  const prior=readSnapshotDirectory('src/data/provider-player-boxes');const state=read('src/data/provider-recovery-state.json');
  if(!prior||typeof prior!=='object'||Array.isArray(prior)||!verified||typeof verified!=='object'||Array.isArray(verified)||!state||typeof state!=='object'||Array.isArray(state))throw new Error('Invalid existing snapshots');
  const {existing,protectedIds:verifiedIds,existingMatches}=buildStoredSnapshotIndex(prior,verified as Record<string,unknown>,quarantined);
  const cursor='cursor'in state&&typeof state.cursor==='string'?state.cursor:null;
  const targets=selectRecoveryTargets(read('src/data/schedule-2025-26.json'),existing,cursor,20);
  if(mode!=='restore'&&!targets.length){console.log('No eligible unarchived games in the controlled target source.');return;}
  const client=createRecoveryProviderClient({apiKey:key,maxRequests,expiresAt});
  const result=mode==='restore'?await recoverFinalsSample(read('src/data/schedule-2025-26.json'),client,existing,existingMatches):await runRecoveryChunks(read('src/data/schedule-2025-26.json'),existing,cursor,client,maxRequests,verifiedIds,existingMatches,process.env.GITHUB_EVENT_NAME==='push'?2:1);
  const write=(path:string,value:unknown)=>{const temp=`${path}.tmp`;writeFileSync(temp,JSON.stringify(value,null,2)+'\n',{flag:'wx'});renameSync(temp,path);};
  if(result.accepted.length)writeNewSnapshots('src/data/provider-player-boxes',result.accepted,verifiedIds);
  const diagnostics={requests:result.requests,accepted:result.accepted.length,withheld:result.rejected.slice(0,40)};
  if(result.requests>0)write('src/data/provider-recovery-state.json',{version:1,cursor:result.cursor??cursor,lastRunAt:new Date().toISOString(),lastBatch:diagnostics});
  const summary=`Provider recovery: ${result.requests} requests, ${result.accepted.length} accepted, ${result.rejected.length} withheld.\n`;
  console.log(summary.trim());
  for(const row of diagnostics.withheld)console.log(`Withheld ${row.gameId}: ${row.reason}`);
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary+result.rejected.map(r=>`- ${r.gameId}: ${r.reason}`).join('\n')+'\n');
}
void main().catch(()=>{console.error('Ingestion stopped safely; no credentials or upstream bodies are logged.');process.exitCode=1;});
