import { expect,it,vi } from 'vitest';
import evidence from './fixtures/recovery-oct3-failure-evidence.json';
import { readRecoveryRunLedger,RECOVERY_REPOSITORY } from './recovery-github-ledger';
import { calculateRecoveryRunBudget,RECOVERY_OCT3_PLAYOFF_PILOT,RECOVERY_WORKFLOW_PATH } from './recovery-run-budget';
import type { RecoveryRunBudgetInput } from './recovery-run-budget';
const now='2026-10-03T03:18:00Z';
const current={...evidence.run,id:99,head_sha:'a'.repeat(40),event:'schedule',status:'in_progress',conclusion:null,created_at:'2026-10-03T03:17:00Z',run_started_at:'2026-10-03T03:17:00Z',updated_at:now};
const fixture=()=>structuredClone(evidence);
async function read(value=fixture()){
 const get=vi.fn().mockResolvedValueOnce({id:evidence.run.workflow_id,path:RECOVERY_WORKFLOW_PATH})
  .mockResolvedValueOnce({total_count:2,workflow_runs:[current,value.run]}).mockResolvedValueOnce(value.jobs)
  .mockResolvedValueOnce({total_count:value.jobs.total_count,jobs:[]});
 return readRecoveryRunLedger(get,{id:99,runAttempt:1},now);
}
it('actual immutable failed run reserves60 and leaves170 without relabeling its outcome or reopening kickoff',async()=>{
 const result=await read();expect(result.ok).toBe(true);if(!result.ok)return;
 const prior=result.input.ledger.runs.find(row=>row.id===RECOVERY_OCT3_PLAYOFF_PILOT.runId)!;
 expect(prior.conclusion).toBe('failure');expect(prior.reviewedPilotProof).toMatchObject({maxRequests:60,postFetchValidationFailure:{quotaJobId:111093693330,quotaConclusion:'success',ingestionConclusion:'failure',fetchConclusion:'success',validationConclusion:'failure',otherProviderStepsSkipped:true}});
 expect(result.priorPushRun).toBe(true);
 expect(calculateRecoveryRunBudget(result.input)).toMatchObject({allowed:true,maxRequests:170,remaining:170,priorReservedRequests:60,knownManualRequests:0,expiresAt:'2026-10-04T00:00:00.000Z'});
});
it.each(['run-success','job-success','rerun','sha','job-id','quota-id','quota-failure','quota-step','fetch-failed','postvalidation-success','other-provider-ran','missing-provider-step','duplicate-step','additional-failure','not-completed','truncated','extra-job'])('unproven %s retains full230 reservation or rejects incomplete ledger',async kind=>{
 const value=fixture(),job=value.jobs.jobs.find(row=>row.id===RECOVERY_OCT3_PLAYOFF_PILOT.jobId)!,quota=value.jobs.jobs.find(row=>row.id===RECOVERY_OCT3_PLAYOFF_PILOT.quotaJobId)!;
 if(kind==='run-success')value.run.conclusion='success';if(kind==='job-success')job.conclusion='success';if(kind==='rerun')value.run.run_attempt=2;
 if(kind==='sha')value.run.head_sha='b'.repeat(40);if(kind==='job-id')job.id=123;if(kind==='quota-id')quota.id=124;if(kind==='quota-failure')quota.conclusion='failure';
 if(kind==='quota-step')quota.steps.find(step=>step.name==='Verify complete durable run ledger')!.conclusion='skipped';
 if(kind==='fetch-failed')job.steps.find(step=>step.name==='Fetch and normalize provider data')!.conclusion='failure';
 if(kind==='postvalidation-success')job.steps.find(step=>step.name==='Verify normalized snapshot changes')!.conclusion='success';
 if(kind==='other-provider-ran')job.steps.find(step=>step.name==='Verify known provider snapshots')!.conclusion='success';
 if(kind==='missing-provider-step')job.steps=job.steps.filter(step=>step.name!=='Restore one validated Finals player table');
 if(kind==='duplicate-step')job.steps.push(structuredClone(job.steps.find(step=>step.name==='Fetch and normalize provider data')!));
 if(kind==='additional-failure')job.steps.find(step=>step.name==='Complete job')!.conclusion='failure';
 if(kind==='not-completed')job.status='in_progress';if(kind==='truncated')value.jobs.total_count=3;
 if(kind==='extra-job'){value.jobs.jobs.push({...structuredClone(quota),id:125,name:'Unexpected job'});value.jobs.total_count=3;}
 const result=await read(value);if(kind==='truncated'){expect(result.ok).toBe(false);return;}expect(result.ok).toBe(true);if(!result.ok)return;
 expect(result.input.ledger.runs.find(row=>row.id===value.run.id)?.reviewedPilotProof).toBeUndefined();
 expect(result.priorPushRun).toBe(true);expect(calculateRecoveryRunBudget(result.input)).toMatchObject({allowed:false,maxRequests:0});
});
it.each(['observed34','missing-outcome','false-skips','wrong-quota','wrong-validation'])('pure calculator rejects an altered reviewed failure proof: %s',async kind=>{
 const result=await read();if(!result.ok)throw Error('Invalid fixture');
 const input=structuredClone(result.input) as RecoveryRunBudgetInput;
 const proof=input.ledger.runs.find(row=>row.id===RECOVERY_OCT3_PLAYOFF_PILOT.runId)!.reviewedPilotProof!;
 if(kind==='observed34')Reflect.set(proof,'maxRequests',34);
 if(kind==='missing-outcome')delete proof.postFetchValidationFailure;
 if(kind==='false-skips')Reflect.set(proof.postFetchValidationFailure!,'otherProviderStepsSkipped',false);
 if(kind==='wrong-quota')proof.postFetchValidationFailure!.quotaJobId=1;
 if(kind==='wrong-validation')Reflect.set(proof.postFetchValidationFailure!,'validationConclusion','success');
 expect(calculateRecoveryRunBudget(input)).toMatchObject({allowed:false});
});
it('unknown failed runs are never granted this reviewed60 exception',async()=>{
 const value=fixture();value.run.id=12345;for(const job of value.jobs.jobs)job.run_id=12345;
 const result=await read(value);expect(result.ok).toBe(true);if(result.ok){expect(result.input.ledger.runs[1].reviewedPilotProof).toBeUndefined();expect(calculateRecoveryRunBudget(result.input)).toMatchObject({allowed:false});}
});
it('reviewed outcome remains bound to the exact repository',async()=>{
 const result=await read();if(!result.ok)throw Error('Invalid fixture');
 const input=structuredClone(result.input);input.repository='other/repo';input.ledger.repository='other/repo';for(const row of input.ledger.runs)row.repository='other/repo';
 expect(calculateRecoveryRunBudget(input)).toMatchObject({allowed:false});expect(RECOVERY_REPOSITORY).toBe('fxy2026/nba-tracker');
});

it('contradictory skipped-job metadata cannot erase a proven executed reservation',async()=>{
 const result=await read();if(!result.ok)throw Error('Invalid fixture');const input=structuredClone(result.input);const prior=input.ledger.runs[1];
 prior.ingestionSkippedProof={source:'complete-github-job-metadata',runId:prior.id,repository:RECOVERY_REPOSITORY,workflowPath:RECOVERY_WORKFLOW_PATH,allAttemptsChecked:true,attempts:[{runAttempt:1,allJobsFetched:true,jobId:RECOVERY_OCT3_PLAYOFF_PILOT.jobId,jobName:'Ingest player data',steps:[],status:'completed',conclusion:'skipped'}]};
 expect(calculateRecoveryRunBudget(input)).toMatchObject({allowed:false});
});
