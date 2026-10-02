import { expect, it, vi } from 'vitest';
import { readConnectionLedger, CONNECTION_WORKFLOW_PATH, CONNECTION_PROOF } from './recovery-connection-ledger';
const now = '2026-10-02T12:00:00Z';
const workflow = { id: 90, path: CONNECTION_WORKFLOW_PATH };
const run = { id: CONNECTION_PROOF.runId, head_sha: CONNECTION_PROOF.sha, workflow_id: 90, repository: { full_name: 'fxy2026/nba-tracker' }, run_attempt: 1, created_at: now, run_started_at: now, updated_at: now, status: 'completed', conclusion: 'success', head_branch: 'master', event: 'workflow_dispatch' };
const jobs = { total_count: 1, jobs: [{ id: Number(CONNECTION_PROOF.jobId), run_id: Number(CONNECTION_PROOF.runId), name: 'verify', status: 'completed', conclusion: 'success', steps: [{ name: 'Check the saved secret against two known games', status: 'completed', conclusion: 'success' }] }] };
const reader = (runs: unknown[] = [run], jobRows: unknown = jobs) => vi.fn().mockResolvedValueOnce(workflow).mockResolvedValueOnce({ total_count: runs.length, workflow_runs: runs }).mockResolvedValueOnce(jobRows);
it('counts two possible calls and accepts exact successful manual-master evidence', async () => {
  expect(await readConnectionLedger(reader(), now)).toEqual({ ok: true, reservedRequests: 2, verified: true });
});
it.each([{ head_branch: 'feature' }, { event: 'pull_request' }, { conclusion: 'failure' }, { status: 'in_progress', conclusion: null }, ])('does not accept incompatible success evidence %j', async change => {
  const result = await readConnectionLedger(reader([{ ...run, ...change }]), now);
  expect(result).toMatchObject(change.status === 'in_progress' ? { ok: false } : { ok: true, verified: false, reservedRequests: 2 });
});
it('accepts prior-day proof without charging completed prior-day requests', async () => {
  const old = { ...run, created_at: '2026-10-01T12:00:00Z', run_started_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-01T12:00:10Z' };
  expect(await readConnectionLedger(reader([old]), now)).toEqual({ ok: true, reservedRequests: 0, verified: true });
});
it('charges a run spanning UTC midnight and a rerun updated today', async () => {
  const spanning = { ...run, created_at: '2026-10-01T23:59:59Z', run_started_at: '2026-10-01T23:59:59Z' };
  expect(await readConnectionLedger(reader([spanning]), now)).toMatchObject({ reservedRequests: 2 });
  const get = reader([{ ...spanning, run_attempt: 2 }]).mockResolvedValueOnce(jobs);
  expect(await readConnectionLedger(get, now)).toMatchObject({ reservedRequests: 4, verified: false });
});
it('charges uncertain old active runs rather than silently ignoring them', async () => {
  const old = { ...run, created_at: '2026-10-01T12:00:00Z', run_started_at: null, updated_at: '2026-10-01T12:00:00Z', status: 'queued', conclusion: null };
  expect(await readConnectionLedger(reader([old]), now)).toEqual({ ok: false });
});
it.each(['missing-step', 'skipped', 'wrong-run', 'duplicate-job'])('requires exact successful job/step: %s', async kind => {
  const changed = structuredClone(jobs);
  if (kind === 'missing-step') changed.jobs[0].steps = [];
  if (kind === 'skipped') changed.jobs[0].steps[0].conclusion = 'skipped';
  if (kind === 'wrong-run') changed.jobs[0].run_id = 99;
  if (kind === 'duplicate-job') { changed.jobs.push({ ...changed.jobs[0], id: 21 }); changed.total_count = 2; }
  const result = await readConnectionLedger(reader([run], changed), now);
  expect(result).toMatchObject(['wrong-run','duplicate-job'].includes(kind) ? { ok: false } : { ok: true, verified: false });
});
it.each(['wrong-workflow', 'missing', 'partial', 'future', 'wrong-repo'])('fails closed on %s metadata', async kind => {
  const get = reader([{ ...run, ...(kind === 'future' ? { updated_at: '2026-10-03T00:00:00Z' } : {}), ...(kind === 'wrong-repo' ? { repository: { full_name: 'other/repo' } } : {}) }]);
  if (kind === 'wrong-workflow') get.mockReset().mockResolvedValue({ ...workflow, path: 'wrong' });
  if (kind === 'missing') get.mockReset().mockRejectedValue(new Error('TOKEN must never appear'));
  if (kind === 'partial') get.mockReset().mockResolvedValueOnce(workflow).mockResolvedValueOnce({ total_count: 1, workflow_runs: [] });
  expect(await readConnectionLedger(get, now)).toEqual({ ok: false });
});
it('empty complete history cannot establish authentication', async () => {
  expect(await readConnectionLedger(reader([]), now)).toEqual({ ok: true, reservedRequests: 0, verified: false });
});

it('retired skipped attempts reserve zero without granting verification', async () => {
 const skipped={total_count:1,jobs:[{id:123,run_id:999,name:'verify',status:'completed',conclusion:'skipped',steps:[]}]};
 expect(await readConnectionLedger(reader([{...run,id:999,head_sha:'retired-version'}],skipped),now)).toEqual({ok:true,reservedRequests:0,verified:false});
});
it('unknown executable revision fails closed', async () => {
 expect(await readConnectionLedger(reader([{...run,head_sha:'other-version'}]),now)).toEqual({ok:false});
});
it('same title and step in another run cannot replace immutable proof', async () => {
 const otherJobs=structuredClone(jobs);otherJobs.jobs[0].run_id=999;
 expect(await readConnectionLedger(reader([{...run,id:999}],otherJobs),now)).toEqual({ok:true,reservedRequests:2,verified:false});
});
