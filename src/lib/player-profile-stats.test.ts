import { describe, expect, it } from "vitest";
import { hasCompleteAverages, knownAverage, profileStatContext } from "./player-profile-stats";
describe("profile averages",()=>{
 it.each([null,undefined,NaN,Infinity,-1,"0",""])("treats %s as unknown rather than zero",value=>expect(knownAverage(value)).toBeNull());
 it.each([0,1.4,30])("keeps real average %s",value=>expect(knownAverage(value)).toBe(value));
 it("requires all three averages while keeping zeros",()=>{
  expect(hasCompleteAverages({pts:0,reb:0,ast:0})).toBe(true);
  expect(hasCompleteAverages({pts:10,reb:null,ast:5})).toBe(false);
 });
 it("does not invent rank or league average for missing subject values",()=>{
  expect(profileStatContext([{personId:1,pts:null,reb:null,ast:null}],1,"pts",null)).toBeNull();
  expect(profileStatContext([],1,"pts",10)).toBeNull();
 });
 it("excludes unknown specific stats but counts recorded zero in known population",()=>{
  const players=[{personId:1,pts:10,reb:0,ast:1},{personId:2,pts:20,reb:10,ast:2},{personId:3,pts:15,reb:null,ast:3}];
  expect(profileStatContext(players,1,"reb",0)).toEqual({rank:2,percentile:0,leagueAvg:5,delta:-100});
  expect(profileStatContext(players,3,"reb",null)).toBeNull();
 });
 it("preserves ordinary valid ranking calculation and avoids division by zero",()=>{
  const players=[{personId:1,pts:10,reb:0,ast:0},{personId:2,pts:20,reb:0,ast:0}];
  expect(profileStatContext(players,2,"pts",20)).toMatchObject({rank:1,percentile:50,leagueAvg:15});
  expect(profileStatContext(players,1,"reb",0)).toMatchObject({leagueAvg:0,delta:null});
  expect(profileStatContext([{personId:1,pts:0,reb:0,ast:0}],1,"pts",0)).toBeNull();
 });
});
