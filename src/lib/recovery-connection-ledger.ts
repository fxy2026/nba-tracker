import { collectRecoveryLedgerRows, RECOVERY_REPOSITORY } from './recovery-github-ledger';

export const CONNECTION_WORKFLOW_PATH = '.github/workflows/verify-player-provider.yml';
export const CONNECTION_PROOF = { runId: 37003396261, jobId: 110826014276, sha: 'bbb5b153779bf9460d0ab1c4752dc4d330ed92fa' } as const;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

/** Count every possible two-request attempt conservatively, including failures.
 * This evidence is only admission input; both workflows must share concurrency.
 */
export async function readConnectionLedger(get: (path: string) => Promise<unknown>, now: string) {
  try {
    const time = Date.parse(now);
    if (!Number.isFinite(time)) throw new Error('Invalid time');
    const day = now.slice(0, 10);
    const base = `/repos/${RECOVERY_REPOSITORY}/actions`;
    const workflow = await get(`${base}/workflows/verify-player-provider.yml`);
    if (!object(workflow) || !positive(workflow.id) || workflow.path !== CONNECTION_WORKFLOW_PATH) throw new Error('Wrong workflow');
    const list = await collectRecoveryLedgerRows(get, `${base}/workflows/${workflow.id}/runs`, 'workflow_runs');
    let reservedRequests = 0;
    let verified = false;
    for (const run of list.rows) {
      if (run.workflow_id !== workflow.id || !object(run.repository) || run.repository.full_name !== RECOVERY_REPOSITORY || !positive(run.run_attempt)) throw new Error('Invalid identity');
      const times = [run.created_at, run.run_started_at, run.updated_at];
      if (times.some(value => value !== null && (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || Date.parse(value) > time))) throw new Error('Invalid timestamps');
      if (typeof run.created_at !== 'string' || typeof run.updated_at !== 'string') throw new Error('Missing timestamps');
      const today = times.some(value => typeof value === 'string' && value.slice(0, 10) === day);
      if (run.status !== 'completed' || run.run_attempt > 10) throw new Error('Unsettled connection run');
      let allSkipped = true;
      for (let attempt = 1; attempt <= run.run_attempt; attempt++) {
        const jobs = await collectRecoveryLedgerRows(get, `${base}/runs/${run.id}/attempts/${attempt}/jobs`, 'jobs');
        if (jobs.rows.some(job => job.run_id !== run.id)) throw new Error('Wrong job run');
        const candidates = jobs.rows.filter(job => job.name === 'verify');
        if (candidates.length !== 1) throw new Error('Unknown connection job');
        const job = candidates[0];
        if (job.status !== 'completed' || !Array.isArray(job.steps)) throw new Error('Incomplete connection job');
        if (job.conclusion === 'skipped' && job.steps.length === 0) continue;
        allSkipped = false;
        if (run.head_sha !== CONNECTION_PROOF.sha) throw new Error('Unknown executable connection revision');
        if (run.id === CONNECTION_PROOF.runId && job.id === CONNECTION_PROOF.jobId && attempt === 1 && run.run_attempt === 1 && run.conclusion === 'success' && run.head_branch === 'master' && run.event === 'workflow_dispatch' && job.conclusion === 'success' && job.steps.some(step => object(step) && step.name === 'Check the saved secret against two known games' && step.status === 'completed' && step.conclusion === 'success')) verified = true;
      }
      if (today && !allSkipped) reservedRequests += 2 * run.run_attempt;
      if (!Number.isSafeInteger(reservedRequests)) throw new Error('Invalid reservation');
    }
    return { ok: true as const, reservedRequests, verified };
  } catch {
    return { ok: false as const };
  }
}
