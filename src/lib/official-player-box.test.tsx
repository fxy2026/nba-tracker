import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cpSync,mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach,expect,it } from 'vitest';
import actualOvertime from './fixtures/official-only-overtime-box.json';
import historicalSchedule from '../data/schedule-2025-26.json';
import genericSample from './fixtures/provider-snapshot-storage-sample.json';
import { validateRecoveredPlayerBox,type RecoveredScheduleIdentity } from './recovered-player-box';
import { validateOfficialPlayerBox } from './official-player-box';
import { TEAM_META } from './teams';
import { readVerifiedSnapshotDirectory,buildStoredSnapshotIndex,generateStoredArchives,readStoredArchives } from '../../scripts/recovery/snapshot-store';
import { planRecoveryReplay } from './recovery-replay-plan';
import RecoveredPlayerBox from '@/app/game/[id]/_components/RecoveredPlayerBox';
const sample=()=>structuredClone(actualOvertime);
// Actual scorer report + independently reviewed final archive support this
// reference. The old schedule has a different score; it must still be refused.
const reference:RecoveredScheduleIdentity={gameId:actualOvertime.gameId,gameStatus:3,gameCode:'20260424/LALHOU',
 homeTeam:{teamId:TEAM_META.HOU.teamId,teamTricode:'HOU',score:108},awayTeam:{teamId:TEAM_META.LAL.teamId,teamTricode:'LAL',score:112}};
const roots:string[]=[];
const temp=()=>{const root=mkdtempSync(join(tmpdir(),'nba-official-box-'));roots.push(root);return root;};
afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
it('accepts complete actual overtime rows with null IDs and preserves a real00:01 appearance rounded0',()=>{
 const raw=sample(),before=JSON.stringify(raw);const box=validateRecoveredPlayerBox(raw,reference)!;
 expect(box).not.toBeNull();expect(box.players).toHaveLength(21);expect(box.providerMatchId).toBeNull();expect(box.players.every(p=>p.providerPlayerId===null)).toBe(true);
 expect(box.officialReport!.home.officialDuration).toBe('265:00');expect(box.officialReport!.away.officialDuration).toBe('265:00');
 expect(box.players.find(p=>p.name==='Nick Smith Jr.')).toMatchObject({minutes:0,officialSource:{officialDuration:'00:01'}});expect(JSON.stringify(raw)).toBe(before);
});
it('does not override an explicitly inconsistent schedule identity using a report claim',()=>{
 const wrong=structuredClone(reference);wrong.homeTeam.score=107;
 expect(validateRecoveredPlayerBox(sample(),wrong)).toBeNull();
 wrong.homeTeam.score=108;wrong.gameCode='20260425/LALHOU';
 expect(validateRecoveredPlayerBox(sample(),wrong)).toBeNull();
});
it.each(['game-id','date','season','team','team-id','score','live','missing-team-id'])('requires exact official schedule binding: %s',kind=>{
 const game=structuredClone(reference);const raw=sample();
 if(kind==='game-id')game.gameId='0042500174';if(kind==='date')raw.gameDate='2026-04-25';if(kind==='season')raw.season='2026-27';if(kind==='team')raw.home='DAL';if(kind==='team-id')game.homeTeam.teamId=TEAM_META.DAL.teamId;if(kind==='score')game.homeTeam.score++;if(kind==='live')game.gameStatus=2;if(kind==='missing-team-id')delete game.homeTeam.teamId;
 expect(validateRecoveredPlayerBox(raw,game)).toBeNull();
});
it.each(['match-id','player-id','nba-id','source','null-stat','missing-row','duplicate','minutes','exact-minutes','bad-seconds','starter','jersey','position','points','rebounds','shooting','null-report','url','hash','row-hash','page','date','unknown-key','provider-claim','partial','dnp'])('rejects incomplete or mismatched official-only evidence: %s',kind=>{
 const raw=sample(),p=raw.players[0],s=p.officialSource;
 if(kind==='match-id')Reflect.set(raw,'providerMatchId','11111111-1111-4111-8111-111111111111');
 if(kind==='player-id')Reflect.set(p,'providerPlayerId','11111111-1111-4111-8111-111111111111');
 if(kind==='nba-id')Reflect.set(p,'personId',2544);if(kind==='source')p.source='BigBallsData';if(kind==='null-stat')Reflect.set(p,'assists',null);
 if(kind==='missing-row')raw.players.pop();if(kind==='duplicate')raw.players.push(p);if(kind==='minutes')p.minutes++;if(kind==='exact-minutes')s.officialDuration='00:01';if(kind==='bad-seconds')s.officialDuration='40:60';if(kind==='starter')p.starter=false;if(kind==='jersey')s.jerseyNumber='unknown';if(kind==='position')s.position=null;
 if(kind==='points')p.points++;if(kind==='rebounds')p.rebounds++;if(kind==='shooting')p.fieldGoalsMade=100;
 if(kind==='null-report')Reflect.set(raw,'officialReport',null);if(kind==='url')raw.reportUrl='https://example.test/report.pdf';if(kind==='hash')raw.officialReport.reportSha256='bad';if(kind==='row-hash')s.reportSha256='b'.repeat(64);if(kind==='page')s.page=2;if(kind==='date')s.verifiedOn='2026-10-02';
 if(kind==='unknown-key')Reflect.set(raw,'rawResponse',{});if(kind==='provider-claim')raw.provider='BigBallsData';if(kind==='partial')Reflect.set(raw,'playedCoverage',{status:'partial'});if(kind==='dnp')s.officialDuration='DNP';
 expect(validateRecoveredPlayerBox(raw,reference)).toBeNull();
});
it.each(['count','points','assists','margin','duration','unequal-duration','residual'])('requires complete report team totals: %s',kind=>{
 const raw=sample(),total=raw.officialReport.home;
 if(kind==='count')total.playedPlayerCount--;if(kind==='points')total.points++;if(kind==='assists')total.assists++;if(kind==='margin')total.plusMinus++;if(kind==='duration')total.officialDuration='240:00';if(kind==='unequal-duration')total.officialDuration='290:00';if(kind==='residual')total.durationResidualSeconds=1;
 expect(validateOfficialPlayerBox(raw,reference)).toBeNull();
});
it('keeps only explicitly evidenced report-internal seconds residuals',()=>{
 const raw=sample(),row=raw.players[0];const [m,s]=row.officialSource.officialDuration.split(':').map(Number);const seconds=m*60+s+1;
 row.officialSource.officialDuration=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;row.minutes=Math.round(seconds/60);
 expect(validateRecoveredPlayerBox(raw,reference)).toBeNull();raw.officialReport.away.durationResidualSeconds=1;
 expect(validateRecoveredPlayerBox(raw,reference)).not.toBeNull();raw.officialReport.away.durationResidualSeconds=6;expect(validateRecoveredPlayerBox(raw,reference)).toBeNull();
});
it.each([true,false])('renders official source and exact durations without provider attribution or invented player links, zh=%s',isZh=>{
 const box=validateRecoveredPlayerBox(sample(),reference)!;const html=renderToStaticMarkup(createElement(RecoveredPlayerBox,{box,isZh}));
 expect(html.match(/<table/g)).toHaveLength(2);expect(html).toContain(isZh?'NBA 官方赛后报告':'NBA official final report');expect(html).toContain(actualOvertime.reportUrl);
 expect(html).toContain('Nick Smith Jr.');expect(html).toContain('00:01');expect(html).toContain('HOU · 108');expect(html).toContain('LAL · 112');
 expect(html).not.toMatch(/BigBallsData|bigballsdata|Provider snapshot|数据源快照|identity error|身份错误|MIN ≈|\/player\//);
 expect(html).toContain(isZh?'核验日期：2026-10-03':'Verified 2026-10-03');
});
it('official NBA IDs are protected without creating provider UUID ownership',()=>{
 const root=temp();writeFileSync(join(root,`${actualOvertime.gameId}.json`),JSON.stringify(sample()));
 const boxes=readVerifiedSnapshotDirectory(root,{dates:[{games:[reference]}]});const index=buildStoredSnapshotIndex({},boxes,{});
 expect(index.existing.has(actualOvertime.gameId)).toBe(true);expect(index.protectedIds.has(actualOvertime.gameId)).toBe(true);expect(index.existingMatches.size).toBe(0);
 const pending=structuredClone(genericSample);pending.game.nbaGameId=actualOvertime.gameId;
 expect(planRecoveryReplay({pending:{snapshots:[pending],observations:[]},latest:{generic:{},verified:boxes,quarantined:{},observed:{}},schedule:{seasonYear:'2025',dates:[]},now:Date.parse('2026-10-03T02:00:00Z')})).toEqual({ok:false,reason:'protected-game'});
 expect(()=>buildStoredSnapshotIndex({[pending.game.nbaGameId]:pending},boxes,{})).toThrow();
});
it('generator validates official rows alongside all existing mixed/provider histories without changing old records',()=>{
 const root=temp();cpSync('src/data',root,{recursive:true});
 const schedule=structuredClone(historicalSchedule);for(const day of schedule.dates)for(const game of day.games)if(game.gameId===reference.gameId)Object.assign(game,reference);
 writeFileSync(join(root,'schedule-2025-26.json'),JSON.stringify(schedule));writeFileSync(join(root,`recovered-player-boxes/${actualOvertime.gameId}.json`),JSON.stringify(sample()));
 generateStoredArchives(root);const result=readStoredArchives(root);expect(result.verified[actualOvertime.gameId]).toEqual(sample());
 const original=JSON.parse(readFileSync('src/data/recovered-player-boxes.json','utf8'));for(const[id,box]of Object.entries(original))if(id!==actualOvertime.gameId)expect(result.verified[id]).toEqual(box);
 const index=buildStoredSnapshotIndex(result.generic,result.verified,result.quarantined);expect(index.protectedIds.has(actualOvertime.gameId)).toBe(true);const expectedOwners=new Set([...[...Object.values(result.generic),...Object.values(result.quarantined)].map(box=>box.game.providerMatchId),...Object.values(result.verified).map(box=>box.providerMatchId)].filter((id):id is string=>id!==null).map(id=>id.toLowerCase()));expect(new Set(index.existingMatches.keys())).toEqual(expectedOwners);
 const bad=sample();bad.players.pop();writeFileSync(join(root,`recovered-player-boxes/${actualOvertime.gameId}.json`),JSON.stringify(bad));const before=readFileSync(join(root,'recovered-player-boxes.json'),'utf8');expect(()=>generateStoredArchives(root)).toThrow();expect(readFileSync(join(root,'recovered-player-boxes.json'),'utf8')).toBe(before);
});
it('malformed official evidence cannot enter the verified store',()=>{const root=temp();mkdirSync(join(root,'rows'));const bad=sample();bad.players[0].officialSource.reportSha256='f'.repeat(64);writeFileSync(join(root,`rows/${bad.gameId}.json`),JSON.stringify(bad));expect(()=>readVerifiedSnapshotDirectory(join(root,'rows'),{dates:[{games:[reference]}]})).toThrow();});
