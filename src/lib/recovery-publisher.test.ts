import { afterEach,expect,it,vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { cpSync,mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,readdirSync } from 'node:fs';
import { join,dirname } from 'node:path';
import { tmpdir } from 'node:os';
import sample from './fixtures/provider-snapshot-storage-sample.json';
import { publishPendingRecoveryData } from '../../scripts/recovery/publish-pending';
import { gitAuthenticationDenied,type ReplayGit } from '../../scripts/recovery/replay-git';
import { writePendingBatch } from '../../scripts/recovery/pending-batch';
import { writeNewSnapshots } from '../../scripts/recovery/snapshot-store';
import { writeObservedFinals } from '../../scripts/recovery/official-game-store';
import { OFFICIAL_RECOVERY_SCHEDULE_URL,projectOfficialRecoverySchedule } from './recovery-official-schedule';
import type { ProviderBasicSnapshot } from './provider-player-normalizer';
const roots:string[]=[];
const git:ReplayGit=(cwd,args)=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
function save(cwd:string,file:string,text:string){mkdirSync(dirname(join(cwd,file)),{recursive:true});writeFileSync(join(cwd,file),text);}
function commit(cwd:string,message='fixture'){git(cwd,['add','-A']);git(cwd,['-c','user.name=fixture','-c','user.email=fixture@example.test','commit','-m',message]);return git(cwd,['rev-parse','HEAD']).trim();}
function setup(){
 const root=mkdtempSync(join(tmpdir(),'nba-publisher-'));roots.push(root);const remote=join(root,'remote.git'),work=join(root,'work'),other=join(root,'other');
 execFileSync('git',['init','--bare','--initial-branch=master',remote],{stdio:'ignore'});execFileSync('git',['clone',remote,work],{stdio:'ignore'});
 cpSync('src/data',join(work,'src/data'),{recursive:true});cpSync('.gitignore',join(work,'.gitignore'));save(work,'README.md','original\n');
 const baseSha=commit(work);git(work,['push','origin','HEAD:master']);execFileSync('git',['clone',remote,other],{stdio:'ignore'});
 const row=structuredClone(sample) as ProviderBasicSnapshot;row.game={...row.game,nbaGameId:'0022600001',providerMatchId:'11111111-1111-4111-8111-111111111111',season:'2026-27',gameDate:'2026-10-01'};
 const observedAt='2026-10-02T00:00:00Z';
 const result=projectOfficialRecoverySchedule({leagueSchedule:{seasonYear:'2026-27',gameDates:[{games:[{gameId:row.game.nbaGameId,gameStatus:3,gameCode:'20261001/DENMIN',gameDateTimeUTC:'2026-10-01T23:00:00Z',homeTeam:{teamId:1610612750,teamTricode:'MIN',score:112},awayTeam:{teamId:1610612743,teamTricode:'DEN',score:96}}]}]}},{expectedSeason:'2026-27',now:observedAt,source:{url:OFFICIAL_RECOVERY_SCHEDULE_URL,sha256:'a'.repeat(64),observedAt}});
 if(result.status!=='ready')throw Error('Invalid synthetic test identity');const observation={version:1 as const,game:result.games[0],source:result.source};
 writePendingBatch(join(root,'nba-player-pending-123'),[row],{baseSha,runId:123},new Set(),[observation]);
 writeObservedFinals(join(work,'src/data/observed-final-games'),[observation]);writeNewSnapshots(join(work,'src/data/provider-player-boxes'),[row],new Set());
 save(work,'src/data/provider-recovery-state.json','{"cursor":"original-batch-cursor"}\n');
 const advance=(file='README.md',text='newer unrelated content\n')=>{save(other,file,text);const sha=commit(other);git(other,['push','origin','HEAD:master']);return sha;};
 return{root,work,other,remote,baseSha,row,observation,advance,options:{repository:work,temporaryRoot:root,baseSha,runId:123}};
}
afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});vi.unstubAllGlobals();});
it('normal validated publication stays on its original single-fetch/commit/push path',()=>{
 const s=setup(),calls:string[][]=[];const transport:ReplayGit=(cwd,args)=>{calls.push(args);return git(cwd,args);};
 const result=publishPendingRecoveryData(s.options,transport);expect(result).toMatchObject({ok:true,status:'published'});
 expect(calls.filter(a=>a[0]==='fetch')).toHaveLength(1);expect(calls.filter(a=>a[0]==='push')).toHaveLength(1);expect(calls.some(a=>a[0]==='worktree')).toBe(false);
 expect(git(s.remote,['show','master:src/data/provider-recovery-state.json'])).toContain('original-batch-cursor');
});
it('real typed bundle replays only new data over newer master, retaining its state and code',()=>{
 const s=setup();s.advance();s.advance('src/data/provider-recovery-state.json','{"cursor":"newer-master-cursor","retained":true}\n');
 const blocked=vi.fn(()=>{throw Error('Unexpected provider request');});vi.stubGlobal('fetch',blocked);
 const result=publishPendingRecoveryData(s.options);expect(result).toMatchObject({ok:true,status:'replayed'});expect(blocked).not.toHaveBeenCalled();
 expect(git(s.remote,['show','master:README.md'])).toBe('newer unrelated content\n');expect(git(s.remote,['show','master:src/data/provider-recovery-state.json'])).toContain('newer-master-cursor');
 expect(JSON.parse(git(s.remote,['show','master:src/data/provider-player-boxes/0022600001.json']))).toEqual(s.row);
 expect(JSON.parse(git(s.remote,['show','master:src/data/observed-final-games/0022600001.json']))).toEqual(s.observation);
 expect(git(s.remote,['diff-tree','--no-commit-id','--name-status','-r','master']).trim().split('\n')).toEqual(['A\tsrc/data/observed-final-games/0022600001.json','A\tsrc/data/provider-player-boxes/0022600001.json']);
 expect(readdirSync(join(s.root,'nba-player-pending-123'))).toHaveLength(3);
});
it('an explicit original push permission denial stops immediately without another push/replay',()=>{
 const s=setup();let pushes=0;const calls:string[][]=[];const transport:ReplayGit=(cwd,args)=>{calls.push(args);if(args[0]==='push'){pushes++;throw Object.assign(Error('masked'),{stderr:'remote: Permission to fxy2026/nba-tracker denied DO_NOT_EXPORT_KEY'});}return git(cwd,args);};
 const result=publishPendingRecoveryData(s.options,transport);expect(result).toEqual({ok:false,reason:'publication-auth-denied'});expect(pushes).toBe(1);expect(calls.some(a=>a[0]==='worktree')).toBe(false);expect(JSON.stringify(result)).not.toContain('DO_NOT_EXPORT');
});
it('successful original write with lost response confirms its SHA without making a second commit',()=>{
 const s=setup();let pushes=0;const transport:ReplayGit=(cwd,args)=>{if(args[0]==='push'){pushes++;git(cwd,args);throw Error('synthetic lost response');}return git(cwd,args);};
 const result=publishPendingRecoveryData(s.options,transport);expect(result).toMatchObject({ok:true,status:'original-confirmed'});expect(pushes).toBe(1);
});
it('same game already present is skipped only when all values and provenance match',()=>{
 const s=setup();writeObservedFinals(join(s.other,'src/data/observed-final-games'),[s.observation]);writeNewSnapshots(join(s.other,'src/data/provider-player-boxes'),[s.row],new Set());const latest=commit(s.other);git(s.other,['push','origin','HEAD:master']);
 expect(publishPendingRecoveryData(s.options)).toEqual({ok:true,status:'identical-present',commit:latest});
});
it('conflicting provenance refuses the batch and retains the original recovery package',()=>{
 const s=setup(),changed=structuredClone(s.observation);changed.source.observedAt='2026-10-02T00:01:00Z';writeObservedFinals(join(s.other,'src/data/observed-final-games'),[changed]);const latest=commit(s.other);git(s.other,['push','origin','HEAD:master']);
 const before=readFileSync(join(s.root,'nba-player-pending-123/manifest.json'),'utf8');expect(publishPendingRecoveryData(s.options)).toEqual({ok:false,reason:'pending-batch-conflict'});
 expect(git(s.remote,['rev-parse','master']).trim()).toBe(latest);expect(readFileSync(join(s.root,'nba-player-pending-123/manifest.json'),'utf8')).toBe(before);
});
it('a copied bundle from another run cannot be replayed',()=>{const s=setup();s.advance();expect(publishPendingRecoveryData({...s.options,runId:124})).toMatchObject({ok:false});});
it('unrelated staged code cannot enter the normal publication commit',()=>{const s=setup();save(s.work,'src/injected.ts','invalid');git(s.work,['add','src/injected.ts']);expect(publishPendingRecoveryData(s.options)).toEqual({ok:false,reason:'invalid-publication'});expect(git(s.remote,['rev-parse','master']).trim()).toBe(s.baseSha);});
it.each(['fatal: Authentication failed','The requested URL returned error: 403','HTTP 401','write access to repository not granted','fatal: could not read Username','GH006: Protected branch update failed','GH013: Repository rule violations found','pre-receive hook declined'])('classifies known denials without returning their text: %s',text=>expect(gitAuthenticationDenied({stderr:Buffer.from(text)})).toBe(true));
