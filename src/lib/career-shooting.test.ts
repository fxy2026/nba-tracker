import{expect,it}from'vitest';
import{careerAggregationRows,normalizeCareerShooting,parseCareerShootingTable}from'./career-shooting';
import{normalizePlayerCareerData}from'./player-career-data';
const season={SEASON_ID:'2025-26',TEAM_ABBREVIATION:'LAL',GP:60,MIN:30,PTS:20,REB:5,AST:6,STL:1,BLK:0,FG_PCT:.5,FG3_PCT:.3,FT_PCT:.8};
const table=(override:Record<string,unknown>={})=>{const values={PLAYER_ID:2544,GP:100,FG_PCT:.467,FG3_PCT:0,FT_PCT:.8,FGA:15,FG3A:0,FTA:5,...override};return{headers:Object.keys(values),rowSet:[Object.values(values)]};};
it('takes reported career percentage directly, preserving real zero with attempts',()=>{
 expect(parseCareerShootingTable(table({FG_PCT:0}),2544)).toEqual({source:'nba-career-totals',FG_PCT:0,FG3_PCT:null,FT_PCT:.8});expect(parseCareerShootingTable(table(),2544)?.FG_PCT).toBe(.467);
});
it.each([{PLAYER_ID:1},{GP:0},{GP:1.5},{FGA:-1},{FGA:null},{FG_PCT:1.1},{FG_PCT:NaN},{FG3_PCT:'0.3'}])('malformed/wrong-player summary never becomes a career percentage %#',bad=>expect(parseCareerShootingTable(table(bad),2544)).toBeNull());
it('missing or multiple aggregate rows remain unavailable',()=>{
 expect(parseCareerShootingTable(null,2544)).toBeNull();expect(parseCareerShootingTable({...table(),rowSet:[]},2544)).toBeNull();expect(parseCareerShootingTable({...table(),rowSet:[...table().rowSet,...table().rowSet]},2544)).toBeNull();expect(parseCareerShootingTable({headers:['PLAYER_ID'],rowSet:[[2544]]},2544)).toBeNull();
});
it('optional invalid rates do not erase known season data',()=>{
 expect(normalizePlayerCareerData({careerSeasons:[season],careerShooting:{FG_PCT:9}})).toEqual({careerSeasons:[season]});const rates=parseCareerShootingTable(table(),2544)!;expect(normalizePlayerCareerData({careerSeasons:[season],careerShooting:rates})).toEqual({careerSeasons:[season],careerShooting:rates});expect(normalizeCareerShooting({source:'guessed',FG_PCT:.4,FG3_PCT:.3,FT_PCT:.8})).toBeNull();
});
it('TOT excludes its individual team splits from career arithmetic without mutating display rows',()=>{
 const total={...season,TEAM_ABBREVIATION:'TOT',GP:100};const rows=[season,{...season,TEAM_ABBREVIATION:'NYK',GP:40},total];expect(careerAggregationRows(rows)).toEqual([total]);expect(rows).toHaveLength(3);
});
it('distinct season/team rows remain while ambiguous duplicates fail closed',()=>{
 expect(careerAggregationRows([season,{...season,SEASON_ID:'2024-25'}])?.map(r=>r.SEASON_ID)).toEqual(['2024-25','2025-26']);expect(careerAggregationRows([season,{...season}])).toBeNull();expect(careerAggregationRows([{...season,TEAM_ABBREVIATION:'TOT'},{...season,TEAM_ABBREVIATION:'TOT'}])).toBeNull();
});
