import { afterEach, expect, it } from 'vitest';
import { mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,readdirSync,symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readSnapshotDirectory,writeNewSnapshots,generateSnapshotAggregate } from '../../scripts/recovery/snapshot-store';
import archive from '../data/provider-player-boxes.json';
import type { ProviderBasicSnapshot } from './provider-player-normalizer';
const roots:string[]=[];
const setup=()=>{const root=mkdtempSync(join(tmpdir(),'nba-storage-test-'));roots.push(root);const directory=join(root,'games');mkdirSync(directory);return{root,directory,output:join(root,'aggregate.json')};};
const sample=()=>structuredClone(Object.values(archive)[0]) as ProviderBasicSnapshot;
const next=()=>{const row=sample();row.game.nbaGameId='0042500991';row.game.providerMatchId='11111111-1111-4111-8111-111111111111';return row;};
const save=(dir:string,row:ProviderBasicSnapshot)=>writeFileSync(join(dir,`${row.game.nbaGameId}.json`),JSON.stringify(row));
afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
it('authoritative per-game files exactly equal generated server archive',()=>{
 expect(readSnapshotDirectory('src/data/provider-player-boxes')).toEqual(archive);
});
it('generation preserves every value and is deterministic across file order',()=>{
 const {directory,output}=setup();save(directory,next());save(directory,sample());generateSnapshotAggregate(directory,output);
 const first=readFileSync(output,'utf8');expect(JSON.parse(first)).toEqual({[sample().game.nbaGameId]:sample(),[next().game.nbaGameId]:next()});
 generateSnapshotAggregate(directory,output);expect(readFileSync(output,'utf8')).toBe(first);
});
it('one corrupt file aborts before replacing known-good generated data',()=>{
 const {directory,output}=setup();save(directory,sample());generateSnapshotAggregate(directory,output);const good=readFileSync(output,'utf8');
 writeFileSync(join(directory,'0042500991.json'),'{broken');expect(()=>generateSnapshotAggregate(directory,output)).toThrow();expect(readFileSync(output,'utf8')).toBe(good);
});
it('valid-empty directory cannot erase an existing nonempty aggregate',()=>{
 const {directory,output}=setup();writeFileSync(output,JSON.stringify(archive));expect(()=>generateSnapshotAggregate(directory,output)).toThrow();expect(JSON.parse(readFileSync(output,'utf8'))).toEqual(archive);
});
it.each(['../escape.json','unknown.json','0042500991.json'])('invalid filename or game identity fails closed: %s',filename=>{
 const {directory}=setup();const target=filename.startsWith('../')?join(directory,'unknown.json'):join(directory,filename);writeFileSync(target,JSON.stringify(sample()));expect(()=>readSnapshotDirectory(directory)).toThrow();
});
it('symlink input is rejected',()=>{const{root,directory}=setup();const file=join(root,'source.json');writeFileSync(file,JSON.stringify(sample()));symlinkSync(file,join(directory,`${sample().game.nbaGameId}.json`));expect(()=>readSnapshotDirectory(directory)).toThrow();});
it('duplicate provider UUID across saved games is rejected',()=>{const {directory}=setup();save(directory,sample());const row=next();row.game.providerMatchId=sample().game.providerMatchId;save(directory,row);expect(()=>readSnapshotDirectory(directory)).toThrow();});
it('new snapshots write one new file without rewriting existing data',()=>{
 const{directory}=setup();save(directory,sample());const original=readFileSync(join(directory,`${sample().game.nbaGameId}.json`),'utf8');writeNewSnapshots(directory,[next()],new Set());expect(readdirSync(directory)).toHaveLength(2);expect(readFileSync(join(directory,`${sample().game.nbaGameId}.json`),'utf8')).toBe(original);
});
it.each(['existing','protected','invalid','duplicate','owner'])('entire batch is checked before any writes: %s',kind=>{
 const{directory}=setup();save(directory,sample());const bad=next();const protectedIds=new Set<string>();
 if(kind==='existing')bad.game.nbaGameId=sample().game.nbaGameId;
 if(kind==='protected')protectedIds.add(bad.game.nbaGameId);
 if(kind==='invalid')bad.players=[];
 if(kind==='owner')bad.game.providerMatchId=sample().game.providerMatchId;
 const batch=kind==='duplicate'?[next(),next()]:[bad];expect(()=>writeNewSnapshots(directory,batch,protectedIds)).toThrow();expect(readdirSync(directory)).toHaveLength(1);
});
