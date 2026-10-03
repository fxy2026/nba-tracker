import { afterEach,expect,it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync } from 'node:fs';
import { join,dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { changesReplayContract,replayDataOnce,type ReplayGit } from '../../scripts/recovery/replay-git';
const roots:string[]=[];
const git:ReplayGit=(cwd,args)=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const path='src/data/provider-player-boxes/0022600001.json';
function save(cwd:string,file:string,text:string){mkdirSync(dirname(join(cwd,file)),{recursive:true});writeFileSync(join(cwd,file),text);}
function commit(cwd:string,file:string,text:string){save(cwd,file,text);git(cwd,['add','--',file]);git(cwd,['-c','user.name=fixture','-c','user.email=fixture@example.test','commit','-m','fixture']);return git(cwd,['rev-parse','HEAD']).trim();}
function setup(){
 const root=mkdtempSync(join(tmpdir(),'nba-replay-git-'));roots.push(root);const remote=join(root,'remote.git'),work=join(root,'work'),other=join(root,'other');
 execFileSync('git',['init','--bare','--initial-branch=master',remote],{stdio:'ignore'});execFileSync('git',['clone',remote,work],{stdio:'ignore'});
 for(const name of ['provider-player-boxes','observed-final-games','recovered-player-boxes','quarantined-player-boxes','resolved-player-box-originals','supplemented-player-box-originals'])save(work,`src/data/${name}/.gitkeep`,'');
 git(work,['add','src/data']);
 commit(work,'src/data/provider-recovery-state.json','{"cursor":"original"}\n');git(work,['push','origin','HEAD:master']);
 const baseSha=git(work,['rev-parse','HEAD']).trim();execFileSync('git',['clone',remote,other],{stdio:'ignore'});
 const advance=(file='README.md',text='newer owner content\n')=>{const sha=commit(other,file,text);git(other,['push','origin','HEAD:master']);return sha;};
 return{root,remote,work,other,baseSha,advance};
}
afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
const prepare=(root:string)=>{save(root,path,'{"validated":"fixture"}\n');return[path];};
it('one fresh-master replay preserves newer state and unrelated changes, stages only additions',()=>{
 const s=setup();s.advance();s.advance('src/data/provider-recovery-state.json','{"cursor":"newer","observedRetries":{"retained":true}}\n');
 const result=replayDataOnce({repository:s.work,temporaryRoot:s.root,baseSha:s.baseSha,prepareData:prepare});
 expect(result).toMatchObject({ok:true,status:'replayed'});
 expect(git(s.remote,['show','master:README.md'])).toBe('newer owner content\n');
 expect(git(s.remote,['show','master:src/data/provider-recovery-state.json'])).toContain('newer');
 expect(git(s.remote,['diff-tree','--no-commit-id','--name-status','-r','master']).trim()).toBe(`A\t${path}`);
 expect(git(s.work,['rev-parse','HEAD']).trim()).toBe(s.baseSha);
});
it('already-contained original candidate is confirmed without another prepare or commit',()=>{
 const s=setup(),candidateSha=commit(s.work,path,'{"validated":"fixture"}\n');git(s.work,['push','origin','HEAD:master']);let called=false;
 const result=replayDataOnce({repository:s.work,temporaryRoot:s.root,baseSha:s.baseSha,candidateSha,prepareData:()=>{called=true;return[];}});
 expect(result).toEqual({ok:true,status:'original-confirmed',commit:candidateSha});expect(called).toBe(false);
});
it('base SHA cannot masquerade as an already published candidate',()=>{const s=setup();expect(replayDataOnce({repository:s.work,temporaryRoot:s.root,baseSha:s.baseSha,candidateSha:s.baseSha,prepareData:prepare})).toEqual({ok:false,reason:'invalid-context'});});
it('uncertain successful push is reconciled, not blindly retried',()=>{
 const s=setup();s.advance();let pushes=0;
 const transport:ReplayGit=(cwd,args)=>{if(args[0]==='push'){pushes++;git(cwd,args);throw Error('synthetic connection loss after accepted write');}return git(cwd,args);};
 expect(replayDataOnce({repository:s.work,temporaryRoot:s.root,baseSha:s.baseSha,prepareData:prepare},transport)).toMatchObject({ok:true,status:'replayed'});expect(pushes).toBe(1);
});
it('a second advancement rejects the sole replay without force or another candidate',()=>{
 const s=setup();s.advance();let pushes=0;const calls:string[][]=[];
 const transport:ReplayGit=(cwd,args)=>{calls.push(args);if(args[0]==='push'){pushes++;s.advance('another.md','second concurrent edit\n');}return git(cwd,args);};
 expect(replayDataOnce({repository:s.work,temporaryRoot:s.root,baseSha:s.baseSha,prepareData:prepare},transport)).toEqual({ok:false,reason:'publication-conflict'});
 expect(pushes).toBe(1);expect(()=>git(s.remote,['show',`master:${path}`])).toThrow();expect(calls.filter(a=>a[0]==='push').flat()).not.toContain('--force');
});
it('identical data plan creates no duplicate commit',()=>{const s=setup();const latest=s.advance(path,'{"validated":"fixture"}\n');expect(replayDataOnce({repository:s.work,temporaryRoot:s.root,baseSha:s.baseSha,prepareData:()=>[]})).toEqual({ok:true,status:'identical-present',commit:latest});expect(git(s.remote,['rev-parse','master']).trim()).toBe(latest);});
it.each(['src/lib/provider-identity-quarantine.ts','src/lib/official-player-box.ts','scripts/recovery/pending-batch.ts','package-lock.json','tsconfig.json','.github/workflows/player-data-ingestion.yml','.gitattributes'])('changed validation or execution contract aborts before reading latest data: %s',file=>{
 const s=setup();s.advance(file,'changed\n');let called=false;
 expect(replayDataOnce({repository:s.work,temporaryRoot:s.root,baseSha:s.baseSha,prepareData:()=>{called=true;return[];}})).toEqual({ok:false,reason:'validator-changed'});expect(called).toBe(false);
});
it('data symlinks cannot redirect validation outside latest checkout',()=>{
 const s=setup();mkdirSync(join(s.other,'src/data/player-alias'),{recursive:true});symlinkSync('/tmp',join(s.other,'src/data/player-alias/outside'));git(s.other,['add','.']);git(s.other,['-c','user.name=fixture','-c','user.email=fixture@example.test','commit','-m','symlink fixture']);git(s.other,['push','origin','HEAD:master']);
 expect(replayDataOnce({repository:s.work,temporaryRoot:s.root,baseSha:s.baseSha,prepareData:prepare})).toEqual({ok:false,reason:'unsafe-latest-data'});
});
it.each(['modify-state','code','symlink','throw','undeclared'])('unsafe prepare result leaves remote unchanged: %s',kind=>{
 const s=setup(),latest=s.advance();const result=replayDataOnce({repository:s.work,temporaryRoot:s.root,baseSha:s.baseSha,prepareData:root=>{
  if(kind==='throw')throw Error('Raw secret-like detail must not escape');
  if(kind==='modify-state'){save(root,'src/data/provider-recovery-state.json','wrong');return[];}
  if(kind==='code'){save(root,'src/evil.ts','wrong');return['src/evil.ts'];}
  if(kind==='undeclared'){save(root,'unexpected.json','wrong');return[];}
  mkdirSync(dirname(join(root,path)),{recursive:true});symlinkSync('/tmp',join(root,path));return[path];
 }});expect(result).toEqual({ok:false,reason:'invalid-replay'});expect(git(s.remote,['rev-parse','master']).trim()).toBe(latest);
});
it('unavailable remote does not enter replay or expose raw git error text',()=>{
 const s=setup();let called=false;const result=replayDataOnce({repository:s.work,temporaryRoot:s.root,baseSha:s.baseSha,prepareData:()=>{called=true;return[];}},()=>{throw Error('DO_NOT_LOG_TOKEN');});expect(result).toEqual({ok:false,reason:'remote-unavailable'});expect(called).toBe(false);expect(JSON.stringify(result)).not.toContain('DO_NOT_LOG_TOKEN');
});
it('path guard allows unrelated display changes but rejects the compiled source closure',()=>{expect(changesReplayContract('src/components/ShotHeatmap.tsx')).toBe(false);expect(changesReplayContract('README.md')).toBe(false);expect(changesReplayContract('src/lib/teams.ts')).toBe(true);});

it('unconfirmed original push with unchanged remote does not create or push another candidate',()=>{
 const s=setup(),candidateSha=commit(s.work,path,'{"validated":"fixture"}\n');let called=false;
 expect(replayDataOnce({repository:s.work,temporaryRoot:s.root,baseSha:s.baseSha,candidateSha,prepareData:()=>{called=true;return[];}})).toEqual({ok:false,reason:'publication-conflict'});expect(called).toBe(false);expect(git(s.remote,['rev-parse','master']).trim()).toBe(s.baseSha);
});

it.each(['src','src/data','src/data/provider-player-boxes','src/data/observed-final-games','src/data/resolved-player-box-originals'])('an ancestor/store symlink is rejected before prepare reads data: %s',path=>{
 const s=setup();rmSync(join(s.other,path),{recursive:true});symlinkSync('/tmp',join(s.other,path));git(s.other,['add','-A']);git(s.other,['-c','user.name=fixture','-c','user.email=fixture@example.test','commit','-m','unsafe ancestor']);git(s.other,['push','origin','HEAD:master']);let prepared=false;
 expect(replayDataOnce({repository:s.work,temporaryRoot:s.root,baseSha:s.baseSha,prepareData:()=>{prepared=true;return[];}})).toEqual({ok:false,reason:'unsafe-latest-data'});expect(prepared).toBe(false);
});
it.each(['src','src/data','src/data/observed-final-games'])('a missing ancestor/store fails closed instead of passing an empty recursive listing: %s',path=>{
 const s=setup();rmSync(join(s.other,path),{recursive:true});git(s.other,['add','-A']);git(s.other,['-c','user.name=fixture','-c','user.email=fixture@example.test','commit','-m','missing ancestor']);git(s.other,['push','origin','HEAD:master']);let prepared=false;
 expect(replayDataOnce({repository:s.work,temporaryRoot:s.root,baseSha:s.baseSha,prepareData:()=>{prepared=true;return[];}})).toEqual({ok:false,reason:'unsafe-latest-data'});expect(prepared).toBe(false);
});
