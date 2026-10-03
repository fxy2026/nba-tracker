import { afterEach,beforeEach,expect,it,vi } from 'vitest';
const h=vi.hoisted(()=>({append:vi.fn(),read:vi.fn(),allowance:230,connection:0,priorPush:false}));
vi.mock('node:fs',()=>({readFileSync:h.read,appendFileSync:h.append}));
vi.mock('./recovery-github-ledger',()=>({RECOVERY_REPOSITORY:'fxy2026/nba-tracker',readRecoveryRunLedger:async()=>({ok:true,providerVerified:true,priorPushRun:h.priorPush,input:{now:'2026-10-03T01:00:00.000Z'}})}));
vi.mock('./recovery-connection-ledger',()=>({readConnectionLedger:async()=>({ok:true,verified:true,reservedRequests:h.connection})}));
vi.mock('./recovery-run-budget',async original=>({...await original<typeof import('./recovery-run-budget')>(),calculateRecoveryRunBudget:()=>({allowed:true,maxRequests:h.allowance,expiresAt:'2026-10-04T00:00:00Z'})}));
import { RECOVERY_KICKOFF_MESSAGE,RECOVERY_KICKOFF_NONCE,RECOVERY_KICKOFF_PATH } from './recovery-kickoff';
const sha='a'.repeat(40),previous=process.exitCode;
beforeEach(()=>{
 vi.resetModules();vi.clearAllMocks();vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-03T01:00:00Z'));vi.spyOn(console,'log').mockImplementation(()=>{});vi.spyOn(console,'error').mockImplementation(()=>{});vi.stubGlobal('fetch',vi.fn(()=>{throw Error('Offline fixture');}));process.exitCode=undefined;
 for(const[key,value]of Object.entries({GITHUB_REPOSITORY:'fxy2026/nba-tracker',GITHUB_REF:'refs/heads/master',GITHUB_SHA:sha,GITHUB_RUN_ATTEMPT:'1',GITHUB_RUN_ID:'99',GITHUB_EVENT_NAME:'push',GITHUB_EVENT_PATH:'/TEST_EVENT',GITHUB_OUTPUT:'/TEST_OUTPUT',GITHUB_TOKEN:'TEST_TOKEN',RECOVERY_MODE:'backfill'}))vi.stubEnv(key,value);
 h.allowance=230;h.connection=0;h.priorPush=false;
 h.read.mockImplementation((path:string)=>JSON.stringify(path===RECOVERY_KICKOFF_PATH?{version:1,nonce:RECOVERY_KICKOFF_NONCE,maxRequests:60}:{ref:'refs/heads/master',after:sha,deleted:false,repository:{full_name:'fxy2026/nba-tracker'},head_commit:{id:sha,message:RECOVERY_KICKOFF_MESSAGE}}));
});
afterEach(()=>{expect(fetch).not.toHaveBeenCalled();process.exitCode=previous;vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllEnvs();vi.unstubAllGlobals();});
async function execute(){await import('../../scripts/recovery/gate');for(let i=0;i<16;i++)await Promise.resolve();}
it('caps an otherwise230 allowance at60 and exposes exact kickoff admission',async()=>{await execute();expect(h.append).toHaveBeenCalledWith('/TEST_OUTPUT','allowed=true\nmax_requests=60\nexpires_at=2026-10-04T00:00:00Z\nkickoff_admitted=true\n');});
it.each(['insufficient','connection-reserved','prior-push','wrong-mode','old-manifest','wrong-sha'])('fails closed before any provider access: %s',async kind=>{
 if(kind==='insufficient')h.allowance=59;if(kind==='connection-reserved'){h.allowance=60;h.connection=1;}if(kind==='prior-push')h.priorPush=true;if(kind==='wrong-mode')vi.stubEnv('RECOVERY_MODE','membership');if(kind==='wrong-sha')vi.stubEnv('GITHUB_SHA','b'.repeat(40));if(kind==='old-manifest')h.read.mockReturnValue(JSON.stringify({version:1,nonce:'2026-10-02-membership-april-2',maxRequests:2}));
 await execute();expect(h.append).toHaveBeenCalledWith('/TEST_OUTPUT','allowed=false\n');expect(h.append.mock.calls.some(call=>String(call[1]).includes('allowed=true'))).toBe(false);
});
it.each(['schedule','workflow_dispatch'])('keeps normal %s allowance without a kickoff grant',async event=>{vi.stubEnv('GITHUB_EVENT_NAME',event);await execute();expect(h.append).toHaveBeenCalledWith('/TEST_OUTPUT','allowed=true\nmax_requests=230\nexpires_at=2026-10-04T00:00:00Z\nkickoff_admitted=false\n');expect(h.read).not.toHaveBeenCalled();});

it.each(['schedule','workflow_dispatch'])('retired membership mode gets no admission via %s',async event=>{vi.stubEnv('GITHUB_EVENT_NAME',event);vi.stubEnv('RECOVERY_MODE','membership');await execute();expect(h.append).toHaveBeenCalledWith('/TEST_OUTPUT','allowed=false\n');});
