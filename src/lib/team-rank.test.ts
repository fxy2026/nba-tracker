import { expect, it } from "vitest";
import { TEAM_META } from "./teams";
import { conferenceRank, hasPlayedRecord } from "./team-rank";
it("has no rank for all-zero, missing and absent records",()=>{expect(conferenceRank(TEAM_META.BOS,{})).toBe(0);expect(conferenceRank(TEAM_META.BOS,{BOS:{w:0,l:0},NYK:{w:0,l:0}})).toBe(0);});
it("another team playing does not assign a rank to an unplayed team",()=>{expect(conferenceRank(TEAM_META.BOS,{NYK:{w:1,l:0}})).toBe(0);});
it.each([{w:NaN,l:1},{w:Infinity,l:1},{w:-1,l:1},{w:1.5,l:1},{w:null,l:1},{w:1,l:undefined}])("rejects malformed record %j",(value)=>{const record=value as unknown as {w:number;l:number};expect(hasPlayedRecord(record)).toBe(false);expect(conferenceRank(TEAM_META.BOS,{BOS:record})).toBe(0);});
it("preserves real zero wins for a team that has played",()=>{expect(conferenceRank(TEAM_META.BOS,{BOS:{w:0,l:1},NYK:{w:1,l:0}})).toBe(2);expect(hasPlayedRecord({w:0,l:1})).toBe(true);});
it("preserves normal win-percentage ordering and excludes the other conference",()=>{expect(conferenceRank(TEAM_META.BOS,{BOS:{w:8,l:2},NYK:{w:9,l:1},ATL:{w:1,l:9},LAL:{w:10,l:0}})).toBe(2);});
it("retains TEAM_META order for actual equal percentages without claiming official tiebreakers",()=>{const entries=Object.values(TEAM_META).filter(t=>t.conference==="East").slice(0,3);const map=Object.fromEntries(entries.map(t=>[t.tricode,{w:5,l:5}]));entries.forEach((team,index)=>expect(conferenceRank(team,map)).toBe(index+1));});
