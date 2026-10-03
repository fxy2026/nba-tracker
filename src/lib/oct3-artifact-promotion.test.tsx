import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createHash} from 'node:crypto';
import {expect,it} from 'vitest';
import archive from '../data/recovered-player-boxes.json';
import proof from '../data/recovered-player-box-provenance.json';
import fixture from './fixtures/oct3-artifact-promotion-hashes.json';
import schedule from '../data/schedule-2025-26.json';
import {validateRecoveredPlayerBox,type RecoveredPlayerBox as Box} from './recovered-player-box';
import RecoveredPlayerBox from '../app/game/[id]/_components/RecoveredPlayerBox';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)).digest('hex');
const boxes=archive as Record<string,Box>;
it('retains all57 existing verified games exactly',()=>{expect(Object.keys(fixture.oldVerified)).toHaveLength(57);for(const[id,sha]of Object.entries(fixture.oldVerified))expect(hash(boxes[id])).toBe(sha);});
it('recovers all11 artifact games239rows without changing provider values',()=>{
 expect(Object.keys(fixture.sources)).toHaveLength(11);let count=0;
 for(const[id,source]of Object.entries(fixture.sources)){
  const raw=boxes[id];const game=schedule.dates.flatMap(d=>d.games).find(g=>g.gameId===id)!;const box=validateRecoveredPlayerBox(raw,game);expect(box).not.toBeNull();count+=box!.players.length;
  const evidence=(proof as Record<string,{sourceWorkflowRunId?:number;nameToTeam:Record<string,string>}>)[id];expect(evidence.sourceWorkflowRunId).toBe(37085128575);
  const players=box!.players.map(({team,minutes,...rest})=>{expect(evidence.nameToTeam[rest.name]).toBe(team);return {...rest,team:null,minutesRounded:minutes};});expect(hash({...source.envelope,players})).toBe(source.sha256);
  for(const side of ['home','away'] as const)expect(box!.players.filter(p=>p.team===box![side]).reduce((sum,p)=>sum+p.points,0)).toBe(box![`${side}Score`]);
 }expect(count).toBe(239);
});
it.each([true,false])('renders complete actual team tables, including rounded-zero played rows %s',isZh=>{
 const box=boxes['0042500142'];expect(box.players.filter(p=>p.minutes===0).length).toBeGreaterThanOrEqual(2);
 const html=renderToStaticMarkup(createElement(RecoveredPlayerBox,{box,isZh}));expect(html.match(/<table/g)).toHaveLength(2);expect(html.match(/<th scope="row"/g)).toHaveLength(box.players.length);expect(html).toContain('BigBallsData');
});
