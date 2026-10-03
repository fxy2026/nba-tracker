import { RECOVERY_REVIEWED_RUNS, RECOVERY_OCT3_PLAYOFF_PILOT, RECOVERY_INGESTION_JOB_NAME, RECOVERY_WORKFLOW_PATH, type RecoveryRunBudgetInput, type RecoveryRunRecord, type RecoveryIngestionSkipProof } from "./recovery-run-budget";

export const RECOVERY_REPOSITORY = "fxy2026/nba-tracker";
type JsonReader = (path: string) => Promise<unknown>;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const positive=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0;
export async function collectRecoveryLedgerRows(get:JsonReader,path:string,key:'workflow_runs'|'jobs') {
  const rows:Record<string,unknown>[]=[],ids=new Set<number>();let total:number|undefined,pages=0;
  for(let page=1;page<=50;page++) {
    const raw=await get(`${path}?per_page=100&page=${page}`);pages++;
    if(!object(raw)||typeof raw.total_count!=='number'||!Number.isSafeInteger(raw.total_count)||raw.total_count<0||!Array.isArray(raw[key]))throw new Error('invalid-ledger-page');
    if(total===undefined)total=raw.total_count;else if(total!==raw.total_count)throw new Error('changing-ledger');
    for(const row of raw[key]){if(!object(row)||!positive(row.id)||ids.has(row.id))throw new Error('duplicate-or-invalid-ledger-row');ids.add(row.id);rows.push(row);}
    if(rows.length>total)throw new Error('ledger-overflow');
    if(rows.length===total)return {rows,pages,total};
    if(raw[key].length===0)throw new Error('truncated-ledger');
  }
  throw new Error('ledger-page-limit');
}

// This one immutable failed run is reviewed separately from successful pilots.
// Complete job metadata must show the exact failure after its bounded fetch,
// and all other credential-bearing paths skipped. Unknown failures retain230.
function reviewedPostFetchFailure(jobs:Record<string,unknown>[],job:Record<string,unknown>):boolean {
  const fixed=RECOVERY_OCT3_PLAYOFF_PILOT;
  const step=(row:Record<string,unknown>,name:string,conclusion:string)=>Array.isArray(row.steps)
    && row.steps.filter(s=>object(s)&&s.name===name).length===1
    && row.steps.some(s=>object(s)&&s.name===name&&s.status==='completed'&&s.conclusion===conclusion);
  if(jobs.length!==2||job.conclusion!=='failure'||!Array.isArray(job.steps)
    ||job.steps.some(s=>!object(s)||typeof s.name!=='string'||s.status!=='completed')
    ||new Set(job.steps.map(s=>(s as Record<string,unknown>).name)).size!==job.steps.length
    ||job.steps.filter(s=>object(s)&&s.conclusion==='failure').length!==1)return false;
  const quota=jobs.find(row=>row.id===fixed.quotaJobId);
  if(!quota||quota.run_id!==fixed.runId||quota.run_attempt!==1||quota.head_sha!==fixed.sha||quota.head_branch!=='master'
    ||quota.name!=='Check UTC-day quota'||quota.status!=='completed'||quota.conclusion!=='success'
    ||!step(quota,'Verify complete durable run ledger','success'))return false;
  return [
    ['Verify ingestion code before credential access','success'],['Compile bounded ingestor','success'],
    ['Verify known provider snapshots','skipped'],['Diagnose one playoff metadata response','skipped'],
    ['Restore one validated Finals player table','skipped'],['Fetch and normalize provider data','success'],
    ['Verify normalized snapshot changes','failure'],['Validate temporary recovery bundle without credentials','success'],
    ['Retain validated data if publication is interrupted','success'],['Publish one data-only commit without force','skipped'],
  ].every(([name,conclusion])=>step(job,name,conclusion));
}

// Read-only adapter. The supplied reader is restricted to the GitHub API by
// its eventual transport; no log/body content is used to prove a skipped job.
export async function readRecoveryRunLedger(get:JsonReader,currentRun:{id:number;runAttempt:number},now:string):Promise<{ok:true;input:RecoveryRunBudgetInput;providerVerified:boolean;priorPushRun:boolean}|{ok:false;reason:string}> {
  try {
    if(!positive(currentRun.id)||!positive(currentRun.runAttempt)||!Number.isFinite(Date.parse(now)))throw new Error('invalid-current-run');
    const base=`/repos/${RECOVERY_REPOSITORY}`;
    const workflow=await get(`${base}/actions/workflows/player-data-ingestion.yml`);
    if(!object(workflow)||!positive(workflow.id)||workflow.path!==RECOVERY_WORKFLOW_PATH)throw new Error('workflow-identity-mismatch');
    // No created/status filters: these can hide reruns of old records or cap
    // searches at1000. Fetch every page, reject changes/incompleteness.
    const list=await collectRecoveryLedgerRows(get,`${base}/actions/workflows/${workflow.id}/runs`,'workflow_runs');
    const runs:RecoveryRunRecord[]=[];let providerVerified=false;let priorPushRun=false;
    for(const raw of list.rows){
      if(raw.workflow_id!==workflow.id||!object(raw.repository)||typeof raw.repository.full_name!=='string'||raw.repository.full_name.toLowerCase()!==RECOVERY_REPOSITORY||!positive(raw.run_attempt)||typeof raw.status!=='string'||!(raw.conclusion===null||typeof raw.conclusion==='string')||typeof raw.created_at!=='string'||!(raw.run_started_at===null||typeof raw.run_started_at==='string')||typeof raw.updated_at!=='string')throw new Error('invalid-run-metadata');
      const run:RecoveryRunRecord={id:raw.id as number,runAttempt:raw.run_attempt,repository:RECOVERY_REPOSITORY,workflowPath:RECOVERY_WORKFLOW_PATH,status:raw.status,conclusion:raw.conclusion,createdAt:raw.created_at,startedAt:raw.run_started_at,updatedAt:raw.updated_at};
      const relevant = [run.createdAt,run.startedAt,run.updatedAt].some(t=>t!==null&&t.slice(0,10)===now.slice(0,10));
      const mayVerify=raw.display_title==='Verify NBA provider'&&raw.head_branch==='master'&&raw.event==='workflow_dispatch'&&run.runAttempt===1&&run.conclusion==='success';
      const reviewed=RECOVERY_REVIEWED_RUNS.find(item=>item.runId===run.id);
      const mayPilot=!!reviewed&&raw.head_sha===reviewed.sha&&raw.head_branch==='master'&&raw.event==='push'&&run.runAttempt===1&&run.conclusion===(reviewed.runId===RECOVERY_OCT3_PLAYOFF_PILOT.runId?'failure':'success');
      if(run.id!==currentRun.id&&run.status==='completed'&&(relevant||mayVerify||mayPilot)&&run.runAttempt<=10){
        const attempts:RecoveryIngestionSkipProof['attempts']=[];
        for(let attempt=1;attempt<=run.runAttempt;attempt++){
          const jobs=await collectRecoveryLedgerRows(get,`${base}/actions/runs/${run.id}/attempts/${attempt}/jobs`,'jobs');
          if(jobs.rows.some(j=>j.run_id!==run.id))throw new Error('job-run-mismatch');
          const ingestion=jobs.rows.filter(j=>j.name===RECOVERY_INGESTION_JOB_NAME);
          if(ingestion.length!==1)break;
          const job=ingestion[0];
          if(mayPilot&&reviewed&&job.id===reviewed.jobId&&job.run_attempt===attempt&&job.head_sha===reviewed.sha&&job.head_branch==='master'&&job.status==='completed'){
            const failed=reviewed.runId===RECOVERY_OCT3_PLAYOFF_PILOT.runId;
            const matched=failed?reviewedPostFetchFailure(jobs.rows,job):job.conclusion==='success'&&Array.isArray(job.steps)&&job.steps.some(step=>object(step)&&step.name===reviewed.stepName&&step.status==='completed'&&step.conclusion==='success');
            if(matched)run.reviewedPilotProof={source:'complete-github-job-metadata',runId:run.id,jobId:reviewed.jobId,headSha:reviewed.sha,headBranch:'master',event:'push',maxRequests:reviewed.maxRequests,allJobsFetched:true,
              ...(failed?{postFetchValidationFailure:{quotaJobId:RECOVERY_OCT3_PLAYOFF_PILOT.quotaJobId,quotaConclusion:'success',ingestionConclusion:'failure',fetchConclusion:'success',validationConclusion:'failure',otherProviderStepsSkipped:true}}:{})};
          }
          if(mayVerify&&job.status==='completed'&&job.conclusion==='success'&&Array.isArray(job.steps)&&job.steps.some(step=>object(step)&&step.name==='Verify known provider snapshots'&&step.status==='completed'&&step.conclusion==='success'))providerVerified=true;
          if(job.status!=='completed'||job.conclusion!=='skipped'||!Array.isArray(job.steps)||job.steps.length!==0)break;
          attempts.push({runAttempt:attempt,allJobsFetched:true,jobId:job.id as number,jobName:RECOVERY_INGESTION_JOB_NAME,steps:[],status:'completed',conclusion:'skipped'});
        }
        if(attempts.length===run.runAttempt)run.ingestionSkippedProof={source:'complete-github-job-metadata',runId:run.id,repository:RECOVERY_REPOSITORY,workflowPath:RECOVERY_WORKFLOW_PATH,allAttemptsChecked:true,attempts};
      }
      // A dated kickoff is single-use for its UTC day, including reviewed pushes.
      // Older unknown runs still retain their conservative budget treatment.
      if(run.id!==currentRun.id&&raw.event==='push'&&(relevant||run.status!=='completed'))priorPushRun=true;
      runs.push(run);
    }
    return {ok:true,providerVerified,priorPushRun,input:{now,repository:RECOVERY_REPOSITORY,workflowPath:RECOVERY_WORKFLOW_PATH,currentRun,ledger:{repository:RECOVERY_REPOSITORY,workflowPath:RECOVERY_WORKFLOW_PATH,complete:true,allPagesFetched:true,totalCount:list.total,fetchedPages:list.pages,runs}}};
  }catch{return {ok:false,reason:'unavailable-or-unverifiable-github-ledger'};}
}
