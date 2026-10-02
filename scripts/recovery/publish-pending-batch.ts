import { appendFileSync } from 'node:fs';
import { publishPendingRecoveryData } from './publish-pending';
try{
 if(process.env.GITHUB_REPOSITORY!=='fxy2026/nba-tracker'||process.env.GITHUB_REF!=='refs/heads/master'
  ||process.env.GITHUB_RUN_ATTEMPT!=='1'||!['schedule','workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME??'')
  ||'BIGBALLSDATA_API_KEY'in process.env||!process.env.RUNNER_TEMP)throw Error('Invalid publication context');
 const result=publishPendingRecoveryData({repository:process.cwd(),temporaryRoot:process.env.RUNNER_TEMP,baseSha:process.env.GITHUB_SHA??'',runId:Number(process.env.GITHUB_RUN_ID)});
 const summary=result.ok?`Data publication: ${result.status}; commit ${result.commit}.\n`:
  `Data publication stopped: ${result.reason}. No force push or cursor replay was attempted. If the preceding recovery-bundle upload succeeded, its validated data is retained for7 days.\n`;
 console.log(summary.trim());if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
 if(!result.ok)process.exitCode=1;
}catch{console.error('Data publication stopped safely; no credentials or Git error bodies are logged.');process.exitCode=1;}
