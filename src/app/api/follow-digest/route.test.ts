import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { getFullSchedule, getPlayerIndexSnapshot, getBoxScore } = vi.hoisted(() => ({getFullSchedule:vi.fn(),getPlayerIndexSnapshot:vi.fn(),getBoxScore:vi.fn()}));
vi.mock("@/lib/api",()=>({getFullSchedule,getPlayerIndexSnapshot,getBoxScore}));
import { GET } from "./route";
const provenance = {source:"nba-cdn",season:"2026-27",stale:false,retrievedAt:null};
const player = {personId:1,firstName:"Test",lastName:"Player",teamAbbr:"BOS",teamId:1610612738,pts:0,reb:0,ast:0};
const side = (teamTricode:string) => ({teamTricode,teamId:1610612738,score:100});
const game = (gameId:string,status:number,utc:string) => ({gameId,gameStatus:status,gameDateTimeUTC:utc,homeTeam:side("BOS"),awayTeam:{...side("NYK"),score:90}});
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));vi.clearAllMocks();getBoxScore.mockResolvedValue(null);getFullSchedule.mockResolvedValue([{gameDate:"",games:[game("0022600001",3,"2026-10-21T00:00:00Z"),game("0022600002",1,"2026-10-25T00:00:00Z")]}]);getPlayerIndexSnapshot.mockResolvedValue({players:[player,{...player,personId:2}],provenance});});
afterEach(()=>vi.useRealTimers());
async function request(query="players=1,2") {return (await GET(new NextRequest(`https://example.test/api/follow-digest?${query}`))).json();}
it("reads index once for concurrent player entries and preserves real zero averages",async()=>{const data=await request();expect(getFullSchedule).toHaveBeenCalledTimes(1);expect(getPlayerIndexSnapshot).toHaveBeenCalledTimes(1);expect(data.players[0]).toMatchObject({seasonAvg:{pts:0,reb:0,ast:0},provenance,currentTeamKnown:true,nextGame:{gameId:"0022600002"}});});
it.each([{...provenance,source:"bundled-archive",season:"2025-26"},{...provenance,stale:true},{...provenance,season:null},{...provenance,season:"2025-26"}])("preserves source averages but suppresses unsupported current-team next game: %j",async(meta)=>{getPlayerIndexSnapshot.mockResolvedValue({players:[player],provenance:meta});const data=await request("players=1");expect(data.players[0]).toMatchObject({provenance:meta,currentTeamKnown:false,nextGame:null,seasonAvg:{pts:0,reb:0,ast:0}});});
it("rejects partial null averages instead of exposing values that crash toFixed",async()=>{getPlayerIndexSnapshot.mockResolvedValue({players:[{...player,pts:10,reb:null}],provenance});expect((await request("players=1")).players[0].seasonAvg).toBeNull();});
it("team-only requests do not fetch the index",async()=>{await request("teams=BOS");expect(getPlayerIndexSnapshot).not.toHaveBeenCalled();});
it("index failure degrades one source without dropping team results",async()=>{getPlayerIndexSnapshot.mockRejectedValue(new Error("offline"));const data=await request("teams=BOS&players=1");expect(data.teams[0].wins).toBe(1);expect(data.players[0]).toMatchObject({provenance:null,lastLine:null,seasonAvg:null,currentTeamKnown:false,nextGame:null});});
it("retains an actual historical player appearance after a DNP box",async()=>{
 getFullSchedule.mockResolvedValue([{gameDate:"",games:[game("0022500002",3,"2026-04-12T00:00:00Z"),game("0022500001",3,"2026-04-11T00:00:00Z")]}]);
 getPlayerIndexSnapshot.mockResolvedValue({players:[player],provenance:{...provenance,source:"bundled-archive",season:"2025-26"}});
 const box=(id:string,minutes:string)=>({gameId:id,gameTimeUTC:"2026-04-11T00:00:00Z",homeTeam:{...side("BOS"),players:[{personId:1,statistics:{minutes,points:12,reboundsTotal:3,assists:4,steals:0,blocks:0,fieldGoalsMade:5,fieldGoalsAttempted:10,threePointersMade:2,threePointersAttempted:4}}]},awayTeam:{...side("NYK"),score:90,players:[]}});
 getBoxScore.mockResolvedValueOnce(box("0022500002","PT00M00.00S")).mockResolvedValueOnce(box("0022500001","PT20M00.00S"));
 const data=await request("players=1");expect(data.players[0].lastLine).toMatchObject({gameId:"0022500001",pts:12});expect(getBoxScore).toHaveBeenCalledTimes(2);
});
