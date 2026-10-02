import { expect, it } from 'vitest';
import { playerShotRequestUrl, normalizePlayerShotData } from './player-shot-request';
it.each(['2025-26','2011-12'])('older indexed season%s remains explicit after rollover',season=>{const url=playerShotRequestUrl(2544,'LAL',season,'regular','2026-27');expect(new URL(url,'https://example.test').searchParams.get('season')).toBe(season);});
it('genuinely current team season retains schedule fast path',()=>expect(playerShotRequestUrl(2544,'LAL','2026-27','regular','2026-27')).not.toContain('&season='));
it('current TOT preserves player-specific season query',()=>expect(playerShotRequestUrl(2544,'TOT','2026-27','all','2026-27')).toContain('&season=2026-27'));
it('includes response-contract cache version',()=>expect(playerShotRequestUrl(2544,'LAL','2025-26','regular','2026-27')).toContain('context=4'));
it.each([null,{}, {shots:null,gamesLoaded:0,totalGames:0},{shots:[],gamesLoaded:null,totalGames:0},{shots:[{x:null,y:1,shotDistance:5,shotResult:'Made'}],gamesLoaded:1,totalGames:1},{shots:[{x:0,y:0,shotDistance:1,shotResult:'Made'}],gamesLoaded:0,totalGames:0}])('malformed/unavailable shot data is not fabricatedempty%j',raw=>expect(normalizePlayerShotData(raw)).toBeNull());
it('preserves zero coordinates and validempty distinctly',()=>{const data={shots:[{x:0,y:0,shotDistance:0,shotResult:'Made'}],gamesLoaded:1,totalGames:1};expect(normalizePlayerShotData(data)).toEqual(data);expect(normalizePlayerShotData({shots:[],gamesLoaded:0,totalGames:0})).not.toBeNull();});
