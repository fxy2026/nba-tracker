import { afterEach,beforeEach,expect,it,vi } from 'vitest';
const h=vi.hoisted(()=>({publish:vi.fn(),append:vi.fn()}));
vi.mock('../../scripts/recovery/publish-pending',()=>({publishPendingRecoveryData:h.publish}));
vi.mock('node:fs',()=>({appendFileSync:h.append}));
const previous=process.exitCode;
beforeEach(()=>{
 vi.resetModules();vi.clearAllMocks();vi.spyOn(console,'log').mockImplementation(()=>{});vi.spyOn(console,'error').mockImplementation(()=>{});
 for(const[key,value]of Object.entries({GITHUB_REPOSITORY:'fxy2026/nba-tracker',GITHUB_REF:'refs/heads/master',GITHUB_RUN_ATTEMPT:'1',GITHUB_EVENT_NAME:'schedule',RUNNER_TEMP:'/TEST_TEMP',GITHUB_SHA:'a'.repeat(40),GITHUB_RUN_ID:'123',GITHUB_STEP_SUMMARY:'/TEST_SUMMARY'}))vi.stubEnv(key,value);
 vi.stubEnv('BIGBALLSDATA_API_KEY',undefined);h.publish.mockReturnValue({ok:true,status:'published',commit:'b'.repeat(40)});process.exitCode=undefined;
});
afterEach(()=>{process.exitCode=previous;vi.restoreAllMocks();vi.unstubAllEnvs();});
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
