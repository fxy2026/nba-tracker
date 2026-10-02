export const RECOVERY_KICKOFF_PATH = '.github/recovery-kickoff/2026-10-02-restore-finals-sample.json';
export const RECOVERY_KICKOFF_MESSAGE = 'Restore approved Finals player sample (1 request)';
export const RECOVERY_KICKOFF_NONCE = '2026-10-02-restore-finals-1';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function validRecoveryKickoff(event:unknown,manifest:unknown,context:{repository:string;ref:string;sha:string;attempt:number;now:string;priorPushRun:boolean}):boolean {
 if(context.repository!=='fxy2026/nba-tracker'||context.ref!=='refs/heads/master'||context.attempt!==1||context.priorPushRun||!/^([a-f0-9]{40})$/.test(context.sha)||!Number.isFinite(Date.parse(context.now))||!context.now.startsWith('2026-10-02T'))return false;
 if(!object(manifest)||Object.keys(manifest).sort().join(',')!=='maxRequests,nonce,version'||manifest.version!==1||manifest.nonce!==RECOVERY_KICKOFF_NONCE||manifest.maxRequests!==1)return false;
 return object(event)&&event.ref===context.ref&&event.after===context.sha&&event.deleted===false&&object(event.repository)&&event.repository.full_name===context.repository&&object(event.head_commit)&&event.head_commit.id===context.sha&&event.head_commit.message===RECOVERY_KICKOFF_MESSAGE;
}
