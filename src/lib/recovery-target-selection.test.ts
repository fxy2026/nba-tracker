import { expect,it } from 'vitest';
import { selectRecoveryTargets } from './recovery-target-selection';
import archive from '../data/schedule-2025-26.json';
function game(gameId:string,date='2026-04-01',index=0){return {gameId,gameStatus:3,gameCode:`${date.replaceAll('-','')}/MEMDET`,gameDateTimeUTC:`${date}T23:00:00Z`,homeTeam:{teamTricode:'DET',score:100+index},awayTeam:{teamTricode:'MEM',score:90}};}
const fixture=(games:ReturnType<typeof game>[])=>({dates:[{games}]});
const ids=['0022500001','0042500101','0042500201','0042500301','0042500401'];
const source=fixture(ids.map((id,i)=>game(id,id.startsWith('002')?'2026-09-01':'2026-04-01',i)));
it('prioritizes Finals then conference finals then earlier rounds before newer regular games',()=>{
 expect(selectRecoveryTargets(source,new Set(),null).map(g=>g.nbaGameId)).toEqual([...ids].reverse());
});
it('orders ties by newest calendar date then ID independently of source order',()=>{
 const raw=fixture([game('0042500401','2026-06-01',1),game('0042500402','2026-06-02',2),game('0042500403','2026-06-02',3)]);
 expect(selectRecoveryTargets(raw,new Set(),null).map(g=>g.nbaGameId)).toEqual(['0042500403','0042500402','0042500401']);
});
it('retains cursor progress and wraps without reprocessing saved strong snapshots',()=>{
 const saved=new Set(['0042500401']);
 const first=selectRecoveryTargets(source,saved,null,2);expect(first.map(g=>g.nbaGameId)).toEqual(['0042500301','0042500201']);
 first.forEach(g=>saved.add(g.nbaGameId));
 const next=selectRecoveryTargets(source,saved,first[1].nbaGameId,2);expect(next.map(g=>g.nbaGameId)).toEqual(['0042500101','0022500001']);
 next.forEach(g=>saved.add(g.nbaGameId));expect(selectRecoveryTargets(source,saved,next[1].nbaGameId,2)).toEqual([]);
});
it('an unavailable final advances rather than permanently starving lower priority games',()=>{
 const first=selectRecoveryTargets(source,new Set(),null,1)[0];
 expect(selectRecoveryTargets(source,new Set(),first.nbaGameId,1)[0].nbaGameId).toBe('0042500301');
});
it.each(['0042500471','0042500271','0042500501','0042500409','9401810012'])('rejects invalid or synthetic playoff identities %s',id=>{
 expect(selectRecoveryTargets(fixture([game(id)]),new Set(),null)).toEqual([]);
});
it('actual archive first batch contains twenty valid playoff games and preserves all saved IDs',()=>{
 const games=selectRecoveryTargets(archive,new Set(['0042500401']),null);
 expect(games).toHaveLength(20);expect(games.every(g=>g.nbaGameId.startsWith('00425'))).toBe(true);
 expect(games.some(g=>g.nbaGameId==='0042500401')).toBe(false);
 expect(games[0].nbaGameId[7]).toBe('4');
});

it('retrying earlier metadata failures skips the newly restored Finals table',()=>{const targets=selectRecoveryTargets(archive,new Set(['0042500405','0022500340','0022500961']),null,20);expect(targets).toHaveLength(20);expect(targets[0].nbaGameId).toBe('0042500404');expect(targets.some(game=>game.nbaGameId==='0042500405')).toBe(false);});
