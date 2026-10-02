import { readFileSync,writeFileSync,renameSync,appendFileSync } from 'node:fs';
import { selectRecoveryTargets } from '../../src/lib/recovery-target-selection';
import { createRecoveryProviderClient } from '../../src/lib/recovery-provider-client';
import { validateProviderPlayerSnapshot } from '../../src/lib/provider-player-snapshot';
import { verifyKnownProviderSnapshots } from '../../src/lib/recovery-verification';
import { runPlayoffMetadataDiagnostic } from '../../src/lib/recovery-diagnostic-run';
import { runRecoveryBatch } from '../../src/lib/recovery-batch';

async function main(){
  const mode=process.env.RECOVERY_MODE;
  if(mode!=='verify'&&mode!=='backfill'&&mode!=='diagnose')throw new Error('Invalid recovery mode');
  const key=process.env.BIGBALLSDATA_API_KEY;
  if(!key){console.log('Provider secret is not configured; no requests made.');if(mode!=='backfill')throw new Error('Verification requires configured secret');return;}
  if(process.env.GITHUB_REPOSITORY!=='fxy2026/nba-tracker'||process.env.GITHUB_REF!=='refs/heads/master'||process.env.GITHUB_RUN_ATTEMPT!=='1')throw new Error('Invalid ingestion context');
  const allowance=Number(process.env.RECOVERY_MAX_REQUESTS),requested=Number(process.env.RECOVERY_REQUEST_LIMIT),expiresAt=process.env.RECOVERY_EXPIRES_AT??'';
  if(!Number.isSafeInteger(allowance)||allowance<1||allowance>100||!Number.isSafeInteger(requested)||requested<1||requested>100)throw new Error('Invalid request bound');
  if(process.env.GITHUB_EVENT_NAME==='push'&&(mode!=='diagnose'||requested!==3))throw new Error('Invalid kickoff bounds');
  const maxRequests=Math.min(allowance,requested,mode==='backfill'?100:3);
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
  const prior=read('src/data/provider-player-boxes.json');const state=read('src/data/provider-recovery-state.json');
  if(!prior||typeof prior!=='object'||Array.isArray(prior)||!verified||typeof verified!=='object'||Array.isArray(verified)||!state||typeof state!=='object'||Array.isArray(state))throw new Error('Invalid existing snapshots');
  const existingMatches=new Map<string,string>();
  for(const [gameId,raw] of Object.entries(prior)){
    const validated=validateProviderPlayerSnapshot(raw);
    if(!validated||validated.game.nbaGameId!==gameId)throw new Error('Invalid prior provider snapshot');
    if(existingMatches.has(validated.game.providerMatchId))throw new Error('Duplicate prior provider identity');
    existingMatches.set(validated.game.providerMatchId,gameId);
  }
  for(const [gameId,raw] of Object.entries(verified))if(raw&&typeof raw==='object'&&'providerMatchId'in raw&&typeof raw.providerMatchId==='string')existingMatches.set(raw.providerMatchId,gameId);
  const verifiedIds=new Set(Object.keys(verified));
  const existing=new Set([...Object.keys(prior),...verifiedIds]);
  const cursor='cursor'in state&&typeof state.cursor==='string'?state.cursor:null;
  const targets=selectRecoveryTargets(read('src/data/schedule-2025-26.json'),existing,cursor,20);
  if(!targets.length){console.log('No eligible unarchived games in the controlled target source.');return;}
  const client=createRecoveryProviderClient({apiKey:key,maxRequests,expiresAt});
  const result=await runRecoveryBatch(targets,client,maxRequests,verifiedIds,existingMatches);
  const next:Record<string,unknown>={...prior};
  for(const snapshot of result.accepted){if(verifiedIds.has(snapshot.game.nbaGameId))throw new Error('Verified snapshot overwrite refused');next[snapshot.game.nbaGameId]=snapshot;}
  const write=(path:string,value:unknown)=>{const temp=`${path}.tmp`;writeFileSync(temp,JSON.stringify(value,null,2)+'\n',{flag:'wx'});renameSync(temp,path);};
  if(result.accepted.length)write('src/data/provider-player-boxes.json',next);
  const diagnostics={requests:result.requests,accepted:result.accepted.length,withheld:result.rejected.slice(0,20)};
  if(result.requests>0)write('src/data/provider-recovery-state.json',{version:1,cursor:result.cursor??cursor,lastRunAt:new Date().toISOString(),lastBatch:diagnostics});
  const summary=`Provider recovery: ${result.requests} requests, ${result.accepted.length} accepted, ${result.rejected.length} withheld.\n`;
  console.log(summary.trim());
  for(const row of diagnostics.withheld)console.log(`Withheld ${row.gameId}: ${row.reason}`);
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary+result.rejected.map(r=>`- ${r.gameId}: ${r.reason}`).join('\n')+'\n');
}
void main().catch(()=>{console.error('Ingestion stopped safely; no credentials or upstream bodies are logged.');process.exitCode=1;});
