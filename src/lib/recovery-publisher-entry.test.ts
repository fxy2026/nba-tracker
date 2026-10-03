import { afterEach,beforeEach,expect,it,vi } from 'vitest';
const h=vi.hoisted(()=>({publish:vi.fn(),append:vi.fn(),read:vi.fn()}));
vi.mock('../../scripts/recovery/publish-pending',()=>({publishPendingRecoveryData:h.publish}));
vi.mock('node:fs',()=>({appendFileSync:h.append,readFileSync:h.read}));
import { RECOVERY_KICKOFF_PATH,RECOVERY_KICKOFF_NONCE,RECOVERY_KICKOFF_MESSAGE } from './recovery-kickoff';
const previous=process.exitCode;
beforeEach(()=>{
 vi.resetModules();vi.clearAllMocks();vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-03T01:00:00Z'));vi.stubEnv('RECOVERY_KICKOFF_ADMITTED',undefined);vi.stubEnv('GITHUB_EVENT_PATH',undefined);h.read.mockImplementation(()=>{throw Error('Unexpected fixture read');});vi.spyOn(console,'log').mockImplementation(()=>{});vi.spyOn(console,'error').mockImplementation(()=>{});
 for(const[key,value]of Object.entries({GITHUB_REPOSITORY:'fxy2026/nba-tracker',GITHUB_REF:'refs/heads/master',GITHUB_RUN_ATTEMPT:'1',GITHUB_EVENT_NAME:'schedule',RUNNER_TEMP:'/TEST_TEMP',GITHUB_SHA:'a'.repeat(40),GITHUB_RUN_ID:'123',GITHUB_STEP_SUMMARY:'/TEST_SUMMARY'}))vi.stubEnv(key,value);
 vi.stubEnv('BIGBALLSDATA_API_KEY',undefined);h.publish.mockReturnValue({ok:true,status:'published',commit:'b'.repeat(40)});process.exitCode=undefined;
});
afterEach(()=>{process.exitCode=previous;vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllEnvs();});
it.each(['schedule','workflow_dispatch'])('credential-free %s publication calls the bounded publisher once',async event=>{
 vi.stubEnv('GITHUB_EVENT_NAME',event);await import('../../scripts/recovery/publish-pending-batch');expect(h.publish).toHaveBeenCalledExactlyOnceWith({repository:process.cwd(),temporaryRoot:'/TEST_TEMP',baseSha:'a'.repeat(40),runId:123});expect(h.append).toHaveBeenCalledWith('/TEST_SUMMARY',expect.stringContaining('Data publication: published; commit '));expect(process.exitCode).toBeUndefined();
});
it.each([['GITHUB_EVENT_NAME','push'],['GITHUB_EVENT_NAME','pull_request'],['GITHUB_REF','refs/heads/other'],['GITHUB_REPOSITORY','other/repo'],['GITHUB_RUN_ATTEMPT','2'],['BIGBALLSDATA_API_KEY','TEST_SECRET']])('rejects unauthorized publisher context %s',async(key,value)=>{
 vi.stubEnv(key,value);await import('../../scripts/recovery/publish-pending-batch');expect(h.publish).not.toHaveBeenCalled();expect(process.exitCode).toBe(1);expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('TEST_SECRET');
});
it('denials and conflicts are failed outcomes with conditional artifact language',async()=>{
 h.publish.mockReturnValue({ok:false,reason:'publication-auth-denied'});await import('../../scripts/recovery/publish-pending-batch');expect(process.exitCode).toBe(1);expect(h.append).toHaveBeenCalledWith('/TEST_SUMMARY',expect.stringContaining('publication-auth-denied'));expect(h.append).toHaveBeenCalledWith('/TEST_SUMMARY',expect.stringContaining('If the preceding recovery-bundle upload succeeded'));
});
it('unknown publisher error does not log the exception or pretend data was saved',async()=>{
 h.publish.mockImplementation(()=>{throw Error('DO_NOT_EXPORT_TOKEN_OR_BODY');});await import('../../scripts/recovery/publish-pending-batch');expect(process.exitCode).toBe(1);expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('DO_NOT_EXPORT');expect(h.append).not.toHaveBeenCalled();
});

function validPilot(){
 vi.stubEnv('GITHUB_EVENT_NAME','push');vi.stubEnv('GITHUB_EVENT_PATH','/TEST_EVENT');vi.stubEnv('RECOVERY_KICKOFF_ADMITTED','true');
 h.read.mockImplementation((path:string)=>JSON.stringify(path===RECOVERY_KICKOFF_PATH?{version:1,nonce:RECOVERY_KICKOFF_NONCE,maxRequests:60}:{ref:'refs/heads/master',after:'a'.repeat(40),deleted:false,repository:{full_name:'fxy2026/nba-tracker'},head_commit:{id:'a'.repeat(40),message:RECOVERY_KICKOFF_MESSAGE}}));
}
it('allows only a locally bound, already-admitted Oct3 push to use the unchanged data publisher',async()=>{validPilot();await import('../../scripts/recovery/publish-pending-batch');expect(h.publish).toHaveBeenCalledTimes(1);expect(process.exitCode).toBeUndefined();});
it.each(['no-grant','wrong-sha','old-manifest','next-day','body-error','provider-key'])('push publication fails closed: %s',async kind=>{
 validPilot();if(kind==='no-grant')vi.stubEnv('RECOVERY_KICKOFF_ADMITTED','false');if(kind==='wrong-sha')vi.stubEnv('GITHUB_SHA','b'.repeat(40));if(kind==='old-manifest')h.read.mockReturnValue(JSON.stringify({version:1,nonce:'2026-10-02-membership-april-2',maxRequests:2}));if(kind==='next-day')vi.setSystemTime(new Date('2026-10-04T00:00:00Z'));if(kind==='body-error')h.read.mockImplementation(()=>{throw Error('DO_NOT_EXPORT');});if(kind==='provider-key')vi.stubEnv('BIGBALLSDATA_API_KEY','TEST_SECRET');
 await import('../../scripts/recovery/publish-pending-batch');expect(h.publish).not.toHaveBeenCalled();expect(process.exitCode).toBe(1);expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/DO_NOT_EXPORT|TEST_SECRET/);
});
