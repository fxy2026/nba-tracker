import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const h=vi.hoisted(()=>({create:vi.fn()}));
vi.mock('./recovery-membership-client',()=>({createRecoveryMembershipClient:h.create}));
const previous=process.exitCode;
beforeEach(()=>{vi.resetModules();vi.clearAllMocks();vi.spyOn(console,'error').mockImplementation(()=>{});vi.stubGlobal('fetch',vi.fn(()=>{throw Error('Offline fixture');}));vi.stubEnv('RECOVERY_MODE','membership');process.exitCode=undefined;});
afterEach(()=>{process.exitCode=previous;vi.restoreAllMocks();vi.unstubAllEnvs();vi.unstubAllGlobals();});
it.each(['push','schedule','workflow_dispatch'])('retired membership mode cannot start through %s',async event=>{
 vi.stubEnv('GITHUB_EVENT_NAME',event);await import('../../scripts/recovery/ingest');for(let i=0;i<12;i++)await Promise.resolve();expect(process.exitCode).toBe(1);expect(h.create).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
});
