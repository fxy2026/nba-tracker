import{expect,it}from'vitest';
import{parseShotGameDate,orderUniqueShotGames}from'./player-shot-game-order';
it.each([['JAN 02, 2026','2026-01-02'],['Feb 29, 2024','2024-02-29'],['2026-06-13','2026-06-13'],['2026-06-13T00:00:00Z','2026-06-13'],['06/13/2026 00:00:00','2026-06-13']])('parses explicit date %s without local timezone shifting', (raw,date)=>expect(parseShotGameDate(raw)).toBe(date));
it.each([null,'','FEB 29, 2026','2026-02-30','13/01/2026','whatever','2026-06-13T23:30:00Z','JUN 31, 2026'])('rejects unsupported or invalid date %s',raw=>expect(parseShotGameDate(raw)).toBeNull());
it('ordering is chronological and independent of response order',()=>{
 const rows=[{gameId:'0042500405',date:'2026-06-13'},{gameId:'0022500001',date:'2025-10-21'},{gameId:'0042500101',date:'2026-04-18'}];expect(orderUniqueShotGames(rows)).toEqual(['0022500001','0042500101','0042500405']);expect(orderUniqueShotGames([...rows].reverse())).toEqual(orderUniqueShotGames(rows));
});
it('same-date duplicates dedupe while conflicting dates fail closed',()=>{
 const row={gameId:'0042500405',date:'2026-06-13'};expect(orderUniqueShotGames([row,row])).toEqual([row.gameId]);expect(orderUniqueShotGames([row,{...row,date:'2026-06-12'}])).toBeNull();
});
it('same-day tie is deterministic and bad IDs cannot enter requests',()=>{
 expect(orderUniqueShotGames([{gameId:'0022500002',date:'2025-10-21'},{gameId:'0022500001',date:'2025-10-21'}])).toEqual(['0022500001','0022500002']);expect(orderUniqueShotGames([{gameId:'not-id',date:'2025-10-21'}])).toBeNull();
});
