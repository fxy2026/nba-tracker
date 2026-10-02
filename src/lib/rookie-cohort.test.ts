import { describe, expect, it } from "vitest";
import { rookieCohort, filterRookieRows } from "./rookie-cohort";
const current={source:"nba-cdn",season:"2026-27",stale:false,retrievedAt:"2026-10-02T00:00:00Z"};
const first={personId:1,fromYear:"2026",toYear:"2026",draftYear:null};
describe("index-derived rookie cohort",()=>{
 it.each([null,{}, {...current,source:"bundled-archive"},{...current,stale:true},{...current,season:"2025-26"},{...current,season:null}])("fails closed with unsupported provenance %j",meta=>{
  const cohort=rookieCohort([first],meta,"2026-27");expect(cohort.available).toBe(false);
  expect(filterRookieRows([{PLAYER_ID:1,GP:30,PTS:10,REB:2,AST:1}],cohort)).toEqual([]);
 });
 it("empty current cohort never widens to league players",()=>expect(filterRookieRows([{PLAYER_ID:2,GP:30,PTS:50,REB:20,AST:10}],rookieCohort([],current,"2026-27"))).toEqual([]));
 it("uses current first-year tenure, not draft class, and retains unknown draft fields",()=>{
  const players=[first,{...first,personId:2,fromYear:"2025"},{...first,personId:3,fromYear:"2024",draftYear:2026},{...first,personId:4,fromYear:"2026x"},{...first,personId:5,toYear:"2025"},first];
  const cohort=rookieCohort(players,current,"2026-27");
  expect(cohort.available).toBe(true);expect(cohort.rookieIds).toEqual([1]);expect(cohort.sophomoreIds).toEqual([2]);
 });
 it("filters exact IDs, rejects missing stats and keeps recorded zeros",()=>{
  const cohort=rookieCohort([first,{...first,personId:2}],current,"2026-27");
  const rows=[{PLAYER_ID:1,GP:20,PTS:0,REB:0,AST:0},{PLAYER_ID:2,GP:25,PTS:10,REB:null,AST:1},{PLAYER_ID:9,GP:50,PTS:50,REB:10,AST:10}];
  expect(filterRookieRows(rows as Parameters<typeof filterRookieRows>[0],cohort)).toEqual([rows[0]]);
 });
 it("declared source season survives unavailable state",()=>expect(rookieCohort([first],{...current,season:"2025-26"},"2026-27").sourceSeason).toBe("2025-26"));
});
