import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import raw from '../data/recovered-player-boxes/0042500164.json';
import original from '../data/supplemented-player-box-originals/0042500164.json';
import history from '../data/supplemented-player-box-history.json';
import archive from '../data/recovered-player-boxes.json';
import schedule from '../data/schedule-2025-26.json';
import { validateRecoveredPlayerBox, type RecoveredPlayerBox } from './recovered-player-box';
import { assertSupplementedHistory, readStoredArchives } from '../../scripts/recovery/snapshot-store';
import RecoveredPlayerBoxView from '@/app/game/[id]/_components/RecoveredPlayerBox';
const game = schedule.dates.flatMap(day => day.games).find(row => row.gameId === raw.gameId)!;
const box = raw as RecoveredPlayerBox;
const additions = box.players.slice(19);
const fields = ['points','rebounds','assists','fieldGoalsMade','fieldGoalsAttempted','threePointersMade','threePointersAttempted','freeThrowsMade','freeThrowsAttempted','offensiveRebounds','defensiveRebounds','steals','blocks','turnovers','fouls','plusMinus'] as const;
it('fills the exact two officially played rows without changing the original19 values or evidence bytes',()=>{
 expect(validateRecoveredPlayerBox(raw,game)).not.toBeNull(); expect(box.players).toHaveLength(21); expect(box.playedCoverage).toBeUndefined();
 expect(box.players.slice(0,19)).toEqual(original.players);
 expect(createHash('sha256').update(readFileSync('src/data/supplemented-player-box-originals/0042500164.json')).digest('hex')).toBe(history[raw.gameId as keyof typeof history].originalFileSha256);
 expect(additions.map(p=>p.name)).toEqual(['DaRon Holmes II','Jalen Pickett']);
 for(const p of additions){expect(p.team).toBe('DEN');expect(p.providerPlayerId).toBeNull();expect(p.source).toBe('NBA official final report');expect(p.starter).toBe(false);expect(p.minutes).toBe(0);expect(p.officialSource?.officialDuration).toBe('00:01');expect(p.officialSource?.position).toBeNull();for(const field of fields)expect(p[field]).toBe(0);}
 expect(additions.map(p=>p.officialSource?.jerseyNumber)).toEqual(['14','24']);
 expect(box.players.filter(p=>p.team==='DEN')).toHaveLength(10);expect(box.players.filter(p=>p.team==='MIN')).toHaveLength(11);
 expect(box.players.filter(p=>p.team==='DEN').reduce((sum,p)=>sum+p.points,0)).toBe(96);expect(box.players.filter(p=>p.team==='MIN').reduce((sum,p)=>sum+p.points,0)).toBe(112);
});
it.each([true,false])('renders completed21/21 with missing-row source explanation and real durations, zh=%s',isZh=>{
 const html=renderToStaticMarkup(createElement(RecoveredPlayerBoxView,{box,isZh}));
 expect(html.match(/<th scope="row"/g)).toHaveLength(21);expect(html).toContain(isZh?'21/21':'21 of 21');expect(html).toContain('DaRon Holmes II 00:01');expect(html).toContain('Jalen Pickett 00:01');expect(html).toContain('‡');
 expect(html).not.toContain(isZh?'球员身份错误':'player identity error');expect(html).not.toContain(isZh?'部分球员数据':'Partial player box score');
 expect(html).toContain(isZh?'0 不代表 DNP':'0 is not a DNP');expect(html).toContain('NBA');
});
it.each(['count','names','duplicate','report','hash','source','provider-id','position-starter','duration','negative','still-partial'])('rejects malformed supplemental provenance %s',kind=>{
 const changed=structuredClone(box);const s=changed.sourceSupplement!;const p=changed.players[19];
 if(kind==='count')s.officialPlayedPlayerCount=20;
 if(kind==='names')s.addedOfficialPlayerNames=['Unknown','Jalen Pickett'];
 if(kind==='duplicate')s.addedOfficialPlayerNames=['Jalen Pickett','Jalen Pickett'];
 if(kind==='report')s.reportUrl='https://example.com/report.pdf';
 if(kind==='hash')s.reportSha256='0'.repeat(64);
 if(kind==='source')p.source=undefined;
 if(kind==='provider-id')p.providerPlayerId='11111111-1111-4111-8111-111111111111';
 if(kind==='position-starter')p.starter=true;
 if(kind==='duration')p.officialSource!.officialDuration='01:01';
 if(kind==='negative')p.points=-1;
 if(kind==='still-partial')changed.playedCoverage=original.playedCoverage as RecoveredPlayerBox['playedCoverage'];
 expect(validateRecoveredPlayerBox(changed,game)).toBeNull();
});
function root(){const dir=mkdtempSync(join(tmpdir(),'nba-supplement-'));cpSync('src/data/supplemented-player-box-originals',join(dir,'supplemented-player-box-originals'),{recursive:true});cpSync('src/data/supplemented-player-box-history.json',join(dir,'supplemented-player-box-history.json'));return dir;}
it('binds source supplements separately from identity corrections and preserves active uniqueness',()=>{
 expect(assertSupplementedHistory('src/data',archive as Record<string,RecoveredPlayerBox>)).toEqual(new Set(['0042500164']));
 expect(Object.keys(readStoredArchives().verified)).toHaveLength(57);
});
it.each(['original-bytes','original-hash','new-hash','row','metadata','missing','source-kind'])('history refuses modified originals or additions %s',kind=>{
 const dir=root();try{
  const h=structuredClone(history);const boxes=structuredClone(archive) as Record<string,RecoveredPlayerBox>;
  if(kind==='original-bytes')writeFileSync(join(dir,'supplemented-player-box-originals/0042500164.json'),'{}');
  if(kind==='original-hash')h['0042500164'].originalSnapshotSha256='bad';
  if(kind==='new-hash')h['0042500164'].supplementedSnapshotSha256='bad';
  if(kind==='row')boxes['0042500164'].players[0].rebounds=99;
  if(kind==='metadata')boxes['0042500164'].retrievedAt='2026-10-03T00:00:00Z';
  if(kind==='missing')delete boxes['0042500164'];
  if(kind==='source-kind')Object.assign(h['0042500164'],{status:'identity-correction'});
  writeFileSync(join(dir,'supplemented-player-box-history.json'),JSON.stringify(h));
  expect(()=>assertSupplementedHistory(dir,boxes)).toThrow();
 }finally{rmSync(dir,{recursive:true,force:true});}
});
