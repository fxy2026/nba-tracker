import { readFileSync } from 'node:fs';
import { expect,it } from 'vitest';
import { RECOVERY_KICKOFF_PATH } from './recovery-kickoff';
// Existing ESLint dependency, no new package/tooling installation.
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {load}=require('js-yaml') as {load:(text:string)=>Record<string,unknown>};
const text=readFileSync('.github/workflows/player-data-ingestion.yml','utf8');
const workflow=load(text) as {on:Record<string,unknown>;permissions:Record<string,unknown>;concurrency:{group:string;'cancel-in-progress':boolean};jobs:Record<string,{name:string;permissions:Record<string,string>;steps:Record<string,unknown>[];if:string}>};
it('only exact dated master kickoff plus scheduled/operator entry, never PR credentials',()=>{expect(Object.keys(workflow.on).sort()).toEqual(['push','schedule','workflow_dispatch']);expect(workflow.on.push).toEqual({branches:['master'],paths:[RECOVERY_KICKOFF_PATH]});expect(workflow.concurrency).toEqual({group:'nba-provider-first-connectivity','cancel-in-progress':false});expect(workflow.permissions).toEqual({});});
it('quota has no providerkey orwritepermission; exactingestjob getsminimumapprovedpermissions',()=>{expect(workflow.jobs.quota.permissions).toEqual({contents:'read',actions:'read'});expect(JSON.stringify(workflow.jobs.quota)).not.toContain('BIGBALLSDATA_API_KEY');expect(workflow.jobs.ingest.name).toBe('Ingest player data');expect(workflow.jobs.ingest.permissions).toEqual({contents:'write',actions:'read'});expect(workflow.jobs.ingest.if).toContain("needs.quota.outputs.allowed == 'true'");});
it('providerkey is scoped only tofetchstep, neverlogs orURLs',()=>{const found=workflow.jobs.ingest.steps.filter(s=>JSON.stringify(s).includes('BIGBALLSDATA_API_KEY'));expect(found).toHaveLength(4);expect(found.map(s=>s.name)).toEqual(['Verify known provider snapshots','Diagnose one playoff metadata response','Restore one validated Finals player table','Fetch and normalize provider data']);expect(found.every(s=>typeof s.if==='string')).toBe(true);expect(text).not.toContain('set -x');expect(text).not.toContain('pull_request_target');expect(text).not.toContain('--force');});
it('actions are pinned anddatapublishallowlist excludescode, secrets andstrongersnapshots',()=>{for(const job of Object.values(workflow.jobs))for(const step of job.steps)if(step.uses)expect(String(step.uses)).toMatch(/^actions\/(checkout|setup-node|upload-artifact)@[0-9a-f]{40}$/);const publish=workflow.jobs.ingest.steps.find(s=>s.name==='Publish one data-only commit without force')!;expect(publish.run).toBe('node "$RUNNER_TEMP/nba-recovery-build/scripts/recovery/publish-pending-batch.js"');expect(JSON.stringify(publish)).not.toMatch(/secrets\.|BIGBALLSDATA|GITHUB_TOKEN/);expect(text).toContain('scripts/recovery/publish-pending-batch.ts --outDir');});

it('one-off connectivity has no executable provider path or secret and shares serialization',()=>{const legacy=load(readFileSync('.github/workflows/verify-player-provider.yml','utf8')) as typeof workflow;expect(legacy.jobs.verify.if).toBe('${{ false }}');expect(JSON.stringify(legacy)).not.toContain('BIGBALLSDATA_API_KEY');expect(legacy.concurrency).toEqual(workflow.concurrency);});

it('dated push routes only to admitted backfill60; normal operator/cron caps remain230',()=>{
 const step=workflow.jobs.ingest.steps.find(s=>s.name==='Fetch and normalize provider data')!;
 expect(step.if).toContain("github.event_name == 'push' && needs.quota.outputs.kickoff_admitted == 'true'");
 expect(JSON.stringify(step.env)).toContain("github.event_name == 'push' && '60'");expect(JSON.stringify(step.env)).toContain("'230'");
 expect(step.env).toMatchObject({RECOVERY_MODE:'backfill',RECOVERY_KICKOFF_ADMITTED:'${{ needs.quota.outputs.kickoff_admitted }}'});
 expect(workflow.jobs.ingest.steps.some(s=>s.name==='Diagnose fixed NBA game membership')).toBe(false);
 expect(JSON.stringify(workflow.jobs.quota)).not.toContain('membership');
 const publish=workflow.jobs.ingest.steps.find(s=>s.name==='Publish one data-only commit without force')!;
 expect(publish.if).toContain("github.event_name != 'push' || needs.quota.outputs.kickoff_admitted == 'true'");
 expect(publish.env).toEqual({RECOVERY_KICKOFF_ADMITTED:'${{ needs.quota.outputs.kickoff_admitted }}'});
});

it('temporary normalized-data artifact is validated and retained before any publication',()=>{
 const steps=workflow.jobs.ingest.steps;
 const check=steps.find(s=>s.id==='pending_bundle')!;
 const upload=steps.find(s=>String(s.uses).startsWith('actions/upload-artifact@'))!;
 const publish=steps.find(s=>s.name==='Publish one data-only commit without force')!;
 expect(check.if).toBe('always()');
 expect(check.run).toContain('check-pending-batch.js');
 expect(upload.if).toBe("always() && steps.pending_bundle.outputs.ready == 'true'");
 expect(upload.with).toEqual({name:'nba-player-pending-${{ github.run_id }}',path:'${{ runner.temp }}/nba-player-pending-${{ github.run_id }}/*.json','if-no-files-found':'error','retention-days':7,'compression-level':9,'include-hidden-files':false,overwrite:false});
 expect(steps.indexOf(check)).toBeLessThan(steps.indexOf(upload));
 expect(steps.indexOf(upload)).toBeLessThan(steps.indexOf(publish));
 expect(JSON.stringify([check,upload])).not.toMatch(/BIGBALLSDATA|secrets\.|GITHUB_TOKEN/);
 expect(publish.if).toContain("steps.verified_data.outcome == 'success'");
 expect(publish.if).toContain("steps.pending_bundle.outcome == 'success'");
 expect(publish.if).not.toContain('upload'); // successful repo persistence remains possible if artifact service fails
 expect(publish.run).toContain('publish-pending-batch.js');
 expect(readFileSync('scripts/recovery/publish-pending-batch.ts','utf8')).toContain('if(!result.ok)process.exitCode=1');
});
