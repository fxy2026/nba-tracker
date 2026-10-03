import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { OFFICIAL_RECOVERY_SCHEDULE_URL, projectOfficialRecoverySchedule, type OfficialScheduleResult } from './recovery-official-schedule';
import type { ObservedFinalGame } from './observed-final-game';
import type { ProviderBasicSnapshot } from './provider-player-normalizer';
import fullArchive from '../data/schedule-2025-26.json';
import savedBoxes from '../data/recovered-player-boxes.json';
import { RECOVERY_KICKOFF_MESSAGE, RECOVERY_KICKOFF_NONCE, RECOVERY_KICKOFF_PATH } from './recovery-kickoff';
import { selectRecoveryTargets } from './recovery-target-selection';

const h = vi.hoisted(() => ({
  read: vi.fn(), write: vi.fn(), rename: vi.fn(), append: vi.fn(), archives: vi.fn(), index: vi.fn(),
  pending: vi.fn(), savePlayers: vi.fn(), saveFinals: vi.fn(), loader: vi.fn(), load: vi.fn(),
  provider: vi.fn(), batch: vi.fn(), verify: vi.fn(), diagnose: vi.fn(), restore: vi.fn(), membership: vi.fn(), membershipRun: vi.fn(),
}));
vi.mock('node:fs', () => ({ readFileSync: h.read, writeFileSync: h.write, renameSync: h.rename, appendFileSync: h.append }));
vi.mock('../../scripts/recovery/snapshot-store', () => ({ readStoredArchives: h.archives, buildStoredSnapshotIndex: h.index, writeNewSnapshots: h.savePlayers }));
vi.mock('../../scripts/recovery/pending-batch', () => ({ writePendingBatch: h.pending }));
vi.mock('../../scripts/recovery/official-game-store', () => ({ writeObservedFinals: h.saveFinals }));
vi.mock('./recovery-official-schedule-client', () => ({ createOfficialRecoveryScheduleLoader: h.loader }));
vi.mock('./recovery-provider-client', () => ({ createRecoveryProviderClient: h.provider }));
vi.mock('./recovery-batch', () => ({ runRecoveryBatch: h.batch }));
vi.mock('./recovery-verification', () => ({ verifyKnownProviderSnapshots: h.verify }));
vi.mock('./recovery-diagnostic-run', () => ({ runPlayoffMetadataDiagnostic: h.diagnose }));
vi.mock('./recovery-finals-sample', () => ({ recoverFinalsSample: h.restore }));
vi.mock('./recovery-membership-client', () => ({ createRecoveryMembershipClient: h.membership }));
vi.mock('./recovery-membership-run', () => ({ runMembershipDiagnostic: h.membershipRun }));

// Keep the real current-season planner and retry logic. Only external I/O and
// provider normalization are mocked; those have their own validation suites.
const now = '2026-10-25T12:00:00.000Z', expiry = '2026-10-26T00:00:00Z', sha = 'a'.repeat(40);
const oldCursor = '0042500235', historicalId = '0022500001';
function observed(index: number): ObservedFinalGame {
  const date = `2026-10-${22 + index}`, score = 90 + index;
  const projected = projectOfficialRecoverySchedule({ leagueSchedule: { seasonYear: '2026-27', gameDates: [{ games: [{
    gameId: `002260000${index}`, gameStatus: 3, gameCode: `${date.replaceAll('-', '')}/NYKSAS`, gameDateTimeUTC: `${date}T23:30:00Z`,
    homeTeam: { teamId: 1610612759, teamTricode: 'SAS', score }, awayTeam: { teamId: 1610612752, teamTricode: 'NYK', score: 100 },
  }] }] } }, { expectedSeason: '2026-27', now, source: { url: OFFICIAL_RECOVERY_SCHEDULE_URL, sha256: 'b'.repeat(64), observedAt: now } });
  if (projected.status !== 'ready') throw Error('Invalid synthetic observation fixture');
  return { version: 1, game: projected.games[0], source: projected.source };
}
const known = observed(1), fresh = observed(2);
const historical = { gameId: historicalId, gameStatus: 3, gameCode: '20251021/NYKSAS', gameDateTimeUTC: '2025-10-21T23:30:00Z',
  homeTeam: { teamTricode: 'SAS', score: 90 }, awayTeam: { teamTricode: 'NYK', score: 100 } };
const archive = { seasonYear: '2025', dates: [{ games: [historical] }] };
const providerClient = { fixture: 'provider-client' }, membershipClient = { fixture: 'membership-client' };
let existing: Set<string>, protectedIds: Set<string>, existingMatches: Map<string, string>;
const priorExitCode = process.exitCode;
const emptyResult = () => ({ accepted: [], rejected: [], requests: 0, cursor: null, interrupted: false });
function discovery(games = [fresh.game]): OfficialScheduleResult { return { status: games.length ? 'ready' : 'empty', season: '2026-27', games, source: fresh.source }; }
function accepted(): ProviderBasicSnapshot {
  // Opaque accepted-provider payload for entrypoint forwarding/order assertions.
  // This test does not substitute for player-row or artifact validation.
  return { version: 1, provider: 'BigBallsData', coverage: 'provider-basic-unassigned',
    game: { nbaGameId: fresh.game.nbaGameId, providerMatchId: '11111111-1111-4111-8111-111111111111', season: fresh.game.season, gameDate: fresh.game.gameDate,
      home: { tricode: 'SAS', score: fresh.game.home.score }, away: { tricode: 'NYK', score: 100 } },
    retrievedAt: now, retrievedAtPrecision: 'exact', players: [], validation: { combinedPoints: fresh.game.home.score + 100, historicalTeams: 'unassigned', officialReportChecked: false } };
}
async function execute() { await import('../../scripts/recovery/ingest'); for (let i = 0; i < 16; i++) await Promise.resolve(); }
function writtenState() {
  const call = h.write.mock.calls.find(call => call[0] === 'src/data/provider-recovery-state.json.tmp');
  expect(call).toBeDefined(); return JSON.parse(call![1]);
}
beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date(now)); process.exitCode = 0;
  vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(() => { throw Error('Unexpected offline-test network request'); }));
  for (const [key, value] of Object.entries({ GITHUB_REPOSITORY: 'fxy2026/nba-tracker', GITHUB_REF: 'refs/heads/master', GITHUB_SHA: sha,
    GITHUB_RUN_ATTEMPT: '1', GITHUB_RUN_ID: '99', GITHUB_EVENT_NAME: 'schedule', GITHUB_STEP_SUMMARY: '/TEST_SUMMARY', RUNNER_TEMP: '/TEST_TEMP',
    BIGBALLSDATA_API_KEY: 'TEST_ONLY_KEY', RECOVERY_MODE: 'backfill', RECOVERY_MAX_REQUESTS: '230', RECOVERY_REQUEST_LIMIT: '230', RECOVERY_EXPIRES_AT: expiry })) vi.stubEnv(key, value);
  existing = new Set(); protectedIds = new Set(['0042500405']); existingMatches = new Map();
  h.archives.mockReturnValue({ generic: {}, verified: {}, quarantined: {}, observed: { [known.game.nbaGameId]: structuredClone(known) } });
  h.index.mockReturnValue({ existing, protectedIds, existingMatches });
  h.read.mockImplementation((path: string) => {
    if (path === 'src/data/provider-recovery-state.json') return JSON.stringify({ version: 1, cursor: oldCursor });
    if (path === 'src/data/schedule-2025-26.json') return JSON.stringify(archive);
    throw Error('Unexpected fixture file read');
  });
  h.loader.mockReturnValue({ load: h.load }); h.load.mockResolvedValue(discovery());
  h.provider.mockReturnValue(providerClient); h.batch.mockResolvedValue(emptyResult());
  h.verify.mockResolvedValue({ games: 2, players: 41, requests: 2 }); h.diagnose.mockResolvedValue({ requests: 1 });
  h.restore.mockResolvedValue(emptyResult()); h.membership.mockReturnValue(membershipClient); h.membershipRun.mockResolvedValue({ requests: 2, results: [] });
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  process.exitCode = priorExitCode; vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals();
});

it('actual backfill entrypoint loads once, queues current identities ahead of history and preserves the provider cap', async () => {
  const snapshot = accepted(); h.batch.mockResolvedValue({ ...emptyResult(), accepted: [snapshot], requests: 3, cursor: fresh.game.nbaGameId });
  await execute();
  expect(process.exitCode).toBe(0); expect(h.loader).toHaveBeenCalledTimes(1);
  expect(h.load).toHaveBeenCalledExactlyOnceWith({ mode: 'backfill', expectedSeason: '2026-27' });
  expect(h.batch.mock.calls[0][0].map((row: { nbaGameId: string }) => row.nbaGameId)).toEqual([fresh.game.nbaGameId, known.game.nbaGameId, historicalId]);
  expect(h.provider).toHaveBeenCalledExactlyOnceWith({ apiKey: 'TEST_ONLY_KEY', maxRequests: 230, expiresAt: expiry });
  expect(h.batch).toHaveBeenCalledWith(expect.any(Array), providerClient, 230, protectedIds, existingMatches);
  expect(h.pending).toHaveBeenCalledWith('/TEST_TEMP/nba-player-pending-99', [snapshot], { baseSha: sha, runId: 99 }, protectedIds, [fresh, known]);
  expect(h.saveFinals).toHaveBeenCalledWith('src/data/observed-final-games', [fresh, known]);
  expect(h.savePlayers).toHaveBeenCalledWith('src/data/provider-player-boxes', [snapshot], protectedIds);
  expect(h.pending.mock.invocationCallOrder[0]).toBeLessThan(h.saveFinals.mock.invocationCallOrder[0]);
  expect(h.pending.mock.invocationCallOrder[0]).toBeLessThan(h.savePlayers.mock.invocationCallOrder[0]);
  expect(h.savePlayers.mock.invocationCallOrder[0]).toBeLessThan(h.write.mock.invocationCallOrder[0]);
  expect(writtenState()).toMatchObject({ version: 2, cursor: oldCursor, observedRetries: {}, lastBatch: { requests: 3, accepted: 1 } });
  expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toContain('TEST_ONLY_KEY');
});
it.each(['verify', 'diagnose', 'restore'] as const)('%s entrypoint does not instantiate or call the new schedule source', async mode => {
  vi.stubEnv('RECOVERY_MODE', mode); vi.stubEnv('GITHUB_EVENT_NAME', 'workflow_dispatch');
  vi.stubEnv('RECOVERY_REQUEST_LIMIT', '3'); vi.stubEnv('RECOVERY_MAX_REQUESTS', '230');
  await execute(); expect(process.exitCode).toBe(0); expect(h.loader).not.toHaveBeenCalled(); expect(h.load).not.toHaveBeenCalled(); expect(h.batch).not.toHaveBeenCalled();
  const selected = { verify: h.verify, diagnose: h.diagnose, membership: h.membershipRun, restore: h.restore }[mode]; expect(selected).toHaveBeenCalledTimes(1);
  expect(h.pending).not.toHaveBeenCalled(); expect(h.saveFinals).not.toHaveBeenCalled(); expect(h.savePlayers).not.toHaveBeenCalled(); expect(h.write).not.toHaveBeenCalled();
});
it.each([historicalId, fresh.game.nbaGameId, '0022609999', null])('only a processed historical ID advances the legacy cursor: %s', cursor => {
  h.batch.mockResolvedValue({ ...emptyResult(), requests: 1, cursor });
  return execute().then(() => expect(writtenState().cursor).toBe(cursor === historicalId ? historicalId : oldCursor));
});
it.each(['empty', 'unavailable', 'wrong-season'] as const)('%s discovery retains the saved identity and creates no invented tuple/player rows', async status => {
  const prior = structuredClone(known);
  h.load.mockResolvedValue(status === 'empty' ? discovery([]) : { status, reason: 'fixture-source-failure' });
  h.batch.mockResolvedValue({ ...emptyResult(), requests: 1, cursor: known.game.nbaGameId, rejected: [{ gameId: known.game.nbaGameId, reason: 'no-matching-finished-game' }] });
  await execute(); expect(process.exitCode).toBe(0);
  expect(h.batch.mock.calls[0][0].map((row: { nbaGameId: string }) => row.nbaGameId)).toEqual([known.game.nbaGameId, historicalId]);
  expect(h.pending).not.toHaveBeenCalled(); expect(h.saveFinals).not.toHaveBeenCalled(); expect(h.savePlayers).not.toHaveBeenCalled();
  expect(h.archives.mock.results[0].value.observed[known.game.nbaGameId]).toEqual(prior);
  expect(writtenState()).toMatchObject({ cursor: oldCursor, observedRetries: { [known.game.nbaGameId]: { retryAfter: '2026-10-27T12:00:00.000Z', reason: 'no-matching-finished-game' } } });
});
it.each(['empty', 'unavailable'] as const)('%s discovery and no unsaved targets produces no provider or data writes', async status => {
  h.load.mockResolvedValue(status === 'empty' ? discovery([]) : { status, reason: 'fixture-source-failure' });
  existing.add(known.game.nbaGameId); existing.add(historicalId);
  await execute(); expect(process.exitCode).toBe(0); expect(h.load).toHaveBeenCalledTimes(1);
  expect(h.provider).not.toHaveBeenCalled(); expect(h.batch).not.toHaveBeenCalled();
  expect(h.pending).not.toHaveBeenCalled(); expect(h.saveFinals).not.toHaveBeenCalled(); expect(h.savePlayers).not.toHaveBeenCalled(); expect(h.write).not.toHaveBeenCalled();
});
it('captures new official identity before writing it even when provider normalization accepts no players', async () => {
  await execute(); expect(process.exitCode).toBe(0);
  expect(h.pending).toHaveBeenCalledWith('/TEST_TEMP/nba-player-pending-99', [], { baseSha: sha, runId: 99 }, protectedIds, [fresh, known]);
  expect(h.pending.mock.invocationCallOrder[0]).toBeLessThan(h.saveFinals.mock.invocationCallOrder[0]);
  expect(h.savePlayers).toHaveBeenCalledWith('src/data/provider-player-boxes', [], protectedIds);
  expect(writtenState()).toMatchObject({ cursor: oldCursor, lastBatch: { requests: 0, accepted: 0 } });
});
it('capture failure prevents tuple, player and state writes', async () => {
  h.pending.mockImplementation(() => { throw Error('synthetic artifact failure'); });
  await execute(); expect(process.exitCode).toBe(1);
  expect(h.saveFinals).not.toHaveBeenCalled(); expect(h.savePlayers).not.toHaveBeenCalled(); expect(h.write).not.toHaveBeenCalled(); expect(h.rename).not.toHaveBeenCalled();
});
it('official discovery does not increase a smaller already-admitted provider allowance', async () => {
  vi.stubEnv('RECOVERY_MAX_REQUESTS', '17'); vi.stubEnv('RECOVERY_REQUEST_LIMIT', '30');
  await execute(); expect(h.provider).toHaveBeenCalledExactlyOnceWith({ apiKey: 'TEST_ONLY_KEY', maxRequests: 17, expiresAt: expiry });
  expect(h.batch.mock.calls[0][2]).toBe(17); expect(h.load).toHaveBeenCalledTimes(1);
});
it('a throwing discovery fails safely before provider creation or writes', async () => {
  h.load.mockRejectedValue(new Error('unexpected synthetic source error'));
  await execute(); expect(process.exitCode).toBe(1); expect(h.provider).not.toHaveBeenCalled();
  expect(h.pending).not.toHaveBeenCalled(); expect(h.saveFinals).not.toHaveBeenCalled(); expect(h.savePlayers).not.toHaveBeenCalled(); expect(h.write).not.toHaveBeenCalled();
});
it('validates a delayed discovery against the post-fetch clock instead of rejecting its later observation time', async () => {
  const observedAt = '2026-10-25T12:00:02.000Z';
  h.load.mockImplementation(async () => {
    vi.setSystemTime(new Date(observedAt));
    return { ...discovery(), source: { ...fresh.source, observedAt } };
  });
  await execute(); expect(process.exitCode).toBe(0);
  expect(h.load).toHaveBeenCalledExactlyOnceWith({ mode: 'backfill', expectedSeason: '2026-27' });
  expect(h.batch.mock.calls[0][0][0].nbaGameId).toBe(fresh.game.nbaGameId);
  expect(h.pending.mock.calls[0][4][0]).toMatchObject({ game: fresh.game, source: { observedAt } });
  expect(writtenState().lastRunAt).toBe(observedAt);
});

function setupPilot(){
 vi.setSystemTime(new Date('2026-10-03T01:00:00Z'));
 vi.stubEnv('GITHUB_EVENT_NAME','push');vi.stubEnv('GITHUB_EVENT_PATH','/TEST_EVENT');vi.stubEnv('RECOVERY_KICKOFF_ADMITTED','true');vi.stubEnv('RECOVERY_MAX_REQUESTS','60');vi.stubEnv('RECOVERY_REQUEST_LIMIT','60');vi.stubEnv('RECOVERY_EXPIRES_AT','2026-10-04T00:00:00Z');
 h.archives.mockReturnValue({generic:{},verified:savedBoxes,quarantined:{},observed:{}});
 for(const id of Object.keys(savedBoxes))existing.add(id);
 h.load.mockResolvedValue({status:'wrong-season',reason:'fixture-old-feed'});
 h.read.mockImplementation((path:string)=>{
  if(path==='src/data/provider-recovery-state.json')return JSON.stringify({version:2,cursor:oldCursor});
  if(path==='src/data/schedule-2025-26.json')return JSON.stringify(fullArchive);
  if(path===RECOVERY_KICKOFF_PATH)return JSON.stringify({version:1,nonce:RECOVERY_KICKOFF_NONCE,maxRequests:60});
  if(path==='/TEST_EVENT')return JSON.stringify({ref:'refs/heads/master',after:sha,deleted:false,repository:{full_name:'fxy2026/nba-tracker'},head_commit:{id:sha,message:RECOVERY_KICKOFF_MESSAGE}});
  throw Error('Unexpected fixture read');
 });
}
it('exact admitted Oct3 push retries twenty remaining playoff targets with one schedule load and provider cap60',async()=>{
 setupPilot();await execute();expect(process.exitCode).toBe(0);
 expect(h.load).toHaveBeenCalledExactlyOnceWith({mode:'backfill',expectedSeason:'2026-27'});
 expect(h.provider).toHaveBeenCalledExactlyOnceWith({apiKey:'TEST_ONLY_KEY',maxRequests:60,expiresAt:'2026-10-04T00:00:00Z'});
 const targets=h.batch.mock.calls[0][0] as {nbaGameId:string}[];
 expect(targets).toEqual(selectRecoveryTargets(fullArchive,existing,null,20));expect(targets).toHaveLength(20);
 expect(targets.every(row=>row.nbaGameId.startsWith('00425')&&!existing.has(row.nbaGameId))).toBe(true);
 expect(targets).not.toEqual(selectRecoveryTargets(fullArchive,existing,oldCursor,20));
 expect(h.batch.mock.calls[0][2]).toBe(60);expect(h.membership).not.toHaveBeenCalled();expect(h.membershipRun).not.toHaveBeenCalled();
 expect(h.write).not.toHaveBeenCalled(); // selection reset alone never rewrites stored cursor
});
it.each([['RECOVERY_KICKOFF_ADMITTED','false'],['RECOVERY_REQUEST_LIMIT','61'],['RECOVERY_MAX_REQUESTS','230'],['RECOVERY_MODE','membership'],['GITHUB_SHA','b'.repeat(40)],['GITHUB_RUN_ATTEMPT','2']])('pilot rejects changed context %s before schedule/provider access',async(key,value)=>{
 setupPilot();vi.stubEnv(key,value);await execute();expect(process.exitCode).toBe(1);expect(h.load).not.toHaveBeenCalled();expect(h.provider).not.toHaveBeenCalled();expect(h.membership).not.toHaveBeenCalled();expect(h.write).not.toHaveBeenCalled();
});
it('a next-day delayed pilot cannot instantiate either source',async()=>{setupPilot();vi.setSystemTime(new Date('2026-10-04T00:00:00Z'));await execute();expect(process.exitCode).toBe(1);expect(h.load).not.toHaveBeenCalled();expect(h.provider).not.toHaveBeenCalled();});
