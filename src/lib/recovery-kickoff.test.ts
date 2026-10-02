import{expect,it}from'vitest';
import{validRecoveryKickoff,RECOVERY_KICKOFF_NONCE,RECOVERY_KICKOFF_MESSAGE}from'./recovery-kickoff';
const sha='a'.repeat(40);
const context={repository:'fxy2026/nba-tracker',ref:'refs/heads/master',sha,attempt:1,now:'2026-10-02T12:00:00Z',priorPushRun:false};
const event={ref:context.ref,after:sha,deleted:false,repository:{full_name:context.repository},head_commit:{id:sha,message:RECOVERY_KICKOFF_MESSAGE}};
const manifest={version:1,nonce:RECOVERY_KICKOFF_NONCE,maxRequests:2};
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

it('rejects the completed one-request restore kickoff',()=>expect(validRecoveryKickoff({...event,head_commit:{id:sha,message:'Restore approved Finals player sample (1 request)'}},{version:1,nonce:'2026-10-02-restore-finals-1',maxRequests:1},context)).toBe(false));

it('rejects the completed20-target60-request kickoff',()=>expect(validRecoveryKickoff({...event,head_commit:{id:sha,message:'Run approved 20-game playoff recovery batch (60 requests)'}},{version:1,nonce:'2026-10-02-playoff-batch-20-60',maxRequests:60},context)).toBe(false));

it('rejects the completed40-target120-request kickoff',()=>expect(validRecoveryKickoff({...event,head_commit:{id:sha,message:'Run approved 40-target playoff recovery batch (120 requests)'}},{version:1,nonce:'2026-10-02-playoff-batch-40-120',maxRequests:120},context)).toBe(false));

it('rejects the completed membership3 nonce and message independently',()=>{
 const oldManifest={version:1,nonce:'2026-10-02-membership-diagnostic-3',maxRequests:3};
 const oldEvent={...event,head_commit:{id:sha,message:'Run approved NBA membership diagnostic (3 requests)'}};
 expect(validRecoveryKickoff(oldEvent,oldManifest,context)).toBe(false);
 expect(validRecoveryKickoff(oldEvent,manifest,context)).toBe(false);
 expect(validRecoveryKickoff(event,oldManifest,context)).toBe(false);
});
