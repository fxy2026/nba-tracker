import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const harness = vi.hoisted(() => ({
  append: vi.fn(), read: vi.fn(), write: vi.fn(), rename: vi.fn(), save: vi.fn(),
  pending: vi.fn(), archives: vi.fn(), create: vi.fn(), run: vi.fn(), allowance: 14, connection: 2,
}));
vi.mock('node:fs', () => ({ readFileSync: harness.read, appendFileSync: harness.append, writeFileSync: harness.write, renameSync: harness.rename }));
vi.mock('../../scripts/recovery/snapshot-store', () => ({ readStoredArchives: harness.archives, writeNewSnapshots: harness.save, buildStoredSnapshotIndex: vi.fn() }));
vi.mock('../../scripts/recovery/pending-batch', () => ({ writePendingBatch: harness.pending }));
vi.mock('./recovery-membership-client', () => ({ createRecoveryMembershipClient: harness.create }));
vi.mock('./recovery-membership-run', () => ({ runMembershipDiagnostic: harness.run }));
vi.mock('./recovery-github-ledger', () => ({
  RECOVERY_REPOSITORY: 'fxy2026/nba-tracker',
  readRecoveryRunLedger: async () => ({ ok: true, providerVerified: true, priorPushRun: false, input: { now: '2026-10-02T20:30:00.000Z' } }),
}));
vi.mock('./recovery-connection-ledger', () => ({ readConnectionLedger: async () => ({ ok: true, verified: true, reservedRequests: harness.connection }) }));
vi.mock('./recovery-run-budget', async original => ({
  ...await original<typeof import('./recovery-run-budget')>(),
  calculateRecoveryRunBudget: () => ({ allowed: true, maxRequests: harness.allowance, expiresAt: '2026-10-03T00:00:00Z' }),
}));
import { RECOVERY_KICKOFF_MESSAGE, RECOVERY_KICKOFF_NONCE, RECOVERY_KICKOFF_PATH } from './recovery-kickoff';
const sha = 'a'.repeat(40);
const previousExit = process.exitCode;
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-02T20:30:00Z'));
  vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected test network request'); }));
  for (const [key, value] of Object.entries({
    GITHUB_REPOSITORY: 'fxy2026/nba-tracker', GITHUB_REF: 'refs/heads/master', GITHUB_SHA: sha,
    GITHUB_RUN_ATTEMPT: '1', GITHUB_RUN_ID: '99', GITHUB_EVENT_NAME: 'push', GITHUB_EVENT_PATH: '/TEST_EVENT',
    GITHUB_OUTPUT: '/TEST_OUTPUT', GITHUB_STEP_SUMMARY: '/TEST_SUMMARY', GITHUB_TOKEN: 'TEST_TOKEN',
    BIGBALLSDATA_API_KEY: 'TEST_PROVIDER_KEY', RECOVERY_MODE: 'membership', RECOVERY_REQUEST_LIMIT: '2',
    RECOVERY_MAX_REQUESTS: '2', RECOVERY_EXPIRES_AT: '2026-10-03T00:00:00Z',
  })) vi.stubEnv(key, value);
  harness.allowance = 14; harness.connection = 2;
  harness.read.mockImplementation((path: string) => JSON.stringify(path === RECOVERY_KICKOFF_PATH
    ? { version: 1, nonce: RECOVERY_KICKOFF_NONCE, maxRequests: 2 }
    : { ref: 'refs/heads/master', after: sha, deleted: false, repository: { full_name: 'fxy2026/nba-tracker' }, head_commit: { id: sha, message: RECOVERY_KICKOFF_MESSAGE } }));
  harness.archives.mockReturnValue({ generic: {}, verified: {}, quarantined: {} });
  harness.create.mockReturnValue({ requestsMade: 0 });
  harness.run.mockResolvedValue({ type: 'bounded-membership-diagnostic', requests: 2, results: [] });
});
afterEach(() => { process.exitCode = previousExit; vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('real gate limits a larger proven allowance to exactly two before credential access', async () => {
  await import('../../scripts/recovery/gate'); await settle();
  expect(harness.append).toHaveBeenCalledWith('/TEST_OUTPUT', 'allowed=true\nmax_requests=2\nexpires_at=2026-10-03T00:00:00Z\n');
  expect(harness.create).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
});
it('real gate refuses insufficient remaining allowance instead of starting partial evidence', async () => {
  harness.allowance = 3;
  await import('../../scripts/recovery/gate'); await settle();
  expect(harness.append).toHaveBeenCalledWith('/TEST_OUTPUT', 'allowed=false\n'); expect(harness.create).not.toHaveBeenCalled();
});
it.each(['schedule', 'workflow_dispatch'])('membership mode cannot be replayed through %s', async event => {
  vi.stubEnv('GITHUB_EVENT_NAME', event);
  await import('../../scripts/recovery/gate'); await settle();
  expect(harness.append).toHaveBeenCalledWith('/TEST_OUTPUT', 'allowed=false\n');
});
it('ordinary push/backfill mismatch never gets diagnostic admission', async () => {
  vi.stubEnv('RECOVERY_MODE', 'backfill');
  await import('../../scripts/recovery/gate'); await settle();
  expect(harness.append).toHaveBeenCalledWith('/TEST_OUTPUT', 'allowed=false\n');
});
it('real ingestor returns after diagnostic summary with zero snapshot or cursor writes', async () => {
  await import('../../scripts/recovery/ingest'); await settle();
  expect(harness.create).toHaveBeenCalledWith({ apiKey: 'TEST_PROVIDER_KEY', maxRequests: 2, expiresAt: '2026-10-03T00:00:00Z' });
  expect(harness.run).toHaveBeenCalledTimes(1);
  expect(harness.pending).not.toHaveBeenCalled(); expect(harness.save).not.toHaveBeenCalled(); expect(harness.write).not.toHaveBeenCalled(); expect(harness.rename).not.toHaveBeenCalled();
  expect(harness.append).toHaveBeenCalledWith('/TEST_SUMMARY', '{"type":"bounded-membership-diagnostic","requests":2,"results":[]}\n');
  expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toContain('TEST_PROVIDER_KEY');
});
it.each([['RECOVERY_REQUEST_LIMIT', '3'], ['RECOVERY_MAX_REQUESTS', '3'], ['GITHUB_EVENT_NAME', 'workflow_dispatch'], ['GITHUB_RUN_ATTEMPT', '2'], ['GITHUB_REPOSITORY', 'other/repo']])('real ingestor rejects changed bound/context %s=%s before client creation', async (key, value) => {
  vi.stubEnv(key, value);
  await import('../../scripts/recovery/ingest'); await settle();
  expect(harness.create).not.toHaveBeenCalled(); expect(harness.run).not.toHaveBeenCalled();
  expect(harness.pending).not.toHaveBeenCalled(); expect(harness.save).not.toHaveBeenCalled(); expect(harness.write).not.toHaveBeenCalled();
  expect(process.exitCode).toBe(1); expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('TEST_PROVIDER_KEY');
});
