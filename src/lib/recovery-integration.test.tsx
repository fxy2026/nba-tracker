import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect,it,vi } from 'vitest';
import schedule from '../data/schedule-2025-26.json';
import verified from '../data/recovered-player-boxes.json';
import { selectRecoveryTargets } from './recovery-target-selection';
import { validateProviderPlayerSnapshot } from './provider-player-snapshot';
import type {ProviderBasicSnapshot}from'./provider-player-normalizer';
import ProviderPlayerBox from '@/app/game/[id]/_components/ProviderPlayerBox';
import{runRecoveryBatch}from'./recovery-batch';
import{createRecoveryProviderClient}from'./recovery-provider-client';

const box=verified['0022500961'];
function sample():ProviderBasicSnapshot{return{version:1,provider:'BigBallsData',coverage:'provider-basic-unassigned',game:{nbaGameId:box.gameId,providerMatchId:box.providerMatchId,season:box.season,gameDate:box.gameDate,home:{tricode:box.home,score:box.homeScore},away:{tricode:box.away,score:box.awayScore}},retrievedAt:box.retrievedAt,retrievedAtPrecision:'approximate-minute',players:box.players.map(p=>({...p,team:null,providerPlayerId:null,minutesRounded:p.minutes})),validation:{combinedPoints:236,historicalTeams:'unassigned',officialReportChecked:false}};}
it('target generation is bounded, canonical and skips all stronger/cached rows',()=>{const targets=selectRecoveryTargets(schedule,new Set(Object.keys(verified)),null);expect(targets.length).toBeLessThanOrEqual(20);expect(new Set(targets.map(g=>g.nbaGameId)).size).toBe(targets.length);expect(targets.every(g=>g.season==='2025-26'&&g.lookupDates.includes(g.gameDate)&&g.lookupDates.length<=2&&/^00[1245]25/.test(g.nbaGameId))).toBe(true);expect(targets.some(g=>Object.hasOwn(verified,g.nbaGameId))).toBe(false);});
it('target generation remains valid as durable coverage reaches exhaustion',()=>{
 const games=Array.from({length:23},(_,index)=>({gameId:`00225${String(index+1).padStart(5,'0')}`,gameStatus:3,gameCode:'20260313/MEMDET',gameDateTimeUTC:'2026-03-13T23:00:00Z',homeTeam:{teamTricode:'DET',score:100+index},awayTeam:{teamTricode:'MEM',score:90}}));
 const source={dates:[{games}]};
 for(const remaining of [23,20,19,1,0]){
  const saved=new Set(games.slice(remaining).map(g=>g.gameId));
  const targets=selectRecoveryTargets(source,saved,null);
  expect(targets).toHaveLength(Math.min(remaining,20));
  expect(targets.every(g=>!saved.has(g.nbaGameId))).toBe(true);
 }
});
it('persisted cursor advances after unavailable candidates instead of retrying only newestgames',()=>{const first=selectRecoveryTargets(schedule,new Set(),null,2);const next=selectRecoveryTargets(schedule,new Set(),first[1].nbaGameId,2);expect(next[0].nbaGameId).not.toBe(first[0].nbaGameId);expect(next[0].nbaGameId).not.toBe(first[1].nbaGameId);});
it('validates saved combined snapshot without adding team assignment',()=>{const result=validateProviderPlayerSnapshot(sample())!;expect(result.players).toHaveLength(22);expect(result.players.every(p=>p.team===null)).toBe(true);});
it.each(['score','team','points','date','nan','official-claim'])('saved snapshot rejects%s corruption',kind=>{const raw=sample();if(kind==='score')raw.game.home.score++;if(kind==='team')Reflect.set(raw.players[0],'team','DET');if(kind==='points')raw.players[0].points++;if(kind==='date')raw.game.gameDate='2026-02-30';if(kind==='nan')raw.players[0].minutesRounded=NaN;if(kind==='official-claim')Reflect.set(raw.validation,'officialReportChecked',true);expect(validateProviderPlayerSnapshot(raw)).toBeNull();});
it.each([true,false])('combined UI clearly labels unknown historicalteams and source, zh=%s',isZh=>{const html=renderToStaticMarkup(createElement(ProviderPlayerBox,{box:sample(),isZh}));expect(html).toContain('Jalen Duren');expect(html).toContain('BigBallsData');expect(html).toContain(isZh?'不使用现效力球队分组':'current roster teams are not used');expect(html.match(/<table/g)).toHaveLength(1);expect(html).not.toContain('/player/');});
it('batchneverfetches strongerverifiedgames',async()=>{const fetcher=vi.fn();const target={...sample().game,lookupDates:['2026-03-13']};const c=createRecoveryProviderClient({apiKey:'TEST_ONLY',maxRequests:3,expiresAt:'2026-10-03T00:00:00Z',now:()=>Date.parse('2026-10-02T03:17:00Z'),fetcher});const result=await runRecoveryBatch([target],c,3,new Set([box.gameId]));expect(result.requests).toBe(0);expect(fetcher).not.toHaveBeenCalled();});
it('batchstops onproviderfailure without treatingit asvalidempty',async()=>{const fetcher=vi.fn().mockResolvedValue(new Response('unavailable',{status:403}));const target={...sample().game,lookupDates:['2026-03-13']};const c=createRecoveryProviderClient({apiKey:'TEST_ONLY',maxRequests:3,expiresAt:'2026-10-03T00:00:00Z',now:()=>Date.parse('2026-10-02T03:17:00Z'),fetcher});const result=await runRecoveryBatch([target,target],c,3,new Set());expect(result.requests).toBe(1);expect(result.accepted).toHaveLength(0);expect(result.rejected).toHaveLength(1);});
