import { afterEach, expect, it } from 'vitest';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateObservedFinalGame, planObservedFinalAdditions, type ObservedFinalGame } from './observed-final-game';
import { OFFICIAL_RECOVERY_SCHEDULE_URL, projectOfficialRecoverySchedule } from './recovery-official-schedule';
import { observedFinalsToSchedule, mergeObservedFinalSchedule } from './observed-final-schedule';
import { readObservedFinalDirectory, writeObservedFinals } from '../../scripts/recovery/official-game-store';
import { generateStoredArchives, assertObservedIdentityReferences } from '../../scripts/recovery/snapshot-store';

function sample(id='0022500001'):ObservedFinalGame {
 const now='2025-10-24T08:00:00Z';
 const result=projectOfficialRecoverySchedule({leagueSchedule:{seasonYear:'2025-26',gameDates:[{games:[{
  gameId:id,gameStatus:3,gameCode:'20251023/NYKSAS',gameDateTimeUTC:'2025-10-24T00:30:00Z',
  homeTeam:{teamId:1610612759,teamTricode:'SAS',score:90},awayTeam:{teamId:1610612752,teamTricode:'NYK',score:94}
 }]}]}},{expectedSeason:'2025-26',now,source:{url:OFFICIAL_RECOVERY_SCHEDULE_URL,sha256:'a'.repeat(64),observedAt:now}});
 if(result.status!=='ready')throw Error('Invalid fixture');
 return{version:1,game:result.games[0],source:result.source};
}
const roots:string[]=[];
function temp(){const root=mkdtempSync(join(tmpdir(),'nba-observed-test-'));roots.push(root);return root;}
afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
it('retains an old observed final after source cache freshness expires',()=>expect(validateObservedFinalGame(sample(),Date.parse('2026-10-02T00:00:00Z'))).toEqual(sample()));
it.each(['future','extra','hash','date','season','team','score','lookup'])('rejects unsafe stored observation %s',kind=>{
 const row=sample();
 if(kind==='future')row.source.observedAt='2028-10-24T08:00:00Z';
 if(kind==='extra')Reflect.set(row,'raw','not allowed');
 if(kind==='hash')row.source.sha256='bad';
 if(kind==='date')row.game.gameDate='2025-10-22';
 if(kind==='season')row.game.season='2026-27';
 if(kind==='team')row.game.home.teamId=row.game.away.teamId;
 if(kind==='score')row.game.home.score=row.game.away.score;
 if(kind==='lookup')row.game.lookupDates=['2025-10-22'];
 expect(validateObservedFinalGame(row,Date.parse('2026-10-02T00:00:00Z'))).toBeNull();
});
it('same identity retains original source bytes and conflicting corrections cannot overwrite it',()=>{
 const root=temp(),row=sample();writeObservedFinals(root,[row]);const file=join(root,`${row.game.nbaGameId}.json`),before=readFileSync(file,'utf8');
 const refreshed=sample();refreshed.source.sha256='b'.repeat(64);refreshed.source.observedAt='2025-10-25T08:00:00Z';writeObservedFinals(root,[refreshed]);expect(readFileSync(file,'utf8')).toBe(before);
 const correction=sample();correction.game.home.score=91;expect(()=>writeObservedFinals(root,[correction])).toThrow('overwrite');expect(readFileSync(file,'utf8')).toBe(before);
 expect(planObservedFinalAdditions({[row.game.nbaGameId]:row},[correction])).toEqual({additions:[],conflicts:[row.game.nbaGameId]});
});
it('validates an entire new batch before any files are written',()=>{const root=temp(),bad=sample('0022500002');bad.game.home.score=-1;expect(()=>writeObservedFinals(root,[sample(),bad])).toThrow();expect(readdirSync(root)).toEqual([]);});
it('empty input and failed upstream cannot clear persisted observations',()=>{const root=temp();writeObservedFinals(root,[sample()]);writeObservedFinals(root,[]);expect(readObservedFinalDirectory(root)).toEqual({[sample().game.nbaGameId]:sample()});});
it.each(['filename','symlink','marker','duplicate','oversize'])('rejects malformed storage %s',kind=>{
 const root=temp(),row=sample();
 if(kind==='filename')writeFileSync(join(root,'0022500002.json'),JSON.stringify(row));
 if(kind==='symlink'){const other=join(temp(),'row.json');writeFileSync(other,JSON.stringify(row));symlinkSync(other,join(root,`${row.game.nbaGameId}.json`));}
 if(kind==='marker')writeFileSync(join(root,'.gitkeep'),'nonempty');
 if(kind==='oversize')writeFileSync(join(root,`${row.game.nbaGameId}.json`),' '.repeat(16385));
 if(kind==='duplicate'){expect(()=>writeObservedFinals(root,[row,row])).toThrow();return;}
 expect(()=>readObservedFinalDirectory(root)).toThrow();
});
it('projects real identity and score without invented record, seed, leaders or player stats',()=>{
 const dates=observedFinalsToSchedule({[sample().game.nbaGameId]:sample()});
 expect(dates[0].gameDate).toBe('10/23/2025 00:00:00');
 expect(dates[0].games[0].homeTeam).toMatchObject({teamTricode:'SAS',score:90});
 expect(dates[0].games[0].homeTeam).not.toHaveProperty('wins');expect(dates[0].games[0].homeTeam).not.toHaveProperty('seed');expect(dates[0].games[0]).not.toHaveProperty('gameLeaders');
});
it('merges missing games on an existing date, retains live identities and never mutates input',()=>{
 const stored=observedFinalsToSchedule({[sample().game.nbaGameId]:sample(),[sample('0022500002').game.nbaGameId]:sample('0022500002')});
 const existing=structuredClone(stored);existing[0].games=existing[0].games.slice(0,1);existing[0].games[0].gameStatusText='Existing';const before=structuredClone(existing);
 const result=mergeObservedFinalSchedule(existing,stored);expect(result[0].games).toHaveLength(2);expect(result[0].games[0].gameStatusText).toBe('Existing');expect(existing).toEqual(before);
 expect(mergeObservedFinalSchedule(existing,[])).toBe(existing);
});
it('empty directory generates valid empty index and clean checkout regenerates all three aggregates',()=>{
 const root=temp();cpSync('src/data',root,{recursive:true});for(const name of ['provider-player-boxes.json','recovered-player-boxes.json','observed-final-games.json'])rmSync(join(root,name),{force:true});
 generateStoredArchives(root);expect(JSON.parse(readFileSync(join(root,'observed-final-games.json'),'utf8'))).toEqual({});
 expect(Object.keys(JSON.parse(readFileSync(join(root,'recovered-player-boxes.json'),'utf8')))).toHaveLength(57);
});
it('a corrupt observed record does not replace any good generated artifact',()=>{
 const root=temp();cpSync('src/data',root,{recursive:true});generateStoredArchives(root);const before=readFileSync(join(root,'recovered-player-boxes.json'),'utf8');
 mkdirSync(join(root,'observed-final-games'),{recursive:true});writeFileSync(join(root,'observed-final-games/0022500001.json'),'{broken');
 expect(()=>generateStoredArchives(root)).toThrow();expect(readFileSync(join(root,'recovered-player-boxes.json'),'utf8')).toBe(before);
});

it('existing schedule and saved player identities must agree with a persisted tuple',()=>{
 const row=sample(), observed={[row.game.nbaGameId]:row}, schedule={dates:observedFinalsToSchedule({[row.game.nbaGameId]:row})};
 expect(()=>assertObservedIdentityReferences(observed,schedule,{})).not.toThrow();
 const wrong=structuredClone(schedule);wrong.dates[0].games[0].homeTeam.score=91;
 expect(()=>assertObservedIdentityReferences(observed,wrong,{})).toThrow('saved schedule');
 const generic={game:{nbaGameId:row.game.nbaGameId,season:row.game.season,gameDate:row.game.gameDate,home:{tricode:'SAS',score:91},away:{tricode:'NYK',score:94}}};
 expect(()=>assertObservedIdentityReferences(observed,{dates:[]},{[row.game.nbaGameId]:generic as never})).toThrow('saved player');
});
