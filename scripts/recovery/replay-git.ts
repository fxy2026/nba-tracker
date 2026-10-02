import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export type ReplayGit = (directory: string, args: string[]) => string;
const gitCommand: ReplayGit = (directory,args) => execFileSync('git',['-C',directory,...args],{
 encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60_000,maxBuffer:1_048_576,
});
export type DataReplayResult =
 | {ok:true;status:'original-confirmed'|'identical-present'|'replayed';commit:string}
 | {ok:false;reason:'invalid-context'|'remote-unavailable'|'base-diverged'|'validator-changed'|'unsafe-latest-data'|'invalid-replay'|'publication-conflict'|'publication-auth-denied'};
const validSha=(value:string)=>/^[0-9a-f]{40}$/.test(value);
const dataPath=(value:string)=>/^src\/data\/(?:provider-player-boxes|observed-final-games)\/\d{10}\.json$/.test(value);
const fields=(value:string)=>value.split('\0').filter(Boolean);
/** Inspect only to classify a denial. Never return or log Git's raw stderr,
 * exception message, headers, remote URL or potentially reflected credential. */
export function gitAuthenticationDenied(error:unknown):boolean{
 if(!error||typeof error!=='object')return false;
 const e=error as {stderr?:unknown;stdout?:unknown;message?:unknown};
 const text=[e.stderr,e.stdout,e.message].filter(v=>typeof v==='string'||Buffer.isBuffer(v)).map(v=>String(v)).join('\n');
 return /authentication failed|permission denied|permission to [^\n]+ denied|could not read username|requested URL returned error:\s*(?:401|403)|write access to repository not granted|access denied|protected branch|GH006|GH013|repository rule violations|pre-receive hook declined|HTTP\s+(?:401|403)/i.test(text);
}
/** Intentionally conservative: unrelated lib changes can require manual review,
 * but an old compiled validator must never silently miss a new identity block. */
export function changesReplayContract(path:string):boolean {
 return path.startsWith('scripts/recovery/') || path.startsWith('src/lib/')
  || path==='.github/workflows/player-data-ingestion.yml'
  || ['package.json','package-lock.json','tsconfig.json','next.config.ts','vitest.config.ts','.gitattributes','.gitmodules','.npmrc','scripts/generate-provider-archive.mjs'].includes(path);
}

/** Called ONLY after an advanced master or uncertain original push. There is one
 * fresh-master replay, never a force push or an unbounded fetch/retry loop.
 * prepareData runs the original compiled validators, not scripts from latest. */
export function replayDataOnce(options:{
 repository:string;temporaryRoot:string;baseSha:string;candidateSha?:string;
 prepareData:(latestRoot:string)=>string[];
},runGit:ReplayGit=gitCommand):DataReplayResult {
 const {repository,baseSha,candidateSha}=options;
 if(!validSha(baseSha)||(candidateSha!==undefined&&!validSha(candidateSha)))return{ok:false,reason:'invalid-context'};
 const ancestor=(a:string,b:string)=>{try{runGit(repository,['merge-base','--is-ancestor',a,b]);return true;}catch{return false;}};
 const remote=()=>{runGit(repository,['fetch','--no-tags','origin','master']);const value=runGit(repository,['rev-parse','refs/remotes/origin/master']).trim();if(!validSha(value))throw Error('Invalid remote');return value;};
 let latest:string;
 try{latest=remote();}catch(error){return{ok:false,reason:gitAuthenticationDenied(error)?'publication-auth-denied':'remote-unavailable'};}
 if(candidateSha){
  try{
   const parents=runGit(repository,['rev-list','--parents','-n','1',candidateSha]).trim().split(' ');
   const changed=fields(runGit(repository,['diff','--name-only','-z',baseSha,candidateSha,'--']));
   if(candidateSha===baseSha||parents.length!==2||parents[1]!==baseSha||changed.some(path=>!dataPath(path)&&path!=='src/data/provider-recovery-state.json'))return{ok:false,reason:'invalid-context'};
  }catch{return{ok:false,reason:'invalid-context'};}
 }
 if(candidateSha&&ancestor(candidateSha,latest))return{ok:true,status:'original-confirmed',commit:candidateSha};
 // No observed advancement means the original failure was not established as
 // a concurrent update. Do not reinterpret unknown/auth failures as permission
 // to submit a different candidate. The validated artifact remains available.
 if(candidateSha&&latest===baseSha)return{ok:false,reason:'publication-conflict'};
 if(!ancestor(baseSha,latest))return{ok:false,reason:'base-diverged'};
 try{
  // Check each ancestor independently: recursive ls-tree alone can return an
  // empty list when src/data itself was replaced by a symlink or removed.
  for(const path of ['src','src/data',...['provider-player-boxes','observed-final-games','recovered-player-boxes','quarantined-player-boxes','resolved-player-box-originals','supplemented-player-box-originals'].map(name=>`src/data/${name}`)]){
   const entry=fields(runGit(repository,['ls-tree','-z',latest,'--',path]));
   if(entry.length!==1||!/^040000 tree [0-9a-f]{40}\t/.test(entry[0])||!entry[0].endsWith(`\t${path}`))return{ok:false,reason:'unsafe-latest-data'};
  }
  if(fields(runGit(repository,['diff','--name-only','-z',baseSha,latest,'--'])).some(changesReplayContract))return{ok:false,reason:'validator-changed'};
  // Data-directory symlinks cannot redirect the original reader outside the
  // checked-out tree. Other git objects remain data, never executable scripts.
  const entries=fields(runGit(repository,['ls-tree','-r','-z',latest,'--','src/data']));
  if(entries.some(entry=>!/^100644 blob [0-9a-f]{40}\t/.test(entry)))return{ok:false,reason:'unsafe-latest-data'};
 }catch{return{ok:false,reason:'invalid-replay'};}
 let temporary:string|undefined,worktree:string|undefined;
 try{
  temporary=mkdtempSync(join(options.temporaryRoot,'nba-data-replay-'));worktree=join(temporary,'checkout');
  runGit(repository,['worktree','add','--detach',worktree,latest]);
  const paths=options.prepareData(worktree);
  if(paths.length>40||new Set(paths).size!==paths.length||paths.some(path=>!dataPath(path)))throw Error('Invalid replay paths');
  // No modification/deletion of existing files or an unrelated untracked file
  // can be hidden behind a caller-supplied allowlist.
  if(fields(runGit(worktree,['diff','--name-only','-z'])).length)throw Error('Existing data modified');
  const untracked=fields(runGit(worktree,['ls-files','--others','--exclude-standard','-z'])).sort();
  if(JSON.stringify(untracked)!==JSON.stringify([...paths].sort()))throw Error('Unexpected replay files');
  if(!paths.length)return{ok:true,status:'identical-present',commit:latest};
  runGit(worktree,['add','--',...paths]);
  const staged=fields(runGit(worktree,['diff','--cached','--name-status','-z']));
  if(staged.length!==paths.length*2||staged.some((value,index)=>index%2===0?value!=='A':!paths.includes(value)))throw Error('Non-additive replay');
  if(fields(runGit(worktree,['ls-files','--stage','-z','--',...paths])).some(entry=>!/^100644 [0-9a-f]{40} 0\t/.test(entry)))throw Error('Non-regular replay file');
  runGit(worktree,['-c','user.name=github-actions[bot]','-c','user.email=41898282+github-actions[bot]@users.noreply.github.com','commit','-m','Recover validated player data after concurrent update']);
  const commit=runGit(worktree,['rev-parse','HEAD']).trim();if(!validSha(commit))throw Error('Invalid candidate');
  try{runGit(worktree,['push','origin','HEAD:master']);}
  catch(error){
   if(gitAuthenticationDenied(error))return{ok:false,reason:'publication-auth-denied'};
   // A transport error is not evidence that the remote rejected our write.
   // Reconcile once; never build another candidate after this bounded attempt.
   try{const confirmed=remote();if(ancestor(commit,confirmed))return{ok:true,status:'replayed',commit};}catch{/* outcome remains unconfirmed */}
   return{ok:false,reason:'publication-conflict'};
  }
  // Even successful CLI exit is checked against the remote before reporting.
  try{const confirmed=remote();if(ancestor(commit,confirmed))return{ok:true,status:'replayed',commit};}catch{/* artifact remains available */}
  return{ok:false,reason:'publication-conflict'};
 }catch{return{ok:false,reason:'invalid-replay'};}
 finally{
  if(worktree){try{runGit(repository,['worktree','remove','--force',worktree]);}catch{/* no remote mutation; artifact is elsewhere */}}
  if(temporary){try{rmSync(temporary,{recursive:true,force:true});}catch{/* no change to confirmed remote outcome */}}
 }
}
