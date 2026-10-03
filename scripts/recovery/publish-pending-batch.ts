import { appendFileSync, readFileSync } from 'node:fs';
import { publishPendingRecoveryData } from './publish-pending';
import { validRecoveryKickoffContext, RECOVERY_KICKOFF_PATH } from '../../src/lib/recovery-kickoff';
try{
 if(process.env.GITHUB_REPOSITORY!=='fxy2026/nba-tracker'||process.env.GITHUB_REF!=='refs/heads/master'
  ||process.env.GITHUB_RUN_ATTEMPT!=='1'||!['schedule','workflow_dispatch','push'].includes(process.env.GITHUB_EVENT_NAME??'')
  ||'BIGBALLSDATA_API_KEY'in process.env||!process.env.RUNNER_TEMP)throw Error('Invalid publication context');
 if(process.env.GITHUB_EVENT_NAME==='push'){
  const eventPath=process.env.GITHUB_EVENT_PATH;
  if(process.env.RECOVERY_KICKOFF_ADMITTED!=='true'||!eventPath
   ||!validRecoveryKickoffContext(JSON.parse(readFileSync(eventPath,'utf8')),JSON.parse(readFileSync(RECOVERY_KICKOFF_PATH,'utf8')),{repository:process.env.GITHUB_REPOSITORY??'',ref:process.env.GITHUB_REF??'',sha:process.env.GITHUB_SHA??'',attempt:Number(process.env.GITHUB_RUN_ATTEMPT),now:new Date().toISOString()}))throw Error('Invalid publication kickoff');
 }
 const result=publishPendingRecoveryData({repository:process.cwd(),temporaryRoot:process.env.RUNNER_TEMP,baseSha:process.env.GITHUB_SHA??'',runId:Number(process.env.GITHUB_RUN_ID)});
 const summary=result.ok?`Data publication: ${result.status}; commit ${result.commit}.\n`:
  `Data publication stopped: ${result.reason}. No force push or cursor replay was attempted. If the preceding recovery-bundle upload succeeded, its validated data is retained for7 days.\n`;
 console.log(summary.trim());if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
 if(!result.ok)process.exitCode=1;
}catch{console.error('Data publication stopped safely; no credentials or Git error bodies are logged.');process.exitCode=1;}
