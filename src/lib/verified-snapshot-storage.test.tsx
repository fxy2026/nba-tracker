import{createElement}from'react';
import{renderToStaticMarkup}from'react-dom/server';
import{createHash}from'node:crypto';
import{mkdtempSync,mkdirSync,writeFileSync,readFileSync,cpSync,rmSync}from'node:fs';
import{join}from'node:path';
import{tmpdir}from'node:os';
import{expect,it}from'vitest';
import archive from'../data/recovered-player-boxes.json';
import generic from'../data/provider-player-boxes.json';
import storageSample from'./fixtures/provider-snapshot-storage-sample.json';
import hashes from'./fixtures/verified-box-pre-split-hashes.json';
import exclusions from'../data/excluded-provider-player-records.json';
import proof from'../data/recovered-player-box-provenance.json';
import schedule from'../data/schedule-2025-26.json';
import{readStoredArchives,generateStoredArchives,readVerifiedSnapshotDirectory}from'../../scripts/recovery/snapshot-store';
import{validateRecoveredPlayerBox}from'./recovered-player-box';
import type{ScheduleGame}from'./api';
import RecoveredPlayerBox from'@/app/game/[id]/_components/RecoveredPlayerBox';
const stable=(value:unknown):string=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const sha=(value:unknown)=>createHash('sha256').update(stable(value)).digest('hex');
const ids=['0042500201','0042500202','0042500203','0042500204','0042500205','0042500206','0042500207','0042500212','0042500213','0042500214','0042500221','0042500222','0042500223','0042500224','0042500231','0042500232','0042500233','0042500234','0042500235','0042500236'] as const;
const gameFor=(id:string)=>schedule.dates.flatMap(day=>day.games).find(g=>g.gameId===id)! as ScheduleGame;
it('all old15 snapshots retain exact canonical values after splitting',()=>{for(const[id,hash]of Object.entries(hashes))expect(sha((archive as Record<string,unknown>)[id])).toBe(hash);});
it('all new20 games retain465 verified played rows and exact historical-team totals',()=>{
 expect(ids.flatMap(id=>archive[id].players)).toHaveLength(465);
 for(const id of ids){const box=validateRecoveredPlayerBox(archive[id],gameFor(id));expect(box).not.toBeNull();expect(Object.hasOwn(generic,id)).toBe(false);for(const p of box!.players)expect((proof[id].nameToTeam as Record<string,string>)[p.name]).toBe(p.team);}
});
it('ten excluded records can reconstruct each original snapshot exactly',()=>{
 let count=0;for(const[id,entry]of Object.entries(exclusions)){
  const box=(archive as Record<string,unknown>)[id] as typeof archive['0042500203'];const accepted=box.players.map(player=>{const{minutes,...rest}=player;return{...rest,team:null,minutesRounded:minutes};});
  const players:unknown[]=[];let cursor=0;
  for(let i=0;i<accepted.length+entry.records.length;i++){const excluded=entry.sourceRowIndices.indexOf(i);players.push(excluded>=0?entry.records[excluded]:accepted[cursor++]);}
  expect(sha({...entry.sourceEnvelope,players})).toBe(entry.sourceStoredSnapshotSha256);expect(box.excludedProviderRecords).toBe(entry.records.length);count+=entry.records.length;
 }
 expect(count).toBe(10);
});
it.each([true,false])('unsupported records are disclosed but not displayed as players %s',isZh=>{
 const box=validateRecoveredPlayerBox(archive['0042500214'],gameFor('0042500214'))!;const html=renderToStaticMarkup(createElement(RecoveredPlayerBox,{box,isZh}));expect(html).toContain(isZh?'已排除 5 条':'5 provider records');expect(html).not.toContain('Tyrese Martin');expect(box.players).toHaveLength(28);
});
it('legitimate short appearances rounded to zero remain in verified tables',()=>{
 expect(archive['0042500206'].players.find(p=>p.name==='Tolu Smith')?.minutes).toBe(0);expect(archive['0042500204'].players.filter(p=>p.minutes===0).length).toBeGreaterThanOrEqual(5);
});
function fixtureRoot(){const root=mkdtempSync(join(tmpdir(),'nba-verified-store-'));for(const dir of ['provider-player-boxes','recovered-player-boxes','quarantined-player-boxes','resolved-player-box-originals','supplemented-player-box-originals'])cpSync(`src/data/${dir}`,join(root,dir),{recursive:true});for(const file of ['schedule-2025-26.json','player-box-quarantine.json','resolved-player-box-quarantine.json','supplemented-player-box-history.json'])cpSync(`src/data/${file}`,join(root,file));return root;}
it('clean source generates both missing aggregates without an import cycle',()=>{const root=fixtureRoot();try{generateStoredArchives(root);expect(JSON.parse(readFileSync(join(root,'recovered-player-boxes.json'),'utf8'))).toEqual(archive);expect(JSON.parse(readFileSync(join(root,'provider-player-boxes.json'),'utf8'))).toEqual(generic);expect(readStoredArchives(root).verified).toEqual(archive);}finally{rmSync(root,{recursive:true,force:true});}});
it('bad verified input cannot replace either known-good generated aggregate',()=>{const root=fixtureRoot();try{generateStoredArchives(root);const before=['provider-player-boxes.json','recovered-player-boxes.json'].map(file=>readFileSync(join(root,file),'utf8'));const bad=structuredClone(archive['0042500201']);bad.players[0].points++;writeFileSync(join(root,'recovered-player-boxes/0042500201.json'),JSON.stringify(bad));expect(()=>generateStoredArchives(root)).toThrow();for(const[file,index]of [['provider-player-boxes.json',0],['recovered-player-boxes.json',1]] as const)expect(readFileSync(join(root,file),'utf8')).toBe(before[index]);}finally{rmSync(root,{recursive:true,force:true});}});
it('duplicate provider UUID across generic and verified archives fails before generation',()=>{const root=fixtureRoot();try{const row=structuredClone(storageSample);row.game.nbaGameId='0042500991';row.game.providerMatchId=archive['0042500201'].providerMatchId;writeFileSync(join(root,`provider-player-boxes/${row.game.nbaGameId}.json`),JSON.stringify(row));expect(()=>generateStoredArchives(root)).toThrow();}finally{rmSync(root,{recursive:true,force:true});}});
it('verified filename identity mismatch is rejected',()=>{const root=mkdtempSync(join(tmpdir(),'nba-verified-name-'));try{mkdirSync(join(root,'verified'));writeFileSync(join(root,'verified/0042500999.json'),JSON.stringify(archive['0042500201']));expect(()=>readVerifiedSnapshotDirectory(join(root,'verified'),schedule)).toThrow();}finally{rmSync(root,{recursive:true,force:true});}});
it('unconfirmed loss of generic files cannot blank the last-good aggregate',()=>{const root=fixtureRoot();try{generateStoredArchives(root);writeFileSync(join(root,'provider-player-boxes.json'),JSON.stringify({'0042500991':storageSample}));expect(()=>generateStoredArchives(root)).toThrow();}finally{rmSync(root,{recursive:true,force:true});}});
it('validator has no import of API or generated archives',()=>{const source=readFileSync('src/lib/recovered-player-box.ts','utf8');expect(source).not.toMatch(/import.*(?:api|\.json)/);});

it('validated promotion can remove an old generic ID while other generic rows remain',()=>{
 const root=fixtureRoot();try{
  const row=structuredClone(storageSample);row.game.nbaGameId='0042500991';row.game.providerMatchId='11111111-1111-4111-8111-111111111111';writeFileSync(join(root,`provider-player-boxes/${row.game.nbaGameId}.json`),JSON.stringify(row));generateStoredArchives(root);
  const current=JSON.parse(readFileSync(join(root,'provider-player-boxes.json'),'utf8'));writeFileSync(join(root,'provider-player-boxes.json'),JSON.stringify({...current,[storageSample.game.nbaGameId]:storageSample}));
  generateStoredArchives(root);const output=JSON.parse(readFileSync(join(root,'provider-player-boxes.json'),'utf8'));expect(output).toEqual(current);expect(output).not.toHaveProperty(storageSample.game.nbaGameId);expect(output).toHaveProperty(row.game.nbaGameId);
 }finally{rmSync(root,{recursive:true,force:true});}
});
