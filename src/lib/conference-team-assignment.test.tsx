import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect,it } from 'vitest';
import archive from '../data/recovered-player-boxes.json';
import generic from '../data/provider-player-boxes.json';
import proof from '../data/recovered-player-box-provenance.json';
import schedule from '../data/schedule-2025-26.json';
import {validateRecoveredPlayerBox} from './recovered-player-box';
import type{ScheduleGame}from'./api';
import RecoveredPlayerBox from '../app/game/[id]/_components/RecoveredPlayerBox';
const ids=['0042500301','0042500302','0042500304','0042500311','0042500312','0042500314','0042500315','0042500317'] as const;
const gameFor=(id:string)=>schedule.dates.flatMap(d=>d.games).find(g=>g.gameId===id)! as ScheduleGame;
it.each(ids)('%s has validated per-game historical sides and team points',id=>{
 const box=validateRecoveredPlayerBox(archive[id],gameFor(id));expect(box).not.toBeNull();expect(Object.hasOwn(generic,id)).toBe(false);
 expect(box!.players).toHaveLength(proof[id].playerRows);
 for(const row of box!.players)expect((proof[id].nameToTeam as Record<string,string>)[row.name]).toBe(row.team);
 for(const team of [box!.home,box!.away])expect(box!.players.filter(p=>p.team===team).reduce((s,p)=>s+p.points,0)).toBe(team===box!.home?box!.homeScore:box!.awayScore);
});
it('185 rows retained, with exactly one verified block correction',()=>{
 const rows=ids.flatMap(id=>validateRecoveredPlayerBox(archive[id],gameFor(id))!.players);expect(rows).toHaveLength(185);
 const corrected=rows.filter(p=>p.blocksCorrection);expect(corrected).toHaveLength(1);expect(corrected[0]).toMatchObject({name:'Tyrese Proctor',team:'CLE',blocks:0,blocksCorrection:{originalProviderBlocks:1,officialBlocks:0,reportSha256:proof['0042500304'].officialReportSha256}});
 const box=validateRecoveredPlayerBox(archive['0042500304'],gameFor('0042500304'))!;expect(box.players.filter(p=>p.team==='CLE').reduce((n,p)=>n+(p.blocks??0),0)).toBe(4);
});
it.each([true,false])('corrected block zero has explicit official source note: %s',isZh=>{
 const box=validateRecoveredPlayerBox(archive['0042500304'],gameFor('0042500304'))!;
 const html=renderToStaticMarkup(createElement(RecoveredPlayerBox,{box,isZh}));expect(html.match(/<table/g)).toHaveLength(2);expect(html).toContain('0†');expect(html).toContain(isZh?'标记的盖帽数已按本场':'Marked block counts were corrected');expect(html).toContain(box.reportUrl);
});
it.each(['value','report','original-negative','official-negative','hash','source'])('rejects invalid block correction %s',kind=>{
 const raw=structuredClone(archive['0042500304']);const row=raw.players.find(p=>p.name==='Tyrese Proctor')!;const correction=row.blocksCorrection!;
 if(kind==='value')row.blocks=1;
 if(kind==='report')correction.reportUrl=archive['0042500301'].reportUrl;
 if(kind==='original-negative')correction.originalProviderBlocks=-1;
 if(kind==='official-negative')correction.officialBlocks=-1;
 if(kind==='hash')correction.reportSha256='not-hash';
 if(kind==='source')correction.source='unverified';
 expect(validateRecoveredPlayerBox(raw,gameFor('0042500304'))).toBeNull();
});
it('accent-only official aliases keep stored display identity',()=>{
 for(const id of ['0042500301','0042500302'] as const){expect(archive[id].players.some(p=>p.name==='Dennis Schröder')).toBe(true);expect(proof[id].nameAliases[0]).toMatchObject({storedName:'Dennis Schröder',officialName:'Dennis Schroder'});}
});
