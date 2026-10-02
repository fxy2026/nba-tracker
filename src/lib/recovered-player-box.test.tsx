import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import archive from '@/data/recovered-player-boxes.json';
import schedule from '@/data/schedule-2025-26.json';
import type { ScheduleGame } from './api';
import { validateRecoveredPlayerBox } from './recovered-player-box';
import { getRecoveredPlayerBox } from './recovered-player-box-archive';
import RecoveredPlayerBox from '@/app/game/[id]/_components/RecoveredPlayerBox';
const game=(id:string)=>schedule.dates.flatMap(d=>d.games).find(g=>g.gameId===id)! as ScheduleGame;
const id='0022500961';
it.each([['0022500961',22,110,126],['0022500340',19,134,133]])('verified snapshot%s restores real player stats', (id,n,away,home)=>{
 const box=getRecoveredPlayerBox(game(String(id)))!;expect(box).not.toBeNull();expect(box.players).toHaveLength(Number(n));
 for(const [team,score]of[[box.away,away],[box.home,home]])expect(box.players.filter(p=>p.team===team).reduce((sum,p)=>sum+p.points,0)).toBe(score);
});
it('historical side assignments do not follow incorrect current-team labels',()=>{
 const box=getRecoveredPlayerBox(game(id))!;for(const name of['Marcus Sasser','Isaiah Stewart','Caris LeVert'])expect(box.players.find(p=>p.name===name)?.team).toBe('DET');
 expect(box.players.find(p=>p.name==='DeJon Jarreau')?.team).toBe('MEM');expect(box.players.find(p=>p.name==='Jalen Duren')?.points).toBe(30);
 const other=getRecoveredPlayerBox(game('0022500340'))!;expect(other.players.find(p=>p.name==='Nikola Jokic')?.points).toBe(40);expect(other.players.find(p=>p.name==='Kristaps Porzingis')?.team).toBe('ATL');
});
it.each(['identity','date','team','score','player-side','points','fg','rebounds','duplicate','negative','nan','missing'])('rejects %s mismatch instead of displaying suspect data',kind=>{
 const raw=structuredClone(archive[id]);const p=raw.players[0];
 if(kind==='identity')raw.gameId='0022500340';if(kind==='date')raw.gameDate='2026-03-14';if(kind==='team')raw.home='BOS';if(kind==='score')raw.homeScore++;
 if(kind==='player-side')p.team='DAL';if(kind==='points')p.points++;if(kind==='fg')p.fieldGoalsMade=99;if(kind==='rebounds')p.rebounds=99;
 if(kind==='duplicate')raw.players.push(p);if(kind==='negative')p.assists=-1;if(kind==='nan')p.minutes=NaN;if(kind==='missing')raw.players.pop();
 expect(validateRecoveredPlayerBox(raw,game(id))).toBeNull();
});
it('unknown optional stats remain unknown and realzero survives',()=>{const raw=structuredClone(archive[id]);Reflect.set(raw.players[0],'minutes',null);Reflect.set(raw.players[0],'assists',null);const box=validateRecoveredPlayerBox(raw,game(id))!;expect(box.players[0].assists).toBeNull();expect(box.players[1].points).toBe(0);const html=renderToStaticMarkup(createElement(RecoveredPlayerBox,{box,isZh:false}));expect(html).toContain('—');expect(html).not.toContain('NaN');});
it.each([true,false])('renders both actual tables with source and rounded-minute caveat, zh=%s',isZh=>{const box=getRecoveredPlayerBox(game(id))!;const html=renderToStaticMarkup(createElement(RecoveredPlayerBox,{box,isZh}));expect(html.match(/<table/g)).toHaveLength(2);expect(html).toContain('Jalen Duren');expect(html).toContain('BigBallsData');expect(html).toContain('MIN ≈');expect(html).toContain(isZh?'取整值':'rounded');expect(html).not.toContain('/player/');});
it.each(['0042500405','9401810012','__proto__'])('does not invent unavailable snapshot%s',gameId=>expect(getRecoveredPlayerBox({...game(id),gameId})).toBeNull());
it('does not apply archive to live or scheduled games',()=>{expect(getRecoveredPlayerBox({...game(id),gameStatus:2})).toBeNull();});
