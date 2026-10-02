import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import archive from '../data/recovered-player-boxes.json';
import generic from '../data/provider-player-boxes.json';
import proof from '../data/recovered-player-box-provenance.json';
import fixture from './fixtures/first-round-promotion-source-hashes.json';
import schedule from '../data/schedule-2025-26.json';
import {validateRecoveredPlayerBox,type RecoveredPlayerBox as Box} from './recovered-player-box';
import RecoveredPlayerBox from '../app/game/[id]/_components/RecoveredPlayerBox';
const stable=(value:unknown):string=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const hash=(value:unknown)=>createHash('sha256').update(stable(value)).digest('hex');
const boxes=archive as Record<string,Box>;
const gameFor=(id:string)=>schedule.dates.flatMap(d=>d.games).find(g=>g.gameId===id)!;
const ids=Object.keys(fixture.sources);
it('preserves all35 previously verified snapshots exactly',()=>{for(const[id,sha]of Object.entries(fixture.oldVerified))expect(hash(boxes[id])).toBe(sha);});
it('promotes19 complete games423rows and19 partial rows without changing source values',()=>{
 expect(ids).toHaveLength(20);expect(ids.filter(id=>!boxes[id].playedCoverage).flatMap(id=>boxes[id].players)).toHaveLength(423);
 for(const[id,source]of Object.entries(fixture.sources)){
  const box=validateRecoveredPlayerBox(boxes[id],gameFor(id));expect(box).not.toBeNull();
  const players=box!.players.map(row=>{const {minutes,team,...rest}=row;expect((proof as Record<string,{nameToTeam:Record<string,string>}>)[id].nameToTeam[row.name]).toBe(team);return {...rest,team:null,minutesRounded:minutes};});
  expect(hash({...source.envelope,players})).toBe(source.sha256);
 }
 expect(generic).toEqual({});expect(Object.keys(boxes)).toHaveLength(55);expect(Object.values(boxes).flatMap(box=>box.players)).toHaveLength(1234);
 expect(boxes['0042500154']).toBeUndefined();expect(boxes['0042500155']).toBeUndefined();
});
it('keeps five complete-group appearances genuinely rounded to zero',()=>{expect(ids.filter(id=>id!=='0042500164').flatMap(id=>boxes[id].players).filter(row=>row.minutes===0)).toHaveLength(5);});
it('partial game keeps19 valid rows with exact team points and two missing official names',()=>{
 const box=boxes['0042500164'];expect(validateRecoveredPlayerBox(box,gameFor(box.gameId))).not.toBeNull();expect(box.players).toHaveLength(19);
 expect(box.playedCoverage).toMatchObject({officialPlayedPlayerCount:21,missingOfficialPlayedPlayers:[{officialName:'DaRon Holmes II',team:'DEN'},{officialName:'Jalen Pickett',team:'DEN'}]});
 expect(box.players.filter(p=>p.team==='DEN')).toHaveLength(8);expect(box.players.filter(p=>p.team==='MIN')).toHaveLength(11);
 expect(box.players.some(p=>['DaRon Holmes II','Jalen Pickett'].includes(p.name))).toBe(false);
});
it.each([true,false])('bilingual partial notice does not add invented player rows %s',isZh=>{
 const box=boxes['0042500164'];const html=renderToStaticMarkup(createElement(RecoveredPlayerBox,{box,isZh}));
 expect(html).toContain(isZh?'19/21 名实际出场球员':'19 of 21 played players');expect(html).toContain('DaRon Holmes II');expect(html).toContain('Jalen Pickett');
 expect(html.match(/<th scope="row"/g)).toHaveLength(19);expect(html).not.toContain('<th scope="row" class="p-3 text-left font-medium sticky left-0 bg-bg-card">DaRon');
});
it.each(['count','empty','duplicate','displayed','wrong-team','reason','report','hash','source','status','bad-points'])('rejects invalid partial proof %s',kind=>{
 const raw=structuredClone(boxes['0042500164']);const c=raw.playedCoverage!;
 if(kind==='count')c.officialPlayedPlayerCount=20;
 if(kind==='empty')c.missingOfficialPlayedPlayers=[];
 if(kind==='duplicate')c.missingOfficialPlayedPlayers[1]={...c.missingOfficialPlayedPlayers[0]};
 if(kind==='displayed')c.missingOfficialPlayedPlayers[0].officialName=raw.players[0].name.toLowerCase();
 if(kind==='wrong-team')c.missingOfficialPlayedPlayers[0].team='LAL';
 if(kind==='reason')Object.assign(c.missingOfficialPlayedPlayers[0],{reason:'DNP'});
 if(kind==='report')c.reportUrl=boxes['0042500405'].reportUrl;
 if(kind==='hash')c.reportSha256='bad';
 if(kind==='source')Object.assign(c,{source:'unknown'});
 if(kind==='status')Object.assign(c,{status:'complete'});
 if(kind==='bad-points')raw.players[0].points++;
 expect(validateRecoveredPlayerBox(raw,gameFor(raw.gameId))).toBeNull();
});
