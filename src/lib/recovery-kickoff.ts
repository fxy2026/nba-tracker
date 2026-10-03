export const RECOVERY_KICKOFF_PATH = '.github/recovery-kickoff/2026-10-03-playoff-pilot-20-60.json';
export const RECOVERY_KICKOFF_MESSAGE = 'Run approved October 3 playoff recovery pilot (20 targets, 60 requests)';
export const RECOVERY_KICKOFF_NONCE = '2026-10-03-playoff-pilot-20-60';
export const RECOVERY_KICKOFF_REQUEST_LIMIT = 60;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export interface RecoveryKickoffContext { repository:string;ref:string;sha:string;attempt:number;now:string }
/** Local binding shared by admission, ingestion and credential-free publication.
 * This does not replace the gate's complete run-history and quota checks. */
export function validRecoveryKickoffContext(event:unknown,manifest:unknown,context:RecoveryKickoffContext):boolean {
 if(context.repository!=='fxy2026/nba-tracker'||context.ref!=='refs/heads/master'||context.attempt!==1||!/^([a-f0-9]{40})$/.test(context.sha)||!Number.isFinite(Date.parse(context.now))||!context.now.startsWith('2026-10-03T'))return false;
 if(!object(manifest)||Object.keys(manifest).sort().join(',')!=='maxRequests,nonce,version'||manifest.version!==1||manifest.nonce!==RECOVERY_KICKOFF_NONCE||manifest.maxRequests!==RECOVERY_KICKOFF_REQUEST_LIMIT)return false;
 return object(event)&&event.ref===context.ref&&event.after===context.sha&&event.deleted===false&&object(event.repository)&&event.repository.full_name===context.repository&&object(event.head_commit)&&event.head_commit.id===context.sha&&event.head_commit.message===RECOVERY_KICKOFF_MESSAGE;
}
export function validRecoveryKickoff(event:unknown,manifest:unknown,context:RecoveryKickoffContext&{priorPushRun:boolean}):boolean {
 return context.priorPushRun===false&&validRecoveryKickoffContext(event,manifest,context);
}
