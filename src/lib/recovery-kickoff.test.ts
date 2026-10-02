import{expect,it}from'vitest';
import{validRecoveryKickoff,RECOVERY_KICKOFF_NONCE,RECOVERY_KICKOFF_MESSAGE}from'./recovery-kickoff';
const sha='a'.repeat(40);
const context={repository:'fxy2026/nba-tracker',ref:'refs/heads/master',sha,attempt:1,now:'2026-10-02T12:00:00Z',priorPushRun:false};
const event={ref:context.ref,after:sha,deleted:false,repository:{full_name:context.repository},head_commit:{id:sha,message:RECOVERY_KICKOFF_MESSAGE}};
const manifest={version:1,nonce:RECOVERY_KICKOFF_NONCE,maxRequests:1};
it('admits only the exact approved first kickoff',()=>expect(validRecoveryKickoff(event,manifest,context)).toBe(true));
it.each([{repository:'other/repo'},{ref:'refs/heads/dev'},{sha:'b'.repeat(40)},{attempt:2},{priorPushRun:true},{now:'2026-10-03T00:00:00Z'}])('rejects context mismatch/replay%j',change=>expect(validRecoveryKickoff(event,manifest,{...context,...change})).toBe(false));
it.each([{...manifest,maxRequests:100},{...manifest,nonce:'other'},{...manifest,extra:true},null])('rejects modified kickoff manifest%j',bad=>expect(validRecoveryKickoff(event,bad,context)).toBe(false));
it.each([{...event,deleted:true},{...event,after:'b'.repeat(40)},{...event,head_commit:{id:sha,message:'ordinary push'}},{...event,repository:{full_name:'other/repo'}},null])('rejects unrelated push%j',bad=>expect(validRecoveryKickoff(bad,manifest,context)).toBe(false));
it('permanently rejects the retired25-request nonce and commit message',()=>{
 const oldManifest={version:1,nonce:'2026-10-02-playoffs-first-25',maxRequests:25};
 const oldEvent={...event,head_commit:{id:sha,message:'Run approved first playoff recovery pilot (25 requests)'}};
 expect(validRecoveryKickoff(oldEvent,oldManifest,context)).toBe(false);
 expect(validRecoveryKickoff(oldEvent,manifest,context)).toBe(false);
 expect(validRecoveryKickoff(event,oldManifest,context)).toBe(false);
});

it('rejects retired metadata3 nonce and message',()=>{expect(validRecoveryKickoff({...event,head_commit:{id:sha,message:'Run approved playoff metadata diagnostic (3 requests)'}},{version:1,nonce:'2026-10-02-playoff-metadata-3',maxRequests:3},context)).toBe(false);});
